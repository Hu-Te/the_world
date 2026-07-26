/** 本地报警落盘（localStorage，减轻后端压力） */

const KEY = 'fieldpulse.alarms.v1'
const MAX = 200

export type AlarmRow = {
  id: string
  deviceId: string
  state: string
  reason: string
  epochMillis: number
}

export function loadAlarms(): AlarmRow[] {
  if (!import.meta.client) return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as AlarmRow[]
    return Array.isArray(list) ? list.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function pushAlarm(row: Omit<AlarmRow, 'id'>): AlarmRow[] {
  const next: AlarmRow = { ...row, id: `${row.epochMillis}-${Math.random().toString(36).slice(2, 8)}` }
  const list = [next, ...loadAlarms()].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* quota */
  }
  return list
}
