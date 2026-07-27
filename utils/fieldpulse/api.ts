import { apiFetch } from '~/utils/api/http'

export type ProtocolType = 'S7' | 'MODBUS' | 'CUSTOM_HEX'
export type S7DataType =
  | 'BOOL' | 'BYTE' | 'WORD' | 'DWORD' | 'INT' | 'DINT' | 'REAL' | 'LREAL' | 'STRING' | 'HEX_RAW'

export type FieldPulseTag = {
  /** 稳定行 ID，禁止用数组下标作 Vue key */
  id: string
  tagKey: string
  address: string
  /** 可手动输入；提交前会规范为大写枚举名 */
  dataType: S7DataType | string
}

export type FieldPulseSession = {
  deviceId: string
  protocolType: ProtocolType
  connected: boolean
  lifecycleState: 'ONLINE' | 'OFFLINE' | 'RECONNECTING'
  host: string
  port: number
  tagCount: number
}

export type FieldPulseAgent = {
  agentId: string
  displayName: string
  connectedAtEpochMs: number
  remoteHost: string
}

export function newTagId(): string {
  return `tag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function s7DeviceId(ip: string, port: number, rack: number, slot: number): string {
  const p = port > 0 ? port : 102
  return `s7:${ip.trim()}:${p}:${rack}:${slot}`
}

function apiBase(): string {
  const config = useRuntimeConfig()
  const origin = (config.public.apiOrigin as string) || ''
  return origin.replace(/\/$/, '')
}

function optionalJwt(): string {
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()
  return auth.accessToken || ''
}

function fieldPulseAuthHeaders(): Record<string, string> {
  const jwt = optionalJwt()
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

function fieldPulseAccessToken(): string {
  return optionalJwt()
}

async function fpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return apiFetch<T>(path, init, fieldPulseAuthHeaders())
}

export async function listAgents(): Promise<FieldPulseAgent[]> {
  return fpFetch<FieldPulseAgent[]>('/api/fieldpulse/agents')
}

export type AgentDownloadProgress = {
  /** 已接收字节 */
  loaded: number
  /** 总字节；服务端未给 Content-Length 时为 null */
  total: number | null
  /** 0–100；未知总量时为 null */
  percent: number | null
  /** connecting | downloading | saving */
  phase: 'connecting' | 'downloading' | 'saving'
}

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export { formatBytes as formatAgentDownloadBytes }

/** 弹窗下载 Agent：默认 Windows 免装 Java 工具包 zip；支持进度回调。 */
export async function downloadAgentPackage(
  platform: 'windows' | 'jar' = 'windows',
  onProgress?: (p: AgentDownloadProgress) => void,
): Promise<{ filename: string; bytes: number }> {
  const filename =
    platform === 'jar' ? 'fieldpulse-agent.jar' : 'fieldpulse-agent-windows.zip'
  onProgress?.({ loaded: 0, total: null, percent: null, phase: 'connecting' })

  const headers = new Headers({ Accept: 'application/octet-stream' })
  for (const [k, v] of Object.entries(fieldPulseAuthHeaders())) {
    headers.set(k, v)
  }
  const q = platform === 'jar' ? '?platform=jar' : '?platform=windows'
  const res = await fetch(`${apiBase()}/api/fieldpulse/agents/download${q}`, { headers })
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok || contentType.includes('application/json')) {
    let msg = `下载失败 (${res.status})`
    try {
      const json = (await res.json()) as { message?: string; code?: number }
      if (json?.message) msg = json.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }

  const totalHeader = res.headers.get('content-length')
  const total = totalHeader ? Number(totalHeader) : NaN
  const knownTotal = Number.isFinite(total) && total > 0 ? total : null

  const reader = res.body?.getReader()
  if (!reader) {
    const blob = await res.blob()
    onProgress?.({
      loaded: blob.size,
      total: blob.size,
      percent: 100,
      phase: 'saving',
    })
    triggerBrowserDownload(blob, filename)
    return { filename, bytes: blob.size }
  }

  const chunks: BlobPart[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value?.byteLength) {
      chunks.push(value)
      loaded += value.byteLength
      const percent =
        knownTotal != null ? Math.min(100, Math.round((loaded / knownTotal) * 100)) : null
      onProgress?.({
        loaded,
        total: knownTotal,
        percent,
        phase: 'downloading',
      })
    }
  }

  onProgress?.({
    loaded,
    total: knownTotal ?? loaded,
    percent: 100,
    phase: 'saving',
  })
  const blob = new Blob(chunks, { type: 'application/octet-stream' })
  triggerBrowserDownload(blob, filename)
  return { filename, bytes: blob.size }
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 稍延后释放，避免部分浏览器尚未开始落盘
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** @deprecated 使用 downloadAgentPackage('windows') */
export async function downloadAgentJar(): Promise<void> {
  await downloadAgentPackage('windows')
}

export async function openSession(body: {
  protocolType: ProtocolType
  host?: string
  port?: number
  rack?: number
  slot?: number
  unitId?: number
  pollIntervalMs?: number
  agentId?: string
  tags: Array<Pick<FieldPulseTag, 'tagKey' | 'address' | 'dataType'>>
}): Promise<FieldPulseSession> {
  return fpFetch<FieldPulseSession>('/api/fieldpulse/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function closeSession(deviceId: string, opts?: { keepalive?: boolean }): Promise<void> {
  await fpFetch<null>(`/api/fieldpulse/sessions/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    keepalive: Boolean(opts?.keepalive),
  })
}

