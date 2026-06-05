/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Vite 代理目标，如 http://127.0.0.1:8787 */
  readonly VITE_BACKEND_URL?: string
  /** 前端直连后端根，如 http://192.168.1.232:8787（真机调试） */
  readonly VITE_API_ORIGIN?: string
  readonly VITE_DRAW_SYNC_URL?: string
  readonly VITE_CAD_PREVIEW_URL?: string
  /** Bearer token for /api/v1/cad and /api/v1/network (prod build) */
  readonly VITE_APP_API_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
