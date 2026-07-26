<template>
  <div class="scada-editor">
    <div class="scada-editor__toolbar">
      <div class="scada-editor__tools">
        <button
          v-for="t in palette"
          :key="t.type"
          type="button"
          class="scada-editor__tool"
          @click="addNode(t.type)">
          + {{ t.label }}
        </button>
      </div>
      <div class="scada-editor__meta">
        <input v-model="doc.name" class="scada-editor__name" placeholder="画面名称" @input="markDirty" />
        <span class="scada-editor__size mono"
          >{{ doc.width }}×{{ doc.height }} · {{ scalePct }}%</span
        >
        <span v-if="ownerLabel" class="scada-editor__owner mono" :title="ownerLabel">{{
          ownerLabel
        }}</span>
        <button type="button" class="scada-editor__btn" :disabled="!dirty || !canPersist" @click="saveDoc">
          {{ persistLabel }}
        </button>
        <button type="button" class="scada-editor__btn ghost" @click="exportJson">导出 JSON</button>
        <label class="scada-editor__btn ghost file">
          导入
          <input type="file" accept="application/json,.json" hidden @change="importJson" />
        </label>
      </div>
    </div>

    <div class="scada-editor__body">
      <div
        ref="viewportEl"
        class="scada-editor__viewport"
        @mousedown.self="selectedId = null">
        <div
          class="scada-editor__stage"
          :style="{ width: stageW + 'px', height: stageH + 'px' }"
          @mousedown.self="selectedId = null">
          <div
            class="scada-editor__board"
            :style="boardStyle"
            @mousedown.self="selectedId = null">
            <div class="scada-editor__grid" aria-hidden="true" />
            <ScadaNode
              v-for="n in doc.nodes"
              :key="n.id"
              :node-data="n"
              :selected="n.id === selectedId"
              :canvas-w="doc.width"
              :canvas-h="doc.height"
              :view-scale="viewScale"
              @select="selectedId = $event"
              @move="onMove"
              @patch="onUpdateNode" />
            <p v-if="!doc.nodes.length" class="scada-editor__empty">
              从上方添加工件，拖到画布中央开始组态
            </p>
          </div>
        </div>
      </div>

      <ScadaPropertyPanel
        :node="selectedNode"
        :devices="devices"
        @update="onUpdateNode"
        @remove="onRemoveNode" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ScadaNode from '~/components/console/fieldpulse/scada/ScadaNode.vue'
import ScadaPropertyPanel from '~/components/console/fieldpulse/scada/ScadaPropertyPanel.vue'
import { useScadaDocStore } from '~/stores/scadaDoc'
import type { PlcDevice } from '~/utils/console/fieldpulseApi'
import {
  createEmptyScadaDoc,
  createScadaNode,
  normalizeNode,
  parseOwnedDocument,
  type ScadaDocument,
  type ScadaNodeData,
  type ScadaNodeType,
} from '~/utils/console/scadaTypes'

const props = defineProps<{
  devices: PlcDevice[]
  tenantId: number
  userId: number
}>()

const emit = defineEmits<{
  saved: [doc: ScadaDocument]
  error: [message: string]
  restored: [count: number]
}>()

const scadaStore = useScadaDocStore()

const palette: { type: ScadaNodeType; label: string }[] = [
  { type: 'text', label: '文本' },
  { type: 'display', label: '显示框' },
  { type: 'input', label: '输入框' },
  { type: 'button', label: '按钮' },
  { type: 'image', label: '图片' },
  { type: 'curve', label: '曲线' },
  { type: 'lamp', label: '指示灯' },
  { type: 'pump', label: '水泵' },
  { type: 'pipe', label: '管道' },
  { type: 'panel', label: '面板' },
]

const owner = computed(() => ({
  tenantId: props.tenantId,
  ownerUserId: props.userId,
}))

const canPersist = computed(() => props.tenantId > 0 && props.userId > 0)

const persistLabel = computed(() => {
  if (!canPersist.value) return '需登录'
  if (dirty.value) return '保存*'
  if (!doc.value.nodes.length) return '空画面'
  return '已保存'
})

const ownerLabel = computed(() => {
  if (!canPersist.value) return ''
  return `T${props.tenantId}/U${props.userId}`
})

const doc = ref<ScadaDocument>(createEmptyScadaDoc('产线概览'))
const selectedId = ref<string | null>(null)
const dirty = ref(false)
const viewportEl = ref<HTMLElement | null>(null)
/** 逻辑画布 → 视口的等比缩放，保证铺满且不出现滚动条 */
const viewScale = ref(1)
const VIEW_PAD = 12

const stageW = computed(() => Math.max(1, Math.round(doc.value.width * viewScale.value)))
const stageH = computed(() => Math.max(1, Math.round(doc.value.height * viewScale.value)))
const scalePct = computed(() => Math.round(viewScale.value * 100))
const boardStyle = computed(() => ({
  width: `${doc.value.width}px`,
  height: `${doc.value.height}px`,
  transform: `scale(${viewScale.value})`,
}))

