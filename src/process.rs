use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs,
    io::{BufRead, BufReader, Read, Write},
    path::Path,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use serde::Serialize;
use serde_json::{json, Value};
use tokio::sync::broadcast;

use crate::{
    models::{GlobalSettings, InstanceProfile, RuntimeStatus},
    plugins,
    store::Store,
};

const LOG_LIMIT: usize = 1_000;

struct RunningProcess {
    child: Arc<Mutex<Child>>,
    stdin: Arc<Mutex<ChildStdin>>,
    pid: u32,
    started_at: u64,
}

#[derive(Debug, Clone)]
struct CpuSample {
    process_ticks: u64,
    total_ticks: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ServerEvent {
    Log {
        #[serde(rename = "instanceId")]
        instance_id: String,
        stream: String,
        line: String,
        timestamp: u64,
    },
    State {
        #[serde(rename = "instanceId")]
        instance_id: String,
        running: bool,
        #[serde(rename = "exitCode")]
        exit_code: Option<i32>,
        message: String,
        timestamp: u64,
    },
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogLine {
    pub stream: String,
    pub line: String,
    pub timestamp: u64,
}

struct ProcessInner {
    store: Store,
    processes: Mutex<HashMap<String, RunningProcess>>,
    starting: Mutex<HashSet<String>>,
    logs: Mutex<HashMap<String, VecDeque<LogLine>>>,
    cpu_samples: Mutex<HashMap<String, CpuSample>>,
    events: broadcast::Sender<ServerEvent>,
}

#[derive(Clone)]
pub struct ProcessManager {
    inner: Arc<ProcessInner>,
}

impl ProcessManager {
    pub fn new(store: Store) -> Self {
        let (events, _) = broadcast::channel(512);
        Self {
            inner: Arc::new(ProcessInner {
                store,
                processes: Mutex::new(HashMap::new()),
                starting: Mutex::new(HashSet::new()),
                logs: Mutex::new(HashMap::new()),
                cpu_samples: Mutex::new(HashMap::new()),
                events,
            }),
        }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<ServerEvent> {
        self.inner.events.subscribe()
    }

    pub fn recent_logs(&self, id: &str) -> Vec<LogLine> {
        self.inner
            .logs
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .get(id)
            .map(|lines| lines.iter().cloned().collect())
            .unwrap_or_default()
    }

    pub fn is_running(&self, id: &str) -> bool {
        self.inner
            .processes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .contains_key(id)
    }

    pub fn start(&self, profile: InstanceProfile, settings: GlobalSettings) -> Result<(), String> {
        {
            let mut starting = self
                .inner
                .starting
                .lock()
                .map_err(|_| "启动状态锁已损坏".to_string())?;
            if starting.contains(&profile.id) || self.is_running(&profile.id) {
                return Err("该实例正在启动或已经运行".to_string());
            }
            starting.insert(profile.id.clone());
        }

        let id = profile.id.clone();
        let result = self.start_inner(profile, settings);
        self.inner
            .starting
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&id);
        result
    }

    fn start_inner(
        &self,
        profile: InstanceProfile,
        settings: GlobalSettings,
    ) -> Result<(), String> {
        let configured_jar = Path::new(&settings.xinbot_jar);
        let jar = fs::canonicalize(configured_jar)
            .map_err(|error| format!("XinBot Core 不存在或无法访问：{error}"))?;
        if !jar.is_file() {
            return Err(format!("XinBot Core 不是文件：{}", jar.display()));
        }
        let work_dir = self.inner.store.work_dir(&profile.id)?;
        fs::create_dir_all(&work_dir).map_err(|error| format!("无法创建实例工作目录：{error}"))?;
        let selected = plugins::sync_plugins(&profile, &settings, &work_dir)?;
        let config_path = work_dir.join("config.conf");
        write_xinbot_config(&config_path, &profile)?;

        let mut command = Command::new(&settings.java_path);
        command
            .current_dir(&work_dir)
            .arg(format!("-Xms{}m", profile.xms_mb))
            .arg(format!("-Xmx{}m", profile.xmx_mb))
            .arg("-Dorg.jline.terminal.dumb=true")
            .arg("-Dfile.encoding=UTF-8");
        if profile.meta_plugin_id == "directconnect" {
            command.arg(format!("-Dxinbot.server.host={}", profile.host));
            if let Some(port) = profile.port {
                command.arg(format!("-Dxinbot.server.port={port}"));
            }
            if !profile.online_mode
                && !profile.server_password.is_empty()
                && !profile.login_template.is_empty()
            {
                command.arg(format!(
                    "-Dxinbot.login.template={}",
                    profile.login_template
                ));
            }
        }
        command
            .arg("-cp")
            .arg(&jar)
            .arg("xin.bbtt.mcbot.Xinbot")
            .arg(&config_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("无法启动 XinBot：{error}"))?;
        let pid = child.id();
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "无法连接 XinBot 标准输入".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "无法连接 XinBot 标准输出".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "无法连接 XinBot 错误输出".to_string())?;
        let child = Arc::new(Mutex::new(child));

        self.inner
            .processes
            .lock()
            .map_err(|_| "进程状态锁已损坏".to_string())?
            .insert(
                profile.id.clone(),
                RunningProcess {
                    child: Arc::clone(&child),
                    stdin: Arc::new(Mutex::new(stdin)),
                    pid,
                    started_at: now(),
                },
            );

        self.push_log(
            &profile.id,
            "launcher",
            format!(
                "[launcher] 已同步插件：{}",
                selected
                    .iter()
                    .map(|plugin| plugin.name.as_str())
                    .collect::<Vec<_>>()
                    .join("、")
            ),
        );
        self.push_log(
            &profile.id,
            "launcher",
            format!(
                "[launcher] XinBot 已启动，PID {pid}，堆限制 {}～{} MB",
                profile.xms_mb, profile.xmx_mb
            ),
        );
        self.emit_state(&profile.id, true, None, "XinBot 已启动".to_string());
        pump_output(self.clone(), profile.id.clone(), stdout, "stdout");
        pump_output(self.clone(), profile.id.clone(), stderr, "stderr");
        watch_exit(self.clone(), profile.id, child);
        Ok(())
    }

    pub fn send_command(&self, id: &str, command: &str) -> Result<(), String> {
        let line = command.trim();
        if line.is_empty() {
            return Ok(());
        }
        let processes = self
            .inner
            .processes
            .lock()
            .map_err(|_| "进程状态锁已损坏".to_string())?;
        let running = processes
            .get(id)
            .ok_or_else(|| "实例尚未运行".to_string())?;
        let mut stdin = running
            .stdin
            .lock()
            .map_err(|_| "标准输入锁已损坏".to_string())?;
        writeln!(stdin, "{line}").map_err(|error| format!("无法发送命令：{error}"))?;
        stdin
            .flush()
            .map_err(|error| format!("无法发送命令：{error}"))?;
        drop(stdin);
        self.push_log(id, "command", format!("> {line}"));
        Ok(())
    }

    pub fn stop(&self, id: &str) -> Result<(), String> {
        if !self.is_running(id) {
            return Ok(());
        }
        self.send_command(id, "stop")
    }

    pub fn restart(
        &self,
        profile: InstanceProfile,
        settings: GlobalSettings,
    ) -> Result<(), String> {
        self.stop_and_wait(&profile.id, Duration::from_secs(10))?;
        self.start(profile, settings)
    }

    pub fn stop_and_wait(&self, id: &str, timeout: Duration) -> Result<(), String> {
        if !self.is_running(id) {
            return Ok(());
        }
        self.stop(id)?;
        let deadline = Instant::now() + timeout;
        while Instant::now() < deadline {
            if !self.is_running(id) {
                return Ok(());
            }
            thread::sleep(Duration::from_millis(100));
        }
        let processes = self
            .inner
            .processes
            .lock()
            .map_err(|_| "进程状态锁已损坏".to_string())?;
        if let Some(running) = processes.get(id) {
            running
                .child
                .lock()
                .map_err(|_| "子进程锁已损坏".to_string())?
                .kill()
                .map_err(|error| format!("实例未正常停止，强制结束失败：{error}"))?;
        }
        drop(processes);
        let kill_deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < kill_deadline && self.is_running(id) {
            thread::sleep(Duration::from_millis(50));
        }
        Ok(())
    }

    pub fn statuses(&self) -> Vec<RuntimeStatus> {
        let snapshots: Vec<(String, u32, u64)> = self
            .inner
            .processes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .iter()
            .map(|(id, running)| (id.clone(), running.pid, running.started_at))
            .collect();
        snapshots
            .into_iter()
            .map(|(instance_id, pid, started_at)| {
                let (rss_bytes, process_ticks, total_ticks, cpu_count) = linux_stats(pid);
                let cpu_percent = match (process_ticks, total_ticks) {
                    (Some(process_ticks), Some(total_ticks)) => {
                        let mut samples = self
                            .inner
                            .cpu_samples
                            .lock()
                            .unwrap_or_else(|poisoned| poisoned.into_inner());
                        let previous = samples.insert(
                            instance_id.clone(),
                            CpuSample {
                                process_ticks,
                                total_ticks,
                            },
                        );
                        previous.and_then(|previous| {
                            let process_delta =
                                process_ticks.checked_sub(previous.process_ticks)?;
                            let total_delta = total_ticks.checked_sub(previous.total_ticks)?;
                            (total_delta > 0).then(|| {
                                process_delta as f64 / total_delta as f64
                                    * cpu_count.max(1) as f64
                                    * 100.0
                            })
                        })
                    }
                    _ => None,
                };
                RuntimeStatus {
                    instance_id,
                    running: true,
                    pid: Some(pid),
                    started_at: Some(started_at),
                    rss_bytes,
                    cpu_percent,
                }
            })
            .collect()
    }

    pub fn shutdown_all(&self) {
        let ids: Vec<String> = self
            .inner
            .processes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .keys()
            .cloned()
            .collect();
        for id in ids {
            let _ = self.stop_and_wait(&id, Duration::from_secs(5));
        }
    }

    fn push_log(&self, id: &str, stream: &str, line: String) {
        let log = LogLine {
            stream: stream.to_string(),
            line: line.clone(),
            timestamp: now(),
        };
        let mut logs = self
            .inner
            .logs
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let buffer = logs.entry(id.to_string()).or_default();
        if buffer.len() >= LOG_LIMIT {
            buffer.pop_front();
        }
        buffer.push_back(log.clone());
        drop(logs);
        let _ = self.inner.events.send(ServerEvent::Log {
            instance_id: id.to_string(),
            stream: log.stream,
            line: log.line,
            timestamp: log.timestamp,
        });
    }

    fn emit_state(&self, id: &str, running: bool, exit_code: Option<i32>, message: String) {
        let _ = self.inner.events.send(ServerEvent::State {
            instance_id: id.to_string(),
            running,
            exit_code,
            message,
            timestamp: now(),
        });
    }
}

fn write_xinbot_config(path: &Path, profile: &InstanceProfile) -> Result<(), String> {
    let full_session = fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|root| root.get("account")?.get("fullSession").cloned())
        .unwrap_or(Value::Null);
    let config = json!({
        "account": {
            "fullSession": full_session,
            "name": profile.username,
            "onlineMode": profile.online_mode,
            "password": profile.server_password,
        },
        "checkForUpdates": false,
        "enableTranslation": false,
        "owner": profile.username,
        "plugin": { "directory": "plugins" },
        "proxy": {
            "enable": false,
            "info": { "address": "", "type": "", "password": "", "username": "" }
        },
        "reconnectDelay": 3000,
        "reconnectTimeout": 5000,
        "telemetry": {
            "enable": false,
            "ip": "127.0.0.1",
            "key": "",
            "mode": "udp",
            "port": 9000,
            "sendBot": true,
            "sendPlayers": true,
            "sendServer": true,
            "sendState": true,
            "sendSystem": true,
            "sendUptime": true
        }
    });
    let text = serde_json::to_string_pretty(&config)
        .map_err(|error| format!("无法生成 XinBot 配置：{error}"))?;
    fs::write(path, text).map_err(|error| format!("无法保存 XinBot 配置：{error}"))
}

