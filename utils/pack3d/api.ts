import { apiFetch, apiUpload } from '~/utils/api/http'
import type { SoftPackDims } from '~/utils/pack3d/softPackMesh'

export type { SoftPackDims }

export type SoftPackTaskAccepted = {
  taskId: string
  status: string
}

export type SoftPackTaskStatus = {
  taskId: string
  status: 'RUNNING' | 'DONE' | 'FAILED' | 'UNKNOWN' | string
  dims: SoftPackDims | null
  message: string | null
  spatialDocument: string | null
}

export async function submitAnalyze(file: File): Promise<SoftPackTaskAccepted> {
  const form = new FormData()
  form.append('file', file)
  return apiUpload<SoftPackTaskAccepted>('/api/package/analyze', form)
}

export async function fetchTaskStatus(taskId: string): Promise<SoftPackTaskStatus> {
  return apiFetch<SoftPackTaskStatus>(`/api/package/tasks/${encodeURIComponent(taskId)}`)
}

/** 开发态直连 Java:8787；生产走同域 /ws/package（JWT 走 Sec-WebSocket-Protocol）。 */
export function packageWsUrl(): string {
  const config = useRuntimeConfig()
  const explicit =
    String(config.public.wsOrigin || '').trim() ||
    String(config.public.apiOrigin || '').trim()

  if (explicit) {
    const u = new URL(explicit)
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${u.host}/ws/package`
  }
  if (import.meta.dev) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const port = String(config.public.devBackendPort || '8787')
    return `${proto}//${location.hostname}:${port}/ws/package`
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}/ws/package`
}

export function packageWsAuthProtocols(): string[] | undefined {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()
  const token = auth.accessToken || ''
  if (!token) return undefined
  return ['fp.jwt', token]
}
