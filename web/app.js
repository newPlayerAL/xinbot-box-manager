const byId = (id) => document.getElementById(id);
const THEME_KEY = "xinbot-box-manager.theme";

const state = {
  auth: null,
  setupMode: false,
  instances: [],
  plugins: [],
  settings: null,
  runtime: [],
  selectedId: null,
  draft: null,
  eventSource: null,
  refreshTimer: null,
  pluginConfig: null,
  activeView: "instances",
};

const ui = {
  toast: byId("toast"),
  authView: byId("auth-view"),
  appView: byId("app-view"),
  authForm: byId("auth-form"),
  authDescription: byId("auth-description"),
  authUsername: byId("auth-username"),
  authPassword: byId("auth-password"),
  authConfirm: byId("auth-confirm"),
  authConfirmRow: byId("auth-confirm-row"),
  authSubmit: byId("auth-submit"),
  authError: byId("auth-error"),
  list: byId("instance-list"),
  pluginManager: byId("plugin-manager-view"),
  pluginManagerButton: byId("plugin-manager-button"),
  editor: byId("editor"),
  empty: byId("empty-state"),
  instanceForm: byId("instance-form"),
  instanceError: byId("instance-error"),
  console: byId("console"),
  settingsDialog: byId("settings-dialog"),
  accountDialog: byId("account-dialog"),
  pluginConfigDialog: byId("plugin-config-dialog"),
};

async function api(path, options = {}) {
  const init = { credentials: "same-origin", ...options };
  init.headers = { ...(options.headers || {}) };
  if (options.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }
  if (init.method && init.method !== "GET") init.headers["X-Xinbot-Request"] = "1";
  const response = await fetch(path, init);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/api/auth/")) await showAuthentication();
    throw new Error(payload?.error || payload || `请求失败（${response.status}）`);
  }
  return payload;
}

function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Private browsing or hardened browsers may disable storage.
  }
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    button.textContent = nextTheme === "light" ? "☀ 浅色" : "☾ 深色";
    button.setAttribute("aria-label", `切换到${nextTheme === "light" ? "浅色" : "深色"}主题`);
  });
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(nextTheme);
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {
    // The selected theme still applies to this page even when storage is unavailable.
  }
}

function notify(message, error = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle("error", error);
  ui.toast.classList.add("show");
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => ui.toast.classList.remove("show"), 2800);
}

async function boot() {
  applyTheme(loadTheme());
  bindEvents();
  try {
    const auth = await api("/api/auth/status");
    state.auth = auth;
    if (!auth.authenticated) {
      showAuthentication(auth);
      return;
    }
    await showApplication();
  } catch (error) {
    showAuthentication({ configured: true, authenticated: false });
    ui.authError.textContent = error.message;
  }
}

function showAuthentication(auth = state.auth) {
  state.auth = auth || { configured: true, authenticated: false };
  state.setupMode = !state.auth.configured;
  ui.appView.classList.add("hidden");
  ui.authView.classList.remove("hidden");
  ui.authConfirmRow.classList.toggle("hidden", !state.setupMode);
  ui.authConfirm.required = state.setupMode;
  ui.authDescription.textContent = state.setupMode
    ? "首次使用：请为这台设备设置唯一的管理员账号。"
    : "登录后管理这台设备上的 XinBot 实例。";
  ui.authSubmit.textContent = state.setupMode ? "创建管理员并进入" : "登录";
  ui.authUsername.value = state.auth.username || "";
  ui.authPassword.value = "";
  ui.authConfirm.value = "";
  ui.authError.textContent = "";
  state.eventSource?.close();
  window.clearInterval(state.refreshTimer);
  window.setTimeout(() => (ui.authUsername.value ? ui.authPassword : ui.authUsername).focus(), 0);
}

async function showApplication() {
  ui.authView.classList.add("hidden");
  ui.appView.classList.remove("hidden");
  const results = await Promise.all([
    api("/api/instances"),
    api("/api/settings"),
    api("/api/runtime"),
  ]);
  state.instances = results[0];
  state.settings = results[1];
  state.runtime = results[2];
  try {
    state.plugins = await api("/api/plugins");
  } catch (error) {
    state.plugins = [];
    notify(error.message, true);
  }
  renderSystemSummary();
  renderList();
  if (state.instances.length) selectInstance(state.selectedId || state.instances[0].id);
  else showEmpty();
  connectEvents();
  window.clearInterval(state.refreshTimer);
  state.refreshTimer = window.setInterval(refreshRuntime, 3000);
}

function bindEvents() {
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", toggleTheme);
  });
  ui.authForm.addEventListener("submit", handleAuthentication);
  byId("new-instance-button").addEventListener("click", newInstance);
  byId("empty-new-button").addEventListener("click", newInstance);
  ui.pluginManagerButton.addEventListener("click", showPluginManager);
  byId("plugin-settings-button").addEventListener("click", openSettings);
  byId("plugin-search").addEventListener("input", renderPluginManager);
  byId("plugin-type-filter").addEventListener("change", renderPluginManager);
  ui.instanceForm.addEventListener("submit", saveInstance);
  byId("delete-button").addEventListener("click", deleteInstance);
  byId("start-button").addEventListener("click", () => processAction("start"));
  byId("stop-button").addEventListener("click", () => processAction("stop"));
  byId("restart-button").addEventListener("click", () => processAction("restart"));
  byId("command-form").addEventListener("submit", sendCommand);
  byId("clear-console-button").addEventListener("click", () => (ui.console.textContent = ""));
  byId("settings-button").addEventListener("click", openSettings);
  byId("account-button").addEventListener("click", openAccount);
  byId("logout-button").addEventListener("click", logout);
  byId("settings-form").addEventListener("submit", saveSettings);
  byId("account-form").addEventListener("submit", changeAccount);
  byId("plugin-config-form").addEventListener("submit", savePluginConfig);
  byId("plugin-config-structured-button").addEventListener("click", () => switchPluginConfigMode("structured"));
  byId("plugin-config-raw-button").addEventListener("click", () => switchPluginConfigMode("raw"));
  byId("instance-password").addEventListener("input", renderLoginBehavior);
  byId("instance-online").addEventListener("change", renderLoginBehavior);
  byId("instance-host").addEventListener("input", handleServerTargetChange);
  document.querySelectorAll(".dialog-close").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
}

