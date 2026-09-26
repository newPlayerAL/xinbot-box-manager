const byId = (id) => document.getElementById(id);
const THEME_KEY = "xinbot-box-manager.theme";
const LANGUAGE_KEY = "xinbot-box-manager.language";

const EN_TEXT = {
  "浅色": "Light",
  "深色": "Dark",
  "切换到浅色主题": "Switch to the light theme",
  "切换到深色主题": "Switch to the dark theme",
  "登录后管理这台设备上的 XinBot 实例。": "Sign in to manage the XinBot instances on this device.",
  "首次使用：请为这台设备设置唯一的管理员账号。": "First-time setup: create the administrator account for this device.",
  "管理员账号": "Administrator username",
  "管理员密码": "Administrator password",
  "确认密码": "Confirm password",
  "登录": "Sign in",
  "创建管理员并进入": "Create administrator and continue",
  "账号数据仅保存在此设备上。": "Account data is stored only on this device.",
  "正在读取状态…": "Loading status…",
  "系统设置": "System settings",
  "账号": "Account",
  "退出": "Sign out",
  "机器人实例": "Bot instances",
  "新建实例": "New instance",
  "插件管理": "Plugin manager",
  "正在读取插件库…": "Loading plugin library…",
  "目录条目": "Catalog entries",
  "资源已就绪": "Resource ready",
  "资源缺失": "Resource missing",
  "已被实例使用": "Used by instances",
  "查看设备上的插件资源、依赖关系以及各实例的使用情况。": "View plugin resources, dependencies, and instance usage on this device.",
  "插件目录设置": "Plugin directory settings",
  "本机插件库": "Local plugin library",
  "搜索名称或说明": "Search names or descriptions",
  "插件类型": "Plugin type",
  "全部类型": "All types",
  "Meta 插件": "Meta plugin",
  "普通插件": "Regular plugin",
  "当前版本从插件资源目录读取目录清单和 JAR。导入、下载与升级仍通过 Linux 文件系统完成。": "This version reads the catalog and JAR files from the plugin resource directory. Importing, downloading, and upgrading are still performed through the Linux file system.",
  "创建第一个实例": "Create your first instance",
  "添加服务器地址、机器人账号和所需插件，然后从浏览器启动 XinBot。": "Add a server address, bot account, and required plugins, then start XinBot from your browser.",
  "连接与运行": "Connection and runtime",
  "实例名称": "Instance name",
  "例如：基地返回机器人": "For example: Base return bot",
  "服务器地址": "Server address",
  "输入地址后自动选择对应的服务器适配。": "Enter an address to select the matching server adapter automatically.",
  "端口（可选）": "Port (optional)",
  "服务器适配": "Server adapter",
  "根据服务器自动选择": "Selected automatically for the server",
  "已知服务器使用专用 Meta 处理登录和队列；其他服务器自动使用通用连接。": "Known servers use a dedicated Meta plugin for login and queue handling; other servers use the generic connection automatically.",
  "登录身份": "Login identity",
  "这个服务器使用的机器人账号": "Bot account used on this server",
  "机器人用户名": "Bot username",
  "二级登录密码（可选）": "Secondary login password (optional)",
  "仅供服务器内 /login 等二次登录使用": "Used only for in-server secondary login commands such as /login",
  "不是网页管理员密码，也不是 Microsoft 账号密码。": "This is neither the web administrator password nor the Microsoft account password.",
  "登录命令模板": "Login command template",
  "DirectConnect 加入服务器后发送；{password} 会替换为上面的二级登录密码。": "Sent by DirectConnect after joining the server; {password} is replaced with the secondary login password above.",
  "DirectConnect 加入服务器后发送；": "Sent by DirectConnect after joining the server;",
  "会替换为上面的二级登录密码。": "is replaced with the secondary login password above.",
  "Box Manager 不会再发送重复的登录命令。": "Box Manager will not send a duplicate login command.",
  "Microsoft 正版模式": "Microsoft online mode",
  "由 XinBot Core 使用保存的在线会话；启用时不发送二级登录命令": "XinBot Core uses the saved online session; secondary login commands are not sent when enabled",
  "服务器连接代理": "Server connection proxy",
  "当前实例单独设置": "Configured separately for this instance",
  "启用代理": "Enable proxy",
  "支持 HTTP、SOCKS4 和 SOCKS5": "Supports HTTP, SOCKS4, and SOCKS5",
  "代理类型": "Proxy type",
  "代理地址": "Proxy address",
  "代理用户名（可选）": "Proxy username (optional)",
  "代理密码（可选）": "Proxy password (optional)",
  "仅代理 XinBot Core 到 Minecraft 服务器的连接；Java 下载、网页与 Microsoft 登录不使用此设置。代理凭据保存在本机实例配置中，且不加密。": "Only the connection from XinBot Core to the Minecraft server uses this proxy. Java downloads, web access, and Microsoft authentication do not. Proxy credentials are stored unencrypted in the local instance configuration.",
  "运行参数": "Runtime options",
  "单实例 JVM 内存限制": "Per-instance JVM memory limits",
  "JVM 初始堆（MB）": "Initial JVM heap (MB)",
  "JVM 最大堆（MB）": "Maximum JVM heap (MB)",
  "依赖会自动加入": "Dependencies are added automatically",
  "移到回收目录": "Move to trash",
  "保存实例": "Save instance",
  "运行控制": "Runtime controls",
  "启动": "Start",
  "重启": "Restart",
  "停止": "Stop",
  "内存": "Memory",
  "启动时间": "Started",
  "控制台": "Console",
  "清空显示": "Clear display",
  "输入 XinBot 控制台命令": "Enter a XinBot console command",
  "发送": "Send",
  "运行环境": "Runtime environment",
  "路径保存在本机。管理端不会从网页自动下载 Java 或 XinBot Core。": "Paths are stored locally. The manager does not download Java or XinBot Core from the web interface.",
  "Java 命令或绝对路径": "Java command or absolute path",
  "java 或 /usr/bin/java": "java or /usr/bin/java",
  "插件资源目录": "Plugin resource directory",
  "保存设置": "Save settings",
  "修改管理员账号": "Change administrator account",
  "当前密码": "Current password",
  "新密码": "New password",
  "确认新密码": "Confirm new password",
  "修改成功后，其他已有登录会话将立即失效。": "After a successful change, all other existing sessions are invalidated immediately.",
  "更新账号": "Update account",
  "插件配置": "Plugin configuration",
  "配置编辑模式": "Configuration editing mode",
  "结构化编辑": "Structured editor",
  "原始 JSON": "Raw JSON",
  "保存配置": "Save configuration",
  "请求失败（{status}）": "Request failed ({status})",
  "两次输入的密码不一致": "The passwords do not match",
  "资源目录：{path}": "Resource directory: {path}",
  "尚未设置插件资源目录": "The plugin resource directory has not been configured",
  "没有符合筛选条件的插件。": "No plugins match the current filters.",
  "插件目录中没有可显示的条目。": "The plugin catalog contains no displayable entries.",
  "没有插件说明": "No plugin description",
  "依赖：{items}": "Dependencies: {items}",
  "无声明依赖": "No declared dependencies",
  "配置：{items}": "Configuration: {items}",
  "无专用配置": "No dedicated configuration",
  "JAR 缺失": "JAR missing",
  "尚未被实例使用": "Not used by any instance",
  "新实例": "New instance",
  "未设置账号": "Account not set",
  "未设置服务器": "Server not set",
  "尚未保存": "Not saved",
  "资源文件缺失": "Resource file missing",
  "推荐": "Recommended",
  "请先在系统设置中配置有效的插件资源目录。": "Configure a valid plugin resource directory in System settings first.",
  "填写服务器地址后，将在这里显示自动选择的适配方式。": "Enter a server address to see the automatically selected adapter.",
  "插件目录中没有可用于该服务器的适配器。": "The plugin catalog has no adapter available for this server.",
  "请先在插件资源目录中准备通用 Meta 插件。": "Add a generic Meta plugin to the plugin resource directory first.",
  "专用 META": "DEDICATED META",
  "通用连接": "GENERIC CONNECTION",
  "已识别 {host}，登录与服务器流程由专用适配器处理。": "Recognized {host}; login and server flows are handled by the dedicated adapter.",
  "没有匹配到专用 Meta，将使用通用服务器连接。": "No dedicated Meta plugin matched; the generic server connection will be used.",
  "已自动选择": "Selected automatically",
  "这是旧实例配置；保存后将切换到该服务器的专用适配器。": "This instance uses an older configuration. Saving it will switch to the server's dedicated adapter.",
  "{host} 需要 {plugin}，但对应资源文件缺失；不会降级到通用连接。": "{host} requires {plugin}, but its resource file is missing; the generic connection will not be used as a fallback.",
  "{plugin} 的资源文件缺失，当前无法保存或启动实例。": "The resource file for {plugin} is missing, so the instance cannot currently be saved or started.",
  "二次登录由 {plugin} 处理": "Secondary login is handled by {plugin}",
  "已识别该服务器，将自动使用 {plugin}。": "This server was recognized; {plugin} will be used automatically.",
  "未匹配专用服务器时，将自动使用通用连接。": "The generic connection is selected automatically when no dedicated server matches.",
  "{plugin} 管理登录流程": "{plugin} manages the login flow",
  "Box Manager 只保存身份信息，不会额外发送登录命令。": "Box Manager stores the identity information and does not send an additional login command.",
  "{plugin} 使用可选登录命令": "{plugin} uses an optional login command",
  "仅在离线模式且填写二级登录密码时，加入服务器后发送命令模板。": "The command template is sent after joining only in offline mode when a secondary login password is provided.",
  "{plugin} 不使用管理端登录命令": "{plugin} does not use a manager-provided login command",
  "是否需要额外认证由该 Meta 插件自身决定。": "The Meta plugin determines whether additional authentication is required.",
  "编辑 {label}": "Edit {label}",
  "正在编辑已有文件": "Editing an existing file",
  "文件尚不存在，保存后创建": "The file does not exist yet and will be created when saved",
  "现有文件无法结构化解析，已切换到原始 JSON：{error}": "The existing file could not be parsed by the structured editor. Switched to raw JSON: {error}",
  "{field} 必须是整数": "{field} must be an integer",
  "{field} 必须是 true 或 false": "{field} must be true or false",
  "{field} 必须是坐标对象": "{field} must be a coordinate object",
  "JSON 语法错误：{error}": "JSON syntax error: {error}",
  "根节点必须是 JSON 对象": "The root value must be a JSON object",
  "players 必须是对象": "players must be an object",
  "玩家“{name}”的 locations 必须是数组": "The locations value for player “{name}” must be an array",
  "玩家“{name}”的第 {index} 个位置必须是对象": "Location {index} for player “{name}” must be an object",
  "{name} 位置 {index} 的 {axis}": "{axis} at location {index} for {name}",
  "return 必须是对象": "return must be an object",
  "admin 必须是对象": "admin must be an object",
  "admin.players 必须是玩家名称数组": "admin.players must be an array of player names",
  "{label} 必须是 32 位整数": "{label} must be a 32-bit integer",
  "语言只能选择中文或英文": "The language must be Chinese or English",
  "至少需要一个玩家": "At least one player is required",
  "玩家 {index}": "Player {index}",
  "{label}的名称不能为空": "The name for {label} cannot be empty",
  "{label}的名称首尾不能有空格": "The name for {label} cannot start or end with spaces",
  "玩家名称“{name}”重复": "The player name “{name}” is duplicated",
  "玩家“{name}”至少需要一个珍珠按钮位置": "Player “{name}” requires at least one pearl-button location",
  "玩家“{name}”的位置 {index}": "Location {index} for player “{name}”",
  "{label}的 {axis}": "{axis} for {label}",
  "{label}的编号必须是正整数": "The number for {label} must be a positive integer",
  "{label}的编号过大": "The number for {label} is too large",
  "{label}的编号重复": "The number for {label} is duplicated",
  "返回位置 X": "Return location X",
  "返回位置 Y": "Return location Y",
  "返回位置 Z": "Return location Z",
  "游戏内管理员最多 3 人": "At most three in-game administrators are allowed",
  "管理员 {index}": "Administrator {index}",
  "管理员“{name}”的名称首尾不能有空格": "Administrator “{name}” cannot start or end with spaces",
  "管理员名称“{name}”重复": "The administrator name “{name}” is duplicated",
  "基本设置": "Basic settings",
  "界面语言": "Interface language",
  "中文": "Chinese",
  "玩家与珍珠按钮": "Players and pearl buttons",
  "每个玩家可配置多个编号及对应坐标。": "Each player can have multiple numbered coordinate entries.",
  "＋ 添加玩家": "+ Add player",
  "玩家名称": "Player name",
  "Minecraft 用户名": "Minecraft username",
  "删除玩家": "Remove player",
  "编号": "Number",
  "位置编号": "Location number",
  "{axis} 坐标": "{axis} coordinate",
  "删除位置": "Remove location",
  "＋ 添加位置": "+ Add location",
  "点击后返回指定位置": "Return to a specified location after activation",
  "触发珍珠按钮后移动到下面的坐标。": "Move to the coordinates below after triggering a pearl button.",
  "启用游戏内管理员": "Enable in-game administrators",
  "最多配置 3 个 Minecraft 用户名。": "Configure up to three Minecraft usernames.",
  "＋ 添加管理员": "+ Add administrator",
  "已保存": "Saved",
  "插件配置已保存": "Plugin configuration saved",
  "没有可用于该服务器的连接适配器": "No connection adapter is available for this server",
  "所需的服务器适配器 {plugin} 资源缺失": "The required server adapter resource for {plugin} is missing",
  "确定将“{name}”移到回收目录吗？": "Move “{name}” to the trash?",
  "实例已移到数据目录中的 trash，可手动恢复": "The instance was moved to the trash directory and can be restored manually",
  "启动请求已完成": "The start request completed",
  "已发送停止命令": "The stop command was sent",
  "实例已重启": "The instance restarted",
  "运行中": "Running",
  "已停止": "Stopped",
  "没有活动进程": "No active process",
  "请先保存实例，完成服务器适配迁移": "Save the instance first to complete the server-adapter migration",
  "服务器适配器资源缺失": "The server adapter resource is missing",
  "插件目录": "Plugin directory",
  "已就绪": "Ready",
  "需要配置": "Configuration required",
  "系统设置已保存": "System settings saved",
  "运行环境已就绪": "Runtime environment ready",
  "运行环境需要配置": "Runtime environment requires configuration",
  "两次输入的新密码不一致": "The new passwords do not match",
  "管理员账号已更新": "Administrator account updated",
  "2b2t.xin 官方 Meta": "Official Meta for 2b2t.xin",
  "DirectConnect 通用连接": "DirectConnect generic connection",
  "为 2b2t.xin 提供登录、答题、队列和自动进入游戏": "Provides login, verification, queue handling, and automatic game entry for 2b2t.xin",
  "连接任意 Minecraft 服务器，支持自定义二次登录命令": "Connects to any Minecraft server and supports custom secondary login commands",
  "聊天消息过滤插件": "Chat message filtering plugin",
  "为移动、寻路和方块交互提供基础能力": "Provides movement, pathfinding, and block-interaction capabilities",
  "按玩家和编号触发基地珍珠按钮": "Triggers base pearl buttons by player and number",
  "BackToTheBase 配置": "BackToTheBase configuration",
  "请先登录": "Please sign in",
  "账号或密码错误": "Incorrect username or password",
  "当前密码错误": "The current password is incorrect",
  "登录失败次数过多，请一分钟后重试": "Too many failed sign-in attempts. Try again in one minute.",
  "管理员账号长度应为 3～64 个字符": "The administrator username must be 3–64 characters long",
  "管理员账号包含无效字符": "The administrator username contains invalid characters",
  "管理员密码长度应为 10～256 个字符": "The administrator password must be 10–256 characters long",
  "请先停止实例再修改配置": "Stop the instance before changing its configuration",
  "请先停止实例再删除": "Stop the instance before deleting it",
  "请先停止实例再修改插件配置": "Stop the instance before changing plugin configuration",
  "请求缺少安全标记": "The request is missing its security marker",
  "接口或页面不存在": "The API endpoint or page does not exist",
  "管理员账号已经设置": "The administrator account has already been configured",
  "管理员账号尚未设置": "The administrator account has not been configured",
  "管理员账号尚未设置，无法重置密码": "The administrator account has not been configured, so its password cannot be reset",
  "Java 命令或路径不能为空": "The Java command or path cannot be empty",
  "路径中包含无效字符": "The path contains invalid characters",
  "实例 ID 无效": "The instance ID is invalid",
  "实例名称不能为空且不能超过 80 个字符": "The instance name cannot be empty or longer than 80 characters",
  "服务器地址不能为空或包含空格": "The server address cannot be empty or contain spaces",
  "机器人用户名不能为空且不能超过 64 个字符": "The bot username cannot be empty or longer than 64 characters",
  "必须选择一个 Meta 插件": "A Meta plugin must be selected",
  "JVM 初始堆至少为 16 MB，最大堆至少为 64 MB": "The initial JVM heap must be at least 16 MB and the maximum heap at least 64 MB",
  "JVM 初始堆不能大于最大堆": "The initial JVM heap cannot exceed the maximum heap",
  "单实例最大堆上限不能超过 1024 MB": "The per-instance maximum heap cannot exceed 1024 MB",
  "二级登录密码过长": "The secondary login password is too long",
  "代理用户名不能超过 256 个字符": "The proxy username cannot exceed 256 characters",
  "代理地址不能超过 512 个字符": "The proxy address cannot exceed 512 characters",
  "代理密码不能超过 512 个字符": "The proxy password cannot exceed 512 characters",
  "代理类型只能是 HTTP、SOCKS4 或 SOCKS5": "The proxy type must be HTTP, SOCKS4, or SOCKS5",
  "代理地址应使用“主机:端口”格式，例如 127.0.0.1:1080": "Use host:port format for the proxy address, for example 127.0.0.1:1080",
  "该实例正在启动或已经运行": "This instance is starting or already running",
  "实例尚未运行": "The instance is not running",
  "实例不存在": "The instance does not exist",
  "实例 ID 已存在": "The instance ID already exists",
  "插件目录中没有可用的服务器适配器": "The plugin catalog contains no usable server adapter",
  "插件配置超过 1 MB，无法通过网页编辑": "The plugin configuration exceeds 1 MB and cannot be edited in the web interface",
  "插件配置超过 1 MB": "The plugin configuration exceeds 1 MB",
  "插件配置文件名无效": "The plugin configuration filename is invalid",
  "该插件未在实例中启用": "This plugin is not enabled for the instance",
  "插件目录没有声明这个配置文件": "The plugin catalog does not declare this configuration file",
};

