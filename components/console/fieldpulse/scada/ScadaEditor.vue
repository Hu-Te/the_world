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
        <div class="scada-editor__edit-ops" role="group" aria-label="编辑">
          <button
            type="button"
            class="scada-editor__btn ghost"
            :disabled="!selectedIds.length"
            title="复制到剪贴板 · ⌘/Ctrl+C"
            @click="copySelection">
            复制
          </button>
          <button
            type="button"
            class="scada-editor__btn ghost"
            :disabled="!clipboard.length"
            title="粘贴剪贴板内容 · ⌘/Ctrl+V"
            @click="pasteClipboard">
            粘贴{{ clipboard.length ? `(${clipboard.length})` : '' }}
          </button>
        </div>
        <div class="scada-editor__align" role="group" aria-label="对齐">
          <button
            v-for="a in alignActions"
            :key="a.mode"
            type="button"
            class="scada-editor__btn ghost"
            :disabled="selectedIds.length < 2"
            :title="a.title"
            @click="alignSelection(a.mode)">
            {{ a.label }}
          </button>
        </div>
        <button type="button" class="scada-editor__btn" :disabled="!dirty || !canPersist" @click="saveDoc">
          {{ persistLabel }}
        </button>
        <button
          type="button"
          class="scada-editor__btn ghost danger"
          :disabled="!canPersist || !doc.nodes.length"
          title="清空画布全部图元并同步云端"
          @click="clearDoc">
          清空
        </button>
        <a
          class="scada-editor__btn ghost"
          href="/console/fieldpulse/scada-view"
          target="_blank"
          rel="noopener"
          @click="onOpenRuntime">
          运行屏
        </a>
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
        @mousedown.self="clearSelection">
        <div
          class="scada-editor__stage"
          :style="{ width: stageW + 'px', height: stageH + 'px' }"
          @mousedown.self="clearSelection">
          <div
            class="scada-editor__board"
            :style="boardStyle"
            @mousedown.self="clearSelection">
            <div class="scada-editor__grid" aria-hidden="true" />
            <ScadaNode
              v-for="n in doc.nodes"
              :key="n.id"
              :node-data="n"
              :selected="selectedIds.includes(n.id)"
              :canvas-w="doc.width"
              :canvas-h="doc.height"
              :view-scale="viewScale"
              @select="onSelect"
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
        :selected-count="selectedIds.length"
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
  isValidScadaOwner,
  newNodeId,
  normalizeNode,
  parseImportDocument,
  sameScadaOwner,
  type ScadaDocument,
  type ScadaNodeData,
  type ScadaNodeType,
  type ScadaOwnerId,
} from '~/utils/console/scadaTypes'

const props = defineProps<{
  devices: PlcDevice[]
  tenantId: ScadaOwnerId
  userId: ScadaOwnerId
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

const canPersist = computed(() =>
  isValidScadaOwner({ tenantId: props.tenantId, ownerUserId: props.userId }),
)

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
/** 多选：最后一项为属性面板主选 */
const selectedIds = ref<string[]>([])
const clipboard = ref<ScadaNodeData[]>([])
const dirty = ref(false)
const viewportEl = ref<HTMLElement | null>(null)
/** 逻辑画布 → 视口的等比缩放，保证铺满且不出现滚动条 */
const viewScale = ref(1)
const VIEW_PAD = 12
const PASTE_OFFSET = 24

type AlignMode = 'left' | 'right' | 'hcenter' | 'top' | 'bottom' | 'vcenter'
const alignActions: { mode: AlignMode; label: string; title: string }[] = [
  { mode: 'left', label: '左齐', title: '左对齐' },
  { mode: 'hcenter', label: '水平中', title: '水平居中对齐' },
  { mode: 'right', label: '右齐', title: '右对齐' },
  { mode: 'top', label: '顶齐', title: '顶对齐' },
  { mode: 'vcenter', label: '垂直中', title: '垂直居中对齐' },
  { mode: 'bottom', label: '底齐', title: '底对齐' },
]

const stageW = computed(() => Math.max(1, Math.round(doc.value.width * viewScale.value)))
const stageH = computed(() => Math.max(1, Math.round(doc.value.height * viewScale.value)))
const scalePct = computed(() => Math.round(viewScale.value * 100))
const boardStyle = computed(() => ({
  width: `${doc.value.width}px`,
  height: `${doc.value.height}px`,
  transform: `scale(${viewScale.value})`,
}))

const selectedNode = computed(() => {
  const id = selectedIds.value[selectedIds.value.length - 1]
  if (!id) return null
  return doc.value.nodes.find((n) => n.id === id) ?? null
})

function clearSelection() {
  selectedIds.value = []
}

function onSelect(payload: { id: string; additive: boolean }) {
  const { id, additive } = payload
  if (additive) {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter((x) => x !== id)
    } else {
      selectedIds.value = [...selectedIds.value, id]
    }
    return
  }
  // 已在多选组内再点一次：保持多选，便于整体拖动
  if (selectedIds.value.length > 1 && selectedIds.value.includes(id)) return
  selectedIds.value = [id]
}

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

