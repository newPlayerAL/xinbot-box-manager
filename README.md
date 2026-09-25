# XinBot Box Manager

一个面向无头 Linux 迷你主机的轻量 XinBot 网页管理端。

> 当前状态：首个可运行原型。功能与接口仍可能变化，尚不建议直接用于公网环境。
> [前期方案讨论稿](docs/discussion-draft.md)仍然是未确认的讨论记录，不因已有原型而自动成为最终需求。

当前实现与验证结果见：[原型实现状态](docs/implementation-status.md)。

![实例配置页：已知服务器自动选择专用 Meta](docs/images/instance-auto-adapter.png)

## 已实现的原型功能

- 单管理员首次设置、登录、退出和修改密码；
- 可记忆选择的浅色/深色网页主题；
- PBKDF2-SHA256 密码哈希、HttpOnly/SameSite 会话 Cookie、登录失败限速；
- 通过 Linux 控制台命令重置遗忘的管理员密码；
- 创建、编辑和可恢复删除 XinBot 实例；
- 为每个实例隔离工作目录、配置与插件；
- 根据服务器地址自动选择专用 Meta 或通用连接，并自动补齐普通插件的声明依赖；
- 独立插件管理页，集中查看本机插件资源、依赖和实例使用情况；
- 按 Meta 插件的登录模式控制二级登录：插件接管时不重复发命令，DirectConnect 仅在
  离线模式且配置二级密码时使用命令模板；
- 已知服务器不会显示或降级到 DirectConnect；专用 Meta 缺失时明确阻止保存和启动；
- 用专用结构化编辑器维护 BTTB 的玩家、珍珠按钮、返回点和游戏内管理员配置，并可切换到原始 JSON；
- 编辑插件目录中声明的其他 JSON 配置文件；
- 启动、停止、重启 XinBot，以及发送控制台命令；
- 通过 SSE 实时显示日志和进程状态；
- 在 Linux 上显示 PID、RSS 和 CPU 占用；
- 为每个 JVM 设置独立的 `-Xms`/`-Xmx`；
- 内嵌静态网页，不需要常驻 Node.js 服务。

第一版没有集成 XinManager、XinRemote、世界/区块/3D 查看、多用户或角色权限。

## 仓库内容与外部资源

本 Git 仓库保存管理端源码、插件目录元数据、文档和 systemd 模板，不直接提交 Java、
XinBot Core 或插件 JAR。完整 `.deb` 会在构建时取得固定版本的官方 Release JAR，核对
SHA-256 后再打入安装包；版本、哈希、下载地址、源码地址和许可证记录在
`packaging/bundle-resources.tsv`。

`scripts/prepare-resources.sh` 只用于从本机已有的开发资源目录复制文件，不会联网下载，
也不会把这些二进制文件加入 Git；`target/`、`data/`、日志和常见编辑器文件均已忽略。

## Debian / Ubuntu 一键安装

当前可以在目标设备上构建完整 `.deb`，然后通过一条 APT 命令完成安装。构建脚本默认下载并
校验 XinBot Core、XinMetaPlugin、BackToTheBase 和它依赖的 MovementSync。安装包会创建低权限的
`xinbot` 系统用户、数据与资源目录，安装并启动 systemd 服务：

```shell
./scripts/build-deb.sh
sudo apt install ./dist/xinbot-box-manager_0.1.0_$(dpkg --print-architecture).deb
```

安装后访问 `http://设备IP:8080` 创建管理员账号。服务默认配置位于：

```text
/etc/default/xinbot-box-manager
```

修改监听地址或目录后执行：

```shell
sudo systemctl restart xinbot-box-manager
```

程序数据和插件资源位于 `/var/lib/xinbot-box-manager`。卸载软件包不会删除这个目录，避免意外
丢失实例、密码和配置。当前仓库暂不提供 GitHub Release，因而仍需先在目标设备上构建安装包；
待项目功能和兼容性稳定后，可将相同构建流程接入 Release。

Core 和上述三个插件会安装到 `/var/lib/xinbot-box-manager/resources`，首次打开时管理端会自动
识别 Core 与资源目录，不需要用户再寻找 JAR。Java 17 或更高版本是软件包依赖，由 APT 一并
安装。若发行版的软件源不提供兼容的 Java，需要先配置发行版或可信的 JDK 软件源。

默认构建需要联网下载固定的官方 Release。已经准备好与清单哈希一致的四个 JAR 时，也可以
进行离线构建：

