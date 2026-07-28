<template>
  <aside class="scada-props" @mousedown.stop>
    <header class="scada-props__head">
      <h3>属性</h3>
      <p v-if="node" class="mono">{{ typeLabel }} · {{ shortId }}</p>
      <p v-else class="muted">选中画布图元以编辑</p>
      <p v-if="selectedCount > 1" class="scada-props__hint">已多选 {{ selectedCount }} 个 · 属性编辑最后选中项</p>
    </header>

    <template v-if="node">
      <label>
        {{ nameLabel }}
        <input
          :value="node.text"
          @input="patch({ text: ($event.target as HTMLInputElement).value })" />
      </label>

      <label v-if="node.type === 'image'">
        图片 URL
        <input
          :value="node.imageUrl || ''"
          placeholder="https://… 或 data:image/…"
          @input="patch({ imageUrl: ($event.target as HTMLInputElement).value })" />
      </label>
      <p v-if="node.type === 'image'" class="scada-props__hint">仅允许 http(s) / data:image，防 XSS。</p>

      <label v-if="needsBind">
        绑定点位
        <select :value="node.bindTag" @change="onBindChange">
          <option value="">（不绑定）</option>
          <option v-if="orphanBind" :value="orphanBind.value">{{ orphanBind.label }}</option>
          <option v-for="opt in tagOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </label>

      <div v-if="node.bindTag" class="scada-props__live">
        <span class="k">实时值</span>
        <span class="v mono" :class="{ stale: liveAge != null && liveAge > 5000 }">
          {{ liveText }}
        </span>
        <span v-if="liveAge != null" class="a">{{ liveAge }}ms</span>
      </div>
      <p v-else-if="needsBind" class="scada-props__hint">
        点位来自当前登录系统台账；WebSocket 亦按 JWT 系统隔离。
      </p>
      <p v-if="needsBind && !tagOptions.length" class="scada-props__hint warn">
        台账暂无点位，请先配置设备。
      </p>

      <div v-if="showNumericMeta" class="scada-props__row">
        <label>
          单位
          <input
            :value="node.unit || ''"
            @input="patch({ unit: ($event.target as HTMLInputElement).value })" />
        </label>
        <label>
          小数位
          <input
            type="number"
            min="0"
            max="6"
            :value="node.decimals ?? 1"
            @input="
              patch({
                decimals: num(($event.target as HTMLInputElement).value, node.decimals ?? 1),
              })
            " />
        </label>
      </div>

      <label v-if="node.type === 'curve'">
        曲线点数
        <input
          type="number"
          min="20"
          max="200"
          :value="node.historySize ?? 60"
          @input="
            patch({
              historySize: num(($event.target as HTMLInputElement).value, 60),
            })
          " />
      </label>

      <template v-if="node.type === 'pipe'">
        <div class="scada-props__section">管道</div>
        <label>
          流动方向
          <select
            :value="node.pipeFlowDir || 'forward'"
            @change="
              patch({
                pipeFlowDir:
                  ($event.target as HTMLSelectElement).value === 'reverse' ? 'reverse' : 'forward',
              })
            ">
            <option value="forward">正向（左 → 右）</option>
            <option value="reverse">反向（右 → 左）</option>
          </select>
        </label>
        <label>
          管口边缘
          <select
            :value="node.pipeCorner || 'round'"
            @change="
              patch({
                pipeCorner:
                  ($event.target as HTMLSelectElement).value === 'square' ? 'square' : 'round',
              })
            ">
            <option value="round">圆弧</option>
            <option value="square">直角</option>
          </select>
        </label>
        <p class="scada-props__hint">
          绑定点位为真时播放流动动画；可用旋转改变管道朝向。
        </p>
      </template>

      <label v-if="showAlarm">
        报警阈值（可选）
        <input
          type="number"
          step="any"
          :value="node.style?.alarmThreshold ?? ''"
          placeholder="超过则变红"
          @input="onAlarmThreshold" />
      </label>

      <div class="scada-props__section">外观</div>
      <div class="scada-props__row">
        <label>
          字号
          <input
            type="number"
            min="10"
            max="48"
            :value="node.style?.fontSize ?? 13"
            @input="patchStyle({ fontSize: num(($event.target as HTMLInputElement).value, 13) })" />
        </label>
        <label>
          字体
          <select :value="fontFamilyId" @change="onFontFamily">
            <option v-for="f in SCADA_FONT_OPTIONS" :key="f.id || 'default'" :value="f.id">
              {{ f.label }}
            </option>
          </select>
        </label>
      </div>
      <div class="scada-props__row">
        <label>
          文字色
          <input
            type="color"
            class="scada-props__color"
            :value="toColorInput(node.style?.color, '#ecfeff')"
            @input="patchStyle({ color: ($event.target as HTMLInputElement).value })" />
        </label>
        <label>
          背景
          <input
            type="color"
            class="scada-props__color"
            :value="toColorInput(node.style?.background, '#0f1e2d')"
            @input="patchStyle({ background: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>
      <div class="scada-props__row">
        <label>
          边框色
          <input
            type="color"
            class="scada-props__color"
            :value="toColorInput(node.style?.borderColor, '#22d3ee')"
            @input="patchStyle({ borderColor: ($event.target as HTMLInputElement).value })" />
        </label>
        <label v-if="showAlarm">
          报警色
          <input
            type="color"
            class="scada-props__color"
            :value="toColorInput(node.style?.alarmColor, '#fb7185')"
            @input="patchStyle({ alarmColor: ($event.target as HTMLInputElement).value })" />
        </label>
      </div>
      <div class="scada-props__presets">
        <button
          v-for="p in SCADA_STYLE_PRESETS"
          :key="p.id"
          type="button"
          class="scada-props__chip"
          :title="p.label"
          @click="applyPreset(p.id)">
          {{ p.label }}
        </button>
      </div>
      <p class="scada-props__hint">预设会覆盖当前文字/背景/边框色；「恢复默认」清空自定义外观。</p>

      <p v-if="node.type === 'input'" class="scada-props__hint warn">
        设计页本地设定写入组态稿；运行显示中回车/失焦会下发到已绑定 PLC 点位（须会话已启动）。
      </p>
      <label v-if="node.type === 'input'">
        本地设定
        <input
          :value="node.setpoint || ''"
          placeholder="SV"
          @input="patch({ setpoint: ($event.target as HTMLInputElement).value })" />
      </label>
      <p v-if="node.type === 'button'" class="scada-props__hint">
        按钮亮灭跟随绑定 BOOL/数值；运行显示中点击将写 TRUE 到绑定点（须会话已启动）。
      </p>

      <div class="scada-props__row">
        <label>
          X
          <input
            type="number"
            :value="node.x"
            @input="patch({ x: num(($event.target as HTMLInputElement).value, node.x) })" />
        </label>
        <label>
          Y
          <input
            type="number"
            :value="node.y"
            @input="patch({ y: num(($event.target as HTMLInputElement).value, node.y) })" />
        </label>
      </div>
      <div class="scada-props__row">
        <label>
          W
          <input
            type="number"
            min="12"
            :value="node.w"
            @input="patch({ w: num(($event.target as HTMLInputElement).value, node.w) })" />
        </label>
        <label>
          H
          <input
            type="number"
            min="12"
            :value="node.h"
            @input="patch({ h: num(($event.target as HTMLInputElement).value, node.h) })" />
        </label>
      </div>
      <label>
        旋转 °
        <input
          type="number"
          min="0"
          max="359.9"
          step="1"
          :value="node.rotation ?? 0"
          @input="
            patch({ rotation: num(($event.target as HTMLInputElement).value, node.rotation ?? 0) })
          " />
      </label>
      <div class="scada-props__rot-quick">
        <button
          v-for="deg in [0, 45, 90, 135, 180, 270]"
          :key="deg"
          type="button"
          class="scada-props__chip"
          :class="{ on: Math.round(node.rotation || 0) === deg }"
          @click="patch({ rotation: deg })">
          {{ deg }}°
        </button>
      </div>

      <p class="scada-props__hint">选中后拖四角缩放 · 拖顶部圆点旋转 · [ / ] 微调</p>
      <p class="scada-props__hint">
        Shift 多选 · ⌘/Ctrl+C 复制 · ⌘/Ctrl+V 粘贴 · Delete 删除 · ⌘/Ctrl+S 保存
      </p>

      <button type="button" class="scada-props__danger" @click="emit('remove', node.id)">
        删除图元
      </button>
    </template>
  </aside>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { liveTagKey, useLiveDataStore } from '~/stores/liveData'
