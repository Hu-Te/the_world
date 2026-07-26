<template>
  <PlcCenterShell title="历史曲线">
    <template #actions>
      <button type="button" class="plc-btn" :disabled="loading" @click="load">
        {{ loading ? '查询中…' : '查询' }}
      </button>
    </template>

    <p v-if="error" class="plc-err">{{ error }}</p>

    <div class="plc-toolbar">
      <label>
        设备
        <select v-model="runtimeDeviceId">
          <option value="">选择设备</option>
          <option v-for="d in devices" :key="d.id" :value="d.runtimeDeviceId">
            {{ d.name }}
          </option>
        </select>
      </label>
      <label>
        点位
        <select v-model="tagKey">
          <option v-for="t in tagOptions" :key="t.tagKey" :value="t.tagKey">
            {{ t.tagKey }}{{ t.historyEnabled ? '' : '（未采集）' }}
          </option>
        </select>
      </label>
      <label class="plc-toolbar__check" :class="{ 'is-busy': savingHist }">
        <span>历史曲线采集</span>
        <span class="plc-check-row">
          <input
            type="checkbox"
            :checked="historyEnabled"
            :disabled="!selectedDevice || !tagKey || savingHist"
            @change="onHistoryToggle(($event.target as HTMLInputElement).checked)" />
          <em>{{ historyEnabled ? '已开启入库' : '仅实时，不入库' }}</em>
        </span>
      </label>
      <p v-if="selectedDevice" class="plc-toolbar__meta mono">
        {{ selectedDevice.runtimeDeviceId }}
        <template v-if="selectedDevice.agentId"> · Agent {{ selectedDevice.agentId }}</template>
      </p>
    </div>

    <p v-if="selectedTag && !historyEnabled" class="plc-hint">
      当前点位未勾选历史采集：实时监控仍可用，但不会写入历史库。勾选并保存后，约 2s 起开始抽样入库。
    </p>

    <div v-if="stats" class="plc-kpis">
      <div class="kpi">
        <span class="kpi__label">最新值</span>
        <span class="kpi__value mono">{{ formatValue(stats.latest) }}</span>
        <span class="kpi__sub">{{ formatTime(stats.latestAt) }}</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">最小</span>
        <span class="kpi__value mono">{{ formatValue(stats.min) }}</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">最大</span>
        <span class="kpi__value mono">{{ formatValue(stats.max) }}</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">抽样</span>
        <span class="kpi__value mono">{{ stats.count }}</span>
        <span class="kpi__sub">
          近 1 小时 · 质量 {{ stats.goodPct }}%
          <template v-if="stats.rawCount > stats.count">
            · 图示 {{ stats.count }}/{{ stats.rawCount }}
          </template>
        </span>
      </div>
    </div>

    <div class="plc-chart-panel">
      <div class="plc-chart-panel__head">
        <p class="plc-chart-panel__title">趋势</p>
        <p v-if="hover" class="plc-chart-panel__hover mono">
          {{ formatTime(hover.t) }} · {{ formatValue(hover.v) }}
          <span :class="qualityClass(hover.q)">{{ qualityLabel(hover.q) }}</span>
        </p>
      </div>
      <div v-if="!chartPoints.length" class="plc-chart-empty">
        {{
          historyEnabled
            ? '暂无数据。请先启动会话并等待抽样，或点「查询」。'
            : '该点位未开启历史采集，无曲线可查。'
        }}
      </div>
      <div v-else class="plc-chart-frame">
        <svg
          class="plc-chart-svg"
          :viewBox="`0 0 ${vb.w} ${vb.h}`"
          preserveAspectRatio="none"
          @mouseleave="hover = null">
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="rgba(103, 232, 249, 0.32)" />
              <stop offset="100%" stop-color="rgba(103, 232, 249, 0)" />
            </linearGradient>
          </defs>

          <!-- plot background -->
          <rect
            :x="pad.l"
            :y="pad.t"
            :width="plot.w"
            :height="plot.h"
            class="plot-bg" />

          <!-- Y grid + labels -->
          <g v-for="(lab, i) in yLabels" :key="'y' + i">
            <line
              :x1="pad.l"
              :y1="lab.y"
              :x2="pad.l + plot.w"
              :y2="lab.y"
              class="grid" />
            <text :x="pad.l - 8" :y="lab.y + 4" text-anchor="end" class="axis">
              {{ lab.text }}
            </text>
          </g>

          <!-- X grid + labels -->
          <g v-for="(lab, i) in xLabels" :key="'x' + i">
            <line
              :x1="lab.x"
              :y1="pad.t"
              :x2="lab.x"
              :y2="pad.t + plot.h"
              class="grid-v" />
            <text :x="lab.x" :y="pad.t + plot.h + 18" text-anchor="middle" class="axis">
              {{ lab.text }}
            </text>
          </g>

          <!-- axes -->
          <line
            :x1="pad.l"
            :y1="pad.t"
            :x2="pad.l"
            :y2="pad.t + plot.h"
            class="axis-line" />
          <line
            :x1="pad.l"
            :y1="pad.t + plot.h"
            :x2="pad.l + plot.w"
            :y2="pad.t + plot.h"
            class="axis-line" />

          <text
            :x="14"
            :y="pad.t + plot.h / 2"
            class="axis-title"
            transform-origin="14 center"
            :transform="`rotate(-90 14 ${pad.t + plot.h / 2})`">
            数值
          </text>
          <text
            :x="pad.l + plot.w / 2"
            :y="vb.h - 6"
            text-anchor="middle"
            class="axis-title">
            时间
          </text>

          <path :d="areaPath" fill="url(#trendFill)" />
          <polyline :points="linePoints" fill="none" class="line" />
          <circle
            v-if="hover"
            :cx="hover.x"
            :cy="hover.y"
            r="4.5"
            class="dot" />

          <rect
            v-for="(p, i) in chartPoints"
            :key="'h' + i"
            :x="p.x - Math.max(2, chartStep / 2)"
            :y="pad.t"
            :width="Math.max(4, chartStep)"
            :height="plot.h"
            fill="transparent"
            @mousemove="hover = p" />
        </svg>
      </div>
    </div>

    <div class="plc-table-panel">
      <div class="plc-table-panel__head">
        <p class="plc-table-panel__title">明细（最近 {{ tableRows.length }} 条）</p>
      </div>
      <div class="plc-table-wrap">
        <table class="plc-data">
          <thead>
            <tr>
              <th>时间</th>
              <th>数值</th>
              <th>质量</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in tableRows" :key="i">
              <td class="mono">{{ formatTime(row.t) }}</td>
              <td class="mono val">{{ formatValue(row.v) }}</td>
              <td>
                <span class="badge" :class="qualityClass(row.quality)">
                  {{ qualityLabel(row.quality) }}
                </span>
              </td>
            </tr>
            <tr v-if="!tableRows.length">
              <td colspan="3" class="empty">暂无明细</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import {
  fetchTrends,
  listDevices,
  updateDevice,
  type PlcDevice,
  type TrendSeries,
} from '~/utils/console/fieldpulseApi'

