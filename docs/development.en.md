# Building from source and development

[简体中文](development.md)

## Local build

The project requires Rust stable. Dependency versions are locked in `Cargo.lock`:

```shell
cargo build --release --locked
```

The resulting executable is located at `target/release/xinbot-box-manager`. The HTML, CSS, and
JavaScript are embedded directly in the executable, so no separate build or persistent Node.js
service is required.

## Preparing runtime resources

When you are not using the complete `.deb`, prepare the following yourself:

- Java 17 or later;
- the XinBot Core JAR;
- `resources/catalog.json`; and
- the plugin JAR files declared in the catalog.

You can copy them from an existing development resource directory:

```shell
./scripts/prepare-resources.sh /path/to/resources
```

This script only copies local files. It does not download anything or add JAR files to Git. You
can also specify existing Core and plugin resource directories on the web interface's system
settings page.

Pinned versions, hashes, download URLs, source URLs, and licenses are recorded in
`packaging/bundle-resources.tsv`.

## Running directly

Allow access only from the local host:

```shell
./target/release/xinbot-box-manager \
  --bind 127.0.0.1:8080 \
  --data-dir ./data \
  --resource-dir ./resources
```

Allow access from the local network:

```shell
./target/release/xinbot-box-manager \
  --bind 0.0.0.0:8080 \
  --data-dir ./data \
  --resource-dir ./resources
```

Command-line syntax:

```text
xinbot-box-manager [serve] [--bind IP:PORT] [--data-dir PATH]
                              [--resource-dir PATH] [--secure-cookie]
xinbot-box-manager admin reset-password [--data-dir PATH]
```

The corresponding environment variables are `XINBOT_BOX_BIND`, `XINBOT_BOX_DATA_DIR`,
`XINBOT_BOX_RESOURCE_DIR`, and `XINBOT_BOX_SECURE_COOKIE`.

## systemd template

The repository template is located at `packaging/xinbot-box-manager.service`. The complete `.deb`
installs this service automatically. For a manual deployment, adjust it for the actual paths and
system user.

## Pre-commit checks

```shell
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
cargo build --release --locked
node --check web/app.js
```

GitHub Actions runs the core checks on pushes and pull requests.
