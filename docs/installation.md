# 安装与运维

本文记录 XinBot Box Manager 的软件包构建、安装和日常维护方法。

## 发布状态

公开版本发布在 [GitHub Releases](https://github.com/newPlayerAL/xinbot-box-manager/releases)。
下载与设备架构匹配的 `.deb` 后通过 APT 安装即可。

## 安装 `.deb`

AMD64 设备：

```shell
sudo apt install ./xinbot-box-manager_0.1.0_amd64.deb
```

ARM64 设备：

```shell
sudo apt install ./xinbot-box-manager_0.1.0_arm64.deb
```

软件包会：

- 安装 Java 17 或更高版本的无头运行时依赖；
- 创建低权限的 `xinbot` 系统用户；
- 安装 XinBot Core、XinMeta、BTTB 和 MovementSync；
- 创建 `/var/lib/xinbot-box-manager` 数据目录；
- 安装、启用并启动 `xinbot-box-manager.service`。

安装后访问 `http://设备IP:8080`，首次打开时创建管理员账号。

## 从源码构建软件包

构建机需要 Debian/Ubuntu、Rust stable、`dpkg-deb` 和 `sha256sum`，并且默认需要联网下载
锁定版本的 XinBot Core 与插件：

```shell
git clone https://github.com/newPlayerAL/xinbot-box-manager.git
cd xinbot-box-manager
./scripts/build-deb.sh
sudo apt install ./dist/xinbot-box-manager_0.1.0_$(dpkg --print-architecture).deb
```

所有外部 JAR 都会按照 `packaging/bundle-resources.tsv` 校验 SHA-256。仓库本身不提交这些
二进制文件。

### 离线构建

已经准备好与资源清单哈希一致的 JAR 时，可以指定本地资源目录：

```shell
./scripts/build-deb.sh --resources /path/to/verified-resources
```

### ARM64 交叉编译

安装对应 Rust target 和交叉编译器后，可以执行：

```shell
./scripts/build-deb.sh --target aarch64-unknown-linux-gnu
```

这会生成 `arm64` 软件包。也可以直接在 ARM64 Linux 环境中原生构建。

## 服务和目录

主要路径如下：

| 用途 | 路径 |
| --- | --- |
| 服务配置 | `/etc/default/xinbot-box-manager` |
| 数据与实例 | `/var/lib/xinbot-box-manager` |
| Core 和插件资源 | `/var/lib/xinbot-box-manager/resources` |
| systemd 服务 | `xinbot-box-manager.service` |

修改监听地址、目录或安全 Cookie 设置后执行：

```shell
sudo systemctl restart xinbot-box-manager
```

常用服务命令：

```shell
sudo systemctl status xinbot-box-manager
sudo journalctl -u xinbot-box-manager -f
```

卸载或清除软件包不会自动删除 `/var/lib/xinbot-box-manager`，以免误删实例、密码和配置。

## 遗忘管理员密码

在 Linux 控制台执行：

```shell
sudo /usr/bin/xinbot-box-manager admin reset-password \
  --data-dir /var/lib/xinbot-box-manager
```

密码在终端中无回显输入，不会进入命令行参数。重置完成后，已有网页登录会话将在下一次
请求时失效，无需重启服务。

## 数据目录

```text
/var/lib/xinbot-box-manager/
├── auth.json          # 管理员密码哈希
├── settings.json      # Java、Core 和资源设置
├── profiles/          # 实例资料
├── instances/         # 实例工作目录、配置和插件配置
├── trash/             # 可恢复删除的实例
└── audit.log          # 本机密码重置记录，不含密码
```

Minecraft 登录密码需要保存在本机实例配置中才能无人值守启动。请保持数据目录仅由专用系统
用户访问。

## 网络安全

管理端默认监听局域网 HTTP。需要从不可信网络访问时，应放在可信的 HTTPS 反向代理或 VPN
之后，并启用 `XINBOT_BOX_SECURE_COOKIE=true`。具体边界见[安全策略](../SECURITY.md)。