definePageMeta({ layout: false })

type ChartPt = { x: number; y: number; t: string; v: string; q: string | null; n: number }

/** 图示点上限，避免万级点位拖垮 SVG */
const CHART_MAX_POINTS = 400

const devices = ref<PlcDevice[]>([])
const runtimeDeviceId = ref('')
const tagKey = ref('')
const series = ref<TrendSeries | null>(null)
const error = ref('')
const loading = ref(false)
const savingHist = ref(false)
const hover = ref<ChartPt | null>(null)

const pad = { l: 72, r: 24, t: 16, b: 44 }
const vb = { w: 1000, h: 280 }
const plot = {
  w: vb.w - pad.l - pad.r,
  h: vb.h - pad.t - pad.b,
}

const selectedDevice = computed(() =>
  devices.value.find((d) => d.runtimeDeviceId === runtimeDeviceId.value),
)

const tagOptions = computed(() => {
  const d = selectedDevice.value
  if (!d?.tags?.length) return []
  return d.tags
})

const selectedTag = computed(() => tagOptions.value.find((t) => t.tagKey === tagKey.value))

const historyEnabled = computed(() => selectedTag.value?.historyEnabled !== false)

const numericPoints = computed(() => {
  const pts = series.value?.points || []
  return pts
    .map((p) => ({ ...p, n: Number(p.v) }))
    .filter((p) => Number.isFinite(p.n))
})

