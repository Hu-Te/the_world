/** LexiCore Ledger Engine API */

export type LedgerEntry = {
  direction: 'D' | 'C' | string
  amount: string | number
  subject: string
  summary: string
  confidence?: string | number
}

export type LexiCoreSmeltResult = {
  applicant: string
  date: string
  entries: LedgerEntry[]
  debitTotal: string | number
  creditTotal: string | number
  balanced: boolean
  roundingAbsorbed: boolean
  absorbedDelta: string | number
  note: string
}

export type LexiCoreSseHandler = {
  onMeta?: (data: { applicant?: string; date?: string; note?: string }) => void
  onEntry?: (data: LedgerEntry & { lineNo?: number }) => void
  onBalance?: (data: {
    debitTotal: string | number
    creditTotal: string | number
    balanced: boolean
    roundingAbsorbed?: boolean
    absorbedDelta?: string | number
  }) => void
  onDone?: (data: LexiCoreSmeltResult) => void
  onError?: (message: string) => void
}

function apiBase(): string {
  const config = useRuntimeConfig()
  const origin = (config.public.apiOrigin as string) || ''
  return origin.replace(/\/$/, '')
}

function authHeaders(json = true): Headers {
  const headers = new Headers()
  if (json) headers.set('Content-Type', 'application/json')
  headers.set('Accept', json ? 'text/event-stream, application/json' : 'application/json')
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()
  if (auth.accessToken) headers.set('Authorization', `Bearer ${auth.accessToken}`)
  return headers
}

export async function smeltStream(
  body: { text: string; applicant?: string; date?: string | null },
  handlers: LexiCoreSseHandler,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${apiBase()}/api/lexicore/smelt`
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(true),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `熔炼失败 (${res.status})`)
  }
  if (!res.body) {
    throw new Error('浏览器不支持流式响应')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let eventName = 'message'
  let dataLines: string[] = []

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
    if (name === 'meta') handlers.onMeta?.(data as never)
    else if (name === 'entry') handlers.onEntry?.(data as never)
    else if (name === 'balance') handlers.onBalance?.(data as never)
    else if (name === 'done') handlers.onDone?.(data as never)
    else if (name === 'error') handlers.onError?.(String(data))
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split(/\r?\n/)
    buffer = parts.pop() || ''
    for (const line of parts) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      } else if (line === '') {
        flush()
      }
    }
  }
  flush()
}

export async function smeltSync(body: {
  text: string
  applicant?: string
  date?: string | null
}): Promise<LexiCoreSmeltResult> {
  const { apiFetch } = await import('~/utils/api/http')
  return apiFetch<LexiCoreSmeltResult>('/api/lexicore/smelt-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function rebalance(body: {
  applicant: string
  date: string
  entries: LedgerEntry[]
}): Promise<LexiCoreSmeltResult> {
  const { apiFetch } = await import('~/utils/api/http')
  return apiFetch<LexiCoreSmeltResult>('/api/lexicore/balance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function downloadVoucherPack(body: {
  applicant: string
  date: string
  entries: LedgerEntry[]
}): Promise<void> {
  const url = `${apiBase()}/api/lexicore/voucher-pack`
  const headers = authHeaders(true)
  headers.set('Accept', 'application/zip')
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `导出失败 (${res.status})`)
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  const href = URL.createObjectURL(blob)
  a.href = href
  a.download = 'lexicore-voucher.zip'
  a.click()
  URL.revokeObjectURL(href)
}
