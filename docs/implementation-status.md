# XinBot Box Manager 原型实现状态

更新时间：2026-09-25

本文记录已经落地并实际验证的原型能力。它不是最终需求确认，也不改变
`discussion-draft.md` 的讨论稿属性。

## 当前结构

```text
浏览器（内嵌 HTML/CSS/JavaScript）
                 │ HTTP + SSE
                 ▼
        Rust 单进程管理服务
        ├── 管理员认证与会话
        ├── 实例和全局设置存储
        ├── 插件目录与依赖同步
        ├── 插件配置文件编辑
        ├── XinBot 子进程托管
        └── Linux 进程资源采样
                 │
                 └── 0～3 个 Java/XinBot 子进程
```

管理网页直接编译进约 1.2～1.4 MB 的 release 可执行文件，不需要 Node.js 常驻服务。

## 已实现

- 单管理员首次设置、登录、退出和修改密码；
- 浅色/深色主题切换和浏览器本地记忆；
- Linux 控制台交互式密码重置；
- 密码重置文件热检测和已有会话失效；
- 实例创建、修改、列表和可恢复删除；
- Java、XinBot Core 和插件资源路径设置；
- 按服务器地址自动选择专用 Meta 或通用连接，以及普通插件声明依赖解析；
- 已知服务器隐藏并拒绝 DirectConnect，专用 Meta 缺失时不自动降级；
- 独立插件管理页，显示资源就绪状态、依赖、配置能力和实例使用情况；
- 根据 Meta 插件 `loginMode` 联动二级密码、登录命令模板和插件接管提示；
- 每实例插件同步和工作目录隔离；
- BTTB 专用结构化配置编辑器，包括玩家/位置、返回点、游戏内管理员及原始 JSON 模式；
- 已声明插件配置文件的读取、写入和 JSON 格式校验；
- 每实例 `-Xms`/`-Xmx` 参数；
- 启动、停止、重启和控制台命令；
- 最多保留 1000 行的当前进程内日志；
- SSE 实时日志和状态；
- Linux PID、RSS 和 CPU 采样；
- systemd unit 模板和开发资源准备脚本。

## 验证结果

### x86_64 开发机

- `cargo test --offline`：7 项测试全部通过；
- `cargo clippy --offline --all-targets -- -D warnings`：通过；
- `node --check web/app.js`：通过；
- release 构建：通过；
- 管理员首次设置、登录、设置保存、实例 CRUD 和回收目录：通过；
- BTTB 配置读取、无效 JSON 拒绝和有效 JSON 保存：通过；
- 实际启动 XinBot Core + DirectConnect + BackToTheBase + MovementSync：通过；
- 控制台 `status` 命令、CPU/RSS 读取和正常停止：通过；
- 上述 XinBot 测试进程 RSS 约 139～145 MB，JVM 最大堆限制为 256 MB。

Minecraft 连接目标是本机不可用端口，因此插件完成加载和启用，但没有进入真实服务器。

### ARM64 测试环境

另在隔离的 AArch64 Linux 测试环境中完成验证。测试没有安装或修改系统包，源码、依赖、
构建产物和运行数据均限制在独立工作目录内。

- 原生 release 构建：通过；
- ARM64 release 二进制：约 1.2 MB；
- ARM64 原生 4 项测试：全部通过；
- 首次设置、登录 Cookie、设置读取、实例创建和持久化：通过；
- 管理服务空闲 RSS：约 2.7 MB；
- 管理服务线程数：10；
- PBKDF2 管理员登录耗时：约 175 ms；
- 使用独立目录中的 OpenJDK 21，没有安装系统包；
- 实际启动 XinBot Core + DirectConnect + BackToTheBase + MovementSync：通过；
- BTTB 声明的 MovementSync 依赖自动同步和加载：通过；
- 浏览器/API 控制台 `status` 命令和正常停止：通过；
- 管理端采样到的 XinBot RSS 约 145～151 MB，JVM 最大堆限制为 256 MB；
- XinBot 自身 `status` 报告已用堆约 15 MB。

XinBot 的连接目标同样是本机不可用端口 `127.0.0.1:9`：这验证了 ARM64 上的 Core、
插件加载、失败重连、命令与进程托管链路，但没有进入真实 Minecraft 服务器。测试结束后
已停止管理端和 Java 进程，并清理临时运行数据。

## 原型阶段仍未完成

- 在 ARM64 上连接真实 Minecraft 服务器；
- 在 2 GB H618/RK3518 设备上运行 1～3 个实例的 24～48 小时测试；
- 异常退出自动拉起、开机自启配置界面和重启退避；
- 持久化历史日志、日志轮换与磁盘配额；
- 自动安装或升级 Java、XinBot Core 和插件资源；
- 插件导入、下载与升级；
- HTTPS 终止、首次设置引导令牌和更完整的安全审计；
- 实例导入、导出、备份和恢复界面；
- 正式安装器、升级与回滚流程；
- 针对手机和不同浏览器的完整视觉/交互验收。

XinManager、XinRemote、世界/区块/3D 查看、多用户和角色权限仍不在当前原型范围内。