const EN_TO_ZH = new Map(Object.entries(EN_TEXT).map(([zh, en]) => [en, zh]));
let currentLanguage = "zh-CN";

function t(source, values = {}) {
  const template = currentLanguage === "en" ? (EN_TEXT[source] || source) : source;
  return template.replace(/\{([a-zA-Z]+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match
  ));
}

function translationSource(value) {
  if (Object.prototype.hasOwnProperty.call(EN_TEXT, value)) return value;
  return EN_TO_ZH.get(value) || null;
}

function translateStaticDocument() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (["SCRIPT", "STYLE", "TEXTAREA"].includes(node.parentElement?.tagName)) continue;
    const value = node.nodeValue;
    const trimmed = value.trim();
    const source = translationSource(trimmed);
    if (!source) continue;
    node.nodeValue = value.replace(trimmed, t(source));
  }
  for (const element of document.querySelectorAll("[placeholder], [aria-label], [title]")) {
    for (const attribute of ["placeholder", "aria-label", "title"]) {
      if (!element.hasAttribute(attribute)) continue;
      const value = element.getAttribute(attribute);
      const source = translationSource(value);
      if (source) element.setAttribute(attribute, t(source));
    }
  }
}

function loadLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === "zh-CN" || saved === "en") return saved;
  } catch {
    // Private browsing or hardened browsers may disable storage.
  }
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function applyLanguage(language) {
  currentLanguage = language === "en" ? "en" : "zh-CN";
  document.documentElement.lang = currentLanguage;
  translateStaticDocument();
  document.querySelectorAll("[data-language-toggle]").forEach((button) => {
    button.textContent = currentLanguage === "en" ? "中文" : "English";
    button.setAttribute(
      "aria-label",
      currentLanguage === "en" ? "切换到中文" : "Switch to English",
    );
  });
}

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
  init.headers = { "Accept-Language": currentLanguage, ...(options.headers || {}) };
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
    const message = payload?.error || payload;
    throw new Error(message ? t(message) : t("请求失败（{status}）", { status: response.status }));
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
    button.textContent = nextTheme === "light" ? `☀ ${t("浅色")}` : `☾ ${t("深色")}`;
    button.setAttribute("aria-label", t(nextTheme === "light" ? "切换到浅色主题" : "切换到深色主题"));
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

