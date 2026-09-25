use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::models::{GlobalSettings, InstanceProfile};

#[derive(Clone)]
pub struct Store {
    root: Arc<PathBuf>,
    default_resource_dir: Arc<PathBuf>,
    lock: Arc<Mutex<()>>,
}

impl Store {
    pub fn new(root: PathBuf, default_resource_dir: PathBuf) -> Result<Self, String> {
        fs::create_dir_all(&root)
            .map_err(|error| format!("无法创建数据目录 {}：{error}", root.display()))?;
        let root = fs::canonicalize(&root)
            .map_err(|error| format!("无法解析数据目录 {}：{error}", root.display()))?;
        for directory in ["profiles", "instances", "trash"] {
            fs::create_dir_all(root.join(directory))
                .map_err(|error| format!("无法创建数据子目录：{error}"))?;
        }
        set_private_dir(&root)?;
        Ok(Self {
            root: Arc::new(root),
            default_resource_dir: Arc::new(default_resource_dir),
            lock: Arc::new(Mutex::new(())),
        })
    }

    pub fn auth_path(&self) -> PathBuf {
        self.root.join("auth.json")
    }

    pub fn work_dir(&self, id: &str) -> Result<PathBuf, String> {
        validate_id(id)?;
        Ok(self.root.join("instances").join(id))
    }

    pub fn load_settings(&self) -> Result<GlobalSettings, String> {
        let path = self.root.join("settings.json");
        if !path.is_file() {
            return Ok(GlobalSettings::with_resource_dir(
                self.default_resource_dir.to_string_lossy().into_owned(),
            ));
        }
        let text =
            fs::read_to_string(&path).map_err(|error| format!("无法读取全局设置：{error}"))?;
        serde_json::from_str(&text).map_err(|error| format!("全局设置格式无效：{error}"))
    }

    pub fn save_settings(&self, settings: &GlobalSettings) -> Result<(), String> {
        let _guard = self.lock.lock().map_err(|_| "存储锁已损坏".to_string())?;
        atomic_json(&self.root.join("settings.json"), settings)
    }

    pub fn list_instances(&self) -> Result<Vec<InstanceProfile>, String> {
        let _guard = self.lock.lock().map_err(|_| "存储锁已损坏".to_string())?;
        let mut profiles = Vec::new();
        let entries = fs::read_dir(self.root.join("profiles"))
            .map_err(|error| format!("无法读取实例列表：{error}"))?;
        for entry in entries {
            let path = entry
                .map_err(|error| format!("无法读取实例目录项：{error}"))?
                .path();
            if path.extension().and_then(|value| value.to_str()) != Some("json") {
                continue;
            }
            let text = fs::read_to_string(&path)
                .map_err(|error| format!("无法读取实例配置 {}：{error}", path.display()))?;
            let profile: InstanceProfile = serde_json::from_str(&text)
                .map_err(|error| format!("实例配置 {} 格式无效：{error}", path.display()))?;
            profiles.push(profile);
        }
        profiles.sort_by(|left, right| {
            left.name
                .to_lowercase()
                .cmp(&right.name.to_lowercase())
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(profiles)
    }

    pub fn get_instance(&self, id: &str) -> Result<InstanceProfile, String> {
        validate_id(id)?;
        let path = self.profile_path(id);
        let text = fs::read_to_string(&path).map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                "实例不存在".to_string()
            } else {
                format!("无法读取实例：{error}")
            }
        })?;
        serde_json::from_str(&text).map_err(|error| format!("实例配置格式无效：{error}"))
    }

    pub fn create_instance(&self, mut profile: InstanceProfile) -> Result<InstanceProfile, String> {
        profile.assign_id()?;
        profile.normalize_and_validate()?;
        let _guard = self.lock.lock().map_err(|_| "存储锁已损坏".to_string())?;
        let path = self.profile_path(&profile.id);
        if path.exists() {
            return Err("实例 ID 已存在".to_string());
        }
        fs::create_dir_all(self.root.join("instances").join(&profile.id))
            .map_err(|error| format!("无法创建实例工作目录：{error}"))?;
        atomic_json(&path, &profile)?;
        Ok(profile)
    }

    pub fn update_instance(
        &self,
        id: &str,
        mut profile: InstanceProfile,
    ) -> Result<InstanceProfile, String> {
        validate_id(id)?;
        profile.id = id.to_string();
        profile.normalize_and_validate()?;
        let _guard = self.lock.lock().map_err(|_| "存储锁已损坏".to_string())?;
        let path = self.profile_path(id);
        if !path.is_file() {
            return Err("实例不存在".to_string());
        }
        atomic_json(&path, &profile)?;
        Ok(profile)
    }

    pub fn move_instance_to_trash(&self, id: &str) -> Result<(), String> {
        validate_id(id)?;
        let _guard = self.lock.lock().map_err(|_| "存储锁已损坏".to_string())?;
        let profile_path = self.profile_path(id);
        if !profile_path.is_file() {
            return Err("实例不存在".to_string());
        }
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let destination = self.root.join("trash").join(format!("{id}-{timestamp}"));
        fs::create_dir_all(&destination).map_err(|error| format!("无法创建回收目录：{error}"))?;
        fs::rename(&profile_path, destination.join("profile.json"))
            .map_err(|error| format!("无法移动实例配置到回收目录：{error}"))?;
        let work_dir = self.root.join("instances").join(id);
        if work_dir.exists() {
            fs::rename(&work_dir, destination.join("work"))
                .map_err(|error| format!("无法移动实例数据到回收目录：{error}"))?;
        }
        Ok(())
    }

    fn profile_path(&self, id: &str) -> PathBuf {
        self.root.join("profiles").join(format!("{id}.json"))
    }
}

