use std::{
    collections::{HashMap, VecDeque},
    fs,
    io::Write,
    num::NonZeroU32,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use axum::http::HeaderMap;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ring::{pbkdf2, rand::SecureRandom};
use serde::{Deserialize, Serialize};

const HASH_BYTES: usize = 32;
const SALT_BYTES: usize = 16;
const SESSION_BYTES: usize = 32;
const PBKDF2_ITERATIONS: u32 = 310_000;
const SESSION_LIFETIME: Duration = Duration::from_secs(12 * 60 * 60);
const FAILURE_WINDOW: Duration = Duration::from_secs(60);
const FAILURE_LIMIT: usize = 5;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthRecord {
    username: String,
    salt: String,
    password_hash: String,
    iterations: u32,
    #[serde(default)]
    revision: String,
}

#[derive(Debug, Clone)]
struct Session {
    username: String,
    expires_at: Instant,
    revision: String,
}

#[derive(Debug, Default)]
struct LoginFailures {
    attempts: VecDeque<Instant>,
}

struct AuthInner {
    path: PathBuf,
    record: Mutex<Option<AuthRecord>>,
    sessions: Mutex<HashMap<String, Session>>,
    failures: Mutex<HashMap<String, LoginFailures>>,
    secure_cookie: bool,
}

#[derive(Clone)]
pub struct AuthService {
    inner: Arc<AuthInner>,
}

impl AuthService {
    pub fn load(path: PathBuf, secure_cookie: bool) -> Result<Self, String> {
        let record = if path.is_file() {
            let text =
                fs::read_to_string(&path).map_err(|error| format!("无法读取账号配置：{error}"))?;
            Some(
                serde_json::from_str(&text)
                    .map_err(|error| format!("账号配置格式无效：{error}"))?,
            )
        } else {
            None
        };
        Ok(Self {
            inner: Arc::new(AuthInner {
                path,
                record: Mutex::new(record),
                sessions: Mutex::new(HashMap::new()),
                failures: Mutex::new(HashMap::new()),
                secure_cookie,
            }),
        })
    }

    pub fn is_configured(&self) -> bool {
        self.refresh_record_from_disk();
        self.inner
            .record
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .is_some()
    }

    pub fn setup(&self, username: &str, password: &str) -> Result<String, String> {
        validate_credentials(username, password)?;
        let mut guard = self
            .inner
            .record
            .lock()
            .map_err(|_| "账号状态锁已损坏".to_string())?;
        if guard.is_some() {
            return Err("管理员账号已经设置".to_string());
        }
        let record = make_record(username.trim(), password)?;
        persist_record(&self.inner.path, &record)?;
        *guard = Some(record);
        drop(guard);
        self.issue_session(username.trim())
    }

    pub fn login(&self, username: &str, password: &str, peer: &str) -> Result<String, String> {
        self.refresh_record_from_disk();
        self.check_rate_limit(peer)?;
        let record = self
            .inner
            .record
            .lock()
            .map_err(|_| "账号状态锁已损坏".to_string())?
            .clone()
            .ok_or_else(|| "管理员账号尚未设置".to_string())?;
        if record.username != username.trim() || !verify_password(&record, password) {
            self.record_failure(peer);
            return Err("账号或密码错误".to_string());
        }
        self.clear_failures(peer);
        self.issue_session(&record.username)
    }

    pub fn change_credentials(
        &self,
        current_password: &str,
        username: &str,
        new_password: &str,
    ) -> Result<String, String> {
        validate_credentials(username, new_password)?;
        let mut guard = self
            .inner
            .record
            .lock()
            .map_err(|_| "账号状态锁已损坏".to_string())?;
        let current = guard
            .as_ref()
            .ok_or_else(|| "管理员账号尚未设置".to_string())?;
        if !verify_password(current, current_password) {
            return Err("当前密码错误".to_string());
        }
        let record = make_record(username.trim(), new_password)?;
        persist_record(&self.inner.path, &record)?;
        *guard = Some(record);
        drop(guard);
        self.invalidate_sessions();
        self.issue_session(username.trim())
    }

    pub fn reset_password(&self, password: &str) -> Result<(), String> {
        validate_password(password)?;
        let mut guard = self
            .inner
            .record
            .lock()
            .map_err(|_| "账号状态锁已损坏".to_string())?;
        let current = guard
            .as_ref()
            .ok_or_else(|| "管理员账号尚未设置，无法重置密码".to_string())?;
        let record = make_record(&current.username, password)?;
        persist_record(&self.inner.path, &record)?;
        *guard = Some(record);
        drop(guard);
        self.invalidate_sessions();
        Ok(())
    }

    pub fn authenticated_username(&self, headers: &HeaderMap) -> Option<String> {
        self.refresh_record_from_disk();
        let token = session_token(headers)?;
        let now = Instant::now();
        let revision = self
            .inner
            .record
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .as_ref()?
            .revision
            .clone();
        let mut sessions = self
            .inner
            .sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        sessions.retain(|_, session| session.expires_at > now);
        sessions
            .get(&token)
            .filter(|session| session.revision == revision)
            .map(|session| session.username.clone())
    }

    pub fn logout(&self, headers: &HeaderMap) {
        let Some(token) = session_token(headers) else {
            return;
        };
        self.inner
            .sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&token);
    }

    pub fn cookie_for(&self, token: &str) -> String {
        let secure = if self.inner.secure_cookie {
            "; Secure"
        } else {
            ""
        };
        format!(
            "xbm_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={}{}",
            SESSION_LIFETIME.as_secs(),
            secure
        )
    }

    pub fn expired_cookie(&self) -> String {
        let secure = if self.inner.secure_cookie {
            "; Secure"
        } else {
            ""
        };
        format!("xbm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0{secure}")
    }

    fn issue_session(&self, username: &str) -> Result<String, String> {
        let mut bytes = [0u8; SESSION_BYTES];
        ring::rand::SystemRandom::new()
            .fill(&mut bytes)
            .map_err(|_| "无法生成登录会话".to_string())?;
        let token = URL_SAFE_NO_PAD.encode(bytes);
        let revision = self
            .inner
            .record
            .lock()
            .map_err(|_| "账号状态锁已损坏".to_string())?
            .as_ref()
            .ok_or_else(|| "管理员账号尚未设置".to_string())?
            .revision
            .clone();
        self.inner
            .sessions
            .lock()
            .map_err(|_| "登录会话锁已损坏".to_string())?
            .insert(
                token.clone(),
                Session {
                    username: username.to_string(),
                    expires_at: Instant::now() + SESSION_LIFETIME,
                    revision,
                },
            );
        Ok(token)
    }

    fn invalidate_sessions(&self) {
        self.inner
            .sessions
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clear();
    }

    fn check_rate_limit(&self, peer: &str) -> Result<(), String> {
        let now = Instant::now();
        let mut failures = self
            .inner
            .failures
            .lock()
            .map_err(|_| "登录限速锁已损坏".to_string())?;
        let entry = failures.entry(peer.to_string()).or_default();
        while entry
            .attempts
            .front()
            .is_some_and(|attempt| now.duration_since(*attempt) > FAILURE_WINDOW)
        {
            entry.attempts.pop_front();
        }
        if entry.attempts.len() >= FAILURE_LIMIT {
            return Err("登录失败次数过多，请一分钟后重试".to_string());
        }
        Ok(())
    }

    fn record_failure(&self, peer: &str) {
        self.inner
            .failures
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .entry(peer.to_string())
            .or_default()
            .attempts
            .push_back(Instant::now());
    }

    fn clear_failures(&self, peer: &str) {
        self.inner
            .failures
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(peer);
    }

    fn refresh_record_from_disk(&self) {
        let Ok(text) = fs::read_to_string(&self.inner.path) else {
            return;
        };
        let Ok(disk_record) = serde_json::from_str::<AuthRecord>(&text) else {
            return;
        };
        let mut record = self
            .inner
            .record
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if record.as_ref() != Some(&disk_record) {
            *record = Some(disk_record);
            self.invalidate_sessions();
        }
    }
}

