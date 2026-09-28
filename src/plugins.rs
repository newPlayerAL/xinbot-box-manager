use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::models::{GlobalSettings, InstanceProfile};

const PLUGIN: &str = "PLUGIN";
const META_PLUGIN: &str = "META_PLUGIN";
const MAX_PLUGIN_BYTES: u64 = 128 * 1024 * 1024;
const PLUGIN_DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfigFile {
    pub path: String,
    #[serde(default = "default_config_format")]
    pub format: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub label_en: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginDescriptor {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub name_en: String,
    #[serde(default = "default_version")]
    pub version: String,
    pub plugin_type: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub description_en: String,
    #[serde(default)]
    pub resource: String,
    #[serde(default, skip_serializing)]
    pub download_url: String,
    #[serde(default, skip_serializing)]
    pub sha256: String,
    #[serde(default)]
    pub source_url: String,
    #[serde(default)]
    pub login_mode: String,
    #[serde(default)]
    pub host_patterns: Vec<String>,
    #[serde(default)]
    pub recommended: bool,
    #[serde(default)]
    pub dependencies: Vec<String>,
    #[serde(default)]
    pub config_files: Vec<PluginConfigFile>,
    #[serde(default)]
    pub available: bool,
    #[serde(default)]
    pub downloadable: bool,
    #[serde(default)]
    pub verified: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginConfigDocument {
    pub plugin_id: String,
    pub path: String,
    pub format: String,
    pub label: String,
    pub label_en: String,
    pub exists: bool,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PluginInstallResult {
    pub installed: Vec<String>,
}

fn default_version() -> String {
    "未知版本".to_string()
}

fn default_config_format() -> String {
    "text".to_string()
}

pub fn collect_plugins(settings: &GlobalSettings) -> Result<Vec<PluginDescriptor>, String> {
    collect_plugins_inner(settings, false)
}

pub fn collect_plugins_with_status(
    settings: &GlobalSettings,
) -> Result<Vec<PluginDescriptor>, String> {
    collect_plugins_inner(settings, true)
}

fn collect_plugins_inner(
    settings: &GlobalSettings,
    verify_installed: bool,
) -> Result<Vec<PluginDescriptor>, String> {
    let resource_dir = PathBuf::from(&settings.resource_dir);
    let catalog_path = resource_dir.join("catalog.json");
    let text = fs::read_to_string(&catalog_path)
        .map_err(|error| format!("无法读取插件目录 {}：{error}", catalog_path.display()))?;
    let mut plugins: Vec<PluginDescriptor> =
        serde_json::from_str(&text).map_err(|error| format!("插件目录格式无效：{error}"))?;
    for plugin in &mut plugins {
        normalize(plugin)?;
        let resource = resource_dir.join(&plugin.resource);
        plugin.available = resource.is_file();
        plugin.downloadable = !plugin.download_url.is_empty();
        plugin.verified = plugin.available
            && plugin.downloadable
            && (!verify_installed || file_sha256(&resource)? == plugin.sha256);
    }
    plugins.sort_by(|left, right| {
        let left_rank = if left.plugin_type == META_PLUGIN {
            0
        } else {
            1
        };
        let right_rank = if right.plugin_type == META_PLUGIN {
            0
        } else {
            1
        };
        left_rank
            .cmp(&right_rank)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    Ok(plugins)
}

pub fn install_plugin(
    plugin_id: &str,
    settings: &GlobalSettings,
) -> Result<PluginInstallResult, String> {
    let catalog = collect_plugins_with_status(settings)?;
    let mut plan = Vec::new();
    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    plan_plugin_install(
        plugin_id,
        &catalog,
        true,
        &mut visiting,
        &mut visited,
        &mut plan,
    )?;

    let resource_dir = PathBuf::from(&settings.resource_dir);
    fs::create_dir_all(&resource_dir).map_err(|error| format!("无法创建插件资源目录：{error}"))?;
    let mut agent_builder = ureq::AgentBuilder::new()
        .timeout(PLUGIN_DOWNLOAD_TIMEOUT)
        .timeout_connect(Duration::from_secs(15))
        .timeout_read(Duration::from_secs(60))
        .timeout_write(Duration::from_secs(30))
        .redirects(5)
        .user_agent(concat!("xinbot-box-manager/", env!("CARGO_PKG_VERSION")));
    if let Some(proxy) = plugin_download_proxy(settings)? {
        agent_builder = agent_builder.proxy(proxy);
    }
    let agent = agent_builder.build();

    let mut installed = Vec::new();
    for plugin in plan {
        download_plugin(&agent, &resource_dir, &plugin)?;
        installed.push(plugin.id);
    }
    Ok(PluginInstallResult { installed })
}

fn plugin_download_proxy(settings: &GlobalSettings) -> Result<Option<ureq::Proxy>, String> {
    if !settings.plugin_proxy_enabled {
        return Ok(None);
    }
    let scheme = match settings.plugin_proxy_type.as_str() {
        "HTTP" => "http",
        "SOCKS4" => "socks4",
        "SOCKS5" => "socks5",
        _ => return Err("插件下载代理类型无效".to_string()),
    };
    let credentials = if settings.plugin_proxy_username.is_empty() {
        String::new()
    } else {
        format!(
            "{}:{}@",
            settings.plugin_proxy_username, settings.plugin_proxy_password
        )
    };
    let proxy_url = format!("{scheme}://{credentials}{}", settings.plugin_proxy_address);
    ureq::Proxy::new(proxy_url)
        .map(Some)
        .map_err(|_| "插件下载代理配置无效".to_string())
}

fn plan_plugin_install(
    plugin_id: &str,
    catalog: &[PluginDescriptor],
    force: bool,
    visiting: &mut HashSet<String>,
    visited: &mut HashSet<String>,
    plan: &mut Vec<PluginDescriptor>,
) -> Result<(), String> {
    if visited.contains(plugin_id) {
        return Ok(());
    }
    if !visiting.insert(plugin_id.to_string()) {
        return Err(format!("插件依赖形成循环：{plugin_id}"));
    }
    let plugin = catalog
        .iter()
        .find(|plugin| plugin.id == plugin_id)
        .ok_or_else(|| format!("插件目录中不存在：{plugin_id}"))?;
    for dependency_name in &plugin.dependencies {
        let dependency = catalog
            .iter()
            .find(|candidate| {
                candidate.id.eq_ignore_ascii_case(dependency_name)
                    || candidate.name.eq_ignore_ascii_case(dependency_name)
            })
            .ok_or_else(|| format!("插件 {} 缺少依赖 {}", plugin.name, dependency_name))?;
        if !dependency.available || (dependency.downloadable && !dependency.verified) {
            plan_plugin_install(
                &dependency.id,
                catalog,
                dependency.available,
                visiting,
                visited,
                plan,
            )?;
        }
    }
    visiting.remove(plugin_id);
    visited.insert(plugin_id.to_string());
    if force || !plugin.available {
        if !plugin.downloadable {
            return Err(format!("插件 {} 没有可信下载源", plugin.name));
        }
        plan.push(plugin.clone());
    }
    Ok(())
}

fn download_plugin(
    agent: &ureq::Agent,
    resource_dir: &Path,
    plugin: &PluginDescriptor,
) -> Result<(), String> {
    let response = agent
        .get(&plugin.download_url)
        .call()
        .map_err(|error| format!("下载插件 {} 失败：{error}", plugin.name))?;
    if !response.get_url().starts_with("https://") {
        return Err(format!("插件 {} 的下载重定向不是 HTTPS", plugin.name));
    }
    if response
        .header("Content-Length")
        .and_then(|value| value.parse::<u64>().ok())
        .is_some_and(|length| length > MAX_PLUGIN_BYTES)
    {
        return Err(format!("插件 {} 的下载文件超过 128 MB", plugin.name));
    }

    let destination = resource_dir.join(&plugin.resource);
    let temporary = resource_dir.join(format!(
        ".{}.download-{}-{}",
        plugin.resource,
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    let result = (|| {
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| format!("无法创建插件下载暂存文件：{error}"))?;
        let mut reader = response.into_reader().take(MAX_PLUGIN_BYTES + 1);
        let downloaded = io::copy(&mut reader, &mut output)
            .map_err(|error| format!("下载插件 {} 失败：{error}", plugin.name))?;
        if downloaded > MAX_PLUGIN_BYTES {
            return Err(format!("插件 {} 的下载文件超过 128 MB", plugin.name));
        }
        output
            .flush()
            .map_err(|error| format!("无法写入插件下载文件：{error}"))?;
        output
            .sync_all()
            .map_err(|error| format!("无法同步插件下载文件：{error}"))?;
        drop(output);

        let checksum = file_sha256(&temporary)?;
        if checksum != plugin.sha256 {
            return Err(format!(
                "插件 {} 的 SHA-256 校验失败；文件未安装",
                plugin.name
            ));
        }
        let mut archive =
            File::open(&temporary).map_err(|error| format!("无法验证插件下载文件：{error}"))?;
        let mut magic = [0u8; 4];
        archive
            .read_exact(&mut magic)
            .map_err(|error| format!("插件 {} 不是有效的 JAR：{error}", plugin.name))?;
        if magic != *b"PK\x03\x04" {
            return Err(format!("插件 {} 不是有效的 JAR 文件", plugin.name));
        }
        fs::rename(&temporary, &destination)
            .map_err(|error| format!("无法安装插件 {}：{error}", plugin.name))?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let mut file = File::open(path)
        .map_err(|error| format!("无法读取插件文件 {}：{error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("无法校验插件文件 {}：{error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn validate_server_adapter(
    profile: &InstanceProfile,
    settings: &GlobalSettings,
) -> Result<(), String> {
    let catalog = collect_plugins(settings)?;
    validate_server_adapter_with_catalog(profile, &catalog)
}

fn validate_server_adapter_with_catalog(
    profile: &InstanceProfile,
    catalog: &[PluginDescriptor],
) -> Result<(), String> {
    let expected = server_adapter_for_host(&profile.host, catalog)
        .ok_or_else(|| "插件目录中没有可用的服务器适配器".to_string())?;
    if profile.meta_plugin_id != expected.id {
        if expected.host_patterns.is_empty() {
            return Err(format!(
                "服务器 {} 应使用通用适配器 {}",
                profile.host, expected.name
            ));
        }
        return Err(format!(
            "服务器 {} 需要专用适配器 {}，不能使用其他连接方式",
            profile.host, expected.name
        ));
    }
    if !expected.available {
        return Err(format!(
            "服务器适配器 {} 的资源文件缺失，不会降级到其他连接方式",
            expected.name
        ));
    }
    Ok(())
}

fn server_adapter_for_host<'a>(
    host: &str,
    catalog: &'a [PluginDescriptor],
) -> Option<&'a PluginDescriptor> {
    let dedicated: Vec<_> = catalog
        .iter()
        .filter(|plugin| {
            plugin.plugin_type == META_PLUGIN
                && plugin
                    .host_patterns
                    .iter()
                    .any(|pattern| host_matches_pattern(host, pattern))
        })
        .collect();
    if !dedicated.is_empty() {
        return preferred_adapter(&dedicated);
    }

    let generic: Vec<_> = catalog
        .iter()
        .filter(|plugin| plugin.plugin_type == META_PLUGIN && plugin.host_patterns.is_empty())
        .collect();
    generic
        .iter()
        .copied()
        .find(|plugin| plugin.id == "directconnect" && plugin.available)
        .or_else(|| generic.iter().copied().find(|plugin| plugin.available))
        .or_else(|| {
            generic
                .iter()
                .copied()
                .find(|plugin| plugin.id == "directconnect")
        })
        .or_else(|| generic.first().copied())
}

fn preferred_adapter<'a>(candidates: &[&'a PluginDescriptor]) -> Option<&'a PluginDescriptor> {
    candidates
        .iter()
        .copied()
        .find(|plugin| plugin.recommended && plugin.available)
        .or_else(|| candidates.iter().copied().find(|plugin| plugin.available))
        .or_else(|| candidates.iter().copied().find(|plugin| plugin.recommended))
        .or_else(|| candidates.first().copied())
}

fn host_matches_pattern(host: &str, pattern: &str) -> bool {
    let host = host.trim().trim_end_matches('.').to_ascii_lowercase();
    let pattern = pattern.trim().trim_end_matches('.').to_ascii_lowercase();
    if host.is_empty() || pattern.is_empty() {
        return false;
    }
    if let Some(suffix) = pattern.strip_prefix("*.") {
        return host.len() > suffix.len() + 1 && host.ends_with(&format!(".{suffix}"));
    }
    host == pattern
}

pub fn sync_plugins(
    profile: &InstanceProfile,
    settings: &GlobalSettings,
    work_dir: &Path,
) -> Result<Vec<PluginDescriptor>, String> {
    let available = collect_plugins(settings)?;
    validate_server_adapter_with_catalog(profile, &available)?;
    let selected = resolve_selected(profile, &available)?;
    let resource_dir = PathBuf::from(&settings.resource_dir);
    let plugins_dir = work_dir.join("plugins");
    let staging = work_dir.join(".plugin-staging");

    if staging.exists() {
        fs::remove_dir_all(&staging).map_err(|error| format!("无法清理插件暂存目录：{error}"))?;
    }
    fs::create_dir_all(&staging).map_err(|error| format!("无法创建插件暂存目录：{error}"))?;

    for plugin in &selected {
        let source = resource_dir.join(&plugin.resource);
        if !source.is_file() {
            let _ = fs::remove_dir_all(&staging);
            return Err(format!(
                "插件文件不存在：{} ({})",
                plugin.name,
                source.display()
            ));
        }
        fs::copy(&source, staging.join(format!("{}.jar", plugin.id))).map_err(|error| {
            let _ = fs::remove_dir_all(&staging);
            format!("无法准备插件 {}：{error}", plugin.name)
        })?;
    }

    fs::create_dir_all(&plugins_dir).map_err(|error| format!("无法创建插件目录：{error}"))?;
    for entry in fs::read_dir(&plugins_dir).map_err(|error| format!("无法读取插件目录：{error}"))?
    {
        let path = entry
            .map_err(|error| format!("无法读取插件目录项：{error}"))?
            .path();
        if path.is_file()
            && path
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("jar"))
        {
            fs::remove_file(&path).map_err(|error| format!("无法停用旧插件：{error}"))?;
        }
    }
    for entry in fs::read_dir(&staging).map_err(|error| format!("无法读取暂存插件：{error}"))?
    {
        let source = entry
            .map_err(|error| format!("无法读取暂存插件项：{error}"))?
            .path();
        let file_name = source
            .file_name()
            .ok_or_else(|| "插件文件名无效".to_string())?;
        fs::rename(&source, plugins_dir.join(file_name))
            .map_err(|error| format!("无法启用插件：{error}"))?;
    }
    fs::remove_dir_all(&staging).map_err(|error| format!("无法完成插件同步：{error}"))?;
    Ok(selected)
}

pub fn read_plugin_config(
    profile: &InstanceProfile,
    settings: &GlobalSettings,
    work_dir: &Path,
    plugin_id: &str,
    file_name: &str,
) -> Result<PluginConfigDocument, String> {
    let spec = resolve_config_spec(profile, settings, plugin_id, file_name)?;
    let path = work_dir.join(&spec.path);
    let exists = path.is_file();
    let content = if exists {
        let metadata =
            fs::metadata(&path).map_err(|error| format!("无法读取插件配置元数据：{error}"))?;
        if metadata.len() > 1024 * 1024 {
            return Err("插件配置超过 1 MB，无法通过网页编辑".to_string());
        }
        fs::read_to_string(&path).map_err(|error| format!("无法读取插件配置：{error}"))?
    } else if spec.format.eq_ignore_ascii_case("json") {
        "{}\n".to_string()
    } else {
        String::new()
    };
    Ok(PluginConfigDocument {
        plugin_id: plugin_id.to_string(),
        path: spec.path,
        format: spec.format,
        label: spec.label,
        label_en: spec.label_en,
        exists,
        content,
    })
}

pub fn write_plugin_config(
    profile: &InstanceProfile,
    settings: &GlobalSettings,
    work_dir: &Path,
    plugin_id: &str,
    file_name: &str,
    content: &str,
) -> Result<PluginConfigDocument, String> {
    if content.len() > 1024 * 1024 {
        return Err("插件配置超过 1 MB".to_string());
    }
    let spec = resolve_config_spec(profile, settings, plugin_id, file_name)?;
    if spec.format.eq_ignore_ascii_case("json") {
        serde_json::from_str::<serde_json::Value>(content)
            .map_err(|error| format!("JSON 格式无效：{error}"))?;
    }
    fs::create_dir_all(work_dir).map_err(|error| format!("无法创建实例工作目录：{error}"))?;
    let destination = work_dir.join(&spec.path);
    let temporary = work_dir.join(format!(".{}.tmp", spec.path));
    fs::write(&temporary, content).map_err(|error| format!("无法写入插件配置：{error}"))?;
    fs::rename(&temporary, &destination).map_err(|error| format!("无法提交插件配置：{error}"))?;
    Ok(PluginConfigDocument {
        plugin_id: plugin_id.to_string(),
        path: spec.path,
        format: spec.format,
        label: spec.label,
        label_en: spec.label_en,
        exists: true,
        content: content.to_string(),
    })
}

fn resolve_config_spec(
    profile: &InstanceProfile,
    settings: &GlobalSettings,
    plugin_id: &str,
    file_name: &str,
) -> Result<PluginConfigFile, String> {
    if Path::new(file_name)
        .file_name()
        .and_then(|name| name.to_str())
        != Some(file_name)
    {
        return Err("插件配置文件名无效".to_string());
    }
    let available = collect_plugins(settings)?;
    let selected = resolve_selected(profile, &available)?;
    let plugin = selected
        .iter()
        .find(|plugin| plugin.id == plugin_id)
        .ok_or_else(|| "该插件未在实例中启用".to_string())?;
    plugin
        .config_files
        .iter()
        .find(|spec| spec.path == file_name)
        .cloned()
        .ok_or_else(|| "插件目录没有声明这个配置文件".to_string())
}

fn resolve_selected(
    profile: &InstanceProfile,
    available: &[PluginDescriptor],
) -> Result<Vec<PluginDescriptor>, String> {
    let by_id: HashMap<&str, &PluginDescriptor> = available
        .iter()
        .map(|plugin| (plugin.id.as_str(), plugin))
        .collect();
    let meta = by_id
        .get(profile.meta_plugin_id.as_str())
        .copied()
        .ok_or_else(|| format!("找不到所选 Meta 插件：{}", profile.meta_plugin_id))?;
    if meta.plugin_type != META_PLUGIN {
        return Err(format!("{} 不是 Meta 插件", meta.name));
    }

    let mut selected = vec![meta.clone()];
    let mut ids = HashSet::from([meta.id.clone()]);
    let mut names = HashSet::from([meta.name.to_ascii_lowercase()]);
    for id in &profile.enabled_plugin_ids {
        if !ids.insert(id.clone()) {
            continue;
        }
        let plugin = by_id
            .get(id.as_str())
            .copied()
            .ok_or_else(|| format!("找不到已启用插件：{id}"))?;
        if plugin.plugin_type == META_PLUGIN {
            return Err(format!("每个实例只能选择一个 Meta 插件：{}", plugin.name));
        }
        if !names.insert(plugin.name.to_ascii_lowercase()) {
            return Err(format!("不能同时启用两个同名插件：{}", plugin.name));
        }
        selected.push(plugin.clone());
    }

    let mut cursor = 0;
    while cursor < selected.len() {
        let dependent = selected[cursor].clone();
        cursor += 1;
        for dependency_name in &dependent.dependencies {
            let normalized = dependency_name.to_ascii_lowercase();
            if names.contains(&normalized) {
                continue;
            }
            let dependency = available
                .iter()
                .find(|plugin| plugin.name.eq_ignore_ascii_case(dependency_name))
                .ok_or_else(|| format!("插件 {} 缺少依赖 {}", dependent.name, dependency_name))?;
            if dependency.plugin_type == META_PLUGIN {
                return Err(format!(
                    "插件 {} 的依赖 {} 是 Meta 插件，无法自动加载",
                    dependent.name, dependency.name
                ));
            }
            ids.insert(dependency.id.clone());
            names.insert(normalized);
            selected.push(dependency.clone());
        }
    }
    Ok(selected)
}

fn normalize(plugin: &mut PluginDescriptor) -> Result<(), String> {
    plugin.id = plugin.id.trim().to_string();
    plugin.name = plugin.name.trim().to_string();
    plugin.plugin_type = plugin.plugin_type.trim().to_ascii_uppercase();
    plugin.download_url = plugin.download_url.trim().to_string();
    plugin.sha256 = plugin.sha256.trim().to_ascii_lowercase();
    plugin.source_url = plugin.source_url.trim().to_string();
    if plugin.plugin_type != PLUGIN && plugin.plugin_type != META_PLUGIN {
        return Err(format!("插件 {} 的类型无效", plugin.name));
    }
    if plugin.id.is_empty()
        || !plugin
            .id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(format!("插件 {} 的 ID 无效", plugin.name));
    }
    if plugin.resource.is_empty()
        || Path::new(&plugin.resource)
            .file_name()
            .and_then(|name| name.to_str())
            != Some(plugin.resource.as_str())
    {
        return Err(format!("插件 {} 的资源路径无效", plugin.name));
    }
    if plugin.download_url.is_empty() != plugin.sha256.is_empty() {
        return Err(format!(
            "插件 {} 的下载地址和 SHA-256 必须同时提供",
            plugin.name
        ));
    }
    if !plugin.download_url.is_empty() {
        if !plugin.download_url.starts_with("https://") {
            return Err(format!("插件 {} 的下载地址必须使用 HTTPS", plugin.name));
        }
        if plugin.sha256.len() != 64
            || !plugin
                .sha256
                .chars()
                .all(|character| character.is_ascii_hexdigit())
        {
            return Err(format!("插件 {} 的 SHA-256 无效", plugin.name));
        }
    }
    if !plugin.source_url.is_empty() && !plugin.source_url.starts_with("https://") {
        return Err(format!("插件 {} 的源码地址必须使用 HTTPS", plugin.name));
    }
    plugin.downloadable = !plugin.download_url.is_empty();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_catalog() -> Vec<PluginDescriptor> {
        let mut plugins: Vec<PluginDescriptor> =
            serde_json::from_str(include_str!("../resources/catalog.json")).unwrap();
        for plugin in &mut plugins {
            normalize(plugin).unwrap();
            plugin.available = true;
        }
        plugins
    }

    #[test]
    fn trusted_downloads_use_https_and_sha256() {
        let plugins = test_catalog();
        let downloadable: Vec<_> = plugins
            .iter()
            .filter(|plugin| !plugin.download_url.is_empty())
            .collect();
        assert_eq!(downloadable.len(), 4);
        assert!(downloadable
            .iter()
            .all(|plugin| plugin.download_url.starts_with("https://")));
        assert!(downloadable.iter().all(|plugin| plugin.sha256.len() == 64));
    }

    #[test]
    fn missing_dependency_is_planned_before_requested_plugin() {
        let mut plugins = test_catalog();
        plugins
            .iter_mut()
            .find(|plugin| plugin.id == "backtothebase")
            .unwrap()
            .available = false;
        plugins
            .iter_mut()
            .find(|plugin| plugin.id == "movementsync")
            .unwrap()
            .available = false;
        let mut plan = Vec::new();
        plan_plugin_install(
            "backtothebase",
            &plugins,
            true,
            &mut HashSet::new(),
            &mut HashSet::new(),
            &mut plan,
        )
        .unwrap();
        assert_eq!(
            plan.iter()
                .map(|plugin| plugin.id.as_str())
                .collect::<Vec<_>>(),
            vec!["movementsync", "backtothebase"]
        );
    }

    #[test]
    fn bttb_dependency_is_added() {
        let plugins = test_catalog();
        let profile = InstanceProfile {
            id: String::new(),
            name: "bot".into(),
            host: "example.org".into(),
            port: None,
            username: "bot".into(),
            server_password: String::new(),
            online_mode: false,
            auto_start: false,
            login_template: String::new(),
            proxy_enabled: false,
            proxy_type: "SOCKS5".into(),
            proxy_address: String::new(),
            proxy_username: String::new(),
            proxy_password: String::new(),
            meta_plugin_id: "directconnect".into(),
            enabled_plugin_ids: vec!["backtothebase".into()],
            xms_mb: 32,
            xmx_mb: 256,
        };
        let selected = resolve_selected(&profile, &plugins).unwrap();
        assert!(selected.iter().any(|plugin| plugin.id == "movementsync"));
    }

    #[test]
    fn known_hosts_use_their_dedicated_meta() {
        let plugins = test_catalog();
        assert_eq!(
            server_adapter_for_host("2B2T.XIN.", &plugins).unwrap().id,
            "xinmeta"
        );
        assert_eq!(
            server_adapter_for_host("play.2b2t.xin", &plugins)
                .unwrap()
                .id,
            "xinmeta"
        );
        assert_eq!(
            server_adapter_for_host("not2b2t.xin", &plugins).unwrap().id,
            "directconnect"
        );
    }

    #[test]
    fn known_host_rejects_generic_connection() {
        let plugins = test_catalog();
        let profile = InstanceProfile {
            id: String::new(),
            name: "bot".into(),
            host: "2b2t.xin".into(),
            port: None,
            username: "bot".into(),
            server_password: String::new(),
            online_mode: false,
            auto_start: false,
            login_template: String::new(),
            proxy_enabled: false,
            proxy_type: "SOCKS5".into(),
            proxy_address: String::new(),
            proxy_username: String::new(),
            proxy_password: String::new(),
            meta_plugin_id: "directconnect".into(),
            enabled_plugin_ids: Vec::new(),
            xms_mb: 32,
            xmx_mb: 256,
        };
        let error = validate_server_adapter_with_catalog(&profile, &plugins).unwrap_err();
        assert!(error.contains("需要专用适配器"));
    }

    #[test]
    fn known_host_does_not_fall_back_when_meta_is_missing() {
        let mut plugins = test_catalog();
        plugins
            .iter_mut()
            .find(|plugin| plugin.id == "xinmeta")
            .unwrap()
            .available = false;
        let profile = InstanceProfile {
            id: String::new(),
            name: "bot".into(),
            host: "2b2t.xin".into(),
            port: None,
            username: "bot".into(),
            server_password: String::new(),
            online_mode: false,
            auto_start: false,
            login_template: String::new(),
            proxy_enabled: false,
            proxy_type: "SOCKS5".into(),
            proxy_address: String::new(),
            proxy_username: String::new(),
            proxy_password: String::new(),
            meta_plugin_id: "xinmeta".into(),
            enabled_plugin_ids: Vec::new(),
            xms_mb: 32,
            xmx_mb: 256,
        };
        let error = validate_server_adapter_with_catalog(&profile, &plugins).unwrap_err();
        assert!(error.contains("资源文件缺失"));
    }
}
