#!/usr/bin/env sh
set -eu

source_dir=${1:-../xinbot-gui-win/src-tauri/resources}
target_dir=${2:-resources}

if [ ! -f "$source_dir/catalog.json" ]; then
  echo "插件资源目录无效：$source_dir" >&2
  exit 1
fi

mkdir -p "$target_dir"
cp "$source_dir/catalog.json" "$target_dir/catalog.json"

for resource in \
  xinmetaplugin.jar \
  directconnect.jar \
  chatfilter.jar \
  movementsync.jar \
  backtothebase.jar
do
  if [ -f "$source_dir/$resource" ]; then
    cp "$source_dir/$resource" "$target_dir/$resource"
    echo "已复制 $resource"
  else
    echo "缺少 $resource（目录中会显示为不可用）" >&2
  fi
done