/** 均匀抽稀到 CHART_MAX_POINTS，两端保留 */
function downsample<T>(pts: T[], max: number): T[] {
  if (pts.length <= max) return pts
  const out: T[] = []
  const last = pts.length - 1
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * last) / (max - 1))
    out.push(pts[idx])
  }
  return out
}

const displayPoints = computed(() => downsample(numericPoints.value, CHART_MAX_POINTS))

const yRange = computed(() => {
  const pts = displayPoints.value
  if (!pts.length) return { min: 0, max: 1 }
  let min = Math.min(...pts.map((p) => p.n))
  let max = Math.max(...pts.map((p) => p.n))
  if (min === max) {
    const padN = Math.abs(min) > 0 ? Math.abs(min) * 0.05 : 1
    min -= padN
    max += padN
  }
  return { min, max }
})

const stats = computed(() => {
  const pts = numericPoints.value
  if (!pts.length) return null
  let min = pts[0].n
  let max = pts[0].n
  let good = 0
  for (const p of pts) {
    if (p.n < min) min = p.n
    if (p.n > max) max = p.n
    if ((p.quality || '').toUpperCase().startsWith('GOOD')) good += 1
  }
  const last = pts[pts.length - 1]
  return {
    count: displayPoints.value.length,
    rawCount: pts.length,
    min,
    max,
    latest: last.n,
    latestAt: last.t,
    goodPct: Math.round((good / pts.length) * 100),
  }
})

const chartStep = computed(() => {
  const n = Math.max(1, displayPoints.value.length - 1)
  return plot.w / n
})

const chartPoints = computed<ChartPt[]>(() => {
  const pts = displayPoints.value
  if (!pts.length) return []
  const { min, max } = yRange.value
  const step = pts.length === 1 ? 0 : plot.w / (pts.length - 1)
  return pts.map((p, i) => {
    const ratio = (p.n - min) / (max - min)
    return {
      x: pad.l + i * step,
      y: pad.t + plot.h - ratio * plot.h,
      t: p.t,
      v: p.v,
      q: p.quality,
      n: p.n,
    }
  })
})

const linePoints = computed(() =>
  chartPoints.value.map((p) => `${p.x},${p.y}`).join(' '),
)

const areaPath = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return ''
  const baseY = pad.t + plot.h
  const first = pts[0]
  const last = pts[pts.length - 1]
  const line = pts.map((p) => `${p.x} ${p.y}`).join(' L ')
  return `M ${first.x} ${baseY} L ${line} L ${last.x} ${baseY} Z`
})

const yLabels = computed(() => {
  const { min, max } = yRange.value
  const ticks = 5
  return Array.from({ length: ticks }, (_, i) => {
    const r = i / (ticks - 1)
    return {
      y: pad.t + r * plot.h,
      text: formatValue(max - (max - min) * r),
    }
  })
})

const xLabels = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return []
  const idxs =
    pts.length === 1
      ? [0]
      : pts.length === 2
        ? [0, pts.length - 1]
        : [0, Math.floor((pts.length - 1) / 2), pts.length - 1]
  return idxs.map((i) => ({
    x: pts[i].x,
    text: formatTimeShort(pts[i].t),
  }))
})

