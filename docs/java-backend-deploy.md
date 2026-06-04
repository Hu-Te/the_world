# 服务器：停用 Node draw-sync，改用 Java 后端

> 前端仍用 `gulp deploy` 部署静态资源；**你画我猜** API 由 Java 提供，不再运行 `server/draw-sync.cjs`。

---

## 一、在服务器上停止 Node（SSH 登录后执行）

```bash
# 方式 A：使用项目脚本（可从本机 scp 上去，或复制内容）
bash deploy/stop-node-draw-sync.sh

# 方式 B：手动
pm2 delete draw-sync
pm2 save
fuser -k 8787/tcp 2>/dev/null || true

# 确认 8787 已空（或只剩即将启动的 Java）
ss -lntp | grep 8787
```

若曾用 `cad-convert` Node 服务（8788），一并停止：

```bash
pm2 delete cad-convert 2>/dev/null || true
fuser -k 8788/tcp 2>/dev/null || true
```

**说明**：停 Node 后，在 Java 实现 `/api/draw/*` 之前，你画我猜联机会失败，属预期。

---

## 二、部署 Java 后端

### 2.1 端口约定（与前端一致）

| 环境 | 配置 |
|------|------|
| 生产 Java | `server.port=8787`（推荐，与 Nginx 片段一致） |
| 本地 three-city | `.env.development` → `VITE_BACKEND_URL=http://127.0.0.1:8787` |

若 Java 暂时只能用 **8080**，Nginx 里把 `8787` 改成 `8080`，或改 Java 配置为 8787。

### 2.2 上传 jar 并启动（示例）

```bash
# 服务器目录（按你习惯）
sudo mkdir -p /opt/three-city-api
sudo chown ubuntu:ubuntu /opt/three-city-api

# 本机打包后上传，例如：
# scp target/website-0.0.1-SNAPSHOT.jar ubuntu@124.221.150.24:/opt/three-city-api/app.jar
```

**systemd** `/etc/systemd/system/three-city-api.service`：

```ini
[Unit]
Description=Three City Java API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/three-city-api
ExecStart=/usr/bin/java -jar /opt/three-city-api/app.jar --server.port=8787
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable three-city-api
sudo systemctl start three-city-api
sudo systemctl status three-city-api
```

### 2.3 健康检查（必须先过）

```bash
curl -s http://127.0.0.1:8787/api/draw/123456 -H 'X-Draw-Role: guest'
```

应返回 JSON（`state`、`guesses`、`guestOnline`、`hostOnline`），不是 404 Whitelabel。

接口实现见：`docs/draw-sync-java-migration.md`。

---

## 三、Nginx

在站点配置中保留静态站 `try_files`，并加入 API 反代（见 `deploy/nginx-java-api.conf`）：

```nginx
location /api/draw/ {
    proxy_pass http://127.0.0.1:8787/api/draw/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Draw-Role $http_x_draw_role;
    proxy_read_timeout 30s;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

公网验证（把 IP 换成你的）：

```bash
curl -s http://124.221.150.24/api/draw/123456 -H 'X-Draw-Role: guest'
```

---

## 四、部署前端（本机，不再带 Node draw-sync）

```bash
# 仅上传 dist + 同步 Nginx，不再部署 draw-sync.cjs
npm run deploy
# 或
gulp deploy
```

`gulp deploy` 已改为**只部署静态站**，不再执行 `deploy-draw-sync`。

若仍需临时部署旧 Node 服务：

```bash
gulp deploy-draw-sync
```

---

## 五、切换检查清单

- [ ] `pm2 list` 中无 `draw-sync`（或已 stop）
- [ ] `ss -lntp | grep 8787` 为 **java** 进程
- [ ] `curl 127.0.0.1:8787/api/draw/123456` 返回 JSON
- [ ] `curl 公网IP/api/draw/123456` 返回 JSON（非 502）
- [ ] 浏览器打开 `/draw`，创建房间 + 另一设备加入，能同步画板

---

## 六、回滚到 Node（应急）

```bash
pm2 stop three-city-api   # 或 systemctl stop three-city-api
cd /home/ubuntu/three-city-sync
DRAW_SYNC_PORT=8787 pm2 start draw-sync.cjs --name draw-sync
pm2 save
```

---

## 七、与现有 Java 项目（8080 / api/v1）并存

- `GET /api/v1/users` 与 `GET /api/draw/{roomId}` **可同时存在**于同一 Spring Boot。
- 建议统一 `server.port=8787`，或 Nginx 按路径分到不同端口。
- 根路径 `/` 404 正常，无需为浏览器单独做首页。
