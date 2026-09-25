# Installation and operations

[简体中文](installation.md)

This document describes package building, installation, and routine maintenance for XinBot Box
Manager.

## Releases

Public versions are available from
[GitHub Releases](https://github.com/newPlayerAL/xinbot-box-manager/releases). Download the `.deb`
matching your device architecture and install it with APT.

## Installing the `.deb`

On AMD64 devices:

```shell
sudo apt install ./xinbot-box-manager_0.1.0_amd64.deb
```

On ARM64 devices:

```shell
sudo apt install ./xinbot-box-manager_0.1.0_arm64.deb
```

The package:

- installs a headless Java 17 or later runtime dependency;
- creates the unprivileged `xinbot` system user;
- installs XinBot Core, XinMeta, BTTB, and MovementSync;
- creates the `/var/lib/xinbot-box-manager` data directory; and
- installs, enables, and starts `xinbot-box-manager.service`.

After installation, open `http://DEVICE_IP:8080`. The first visit prompts you to create an
administrator account.

## Building the package from source

The build host requires Debian or Ubuntu, Rust stable, `dpkg-deb`, and `sha256sum`. By default, an
internet connection is also required to download the pinned XinBot Core and plugin versions:

```shell
git clone https://github.com/newPlayerAL/xinbot-box-manager.git
cd xinbot-box-manager
./scripts/build-deb.sh
sudo apt install ./dist/xinbot-box-manager_0.1.0_$(dpkg --print-architecture).deb
```

Every external JAR is verified against the SHA-256 value in
`packaging/bundle-resources.tsv`. These binaries are not committed to the repository.

### Offline builds

If you have already prepared JAR files matching the hashes in the resource manifest, specify their
local directory:

```shell
./scripts/build-deb.sh --resources /path/to/verified-resources
```

### ARM64 cross-compilation

After installing the appropriate Rust target and cross-compiler, run:

```shell
./scripts/build-deb.sh --target aarch64-unknown-linux-gnu
```

This produces an `arm64` package. You can also build natively on an ARM64 Linux system.

## Service and directories

The main paths are:

| Purpose | Path |
| --- | --- |
| Service configuration | `/etc/default/xinbot-box-manager` |
| Data and instances | `/var/lib/xinbot-box-manager` |
| Core and plugin resources | `/var/lib/xinbot-box-manager/resources` |
| systemd service | `xinbot-box-manager.service` |

After changing the listen address, directories, or secure cookie setting, run:

```shell
sudo systemctl restart xinbot-box-manager
```

Common service commands:

```shell
sudo systemctl status xinbot-box-manager
sudo journalctl -u xinbot-box-manager -f
```

Uninstalling or purging the package does not automatically remove
`/var/lib/xinbot-box-manager`, preventing accidental deletion of instances, passwords, and
configuration.

## Resetting a forgotten administrator password

Run the following command from the Linux console:

```shell
sudo /usr/bin/xinbot-box-manager admin reset-password \
  --data-dir /var/lib/xinbot-box-manager
```

The password is entered without terminal echo and is not included in command-line arguments. After
the reset, existing web sessions expire on their next request. Restarting the service is not
required.

## Data directory

```text
/var/lib/xinbot-box-manager/
├── auth.json          # Administrator password hash
├── settings.json      # Java, Core, and resource settings
├── profiles/          # Instance profiles
├── instances/         # Instance working directories, configuration, and plugin settings
├── trash/             # Recoverably deleted instances
└── audit.log          # Local password-reset records; contains no passwords
```

Minecraft login passwords must be stored in the local instance configuration for unattended
startup. Keep the data directory accessible only to the dedicated system user.

## Network security

The management interface listens on local-network HTTP by default. When accessing it from an
untrusted network, place it behind a trusted HTTPS reverse proxy or VPN and enable
`XINBOT_BOX_SECURE_COOKIE=true`.
