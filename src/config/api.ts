/**
 * 后端 API 地址
 *
 * 开发默认：相对路径 `/api/...`，由 Vite 代理到 `VITE_BACKEND_URL`（见 .env.development）
 * 真机调试：在 .env.development.local 设置 `VITE_API_ORIGIN=http://<电脑局域网IP>:8787`
 */
const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/$/, '') ?? ''

function apiPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return apiOrigin ? `${apiOrigin}${normalized}` : normalized
}

/** 你画我猜同步（可被 VITE_DRAW_SYNC_URL 单独覆盖） */
export const DRAW_SYNC_API =
  (import.meta.env.VITE_DRAW_SYNC_URL as string | undefined)?.replace(/\/$/, '') ||
  apiPath('/api/draw')

/** CAD 大文件预览（work.md：POST /api/v1/cad/preview-large） */
export const CAD_PREVIEW_API =
  (import.meta.env.VITE_CAD_PREVIEW_URL as string | undefined)?.replace(/\/$/, '') ||
  apiPath('/api/v1/cad')

/** Optional server-side LAN scan (GET /api/v1/network/deep-scan) */
export const NETWORK_SCAN_API =
  (import.meta.env.VITE_NETWORK_SCAN_URL as string | undefined)?.replace(/\/$/, '') ||
  apiPath('/api/v1/network')
