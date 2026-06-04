#!/usr/bin/env bash
# 在 Ubuntu 服务器上执行（首次部署前运行一次）
# ssh ubuntu@124.221.150.24 'bash -s' < scripts/server-init.sh

set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/my-project/nginx/html}"
NGINX_SITE="/etc/nginx/sites-available/three-city"

echo "==> 安装 Nginx..."
sudo apt-get update
sudo apt-get install -y nginx rsync

echo "==> 创建站点目录..."
sudo mkdir -p "$DEPLOY_PATH"

echo "==> 写入 Nginx 配置..."
sudo tee "$NGINX_SITE" > /dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root ${DEPLOY_PATH};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|glb|gltf)\$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
}
EOF

sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/three-city
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

echo "==> 检查并重载 Nginx..."
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "==> 服务器初始化完成"
echo "    Nginx 根目录: $DEPLOY_PATH"
echo "    本地执行 gulp deploy 上传并同步后即可访问"
