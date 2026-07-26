<template>
  <div
    ref="rootEl"
    class="scada-node"
    :class="[
      `is-${nodeData.type}`,
      {
        'is-selected': selected,
        'is-alarm': alarming,
        'is-bound': Boolean(nodeData.bindTag),
        'is-stale': isStale,
        'is-on': lampOn,
      },
    ]"
    :style="rootStyle"
    @mousedown.stop="onPointerDown">
    <!-- 文本 -->
    <template v-if="nodeData.type === 'text'">
      <span class="scada-node__text">{{ nodeData.text || '文本' }}</span>
    </template>

    <!-- 显示框 -->
    <template v-else-if="nodeData.type === 'display' || nodeData.type === 'value'">
      <span class="scada-node__caption">{{ nodeData.text || '显示' }}</span>
      <span class="scada-node__value mono" :style="{ color: valueColor }">
        {{ displayText }}<em v-if="nodeData.unit">{{ nodeData.unit }}</em>
      </span>
    </template>

    <!-- 输入框：本地设定显示，不写他户数据；PLC 下发需后续写点 API -->
    <template v-else-if="nodeData.type === 'input'">
      <span class="scada-node__caption">{{ nodeData.text || '设定' }}</span>
      <div class="scada-node__input-row" @mousedown.stop>
        <input
          class="scada-node__input mono"
          :value="inputDraft"
          :placeholder="displayText"
          @input="onInputDraft"
          @change="commitSetpoint"
          @blur="commitSetpoint"
          @focus="emit('select', nodeData.id)" />
        <span v-if="nodeData.unit" class="scada-node__unit">{{ nodeData.unit }}</span>
      </div>
      <span class="scada-node__pv mono">PV {{ displayText }}</span>
    </template>

    <!-- 按钮：允许冒泡到节点拖拽；真正点击（未拖动）再触发动作 -->
    <template v-else-if="nodeData.type === 'button'">
      <button
        type="button"
        class="scada-node__btn"
        :class="{ on: lampOn }"
        @click.stop="onButtonClick">
        {{ nodeData.text || '按钮' }}
      </button>
    </template>

    <!-- 图片 -->
    <template v-else-if="nodeData.type === 'image'">
      <img
        v-if="safeImageUrl"
        class="scada-node__img"
        :src="safeImageUrl"
        :alt="nodeData.text || '图'"
        draggable="false" />
      <div v-else class="scada-node__img-ph">{{ nodeData.text || '图片' }}</div>
    </template>

    <!-- 曲线 -->
    <template v-else-if="nodeData.type === 'curve'">
      <div class="scada-node__curve-head">
        <span class="scada-node__caption">{{ nodeData.text || '曲线' }}</span>
        <span class="scada-node__value mono sm" :style="{ color: valueColor }">
          {{ displayText }}<em v-if="nodeData.unit">{{ nodeData.unit }}</em>
        </span>
      </div>
      <svg class="scada-node__svg" viewBox="0 0 100 40" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
          :points="sparkPoints" />
      </svg>
    </template>

    <!-- 指示灯 -->
    <template v-else-if="nodeData.type === 'lamp'">
      <span class="scada-node__lamp" :class="{ on: lampOn }" />
      <span class="scada-node__caption">{{ nodeData.text || '指示灯' }}</span>
    </template>

    <!-- 水泵 -->
    <template v-else-if="nodeData.type === 'pump'">
      <span class="scada-node__pump" :class="{ on: lampOn }" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="100%" height="100%">
          <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="2.5" />
          <circle cx="24" cy="24" r="6" fill="currentColor" opacity="0.35" />
          <path
            d="M24 8 L28 24 L24 40 L20 24 Z"
            fill="currentColor"
            opacity="0.85" />
        </svg>
      </span>
      <span class="scada-node__caption">{{ nodeData.text || '泵' }}</span>
    </template>

    <!-- 管道 -->
    <template v-else-if="nodeData.type === 'pipe'">
      <span class="scada-node__pipe" :class="{ flow: lampOn }" />
    </template>

    <!-- 面板 -->
    <template v-else>
      <span class="scada-node__panel-title">{{ nodeData.text || '面板' }}</span>
    </template>

    <span v-if="selected" class="scada-node__badge mono">{{ bindHint }}</span>
    <button
      v-if="selected"
      type="button"
      class="scada-node__rot"
      title="拖拽旋转 · Shift 吸附 15°"
      aria-label="旋转"
      @mousedown.stop.prevent="onRotateDown" />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLiveDataStore } from '~/stores/liveData'
import type { ScadaNodeData } from '~/utils/console/scadaTypes'

