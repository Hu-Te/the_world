import { apiFetch, notifySessionAuthFailure } from '~/utils/api/http'

export type SpriteTrack = 'TOOLS' | 'PLATFORM'

export type SpriteChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type SpriteChatResult = {
  reply: string
  track: SpriteTrack
  refused: boolean
  cta: string | null
  toolsUsed: string[]
  unlockedModules: string[]
}

export type SpriteStreamHandlers = {
  onMeta?: (data: {
    refused?: boolean
    cta?: string | null
    toolsUsed?: string[]
    unlockedModules?: string[]
  }) => void
  onDelta?: (text: string) => void
  onDone?: () => void
  onError?: (message: string) => void
}

export function chatToolsSprite(body: {
  messages: SpriteChatMessage[]
  pagePath?: string
}) {
  return apiFetch<SpriteChatResult>('/api/sprite/tools/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function chatConsoleSprite(body: {
  messages: SpriteChatMessage[]
  pagePath?: string
  enableWeb?: boolean
  preferPro?: boolean
}) {
  return apiFetch<SpriteChatResult>('/api/console/sprite/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function apiBase(): string {
  const config = useRuntimeConfig()
  const origin = (config.public.apiOrigin as string) || ''
  return origin.replace(/\/$/, '')
}

function streamHeaders(): Headers {
  const headers = new Headers()
  headers.set('Content-Type', 'application/json')
  headers.set('Accept', 'text/event-stream, application/json')
  const auth = useAuthStore()
  if (import.meta.client) auth.hydrate()
  if (auth.accessToken) headers.set('Authorization', `Bearer ${auth.accessToken}`)
  return headers
}

async function readSpriteSse(
  url: string,
  body: unknown,
  handlers: SpriteStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: streamHeaders(),
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let msg = raw || `深空精灵请求失败 (${res.status})`
    let code: number | undefined
    try {
      const j = JSON.parse(raw) as { message?: string; code?: number }
      if (j?.message) msg = j.message
      if (typeof j?.code === 'number') code = j.code
    } catch {
      /* plain text */
    }
    await notifySessionAuthFailure(msg, res.status, code)
    throw new Error(msg)
  }
  if (!res.body) throw new Error('浏览器不支持流式响应')

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
    else if (name === 'delta') {
      const text =
        typeof data === 'string'
          ? data
          : data && typeof data === 'object' && 'text' in data
            ? String((data as { text: unknown }).text ?? '')
            : ''
      if (text) handlers.onDelta?.(text)
    } else if (name === 'done') handlers.onDone?.()
    else if (name === 'error') {
      const msg = typeof data === 'string' ? data : String(data)
      handlers.onError?.(msg)
    }
  }

  while (true) {
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
  flush()
}

export function streamToolsSprite(
  body: { messages: SpriteChatMessage[]; pagePath?: string },
  handlers: SpriteStreamHandlers,
  signal?: AbortSignal,
) {
  return readSpriteSse(`${apiBase()}/api/sprite/tools/chat/stream`, body, handlers, signal)
}

export function streamConsoleSprite(
  body: {
    messages: SpriteChatMessage[]
    pagePath?: string
    enableWeb?: boolean
    preferPro?: boolean
  },
  handlers: SpriteStreamHandlers,
  signal?: AbortSignal,
) {
  return readSpriteSse(`${apiBase()}/api/console/sprite/chat/stream`, body, handlers, signal)
}

export type SpriteHistoryResult = {
  messages: SpriteChatMessage[]
}

/** 系统用户：加载未软删的聊天记录 */
export function loadSpriteHistory() {
  return apiFetch<SpriteHistoryResult>('/api/console/sprite/history')
}

/** 系统用户：追加保存本轮对话 */
export function appendSpriteHistory(messages: SpriteChatMessage[]) {
  return apiFetch<null>('/api/console/sprite/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
}

/** 系统用户：软清除聊天记录 */
export function clearSpriteHistory() {
  return apiFetch<null>('/api/console/sprite/history', {
    method: 'DELETE',
  })
}