const tableRows = computed(() => {
  const pts = series.value?.points || []
  return [...pts].slice(-50).reverse()
})

watch(runtimeDeviceId, () => {
  const opts = tagOptions.value
  if (!opts.length) {
    tagKey.value = ''
    return
  }
  if (!opts.some((t) => t.tagKey === tagKey.value)) {
    const prefer = opts.find((t) => t.historyEnabled !== false) || opts[0]
    tagKey.value = prefer.tagKey
  }
})

watch([runtimeDeviceId, tagKey], () => {
  if (runtimeDeviceId.value && tagKey.value) void load()
})

function formatTime(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatTimeShort(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

function formatValue(v: string | number | undefined) {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return String(v)
  const abs = Math.abs(n)
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) {
    return n.toExponential(3)
  }
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

function qualityLabel(q: string | null | undefined) {
  if (!q) return '未知'
  if (q.toUpperCase().startsWith('GOOD')) return '正常'
  if (q.toUpperCase().startsWith('BAD')) return '异常'
  return q
}

function qualityClass(q: string | null | undefined) {
  if (!q) return 'is-unknown'
  if (q.toUpperCase().startsWith('GOOD')) return 'is-good'
  return 'is-bad'
}

async function onHistoryToggle(enabled: boolean) {
  const d = selectedDevice.value
  if (!d || !tagKey.value) return
  savingHist.value = true
  error.value = ''
  try {
    const tags = d.tags.map((t) => ({
      tagKey: t.tagKey,
      address: t.address,
      dataType: t.dataType,
      historyEnabled: t.tagKey === tagKey.value ? enabled : t.historyEnabled !== false,
    }))
    await updateDevice(d.id, {
      name: d.name,
      protocolType: d.protocolType,
      host: d.host,
      port: d.port,
      rack: d.rack,
      slot: d.slot,
      unitId: d.unitId,
      pollIntervalMs: d.pollIntervalMs,
      agentId: d.agentId,
      tags,
      enabled: d.enabled,
    })
    const idx = devices.value.findIndex((x) => x.id === d.id)
    if (idx >= 0) {
      devices.value[idx] = {
        ...devices.value[idx],
        tags,
      }
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    savingHist.value = false
  }
}

async function load() {
  error.value = ''
  if (!runtimeDeviceId.value || !tagKey.value) {
    error.value = '请选择设备与点位'
    return
  }
  loading.value = true
  hover.value = null
  try {
    series.value = await fetchTrends(runtimeDeviceId.value, tagKey.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    devices.value = await listDevices()
    if (devices.value[0]) {
      runtimeDeviceId.value = devices.value[0].runtimeDeviceId
      const opts = tagOptions.value
      if (opts.length) {
        const prefer = opts.find((t) => t.historyEnabled !== false) || opts[0]
        tagKey.value = prefer.tagKey
      }
      await load()
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<style scoped lang="scss">
.plc-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: flex-end;
  margin-bottom: 0.75rem;

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.72rem;
    color: #94a3b8;
    min-width: 10rem;
  }

  select {
    border-radius: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #e2e8f0;
    padding: 0.45rem 0.55rem;
    min-width: 11rem;
  }

  &__check {
    min-width: 12rem;

    &.is-busy {
      opacity: 0.65;
    }
  }

  &__meta {
    margin: 0 0 0.35rem;
    font-size: 0.72rem;
    color: #64748b;
  }
}

.plc-check-row {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.15rem;
  padding: 0 0.55rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(110, 200, 232, 0.28);
  background: rgba(0, 0, 0, 0.35);

  input {
    accent-color: #22d3ee;
  }

  em {
    font-style: normal;
    font-size: 0.72rem;
    color: #cbd5e1;
  }
}

.plc-hint {
  margin: 0 0 0.85rem;
  padding: 0.55rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(251, 191, 36, 0.28);
  background: rgba(251, 191, 36, 0.08);
  color: #fde68a;
  font-size: 0.78rem;
}

.plc-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.65rem;
  margin-bottom: 0.9rem;

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.kpi {
  padding: 0.75rem 0.85rem;
  border-radius: 0.65rem;
  border: 1px solid rgba(110, 200, 232, 0.18);
  background: linear-gradient(180deg, rgba(110, 200, 232, 0.08), rgba(0, 0, 0, 0.28));

  &__label {
    display: block;
    font-size: 0.68rem;
    color: #64748b;
    letter-spacing: 0.06em;
  }

  &__value {
    display: block;
    margin-top: 0.35rem;
    font-size: 1.15rem;
    color: #ecfeff;
    font-variant-numeric: tabular-nums;
  }

  &__sub {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.68rem;
    color: #94a3b8;
  }
}

.plc-chart-panel {
  margin-bottom: 0.9rem;
  padding: 0.85rem 1rem 0.7rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(110, 200, 232, 0.18);
  background: rgba(0, 0, 0, 0.28);

  &__head {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    align-items: baseline;
    margin-bottom: 0.45rem;
  }

  &__title {
    margin: 0;
    font-size: 0.78rem;
    color: #cbd5e1;
  }

  &__hover {
    margin: 0;
    font-size: 0.75rem;
    color: #67e8f9;
  }
}

.plc-chart-empty {
  min-height: 12rem;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 0.85rem;
}

.plc-chart-frame {
  width: 100%;
}

.plc-chart-svg {
  width: 100%;
  height: 280px;
  display: block;

  .plot-bg {
    fill: rgba(8, 18, 32, 0.35);
  }

  .grid {
    stroke: rgba(148, 163, 184, 0.14);
    stroke-width: 1;
  }

  .grid-v {
    stroke: rgba(148, 163, 184, 0.08);
    stroke-width: 1;
  }

  .axis-line {
    stroke: rgba(148, 163, 184, 0.55);
    stroke-width: 1.4;
  }

  .axis {
    fill: #94a3b8;
    font-size: 11px;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }

  .axis-title {
    fill: #64748b;
    font-size: 11px;
    letter-spacing: 0.12em;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
  }

  .line {
    stroke: #67e8f9;
    stroke-width: 2.2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .dot {
    fill: #ecfeff;
    stroke: #22d3ee;
    stroke-width: 2;
  }
}

.plc-table-panel {
  border-radius: 0.75rem;
  border: 1px solid rgba(110, 200, 232, 0.18);
  background: rgba(0, 0, 0, 0.22);
  overflow: hidden;

  &__head {
    padding: 0.7rem 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  &__title {
    margin: 0;
    font-size: 0.78rem;
    color: #cbd5e1;
  }
}

.plc-table-wrap {
  max-height: 16rem;
  overflow: auto;
}

.plc-data {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;

  th,
  td {
    padding: 0.55rem 0.9rem;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  th {
    position: sticky;
    top: 0;
    background: rgba(8, 18, 32, 0.96);
    color: #64748b;
    font-weight: 500;
    font-size: 0.7rem;
    letter-spacing: 0.04em;
  }

  tbody tr:hover td {
    background: rgba(110, 200, 232, 0.05);
  }

  .val {
    color: #e2e8f0;
    font-variant-numeric: tabular-nums;
  }

  .empty {
    text-align: center;
    color: #64748b;
    padding: 1.2rem;
  }
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  letter-spacing: 0.04em;

  &.is-good {
    color: #6ee7b7;
    background: rgba(52, 211, 153, 0.12);
    border: 1px solid rgba(52, 211, 153, 0.28);
  }
  &.is-bad {
    color: #fca5a5;
    background: rgba(248, 113, 113, 0.12);
    border: 1px solid rgba(248, 113, 113, 0.28);
  }
  &.is-unknown {
    color: #94a3b8;
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }
}

.mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
}

.plc-err {
  color: #fbbf24;
  margin-bottom: 0.75rem;
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
    opacity: 0.5;
    cursor: wait;
  }
}
</style>