const props = defineProps<{
  nodeData: ScadaNodeData
  selected?: boolean
  canvasW: number
  canvasH: number
  /** 画布视口缩放，拖拽位移需除以该值 */
  viewScale?: number
}>()

const emit = defineEmits<{
  select: [id: string]
  move: [payload: { id: string; x: number; y: number }]
  patch: [payload: Partial<ScadaNodeData> & { id: string }]
}>()

const live = useLiveDataStore()
const { liveDataMap } = storeToRefs(live)

const sample = computed(() => {
  const tag = props.nodeData.bindTag
  if (!tag) return undefined
  return liveDataMap.value[tag]
})

const hasLive = computed(() => sample.value !== undefined)

const displayValue = computed(() => {
  if (!props.nodeData.bindTag) return undefined
  const v = sample.value?.v
  if (v === undefined || v === null || v === '') return undefined
  return v
})

const displayText = computed(() => {
  if (displayValue.value === undefined) {
    return props.nodeData.bindTag ? '—' : '—'
  }
  return formatValue(displayValue.value, props.nodeData.decimals)
})

const lampOn = computed(() => {
  if (!props.nodeData.bindTag || !hasLive.value) return false
  return toBool(displayValue.value)
})

const alarming = computed(() => {
  const th = props.nodeData.style?.alarmThreshold
  if (th == null || displayValue.value === undefined) return false
  const n = toNum(displayValue.value)
  return n != null && n > th
})

const isStale = computed(() => {
  if (!props.nodeData.bindTag || !sample.value) return false
  return sample.value.ageMs > 5000
})

const valueColor = computed(() => {
  if (alarming.value) return props.nodeData.style?.alarmColor || '#fb7185'
  return props.nodeData.style?.color || '#ecfeff'
})

const bindHint = computed(() => {
  const tag = props.nodeData.bindTag
  if (!tag) return '未绑定'
  const name = tag.includes('::') ? tag.split('::').pop()! : tag
  if (!hasLive.value) return `${name} · 无数据`
  if (isStale.value) return `${name} · 陈旧`
  return name
})

/** 仅允许 http(s) / data:image，避免 javascript: 等 */
const safeImageUrl = computed(() => {
  const u = (props.nodeData.imageUrl || '').trim()
  if (!u) return ''
  if (/^https?:\/\//i.test(u) || /^data:image\//i.test(u)) return u
  return ''
})

const rotationDeg = computed(() => {
  const r = Number(props.nodeData.rotation)
  return Number.isFinite(r) ? r : 0
})

const rootStyle = computed(() => ({
  left: `${props.nodeData.x}px`,
  top: `${props.nodeData.y}px`,
  width: `${props.nodeData.w}px`,
  height: `${props.nodeData.h}px`,
  transform: rotationDeg.value ? `rotate(${rotationDeg.value}deg)` : undefined,
  fontSize: `${props.nodeData.style?.fontSize ?? 13}px`,
  background: props.nodeData.style?.background || undefined,
  borderColor: props.nodeData.style?.borderColor || undefined,
  color: props.nodeData.style?.color || undefined,
}))

const inputDraft = ref(props.nodeData.setpoint || '')
watch(
  () => [props.nodeData.id, props.nodeData.setpoint] as const,
  () => {
    inputDraft.value = props.nodeData.setpoint || ''
  },
)

function onInputDraft(e: Event) {
  inputDraft.value = (e.target as HTMLInputElement).value
}

function commitSetpoint() {
  const next = inputDraft.value
  if (next === (props.nodeData.setpoint || '')) return
  emit('patch', { id: props.nodeData.id, setpoint: next })
}

function onButtonClick() {
  // 刚拖过则忽略 click，避免拖完误触「启动」
  if (movedDuringDrag) return
  emit('select', props.nodeData.id)
}

/** 曲线缓冲：组件私有，不进 Pinia */
const history = ref<number[]>([])
watch(
  () => props.nodeData.bindTag,
  () => {
    history.value = []
  },
)
watch(
  () => [props.nodeData.bindTag, sample.value?.epoch, sample.value?.v] as const,
  () => {
    if (props.nodeData.type !== 'curve') return
    const n = toNum(displayValue.value)
    if (n == null) return
    const max = Math.min(200, Math.max(20, props.nodeData.historySize || 60))
    const next = history.value.slice()
    next.push(n)
    while (next.length > max) next.shift()
    history.value = next
  },
)

const sparkPoints = computed(() => {
  const pts = history.value
  if (pts.length < 2) return '0,20 100,20'
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  return pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * 100
      const y = 36 - ((v - min) / span) * 32
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
})

function formatValue(v: unknown, decimals?: number) {
  if (v == null || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return String(v)
  if (decimals != null && Number.isFinite(decimals)) return n.toFixed(Math.max(0, decimals))
  const abs = Math.abs(n)
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e6)) return n.toExponential(3)
  if (Number.isInteger(n)) return String(n)
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 4 })
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase()
    if (t === 'true' || t === 'on' || t === '1') return true
    if (t === 'false' || t === 'off' || t === '0') return false
    const n = Number(t)
    return Number.isFinite(n) ? n !== 0 : false
  }
  return false
}