async function reloadFromServer(opts?: { quiet?: boolean }) {
  if (!canPersist.value) {
    doc.value = createEmptyScadaDoc('产线概览')
    dirty.value = false
    selectedIds.value = []
    return
  }
  try {
    const loaded = await scadaStore.load(owner.value)
    doc.value = loaded
    dirty.value = false
    selectedIds.value = []
    if (!opts?.quiet && loaded.nodes.length > 0) {
      emit('restored', loaded.nodes.length)
    }
  } catch (e) {
    emit('error', e instanceof Error ? e.message : String(e))
  }
}

watch(
  () => [props.tenantId, props.userId] as const,
  () => {
    void reloadFromServer()
  },
  { immediate: true },
)

/** keepalive / 焦点 / 同伴保存：有未保存编辑时不覆盖 */
function reloadIfClean() {
  if (dirty.value) {
    nextTick(() => measureFit())
    return
  }
  void reloadFromServer({ quiet: true }).then(() => nextTick(() => measureFit()))
}

function markDirty() {
  dirty.value = true
  if (!canPersist.value) return
  doc.value.tenantId = owner.value.tenantId
  doc.value.ownerUserId = owner.value.ownerUserId
}

function onOpenRuntime(e: MouseEvent) {
  e.preventDefault()
  if (dirty.value) {
    const ok = confirm('有未保存修改，打开运行屏将看到数据库中的旧稿。仍要打开？')
    if (!ok) return
  }
  window.open('/console/fieldpulse/scada-view', '_blank', 'noopener')
}

async function saveDoc() {
  if (!canPersist.value) {
    emit('error', '请先登录后再保存')
    return
  }
  try {
    const orphans = countOrphanBinds()
    if (!doc.value.nodes.length) {
      const ok = confirm('确认将空画面保存到数据库？（将覆盖云端当前设计稿）')
      if (!ok) return
    }
    const stamped = await scadaStore.save(doc.value, owner.value)
    doc.value = stamped
    dirty.value = false
    emit('saved', doc.value)
    if (orphans > 0) {
      emit('error', `已保存，但有 ${orphans} 个图元绑定点位不在当前台账（设备改址或已删除）`)
    }
  } catch (e) {
    emit('error', e instanceof Error ? e.message : String(e))
  }
}

async function clearDoc() {
  if (!canPersist.value) return
  const n = doc.value.nodes.length
  if (!n) return
  const ok = confirm(`确认清空组态？将删除 ${n} 个图元并写入数据库。此操作不可撤销。`)
  if (!ok) return
  selectedIds.value = []
  doc.value = {
    ...doc.value,
    nodes: [],
    tenantId: owner.value.tenantId,
    ownerUserId: owner.value.ownerUserId,
  }
  dirty.value = true
  try {
    const stamped = await scadaStore.save(doc.value, owner.value)
    doc.value = stamped
    dirty.value = false
    emit('saved', doc.value)
  } catch (e) {
    emit('error', e instanceof Error ? e.message : String(e))
  }
}

defineExpose({ saveDoc, reloadIfClean })

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
  selectedIds.value = [n.id]
  markDirty()
}

function clampNodePos(n: Pick<ScadaNodeData, 'x' | 'y' | 'w' | 'h'>) {
  return {
    x: Math.min(Math.max(0, n.x), Math.max(0, doc.value.width - n.w)),
    y: Math.min(Math.max(0, n.y), Math.max(0, doc.value.height - n.h)),
  }
}

function onMove(payload: { id: string; x: number; y: number }) {
  const n = doc.value.nodes.find((x) => x.id === payload.id)
  if (!n) return
  const dx = payload.x - n.x
  const dy = payload.y - n.y
  const group =
    selectedIds.value.includes(payload.id) && selectedIds.value.length > 1
      ? selectedIds.value
      : [payload.id]
  for (const id of group) {
    const node = doc.value.nodes.find((x) => x.id === id)
    if (!node) continue
    const next = clampNodePos({
      x: node.x + dx,
      y: node.y + dy,
      w: node.w,
      h: node.h,
    })
    node.x = next.x
    node.y = next.y
  }
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
  const pos = clampNodePos(next)
  next.x = pos.x
  next.y = pos.y
  doc.value.nodes[i] = next
  markDirty()
}

function onRemoveNode(id: string) {
  const drop = selectedIds.value.includes(id) ? new Set(selectedIds.value) : new Set([id])
  doc.value.nodes = doc.value.nodes.filter((n) => !drop.has(n.id))
  selectedIds.value = selectedIds.value.filter((x) => !drop.has(x))
  markDirty()
}

function selectedNodes(): ScadaNodeData[] {
  const set = new Set(selectedIds.value)
  return doc.value.nodes.filter((n) => set.has(n.id))
}

