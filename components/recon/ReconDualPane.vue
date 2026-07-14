<template>
  <div ref="rootRef" class="recon-pane" :class="{ 'recon-pane--disabled': disabled }">
    <svg
      class="recon-pane__svg"
      aria-hidden="true"
      :viewBox="`0 0 ${Math.max(svgW, 1)} ${Math.max(svgH, 1)}`"
      :width="Math.max(svgW, 1)"
      :height="Math.max(svgH, 1)"
      preserveAspectRatio="none">
      <path
        v-for="line in lines"
        :key="line.key"
        :d="line.d"
        class="recon-pane__path"
        :class="`recon-pane__path--${line.tone}`"
        fill="none" />
    </svg>

    <div ref="corpColRef" class="recon-pane__col">
      <header class="recon-pane__head">企业日记账 · {{ visibleCorp.length }}</header>
      <ul ref="corpListRef" class="recon-pane__list">
        <li
          v-for="row in visibleCorp"
          :key="row.id"
          :ref="(el) => setRowEl('corp', row.id, el)"
          class="recon-pane__row"
          :class="{
            'recon-pane__row--active': selectedCorp.has(row.id),
            'recon-pane__row--matched': isLockedMatch(row.matchStatus),
            'recon-pane__row--fuzzy': isFuzzyMatch(row.matchStatus),
            'recon-pane__row--locked': !canSelect(row),
          }"
          @click="toggleCorp(row)">
          <div class="recon-pane__row-top">
            <span class="recon-pane__date">{{ row.date }}</span>
            <span class="recon-pane__badge">{{ STATUS_LABEL[row.matchStatus] }}</span>
          </div>
          <p class="recon-pane__party">{{ row.counterparty || '—' }}</p>
          <p class="recon-pane__summary">{{ row.summary || '无摘要' }}</p>
          <p class="recon-pane__amt">
            <span v-if="row.debit">收 {{ fmt(row.debit) }}</span>
            <span v-if="row.credit">付 {{ fmt(row.credit) }}</span>
          </p>
          <button
            v-if="isFuzzyMatch(row.matchStatus) && row.matchGroupId != null"
            type="button"
            class="recon-pane__confirm"
            :disabled="disabled"
            @click.stop="emit('confirm-fuzzy', row.matchGroupId!)">
            确认疑似
          </button>
        </li>
      </ul>
    </div>

    <div ref="bankColRef" class="recon-pane__col">
      <header class="recon-pane__head">银行对账单 · {{ visibleBank.length }}</header>
      <ul ref="bankListRef" class="recon-pane__list">
        <li
          v-for="row in visibleBank"
          :key="row.id"
          :ref="(el) => setRowEl('bank', row.id, el)"
          class="recon-pane__row"
          :class="{
            'recon-pane__row--active': selectedBank.has(row.id),
            'recon-pane__row--matched': isLockedMatch(row.matchStatus),
            'recon-pane__row--fuzzy': isFuzzyMatch(row.matchStatus),
            'recon-pane__row--locked': !canSelect(row),
          }"
          @click="toggleBank(row)">
          <div class="recon-pane__row-top">
            <span class="recon-pane__date">{{ row.date }}</span>
            <span class="recon-pane__badge">{{ STATUS_LABEL[row.matchStatus] }}</span>
          </div>
          <p class="recon-pane__party">{{ row.counterparty || '—' }}</p>
          <p class="recon-pane__summary">{{ row.summary || '无摘要' }}</p>
          <p class="recon-pane__amt">
            <span v-if="row.debit">收 {{ fmt(row.debit) }}</span>
            <span v-if="row.credit">付 {{ fmt(row.credit) }}</span>
          </p>
          <button
            v-if="isFuzzyMatch(row.matchStatus) && row.matchGroupId != null"
            type="button"
            class="recon-pane__confirm"
            :disabled="disabled"
            @click.stop="emit('confirm-fuzzy', row.matchGroupId!)">
            确认疑似
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ReconEntry, ReconFilter, ReconId, ReconLink } from '~/utils/recon/types'
import { STATUS_LABEL, isFuzzyMatch, isLockedMatch } from '~/utils/recon/types'

