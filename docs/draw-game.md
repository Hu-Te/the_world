# 你画我猜 — 技术文档

> 路由：`/draw`  
> 栈：Vue 3 + TypeScript + Canvas 2D + Node.js HTTP 同步服务

---

## 1. 功能概述

「你画我猜」支持两种玩法：

| 模式 | 适用场景 | 同步方式 |
|------|----------|----------|
| **创建房间 / 加入房间** | 两台设备、两个浏览器标签页联机 | HTTP 轮询 + 后端 `draw-sync` |
| **同屏模式** | 同一台设备，画者画完再切猜者猜词 | 本地 `strokes` 状态，不跨标签页 |

每轮 90 秒。猜对：猜者 +10 分，画者 +5 分。词库 80+ 词条，支持 5 / 8 / 10 轮。

---

## 2. 架构

```
┌─────────────────┐     POST /state      ┌──────────────────┐
│  画者（Host）    │ ──────────────────► │                  │
│  /draw 前端      │     每 ~60ms 节流    │   draw-sync      │
│                 │ ◄── GET 轮询 400ms ── │   (Node, :8787)  │
└─────────────────┘     收 guesses       │                  │
                                         │   内存房间表      │
┌─────────────────┐     GET 轮询 200ms   │   rooms Map      │
│  猜者（Guest）   │ ◄──────────────────► │                  │
│  /draw 前端      │     POST /guess      └────────┬─────────┘
└─────────────────┘                                │
                                                   │ Nginx 反代
                                                   ▼
                                          /api/draw/*  (80/443)
```

### 设计要点

- **无 WebSocket**：使用 HTTP 短轮询，部署简单，兼容国内静态站点 + Nginx 场景。
- **笔画归一化坐标**：`points` 为 `[x,y,...]`，取值 0–1（相对画布宽高），跨设备显示一致。
- **实时笔迹**：`activeStroke` 随画者 pointermove 一并推送（约 60ms 节流）。
- **房间 TTL**：服务端 30 分钟无活动自动清理。

---

## 3. 目录结构

```
src/
├── views/draw/index.vue          # 游戏主页面（模式选择、HUD、同步调度）
├── components/draw/DrawCanvas.vue # Canvas 画布（笔画渲染、触控/鼠标）
├── draw/
│   ├── types.ts                  # 类型定义
│   ├── sync.ts                   # 前端同步客户端（轮询 + POST）
│   └── words.ts                  # 词库、判题、倒计时常量
server/
└── draw-sync.cjs                 # 后端同步服务（CommonJS，Node 12+）
deploy/
├── nginx-draw-sync.conf          # Nginx 反代片段
└── setup-draw-sync.sh            # 服务器一键启动脚本
```

---

## 4. 数据模型

### DrawStroke（单笔）

```typescript
interface DrawStroke {
  id: string
  points: number[]      // 归一化坐标 [x,y,x,y,...]，范围 0–1
  color: string
  lineWidth: number
  eraser: boolean
}
```

### DrawSyncState（房间快照）

```typescript
interface DrawSyncState {
  strokes: DrawStroke[]
  activeStroke: DrawStroke | null  // 正在绘制中的笔迹
  phase: 'idle' | 'playing' | 'roundEnd' | 'finished'
  round: number
  maxRounds: number
  drawerScore: number
  guesserScore: number
  timeLeft: number
  word?: string                    // 仅 roundEnd 时下发，避免泄露
  lastResult?: DrawRoundResult | null
}
```

---

## 5. HTTP API

基址：`/api/draw`（生产环境由 Nginx 反代到 `127.0.0.1:8787`）

### GET `/api/draw/:roomId`

查询房间状态。

**请求头**

| Header | 值 | 说明 |
|--------|-----|------|
| `X-Draw-Role` | `host` / `guest` | 标识角色，影响在线状态与 guesses 返回 |

**响应**

```json
{
  "state": { /* DrawSyncState | null */ },
  "guesses": [{ "text": "太阳" }],
  "guestOnline": true,
  "hostOnline": true
}
```

- `guesses`：仅 `X-Draw-Role: host` 时返回并清空队列。
- `guestOnline` / `hostOnline`：6 秒内有对应角色请求则为 `true`。

### POST `/api/draw/:roomId/state`

画者推送完整房间快照（JSON body = `DrawSyncState`）。

### POST `/api/draw/:roomId/guess`

猜者提交猜测。

```json
{ "text": "相机" }
```

画者端轮询 GET 时收取 `guesses`，本地用 `isGuessCorrect()` 校验。

### 房间号规则

6 位数字，正则：`/^\d{6}$/`

---

## 6. 前端同步流程

### 画者（host）

1. `createDrawSync('host')` → 生成 6 位 `roomCode`
2. 笔画变化 / 计时器 tick → `scheduleBroadcast()`（60ms 节流）→ `POST /state`
3. 每 400ms `GET` 房间 → 收取猜者 `guesses` → 校验 → `endRound`