async function handleAuthentication(event) {
  event.preventDefault();
  ui.authError.textContent = "";
  const username = ui.authUsername.value.trim();
  const password = ui.authPassword.value;
  if (state.setupMode && password !== ui.authConfirm.value) {
    ui.authError.textContent = "两次输入的密码不一致";
    return;
  }
  ui.authSubmit.disabled = true;
  try {
    await api(state.setupMode ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    state.auth = { configured: true, authenticated: true, username };
    await showApplication();
  } catch (error) {
    ui.authError.textContent = error.message;
  } finally {
    ui.authSubmit.disabled = false;
  }
}

function emptyDraft() {
  const genericMeta = genericServerAdapter();
  return {
    id: "",
    name: `XinBot ${state.instances.length + 1}`,
    host: "",
    port: null,
    username: "",
    serverPassword: "",
    onlineMode: false,
    loginTemplate: "/login {password}",
    metaPluginId: genericMeta?.id || "directconnect",
    enabledPluginIds: [],
    xmsMb: 32,
    xmxMb: 256,
  };
}

function newInstance() {
  state.activeView = "instances";
  state.selectedId = null;
  state.draft = emptyDraft();
  renderList();
  renderEditor();
}

function showEmpty() {
  state.activeView = "instances";
  state.selectedId = null;
  state.draft = null;
  ui.pluginManager.classList.add("hidden");
  ui.editor.classList.add("hidden");
  ui.empty.classList.remove("hidden");
  renderList();
}

async function selectInstance(id) {
  const profile = state.instances.find((item) => item.id === id);
  if (!profile) return;
  state.activeView = "instances";
  state.selectedId = id;
  state.draft = structuredClone(profile);
  state.draft._savedMetaPluginId = profile.metaPluginId;
  renderList();
  renderEditor();
  try {
    const logs = await api(`/api/instances/${id}/logs`);
    ui.console.textContent = "";
    logs.forEach(appendLog);
    scrollConsole();
  } catch (error) {
    notify(error.message, true);
  }
}

function renderList() {
  ui.list.textContent = "";
  for (const profile of state.instances) {
    const runtime = runtimeFor(profile.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `instance-card${profile.id === state.selectedId ? " active" : ""}`;
    const dot = document.createElement("span");
    dot.className = `status-dot${runtime ? " running" : ""}`;
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    name.textContent = profile.name;
    const server = document.createElement("small");
    server.textContent = `${profile.username}@${profile.host}${profile.port ? `:${profile.port}` : ""}`;
    copy.append(name, server);
    const memory = document.createElement("span");
    memory.className = "memory";
    memory.textContent = runtime?.rssBytes ? formatBytes(runtime.rssBytes) : "OFF";
    button.append(dot, copy, memory);
    button.addEventListener("click", () => selectInstance(profile.id));
    ui.list.append(button);
  }
  byId("instance-count").textContent = `${state.instances.length} 个实例`;
  byId("running-count").textContent = `${state.runtime.length} 个运行中`;
  const ready = state.plugins.filter((plugin) => plugin.available).length;
  byId("plugin-manager-summary").textContent = `${ready}/${state.plugins.length} 个资源就绪`;
  ui.pluginManagerButton.classList.toggle("active", state.activeView === "plugins");
}

function showPluginManager() {
  state.activeView = "plugins";
  ui.editor.classList.add("hidden");
  ui.empty.classList.add("hidden");
  ui.pluginManager.classList.remove("hidden");
  renderList();
  renderPluginManager();
}

function instanceUsesPlugin(profile, targetId) {
  const pending = [profile.metaPluginId, ...profile.enabledPluginIds];
  const visited = new Set();
  while (pending.length) {
    const id = pending.shift();
    if (!id || visited.has(id)) continue;
    visited.add(id);
    if (id === targetId) return true;
    const selected = state.plugins.find((plugin) => plugin.id === id);
    for (const dependency of selected?.dependencies || []) {
      const key = dependency.toLowerCase();
      const match = state.plugins.find((plugin) => (
        plugin.id.toLowerCase() === key || plugin.name.toLowerCase() === key
      ));
      if (match) pending.push(match.id);
    }
  }
  return false;
}

function pluginUsage(plugin) {
  return state.instances.filter((profile) => instanceUsesPlugin(profile, plugin.id));
}

function renderPluginManager() {
  const search = byId("plugin-search").value.trim().toLocaleLowerCase("zh-CN");
  const type = byId("plugin-type-filter").value;
  const usedPlugins = state.plugins.filter((plugin) => pluginUsage(plugin).length > 0).length;
  byId("plugin-total-count").textContent = state.plugins.length;
  byId("plugin-ready-count").textContent = state.plugins.filter((plugin) => plugin.available).length;
  byId("plugin-missing-count").textContent = state.plugins.filter((plugin) => !plugin.available).length;
  byId("plugin-used-count").textContent = usedPlugins;
  byId("plugin-resource-path").textContent = state.settings?.resourceDir
    ? `资源目录：${state.settings.resourceDir}`
    : "尚未设置插件资源目录";

  const plugins = state.plugins.filter((plugin) => {
    const matchesType = type === "all" || plugin.pluginType === type;
    const haystack = `${plugin.name} ${plugin.id} ${plugin.description || ""}`.toLocaleLowerCase("zh-CN");
    return matchesType && (!search || haystack.includes(search));
  });
  const list = byId("plugin-library-list");
  list.textContent = "";

  if (!plugins.length) {
    const empty = document.createElement("p");
    empty.className = "plugin-library-empty";
    empty.textContent = state.plugins.length ? "没有符合筛选条件的插件。" : "插件目录中没有可显示的条目。";
    list.append(empty);
    return;
  }

  for (const plugin of plugins) {
    const card = document.createElement("article");
    card.className = `plugin-library-card${plugin.available ? "" : " unavailable"}`;

    const badge = document.createElement("span");
    badge.className = `plugin-type-badge ${plugin.pluginType === "META_PLUGIN" ? "meta" : "regular"}`;
    badge.textContent = plugin.pluginType === "META_PLUGIN" ? "META" : "PLUGIN";

    const body = document.createElement("div");
    body.className = "plugin-library-copy";
    const heading = document.createElement("div");
    heading.className = "plugin-card-heading";
    const title = document.createElement("h3");
    title.textContent = plugin.name;
    const version = document.createElement("span");
    version.textContent = plugin.version;
    heading.append(title, version);
    const description = document.createElement("p");
    description.textContent = plugin.description || "没有插件说明";
    body.append(heading, description);

    const facts = document.createElement("div");
    facts.className = "plugin-facts";
    const dependencies = (plugin.dependencies || []).length
      ? `依赖：${plugin.dependencies.join("、")}`
      : "无声明依赖";
    const configFiles = (plugin.configFiles || []).length
      ? `配置：${plugin.configFiles.map((item) => item.label || item.path).join("、")}`
      : "无专用配置";
    for (const fact of [dependencies, configFiles]) {
      const item = document.createElement("span");
      item.textContent = fact;
      facts.append(item);
    }
    body.append(facts);

    const side = document.createElement("div");
    side.className = "plugin-library-status";
    const status = document.createElement("strong");
    status.className = plugin.available ? "health-ok" : "health-bad";
    status.textContent = plugin.available ? "资源已就绪" : "JAR 缺失";
    const usage = pluginUsage(plugin);
    const usageText = document.createElement("small");
    usageText.textContent = usage.length
      ? `${usage.length} 个实例：${usage.map((profile) => profile.name).join("、")}`
      : "尚未被实例使用";
    side.append(status, usageText);
    card.append(badge, body, side);
    list.append(card);
  }
}

function renderEditor() {
  if (!state.draft) return showEmpty();
  state.activeView = "instances";
  ui.pluginManager.classList.add("hidden");
  ui.empty.classList.add("hidden");
  ui.editor.classList.remove("hidden");
  const profile = state.draft;
  byId("editor-title").textContent = profile.name || "新实例";
  byId("editor-subtitle").textContent = profile.id ? `${profile.username || "未设置账号"} · ${profile.host || "未设置服务器"}` : "尚未保存";
  byId("instance-name").value = profile.name;
  byId("instance-host").value = profile.host;
  byId("instance-port").value = profile.port ?? "";
  byId("instance-username").value = profile.username;
  byId("instance-password").value = profile.serverPassword || "";
  byId("instance-online").checked = profile.onlineMode;
  byId("instance-login-template").value = profile.loginTemplate || "";
  byId("instance-xms").value = profile.xmsMb ?? 32;
  byId("instance-xmx").value = profile.xmxMb ?? 256;
  ui.instanceError.textContent = "";
  renderPlugins(profile);
  renderLoginBehavior();
  renderRuntime();
  const exists = Boolean(profile.id);
  byId("delete-button").disabled = !exists;
}

function renderPlugins(profile) {
  const metaContainer = byId("meta-plugins");
  const regularContainer = byId("regular-plugins");
  metaContainer.textContent = "";
  regularContainer.textContent = "";
  const render = (plugin, checked) => {
    const label = document.createElement("label");
    label.className = `plugin-option${plugin.available ? "" : " unavailable"}`;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "ordinary-plugin";
    input.value = plugin.id;
    input.checked = checked;
    input.disabled = !plugin.available;
    input.addEventListener("change", () => {
      profile.enabledPluginIds = [...document.querySelectorAll('input[name="ordinary-plugin"]:checked')]
        .map((item) => item.value);
      renderPluginConfigActions(profile);
    });
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = plugin.name;
    const description = document.createElement("small");
    description.textContent = plugin.description || plugin.version;
    copy.append(title, description);
    if (!plugin.available) {
      const warning = document.createElement("em");
      warning.textContent = "资源文件缺失";
      copy.append(warning);
    }
    if (plugin.recommended) {
      const recommended = document.createElement("em");
      recommended.textContent = "推荐";
      copy.append(recommended);
    }
    label.append(input, copy);
    return label;
  };
  renderServerAdapter(profile);
  state.plugins.filter((plugin) => plugin.pluginType === "PLUGIN").forEach((plugin) => {
    regularContainer.append(render(plugin, profile.enabledPluginIds.includes(plugin.id)));
  });
  renderPluginConfigActions(profile);
  if (!state.plugins.length) {
    metaContainer.textContent = "请先在系统设置中配置有效的插件资源目录。";
  }
}

function normalizeServerHost(host) {
  return host.trim().toLowerCase().replace(/\.+$/, "");
}

function hostMatchesPattern(host, pattern) {
  const normalizedHost = normalizeServerHost(host);
  const normalizedPattern = normalizeServerHost(pattern);
  if (!normalizedHost || !normalizedPattern) return false;
  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(2);
    return normalizedHost.endsWith(`.${suffix}`) && normalizedHost.length > suffix.length + 1;
  }
  return normalizedHost === normalizedPattern;
}

function preferredAdapter(plugins) {
  return plugins.find((plugin) => plugin.recommended && plugin.available)
    || plugins.find((plugin) => plugin.available)
    || plugins.find((plugin) => plugin.recommended)
    || plugins[0]
    || null;
}

function genericServerAdapter() {
  const metas = state.plugins.filter((plugin) => (
    plugin.pluginType === "META_PLUGIN" && !(plugin.hostPatterns || []).length
  ));
  return metas.find((plugin) => plugin.id === "directconnect" && plugin.available)
    || metas.find((plugin) => plugin.available)
    || metas.find((plugin) => plugin.id === "directconnect")
    || metas[0]
    || null;
}

function serverAdapterForHost(host) {
  const normalizedHost = normalizeServerHost(host);
  if (!normalizedHost) return { plugin: null, dedicated: false };
  const dedicated = state.plugins.filter((plugin) => (
    plugin.pluginType === "META_PLUGIN"
      && (plugin.hostPatterns || []).some((pattern) => hostMatchesPattern(normalizedHost, pattern))
  ));
  if (dedicated.length) return { plugin: preferredAdapter(dedicated), dedicated: true };
  return { plugin: genericServerAdapter(), dedicated: false };
}

function syncServerAdapter(profile) {
  const resolution = serverAdapterForHost(profile.host);
  if (resolution.plugin) profile.metaPluginId = resolution.plugin.id;
  profile._adapterAutoChanged = Boolean(
    profile.id
      && profile._savedMetaPluginId
      && resolution.plugin
      && profile._savedMetaPluginId !== resolution.plugin.id,
  );
  return resolution;
}

function renderServerAdapter(profile) {
  const container = byId("meta-plugins");
  const error = byId("server-adapter-error");
  container.textContent = "";
  error.textContent = "";
  const resolution = syncServerAdapter(profile);
  const { plugin, dedicated } = resolution;
  const host = normalizeServerHost(profile.host);

  if (!host) {
    const empty = document.createElement("div");
    empty.className = "adapter-empty";
    empty.textContent = "填写服务器地址后，将在这里显示自动选择的适配方式。";
    container.append(empty);
    return;
  }
  if (!plugin) {
    const empty = document.createElement("div");
    empty.className = "adapter-empty error";
    empty.textContent = "插件目录中没有可用于该服务器的适配器。";
    container.append(empty);
    error.textContent = "请先在插件资源目录中准备通用 Meta 插件。";
    return;
  }

  const card = document.createElement("article");
  card.className = `adapter-card${plugin.available ? "" : " unavailable"}`;
  const badge = document.createElement("span");
  badge.className = `adapter-badge${dedicated ? " dedicated" : ""}`;
  badge.textContent = dedicated ? "专用 META" : "通用连接";
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = plugin.name;
  const description = document.createElement("small");
  description.textContent = dedicated
    ? `已识别 ${host}，登录与服务器流程由专用适配器处理。`
    : "没有匹配到专用 Meta，将使用通用服务器连接。";
  copy.append(title, description);
  const status = document.createElement("span");
  status.className = plugin.available ? "adapter-ready" : "adapter-missing";
  status.textContent = plugin.available ? "已自动选择" : "资源文件缺失";
  card.append(badge, copy, status);
  container.append(card);

  if (profile._adapterAutoChanged) {
    const migration = document.createElement("p");
    migration.className = "adapter-migration";
    migration.textContent = "这是旧实例配置；保存后将切换到该服务器的专用适配器。";
    container.append(migration);
  }
  if (!plugin.available) {
    error.textContent = dedicated
      ? `${host} 需要 ${plugin.name}，但对应资源文件缺失；不会降级到通用连接。`
      : `${plugin.name} 的资源文件缺失，当前无法保存或启动实例。`;
  }
}

function handleServerTargetChange() {
  if (!state.draft) return;
  state.draft.host = byId("instance-host").value;
  renderServerAdapter(state.draft);
  renderLoginBehavior();
  renderRuntime();
}

function selectedMetaPlugin() {
  const id = state.draft?.metaPluginId;
  return state.plugins.find((plugin) => plugin.id === id) || null;
}

function renderLoginBehavior() {
  if (!state.draft) return;
  const meta = selectedMetaPlugin();
  const onlineMode = byId("instance-online").checked;
  const hasSecondaryPassword = Boolean(byId("instance-password").value);
  const usesTemplate = meta?.loginMode === "template";
  const pluginManaged = meta?.loginMode === "plugin";

  byId("login-template-row").classList.toggle(
    "hidden",
    !(usesTemplate && hasSecondaryPassword && !onlineMode),
  );
  byId("managed-login-note").classList.toggle("hidden", !pluginManaged);
  byId("managed-login-title").textContent = pluginManaged
    ? `二次登录由 ${meta.name} 处理`
    : "";

  const resolution = serverAdapterForHost(byId("instance-host").value);
  byId("instance-host").disabled = false;
  byId("instance-port").disabled = false;
  byId("instance-host-note").textContent = resolution.dedicated && meta
    ? `已识别该服务器，将自动使用 ${meta.name}。`
    : "未匹配专用服务器时，将自动使用通用连接。";

  const note = byId("meta-login-note");
  note.textContent = "";
  note.classList.toggle("hidden", !meta);
  if (!meta) return;
  const marker = document.createElement("span");
  marker.className = "note-check";
  marker.textContent = "✓";
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  const detail = document.createElement("small");
  if (pluginManaged) {
    title.textContent = `${meta.name} 管理登录流程`;
    detail.textContent = "Box Manager 只保存身份信息，不会额外发送登录命令。";
  } else if (usesTemplate) {
    title.textContent = `${meta.name} 使用可选登录命令`;
    detail.textContent = "仅在离线模式且填写二级登录密码时，加入服务器后发送命令模板。";
  } else {
    title.textContent = `${meta.name} 不使用管理端登录命令`;
    detail.textContent = "是否需要额外认证由该 Meta 插件自身决定。";
  }
  copy.append(title, detail);
  note.append(marker, copy);
}

function renderPluginConfigActions(profile) {
  const container = byId("plugin-config-actions");
  container.textContent = "";
  if (!profile.id) return;
  const selectedIds = new Set([profile.metaPluginId, ...profile.enabledPluginIds]);
  for (const plugin of state.plugins.filter((item) => selectedIds.has(item.id))) {
    for (const spec of plugin.configFiles || []) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `编辑 ${spec.label || spec.path}`;
      button.disabled = Boolean(runtimeFor(profile.id));
      button.addEventListener("click", () => openPluginConfig(plugin, spec));
      container.append(button);
    }
  }
}