fn pump_output<R>(manager: ProcessManager, id: String, reader: R, stream: &'static str)
where
    R: Read + Send + 'static,
{
    thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut buffer = Vec::new();
        loop {
            buffer.clear();
            match reader.read_until(b'\n', &mut buffer) {
                Ok(0) => break,
                Ok(_) => {
                    while buffer
                        .last()
                        .is_some_and(|byte| matches!(*byte, b'\n' | b'\r'))
                    {
                        buffer.pop();
                    }
                    let line = String::from_utf8_lossy(&buffer).into_owned();
                    manager.push_log(&id, stream, line);
                }
                Err(error) => {
                    manager.push_log(&id, "stderr", format!("[launcher] 读取输出失败：{error}"));
                    break;
                }
            }
        }
    });
}

fn watch_exit(manager: ProcessManager, id: String, child: Arc<Mutex<Child>>) {
    thread::spawn(move || {
        let exit_code = loop {
            let result = child
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .try_wait();
            match result {
                Ok(Some(status)) => break status.code(),
                Ok(None) => thread::sleep(Duration::from_millis(250)),
                Err(error) => {
                    manager.push_log(
                        &id,
                        "stderr",
                        format!("[launcher] 无法读取进程状态：{error}"),
                    );
                    break None;
                }
            }
        };
        let mut processes = manager
            .inner
            .processes
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        let should_remove = processes
            .get(&id)
            .is_some_and(|running| Arc::ptr_eq(&running.child, &child));
        if should_remove {
            processes.remove(&id);
        }
        drop(processes);
        manager
            .inner
            .cpu_samples
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(&id);
        let message = exit_code
            .map(|code| format!("XinBot 已退出（代码 {code}）"))
            .unwrap_or_else(|| "XinBot 已退出".to_string());
        manager.push_log(&id, "launcher", format!("[launcher] {message}"));
        manager.emit_state(&id, false, exit_code, message);
    });
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[cfg(target_os = "linux")]
fn linux_stats(pid: u32) -> (Option<u64>, Option<u64>, Option<u64>, usize) {
    let status = fs::read_to_string(format!("/proc/{pid}/status")).ok();
    let rss_bytes = status.as_deref().and_then(|text| {
        text.lines().find_map(|line| {
            let value = line.strip_prefix("VmRSS:")?.split_whitespace().next()?;
            value.parse::<u64>().ok().map(|kb| kb * 1024)
        })
    });
    let process_ticks = fs::read_to_string(format!("/proc/{pid}/stat"))
        .ok()
        .and_then(|text| {
            let end = text.rfind(") ")?;
            let fields: Vec<&str> = text[end + 2..].split_whitespace().collect();
            let user = fields.get(11)?.parse::<u64>().ok()?;
            let system = fields.get(12)?.parse::<u64>().ok()?;
            Some(user + system)
        });
    let cpu_text = fs::read_to_string("/proc/stat").ok();
    let total_ticks = cpu_text.as_deref().and_then(|text| {
        let line = text.lines().find(|line| line.starts_with("cpu "))?;
        Some(
            line.split_whitespace()
                .skip(1)
                .filter_map(|value| value.parse::<u64>().ok())
                .sum(),
        )
    });
    let cpu_count = cpu_text
        .as_deref()
        .map(|text| {
            text.lines()
                .filter(|line| {
                    line.strip_prefix("cpu")
                        .and_then(|rest| rest.chars().next())
                        .is_some_and(|character| character.is_ascii_digit())
                })
                .count()
        })
        .unwrap_or(1);
    (rss_bytes, process_ticks, total_ticks, cpu_count)
}

#[cfg(not(target_os = "linux"))]
fn linux_stats(_pid: u32) -> (Option<u64>, Option<u64>, Option<u64>, usize) {
    (None, None, None, 1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_disables_optional_background_features() {
        let unique = format!(
            "{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let root = std::env::temp_dir().join(format!("xbm-config-{unique}"));
        fs::create_dir_all(&root).unwrap();
        let profile = InstanceProfile {
            id: "0123456789abcdef0123456789abcdef".to_string(),
            name: "bot".into(),
            host: "example.org".into(),
            port: None,
            username: "bot".into(),
            server_password: "secret".into(),
            online_mode: false,
            login_template: "/login {password}".into(),
            meta_plugin_id: "directconnect".into(),
            enabled_plugin_ids: vec![],
            xms_mb: 32,
            xmx_mb: 256,
        };
        let path = root.join("config.conf");
        write_xinbot_config(&path, &profile).unwrap();
        let value: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(value["enableTranslation"], false);
        assert_eq!(value["telemetry"]["enable"], false);
        fs::remove_dir_all(root).unwrap();
    }
}
