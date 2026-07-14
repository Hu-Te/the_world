/**
 * Nuxt server 占位：预渲染期 / 中间件可在此扩展。
 * 业务 API 仍由 Java（8787）提供，Nginx 与 Vite 代理 `/api`。
 */
export default defineEventHandler(() => {
  return { ok: true, service: 'three-city-nuxt' }
})
