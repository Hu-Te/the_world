/** Bearer token for protected Java APIs (/api/v1/cad, /api/v1/network). */
export function getAppApiToken(): string {
  return (import.meta.env.VITE_APP_API_TOKEN as string | undefined)?.trim() ?? ''
}

export function withAppApiAuthHeaders(headers?: HeadersInit): HeadersInit {
  const token = getAppApiToken()
  if (!token) {
    return headers ?? {}
  }

  const merged = new Headers(headers)
  if (!merged.has('Authorization')) {
    merged.set('Authorization', `Bearer ${token}`)
  }
  return merged
}

/** fetch wrapper that attaches Authorization when VITE_APP_API_TOKEN is set. */
export function appApiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: withAppApiAuthHeaders(init.headers),
  })
}