const selectedNode = computed(
  () => doc.value.nodes.find((n) => n.id === selectedId.value) ?? null,
)

function measureFit() {
  const el = viewportEl.value
  if (!el) return
  const aw = Math.max(0, el.clientWidth - VIEW_PAD * 2)
  const ah = Math.max(0, el.clientHeight - VIEW_PAD * 2)
  if (aw < 48 || ah < 48) return
  const s = Math.min(aw / doc.value.width, ah / doc.value.height)
  viewScale.value = Math.max(0.12, Math.min(s, 3))
}

let resizeObserver: ResizeObserver | null = null

function reloadForOwner() {
  if (!canPersist.value) {
    // 未登录：只展示空稿，禁止用空稿覆盖已缓存的登录用户画面
    doc.value = createEmptyScadaDoc('产线概览')
    dirty.value = false
    selectedId.value = null
    return
  }
  const loaded = scadaStore.load(owner.value)
  doc.value = loaded
  dirty.value = false
  selectedId.value = null
  if (loaded.nodes.length > 0) {
    emit('restored', loaded.nodes.length)
  }
}

watch(
  () => [props.tenantId, props.userId] as const,
  () => reloadForOwner(),
  { immediate: true },
)

/** keepalive 切回本页：再从磁盘/内存合并一次，修复空稿误显 */
function reloadFromCache() {
  reloadForOwner()
  nextTick(() => measureFit())
}

function markDirty() {
  dirty.value = true
  if (!canPersist.value) return
  doc.value.updatedAt = new Date().toISOString()
  doc.value.tenantId = owner.value.tenantId
  doc.value.ownerUserId = owner.value.ownerUserId
  scadaStore.remember(doc.value, owner.value)
}

function saveDoc() {
  try {
    const orphans = countOrphanBinds()
    const stamped = scadaStore.save(doc.value, owner.value)
    if (stamped) {
      doc.value = stamped
      dirty.value = false
      emit('saved', doc.value)
    } else if (!doc.value.nodes.length) {
      // 空稿被拒写：拉回磁盘非空稿
      const recovered = scadaStore.load(owner.value)
      if (recovered.nodes.length > 0) {
        doc.value = recovered
        dirty.value = false
        emit('restored', recovered.nodes.length)
        emit('error', '当前为空画面，已从本机缓存恢复组态，未覆盖原文件')
        return
      }
      emit('error', '空画面未写入缓存（避免覆盖已有组态）')
      return
    }
    if (orphans > 0) {
      emit('error', `已保存，但有 ${orphans} 个图元绑定点位不在当前台账（设备改址或已删除）`)
    }
  } catch (e) {
    emit('error', e instanceof Error ? e.message : String(e))
  }
}

/** 离开页面 / 关页：强制内存与 localStorage 对齐（空稿不会覆盖非空磁盘） */
function flushPersist() {
  if (!canPersist.value) return
  try {
    const stamped = scadaStore.flush(doc.value, owner.value)
    if (stamped) {
      doc.value = stamped
      dirty.value = false
    }
  } catch (e) {
    emit('error', e instanceof Error ? e.message : String(e))
  }
}

defineExpose({ flushPersist, saveDoc, reloadFromCache })

function countOrphanBinds() {
  const valid = new Set<string>()
  for (const d of props.devices) {
    for (const t of d.tags || []) {
      valid.add(`${d.runtimeDeviceId}::${t.tagKey}`)
    }
  }
  let n = 0
  for (const node of doc.value.nodes) {
    if (node.bindTag && !valid.has(node.bindTag)) n += 1
  }
  return n
}

function addNode(type: ScadaNodeType) {
  const n = createScadaNode(type, {
    x: 60 + (doc.value.nodes.length % 6) * 28,
    y: 60 + (doc.value.nodes.length % 5) * 28,
  })
  n.x = Math.min(n.x, Math.max(0, doc.value.width - n.w))
  n.y = Math.min(n.y, Math.max(0, doc.value.height - n.h))
  doc.value.nodes.push(n)
  selectedId.value = n.id
  markDirty()
}

function onMove(payload: { id: string; x: number; y: number }) {
  const n = doc.value.nodes.find((x) => x.id === payload.id)
  if (!n) return
  n.x = payload.x
  n.y = payload.y
  markDirty()
}

function onUpdateNode(patch: Partial<ScadaNodeData> & { id: string }) {
  const i = doc.value.nodes.findIndex((n) => n.id === patch.id)
  if (i < 0) return
  const cur = doc.value.nodes[i]
  const next = normalizeNode({
    ...cur,
    ...patch,
    style: patch.style ? { ...(cur.style || {}), ...patch.style } : cur.style,
  })
  next.x = Math.min(Math.max(0, next.x), Math.max(0, doc.value.width - next.w))
  next.y = Math.min(Math.max(0, next.y), Math.max(0, doc.value.height - next.h))
  doc.value.nodes[i] = next
  markDirty()
}