### 猜者（guest）

1. 输入房间号，或打开 `?join=123456` 链接
2. `createDrawSync('guest', code)` → 立即 GET 一次，之后每 200ms 轮询
3. 收到 `state` → `applyRemoteState()` → 更新 `strokes` + `remoteActiveStroke`
4. 提交猜测 → `POST /guess`

### 邀请链接

```
http://<域名>/draw?join=482913
```

打开后自动选中「加入房间」并填入房间号。

---

## 7. 画布组件（DrawCanvas）

| Prop | 说明 |
|------|------|
| `strokes` | 已完成笔画（v-model） |
| `previewStroke` | 远端正在绘制的笔迹（猜者只读观看） |
| `readonly` | 猜者模式，禁止绘画 |
| `color` / `lineWidth` / `eraser` | 画者工具 |

| Event | 说明 |
|-------|------|
| `update:strokes` | 一笔结束 |
| `progress` | 绘制中（~40ms 节流），用于同步 `activeStroke` |

`ResizeObserver` 监听容器尺寸变化，归一化坐标保证缩放后重绘正确。

---

## 8. 本地开发

```bash
# 终端 1：同步服务
npm run draw-sync          # 监听 :8787

# 终端 2：前端
npm run dev                # Vite :5173，已配置 /api/draw 代理

# 或一条命令
npm run dev:all
```

`vite.config.ts` 代理：

```typescript
proxy: {
  '/api/draw': { target: 'http://127.0.0.1:8787', changeOrigin: true },
}
```

可选环境变量：

```
VITE_DRAW_SYNC_URL=/api/draw   # 默认即可
```

---

## 9. 生产部署

### 9.1 前端

```bash
npm run deploy    # gulp：build → SFTP 上传 → 同步 Nginx 目录 → 部署 draw-sync
```

`deploy.env` 关键项：

| 变量 | 说明 |
|------|------|
| `DEPLOY_HOST` | 服务器 IP |
| `DEPLOY_PATH` | Nginx 静态根目录 |
| `DRAW_SYNC_PATH` | 同步服务目录，默认 `/home/ubuntu/three-city-sync` |

### 9.2 Nginx 反代

在站点 `server {}` 内加入（见 `deploy/nginx-draw-sync.conf`）：

```nginx
location /api/draw/ {
    proxy_pass http://127.0.0.1:8787/api/draw/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 30s;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 9.3 draw-sync 服务

```bash
cd /home/ubuntu/three-city-sync
bash setup-draw-sync.sh
```

或手动：

```bash
pm2 delete draw-sync 2>/dev/null || true
fuser -k 8787/tcp 2>/dev/null || true
pm2 start draw-sync.cjs --name draw-sync
pm2 save
```

验证：

```bash
pm2 status                                          # online
curl http://127.0.0.1:8787/api/draw/123456 \
  -H 'X-Draw-Role: guest'                            # 返回 JSON
```

---

## 10. 故障排查

| 现象 | 原因 | 处理 |
|------|------|------|
| 502 Bad Gateway | Nginx 反代已配，但 8787 无服务 | 启动 `draw-sync`，检查 `pm2 status` |
| pm2 `errored`，日志 `EADDRINUSE` | 8787 被孤儿进程占用 | `pm2 delete draw-sync && kill -9 $(lsof -t -i:8787) && pm2 start ...` |
| API 正常，画板不同步 | 用了「同屏模式」开两个标签页 | 改用「创建房间 + 加入房间」 |
| 「同步服务未连接」 | POST /state 失败 | 检查 Nginx 反代、draw-sync 是否 online |
| curl 显示 `hostOnline:false` | 正常，尚无画者开房 | 浏览器端创建房间后即有 state |
| 猜者看不到词语 | 设计如此 | 仅 `roundEnd` 时下发 `word` |

### 常用命令

```bash
pm2 logs draw-sync --lines 30      # 查看日志
ss -lntp | grep 8787               # 端口占用
fuser -k 8787/tcp                  # 释放端口
```

---

## 11. 联机测试清单

- [ ] `pm2 status` → `draw-sync` **online**
- [ ] 浏览器访问 `/api/draw/123456` → JSON（非 502）
- [ ] 标签页 A：**创建房间（画者）** → 开始 → 作画
- [ ] 标签页 B：**加入房间（猜者）** → 输入房间号
- [ ] A 显示「猜者已连接」，B 显示「正在同步画板」
- [ ] B 实时看到 A 的笔画
- [ ] B 提交猜测，A 端校验计分

---

## 12. 后续可扩展

- WebSocket / SSE 替代轮询，降低延迟与请求量
- 房间鉴权（hostSecret）防止恶意 POST
- Redis 持久化房间，支持多实例部署
- 多猜者、观战模式
- 笔画增量同步（仅推送 diff 而非全量 state）