fn make_record(username: &str, password: &str) -> Result<AuthRecord, String> {
    let mut salt = [0u8; SALT_BYTES];
    ring::rand::SystemRandom::new()
        .fill(&mut salt)
        .map_err(|_| "无法生成密码盐值".to_string())?;
    let iterations = NonZeroU32::new(PBKDF2_ITERATIONS).expect("iterations are non-zero");
    let mut hash = [0u8; HASH_BYTES];
    pbkdf2::derive(
        pbkdf2::PBKDF2_HMAC_SHA256,
        iterations,
        &salt,
        password.as_bytes(),
        &mut hash,
    );
    let mut revision = [0u8; 12];
    ring::rand::SystemRandom::new()
        .fill(&mut revision)
        .map_err(|_| "无法生成账号配置版本".to_string())?;
    Ok(AuthRecord {
        username: username.to_string(),
        salt: URL_SAFE_NO_PAD.encode(salt),
        password_hash: URL_SAFE_NO_PAD.encode(hash),
        iterations: PBKDF2_ITERATIONS,
        revision: URL_SAFE_NO_PAD.encode(revision),
    })
}

fn verify_password(record: &AuthRecord, password: &str) -> bool {
    let Ok(salt) = URL_SAFE_NO_PAD.decode(&record.salt) else {
        return false;
    };
    let Ok(hash) = URL_SAFE_NO_PAD.decode(&record.password_hash) else {
        return false;
    };
    let Some(iterations) = NonZeroU32::new(record.iterations) else {
        return false;
    };
    pbkdf2::verify(
        pbkdf2::PBKDF2_HMAC_SHA256,
        iterations,
        &salt,
        password.as_bytes(),
        &hash,
    )
    .is_ok()
}

