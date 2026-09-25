use std::{
    collections::{HashMap, HashSet},
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

use crate::models::{GlobalSettings, InstanceProfile};

const PLUGIN: &str = "PLUGIN";
const META_PLUGIN: &str = "META_PLUGIN";

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

fn default_version() -> String {
    "未知版本".to_string()
}

fn default_config_format() -> String {
    "text".to_string()
}

pub fn collect_plugins(settings: &GlobalSettings) -> Result<Vec<PluginDescriptor>, String> {
    let resource_dir = PathBuf::from(&settings.resource_dir);
    let catalog_path = resource_dir.join("catalog.json");
    let text = fs::read_to_string(&catalog_path)
        .map_err(|error| format!("无法读取插件目录 {}：{error}", catalog_path.display()))?;
    let mut plugins: Vec<PluginDescriptor> =
        serde_json::from_str(&text).map_err(|error| format!("插件目录格式无效：{error}"))?;
    for plugin in &mut plugins {
        normalize(plugin)?;
        plugin.available = resource_dir.join(&plugin.resource).is_file();
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
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_catalog() -> Vec<PluginDescriptor> {
        let mut plugins: Vec<PluginDescriptor> =
            serde_json::from_str(include_str!("../resources/catalog.json")).unwrap();
        for plugin in &mut plugins {
            plugin.available = true;
        }
        plugins
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
            login_template: String::new(),
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
            login_template: String::new(),
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
            login_template: String::new(),
            meta_plugin_id: "xinmeta".into(),
            enabled_plugin_ids: Vec::new(),
            xms_mb: 32,
            xmx_mb: 256,
        };
        let error = validate_server_adapter_with_catalog(&profile, &plugins).unwrap_err();
        assert!(error.contains("资源文件缺失"));
    }
}