function alignSelection(mode: AlignMode) {
  const nodes = selectedNodes()
  if (nodes.length < 2) return
  const left = Math.min(...nodes.map((n) => n.x))
  const top = Math.min(...nodes.map((n) => n.y))
  const right = Math.max(...nodes.map((n) => n.x + n.w))
  const bottom = Math.max(...nodes.map((n) => n.y + n.h))
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  for (const n of nodes) {
    if (mode === 'left') n.x = left
    else if (mode === 'right') n.x = right - n.w
    else if (mode === 'hcenter') n.x = Math.round(cx - n.w / 2)
    else if (mode === 'top') n.y = top
    else if (mode === 'bottom') n.y = bottom - n.h
    else if (mode === 'vcenter') n.y = Math.round(cy - n.h / 2)
    const pos = clampNodePos(n)
    n.x = pos.x
    n.y = pos.y
  }
  markDirty()
}

function cloneNodeData(n: ScadaNodeData): ScadaNodeData {
  // Vue 响应式 Proxy 不能 structuredClone，用 JSON 深拷贝
  return normalizeNode(JSON.parse(JSON.stringify(toRaw(n))) as ScadaNodeData)
}

function cloneNodesWithOffset(source: ScadaNodeData[], dx: number, dy: number): ScadaNodeData[] {
  return source.map((n) => {
    const copy = cloneNodeData(n)
    copy.id = newNodeId()
    copy.x = n.x + dx
    copy.y = n.y + dy
    const pos = clampNodePos(copy)
    copy.x = pos.x
    copy.y = pos.y
    return copy
  })
}

/** 仅写入内部剪贴板；不改动画布 */
function copySelection() {
  const nodes = selectedNodes()
  if (!nodes.length) return
  clipboard.value = nodes.map((n) => cloneNodeData(n))
}

function pasteClipboard() {
  if (!clipboard.value.length) return
  const news = cloneNodesWithOffset(clipboard.value, PASTE_OFFSET, PASTE_OFFSET)
  // 连续粘贴继续相对上次粘贴位置偏移
  clipboard.value = news.map((n) => cloneNodeData(n))
  doc.value.nodes.push(...news)
  selectedIds.value = news.map((n) => n.id)
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
    if (!canPersist.value) throw new Error('请先登录后再导入')
    const text = await file.text()
    const parsed = JSON.parse(text) as ScadaDocument
    if (!parsed?.nodes || !Array.isArray(parsed.nodes)) throw new Error('无效组态 JSON')
    if (
      parsed.tenantId != null &&
      parsed.ownerUserId != null &&
      !sameScadaOwner(
        { tenantId: parsed.tenantId, ownerUserId: parsed.ownerUserId },
        owner.value,
      )
    ) {
      const ok = confirm('该 JSON 归属其他账号。导入将改挂到当前账号并保存到数据库。继续？')
      if (!ok) return
    }
    const owned =
      parseImportDocument(parsed, owner.value) ??
      createEmptyScadaDoc(parsed.name || '产线概览', owner.value)
    // 保留当前 revision，避免覆盖云端时乐观锁失败
    owned.revision = doc.value.revision
    doc.value = owned
    selectedIds.value = []
    dirty.value = true
    await saveDoc()
  } catch (err) {
    emit('error', err instanceof Error ? err.message : String(err))
  } finally {
    ;(e.target as HTMLInputElement).value = ''
  }
}

function onKeydown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.value.length) {
    e.preventDefault()
    onRemoveNode(selectedIds.value[selectedIds.value.length - 1]!)
  }
  if ((e.key === 's' || e.key === 'S') && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    if (canPersist.value) saveDoc()
  }
  if ((e.key === 'c' || e.key === 'C') && (e.metaKey || e.ctrlKey) && !e.altKey) {
    e.preventDefault()
    copySelection()
  }
  if ((e.key === 'v' || e.key === 'V') && (e.metaKey || e.ctrlKey) && !e.altKey) {
    e.preventDefault()
    pasteClipboard()
  }
  if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey) && !e.altKey) {
    e.preventDefault()
    selectedIds.value = doc.value.nodes.map((n) => n.id)
  }
  if ((e.key === '[' || e.key === ']') && selectedIds.value.length) {
    e.preventDefault()
    const step = e.shiftKey ? 90 : 15
    const delta = e.key === ']' ? step : -step
    for (const id of selectedIds.value) {
      const n = doc.value.nodes.find((x) => x.id === id)
      if (!n) continue
      const cur = Number(n.rotation) || 0
      onUpdateNode({ id: n.id, rotation: ((cur + delta) % 360 + 360) % 360 })
    }
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
  text-decoration: none;
  display: inline-flex;
  align-items: center;

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }

  &.ghost {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.12);
    color: #94a3b8;
  }

  &.danger {
    border-color: rgba(248, 113, 113, 0.45);
    color: #fca5a5;

    &:not(:disabled):hover {
      background: rgba(248, 113, 113, 0.12);
    }
  }

  &.file {
    display: inline-flex;
    align-items: center;
  }
}

.scada-editor__edit-ops,
.scada-editor__align {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.28rem;
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