```shell
./scripts/build-deb.sh --resources /path/to/verified-resources
```

构建脚本支持 Rust 交叉编译目标，例如：

```shell
./scripts/build-deb.sh --target aarch64-unknown-linux-gnu
```

这会生成 `arm64` 软件包，但交叉编译器和对应 Rust target 需要事先安装。对于 H618、RK3518
等 ARM64 设备，现阶段更简单可靠的方式仍是在相同架构的 Linux 设备上原生构建。

## 构建

需要 Rust 工具链。项目依赖已锁定在 `Cargo.lock` 中：

```shell
cargo build --release --locked
```

生成的可执行文件位于：

```text
target/release/xinbot-box-manager
```

前端 HTML、CSS 和 JavaScript 会直接嵌入可执行文件，不需要单独构建。

提交改动前建议运行：

```shell
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
node --check web/app.js
```

GitHub Actions 会在 push 和 pull request 时执行同一组核心检查。

## 准备运行资源

不使用 `.deb`、而是直接运行开发构建时，需要自行准备：

- Java 17 或更高版本；
- XinBot Core JAR；
- `resources/catalog.json`；
- 目录中所列插件对应的 JAR。

开发环境可以从相邻的 `xinbot-gui-win` 复制现有插件资源：

```shell
./scripts/prepare-resources.sh ../xinbot-gui-win/src-tauri/resources
```

也可以不复制，在网页“系统设置”中直接填写已有插件资源目录。

## 启动

仅在本机访问：

```shell
./target/release/xinbot-box-manager \
  --bind 127.0.0.1:8080 \
  --data-dir ./data \
  --resource-dir ./resources
```

局域网访问：

```shell
./target/release/xinbot-box-manager \
  --bind 0.0.0.0:8080 \
  --data-dir /var/lib/xinbot-box-manager \
  --resource-dir /opt/xinbot-box-manager/resources
```

首次打开网页时会要求创建管理员账号。随后在“系统设置”中填写 Java 命令、XinBot Core
JAR 和插件资源目录。

如果通过 HTTPS 反向代理访问，启动时应添加 `--secure-cookie`。当前程序本身不终止 TLS，
因此不要把纯 HTTP 服务直接暴露到不可信网络。

## 遗忘密码

在 Linux 控制台中执行：

```shell
sudo /opt/xinbot-box-manager/xinbot-box-manager \
  admin reset-password \
  --data-dir /var/lib/xinbot-box-manager
```

新密码会在终端中无回显地输入，不会出现在命令行参数、进程列表或审计日志中。重置后，
管理服务会在下一次请求时检测账号配置变化并使已有网页登录会话失效，不要求重启服务。

## 数据目录

```text
data/
├── auth.json          # 管理员密码哈希，权限 0600
├── settings.json      # Java、Core 和资源路径
├── profiles/          # 实例资料
├── instances/         # 实例工作目录、config.conf 和插件配置
├── trash/             # 可恢复删除的实例
└── audit.log          # 本机密码重置记录，不含密码
```

实例中的 Minecraft 登录密码目前必须保存在本机资料和生成的 `config.conf` 中，以支持无人值守
启动。因此数据目录应由专用系统用户持有，并保持 `0700` 权限。

## systemd

仓库提供了一个尚未自动安装的模板：[xinbot-box-manager.service](packaging/xinbot-box-manager.service)。
使用前需要按实际安装路径和系统用户调整。管理服务直接启动的 Java 子进程会留在同一个
systemd cgroup 中。

## 命令行

```text
xinbot-box-manager [serve] [--bind IP:PORT] [--data-dir PATH]
                              [--resource-dir PATH] [--secure-cookie]
xinbot-box-manager admin reset-password [--data-dir PATH]
```

对应环境变量为 `XINBOT_BOX_BIND`、`XINBOT_BOX_DATA_DIR`、
`XINBOT_BOX_RESOURCE_DIR` 和 `XINBOT_BOX_SECURE_COOKIE`。

## 贡献与安全

提交补丁前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题和当前部署边界见
[SECURITY.md](SECURITY.md)。本项目仍处于原型阶段，不应把未启用 HTTPS 的管理端直接暴露
到公网。

## 许可证

本项目采用 [GNU GPL v3.0 或更高版本](LICENSE)。外部的 XinBot Core、插件和 Java 不因
出现在运行环境中而自动适用本仓库许可证。
