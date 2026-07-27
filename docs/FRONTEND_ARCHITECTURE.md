# three-city 前端架构

与后端 `docs/ARCHITECTURE.md` 对齐的双轨前端约定。

## 目录

```
pages/tools/*           工具舱（匿名）
pages/console/*         管控台（JWT + 模块）
pages/admin/*           超管 ACCOUNT
components/<domain>/    域 UI（禁止跨域巨型耦合）
utils/<domain>/         api / types / 纯函数
stores/                 扁平 Pinia
middleware/auth.global.ts
```

## 双轨 API

| 轨 | HTTP | WS |
|----|------|-----|
| 工具 | `utils/fieldpulse/api.ts` → `/api/fieldpulse` | `/ws/fieldpulse` |
| 管控 | `utils/console/fieldpulseApi.ts` → `/api/console/fieldpulse` | `/ws/console/fieldpulse` |

禁止 `NUXT_PUBLIC_API_TOKEN`。

## 组态

`stores/scadaDoc`：仅内存草稿 + `GET/PUT /api/console/fieldpulse/scada`（数据库唯一真相）。
多窗口：服务端 `revision` 乐观锁 + `BroadcastChannel` / 焦点重载；已删除 localStorage。

## 规范

1. 单 SFC 目标 &lt; 400 行；超大文件拆 Bar / Panel / composable  
2. Page 只编排；逻辑进 composable / utils  
3. Three.js 不进 Vue 响应式；预算见 `utils/web3d/performanceBudget.ts`  
4. Admin Element Plus 仅 `/admin` 懒加载  
5. 关闭路由 prefetch（见 `nuxt.config.ts`）

## 拆分进度

| 文件 | 状态 |
|------|------|
| FieldPulseCabinBar | ✅ 工具条 |
| FieldPulseCabinConn | ✅ 连接面板 |
| FieldPulseCabin 主体 | 继续拆 Tags / Live |
| WS 凭证 | ✅ `Sec-WebSocket-Protocol: fp.jwt`（不再拼 Query） |
| recon.vue / admin/users.vue | 规划中 |
