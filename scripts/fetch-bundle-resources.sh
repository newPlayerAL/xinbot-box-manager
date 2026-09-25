#!/usr/bin/env bash
set -euo pipefail

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"

output_dir=${1:-target/bundle-resources}
mkdir -p "$output_dir"

for command_name in curl sha256sum; do
    command -v "$command_name" >/dev/null || {
        echo "$command_name is required to fetch bundled resources" >&2
        exit 1
    }
done

while IFS=$'\t' read -r file component_version checksum download_url source_url license; do
    if [[ -z $file || $file == \#* ]]; then
        continue
    fi

    destination="$output_dir/$file"
    if [[ -f $destination ]] && printf '%s  %s\n' "$checksum" "$destination" | sha256sum --check --status; then
        echo "verified $file ($component_version)"
        continue
    fi

    partial="$output_dir/$file.download"
    echo "downloading $file ($component_version) from $source_url"
    curl \
        --fail \
        --location \
        --retry 3 \
        --silent \
        --show-error \
        "$download_url" \
        --output "$partial"

    if ! printf '%s  %s\n' "$checksum" "$partial" | sha256sum --check --status; then
        echo "checksum mismatch for $file; downloaded file retained at $partial" >&2
        exit 1
    fi
    mv -- "$partial" "$destination"
    echo "verified $file ($license)"
done <packaging/bundle-resources.tsv

echo "bundled resources are ready in $output_dir"
