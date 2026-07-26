<template>
  <PlcCenterShell title="实时监控">
    <template #actions>
      <span class="ws-pill" :class="'is-' + live.wsStatus">WS {{ live.wsLabel }}</span>
      <button type="button" class="plc-btn" @click="reload">刷新台账</button>
    </template>
    <p class="plc-lead">
      点位经 WebSocket 推送（约 {{ pushHint }}），统一写入 Pinia
      <code>liveDataMap</code>。云代理链路通常 50~150ms 量级，无法等同现场 10ms 直采。组态绑定见
      <NuxtLink to="/console/fieldpulse/scada">组态大屏</NuxtLink>。
    </p>
    <p v-if="error || live.lastError" class="plc-err">{{ error || live.lastError }}</p>
    <ul class="plc-cards">
      <li v-for="d in devices" :key="d.id" class="plc-card">
        <div class="plc-card__head">
          <div>
            <p class="plc-card__name">{{ d.name }}</p>
            <p class="plc-card__meta mono">{{ d.runtimeDeviceId }}</p>
            <p class="plc-card__meta">
              Agent {{ d.agentId || '直连' }} · 轮询 {{ d.pollIntervalMs }}ms
              <span :class="d.sessionActive ? 'ok' : 'idle'">
                · {{ d.sessionActive ? '会话中' : '空闲' }}
              </span>
              <span
                v-if="live.lifecycleMap[d.runtimeDeviceId]"
                class="life"
                :class="'is-' + (live.lifecycleMap[d.runtimeDeviceId] || '').toLowerCase()">
                · {{ live.lifecycleMap[d.runtimeDeviceId] }}
              </span>
            </p>
          </div>
          <div class="plc-card__ops">
            <button
              type="button"
              class="plc-btn"
              :disabled="d.sessionActive"
              @click="start(d.id)">
              启动
            </button>
            <button type="button" class="plc-btn plc-btn--ghost" @click="stop(d.id)">停止</button>
          </div>
        </div>
        <ul class="plc-tags">
          <li v-for="t in d.tags" :key="t.tagKey" class="plc-tag">
            <span class="k">{{ t.tagKey }}</span>
            <span class="v mono">{{ formatValue(live.getValue(keyOf(d, t.tagKey))) }}</span>
            <span class="q">
              {{ live.getSample(keyOf(d, t.tagKey))?.q || '' }}
              <template v-if="live.getSample(keyOf(d, t.tagKey))?.ageMs != null">
                · {{ live.getSample(keyOf(d, t.tagKey))!.ageMs }}ms 前
              </template>
            </span>
          </li>
          <li v-if="!d.tags.length" class="muted">无点位</li>
        </ul>
      </li>
    </ul>
    <p v-if="!devices.length" class="muted">暂无设备，请先到设备台账新增并绑定 Agent。</p>
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import { liveTagKey, useLiveDataStore } from '~/stores/liveData'
import {
  listDevices,
  startDeviceSession,
  stopDeviceSession,
  type PlcDevice,
} from '~/utils/console/fieldpulseApi'

definePageMeta({ layout: false })

const live = useLiveDataStore()
const devices = ref<PlcDevice[]>([])
const error = ref('')

const pushHint = computed(() => {
  const polls = devices.value.filter((d) => d.sessionActive).map((d) => d.pollIntervalMs)
  if (!polls.length) return '50ms 推送窗'
  const min = Math.min(...polls)
  return `轮询 ${min}ms + 推送窗 ~50ms`
})

function keyOf(d: PlcDevice, tagKey: string) {
  return liveTagKey(d.runtimeDeviceId, tagKey)
}

function formatValue(v: unknown) {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return String(v)
  const abs = Math.abs(n)
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) return n.toExponential(3)
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
}

async function reload() {
  error.value = ''
  live.clearError()
  try {
    devices.value = await listDevices()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function start(id: string) {
  try {
    await startDeviceSession(id)
    await reload()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function stop(id: string) {
  try {
    await stopDeviceSession(id)
    await reload()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(async () => {
  live.retain()
  await reload()
})

onBeforeUnmount(() => {
  live.release()
})
</script>

<style scoped lang="scss">
.plc-lead {
  margin: 0 0 1rem;
  color: #94a3b8;
  font-size: 0.88rem;
  a {
    color: #67e8f9;
  }
  code {
    color: #67e8f9;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.75rem;
  }
}
.ws-pill {
  display: inline-flex;
  align-items: center;
  margin-right: 0.45rem;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #94a3b8;
  &.is-open {
    color: #6ee7b7;
    border-color: rgba(52, 211, 153, 0.35);
    background: rgba(52, 211, 153, 0.1);
  }
  &.is-connecting,
  &.is-reconnecting {
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.35);
  }
}
.plc-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
.plc-card {
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(110, 200, 232, 0.22);
  background: rgba(0, 0, 0, 0.28);
}
.plc-card__head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.plc-card__name {
  margin: 0;
  font-weight: 600;
  color: #f1f5f9;
}
.plc-card__meta {
  margin: 0.3rem 0 0;
  font-size: 0.78rem;
  color: #64748b;
}
.mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
}
.plc-card__ops {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}
.plc-tags {
  list-style: none;
  margin: 0.85rem 0 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.5rem;
}
.plc-tag {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.55rem 0.65rem;
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  .k {
    font-size: 0.68rem;
    color: #64748b;
  }
  .v {
    font-size: 1.05rem;
    color: #ecfeff;
    font-variant-numeric: tabular-nums;
  }
  .q {
    font-size: 0.65rem;
    color: #67e8f9;
  }
}
.ok {
  color: #6ee7b7;
}
.idle {
  color: #64748b;
}
.life {
  &.is-online {
    color: #6ee7b7;
  }
  &.is-reconnecting {
    color: #fbbf24;
  }
  &.is-offline {
    color: #fca5a5;
  }
}
.muted {
  color: #64748b;
  font-size: 0.85rem;
}
.plc-err {
  color: #fbbf24;
}
.plc-btn {
  border-radius: 0.4rem;
  border: 1px solid rgba(110, 200, 232, 0.4);
  background: rgba(110, 200, 232, 0.12);
  padding: 0.4rem 0.7rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  color: #ecfeff;
  cursor: pointer;
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  &--ghost {
    background: transparent;
    color: #94a3b8;
    border-color: rgba(255, 255, 255, 0.12);
  }
}
</style>