function toggleLanguage() {
  applyLanguage(currentLanguage === "en" ? "zh-CN" : "en");
  try {
    localStorage.setItem(LANGUAGE_KEY, currentLanguage);
  } catch {
    // The selected language still applies to this page even when storage is unavailable.
  }
  applyTheme(document.documentElement.dataset.theme || loadTheme());
  refreshLocalizedUi();
}

function renderAuthenticationCopy() {
  ui.authDescription.textContent = state.setupMode
    ? t("首次使用：请为这台设备设置唯一的管理员账号。")
    : t("登录后管理这台设备上的 XinBot 实例。");
  ui.authSubmit.textContent = state.setupMode ? t("创建管理员并进入") : t("登录");
}

function refreshLocalizedUi() {
  renderAuthenticationCopy();
  if (state.settings) renderSystemSummary();
  renderList();
  if (state.activeView === "plugins") renderPluginManager();
  if (state.draft && !ui.editor.classList.contains("hidden")) {
    renderEditorHeading();
    renderPlugins(state.draft);
    renderLoginBehavior();
    renderProxySettings();
    renderRuntime();
  }
  if (ui.settingsDialog.open) renderSettingsHealth();
  if (ui.pluginConfigDialog.open && state.pluginConfig?.mode === "structured") renderBttbEditor();
}