async function openPluginConfig(plugin, spec) {
  if (!state.draft?.id) return;
  byId("plugin-config-error").textContent = "";
  try {
    const document = await api(`/api/instances/${state.draft.id}/plugin-config/${encodeURIComponent(plugin.id)}/${encodeURIComponent(spec.path)}`);
    const bttb = isBttbConfig(plugin, spec);
    state.pluginConfig = { plugin, spec, document, bttb, mode: bttb ? "structured" : "raw", bttbConfig: null };
    byId("plugin-config-title").textContent = spec.label || spec.path;
    byId("plugin-config-description").textContent = `${plugin.name} · ${document.exists ? "正在编辑已有文件" : "文件尚不存在，保存后创建"}`;
    byId("plugin-config-content").value = document.content;
    byId("plugin-config-modes").classList.toggle("hidden", !bttb);
    if (bttb) {
      try {
        state.pluginConfig.bttbConfig = document.exists
          ? parseBttbConfig(document.content)
          : createDefaultBttbConfig();
        byId("plugin-config-content").value = serializeBttbConfig(state.pluginConfig.bttbConfig);
      } catch (error) {
        state.pluginConfig.mode = "raw";
        byId("plugin-config-error").textContent = `现有文件无法结构化解析，已切换到原始 JSON：${error.message}`;
      }
    }
    renderPluginConfigMode();
    ui.pluginConfigDialog.showModal();
  } catch (error) {
    notify(error.message, true);
  }
}

