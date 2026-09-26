use std::{net::Ipv6Addr, path::Path};

use ring::rand::SecureRandom;
use serde::{Deserialize, Serialize};

fn default_meta_plugin() -> String {
    "directconnect".to_string()
}

fn default_login_template() -> String {
    "/login {password}".to_string()
}

fn default_xms_mb() -> u32 {
    32
}

fn default_xmx_mb() -> u32 {
    256
}

fn default_proxy_type() -> String {
    "SOCKS5".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceProfile {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub host: String,
    #[serde(default)]
    pub port: Option<u16>,
    pub username: String,
    #[serde(default)]
    pub server_password: String,
    #[serde(default)]
    pub online_mode: bool,
    #[serde(default = "default_login_template")]
    pub login_template: String,
    #[serde(default)]
    pub proxy_enabled: bool,
    #[serde(default = "default_proxy_type")]
    pub proxy_type: String,
    #[serde(default)]
    pub proxy_address: String,
    #[serde(default)]
    pub proxy_username: String,
    #[serde(default)]
    pub proxy_password: String,
    #[serde(default = "default_meta_plugin")]
    pub meta_plugin_id: String,
    #[serde(default)]
    pub enabled_plugin_ids: Vec<String>,
    #[serde(default = "default_xms_mb")]
    pub xms_mb: u32,
    #[serde(default = "default_xmx_mb")]
    pub xmx_mb: u32,
}

impl InstanceProfile {
    pub fn assign_id(&mut self) -> Result<(), String> {
        if self.id.is_empty() {
            let mut bytes = [0u8; 16];
            ring::rand::SystemRandom::new()
                .fill(&mut bytes)
                .map_err(|_| "无法生成实例 ID".to_string())?;
            const HEX: &[u8; 16] = b"0123456789abcdef";
            self.id = bytes
                .iter()
                .flat_map(|byte| {
                    [
                        HEX[(byte >> 4) as usize] as char,
                        HEX[(byte & 0x0f) as usize] as char,
                    ]
                })
                .collect();
        }
        Ok(())
    }

    pub fn normalize_and_validate(&mut self) -> Result<(), String> {
        self.name = self.name.trim().to_string();
        self.host = self.host.trim().to_string();
        self.username = self.username.trim().to_string();
        self.login_template = self.login_template.trim().to_string();
        self.proxy_type = self.proxy_type.trim().to_ascii_uppercase();
        self.proxy_address = self.proxy_address.trim().to_string();
        self.proxy_username = self.proxy_username.trim().to_string();
        self.meta_plugin_id = self.meta_plugin_id.trim().to_string();
        self.enabled_plugin_ids.sort();
        self.enabled_plugin_ids.dedup();

        if !self.id.is_empty()
            && (self.id.len() != 32
                || !self
                    .id
                    .chars()
                    .all(|character| character.is_ascii_digit() || matches!(character, 'a'..='f')))
        {
            return Err("实例 ID 无效".to_string());
        }
        if self.name.is_empty() || self.name.chars().count() > 80 {
            return Err("实例名称不能为空且不能超过 80 个字符".to_string());
        }
        if self.host.is_empty() || self.host.chars().any(char::is_whitespace) {
            return Err("服务器地址不能为空或包含空格".to_string());
        }
        if self.username.is_empty() || self.username.chars().count() > 64 {
            return Err("机器人用户名不能为空且不能超过 64 个字符".to_string());
        }
        if self.meta_plugin_id.is_empty() {
            return Err("必须选择一个 Meta 插件".to_string());
        }
        if self.xms_mb < 16 || self.xmx_mb < 64 {
            return Err("JVM 初始堆至少为 16 MB，最大堆至少为 64 MB".to_string());
        }
        if self.xms_mb > self.xmx_mb {
            return Err("JVM 初始堆不能大于最大堆".to_string());
        }
        if self.xmx_mb > 1024 {
            return Err("单实例最大堆上限不能超过 1024 MB".to_string());
        }
        if self.server_password.chars().count() > 512 {
            return Err("二级登录密码过长".to_string());
        }
        if self.proxy_username.chars().count() > 256 {
            return Err("代理用户名不能超过 256 个字符".to_string());
        }
        if self.proxy_address.chars().count() > 512 {
            return Err("代理地址不能超过 512 个字符".to_string());
        }
        if self.proxy_password.chars().count() > 512 {
            return Err("代理密码不能超过 512 个字符".to_string());
        }
        if self.proxy_enabled {
            if !matches!(self.proxy_type.as_str(), "HTTP" | "SOCKS4" | "SOCKS5") {
                return Err("代理类型只能是 HTTP、SOCKS4 或 SOCKS5".to_string());
            }
            if !valid_proxy_address(&self.proxy_address) {
                return Err("代理地址应使用“主机:端口”格式，例如 127.0.0.1:1080".to_string());
            }
        }
        Ok(())
    }
}

fn valid_proxy_address(address: &str) -> bool {
    if let Some(rest) = address.strip_prefix('[') {
        let Some((host, port)) = rest.split_once("]:") else {
            return false;
        };
        return host.parse::<Ipv6Addr>().is_ok() && valid_port(port);
    }
    let Some((host, port)) = address.rsplit_once(':') else {
        return false;
    };
    !host.is_empty()
        && !host.chars().any(|character| {
            character.is_whitespace() || character.is_control() || ":/[]".contains(character)
        })
        && valid_port(port)
}

fn valid_port(port: &str) -> bool {
    !port.is_empty()
        && port.chars().all(|character| character.is_ascii_digit())
        && port.parse::<u16>().is_ok_and(|port| port > 0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalSettings {
    pub java_path: String,
    pub xinbot_jar: String,
    pub resource_dir: String,
}

impl GlobalSettings {
    pub fn with_resource_dir(resource_dir: String) -> Self {
        let bundled_core = Path::new(&resource_dir).join("xinbot.jar");
        Self {
            java_path: "java".to_string(),
            xinbot_jar: if bundled_core.is_file() {
                bundled_core.to_string_lossy().into_owned()
            } else {
                String::new()
            },
            resource_dir,
        }
    }

    pub fn normalize_and_validate(&mut self) -> Result<(), String> {
        self.java_path = self.java_path.trim().to_string();
        self.xinbot_jar = self.xinbot_jar.trim().to_string();
        self.resource_dir = self.resource_dir.trim().to_string();
        if self.java_path.is_empty() {
            return Err("Java 命令或路径不能为空".to_string());
        }
        if self.java_path.contains('\0')
            || self.xinbot_jar.contains('\0')
            || self.resource_dir.contains('\0')
        {
            return Err("路径中包含无效字符".to_string());
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    #[serde(flatten)]
    pub settings: GlobalSettings,
    pub xinbot_ready: bool,
    pub resource_dir_ready: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub instance_id: String,
    pub running: bool,
    pub pid: Option<u32>,
    pub started_at: Option<u64>,
    pub rss_bytes: Option<u64>,
    pub cpu_percent: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::{valid_proxy_address, InstanceProfile};

    #[test]
    fn validates_proxy_host_and_port() {
        assert!(valid_proxy_address("127.0.0.1:1080"));
        assert!(valid_proxy_address("proxy.example.org:8080"));
        assert!(valid_proxy_address("[::1]:1080"));
        assert!(!valid_proxy_address("proxy.example.org"));
        assert!(!valid_proxy_address("proxy.example.org:0"));
        assert!(!valid_proxy_address("proxy.example.org:+80"));
        assert!(!valid_proxy_address("::1:1080"));
    }

    #[test]
    fn legacy_profile_defaults_to_proxy_disabled() {
        let mut profile: InstanceProfile = serde_json::from_value(serde_json::json!({
            "name": "Legacy",
            "host": "example.org",
            "username": "Bot"
        }))
        .unwrap();
        profile.normalize_and_validate().unwrap();
        assert!(!profile.proxy_enabled);
        assert_eq!(profile.proxy_type, "SOCKS5");
        assert!(profile.proxy_address.is_empty());
    }
}