const rootEl = ref<HTMLElement | null>(null)

let dragging = false
let rotating = false
let movedDuringDrag = false
let startX = 0
let startY = 0
let origX = 0
let origY = 0

function clamp(x: number, y: number) {
  const maxX = Math.max(0, props.canvasW - props.nodeData.w)
  const maxY = Math.max(0, props.canvasH - props.nodeData.h)
  return {
    x: Math.min(maxX, Math.max(0, Math.round(x))),
    y: Math.min(maxY, Math.max(0, Math.round(y))),
  }
}

function normDeg(deg: number) {
  const m = ((deg % 360) + 360) % 360
  return Math.round(m * 10) / 10
}

function angleFromCenter(e: MouseEvent) {
  const el = rootEl.value
  if (!el) return rotationDeg.value
  const r = el.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  // 手柄在顶部：atan2 相对正右，再 +90 使「正上方」为 0°
  const ang = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90
  return normDeg(ang)
}

function onPointerDown(e: MouseEvent) {
  if (e.button !== 0) return
  if (rotating) return
  // 输入框内要打字，不启动拖拽
  const t = e.target as HTMLElement | null
  if (t?.closest?.('input, textarea, select')) return
  emit('select', props.nodeData.id)
  dragging = true
  movedDuringDrag = false
  startX = e.clientX
  startY = e.clientY
  origX = props.nodeData.x
  origY = props.nodeData.y
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
}

function onPointerMove(e: MouseEvent) {
  if (!dragging) return
  const s = props.viewScale && props.viewScale > 0 ? props.viewScale : 1
  const dx = (e.clientX - startX) / s
  const dy = (e.clientY - startY) / s
  if (Math.abs(dx) + Math.abs(dy) < 2 / s) return
  movedDuringDrag = true
  emit('move', { id: props.nodeData.id, ...clamp(origX + dx, origY + dy) })
}

function onPointerUp() {
  dragging = false
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  // 留给紧随其后的 click 读取；下一帧清掉
  window.setTimeout(() => {
    movedDuringDrag = false
  }, 0)
}

function onRotateDown(e: MouseEvent) {
  if (e.button !== 0) return
  emit('select', props.nodeData.id)
  rotating = true
  dragging = false
  const next = e.shiftKey ? Math.round(angleFromCenter(e) / 15) * 15 : angleFromCenter(e)
  emit('patch', { id: props.nodeData.id, rotation: normDeg(next) })
  window.addEventListener('mousemove', onRotateMove)
  window.addEventListener('mouseup', onRotateUp)
}

function onRotateMove(e: MouseEvent) {
  if (!rotating) return
  let deg = angleFromCenter(e)
  if (e.shiftKey) deg = Math.round(deg / 15) * 15
  emit('patch', { id: props.nodeData.id, rotation: normDeg(deg) })
}

function onRotateUp() {
  rotating = false
  window.removeEventListener('mousemove', onRotateMove)
  window.removeEventListener('mouseup', onRotateUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
  window.removeEventListener('mousemove', onRotateMove)
  window.removeEventListener('mouseup', onRotateUp)
})
</script>