import type { PlcDevice } from '~/utils/console/fieldpulseApi'
import {
  SCADA_FONT_OPTIONS,
  SCADA_STYLE_PRESETS,
  SCADA_TYPE_LABELS,
  type ScadaNodeData,
} from '~/utils/console/scadaTypes'

const props = defineProps<{
  node: ScadaNodeData | null
  devices: PlcDevice[]
  selectedCount?: number
}>()

const emit = defineEmits<{
  update: [patch: Partial<ScadaNodeData> & { id: string }]
  remove: [id: string]
}>()

const live = useLiveDataStore()
const { liveDataMap } = storeToRefs(live)

const typeLabel = computed(() =>
  props.node ? SCADA_TYPE_LABELS[props.node.type] || props.node.type : '',
)

const shortId = computed(() => {
  const id = props.node?.id || ''
  return id.length > 16 ? id.slice(-12) : id
})

const nameLabel = computed(() => {
  switch (props.node?.type) {
    case 'button':
      return '按钮文案'
    case 'image':
      return '图片标题'
    default:
      return '显示名'
  }
})

const needsBind = computed(() => {
  const t = props.node?.type
  return t !== 'image' && t !== 'text' && t !== 'panel' && t !== 'rect'
})

const showAlarm = computed(() => {
  const t = props.node?.type
  return t === 'display' || t === 'value' || t === 'curve' || t === 'input'
})

