/** XML multi-language translate API (tag-pack format) */

export type XmlEntry = {
  id: string
  fields: Record<string, string>
}

export type XmlUploadResult = {
  sessionId: string
  filename: string
  entryCount: number
  languageTags: string[]
  suggestedSourceTag: string
  entries: XmlEntry[]
}

export type XmlProgressItem = { id: string; text: string }
export type XmlProgressPayload = {
  progress: string
  data: XmlProgressItem[]
}

export type XmlRow = {
  id: string
  [langTag: string]: string
}

export const MAX_XML_UPLOAD_BYTES = 8 * 1024 * 1024

function apiBase(): string {
  const config = useRuntimeConfig()
  const origin = (config.public.apiOrigin as string) || ''
  return origin.replace(/\/$/, '')
}

function authHeaders(json: boolean): Headers {
  const headers = new Headers()
  if (json) headers.set('Content-Type', 'application/json')
  headers.set('Accept', json ? 'text/event-stream, application/json' : 'application/json')
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()
  if (auth.accessToken) headers.set('Authorization', `Bearer ${auth.accessToken}`)
  return headers
}

export function validateXmlUpload(file: File): string | null {
  const name = (file.name || '').toLowerCase()
  if (!name.endsWith('.xml')) return '仅支持 .xml'
  if (file.size > MAX_XML_UPLOAD_BYTES) return '文件过大，请控制在 8MB 以内'
  return null
}

export async function uploadXmlLedger(file: File): Promise<XmlUploadResult> {
  const bad = validateXmlUpload(file)
  if (bad) throw new Error(bad)
  const { apiUpload } = await import('~/utils/api/http')
  const form = new FormData()
  form.append('file', file)
  return apiUpload<XmlUploadResult>('/api/xml-xlate/upload', form)
}

export type XmlSseHandlers = {
  onProgress?: (p: XmlProgressPayload) => void
  onDone?: () => void
  onError?: (msg: string) => void
}

export async function translateXmlStream(
  body: { sessionId: string; sourceTag: string; targetTag: string; entryIds?: string[] },
  handlers: XmlSseHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${apiBase()}/api/xml-xlate/translate`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `翻译失败 (${res.status})`)
  }
  if (!res.body) throw new Error('浏览器不支持流式响应')

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []
  let settled = false
  let streamError: string | null = null
  let sawTerminalProgress = false

  const finish = async () => {
    if (settled) return
    settled = true
    try {
      await reader.cancel()
    } catch {
      /* ignore */
    }
  }

  const flush = () => {
    if (!dataLines.length) {
      eventName = 'message'
      return
    }
    const raw = dataLines.join('\n')
    dataLines = []
    const name = eventName
    eventName = 'message'
    let data: unknown = raw
    try {
      data = JSON.parse(raw)
    } catch {
      /* keep string */
    }
    if (name === 'progress') {
      const payload = data as XmlProgressPayload
      handlers.onProgress?.(payload)
      const { pct } = parseProgress(payload?.progress || '')
      if (pct >= 100) {
        sawTerminalProgress = true
        // Progress frame already delivered last batch via onProgress above.
        // Do not cancel mid-flush; finish after this event so UI can still finalize coverage.
        handlers.onDone?.()
        void finish()
      }
    } else if (name === 'done') {
      handlers.onDone?.()
      void finish()
    } else if (name === 'error') {
      const msg =
        typeof data === 'string'
          ? data
          : data && typeof data === 'object' && 'message' in data
            ? String((data as { message: unknown }).message)
            : String(data)
      streamError = msg
      handlers.onError?.(msg)
      void finish()
    }
  }

  while (!settled) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() || ''
    for (const line of parts) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
      else if (line === '') flush()
    }
  }
  if (!settled) flush()
  if (!settled && sawTerminalProgress) {
    handlers.onDone?.()
  }
  await finish()
  if (streamError) throw new Error(streamError)
}

export async function exportTranslatedXml(body: {
  sessionId: string
  filenameSuffix?: string
  translationsByTag?: Record<string, Record<string, string>>
}): Promise<Blob> {
  const url = `${apiBase()}/api/xml-xlate/export`
  const headers = authHeaders(true)
  headers.set('Accept', 'application/xml, application/json')
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  if (!res.ok || ct.includes('application/json')) {
    const text = await res.text().catch(() => '')
    let msg = text || `导出失败 (${res.status})`
    try {
      const j = JSON.parse(text) as { message?: string; code?: number }
      if (j?.message) msg = j.message
    } catch {
      /* keep raw */
    }
    throw new Error(msg)
  }
  return res.blob()
}

export function parseProgress(progress: string): { done: number; total: number; pct: number } {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(progress || '')
  if (!m) return { done: 0, total: 0, pct: 0 }
  const done = Number(m[1])
  const total = Number(m[2]) || 1
  return { done, total, pct: Math.min(100, Math.round((done / total) * 100)) }
}

/** Decode XML entities and strip trailing decorative >>> for table display / export payload. */
export function decodeXmlEntities(raw: string): string {
  if (!raw) return ''
  try {
    const decoded = raw
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
        const n = parseInt(h, 16)
        return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : _
      })
      .replace(/&#(\d+);/g, (_, d) => {
        const n = Number(d)
        return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : _
      })
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
    return stripTrailingChevrons(decoded)
  } catch {
    return stripTrailingChevrons(raw)
  }
}

/** Drop trailing runs of 2+ '>' (optional spaces), e.g. 冷冻水>>> → 冷冻水. */
export function stripTrailingChevrons(raw: string): string {
  if (!raw) return ''
  const s = raw.replace(/\s+$/u, '')
  const m = /^(.*?)>{2,}$/u.exec(s)
  if (!m) return s
  return (m[1] || '').replace(/\s+$/u, '')
}

export function entriesToRows(entries: XmlEntry[]): XmlRow[] {
  return entries.map((e) => {
    const row: XmlRow = { id: e.id }
    for (const [k, v] of Object.entries(e.fields || {})) {
      row[k] = decodeXmlEntities(v ?? '')
    }
    return row
  })
}
