# 源码构建与开发

## 本地构建

项目需要 Rust stable，依赖版本锁定在 `Cargo.lock`：

```shell
cargo build --release --locked
```

生成的程序位于 `target/release/xinbot-box-manager`。网页 HTML、CSS 和 JavaScript 会直接
嵌入程序，不需要单独构建或常驻 Node.js 服务。

## 准备运行资源

不使用完整 `.deb` 时，需要自行准备：

- Java 17 或更高版本；
- XinBot Core JAR；
- `resources/catalog.json`；
- 目录中声明的插件 JAR。

可以从已有开发资源目录复制：

```shell
./scripts/prepare-resources.sh /path/to/resources
```

该脚本只复制本地文件，不会联网下载，也不会把 JAR 加入 Git。也可以在网页“系统设置”中
填写已有的 Core 和插件资源目录。

资源的固定版本、哈希、下载地址、源码地址和许可证记录在
`packaging/bundle-resources.tsv`。

## 直接运行

仅允许本机访问：

```shell
./target/release/xinbot-box-manager \
  --bind 127.0.0.1:8080 \
  --data-dir ./data \
  --resource-dir ./resources
```

允许局域网访问：

```shell
./target/release/xinbot-box-manager \
  --bind 0.0.0.0:8080 \
  --data-dir ./data \
  --resource-dir ./resources
```

命令行格式：

```text
xinbot-box-manager [serve] [--bind IP:PORT] [--data-dir PATH]
                              [--resource-dir PATH] [--secure-cookie]
xinbot-box-manager admin reset-password [--data-dir PATH]
```

对应环境变量为 `XINBOT_BOX_BIND`、`XINBOT_BOX_DATA_DIR`、
`XINBOT_BOX_RESOURCE_DIR` 和 `XINBOT_BOX_SECURE_COOKIE`。

## systemd 模板

仓库模板位于 `packaging/xinbot-box-manager.service`。完整 `.deb` 会自动安装该服务；手动部署
时需要根据实际路径和系统用户调整。

## 提交前检查

```shell
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
node --check web/app.js
```

GitHub Actions 会在 push 和 pull request 时执行核心检查。