const props = defineProps<{
  corp: ReconEntry[]
  bank: ReconEntry[]
  links: ReconLink[]
  filter: ReconFilter
  /** 请求进行中时禁止点选 / 确认 */
  disabled?: boolean
}>()

const emit = defineEmits<{
  link: [corpIds: ReconId[], bankIds: ReconId[]]
  'confirm-fuzzy': [groupId: ReconId]
}>()

const rootRef = ref<HTMLElement | null>(null)
const corpColRef = ref<HTMLElement | null>(null)
const bankColRef = ref<HTMLElement | null>(null)
const corpListRef = ref<HTMLElement | null>(null)
const bankListRef = ref<HTMLElement | null>(null)
const selectedCorp = ref(new Set<ReconId>())
const selectedBank = ref(new Set<ReconId>())
const rowEls = new Map<string, HTMLElement>()
const svgW = ref(0)
const svgH = ref(0)

const lines = ref<Array<{ key: string; d: string; tone: string }>>([])

function fmt(n: number) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function passFilter(e: ReconEntry): boolean {
  if (props.filter === 'all') return true
  if (props.filter === 'matched') return isLockedMatch(e.matchStatus)
  if (props.filter === 'fuzzy') return isFuzzyMatch(e.matchStatus)
  return e.matchStatus === 0
}

function canSelect(row: ReconEntry): boolean {
  if (props.disabled) return false
  return row.matchStatus === 0
}

const visibleCorp = computed(() => props.corp.filter(passFilter))
const visibleBank = computed(() => props.bank.filter(passFilter))

function setRowEl(side: string, id: ReconId, el: unknown) {
  const key = `${side}-${String(id)}`
  if (!el) {
    rowEls.delete(key)
    return
  }
  const node = el as HTMLElement
  if (node instanceof HTMLElement) {
    rowEls.set(key, node)
    scheduleRedraw()
  }
}

function toggleCorp(row: ReconEntry) {
  if (!canSelect(row)) return
  const next = new Set(selectedCorp.value)
  if (next.has(row.id)) next.delete(row.id)
  else next.add(row.id)
  selectedCorp.value = next
  tryManual()
}

function toggleBank(row: ReconEntry) {
  if (!canSelect(row)) return
  const next = new Set(selectedBank.value)
  if (next.has(row.id)) next.delete(row.id)
  else next.add(row.id)
  selectedBank.value = next
  tryManual()
}

function tryManual() {
  if (props.disabled) return
  if (selectedCorp.value.size && selectedBank.value.size) {
    emit('link', [...selectedCorp.value], [...selectedBank.value])
    clearSelection()
  }
}

function clearSelection() {
  selectedCorp.value = new Set()
  selectedBank.value = new Set()
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const span = Math.max(24, Math.abs(x2 - x1))
  const c1 = x1 + span * 0.45
  const c2 = x2 - span * 0.45
  return `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`
}

/** 行中心点是否在列表可视区内（滚动超出则不连） */
function isRowInListView(row: HTMLElement, list: HTMLElement): boolean {
  const rr = row.getBoundingClientRect()
  const lr = list.getBoundingClientRect()
  const cy = rr.top + rr.height / 2
  return cy >= lr.top + 2 && cy <= lr.bottom - 2
}

type LineCandidate = {
  key: string
  corpId: ReconId
  bankId: ReconId
  score: number
  status: number
  tone: string
}