const showNumericMeta = computed(() => {
  const t = props.node?.type
  return t === 'display' || t === 'value' || t === 'input' || t === 'curve'
})

const tagOptions = computed(() => {
  const out: { value: string; label: string }[] = []
  for (const d of props.devices) {
    for (const t of d.tags || []) {
      out.push({
        value: liveTagKey(d.runtimeDeviceId, t.tagKey),
        label: `${d.name}.${t.tagKey} · ${t.dataType}`,
      })
    }
  }
  return out
})

const orphanBind = computed(() => {
  const tag = props.node?.bindTag
  if (!tag) return null
  if (tagOptions.value.some((o) => o.value === tag)) return null
  const name = tag.includes('::') ? tag.split('::').pop() : tag
  return { value: tag, label: `${name}（台账中已不存在）` }
})

const liveSample = computed(() => {
  const tag = props.node?.bindTag
  if (!tag) return undefined
  return liveDataMap.value[tag]
})

const liveAge = computed(() => liveSample.value?.ageMs)

const liveText = computed(() => {
  const v = liveSample.value?.v
  if (v === undefined || v === null || v === '') return '等待推送…'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
})

function patch(partial: Partial<ScadaNodeData>) {
  if (!props.node) return
  emit('update', { id: props.node.id, ...partial })
}

function patchStyle(partial: NonNullable<ScadaNodeData['style']>) {
  patch({
    style: {
      ...(props.node?.style || {}),
      ...partial,
    },
  })
}

function onBindChange(e: Event) {
  patch({ bindTag: (e.target as HTMLSelectElement).value })
}

function onAlarmThreshold(e: Event) {
  const raw = (e.target as HTMLInputElement).value
  const alarmThreshold = raw === '' ? undefined : Number(raw)
  patchStyle({
    alarmThreshold: Number.isFinite(alarmThreshold as number) ? alarmThreshold : undefined,
  })
}

