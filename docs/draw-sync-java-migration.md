# 你画我猜 · draw-sync 从 Node.js 迁移到 Java

> 目标：用 **Spring Boot** 实现与现有 `server/draw-sync.cjs` **行为一致** 的 HTTP API，前端 `src/draw/sync.ts` **无需改协议**（仅改代理端口或环境变量）。

---

## 1. 迁移范围

| 包含 | 不包含 |
|------|--------|
| 房间内存表、轮询同步、在线状态 | CAD 转换（`cad-convert`，另项目） |
| 3 个 API：`GET` 房间、`POST` state、`POST` guess | WebSocket（前端未使用） |
| CORS、OPTIONS、房间 TTL 清理 | 数据库持久化 |

**前端依赖文件（不要改协议，除非 Java 已对齐）：**

- `src/draw/sync.ts` — API 客户端  
- `src/draw/types.ts` — `DrawSyncState` 结构  
- `src/views/draw/index.vue` — 游戏逻辑  

**Node 参考实现：**

- `server/draw-sync.cjs`

---

## 2. 业务说明（读代码前先看）

### 2.1 角色

| 角色 | 请求头 `X-Draw-Role` | 职责 |
|------|----------------------|------|
| 画者（Host） | `host` | `POST /state` 推送画板快照；`GET` 拉取猜词 |
| 猜者（Guest） | `guest` | `GET` 拉取画板；`POST /guess` 提交猜测 |

房间号：**6 位数字**，正则 `^\d{6}$`（如 `482913`）。

### 2.2 同步模型（HTTP 轮询，无 WebSocket）

```
画者浏览器                         Java 服务                         猜者浏览器
    | POST /state (约 60ms 节流)  ----->  room.state = body              |
    | GET /state (400ms)          <-----  guesses[] (清空给 host)        |
    |                                 guestOnline / hostOnline           |
    |                                    ^                               |
    |                                    | GET (200ms)                   |
    |                                    +-------------------------------+
    |                                    | POST /guess                   |
```

### 2.3 在线判断（必须一致）

每次 `GET /api/draw/:roomId` 时：

- 若 `X-Draw-Role: guest` → 更新 `guestAt = now`
- 若 `X-Draw-Role: host` → 更新 `hostAt = now`

响应中：

- `guestOnline = (now - guestAt) < 6000`
- `hostOnline = (now - hostAt) < 6000`

### 2.4 猜词队列（易错点）

- 猜者 `POST /guess` → 向房间 `guesses` 列表追加 `{ text, at }`
- 画者 `GET` 且 `role=host` 时：
  - 返回当前队列中所有 guess（**仅 `text` 字段给前端即可**，见下节 JSON）
  - **返回后清空队列**（Node 用 `guesses.splice(0)`，即「消费型」队列）
- 猜者 `GET` 时：**始终返回 `guesses: []`**

### 2.5 房间生命周期

- 房间首次访问时自动创建（懒加载）
- 任意请求更新 `updatedAt`
- **30 分钟**无活动删除房间（`TTL_MS = 30 * 60 * 1000`）
- 后台每 **60 秒**扫描清理（可用 `@Scheduled`）

### 2.6 请求体限制

- JSON body 最大 **512000** 字符（Node 按字符串长度计；Java 建议限制请求体 **512 KB**）

---

## 3. HTTP API 契约（与前端严格一致）

基址：`/api/draw`  
生产：Nginx 反代到 Java 进程（默认端口 **8787**，**路径不变**）。

### 3.1 通用

| 项 | 值 |
|----|-----|
| CORS `Access-Control-Allow-Origin` | 请求头 `Origin`，无则 `*` |
| CORS Methods | `GET, POST, OPTIONS` |
| CORS Headers | `Content-Type, X-Draw-Role` |
| OPTIONS | 返回 **204**，无 body |
| 错误 JSON | `{ "error": "说明" }` |
| 成功 POST | `{ "ok": true }` |
| Cache-Control | `no-store` |

### 3.2 GET `/api/draw/{roomId}`

**请求头**

| Header | 必填 | 说明 |
|--------|------|------|
| `X-Draw-Role` | 建议 | `host` 或 `guest` |

**响应 200**

```json
{
  "state": null,
  "guesses": [],
  "guestOnline": false,
  "hostOnline": false
}
```