/** 按置信度贪心：每个企业行/银行行最多一条线，优先精准 */
function pickBestPairs(): LineCandidate[] {
  const raw: LineCandidate[] = []
  for (const link of props.links) {
    if (props.filter === 'unmatched') continue
    if (props.filter === 'fuzzy' && link.status !== 2) continue
    // 「已勾对」只画已确认（精准/人工），不含待确认疑似
    if (props.filter === 'matched' && link.status === 2) continue

    const tone = link.status === 1 || link.status === 3 ? 'exact' : 'fuzzy'
    // 同屏时精准优先占线，疑似用虚线；未匹配可点选两侧人工勾对
    const statusBoost = link.status === 1 ? 100 : link.status === 3 ? 80 : 20
    const corpIds = link.corpIds.map(String) as ReconId[]
    const bankIds = link.bankIds.map(String) as ReconId[]
    // N:M 组内也只取对角最优：一对一对排，不笛卡尔积
    const n = Math.min(corpIds.length, bankIds.length)
    if (n === 0) continue
    if (corpIds.length === 1 && bankIds.length === 1) {
      raw.push({
        key: `${link.groupId}-${corpIds[0]}-${bankIds[0]}`,
        corpId: corpIds[0],
        bankId: bankIds[0],
        score: (link.score || 0) + statusBoost,
        status: link.status,
        tone,
      })
      continue
    }
    // 多对多：按顺序 zip 成 n 条候选，再靠全局贪心砍重复
    for (let i = 0; i < n; i++) {
      raw.push({
        key: `${link.groupId}-${corpIds[i]}-${bankIds[i]}`,
        corpId: corpIds[i],
        bankId: bankIds[i],
        score: (link.score || 0) + statusBoost - i * 0.001,
        status: link.status,
        tone,
      })
    }
  }

  raw.sort((a, b) => b.score - a.score)
  const usedCorp = new Set<string>()
  const usedBank = new Set<string>()
  const picked: LineCandidate[] = []
  for (const c of raw) {
    if (usedCorp.has(c.corpId) || usedBank.has(c.bankId)) continue
    usedCorp.add(c.corpId)
    usedBank.add(c.bankId)
    picked.push(c)
  }
  return picked
}

function redraw() {
  const root = rootRef.value
  const corpCol = corpColRef.value
  const bankCol = bankColRef.value
  const corpList = corpListRef.value
  const bankList = bankListRef.value
  if (!root || !corpCol || !bankCol || !corpList || !bankList) return

  const rootBox = root.getBoundingClientRect()
  svgW.value = Math.round(rootBox.width)
  svgH.value = Math.round(rootBox.height)

  const gutterLeft = corpCol.getBoundingClientRect().right - rootBox.left
  const gutterRight = bankCol.getBoundingClientRect().left - rootBox.left
  if (gutterRight - gutterLeft < 8) {
    lines.value = []
    return
  }

  const next: typeof lines.value = []
  for (const pair of pickBestPairs()) {
    const a = rowEls.get(`corp-${pair.corpId}`)
    const b = rowEls.get(`bank-${pair.bankId}`)
    if (!a || !b) continue
    if (a.offsetParent === null || b.offsetParent === null) continue
    // 必须以「各自列表」可视区为准，避免滚出去后线飘到别处
    if (!isRowInListView(a, corpList) || !isRowInListView(b, bankList)) continue

    const ar = a.getBoundingClientRect()
    const br = b.getBoundingClientRect()
    const y1 = ar.top + ar.height / 2 - rootBox.top
    const y2 = br.top + br.height / 2 - rootBox.top
    next.push({
      key: pair.key,
      d: bezier(gutterLeft + 2, y1, gutterRight - 2, y2),
      tone: pair.tone,
    })
  }
  lines.value = next
}

let ro: ResizeObserver | null = null
let raf = 0
function scheduleRedraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => redraw())
}