const fontFamilyId = computed(() => {
  const css = props.node?.style?.fontFamily || ''
  const hit = SCADA_FONT_OPTIONS.find((f) => f.css === css)
  return hit?.id ?? ''
})

function onFontFamily(e: Event) {
  const id = (e.target as HTMLSelectElement).value
  const hit = SCADA_FONT_OPTIONS.find((f) => f.id === id)
  patchStyle({ fontFamily: hit?.css || undefined })
}

function toColorInput(raw: string | undefined, fallback: string) {
  if (!raw) return fallback
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim())
  if (m) {
    if (m[1].length === 3) {
      return `#${m[1]
        .split('')
        .map((c) => c + c)
        .join('')}`
    }
    return raw.trim()
  }
  return fallback
}

function applyPreset(id: string) {
  const p = SCADA_STYLE_PRESETS.find((x) => x.id === id)
  if (!p || !props.node) return
  if (id === 'reset') {
    const { alarmThreshold, alarmColor } = props.node.style || {}
    patch({
      style: {
        ...(alarmThreshold != null ? { alarmThreshold } : {}),
        ...(alarmColor ? { alarmColor } : {}),
      },
    })
    return
  }
  patchStyle({ ...p.style })
}

function num(raw: string, fallback: number) {
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}
</script>

<style scoped lang="scss">
.scada-props {
  width: clamp(14rem, 22vw, 17.5rem);
  flex-shrink: 0;
  min-height: 0;
  border-left: 1px solid rgba(110, 200, 232, 0.16);
  background: rgba(0, 0, 0, 0.32);
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  overflow-x: hidden;
  overflow-y: auto;

  &__head {
    h3 {
      margin: 0;
      font-size: 0.82rem;
      color: #cbd5e1;
      font-weight: 500;
    }
    p {
      margin: 0.25rem 0 0;
      font-size: 0.68rem;
    }
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
    font-size: 0.7rem;
    color: #94a3b8;
  }

  input,
  select {
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #e2e8f0;
    padding: 0.35rem 0.45rem;
    font-size: 0.78rem;
  }

  &__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.45rem;
  }

  &__section {
    margin-top: 0.15rem;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: #67e8f9;
    text-transform: uppercase;
  }

  &__color {
    height: 1.85rem;
    padding: 0.1rem !important;
    cursor: pointer;
  }

  &__presets,
  &__rot-quick {
    display: flex;
    flex-wrap: wrap;
    gap: 0.28rem;
  }

  &__chip {
    border-radius: 0.3rem;
    border: 1px solid rgba(148, 163, 184, 0.28);
    background: transparent;
    color: #94a3b8;
    padding: 0.2rem 0.4rem;
    font-size: 0.62rem;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    cursor: pointer;

    &.on,
    &:hover {
      color: #ecfeff;
      border-color: rgba(103, 232, 249, 0.55);
      background: rgba(34, 211, 238, 0.12);
    }
  }

  &__hint {
    margin: -0.1rem 0 0;
    font-size: 0.65rem;
    color: #64748b;
    line-height: 1.4;

    &.warn {
      color: #fbbf24;
    }
  }

  &__live {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.35rem;
    align-items: baseline;
    padding: 0.4rem 0.5rem;
    border-radius: 0.35rem;
    background: rgba(34, 211, 238, 0.06);
    border: 1px solid rgba(34, 211, 238, 0.18);

    .k {
      font-size: 0.65rem;
      color: #64748b;
    }
    .v {
      font-size: 0.85rem;
      color: #ecfeff;
      word-break: break-all;

      &.stale {
        color: #fbbf24;
      }
    }
    .a {
      font-size: 0.62rem;
      color: #67e8f9;
      font-family: ui-monospace, 'IBM Plex Mono', monospace;
    }
  }

  &__danger {
    margin-top: auto;
    border: 1px solid rgba(252, 165, 165, 0.35);
    background: transparent;
    color: #fca5a5;
    border-radius: 0.35rem;
    padding: 0.4rem;
    cursor: pointer;
    font-size: 0.75rem;
  }
}

.mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
}

.muted {
  color: #64748b;
}
</style>