export async function getSession(deviceId: string): Promise<FieldPulseSession> {
  return fpFetch<FieldPulseSession>(`/api/fieldpulse/sessions/${encodeURIComponent(deviceId)}`)
}

export async function s7BatchRead(body: {
  ip: string
  port?: number
  rack?: number
  slot?: number
  deviceId?: string
  agentId?: string
  tags: Record<string, string>
}): Promise<Record<string, unknown>> {
  return fpFetch<Record<string, unknown>>('/api/fieldpulse/s7/batch-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** 双轨 WS：tools=工具舱匿名/可选 JWT；console=管控台强制 JWT+模块 */
export type FieldPulseWsTrack = 'tools' | 'console'

/** 与后端 ApiTokenAuthenticator.WS_JWT_PROTOCOL 对齐 */
export const WS_JWT_PROTOCOL = 'fp.jwt'

/**
 * 浏览器遥测 WS URL（不含 token）。
 * - tools → `/ws/fieldpulse`（首页工具舱）
 * - console → `/ws/console/fieldpulse`（进阶管控，须登录 JWT）
 */
export function wsUrl(track: FieldPulseWsTrack = 'tools'): string {
  const config = useRuntimeConfig()
  const path = track === 'console' ? '/ws/console/fieldpulse' : '/ws/fieldpulse'
  /** 优先 wsOrigin，其次 apiOrigin；开发态无配置时直连 Java:8787（避免 Nuxt 对 /ws Upgrade 404） */
  const explicit =
    String(config.public.wsOrigin || '').trim() ||
    String(config.public.apiOrigin || '').trim()

  if (explicit) {
    const u = new URL(explicit)
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${u.host}${path}`
  }
  if (import.meta.dev) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const port = String(config.public.devBackendPort || '8787')
    return `${proto}//${location.hostname}:${port}${path}`
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${location.host}${path}`
}

/** Sec-WebSocket-Protocol：`fp.jwt` + JWT，避免 Query 泄露 */
export function wsAuthProtocols(): string[] | undefined {
  const token = fieldPulseAccessToken()
  if (!token) return undefined
  return [WS_JWT_PROTOCOL, token]
}

/** 现场 Agent 云端 WS 基址（Token 由 Agent 本机 APP_API_TOKEN 配置，勿写入浏览器）。 */
export function agentCloudWsUrl(): string {
  const config = useRuntimeConfig()
  const explicit =
    String(config.public.wsOrigin || '').trim() ||
    String(config.public.apiOrigin || '').trim()

  let base: string
  if (explicit) {
    const u = new URL(explicit)
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:'
    base = `${proto}//${u.host}/ws/fieldpulse/agent`
  } else if (import.meta.dev) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const port = String(config.public.devBackendPort || '8787')
    base = `${proto}//${location.hostname}:${port}/ws/fieldpulse/agent`
  } else {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    base = `${proto}//${location.host}/ws/fieldpulse/agent`
  }
  return base
}