function notify(message, error = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle("error", error);
  ui.toast.classList.add("show");
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => ui.toast.classList.remove("show"), 2800);
}

async function boot() {
  applyLanguage(loadLanguage());
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
  renderAuthenticationCopy();
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
  document.querySelectorAll("[data-language-toggle]").forEach((button) => {
    button.addEventListener("click", toggleLanguage);
  });
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
  byId("instance-proxy-enabled").addEventListener("change", renderProxySettings);
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
    ui.authError.textContent = t("两次输入的密码不一致");
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
    proxyEnabled: false,
    proxyType: "SOCKS5",
    proxyAddress: "",
    proxyUsername: "",
    proxyPassword: "",
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
  byId("instance-count").textContent = currentLanguage === "en"
    ? `${state.instances.length} ${state.instances.length === 1 ? "instance" : "instances"}`
    : `${state.instances.length} 个实例`;
  byId("running-count").textContent = currentLanguage === "en"
    ? `${state.runtime.length} running`
    : `${state.runtime.length} 个运行中`;
  const ready = state.plugins.filter((plugin) => plugin.available).length;
  byId("plugin-manager-summary").textContent = currentLanguage === "en"
    ? `${ready}/${state.plugins.length} resources ready`
    : `${ready}/${state.plugins.length} 个资源就绪`;
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

function localizedPluginName(plugin) {
  return currentLanguage === "en" ? (plugin.nameEn || t(plugin.name)) : plugin.name;
}

function localizedPluginDescription(plugin) {
  return currentLanguage === "en" ? (plugin.descriptionEn || t(plugin.description)) : plugin.description;
}

function localizedConfigLabel(spec) {
  return currentLanguage === "en" ? (spec.labelEn || t(spec.label || spec.path)) : (spec.label || spec.path);
}

function localizedList(items) {
  return items.join(currentLanguage === "en" ? ", " : "、");
}

function renderPluginManager() {
  const search = byId("plugin-search").value.trim().toLocaleLowerCase(currentLanguage);
  const type = byId("plugin-type-filter").value;
  const usedPlugins = state.plugins.filter((plugin) => pluginUsage(plugin).length > 0).length;
  byId("plugin-total-count").textContent = state.plugins.length;
  byId("plugin-ready-count").textContent = state.plugins.filter((plugin) => plugin.available).length;
  byId("plugin-missing-count").textContent = state.plugins.filter((plugin) => !plugin.available).length;
  byId("plugin-used-count").textContent = usedPlugins;
  byId("plugin-resource-path").textContent = state.settings?.resourceDir
    ? t("资源目录：{path}", { path: state.settings.resourceDir })
    : t("尚未设置插件资源目录");

  const plugins = state.plugins.filter((plugin) => {
    const matchesType = type === "all" || plugin.pluginType === type;
    const haystack = `${plugin.name} ${plugin.nameEn || ""} ${plugin.id} ${plugin.description || ""} ${plugin.descriptionEn || ""}`.toLocaleLowerCase(currentLanguage);
    return matchesType && (!search || haystack.includes(search));
  });
  const list = byId("plugin-library-list");
  list.textContent = "";

  if (!plugins.length) {
    const empty = document.createElement("p");
    empty.className = "plugin-library-empty";
    empty.textContent = state.plugins.length ? t("没有符合筛选条件的插件。") : t("插件目录中没有可显示的条目。");
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
    title.textContent = localizedPluginName(plugin);
    const version = document.createElement("span");
    version.textContent = plugin.version;
    heading.append(title, version);
    const description = document.createElement("p");
    description.textContent = localizedPluginDescription(plugin) || t("没有插件说明");
    body.append(heading, description);

    const facts = document.createElement("div");
    facts.className = "plugin-facts";
    const dependencies = (plugin.dependencies || []).length
      ? t("依赖：{items}", { items: localizedList(plugin.dependencies) })
      : t("无声明依赖");
    const configFiles = (plugin.configFiles || []).length
      ? t("配置：{items}", { items: localizedList(plugin.configFiles.map(localizedConfigLabel)) })
      : t("无专用配置");
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
    status.textContent = plugin.available ? t("资源已就绪") : t("JAR 缺失");
    const usage = pluginUsage(plugin);
    const usageText = document.createElement("small");
    usageText.textContent = usage.length
      ? currentLanguage === "en"
        ? `${usage.length} ${usage.length === 1 ? "instance" : "instances"}: ${localizedList(usage.map((profile) => profile.name))}`
        : `${usage.length} 个实例：${localizedList(usage.map((profile) => profile.name))}`
      : t("尚未被实例使用");
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
  renderEditorHeading();
  byId("instance-name").value = profile.name;
  byId("instance-host").value = profile.host;
  byId("instance-port").value = profile.port ?? "";
  byId("instance-username").value = profile.username;
  byId("instance-password").value = profile.serverPassword || "";
  byId("instance-online").checked = profile.onlineMode;
  byId("instance-login-template").value = profile.loginTemplate || "";
  byId("instance-proxy-enabled").checked = Boolean(profile.proxyEnabled);
  byId("instance-proxy-type").value = ["HTTP", "SOCKS4", "SOCKS5"].includes(profile.proxyType)
    ? profile.proxyType
    : "SOCKS5";
  byId("instance-proxy-address").value = profile.proxyAddress || "";
  byId("instance-proxy-username").value = profile.proxyUsername || "";
  byId("instance-proxy-password").value = profile.proxyPassword || "";
  byId("instance-xms").value = profile.xmsMb ?? 32;
  byId("instance-xmx").value = profile.xmxMb ?? 256;
  ui.instanceError.textContent = "";
  renderPlugins(profile);
  renderLoginBehavior();
  renderProxySettings();
  renderRuntime();
  const exists = Boolean(profile.id);
  byId("delete-button").disabled = !exists;
}

function renderEditorHeading() {
  const profile = state.draft;
  if (!profile) return;
  byId("editor-title").textContent = profile.name || t("新实例");
  byId("editor-subtitle").textContent = profile.id
    ? `${profile.username || t("未设置账号")} · ${profile.host || t("未设置服务器")}`
    : t("尚未保存");
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
    title.textContent = localizedPluginName(plugin);
    const description = document.createElement("small");
    description.textContent = localizedPluginDescription(plugin) || plugin.version;
    copy.append(title, description);
    if (!plugin.available) {
      const warning = document.createElement("em");
      warning.textContent = t("资源文件缺失");
      copy.append(warning);
    }
    if (plugin.recommended) {
      const recommended = document.createElement("em");
      recommended.textContent = t("推荐");
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
    metaContainer.textContent = t("请先在系统设置中配置有效的插件资源目录。");
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
    empty.textContent = t("填写服务器地址后，将在这里显示自动选择的适配方式。");
    container.append(empty);
    return;
  }
  if (!plugin) {
    const empty = document.createElement("div");
    empty.className = "adapter-empty error";
    empty.textContent = t("插件目录中没有可用于该服务器的适配器。");
    container.append(empty);
    error.textContent = t("请先在插件资源目录中准备通用 Meta 插件。");
    return;
  }

  const card = document.createElement("article");
  card.className = `adapter-card${plugin.available ? "" : " unavailable"}`;
  const badge = document.createElement("span");
  badge.className = `adapter-badge${dedicated ? " dedicated" : ""}`;
  badge.textContent = dedicated ? t("专用 META") : t("通用连接");
  const copy = document.createElement("div");
  const title = document.createElement("strong");
  const pluginName = localizedPluginName(plugin);
  title.textContent = pluginName;
  const description = document.createElement("small");
  description.textContent = dedicated
    ? t("已识别 {host}，登录与服务器流程由专用适配器处理。", { host })
    : t("没有匹配到专用 Meta，将使用通用服务器连接。");
  copy.append(title, description);
  const status = document.createElement("span");
  status.className = plugin.available ? "adapter-ready" : "adapter-missing";
  status.textContent = plugin.available ? t("已自动选择") : t("资源文件缺失");
  card.append(badge, copy, status);
  container.append(card);

  if (profile._adapterAutoChanged) {
    const migration = document.createElement("p");
    migration.className = "adapter-migration";
    migration.textContent = t("这是旧实例配置；保存后将切换到该服务器的专用适配器。");
    container.append(migration);
  }
  if (!plugin.available) {
    error.textContent = dedicated
      ? t("{host} 需要 {plugin}，但对应资源文件缺失；不会降级到通用连接。", { host, plugin: pluginName })
      : t("{plugin} 的资源文件缺失，当前无法保存或启动实例。", { plugin: pluginName });
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
    ? t("二次登录由 {plugin} 处理", { plugin: localizedPluginName(meta) })
    : "";

  const resolution = serverAdapterForHost(byId("instance-host").value);
  byId("instance-host").disabled = false;
  byId("instance-port").disabled = false;
  byId("instance-host-note").textContent = resolution.dedicated && meta
    ? t("已识别该服务器，将自动使用 {plugin}。", { plugin: localizedPluginName(meta) })
    : t("未匹配专用服务器时，将自动使用通用连接。");

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
  const metaName = localizedPluginName(meta);
  if (pluginManaged) {
    title.textContent = t("{plugin} 管理登录流程", { plugin: metaName });
    detail.textContent = t("Box Manager 只保存身份信息，不会额外发送登录命令。");
  } else if (usesTemplate) {
    title.textContent = t("{plugin} 使用可选登录命令", { plugin: metaName });
    detail.textContent = t("仅在离线模式且填写二级登录密码时，加入服务器后发送命令模板。");
  } else {
    title.textContent = t("{plugin} 不使用管理端登录命令", { plugin: metaName });
    detail.textContent = t("是否需要额外认证由该 Meta 插件自身决定。");
  }
  copy.append(title, detail);
  note.append(marker, copy);
}

function renderProxySettings() {
  const enabled = byId("instance-proxy-enabled").checked;
  const fields = byId("instance-proxy-fields");
  fields.classList.toggle("hidden", !enabled);
  fields.querySelectorAll("input, select").forEach((field) => {
    field.disabled = !enabled;
  });
  byId("instance-proxy-address").required = enabled;
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
      button.textContent = t("编辑 {label}", { label: localizedConfigLabel(spec) });
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
    byId("plugin-config-title").textContent = localizedConfigLabel(spec);
    byId("plugin-config-description").textContent = `${localizedPluginName(plugin)} · ${document.exists ? t("正在编辑已有文件") : t("文件尚不存在，保存后创建")}`;
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
        byId("plugin-config-error").textContent = t("现有文件无法结构化解析，已切换到原始 JSON：{error}", { error: error.message });
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
    throw new Error(t("{field} 必须是整数", { field }));
  }
  return value;
}

function parseBttbBoolean(value, field) {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new Error(t("{field} 必须是 true 或 false", { field }));
  return value;
}

function parseBttbCoordinates(value, field, defaults) {
  if (value === undefined) return { ...defaults };
  if (!isRecord(value)) throw new Error(t("{field} 必须是坐标对象", { field }));
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
    throw new Error(t("JSON 语法错误：{error}", { error: error.message }));
  }
  if (!isRecord(source)) throw new Error(t("根节点必须是 JSON 对象"));
  if (!isRecord(source.players)) throw new Error(t("players 必须是对象"));

  const languageText = typeof source.language === "string" ? source.language.toLowerCase() : "chinese";
  const language = languageText === "english" ? "English" : languageText === "chinese" ? "Chinese" : source.language;
  const players = Object.entries(source.players).map(([name, value]) => {
    if (!isRecord(value) || !Array.isArray(value.locations)) {
      throw new Error(t("玩家“{name}”的 locations 必须是数组", { name }));
    }
    return {
      name,
      locations: value.locations.map((location, index) => {
        if (!isRecord(location)) throw new Error(t("玩家“{name}”的第 {index} 个位置必须是对象", { name, index: index + 1 }));
        return {
          number: String(location.number ?? ""),
          x: parseBttbInteger(location.x, t("{name} 位置 {index} 的 {axis}", { name, index: index + 1, axis: "X" })),
          y: parseBttbInteger(location.y, t("{name} 位置 {index} 的 {axis}", { name, index: index + 1, axis: "Y" })),
          z: parseBttbInteger(location.z, t("{name} 位置 {index} 的 {axis}", { name, index: index + 1, axis: "Z" })),
        };
      }),
    };
  });
  if (source.return !== undefined && !isRecord(source.return)) throw new Error(t("return 必须是对象"));
  const returnBlock = isRecord(source.return) ? source.return : {};
  if (source.admin !== undefined && !isRecord(source.admin)) throw new Error(t("admin 必须是对象"));
  const adminBlock = isRecord(source.admin) ? source.admin : {};
  const adminPlayers = adminBlock.players === undefined ? [] : adminBlock.players;
  if (!Array.isArray(adminPlayers) || adminPlayers.some((player) => typeof player !== "string")) {
    throw new Error(t("admin.players 必须是玩家名称数组"));
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
    throw new Error(t("{label} 必须是 32 位整数", { label }));
  }
}

function validateBttbConfig(config) {
  if (!["Chinese", "English"].includes(config.language)) throw new Error(t("语言只能选择中文或英文"));
  if (!Array.isArray(config.players) || config.players.length === 0) throw new Error(t("至少需要一个玩家"));
  const playerNames = new Set();
  for (const [playerIndex, player] of config.players.entries()) {
    const label = t("玩家 {index}", { index: playerIndex + 1 });
    if (typeof player.name !== "string" || !player.name) throw new Error(t("{label}的名称不能为空", { label }));
    if (player.name !== player.name.trim()) throw new Error(t("{label}的名称首尾不能有空格", { label }));
    const playerKey = player.name.toLowerCase();
    if (playerNames.has(playerKey)) throw new Error(t("玩家名称“{name}”重复", { name: player.name }));
    playerNames.add(playerKey);
    if (!Array.isArray(player.locations) || player.locations.length === 0) {
      throw new Error(t("玩家“{name}”至少需要一个珍珠按钮位置", { name: player.name }));
    }
    const locationNumbers = new Set();
    for (const [locationIndex, location] of player.locations.entries()) {
      const locationLabel = t("玩家“{name}”的位置 {index}", { name: player.name, index: locationIndex + 1 });
      if (!/^[1-9]\d*$/.test(location.number)) throw new Error(t("{label}的编号必须是正整数", { label: locationLabel }));
      const number = Number(location.number);
      if (number > 2147483647) throw new Error(t("{label}的编号过大", { label: locationLabel }));
      if (locationNumbers.has(location.number)) throw new Error(t("{label}的编号重复", { label: locationLabel }));
      locationNumbers.add(location.number);
      validateI32(location.x, t("{label}的 {axis}", { label: locationLabel, axis: "X" }));
      validateI32(location.y, t("{label}的 {axis}", { label: locationLabel, axis: "Y" }));
      validateI32(location.z, t("{label}的 {axis}", { label: locationLabel, axis: "Z" }));
    }
  }
  validateI32(config.returnLocation.x, t("返回位置 X"));
  validateI32(config.returnLocation.y, t("返回位置 Y"));
  validateI32(config.returnLocation.z, t("返回位置 Z"));
  if (!Array.isArray(config.adminPlayers) || config.adminPlayers.length > 3) throw new Error(t("游戏内管理员最多 3 人"));
  const admins = new Set();
  for (const [index, name] of config.adminPlayers.entries()) {
    const label = t("管理员 {index}", { index: index + 1 });
    if (typeof name !== "string" || !name) throw new Error(t("{label}的名称不能为空", { label }));
    if (name !== name.trim()) throw new Error(t("管理员“{name}”的名称首尾不能有空格", { name }));
    const key = name.toLowerCase();
    if (admins.has(key)) throw new Error(t("管理员名称“{name}”重复", { name }));
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
  general.append(configElement("h3", "", t("基本设置")));
  const languageLabel = configElement("label", "bttb-language", t("界面语言"));
  const language = document.createElement("select");
  for (const [value, label] of [["Chinese", t("中文")], ["English", "English"]]) {
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
  playersTitle.append(configElement("h3", "", t("玩家与珍珠按钮")), configElement("p", "muted small-copy", t("每个玩家可配置多个编号及对应坐标。")));
  const addPlayer = configElement("button", "ghost compact-button", t("＋ 添加玩家"));
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
    const nameLabel = configElement("label", "bttb-player-name", t("玩家名称"));
    const nameInput = document.createElement("input");
    nameInput.value = player.name;
    nameInput.placeholder = t("Minecraft 用户名");
    nameInput.addEventListener("input", () => (player.name = nameInput.value));
    nameLabel.append(nameInput);
    const removePlayer = configElement("button", "text-button danger-text", t("删除玩家"));
    removePlayer.type = "button";
    removePlayer.disabled = config.players.length === 1;
    removePlayer.addEventListener("click", () => {
      config.players.splice(playerIndex, 1);
      renderBttbEditor();
    });
    heading.append(nameLabel, removePlayer);
    card.append(heading);

    const locationHeader = configElement("div", "bttb-location-header");
    for (const label of [t("编号"), "X", "Y", "Z", ""]) locationHeader.append(configElement("span", "", label));
    card.append(locationHeader);
    for (const [locationIndex, location] of player.locations.entries()) {
      const row = configElement("div", "bttb-location-row");
      const number = document.createElement("input");
      number.type = "number";
      number.min = "1";
      number.step = "1";
      number.value = location.number;
      number.setAttribute("aria-label", t("位置编号"));
      number.addEventListener("input", () => (location.number = number.value));
      row.append(number);
      for (const axis of ["x", "y", "z"]) {
        const input = document.createElement("input");
        input.type = "number";
        input.step = "1";
        input.value = Number.isFinite(location[axis]) ? location[axis] : "";
        input.setAttribute("aria-label", t("{axis} 坐标", { axis: axis.toUpperCase() }));
        input.addEventListener("input", () => (location[axis] = input.value === "" ? Number.NaN : Number(input.value)));
        row.append(input);
      }
      const remove = configElement("button", "icon-button compact-icon danger-text", "×");
      remove.type = "button";
      remove.disabled = player.locations.length === 1;
      remove.setAttribute("aria-label", t("删除位置"));
      remove.addEventListener("click", () => {
        player.locations.splice(locationIndex, 1);
        renderBttbEditor();
      });
      row.append(remove);
      card.append(row);
    }
    const addLocation = configElement("button", "ghost compact-button", t("＋ 添加位置"));
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
  returnCopy.append(configElement("strong", "", t("点击后返回指定位置")), configElement("small", "", t("触发珍珠按钮后移动到下面的坐标。")));
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
  adminCopy.append(configElement("strong", "", t("启用游戏内管理员")), configElement("small", "", t("最多配置 3 个 Minecraft 用户名。")));
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
    input.placeholder = t("管理员 {index}", { index: index + 1 });
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
  const addAdmin = configElement("button", "ghost compact-button", t("＋ 添加管理员"));
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
    byId("plugin-config-description").textContent = `${localizedPluginName(plugin)} · ${t("已保存")}`;
    notify(t("插件配置已保存"));
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
    proxyEnabled: byId("instance-proxy-enabled").checked,
    proxyType: byId("instance-proxy-type").value,
    proxyAddress: byId("instance-proxy-address").value.trim(),
    proxyUsername: byId("instance-proxy-username").value.trim(),
    proxyPassword: byId("instance-proxy-password").value,
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
    ui.instanceError.textContent = t("没有可用于该服务器的连接适配器");
    return;
  }
  if (!adapter.available) {
    ui.instanceError.textContent = t("所需的服务器适配器 {plugin} 资源缺失", { plugin: localizedPluginName(adapter) });
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
    state.instances.sort((a, b) => a.name.localeCompare(b.name, currentLanguage));
    state.selectedId = saved.id;
    state.draft = structuredClone(saved);
    renderList();
    renderEditor();
    byId("save-state").textContent = t("已保存");
    window.setTimeout(() => (byId("save-state").textContent = ""), 1800);
  } catch (error) {
    ui.instanceError.textContent = error.message;
  } finally {
    byId("save-button").disabled = false;
  }
}

async function deleteInstance() {
  if (!state.draft?.id) return;
  if (!confirm(t("确定将“{name}”移到回收目录吗？", { name: state.draft.name }))) return;
  try {
    await api(`/api/instances/${state.draft.id}`, { method: "DELETE" });
    state.instances = state.instances.filter((item) => item.id !== state.draft.id);
    notify(t("实例已移到数据目录中的 trash，可手动恢复"));
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
    notify(t(action === "start" ? "启动请求已完成" : action === "stop" ? "已发送停止命令" : "实例已重启"));
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
  byId("runtime-state").textContent = runtime ? t("运行中") : t("已停止");
  byId("runtime-detail").textContent = runtime ? `PID ${runtime.pid}` : t("没有活动进程");
  byId("metric-pid").textContent = runtime?.pid ?? "—";
  byId("metric-memory").textContent = runtime?.rssBytes ? formatBytes(runtime.rssBytes) : "—";
  byId("metric-cpu").textContent = runtime?.cpuPercent != null ? `${runtime.cpuPercent.toFixed(1)}%` : "—";
  byId("metric-started").textContent = runtime?.startedAt
    ? new Date(runtime.startedAt * 1000).toLocaleString(currentLanguage)
    : "—";
  const exists = Boolean(state.draft?.id);
  const adapter = serverAdapterForHost(byId("instance-host").value).plugin;
  const adapterBlocked = Boolean(state.draft?._adapterAutoChanged) || !adapter?.available;
  byId("start-button").disabled = !exists || Boolean(runtime) || adapterBlocked;
  byId("start-button").title = state.draft?._adapterAutoChanged
    ? t("请先保存实例，完成服务器适配迁移")
    : !adapter?.available ? t("服务器适配器资源缺失") : "";
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
  const time = log.timestamp ? new Date(log.timestamp * 1000).toLocaleTimeString(currentLanguage, { hour12: false }) : "--:--:--";
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
  for (const [label, ok] of [["XinBot Core", state.settings.xinbotReady], [t("插件目录"), state.settings.resourceDirReady]]) {
    const row = document.createElement("div");
    row.className = "health-item";
    const name = document.createElement("span");
    name.textContent = label;
    const result = document.createElement("strong");
    result.className = ok ? "health-ok" : "health-bad";
    result.textContent = ok ? t("已就绪") : t("需要配置");
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
    notify(t("系统设置已保存"));
  } catch (error) {
    byId("settings-error").textContent = error.message;
  }
}

function renderSystemSummary() {
  if (!state.settings) return;
  byId("system-summary").textContent = state.settings.xinbotReady && state.settings.resourceDirReady
    ? t("运行环境已就绪")
    : t("运行环境需要配置");
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
    byId("account-error").textContent = t("两次输入的新密码不一致");
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
    notify(t("管理员账号已更新"));
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
