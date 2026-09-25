# XinBot Box Manager

[简体中文](README.md)

A lightweight web-based XinBot manager for headless Linux hosts. It provides a single browser
interface for managing multiple isolated XinBot instances and is suitable for persistent tasks
such as BTTB and message responses.

Current version: `0.1.0`

Do not expose the management interface directly to the public internet without HTTPS.

![Instance settings: automatically selecting a dedicated Meta plugin for a known server](assets/instance-auto-adapter.png)

## Features

- **Multiple instances**: Create, edit, recoverably delete, and run isolated XinBot instances.
- **Runtime controls**: Start, stop, and restart instances, send console commands, and view logs,
  PIDs, CPU usage, and memory usage in real time.
- **Configuration and plugins**: Manage Core, Meta, and regular plugins, including automatic
  plugin dependency handling and dedicated Meta selection for known servers.
- **BTTB configuration**: Edit players, pearl buttons, return points, and in-game administrators
  on a dedicated page.
- **Web authentication**: A single administrator account, login rate limiting, light and dark
  themes, and password recovery from the Linux console.
- **Lightweight deployment**: A single Rust process with an embedded web interface. The `.deb`
  installs Core, XinMeta, BTTB, MovementSync, and a systemd service without requiring a persistent
  Node.js process.

## Quick installation

Download the package matching your device architecture from
[GitHub Releases](https://github.com/newPlayerAL/xinbot-box-manager/releases/latest):

- [AMD64 / x86-64](https://github.com/newPlayerAL/xinbot-box-manager/releases/download/v0.1.0/xinbot-box-manager_0.1.0_amd64.deb)
- [ARM64 / AArch64](https://github.com/newPlayerAL/xinbot-box-manager/releases/download/v0.1.0/xinbot-box-manager_0.1.0_arm64.deb)

Then install it with:

```shell
sudo apt install ./xinbot-box-manager_0.1.0_amd64.deb
```

On ARM64 devices, replace `amd64` in the filename with `arm64`. After installation, open:

```text
http://DEVICE_IP:8080
```

The first visit prompts you to create an administrator account. The package automatically
installs the Java runtime, enables the systemd service, and prepares XinBot Core and the bundled
plugins.

## Documentation

- [Installation and operations](docs/installation.en.md)
- [Building from source and development](docs/development.en.md)

## License

This project is licensed under the [GNU GPL v3.0 or later](LICENSE). XinBot Core, the plugins, and
Java distributed with the package remain subject to their respective licenses.
