#!/usr/bin/env bash
# 在服务器上运行：bash setup-draw-sync.sh
set -euo pipefail

SYNC_DIR="${DRAW_SYNC_PATH:-/home/ubuntu/three-city-sync}"
PORT="${DRAW_SYNC_PORT:-8787}"
ENTRY="${SYNC_DIR}/draw-sync.cjs"

echo "[1/5] 检查 Node..."
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 node，请先安装 Node 18+："
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "  sudo apt-get install -y nodejs"
  exit 1
fi
echo "Node $(node -v)"

echo "[2/5] 安装 pm2..."
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

echo "[3/5] 释放端口 ${PORT}..."
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti:"${PORT}" | xargs -r kill -9 2>/dev/null || true
fi
sleep 0.5

echo "[4/5] 启动 draw-sync..."
mkdir -p "$SYNC_DIR"
if [ ! -f "$ENTRY" ]; then
  echo "缺少 ${ENTRY}"
  echo "请先在本地执行 npm run deploy，或手动上传 server/draw-sync.cjs"
  exit 1
fi

pm2 delete draw-sync >/dev/null 2>&1 || true
cd "$SYNC_DIR"
DRAW_SYNC_PORT="$PORT" pm2 start draw-sync.cjs --name draw-sync
pm2 save >/dev/null 2>&1 || true

echo "[5/5] 健康检查..."
sleep 1
if curl -sf "http://127.0.0.1:${PORT}/api/draw/123456" -H 'X-Draw-Role: guest' >/dev/null; then
  echo "draw-sync 运行正常 (port ${PORT})"
  pm2 status draw-sync
else
  echo "draw-sync 启动失败，查看日志："
  pm2 logs draw-sync --lines 30 --nostream
  exit 1
fi

echo ""
echo "若浏览器仍 502，请确认 Nginx 已配置 deploy/nginx-draw-sync.conf"
