/** 解析 public/ 下静态资源 URL，兼容子路径部署（Vite base） */
export function resolvePublicUrl(path: string): string {
  const normalized = path.startsWith('/') ? path.slice(1) : path
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${normalized}`
}