<style scoped lang="scss">
.scada-node {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  transform-origin: center center;
  border: 1px solid rgba(110, 200, 232, 0.28);
  border-radius: 0.45rem;
  background: linear-gradient(180deg, rgba(15, 30, 45, 0.92), rgba(8, 16, 28, 0.92));
  color: #e2e8f0;
  cursor: grab;
  user-select: none;
  touch-action: none;
  padding: 0.25rem 0.4rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

  &:active {
    cursor: grabbing;
  }

  &.is-selected {
    border-color: #67e8f9;
    box-shadow:
      0 0 0 1px rgba(103, 232, 249, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    z-index: 2;
  }

  &.is-alarm {
    border-color: rgba(251, 113, 133, 0.75);
  }

  &.is-stale.is-bound {
    opacity: 0.72;
  }

  &.is-text {
    align-items: flex-start;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
    padding: 0.1rem 0.2rem;
  }

  &.is-pipe {
    border: none;
    background: transparent;
    box-shadow: none;
    padding: 0;
  }

  &.is-panel,
  &.is-rect {
    align-items: flex-start;
    justify-content: flex-start;
    background: rgba(8, 18, 32, 0.45);
    border-style: dashed;
  }

  &.is-image {
    padding: 0;
    overflow: hidden;
  }

  &.is-button {
    padding: 0.2rem;
    background: transparent;
    border-color: transparent;
    box-shadow: none;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }

  &.is-curve {
    align-items: stretch;
    padding: 0.35rem 0.45rem 0.3rem;
  }

  &__text {
    font-weight: 560;
    letter-spacing: 0.04em;
    color: #cbd5e1;
  }

  &__caption {
    font-size: 0.68rem;
    color: #64748b;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__value {
    font-variant-numeric: tabular-nums;
    font-weight: 650;
    letter-spacing: 0.02em;
    line-height: 1.15;

    &.sm {
      font-size: 0.78rem;
    }

    em {
      font-style: normal;
      margin-left: 0.15rem;
      font-size: 0.72em;
      color: #94a3b8;
      font-weight: 500;
    }
  }

  &__input-row {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    width: 100%;
  }

  &__input {
    flex: 1;
    min-width: 0;
    border-radius: 0.3rem;
    border: 1px solid rgba(103, 232, 249, 0.35);
    background: rgba(0, 0, 0, 0.45);
    color: #ecfeff;
    padding: 0.2rem 0.35rem;
    font-size: 0.85rem;
  }

  &__unit {
    font-size: 0.68rem;
    color: #94a3b8;
  }

  &__pv {
    font-size: 0.62rem;
    color: #64748b;
  }

  &__btn {
    width: 100%;
    height: 100%;
    min-height: 2rem;
    border-radius: 0.4rem;
    border: 1px solid rgba(110, 200, 232, 0.45);
    background: linear-gradient(180deg, #1e3a4a, #0f1f2a);
    color: #e2e8f0;
    font-size: 0.82rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    cursor: grab;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 2px 6px rgba(0, 0, 0, 0.35);

    &:active {
      cursor: grabbing;
      transform: translateY(1px);
    }

    &.on {
      border-color: rgba(52, 211, 153, 0.65);
      background: linear-gradient(180deg, #14532d, #052e16);
      color: #bbf7d0;
      box-shadow: 0 0 14px rgba(52, 211, 153, 0.25);
    }
  }

  &__img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    background: #020617;
  }

  &__img-ph {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 0.75rem;
    background:
      linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%) 0 0 / 12px 12px,
      linear-gradient(-45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%) 0 0 / 12px 12px;
  }

  &__curve-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.35rem;
  }

  &__svg {
    flex: 1;
    width: 100%;
    min-height: 2rem;
    color: #22d3ee;
    opacity: 0.9;
  }

  &__lamp {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #64748b, #1e293b 70%);
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.12),
      0 0 0 2px rgba(15, 23, 42, 0.8);

    &.on {
      background: radial-gradient(circle at 35% 30%, #6ee7b7, #059669 70%);
      box-shadow:
        0 0 12px rgba(52, 211, 153, 0.55),
        inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    }
  }

  &__pump {
    width: 2.2rem;
    height: 2.2rem;
    color: #64748b;

    &.on {
      color: #67e8f9;
      animation: spin 1.4s linear infinite;
    }
  }

  &__pipe {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #1e293b, #475569, #1e293b);
    border: 1px solid rgba(148, 163, 184, 0.4);
    box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.35);

    &.flow {
      background: linear-gradient(90deg, #0e7490, #22d3ee, #0e7490);
      background-size: 200% 100%;
      animation: flow 1s linear infinite;
    }
  }

  &__panel-title {
    font-size: 0.72rem;
    color: #94a3b8;
    padding: 0.2rem 0.15rem;
  }

  &__badge {
    position: absolute;
    left: 0.2rem;
    top: -0.85rem;
    font-size: 0.58rem;
    color: #67e8f9;
    background: rgba(8, 18, 32, 0.92);
    padding: 0.05rem 0.3rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(103, 232, 249, 0.3);
    max-width: calc(100% + 2rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
  }

  &__rot {
    position: absolute;
    left: 50%;
    top: -1.35rem;
    width: 0.72rem;
    height: 0.72rem;
    margin: 0;
    padding: 0;
    border-radius: 50%;
    border: 2px solid #67e8f9;
    background: #0ea5e9;
    box-shadow: 0 0 0 1px rgba(8, 18, 32, 0.85);
    transform: translateX(-50%);
    cursor: grab;
    z-index: 3;

    &::before {
      content: '';
      position: absolute;
      left: 50%;
      top: 100%;
      width: 1px;
      height: 0.55rem;
      background: rgba(103, 232, 249, 0.75);
      transform: translateX(-50%);
      pointer-events: none;
    }

    &:active {
      cursor: grabbing;
    }
  }
}

.mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes flow {
  to {
    background-position: -200% 0;
  }
}
</style>
