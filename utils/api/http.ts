/** 统一调用 Java `/api/**`（开发走 Vite 代理） */

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

function apiToken(): string {
  const config = useRuntimeConfig()
  return (config.public.apiToken as string) || ''
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  const token = apiToken()
  if (token) headers.set('X-API-Token', token)
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (v) headers.set(k, v)
    }
  }

  const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { ...init, headers })
  const json = (await res.json().catch(() => null)) as ApiResult<T> | null
  if (!res.ok || !json || json.code !== 0) {
    const msg = json?.message || `请求失败 (${res.status})`
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
  const token = apiToken()
  if (token) headers.set('X-API-Token', token)
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
    throw new Error(msg)
  }
  return json.data
}
