export type WsStatus = 'connecting' | 'open' | 'closed' | 'reconnecting'

type Handler = (data: unknown) => void

/**
 * 健壮 WebSocket：指数退避重连 + ping 心跳 + 状态回调。
 * protocols 用于 Sec-WebSocket-Protocol（如 fp.jwt + JWT），避免 token 进 Query。
 */
export class RobustWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private protocols: string[] | undefined
  private status: WsStatus = 'closed'
  private attempt = 0
  private closedByUser = false
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly onMessage: Handler
  private readonly onStatus: (s: WsStatus) => void
  private readonly onOpen: (() => void) | null

  constructor(
    url: string,
    onMessage: Handler,
    onStatus: (s: WsStatus) => void,
    onOpen?: (() => void) | null,
    protocols?: string[] | null,
  ) {
    this.url = url
    this.onMessage = onMessage
    this.onStatus = onStatus
    this.onOpen = onOpen ?? null
    this.protocols = protocols?.length ? [...protocols] : undefined
  }

  connect() {
    this.closedByUser = false
    this.open()
  }

  close() {
    this.closedByUser = true
    this.clearTimers()
    if (this.ws) {
      try {
        this.ws.close()
      } catch {
        /* ignore */
      }
      this.ws = null
    }
    this.setStatus('closed')
  }

  send(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  private open() {
    this.clearTimers()
    this.setStatus(this.attempt > 0 ? 'reconnecting' : 'connecting')
    const ws = this.protocols?.length
      ? new WebSocket(this.url, this.protocols)
      : new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.attempt = 0
      this.setStatus('open')
      this.pingTimer = setInterval(() => {
        this.send({ type: 'ping' })
      }, 15000)
      try {
        this.onOpen?.()
      } catch {
        /* ignore */
      }
    }
    ws.onmessage = (ev) => {
      try {
        this.onMessage(JSON.parse(String(ev.data)))
      } catch {
        this.onMessage(ev.data)
      }
    }
    ws.onclose = () => {
      this.clearPing()
      this.ws = null
      if (this.closedByUser) {
        this.setStatus('closed')
        return
      }
      this.scheduleReconnect()
    }
    ws.onerror = () => {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
    }
  }

  private scheduleReconnect() {
    this.setStatus('reconnecting')
    const delay = Math.min(30000, 800 * 2 ** Math.min(this.attempt, 5))
    this.attempt += 1
    this.reconnectTimer = setTimeout(() => this.open(), delay)
  }

  private setStatus(s: WsStatus) {
    this.status = s
    this.onStatus(s)
  }

  private clearPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  private clearTimers() {
    this.clearPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
