import type { DrawSyncMessage, DrawSyncState } from './types'

export type DrawSyncMode = 'solo' | 'host' | 'guest'

export interface DrawSyncHandle {
  mode: DrawSyncMode
  roomCode: string | null
  send: (msg: DrawSyncMessage) => void
  onStatus?: (status: DrawSyncStatus) => void
  dispose: () => void
}

export interface DrawSyncStatus {
  connected: boolean
  guestOnline: boolean
  hostOnline: boolean
}

const API_BASE = (import.meta.env.VITE_DRAW_SYNC_URL as string | undefined) ?? '/api/draw'

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

async function postState(roomId: string, state: DrawSyncState): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/${roomId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
    return res.ok
  } catch {
    return false
  }
}

async function postGuess(roomId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/${roomId}/guess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function fetchRoom(roomId: string, role: 'host' | 'guest') {
  const res = await fetch(`${API_BASE}/${roomId}`, {
    headers: { 'X-Draw-Role': role },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`room fetch failed: ${res.status}`)
  return res.json() as Promise<{
    state: DrawSyncState | null
    guesses: { text: string }[]
    guestOnline: boolean
    hostOnline: boolean
  }>
}

/** HTTP 轮询同步（画者开房，猜者加入） */
export function createDrawSync(
  mode: DrawSyncMode,
  roomCode: string | null,
  onMessage: (msg: DrawSyncMessage) => void,
  onStatus?: (status: DrawSyncStatus) => void,
): Promise<DrawSyncHandle> {
  if (mode === 'solo') {
    return Promise.resolve({
      mode: 'solo',
      roomCode: null,
      send: () => {},
      dispose: () => {},
    })
  }

  const code = mode === 'host' ? (roomCode ?? randomCode()) : roomCode!
  let pollId = 0
  let disposed = false
  let latestState: DrawSyncState | null = null

  const emitStatus = (partial: Partial<DrawSyncStatus>) => {
    onStatus?.({
      connected: partial.connected ?? false,
      guestOnline: partial.guestOnline ?? false,
      hostOnline: partial.hostOnline ?? true,
    })
  }

  const pollHost = async () => {
    if (disposed) return
    try {
      const room = await fetchRoom(code, 'host')
      emitStatus({ connected: true, guestOnline: room.guestOnline, hostOnline: true })
      room.guesses.forEach((g) => onMessage({ type: 'guess', text: g.text }))
    } catch {
      emitStatus({ connected: false, guestOnline: false, hostOnline: true })
    }
  }

  const pollGuest = async () => {
    if (disposed) return
    try {
      const room = await fetchRoom(code, 'guest')
      emitStatus({ connected: true, guestOnline: true, hostOnline: room.hostOnline })
      if (room.state) {
        onMessage({ type: 'full', state: room.state })
      }
    } catch {
      emitStatus({ connected: false, guestOnline: true, hostOnline: false })
    }
  }

  if (mode === 'host') {
    pollId = window.setInterval(pollHost, 400)

    return Promise.resolve({
      mode: 'host',
      roomCode: code,
      send: (msg) => {
        if (msg.type === 'full') {
          latestState = msg.state
          void postState(code, msg.state).then((ok) => {
            if (!ok) emitStatus({ connected: false, guestOnline: false, hostOnline: true })
          })
        }
      },
      dispose: () => {
        disposed = true
        window.clearInterval(pollId)
      },
    })
  }

  // 猜者：先拉一次，再轮询
  const pollGuestOnce = async () => {
    if (disposed) return
    try {
      const room = await fetchRoom(code, 'guest')
      emitStatus({ connected: true, guestOnline: true, hostOnline: room.hostOnline })
      if (room.state) onMessage({ type: 'full', state: room.state })
    } catch {
      emitStatus({ connected: false, guestOnline: true, hostOnline: false })
    }
  }
  void pollGuestOnce()
  pollId = window.setInterval(pollGuest, 200)

  return Promise.resolve({
    mode: 'guest',
    roomCode: code,
    send: (msg) => {
      if (msg.type === 'guess') {
        void postGuess(code, msg.text)
      }
    },
    dispose: () => {
      disposed = true
      window.clearInterval(pollId)
    },
  })
}