pub fn validate_id(id: &str) -> Result<(), String> {
    if id.len() == 32
        && id
            .chars()
            .all(|character| character.is_ascii_digit() || matches!(character, 'a'..='f'))
    {
        Ok(())
    } else {
        Err("实例 ID 无效".to_string())
    }
}

fn atomic_json(path: &Path, value: &impl serde::Serialize) -> Result<(), String> {
    let bytes =
        serde_json::to_vec_pretty(value).map_err(|error| format!("无法序列化配置：{error}"))?;
    let temporary = path.with_extension("json.tmp");
    let mut options = fs::OpenOptions::new();
    options.create(true).truncate(true).write(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&temporary)
        .map_err(|error| format!("无法创建临时配置文件：{error}"))?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|error| format!("无法写入配置：{error}"))?;
    fs::rename(&temporary, path).map_err(|error| format!("无法提交配置：{error}"))
}

#[cfg(unix)]
fn set_private_dir(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))
        .map_err(|error| format!("无法设置数据目录权限：{error}"))
}

#[cfg(not(unix))]
fn set_private_dir(_path: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_suffix() -> String {
        format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        )
    }

    fn profile() -> InstanceProfile {
        InstanceProfile {
            id: String::new(),
            name: "测试实例".to_string(),
            host: "example.org".to_string(),
            port: Some(25565),
            username: "Bot".to_string(),
            server_password: String::new(),
            online_mode: false,
            login_template: "/login {password}".to_string(),
            meta_plugin_id: "directconnect".to_string(),
            enabled_plugin_ids: vec![],
            xms_mb: 32,
            xmx_mb: 256,
        }
    }

    #[test]
    fn instance_round_trip_and_recoverable_delete() {
        let root = std::env::temp_dir().join(format!("xbm-store-{}", unique_suffix()));
        let store = Store::new(root.clone(), PathBuf::from("resources")).unwrap();
        let created = store.create_instance(profile()).unwrap();
        assert_eq!(store.get_instance(&created.id).unwrap().name, "测试实例");
        assert_eq!(store.list_instances().unwrap().len(), 1);
        store.move_instance_to_trash(&created.id).unwrap();
        assert!(store.list_instances().unwrap().is_empty());
        assert_eq!(fs::read_dir(root.join("trash")).unwrap().count(), 1);
        fs::remove_dir_all(root).unwrap();
    }
}
