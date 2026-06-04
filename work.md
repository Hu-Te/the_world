# Website API 接口文档

Spring Boot 4 单体后端，默认端口 **8787**（可通过环境变量 `SERVER_PORT` 覆盖）。

| 环境 | Base URL 示例 |
|------|----------------|
| 本地开发 | `http://localhost:8787` |
| 生产（腾讯云） | `http://124.221.150.24`（经 Nginx 反代时路径不变） |

**Profile**

| Profile | 数据库 | 说明 |
|---------|--------|------|
| `dev`（默认） | H2 内存 | 本地开发，不碰已有 MySQL |
| `prod` | MySQL `website` | 生产，`SPRING_PROFILES_ACTIVE=prod` |

---

## 模块总览

| 模块 | 前缀 | 说明 |
|------|------|------|
| 用户 | `/api/v1/users` | JPA CRUD |
| AI 聊天 | `/api/v1/chat` | Ollama（需本机/服务器运行 Ollama） |
| 你画我猜同步 | `/api/draw` | 内存房间，兼容原 Node `draw-sync.cjs` |
| CAD 大文件预览 | `/api/v1/cad` | 上传 DWG/DXF 等，CLI 转 SVG 流式返回 |

---

## 通用错误格式

### `/api/v1/users`、`/api/v1/chat` — RFC 7807 ProblemDetail

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "User not found with id: 1",
  "timestamp": "2026-06-04T12:00:00Z"
}
```

校验失败（400）额外带 `errors` 字段：

```json
{
  "status": 400,
  "detail": "Validation failed",
  "timestamp": "...",
  "errors": {
    "username": "Username must be between 3 and 64 characters"
  }
}
```

### `/api/draw` — Node 兼容格式

```json
{ "error": "invalid room id" }
```

### `/api/v1/cad` — ProblemDetail（英文 detail）

| HTTP | 场景 | detail 示例 |
|------|------|-------------|
| 400 | 空文件 | `CAD upload must not be empty` |
| 413 | 超大 | `CAD upload exceeds maximum allowed size of ...` |
| 422 | 转换失败 | `CAD conversion process exited with code 1` |
| 504 | 超时 | `CAD conversion process timed out` |

---

## 1. 用户 API `/api/v1/users`

### 1.1 列表用户

```
GET /api/v1/users
```

**响应 200**

```json
[
  {
    "id": 1,
    "username": "alice",
    "email": "alice@example.com",
    "createdAt": "2026-06-04T10:00:00Z"
  }
]
```

---

### 1.2 获取单个用户

```
GET /api/v1/users/{id}
```

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 404 | 用户不存在 |

---

### 1.3 创建用户

```
POST /api/v1/users
Content-Type: application/json
```

**请求体**

```json
{
  "username": "alice",
  "email": "alice@example.com"
}
```

| 字段 | 约束 |
|------|------|
| `username` | 必填，3–64 字符 |
| `email` | 必填，合法邮箱，最长 128 字符 |

| 状态码 | 说明 |
|--------|------|
| 201 | 创建成功，`Location: /api/v1/users/{id}` |
| 400 | 校验失败 |
| 409 | 用户名或邮箱已存在 |

---

### 1.4 更新用户

```
PUT /api/v1/users/{id}
Content-Type: application/json
```

请求体同创建。

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 404 | 用户不存在 |
| 409 | 用户名/邮箱冲突 |

---

### 1.5 删除用户

```
DELETE /api/v1/users/{id}
```

| 状态码 | 说明 |
|--------|------|
| 204 | 删除成功 |
| 404 | 用户不存在 |

---

## 2. AI 聊天 API `/api/v1/chat`

依赖 Ollama，默认 `http://localhost:11434`，模型 `qwen2.5`（见 `application.yml` / `OLLAMA_BASE_URL`、`OLLAMA_MODEL`）。

### 2.1 发送消息

```
POST /api/v1/chat
Content-Type: application/json
```

**请求体**

```json
{
  "message": "Hello, explain Spring Boot virtual threads."
}
```

| 字段 | 约束 |
|------|------|
| `message` | 必填，最长 8192 字符 |

**响应 200**

```json
{
  "reply": "..."
}
```

| 状态码 | 说明 |
|--------|------|
| 400 | 校验失败 |
| 5xx | Ollama 不可用或模型错误 |

---

## 3. 你画我猜同步 API `/api/draw`

内存态，无数据库；房间号 **6 位数字**。CORS 已开放：`/api/draw/**`，允许头 `Content-Type`、`X-Draw-Role`。

在线判定：最近 **6 秒**内有对应角色轮询即视为在线。房间 **30 分钟**无活动会被清理。

### 3.1 轮询房间状态

```
GET /api/draw/{roomId}
X-Draw-Role: host | guest   （可选，默认空）
```

`roomId` 须匹配 `^\d{6}$`，否则 400 `{ "error": "invalid room id" }`。

**响应 200**（`Cache-Control: no-store`）

```json
{
  "state": { "strokes": [] },
  "guesses": [
    { "text": "apple" }
  ],
  "guestOnline": true,
  "hostOnline": false
}
```

| 字段 | 说明 |
|------|------|
| `state` | 画布 JSON，未设置时为 `null` |
| `guesses` | **仅 host 角色**轮询时返回并清空队列；guest 始终 `[]` |
| `guestOnline` / `hostOnline` | 6 秒内是否有对应角色轮询 |

