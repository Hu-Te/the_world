#!/usr/bin/env bash
# 用 nvm 的 Node 20+/24 跑命令，避免系统 Node 14 启动失败
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Cursor / 全局 npm 有时会注入 prefix，导致 nvm 拒绝切换
unset npm_config_prefix
unset NPM_CONFIG_PREFIX

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
  nvm use --silent >/dev/null 2>&1 || nvm use >/dev/null
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  echo "当前 Node $(node -v)，Nuxt 3 需要 >= 20。"
  echo "请先执行: nvm install 24 && nvm use"
  echo "若出现 nvm prefix 提示: unset npm_config_prefix && npm config delete prefix"
  exit 1
fi

exec "$@"
