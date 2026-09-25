# 参与贡献

XinBot Box Manager 仍处于原型阶段。欢迎提交范围清晰、能够验证的修复和改进。

## 开发环境

- Linux；
- Rust stable；
- Node.js（仅用于检查内嵌前端 JavaScript 的语法，不需要常驻运行）；
- 如需验证实际 XinBot 启动链路，还需要 Java 21、XinBot Core 和相应插件资源。

仓库不包含外部 JAR。请不要在提交中加入 XinBot Core、插件二进制、真实账号、密码、
令牌、实例数据、日志或本机专用路径。

## 本地检查

提交前运行：

```shell
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
node --check web/app.js
```

涉及网页交互时，还应在真实浏览器中检查浅色和深色主题。涉及进程、插件或配置生成时，
请说明使用的架构、Java 版本和验证范围，但不要提交测试账号或运行数据。

## 提交建议

- 一个提交集中解决一个问题；
- 保持 `Cargo.lock` 与源码一致；
- 行为变化应同步更新 README 或 `docs/implementation-status.md`；
- 新增业务规则时优先增加自动化测试；

提交 Pull Request 时，请简要说明变更目的、验证命令、可见界面变化以及尚未覆盖的风险。
