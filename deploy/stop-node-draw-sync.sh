#!/usr/bin/env bash
# 在服务器上执行：停止 Node draw-sync，释放 8787 端口给 Java
set -euo pipefail

PORT="${DRAW_SYNC_PORT:-8787}"

echo "[1/3] 停止 pm2 进程 draw-sync..."
pm2 delete draw-sync >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true

echo "[2/3] 释放端口 ${PORT}..."
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti:"${PORT}" | xargs -r kill -9 2>/dev/null || true
fi
sleep 0.5

echo "[3/3] 检查端口..."
if ss -lntp 2>/dev/null | grep -q ":${PORT} "; then
  echo "警告: ${PORT} 仍被占用，请手动排查："
  ss -lntp | grep ":${PORT} " || true
  exit 1
fi

echo "Node draw-sync 已停止，端口 ${PORT} 已释放，可启动 Java 后端。"
