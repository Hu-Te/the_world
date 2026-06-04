# CAD 后端转换（DWG → DXF）

浏览器内的 LibreDWG **无法可靠解析** AutoCAD 2018+ 或大型工业 DWG。本站通过 **Node 服务 + ODA File Converter** 在服务端转换后再用前端 CAD 引擎预览 DXF。

## 架构

```text
浏览器上传 .dwg  →  POST /api/cad/convert  →  ODA CLI  →  .dxf  →  前端 HomeCadPreview
```

- 转换结果**不落盘长期保存**，仅在临时目录处理，响应后删除。
- 未配置 ODA 时，DWG 仍走本地解析（能力有限）；DXF 始终本地解析。

## 本地开发

1. 安装 [ODA File Converter](https://www.opendesign.com/guestfiles/oda_file_converter)（Windows / macOS / Linux）。
2. 设置环境变量（示例 macOS）：

```bash
export ODA_CONVERTER_BIN="/Applications/ODAFileConverter.app/Contents/MacOS/ODAFileConverter"
export ODA_OUTPUT_VERSION="ACAD2013"   # 可选，默认 ACAD2013
```

3. 启动服务：

```bash
npm run cad-convert    # 仅转换服务，端口 8788
npm run dev:all        # draw-sync + cad-convert + Vite
```

4. 健康检查：`GET http://127.0.0.1:8788/api/cad/health`  
   返回 `{ "ok": true, "oda": true, "maxBytes": 52428800 }` 表示可用。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/cad/health` | 服务与 ODA 是否就绪 |
| POST | `/api/cad/convert` | 请求体为 DWG 二进制；请求头 `X-File-Name: xxx.dwg`；成功响应 `application/dxf` |

## 生产部署（Ubuntu 示例）

1. 安装 ODA File Converter for Linux，记下可执行文件路径。
2. 使用 systemd 运行 `node server/cad-convert.cjs`，并设置：

```ini
Environment=ODA_CONVERTER_BIN=/opt/oda/ODAFileConverter
Environment=CAD_CONVERT_PORT=8788
Environment=CAD_CONVERT_MAX_BYTES=52428800
Environment=CAD_CONVERT_TIMEOUT_MS=180000
```

3. Nginx 将 `/api/cad` 反向代理到 `127.0.0.1:8788`（与静态站点同域，避免 CORS）。

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `ODA_CONVERTER_BIN` | — | ODA 可执行文件路径（必填才启用转换） |
| `ODA_OUTPUT_VERSION` | `ACAD2013` | 输出版本 |
| `CAD_CONVERT_PORT` | `8788` | 服务端口 |
| `CAD_CONVERT_MAX_BYTES` | `52428800` | 上传上限（50MB） |
| `CAD_CONVERT_TIMEOUT_MS` | `180000` | 单次转换超时 |

## STEP / STP

本服务**仅处理 DWG → DXF**。三维 STEP 需另建管线（如 Open CASCADE / FreeCAD → glTF），不在此模块内。

## 许可说明

ODA File Converter 为 ODA 提供的工具，商用前请阅读其许可条款。