function onRemoveNode(id: string) {
  doc.value.nodes = doc.value.nodes.filter((n) => n.id !== id)
  if (selectedId.value === id) selectedId.value = null
  markDirty()
}

function exportJson() {
  const payload = {
    ...doc.value,
    tenantId: owner.value.tenantId,
    ownerUserId: owner.value.ownerUserId,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${doc.value.name || 'scada'}-t${owner.value.tenantId}-u${owner.value.ownerUserId}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function importJson(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    if (!canPersist.value) throw new Error('请先登录后再导入，避免写入共享缓存')
    const text = await file.text()
    const parsed = JSON.parse(text) as ScadaDocument
    if (!parsed?.nodes || !Array.isArray(parsed.nodes)) throw new Error('无效组态 JSON')
    // 导入后强制改挂到当前用户，防止把别人的归属写进本机键
    if (
      parsed.tenantId != null &&
      parsed.ownerUserId != null &&
      (Number(parsed.tenantId) !== owner.value.tenantId ||
        Number(parsed.ownerUserId) !== owner.value.ownerUserId)
    ) {
      const ok = confirm(
        '该 JSON 归属其他租户/用户。导入将改挂到当前账号（不会写回对方存储）。继续？',
      )
      if (!ok) return
    }
    const owned =
      parseOwnedDocument(
        JSON.stringify({
          ...parsed,
          tenantId: owner.value.tenantId,
          ownerUserId: owner.value.ownerUserId,
        }),
        owner.value,
      ) ?? createEmptyScadaDoc(parsed.name || '产线概览', owner.value)
    owned.nodes = parsed.nodes.map((n) => normalizeNode(n))
    doc.value = owned
    selectedId.value = null
    saveDoc()
  } catch (err) {
    emit('error', err instanceof Error ? err.message : String(err))
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId.value) {
    e.preventDefault()
    onRemoveNode(selectedId.value)
  }
  if ((e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    if (canPersist.value) saveDoc()
  }
  if ((e.key === '[' || e.key === ']') && selectedId.value) {
    e.preventDefault()
    const n = doc.value.nodes.find((x) => x.id === selectedId.value)
    if (!n) return
    const step = e.shiftKey ? 90 : 15
    const delta = e.key === ']' ? step : -step
    const cur = Number(n.rotation) || 0
    onUpdateNode({ id: n.id, rotation: ((cur + delta) % 360 + 360) % 360 })
  }
}

watch(
  () => [doc.value.width, doc.value.height] as const,
  () => nextTick(measureFit),
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  resizeObserver = new ResizeObserver(() => measureFit())
  nextTick(() => {
    if (viewportEl.value) resizeObserver?.observe(viewportEl.value)
    measureFit()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped lang="scss">
.scada-editor {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  min-height: 0;
  height: 100%;
  width: 100%;
}

.scada-editor__toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.4rem;
  flex-shrink: 0;
  width: 100%;
}

.scada-editor__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: 100%;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(110, 200, 232, 0.14);
  background: rgba(0, 0, 0, 0.22);
}

.scada-editor__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem 0.55rem;
  width: 100%;
}

.scada-editor__tool,
.scada-editor__btn {
  border-radius: 0.35rem;
  border: 1px solid rgba(110, 200, 232, 0.35);
  background: rgba(110, 200, 232, 0.1);
  color: #ecfeff;
  padding: 0.32rem 0.55rem;
  font-size: 0.66rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }

  &.ghost {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.12);
    color: #94a3b8;
  }

  &.file {
    display: inline-flex;
    align-items: center;
  }
}

.scada-editor__name {
  width: 9rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.35);
  color: #e2e8f0;
  padding: 0.32rem 0.45rem;
  font-size: 0.75rem;
  text-align: center;
}

.scada-editor__size,
.scada-editor__owner {
  font-size: 0.62rem;
  color: #64748b;
}

.scada-editor__owner {
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.scada-editor__body {
  flex: 1;
  min-height: 0;
  display: flex;
  width: 100%;
  border: 1px solid rgba(110, 200, 232, 0.16);
  border-radius: 0.55rem;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.22);
}

.scada-editor__viewport {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050b12;
}

/* stage 用缩放后的占位尺寸；board 绝对定位 + transform 等比适配 */
.scada-editor__stage {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.scada-editor__board {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
  background: #071018;
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.14),
    0 12px 40px rgba(0, 0, 0, 0.45);
}

.scada-editor__grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
}

.scada-editor__empty {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  color: #64748b;
  font-size: 0.85rem;
  pointer-events: none;
  max-width: 18rem;
  text-align: center;
  line-height: 1.55;
}

.mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
}
</style>