**curl 示例**

```bash
curl -s "http://localhost:8787/api/draw/123456" \
  -H "X-Draw-Role: guest"
```

---

### 3.2 提交画布状态（host）

```
POST /api/draw/{roomId}/state
Content-Type: application/json
```

**请求体**：任意 JSON 对象（整包替换 `state`）

```json
{
  "strokes": [
    { "x": 10, "y": 20, "color": "#000" }
  ]
}
```

**响应 200**

```json
{ "ok": true }
```

---

### 3.3 提交猜词（guest）

```
POST /api/draw/{roomId}/guess
Content-Type: application/json
```

**请求体**

```json
{
  "text": "apple"
}
```

| 状态码 | 说明 |
|--------|------|
| 200 | `{ "ok": true }` |
| 400 | 空猜词 `{ "error": "empty guess" }` |

---

## 4. CAD 大文件预览 API `/api/v1/cad`

通过 **Java 21 虚拟线程** 调度外部 CLI（默认 `inkscape`），将上传文件转为 **SVG 流式响应**，避免整文件读入 JVM 堆。

| 配置项 | 默认值 | 环境变量 |
|--------|--------|----------|
| 最大上传 | 100 MB | `CAD_MAX_UPLOAD_BYTES` |
| 转换超时 | 600 s | `CAD_PREVIEW_TIMEOUT_SECONDS` |
| CLI 可执行文件 | `inkscape` | `CAD_PREVIEW_EXECUTABLE` |
| 命令模板 | `{executable} {input} --export-type=svg --export-filename {output}` | 见 `application.yml` `cad.preview.command-template` |

生产环境 DWG 建议改用 **OdaFileConverter** 等，仅改配置，无需改 Java 代码。

### 4.1 大文件预览

```
POST /api/v1/cad/preview-large
Content-Type: multipart/form-data
```

| 表单字段 | 说明 |
|----------|------|
| `file` | CAD 源文件（DWG、DXF 等，取决于 CLI 能力） |

**成功响应 200**

- `Content-Type: image/svg+xml`
- Body：SVG 二进制流（`StreamingResponseBody`，低内存）

**curl 示例**

```bash
curl -X POST "http://localhost:8787/api/v1/cad/preview-large" \
  -F "file=@/path/to/drawing.dxf" \
  -o preview.svg
```

**错误响应**：`application/problem+json`（见上文 CAD 错误表）

---

## 5. 部署与运维速查

### 5.1 本地运行

```bash
./gradlew bootRun          # dev + H2，端口 8787
./gradlew clean bootJar    # 打包
```

### 5.2 生产更新 JAR

```bash
# 本机
./gradlew clean bootJar
scp build/libs/website-0.0.1-SNAPSHOT.jar ubuntu@124.221.150.24:/home/ubuntu/website/

# 服务器
sudo systemctl restart website
curl -s http://127.0.0.1:8787/api/draw/123456 -H "X-Draw-Role: guest"
```

### 5.3 生产环境变量示例（`/home/ubuntu/website/website.env`）

```bash
SPRING_PROFILES_ACTIVE=prod
SERVER_PORT=8787
DB_HOST=127.0.0.1
DB_NAME=website
DB_USERNAME=root
DB_PASSWORD=***
SPRING_FLYWAY_ENABLED=false
SPRING_JPA_HIBERNATE_DDL_AUTO=update

# CAD（按需）
CAD_PREVIEW_EXECUTABLE=inkscape
CAD_MAX_UPLOAD_BYTES=104857600
```

### 5.4 Nginx 反代（已存在示例）

- 静态前端：`/` → `three-city` SPA
- 你画我猜：`location /api/draw/` → `http://127.0.0.1:8787/api/draw/`
- CAD / 用户 / 聊天：可按需增加 `location /api/v1/` → `8787`

### 5.5 服务器 CAD 依赖

```bash
sudo apt install inkscape
which inkscape
```

---

## 6. 源码索引

| 路径 | 职责 |
|------|------|
| `controller/UserController.java` | 用户 CRUD |
| `controller/AIController.java` | Ollama 聊天 |
| `draw/controller/DrawSyncController.java` | 你画我猜 |
| `cad/controller/CadPreviewController.java` | CAD 预览 |
| `cad/service/CadCommandPreviewService.java` | ProcessBuilder + 虚拟线程 |
| `exception/GlobalExceptionHandler.java` | v1 通用错误 |
| `draw/exception/DrawExceptionHandler.java` | draw 错误 |
| `cad/exception/CadPreviewExceptionHandler.java` | CAD 错误 |

---

## 7. 接口一览表

| 方法 | 路径 | 模块 |
|------|------|------|
| GET | `/api/v1/users` | 用户 |
| GET | `/api/v1/users/{id}` | 用户 |
| POST | `/api/v1/users` | 用户 |
| PUT | `/api/v1/users/{id}` | 用户 |
| DELETE | `/api/v1/users/{id}` | 用户 |
| POST | `/api/v1/chat` | AI |
| GET | `/api/draw/{roomId}` | 你画我猜 |
| POST | `/api/draw/{roomId}/state` | 你画我猜 |
| POST | `/api/draw/{roomId}/guess` | 你画我猜 |
| POST | `/api/v1/cad/preview-large` | CAD 预览 |

---

*文档与代码同步更新；根路径 `/` 无页面，返回 Whitelabel 404 属正常现象。*
