#!/usr/bin/env bash
set -euo pipefail

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"

target=""
if [[ ${1:-} == "--target" ]]; then
    if [[ -z ${2:-} ]]; then
        echo "--target requires a Rust target triple" >&2
        exit 2
    fi
    target=$2
    shift 2
fi
if (( $# != 0 )); then
    echo "usage: $0 [--target RUST_TARGET]" >&2
    exit 2
fi

command -v cargo >/dev/null || {
    echo "cargo is required to build the package" >&2
    exit 1
}
command -v dpkg-deb >/dev/null || {
    echo "dpkg-deb is required to build the package" >&2
    exit 1
}

version=$(sed -n 's/^version = "\([^"]*\)"/\1/p' Cargo.toml | head -n 1)
if [[ -z $version ]]; then
    echo "unable to read the package version from Cargo.toml" >&2
    exit 1
fi

if [[ -n $target ]]; then
    cargo build --release --locked --target "$target"
    binary="target/$target/release/xinbot-box-manager"
    case "$target" in
        aarch64-*-linux-*) architecture=arm64 ;;
        x86_64-*-linux-*) architecture=amd64 ;;
        armv7*-linux-*) architecture=armhf ;;
        i686-*-linux-*) architecture=i386 ;;
        *)
            echo "unsupported Debian architecture for Rust target: $target" >&2
            exit 1
            ;;
    esac
else
    cargo build --release --locked
    binary="target/release/xinbot-box-manager"
    architecture=$(dpkg --print-architecture)
fi

if [[ ! -x $binary ]]; then
    echo "compiled binary not found: $binary" >&2
    exit 1
fi

mkdir -p dist
staging_dir=$(mktemp -d "target/deb-staging.${architecture}.XXXXXX")
chmod 0755 "$staging_dir"

install -Dm0755 "$binary" "$staging_dir/usr/bin/xinbot-box-manager"
install -Dm0644 \
    packaging/xinbot-box-manager.service \
    "$staging_dir/lib/systemd/system/xinbot-box-manager.service"
install -Dm0644 \
    packaging/deb/xinbot-box-manager.default \
    "$staging_dir/etc/default/xinbot-box-manager"
install -Dm0644 \
    resources/catalog.json \
    "$staging_dir/usr/share/xinbot-box-manager/resources/catalog.json"
install -Dm0644 README.md "$staging_dir/usr/share/doc/xinbot-box-manager/README.md"
install -Dm0644 LICENSE "$staging_dir/usr/share/doc/xinbot-box-manager/copyright"

install -Dm0755 packaging/deb/postinst "$staging_dir/DEBIAN/postinst"
install -Dm0755 packaging/deb/prerm "$staging_dir/DEBIAN/prerm"
install -Dm0755 packaging/deb/postrm "$staging_dir/DEBIAN/postrm"
install -Dm0644 packaging/deb/conffiles "$staging_dir/DEBIAN/conffiles"
sed \
    -e "s/@VERSION@/$version/g" \
    -e "s/@ARCHITECTURE@/$architecture/g" \
    packaging/deb/control.in >"$staging_dir/DEBIAN/control"

package_path="dist/xinbot-box-manager_${version}_${architecture}.deb"
dpkg-deb --root-owner-group --build "$staging_dir" "$package_path"
echo "created $package_path"
echo "staging directory retained at $staging_dir (cargo clean removes build staging data)"