- `state`：画者最后一次 `POST /state` 的 JSON 对象，结构见第 4 节；未推送过为 `null`
- `guesses`：仅 host 角色返回累积项并清空；guest 恒为 `[]`
- 猜词项前端只读 `text`：`{ "text": "太阳" }`（可有 `at`，前端忽略）

**错误**

| 状态 | 条件 |
|------|------|
| 400 | 房间号非 6 位数字 |
| 404 | 路径不匹配 |

### 3.3 POST `/api/draw/{roomId}/state`

**Body**：完整 `DrawSyncState` JSON（见第 4 节）

**行为**

- `room.state = body`（整体替换，非 merge）
- `hostAt = now`，`updatedAt = now`

**响应**：`200` + `{ "ok": true }`

### 3.4 POST `/api/draw/{roomId}/guess`

**Body**

```json
{ "text": "相机" }
```

**行为**

- `text` 去首尾空格，空串 → `400` `{ "error": "empty guess" }`
- `guesses.add({ text, at: epochMilli })`
- `guestAt = now`，`updatedAt = now`

**响应**：`200` + `{ "ok": true }`

### 3.5 路径一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/draw/{roomId}` | 轮询 |
| POST | `/api/draw/{roomId}/state` | 画者推送 |
| POST | `/api/draw/{roomId}/guess` | 猜者猜词 |

`roomId` 必须匹配 `\d{6}`。

---

## 4. 数据模型

### 4.1 DrawSyncState（与前端 `src/draw/types.ts` 一致）

Java 可用 `Map<String, Object>` 或 POJO + `@JsonIgnoreProperties(ignoreUnknown = true)`，**不要**在服务端强校验每个字段，避免前端升级字段时接口报错。

```typescript
// 前端类型（对照用）
interface DrawSyncState {
  strokes: DrawStroke[]
  activeStroke: DrawStroke | null
  phase: 'idle' | 'playing' | 'roundEnd' | 'finished'
  round: number
  maxRounds: number
  drawerScore: number
  guesserScore: number
  timeLeft: number
  word?: string
  lastResult?: DrawRoundResult | null
}
```

### 4.2 服务端房间内存结构

```java
// 逻辑结构（非必须照抄类名）
class Room {
    Object state;              // JsonNode 或 Map，POST /state 原样存
    List<Guess> guesses;       // 线程安全列表
    long guestAt;              // 毫秒时间戳，0 表示从未
    long hostAt;
    long updatedAt;
}

class Guess {
    String text;
    long at;
}
```

**存储**：`ConcurrentHashMap<String, Room> rooms`（key = roomId）。

---

## 5. Spring Boot 实现指南

### 5.1 项目依赖（Maven）

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
</dependency>
```

可选：`spring-boot-starter-validation`（校验 roomId）。

### 5.2 推荐包结构

```text
com.yourname.threecity
  ThreeCityApplication.java
  draw/
    DrawSyncController.java      # REST 映射
    DrawRoomService.java         # 房间 CRUD、在线、guess 队列
    DrawRoom.java                # 实体
    DrawGuess.java
    DrawSyncProperties.java      # TTL、在线阈值、端口
    DrawRoomCleanupTask.java     # @Scheduled 清理
  config/
    DrawCorsConfig.java          # 或全局 WebMvcConfigurer
```

### 5.3 Controller 映射示例

```java
@RestController
@RequestMapping("/api/draw")
public class DrawSyncController {

    private final DrawRoomService rooms;

    @GetMapping("/{roomId}")
    public RoomPollResponse poll(
            @PathVariable String roomId,
            @RequestHeader(value = "X-Draw-Role", defaultValue = "") String role) {
        rooms.validateRoomId(roomId);
        return rooms.poll(roomId, role);
    }

    @PostMapping("/{roomId}/state")
    public Map<String, Boolean> postState(
            @PathVariable String roomId,
            @RequestBody JsonNode state) {
        rooms.validateRoomId(roomId);
        rooms.updateState(roomId, state);
        return Map.of("ok", true);
    }

