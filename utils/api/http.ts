/**
 * 统一调用 Java `/api/**`。
 * 已登录则附带用户 JWT（租户隔离）；未登录走主页基础工具匿名调用。
 * 禁止把 APP_API_TOKEN 打进浏览器包（仅现场 Agent / 运维持有）。
 */

export type ApiResult<T> = {
  code: number
  message: string
  data: T
}

function apiBase(): string {
  const config = useRuntimeConfig()
  const origin = (config.public.apiOrigin as string) || ''
  return origin.replace(/\/$/, '')
}

function optionalUserJwt(): string {
  if (!import.meta.client) return ''
  const auth = useAuthStore()
  auth.hydrate()
  return auth.accessToken || ''
}

function isSessionAuthFailure(msg: string, status: number, code?: number): boolean {
  if (status === 401 || code === 401) return true
  // 勿用笼统「已过期」：会误伤「账号使用额度已过期」等业务 403，导致刷新列表被踢回首页
  return /令牌无效|令牌已失效|令牌无效或已过期|未登录或令牌无效|会话不存在或已注销|账号已在其他设备登录|^未登录$|请先登录/.test(
    msg,
  )
}

async function handleAuthFailure(msg: string, status: number, code?: number): Promise<void> {
  const auth = useAuthStore()
  if (auth.accessToken && isSessionAuthFailure(msg, status, code)) {
    const { expireSessionAndGoHome } = await import('~/stores/auth')
    await expireSessionAndGoHome(msg)
  }
}

/** SSE / 非 apiFetch 路径复用：会话失效时踢回首页 */
export async function notifySessionAuthFailure(
  msg: string,
  status: number,
  code?: number,
): Promise<void> {
  await handleAuthFailure(msg, status, code)
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  const jwt = optionalUserJwt()
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`)
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (v) headers.set(k, v)
    }
  }

  const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { ...init, headers })
  const renewed = res.headers.get('X-Access-Token') || res.headers.get('x-access-token')
  if (renewed && import.meta.client) {
    try {
      const { useAuthStore } = await import('~/stores/auth')
      useAuthStore().applyRenewedToken(renewed)
    } catch {
      /* ignore */
    }
  }
  const json = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (!res.ok || !json || json.code !== 0) {
    const msg = json?.message || `请求失败 (${res.status})`
    await handleAuthFailure(msg, res.status, json?.code)
    throw new Error(msg)
  }
  return json.data
}

export async function apiUpload<T>(
  path: string,
  form: FormData,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers = new Headers()
  const jwt = optionalUserJwt()
  if (jwt) headers.set('Authorization', `Bearer ${jwt}`)
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (v) headers.set(k, v)
    }
  }
  const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { method: 'POST', headers, body: form })
  const json = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (!res.ok || !json || json.code !== 0) {
    const msg = json?.message || `上传失败 (${res.status})`
    await handleAuthFailure(msg, res.status, json?.code)
    throw new Error(msg)
  }
  return json.data
}

export function toolRequestUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${apiBase()}${p}`
}

export function toolAuthHeaders(): Record<string, string> {
  const jwt = optionalUserJwt()
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}