onMounted(() => {
  nextTick(scheduleRedraw)
  ro = new ResizeObserver(() => scheduleRedraw())
  if (rootRef.value) ro.observe(rootRef.value)
  if (corpColRef.value) ro.observe(corpColRef.value)
  if (bankColRef.value) ro.observe(bankColRef.value)
  corpListRef.value?.addEventListener('scroll', scheduleRedraw, { passive: true })
  bankListRef.value?.addEventListener('scroll', scheduleRedraw, { passive: true })
  window.addEventListener('resize', scheduleRedraw)
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  corpListRef.value?.removeEventListener('scroll', scheduleRedraw)
  bankListRef.value?.removeEventListener('scroll', scheduleRedraw)
  window.removeEventListener('resize', scheduleRedraw)
})

watch(
  () => [props.links, props.filter, props.corp, props.bank, visibleCorp.value, visibleBank.value],
  () => nextTick(scheduleRedraw),
  { deep: true },
)

watch(
  () => props.disabled,
  (d) => {
    if (d) clearSelection()
  },
)

defineExpose({ clearSelection })
</script>

<style scoped lang="scss">
.recon-pane {
  @apply relative grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2;
  height: 100%;
  min-height: 0;
  /* 中间连线区加宽，便于看清贝塞尔连线 */
  @media (min-width: 1024px) {
    column-gap: clamp(3.25rem, 7vw, 6.5rem);
  }

  &--disabled {
    @apply pointer-events-none opacity-70;
  }
}

.recon-pane__svg {
  /* 盖在栏面上，避免只露出缝里的一小段；点击穿透 */
  @apply pointer-events-none absolute inset-0 z-[5] hidden h-full w-full lg:block;
  overflow: visible;
}

.recon-pane__path {
  stroke-width: 2;
  opacity: 0.92;
  stroke-linecap: round;

  &--exact {
    stroke: rgba(110, 200, 168, 0.85);
  }
  &--fuzzy {
    stroke: rgba(210, 180, 100, 0.9);
    stroke-dasharray: 5 4;
    animation: recon-dash 1.2s linear infinite;
  }
}

.recon-pane__col {
  @apply relative z-[2] flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10;
  background: rgba(8, 14, 22, 0.72);
}

.recon-pane__head {
  @apply shrink-0 border-b border-white/10 px-3 py-2 font-mono text-[0.62rem] tracking-[0.12em] text-slate-400;
}

.recon-pane__list {
  @apply min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-1.5 py-1.5;
}

.recon-pane__row {
  @apply cursor-pointer rounded-md border border-transparent px-2.5 py-1.5 transition;
  background: rgba(255, 255, 255, 0.02);

  &:hover:not(.recon-pane__row--locked) {
    border-color: rgba(110, 200, 232, 0.25);
  }
  &--active {
    border-color: rgba(110, 200, 232, 0.55);
    background: rgba(110, 200, 232, 0.08);
  }
  &--matched {
    box-shadow: inset 3px 0 0 rgba(110, 200, 168, 0.7);
  }
  &--fuzzy {
    box-shadow: inset 3px 0 0 rgba(210, 180, 100, 0.75);
  }
  &--locked {
    @apply cursor-default;
  }
}

.recon-pane__confirm {
  @apply mt-2 rounded border border-amber-400/35 px-2 py-1 font-mono text-[0.62rem] tracking-wider text-amber-200/90 transition;
  @apply hover:border-amber-300/55 hover:text-amber-100 disabled:opacity-40;
}

.recon-pane__row-top {
  @apply flex items-center justify-between gap-2;
}
.recon-pane__date {
  @apply font-mono text-[0.7rem] text-slate-500;
}
.recon-pane__badge {
  @apply font-mono text-[0.62rem] tracking-wider text-slate-400;
}
.recon-pane__party {
  @apply mt-0.5 truncate text-[0.8125rem] text-slate-100;
}
.recon-pane__summary {
  @apply truncate text-[0.7rem] text-slate-500;
}
.recon-pane__amt {
  @apply mt-1 font-mono text-[0.7rem] text-cyan-soft/90;
}

@keyframes recon-dash {
  to {
    stroke-dashoffset: -18;
  }
}
</style>
