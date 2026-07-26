import { defineStore } from 'pinia'
import { wsUrl } from '~/utils/fieldpulse/api'
import { RobustWebSocket, type WsStatus } from '~/utils/fieldpulse/RobustWebSocket'

/**
 * FieldPulse 实时点位枢纽。
 *
 * Key 规范（与监控页 / 组态 bindTag 统一）：
 *   `${runtimeDeviceId}::${tagKey}`
 *
 * WebSocket 批量推送经 rAF 合并写入，避免每包触发全量渲染。
 */

export type LiveSample = {
  v: unknown
  q: string
  epoch: number
  ageMs: number
}

export function liveTagKey(runtimeDeviceId: string, tagKey: string) {
  return `${runtimeDeviceId}::${tagKey}`
}

export const useLiveDataStore = defineStore('liveData', {
  state: () => ({
    /** 扁平响应式 Map：点位 Key → 最新采样 */
    liveDataMap: {} as Record<string, LiveSample>,
    /** runtimeDeviceId → 生命周期状态 */
    lifecycleMap: {} as Record<string, string>,
    wsStatus: 'closed' as WsStatus,
    lastError: '' as string,
    refCount: 0,
  }),

  getters: {
    wsLabel(state): string {
      switch (state.wsStatus) {
        case 'open':
          return '已连接'
        case 'connecting':
          return '连接中'
        case 'reconnecting':
          return '重连中'
        default:
          return '未连接'
      }
    },
  },

  actions: {
    getSample(bindTag: string | undefined | null): LiveSample | undefined {
      if (!bindTag) return undefined
      return this.liveDataMap[bindTag]
    },

    getValue(bindTag: string | undefined | null): unknown {
      return this.getSample(bindTag)?.v
    },

    /** 组件内请优先 storeToRefs(liveDataMap)[tag]，确保依赖收集 */

    /** 页面/组件挂载时调用；多处共享同一条 WS（引用计数）。 */
    retain() {
      this.refCount += 1
      if (this.refCount === 1) {
        connectLiveWs(this)
      }
    },

    /** 页面/组件卸载时调用。 */
    release() {
      this.refCount = Math.max(0, this.refCount - 1)
      if (this.refCount === 0) {
        disconnectLiveWs()
        this.liveDataMap = {}
        this.lifecycleMap = {}
        this.wsStatus = 'closed'
        this.lastError = ''
      }
    },

    /** 切换账号：断开并清空；由页面按需 retain 重建（勿在未 retain 时重复 retain） */
    resetForUserSwitch() {
      disconnectLiveWs()
      this.liveDataMap = {}
      this.lifecycleMap = {}
      this.wsStatus = 'closed'
      this.lastError = ''
      this.refCount = 0
    },

    /** 强制重连（登录态变化等）。 */
    reconnect() {
      disconnectLiveWs()
      if (this.refCount > 0) {
        connectLiveWs(this)
      }
    },

    clearError() {
      this.lastError = ''
    },
  },
})

type LiveStore = ReturnType<typeof useLiveDataStore>

let client: RobustWebSocket | null = null
let ageTimer: ReturnType<typeof setInterval> | null = null
let pending: Array<Record<string, unknown>> = []
let raf = 0

function connectLiveWs(store: LiveStore) {
  if (!import.meta.client) return
  disconnectLiveWs()
  client = new RobustWebSocket(
    wsUrl(),
    (data) => onWsMessage(store, data),
    (s) => {
      store.wsStatus = s
    },
  )
  client.connect()
  ageTimer = setInterval(() => refreshAges(store), 250)
}

function disconnectLiveWs() {
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
  pending = []
  if (ageTimer) {
    clearInterval(ageTimer)
    ageTimer = null
  }
  client?.close()
  client = null
}

function onWsMessage(store: LiveStore, data: unknown) {
  if (!data || typeof data !== 'object') return
  const msg = data as Record<string, unknown>
  const type = String(msg.type || '')
  if (type === 'telemetry') {
    if (!Array.isArray(msg.items)) return
    pending.push(...(msg.items as Array<Record<string, unknown>>))
    if (!raf) raf = requestAnimationFrame(() => flushTelemetry(store))
  } else if (type === 'lifecycle') {
    const item = msg.item as Record<string, unknown> | undefined
    if (!item) return
    const deviceId = String(item.deviceId || '')
    if (!deviceId) return
    store.lifecycleMap = {
      ...store.lifecycleMap,
      [deviceId]: String(item.state || ''),
    }
  } else if (type === 'error') {
    store.lastError = String(msg.message || 'WebSocket 错误')
  }
}

function flushTelemetry(store: LiveStore) {
  raf = 0
  if (!pending.length) return
  const batch = pending
  pending = []
  const map = { ...store.liveDataMap }
  const t = Date.now()
  for (const item of batch) {
    const deviceId = String(item.deviceId || '')
    const tagKey = String(item.tagKey || '')
    if (!deviceId || !tagKey) continue
    const epoch = Number(item.epochMillis || t)
    map[liveTagKey(deviceId, tagKey)] = {
      v: item.value,
      q: String(item.quality || ''),
      epoch,
      ageMs: Math.max(0, t - epoch),
    }
  }
  store.liveDataMap = map
}

function refreshAges(store: LiveStore) {
  const t = Date.now()
  const map = { ...store.liveDataMap }
  let changed = false
  for (const [k, row] of Object.entries(map)) {
    const age = Math.max(0, t - row.epoch)
    if (age !== row.ageMs) {
      map[k] = { ...row, ageMs: age }
      changed = true
    }
  }
  if (changed) store.liveDataMap = map
}