function isBttbConfig(plugin, spec) {
  const pluginName = `${plugin.id} ${plugin.name}`.toLowerCase();
  return pluginName.includes("backtothebase") && spec.path.toLowerCase() === "base_config.json";
}

function createDefaultBttbConfig() {
  return {
    language: "Chinese",
    players: [{ name: "example_name", locations: [{ number: "1", x: 0, y: 60, z: 0 }] }],
    returnEnabled: false,
    returnLocation: { x: 0, y: 60, z: 0 },
    adminEnabled: false,
    adminPlayers: [],
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseBttbInteger(value, field) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new Error(`${field} 必须是整数`);
  }
  return value;
}

function parseBttbBoolean(value, field) {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new Error(`${field} 必须是 true 或 false`);
  return value;
}

function parseBttbCoordinates(value, field, defaults) {
  if (value === undefined) return { ...defaults };
  if (!isRecord(value)) throw new Error(`${field} 必须是坐标对象`);
  return {
    x: parseBttbInteger(value.x, `${field}.x`),
    y: parseBttbInteger(value.y, `${field}.y`),
    z: parseBttbInteger(value.z, `${field}.z`),
  };
}

function parseBttbConfig(content) {
  let source;
  try {
    source = JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON 语法错误：${error.message}`);
  }
  if (!isRecord(source)) throw new Error("根节点必须是 JSON 对象");
  if (!isRecord(source.players)) throw new Error("players 必须是对象");

  const languageText = typeof source.language === "string" ? source.language.toLowerCase() : "chinese";
  const language = languageText === "english" ? "English" : languageText === "chinese" ? "Chinese" : source.language;
  const players = Object.entries(source.players).map(([name, value]) => {
    if (!isRecord(value) || !Array.isArray(value.locations)) {
      throw new Error(`玩家“${name}”的 locations 必须是数组`);
    }
    return {
      name,
      locations: value.locations.map((location, index) => {
        if (!isRecord(location)) throw new Error(`玩家“${name}”的第 ${index + 1} 个位置必须是对象`);
        return {
          number: String(location.number ?? ""),
          x: parseBttbInteger(location.x, `${name} 位置 ${index + 1} 的 X`),
          y: parseBttbInteger(location.y, `${name} 位置 ${index + 1} 的 Y`),
          z: parseBttbInteger(location.z, `${name} 位置 ${index + 1} 的 Z`),
        };
      }),
    };
  });
  if (source.return !== undefined && !isRecord(source.return)) throw new Error("return 必须是对象");
  const returnBlock = isRecord(source.return) ? source.return : {};
  if (source.admin !== undefined && !isRecord(source.admin)) throw new Error("admin 必须是对象");
  const adminBlock = isRecord(source.admin) ? source.admin : {};
  const adminPlayers = adminBlock.players === undefined ? [] : adminBlock.players;
  if (!Array.isArray(adminPlayers) || adminPlayers.some((player) => typeof player !== "string")) {
    throw new Error("admin.players 必须是玩家名称数组");
  }
  const config = {
    language,
    players,
    returnEnabled: parseBttbBoolean(returnBlock.enabled, "return.enabled"),
    returnLocation: parseBttbCoordinates(returnBlock.location, "return.location", { x: 0, y: 60, z: 0 }),
    adminEnabled: parseBttbBoolean(adminBlock.enabled, "admin.enabled"),
    adminPlayers: [...adminPlayers],
  };
  validateBttbConfig(config);
  return config;
}

function validateI32(value, label) {
  if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
    throw new Error(`${label} 必须是 32 位整数`);
  }
}

function validateBttbConfig(config) {
  if (!['Chinese', 'English'].includes(config.language)) throw new Error("语言只能选择中文或英文");
  if (!Array.isArray(config.players) || config.players.length === 0) throw new Error("至少需要一个玩家");
  const playerNames = new Set();
  for (const [playerIndex, player] of config.players.entries()) {
    const label = `玩家 ${playerIndex + 1}`;
    if (typeof player.name !== "string" || !player.name) throw new Error(`${label}的名称不能为空`);
    if (player.name !== player.name.trim()) throw new Error(`${label}的名称首尾不能有空格`);
    const playerKey = player.name.toLowerCase();
    if (playerNames.has(playerKey)) throw new Error(`玩家名称“${player.name}”重复`);
    playerNames.add(playerKey);
    if (!Array.isArray(player.locations) || player.locations.length === 0) {
      throw new Error(`玩家“${player.name}”至少需要一个珍珠按钮位置`);
    }
    const locationNumbers = new Set();
    for (const [locationIndex, location] of player.locations.entries()) {
      const locationLabel = `玩家“${player.name}”的位置 ${locationIndex + 1}`;
      if (!/^[1-9]\d*$/.test(location.number)) throw new Error(`${locationLabel}的编号必须是正整数`);
      const number = Number(location.number);
      if (number > 2147483647) throw new Error(`${locationLabel}的编号过大`);
      if (locationNumbers.has(location.number)) throw new Error(`${locationLabel}的编号重复`);
      locationNumbers.add(location.number);
      validateI32(location.x, `${locationLabel}的 X`);
      validateI32(location.y, `${locationLabel}的 Y`);
      validateI32(location.z, `${locationLabel}的 Z`);
    }
  }
  validateI32(config.returnLocation.x, "返回位置 X");
  validateI32(config.returnLocation.y, "返回位置 Y");
  validateI32(config.returnLocation.z, "返回位置 Z");
  if (!Array.isArray(config.adminPlayers) || config.adminPlayers.length > 3) throw new Error("游戏内管理员最多 3 人");
  const admins = new Set();
  for (const [index, name] of config.adminPlayers.entries()) {
    if (typeof name !== "string" || !name) throw new Error(`管理员 ${index + 1} 的名称不能为空`);
    if (name !== name.trim()) throw new Error(`管理员“${name}”的名称首尾不能有空格`);
    const key = name.toLowerCase();
    if (admins.has(key)) throw new Error(`管理员名称“${name}”重复`);
    admins.add(key);
  }
}

function serializeBttbConfig(config) {
  validateBttbConfig(config);
  const players = {};
  for (const player of config.players) {
    players[player.name] = {
      locations: player.locations.map((location) => ({
        number: location.number,
        x: location.x,
        y: location.y,
        z: location.z,
      })),
    };
  }
  return `${JSON.stringify({
    language: config.language,
    players,
    return: { enabled: config.returnEnabled, location: { ...config.returnLocation } },
    admin: { enabled: config.adminEnabled, players: [...config.adminPlayers] },
  }, null, 2)}\n`;
}

function configElement(tag, className, textContent) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function integerInput(value, label, onInput) {
  const wrapper = configElement("label", "coordinate-field");
  wrapper.append(configElement("span", "", label));
  const input = document.createElement("input");
  input.type = "number";
  input.step = "1";
  input.value = Number.isFinite(value) ? value : "";
  input.addEventListener("input", () => onInput(input.value === "" ? Number.NaN : Number(input.value)));
  wrapper.append(input);
  return wrapper;
}

function renderBttbEditor() {
  const config = state.pluginConfig?.bttbConfig;
  if (!config) return;
  const root = byId("bttb-editor");
  root.textContent = "";

  const general = configElement("section", "bttb-section");
  general.append(configElement("h3", "", "基本设置"));
  const languageLabel = configElement("label", "bttb-language", "界面语言");
  const language = document.createElement("select");
  for (const [value, label] of [["Chinese", "中文"], ["English", "English"]]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = config.language === value;
    language.append(option);
  }
  language.addEventListener("change", () => (config.language = language.value));
  languageLabel.append(language);
  general.append(languageLabel);
  root.append(general);

  const playersSection = configElement("section", "bttb-section");
  const playersHeading = configElement("div", "bttb-section-heading");
  const playersTitle = configElement("div");
  playersTitle.append(configElement("h3", "", "玩家与珍珠按钮"), configElement("p", "muted small-copy", "每个玩家可配置多个编号及对应坐标。"));
  const addPlayer = configElement("button", "ghost compact-button", "＋ 添加玩家");
  addPlayer.type = "button";
  addPlayer.addEventListener("click", () => {
    config.players.push({ name: "", locations: [{ number: "1", x: 0, y: 60, z: 0 }] });
    renderBttbEditor();
  });
  playersHeading.append(playersTitle, addPlayer);
  playersSection.append(playersHeading);

  for (const [playerIndex, player] of config.players.entries()) {
    const card = configElement("article", "bttb-player-card");
    const heading = configElement("div", "bttb-player-heading");
    const nameLabel = configElement("label", "bttb-player-name", "玩家名称");
    const nameInput = document.createElement("input");
    nameInput.value = player.name;
    nameInput.placeholder = "Minecraft 用户名";
    nameInput.addEventListener("input", () => (player.name = nameInput.value));
    nameLabel.append(nameInput);
    const removePlayer = configElement("button", "text-button danger-text", "删除玩家");
    removePlayer.type = "button";
    removePlayer.disabled = config.players.length === 1;
    removePlayer.addEventListener("click", () => {
      config.players.splice(playerIndex, 1);
      renderBttbEditor();
    });
    heading.append(nameLabel, removePlayer);
    card.append(heading);

    const locationHeader = configElement("div", "bttb-location-header");
    for (const label of ["编号", "X", "Y", "Z", ""]) locationHeader.append(configElement("span", "", label));
    card.append(locationHeader);
    for (const [locationIndex, location] of player.locations.entries()) {
      const row = configElement("div", "bttb-location-row");
      const number = document.createElement("input");
      number.type = "number";
      number.min = "1";
      number.step = "1";
      number.value = location.number;
      number.setAttribute("aria-label", "位置编号");
      number.addEventListener("input", () => (location.number = number.value));
      row.append(number);
      for (const axis of ["x", "y", "z"]) {
        const input = document.createElement("input");
        input.type = "number";
        input.step = "1";
        input.value = Number.isFinite(location[axis]) ? location[axis] : "";
        input.setAttribute("aria-label", `${axis.toUpperCase()} 坐标`);
        input.addEventListener("input", () => (location[axis] = input.value === "" ? Number.NaN : Number(input.value)));
        row.append(input);
      }
      const remove = configElement("button", "icon-button compact-icon danger-text", "×");
      remove.type = "button";
      remove.disabled = player.locations.length === 1;
      remove.setAttribute("aria-label", "删除位置");
      remove.addEventListener("click", () => {
        player.locations.splice(locationIndex, 1);
        renderBttbEditor();
      });
      row.append(remove);
      card.append(row);
    }
    const addLocation = configElement("button", "ghost compact-button", "＋ 添加位置");
    addLocation.type = "button";
    addLocation.addEventListener("click", () => {
      const next = player.locations.reduce((max, item) => Math.max(max, Number(item.number) || 0), 0) + 1;
      player.locations.push({ number: String(next), x: 0, y: 60, z: 0 });
      renderBttbEditor();
    });
    card.append(addLocation);
    playersSection.append(card);
  }
  root.append(playersSection);

  const returnSection = configElement("section", "bttb-section");
  const returnToggle = configElement("label", "toggle-row");
  const returnCopy = configElement("span");
  returnCopy.append(configElement("strong", "", "点击后返回指定位置"), configElement("small", "", "触发珍珠按钮后移动到下面的坐标。"));
  const returnCheck = document.createElement("input");
  returnCheck.type = "checkbox";
  returnCheck.checked = config.returnEnabled;
  returnCheck.addEventListener("change", () => {
    config.returnEnabled = returnCheck.checked;
    renderBttbEditor();
  });
  returnToggle.append(returnCopy, returnCheck);
  const returnCoordinates = configElement("div", "coordinate-row");
  for (const axis of ["x", "y", "z"]) {
    const field = integerInput(config.returnLocation[axis], axis.toUpperCase(), (value) => (config.returnLocation[axis] = value));
    field.querySelector("input").disabled = !config.returnEnabled;
    returnCoordinates.append(field);
  }
  returnSection.append(returnToggle, returnCoordinates);
  root.append(returnSection);

  const adminSection = configElement("section", "bttb-section");
  const adminToggle = configElement("label", "toggle-row");
  const adminCopy = configElement("span");
  adminCopy.append(configElement("strong", "", "启用游戏内管理员"), configElement("small", "", "最多配置 3 个 Minecraft 用户名。"));
  const adminCheck = document.createElement("input");
  adminCheck.type = "checkbox";
  adminCheck.checked = config.adminEnabled;
  adminCheck.addEventListener("change", () => {
    config.adminEnabled = adminCheck.checked;
    renderBttbEditor();
  });
  adminToggle.append(adminCopy, adminCheck);
  adminSection.append(adminToggle);
  const adminList = configElement("div", "bttb-admin-list");
  for (const [index, name] of config.adminPlayers.entries()) {
    const row = configElement("div", "bttb-admin-row");
    const input = document.createElement("input");
    input.value = name;
    input.placeholder = `管理员 ${index + 1}`;
    input.disabled = !config.adminEnabled;
    input.addEventListener("input", () => (config.adminPlayers[index] = input.value));
    const remove = configElement("button", "icon-button compact-icon danger-text", "×");
    remove.type = "button";
    remove.disabled = !config.adminEnabled;
    remove.addEventListener("click", () => {
      config.adminPlayers.splice(index, 1);
      renderBttbEditor();
    });
    row.append(input, remove);
    adminList.append(row);
  }
  const addAdmin = configElement("button", "ghost compact-button", "＋ 添加管理员");
  addAdmin.type = "button";
  addAdmin.disabled = !config.adminEnabled || config.adminPlayers.length >= 3;
  addAdmin.addEventListener("click", () => {
    config.adminPlayers.push("");
    renderBttbEditor();
  });
  adminList.append(addAdmin);
  adminSection.append(adminList);
  root.append(adminSection);
}

function renderPluginConfigMode() {
  const config = state.pluginConfig;
  if (!config) return;
  const structured = config.bttb && config.mode === "structured";
  byId("bttb-editor").classList.toggle("hidden", !structured);
  byId("plugin-config-content").classList.toggle("hidden", structured);
  for (const [id, active] of [
    ["plugin-config-structured-button", structured],
    ["plugin-config-raw-button", !structured],
  ]) {
    const button = byId(id);
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  }
  if (structured) renderBttbEditor();
}

function switchPluginConfigMode(mode) {
  const config = state.pluginConfig;
  if (!config?.bttb || config.mode === mode) return;
  byId("plugin-config-error").textContent = "";
  try {
    if (mode === "raw") {
      byId("plugin-config-content").value = serializeBttbConfig(config.bttbConfig);
    } else {
      config.bttbConfig = parseBttbConfig(byId("plugin-config-content").value);
    }
    config.mode = mode;
    renderPluginConfigMode();
  } catch (error) {
    byId("plugin-config-error").textContent = error.message;
  }
}

async function savePluginConfig(event) {
  event.preventDefault();
  if (!state.pluginConfig || !state.draft?.id) return;
  const { plugin, spec } = state.pluginConfig;
  byId("plugin-config-error").textContent = "";
  try {
    const content = state.pluginConfig.bttb && state.pluginConfig.mode === "structured"
      ? serializeBttbConfig(state.pluginConfig.bttbConfig)
      : byId("plugin-config-content").value;
    const document = await api(`/api/instances/${state.draft.id}/plugin-config/${encodeURIComponent(plugin.id)}/${encodeURIComponent(spec.path)}`, {
      method: "PUT",
      body: { content },
    });
    state.pluginConfig.document = document;
    byId("plugin-config-content").value = content;
    byId("plugin-config-description").textContent = `${plugin.name} · 已保存`;
    notify("插件配置已保存");
  } catch (error) {
    byId("plugin-config-error").textContent = error.message;
  }
}

function collectForm() {
  const portText = byId("instance-port").value.trim();
  return {
    id: state.draft?.id || "",
    name: byId("instance-name").value.trim(),
    host: byId("instance-host").value.trim(),
    port: portText ? Number(portText) : null,
    username: byId("instance-username").value.trim(),
    serverPassword: byId("instance-password").value,
    onlineMode: byId("instance-online").checked,
    loginTemplate: byId("instance-login-template").value.trim(),
    metaPluginId: state.draft?.metaPluginId || "directconnect",
    enabledPluginIds: [...document.querySelectorAll('input[name="ordinary-plugin"]:checked')].map((item) => item.value),
    xmsMb: Number(byId("instance-xms").value),
    xmxMb: Number(byId("instance-xmx").value),
  };
}

async function saveInstance(event) {
  event.preventDefault();
  ui.instanceError.textContent = "";
  state.draft.host = byId("instance-host").value.trim();
  const adapter = syncServerAdapter(state.draft).plugin;
  renderServerAdapter(state.draft);
  renderLoginBehavior();
  if (!adapter) {
    ui.instanceError.textContent = "没有可用于该服务器的连接适配器";
    return;
  }
  if (!adapter.available) {
    ui.instanceError.textContent = `所需的服务器适配器 ${adapter.name} 资源缺失`;
    return;
  }
  const profile = collectForm();
  byId("save-button").disabled = true;
  try {
    const saved = await api(profile.id ? `/api/instances/${profile.id}` : "/api/instances", {
      method: profile.id ? "PUT" : "POST",
      body: profile,
    });
    const index = state.instances.findIndex((item) => item.id === saved.id);
    if (index >= 0) state.instances[index] = saved;
    else state.instances.push(saved);
    state.instances.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    state.selectedId = saved.id;
    state.draft = structuredClone(saved);
    renderList();
    renderEditor();
    byId("save-state").textContent = "已保存";
    window.setTimeout(() => (byId("save-state").textContent = ""), 1800);
  } catch (error) {
    ui.instanceError.textContent = error.message;
  } finally {
    byId("save-button").disabled = false;
  }
}

async function deleteInstance() {
  if (!state.draft?.id) return;
  if (!confirm(`确定将“${state.draft.name}”移到回收目录吗？`)) return;
  try {
    await api(`/api/instances/${state.draft.id}`, { method: "DELETE" });
    state.instances = state.instances.filter((item) => item.id !== state.draft.id);
    notify("实例已移到数据目录中的 trash，可手动恢复");
    if (state.instances.length) selectInstance(state.instances[0].id);
    else showEmpty();
  } catch (error) {
    notify(error.message, true);
  }
}

async function processAction(action) {
  if (!state.draft?.id) return;
  const button = byId(`${action}-button`);
  button.disabled = true;
  try {
    await api(`/api/instances/${state.draft.id}/${action}`, { method: "POST" });
    notify(action === "start" ? "启动请求已完成" : action === "stop" ? "已发送停止命令" : "实例已重启");
    window.setTimeout(refreshRuntime, 350);
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function sendCommand(event) {
  event.preventDefault();
  const input = byId("command-input");
  const command = input.value.trim();
  if (!command || !state.draft?.id) return;
  try {
    await api(`/api/instances/${state.draft.id}/command`, { method: "POST", body: { command } });
    input.value = "";
  } catch (error) {
    notify(error.message, true);
  }
}

async function refreshRuntime() {
  if (ui.appView.classList.contains("hidden")) return;
  try {
    state.runtime = await api("/api/runtime");
    renderList();
    if (state.draft) renderRuntime();
  } catch (error) {
    console.warn(error);
  }
}

function renderRuntime() {
  const runtime = runtimeFor(state.draft?.id);
  byId("runtime-dot").classList.toggle("running", Boolean(runtime));
  byId("runtime-state").textContent = runtime ? "运行中" : "已停止";
  byId("runtime-detail").textContent = runtime ? `PID ${runtime.pid}` : "没有活动进程";
  byId("metric-pid").textContent = runtime?.pid ?? "—";
  byId("metric-memory").textContent = runtime?.rssBytes ? formatBytes(runtime.rssBytes) : "—";
  byId("metric-cpu").textContent = runtime?.cpuPercent != null ? `${runtime.cpuPercent.toFixed(1)}%` : "—";
  byId("metric-started").textContent = runtime?.startedAt ? new Date(runtime.startedAt * 1000).toLocaleString() : "—";
  const exists = Boolean(state.draft?.id);
  const adapter = serverAdapterForHost(byId("instance-host").value).plugin;
  const adapterBlocked = Boolean(state.draft?._adapterAutoChanged) || !adapter?.available;
  byId("start-button").disabled = !exists || Boolean(runtime) || adapterBlocked;
  byId("start-button").title = state.draft?._adapterAutoChanged
    ? "请先保存实例，完成服务器适配迁移"
    : !adapter?.available ? "服务器适配器资源缺失" : "";
  byId("stop-button").disabled = !exists || !runtime;
  byId("restart-button").disabled = !exists || !runtime;
  byId("command-input").disabled = !exists || !runtime;
}

function runtimeFor(id) {
  return id ? state.runtime.find((item) => item.instanceId === id) : null;
}

function connectEvents() {
  state.eventSource?.close();
  state.eventSource = new EventSource("/api/events");
  state.eventSource.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "log" && message.instanceId === state.selectedId) appendLog(message);
      if (message.type === "state") {
        if (message.instanceId === state.selectedId) appendLog({ stream: "launcher", line: `[launcher] ${message.message}`, timestamp: message.timestamp });
        refreshRuntime();
      }
    } catch (error) {
      console.warn("invalid event", error);
    }
  };
}

function appendLog(log) {
  const line = document.createElement("div");
  line.className = `console-line ${log.stream || "stdout"}`;
  const time = log.timestamp ? new Date(log.timestamp * 1000).toLocaleTimeString([], { hour12: false }) : "--:--:--";
  line.textContent = `[${time}] ${stripAnsi(log.line || "")}`;
  ui.console.append(line);
  while (ui.console.childElementCount > 1000) ui.console.firstElementChild.remove();
  scrollConsole();
}

function scrollConsole() {
  ui.console.scrollTop = ui.console.scrollHeight;
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

function openSettings() {
  if (!state.settings) return;
  byId("setting-java").value = state.settings.javaPath;
  byId("setting-jar").value = state.settings.xinbotJar;
  byId("setting-resources").value = state.settings.resourceDir;
  byId("settings-error").textContent = "";
  renderSettingsHealth();
  ui.settingsDialog.showModal();
}

function renderSettingsHealth() {
  const health = byId("settings-health");
  health.textContent = "";
  for (const [label, ok] of [["XinBot Core", state.settings.xinbotReady], ["插件目录", state.settings.resourceDirReady]]) {
    const row = document.createElement("div");
    row.className = "health-item";
    const name = document.createElement("span");
    name.textContent = label;
    const result = document.createElement("strong");
    result.className = ok ? "health-ok" : "health-bad";
    result.textContent = ok ? "已就绪" : "需要配置";
    row.append(name, result);
    health.append(row);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  byId("settings-error").textContent = "";
  try {
    state.settings = await api("/api/settings", {
      method: "PUT",
      body: {
        javaPath: byId("setting-java").value.trim(),
        xinbotJar: byId("setting-jar").value.trim(),
        resourceDir: byId("setting-resources").value.trim(),
      },
    });
    try {
      state.plugins = await api("/api/plugins");
    } catch (error) {
      state.plugins = [];
      notify(error.message, true);
    }
    renderSystemSummary();
    renderSettingsHealth();
    if (state.draft) renderPlugins(state.draft);
    if (state.activeView === "plugins") renderPluginManager();
    notify("系统设置已保存");
  } catch (error) {
    byId("settings-error").textContent = error.message;
  }
}

function renderSystemSummary() {
  if (!state.settings) return;
  byId("system-summary").textContent = state.settings.xinbotReady && state.settings.resourceDirReady
    ? "运行环境已就绪"
    : "运行环境需要配置";
}

function openAccount() {
  byId("account-username").value = state.auth?.username || "";
  byId("account-current-password").value = "";
  byId("account-new-password").value = "";
  byId("account-confirm-password").value = "";
  byId("account-error").textContent = "";
  ui.accountDialog.showModal();
}

async function changeAccount(event) {
  event.preventDefault();
  const newPassword = byId("account-new-password").value;
  if (newPassword !== byId("account-confirm-password").value) {
    byId("account-error").textContent = "两次输入的新密码不一致";
    return;
  }
  try {
    const username = byId("account-username").value.trim();
    await api("/api/auth/change-password", {
      method: "POST",
      body: {
        username,
        currentPassword: byId("account-current-password").value,
        newPassword,
      },
    });
    state.auth.username = username;
    ui.accountDialog.close();
    notify("管理员账号已更新");
  } catch (error) {
    byId("account-error").textContent = error.message;
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    showAuthentication({ configured: true, authenticated: false });
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

boot();
