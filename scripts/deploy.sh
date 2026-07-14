#!/usr/bin/env bash
set -euo pipefail

# 用法:
#   DEPLOY_HOST=124.221.150.24 DEPLOY_USER=root ./scripts/deploy.sh
# 或先复制 deploy.env.example 为 deploy.env 并填写后:
#   source deploy.env && ./scripts/deploy.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

DEPLOY_HOST="${DEPLOY_HOST:-}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/three-city}"
SSH_KEY="${SSH_KEY:-}"

if [[ -f "$ROOT_DIR/deploy.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/deploy.env"
fi

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "请设置 DEPLOY_HOST，例如:"
  echo "  DEPLOY_HOST=124.221.150.24 ./scripts/deploy.sh"
  exit 1
fi

SSH_OPTS=(-p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh ${SSH_OPTS[*]}"
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS+=(-i "$SSH_KEY")
  RSYNC_SSH="ssh -i $SSH_KEY ${SSH_OPTS[*]}"
fi

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

echo "==> 本地构建..."
if command -v yarn >/dev/null 2>&1; then
  yarn build
else
  npm run build
fi

echo "==> 创建远程目录 ${DEPLOY_PATH} ..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "sudo mkdir -p '$DEPLOY_PATH' && sudo chown -R ${DEPLOY_USER}:${DEPLOY_USER} '$DEPLOY_PATH'"

echo "==> 上传 .output/public/ 到服务器..."
rsync -avz --delete -e "$RSYNC_SSH" \
  "$ROOT_DIR/.output/public/" \
  "${REMOTE}:${DEPLOY_PATH}/"

echo "==> 部署完成"
echo "    若已配置 Nginx，访问: http://${DEPLOY_HOST}/"
echo "    若未配置，可先在服务器执行: ./scripts/server-init.sh"