    @PostMapping("/{roomId}/guess")
    public Map<String, Boolean> postGuess(
            @PathVariable String roomId,
            @RequestBody GuessRequest body) {
        rooms.validateRoomId(roomId);
        rooms.addGuess(roomId, body.getText());
        return Map.of("ok", true);
    }
}
```

### 5.4 核心逻辑：`poll`（对齐 Node）

```java
public RoomPollResponse poll(String roomId, String role) {
    Room room = getOrCreate(roomId);
    long now = System.currentTimeMillis();
    room.setUpdatedAt(now);

    if ("guest".equals(role)) {
        room.setGuestAt(now);
    } else if ("host".equals(role)) {
        room.setHostAt(now);
    }

    List<GuessDto> guessesOut = List.of();
    if ("host".equals(role)) {
        guessesOut = room.drainGuesses(); // 取出并清空
    }

    return new RoomPollResponse(
        room.getState(),
        guessesOut,
        now - room.getGuestAt() < 6000,
        now - room.getHostAt() < 6000
    );
}
```

`drainGuesses()` 示例：

```java
public synchronized List<GuessDto> drainGuesses() {
    if (guesses.isEmpty()) return List.of();
    List<GuessDto> copy = guesses.stream()
        .map(g -> new GuessDto(g.getText()))
        .toList();
    guesses.clear();
    return copy;
}
```

> 房间对象需对 `guesses` 与 `state` 写操作加锁，或使用 `ConcurrentHashMap` + 同步块，避免并发 GET/POST 竞态。

### 5.5 定时清理

```java
@Scheduled(fixedRate = 60_000)
public void evictExpiredRooms() {
    long now = System.currentTimeMillis();
    long ttl = 30 * 60 * 1000L;
    rooms.entrySet().removeIf(e -> now - e.getValue().getUpdatedAt() > ttl);
}
```

启动类加 `@EnableScheduling`。

### 5.6 CORS

与 Node 一致，允许 `X-Draw-Role`：

```java
@Configuration
public class DrawCorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/draw/**")
            .allowedOriginPatterns("*")
            .allowedMethods("GET", "POST", "OPTIONS")
            .allowedHeaders("Content-Type", "X-Draw-Role");
    }
}
```

### 5.7 配置 `application.yml`

```yaml
server:
  port: 8787   # 与 Node 相同则 Nginx 不用改端口

draw:
  room-id-pattern: "^\\d{6}$"
  online-threshold-ms: 6000
  room-ttl-ms: 1800000
  max-body-bytes: 524288
```

---

## 6. 与 Node 行为对照表

| 行为 | Node (`draw-sync.cjs`) | Java 必须 |
|------|------------------------|-----------|
| 房间号 | `/^\d{6}$/` | 相同 |
| GET 更新在线 | guest/host 各更新 `*At` | 相同 |
| 在线阈值 | 6000 ms | 6000 ms |
| host GET guesses | `splice(0)` 清空 | Drain 后清空 |
| guest GET guesses | `[]` | `[]` |
| POST state | 整体赋值 `room.state = body` | 相同 |
| POST guess 空文本 | 400 `empty guess` | 相同 |
| 房间 TTL | 30 min | 30 min |
| 清理周期 | 60 s | 60 s |
| Body 上限 | 512000 字符 | ≤ 512 KB |
| 端口默认 | `DRAW_SYNC_PORT` 8787 | 建议先沿用 8787 |

---

## 7. 本地联调

### 7.1 Java 启动后

```bash
# 健康：能返回 JSON
curl -s http://127.0.0.1:8787/api/draw/123456 -H 'X-Draw-Role: guest' | jq .

# 画者推送 state
curl -s -X POST http://127.0.0.1:8787/api/draw/123456/state \
  -H 'Content-Type: application/json' \
  -d '{"strokes":[],"activeStroke":null,"phase":"playing","round":1,"maxRounds":5,"drawerScore":0,"guesserScore":0,"timeLeft":90}'

# 猜者猜词
curl -s -X POST http://127.0.0.1:8787/api/draw/123456/guess \
  -H 'Content-Type: application/json' \
  -d '{"text":"测试"}'

# 画者拉 guess（应有 text，且第二次为空）
curl -s http://127.0.0.1:8787/api/draw/123456 -H 'X-Draw-Role: host' | jq .guesses
curl -s http://127.0.0.1:8787/api/draw/123456 -H 'X-Draw-Role: host' | jq .guesses
```

### 7.2 前端后端开发地址

项目根目录 `.env.development`（已提交）：

```bash
# Vite 把 /api/* 代理到 Java
VITE_BACKEND_URL=http://127.0.0.1:8787
VITE_API_ORIGIN=
```

- 本机开发：保持 `VITE_API_ORIGIN` 为空，前端请求 `/api/draw/...`，由 Vite 转发到 `VITE_BACKEND_URL`。
- 手机/平板联调：新建 `.env.development.local`，设置  
  `VITE_API_ORIGIN=http://<电脑局域网IP>:8787`（与 Java 端口一致）。

若 Java 改用其他端口，只改 `VITE_BACKEND_URL`；**无需改** `src/draw/sync.ts`（使用 `src/config/api.ts`）。

详见 `.env.example`。

### 7.3 停掉 Node，避免端口冲突

```bash
# 不要同时跑
npm run draw-sync   # Node，迁移完成后停用
java -jar three-city-api.jar
```

---

## 8. 生产部署变更

### 8.1 Nginx（路径不变，只换上游）

原 Node：

```nginx
proxy_pass http://127.0.0.1:8787/api/draw/;
```

默认 upstream 为 **8787**（与 Node draw-sync 一致）：

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

### 8.2 进程管理（替代 pm2 + draw-sync.cjs）

```bash
# systemd 示例
java -jar /opt/three-city/three-city-api.jar \
  --server.port=8787
```

停用旧服务：

```bash
pm2 delete draw-sync
```

### 8.3 验证清单

- [ ] `curl http://127.0.0.1:8787/api/draw/123456 -H 'X-Draw-Role: guest'` 返回 JSON  
- [ ] 浏览器打开 `/api/draw/123456` 非 502  
- [ ] 标签页 A：创建房间 → 作画  
- [ ] 标签页 B：加入房间 → 能看到笔画  
- [ ] B 猜词后 A 能计分  
- [ ] A 显示「猜者已连接」/ B 显示「正在同步画板」  

---

## 9. 迁移步骤建议

1. **新建 Spring Boot 模块**，先实现 `GET` + 空房间，用 curl 对照 Node 响应。  
2. 实现 `POST /state`、`POST /guess`，单元测试 `drainGuesses` 只消费一次。  
3. 加 `@Scheduled` TTL、CORS、OPTIONS。  
4. 本地 `npm run dev`，Java 占 8787，双标签页联机测试。  
5. 生产切换 Nginx 上游或端口，停 `pm2 draw-sync`。  
6. 文档标注 Node 服务已废弃（可保留 `draw-sync.cjs` 作对照一段时间）。

---

## 10. 常见问题

| 现象 | 原因 | 处理 |
|------|------|------|
| 猜者看不到画 | state 未 POST 或 GET 未轮询 | 查 Java 日志、Network 里 `/state` 是否 200 |
| 画者收不到猜词 | host GET 未 drain 或 role 头错误 | 确认 `X-Draw-Role: host` |
| 永远「未连接」 | 在线 6s 阈值；轮询停止 | 确认 guest/host 轮询间隔与 Node 一致 |
| 502 | Java 未启动或端口错 | `ss -lntp \| grep 8787` |
| CORS 错误 | 未允许 `X-Draw-Role` | 检查 CORS 配置 |

---

## 11. 后续扩展（Java 版可选）

与 `docs/draw-game.md` 第 12 节相同，迁移稳定后再做：

- WebSocket / SSE 降低延迟  
- `hostSecret` 防恶意 POST  
- Redis + 多实例  
- 猜词列表只传 `text` 的序列化优化  

---

## 12. 参考文件索引

| 文件 | 说明 |
|------|------|
| `server/draw-sync.cjs` | Node 实现（迁移对照源码） |
| `src/draw/sync.ts` | 前端调用方式、轮询间隔 |
| `src/draw/types.ts` | `DrawSyncState` 字段 |
| `src/views/draw/index.vue` | 游戏流程、节流广播 |
| `docs/draw-game.md` | 产品与技术总览 |
| `deploy/nginx-draw-sync.conf` | Nginx 片段 |
| `vite.config.ts` | 开发代理 `/api/draw` |

---

**文档版本**：与仓库 `draw-sync.cjs`（8787 / TTL 30min / 在线 6s）对齐。  
若 Java 实现有 deliberate 差异，请在本文件第 6 节表格中注明并同步前端。