fn validate_credentials(username: &str, password: &str) -> Result<(), String> {
    let username = username.trim();
    if username.chars().count() < 3 || username.chars().count() > 64 {
        return Err("管理员账号长度应为 3～64 个字符".to_string());
    }
    if username.chars().any(char::is_control) {
        return Err("管理员账号包含无效字符".to_string());
    }
    validate_password(password)
}

fn validate_password(password: &str) -> Result<(), String> {
    let length = password.chars().count();
    if !(10..=256).contains(&length) {
        return Err("管理员密码长度应为 10～256 个字符".to_string());
    }
    Ok(())
}

fn persist_record(path: &Path, record: &AuthRecord) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(record)
        .map_err(|error| format!("无法序列化账号配置：{error}"))?;
    let temporary = path.with_extension("json.tmp");
    #[cfg(unix)]
    let existing_owner = {
        use std::os::unix::fs::MetadataExt;
        fs::metadata(path)
            .ok()
            .map(|metadata| (metadata.uid(), metadata.gid()))
    };
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&temporary)
        .map_err(|error| format!("无法创建账号配置：{error}"))?;
    #[cfg(unix)]
    if unsafe { libc::geteuid() } == 0 {
        if let Some((uid, gid)) = existing_owner {
            use std::os::fd::AsRawFd;
            if unsafe { libc::fchown(file.as_raw_fd(), uid, gid) } != 0 {
                let _ = fs::remove_file(&temporary);
                return Err("无法保留账号配置的系统所有者".to_string());
            }
        }
    }
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("无法写入账号配置：{error}"))?;
    fs::rename(&temporary, path).map_err(|error| format!("无法提交账号配置：{error}"))
}

fn session_token(headers: &HeaderMap) -> Option<String> {
    let cookie = headers.get("cookie")?.to_str().ok()?;
    cookie.split(';').find_map(|part| {
        let (name, value) = part.trim().split_once('=')?;
        (name == "xbm_session" && !value.is_empty()).then(|| value.to_string())
    })
}

pub fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setup_login_and_reset() {
        let root = std::env::temp_dir().join(format!(
            "xbm-auth-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&root).unwrap();
        let auth = AuthService::load(root.join("auth.json"), false).unwrap();
        let first = auth.setup("admin", "first-password").unwrap();
        assert!(!first.is_empty());
        assert!(auth.login("admin", "first-password", "test").is_ok());
        let external = AuthService::load(root.join("auth.json"), false).unwrap();
        external.reset_password("second-password").unwrap();
        let mut headers = HeaderMap::new();
        headers.insert("cookie", format!("xbm_session={first}").parse().unwrap());
        assert!(auth.authenticated_username(&headers).is_none());
        assert!(auth.login("admin", "first-password", "test").is_err());
        assert!(auth.login("admin", "second-password", "test-2").is_ok());
        fs::remove_dir_all(root).unwrap();
    }
}
