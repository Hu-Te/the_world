<template>
  <div class="lx-shell" role="presentation" @click.self="goHome">
    <div class="lx-shell__grid" aria-hidden="true" />
    <div class="lx-modal" role="dialog" aria-modal="true" aria-labelledby="lx-title">
      <div class="lx-modal__glow" aria-hidden="true" />
      <header class="lx-modal__head">
        <div>
          <div class="lx-modal__eyebrow">
            <span class="lx-modal__code">FIN · LEXICORE</span>
            <span class="lx-modal__pulse" aria-hidden="true" />
            <span class="lx-modal__badge">全息语料 · 瞬时熔炼</span>
          </div>
          <h1 id="lx-title" class="lx-modal__title">全息语料熔炼舱</h1>
          <p class="lx-modal__lead">
            大白话报销文本 → 智能语义解构 → 后端 BigDecimal 平账 →
            标准凭证导入包（即传即销，不落库）
          </p>
        </div>
        <button type="button" class="lx-modal__close" aria-label="关闭" @click="goHome">✕</button>
      </header>

      <div class="lx-modal__body">
        <section class="lx-pane lx-pane--input">
          <div class="lx-pane__label">非结构化语料</div>
          <label class="lx-field lx-field--row">
            <span>申请人</span>
            <input v-model="applicant" type="text" placeholder="可选" />
          </label>
          <label class="lx-field lx-field--row">
            <span>业务日期</span>
            <input v-model="bizDate" type="date" />
          </label>
          <div
            class="lx-drop"
            :class="{ 'lx-drop--hot': dragOver }"
            @dragover.prevent="dragOver = true"
            @dragleave="dragOver = false"
            @drop.prevent="onDrop">
            <textarea
              v-model="rawText"
              class="lx-textarea"
              rows="16"
              placeholder="粘贴或拖入文本，例如：&#10;申请人：张三，6 月 12 日出差。打车 86.5 元，客户餐叙 320 元，个人垫付，请报销。" />
            <p class="lx-drop__hint">支持拖放 .txt · 粘贴即熔</p>
          </div>
          <button
            type="button"
            class="lx-btn lx-btn--primary"
            :disabled="busy || !rawText.trim()"
            @click="runSmelt">
            {{ busy ? '熔炼中…' : '智能全息熔炼' }}
          </button>
          <p v-if="status" class="lx-status">{{ status }}</p>
        </section>
        <section class="lx-pane lx-pane--grid">
          <div class="lx-pane__label">
            动态分录网格
            <span v-if="result?.balanced" class="lx-pill lx-pill--ok">借贷平衡</span>
            <span v-else-if="entries.length" class="lx-pill lx-pill--warn">待校准</span>
          </div>

          <div v-if="result || applicant || bizDate" class="lx-meta">
            <span>{{ displayApplicant }}</span>
            <span class="lx-meta__sep">·</span>
            <span>{{ displayDate }}</span>
            <span v-if="result?.roundingAbsorbed" class="lx-meta__note">尾差已揉入最大借方</span>
          </div>

          <div class="lx-table-wrap">
            <table class="lx-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>方向</th>
                  <th>科目</th>
                  <th>金额</th>
                  <th>摘要</th>
                  <th>置信</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, i) in entries"
                  :key="i"
                  class="lx-row"
                  :class="{
                    'lx-row--flash': flashIdx === i,
                    'lx-row--low': isLowConfidence(row.confidence),
                  }">
                  <td>{{ i + 1 }}</td>
                  <td>
                    <select v-model="row.direction" class="lx-select lx-select--dir">
                      <option value="D">D 借</option>
                      <option value="C">C 贷</option>
                    </select>
                  </td>
                  <td>
                    <select
                      v-if="isLowConfidence(row.confidence) || subjectNeedsSelect(row.subject)"
                      v-model="row.subject"
                      class="lx-select"
                      :class="{ 'lx-select--warn': isLowConfidence(row.confidence) }">
                      <option
                        v-if="row.subject && !subjectInList(row.subject)"
                        :value="row.subject">
                        {{ row.subject }}
                      </option>
                      <option v-for="s in SUBJECT_OPTIONS" :key="s.value" :value="s.value">
                        {{ s.label }}
                      </option>
                    </select>
                    <input v-else v-model="row.subject" class="lx-input" type="text" />
                  </td>
                  <td>
                    <input
                      v-model="row.amount"
                      class="lx-input lx-input--amt"
                      type="text"
                      inputmode="decimal" />
                  </td>
                  <td>
                    <input v-model="row.summary" class="lx-input" type="text" />
                  </td>
                  <td class="lx-conf">
                    <span :class="{ 'lx-conf--low': isLowConfidence(row.confidence) }">
                      {{ fmtConf(row.confidence) }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!entries.length && !busy">
                  <td colspan="6" class="lx-empty">等待语料熔炼…</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="entries.length" class="lx-totals">
            <span>借方合计 {{ fmtMoney(debitLive) }}</span>
            <span>贷方合计 {{ fmtMoney(creditLive) }}</span>
            <span :class="deltaLive === 0 ? 'lx-ok' : 'lx-bad'">
              差额 {{ fmtMoney(deltaLive) }}
            </span>
          </div>

          <div class="lx-actions">
            <button
              type="button"
              class="lx-btn lx-btn--ghost"
              :disabled="!entries.length || busy"
              @click="runRebalance">
              重新平账
            </button>
            <button
              type="button"
              class="lx-btn lx-btn--forge"
              :disabled="!entries.length || busy || deltaLive !== 0"
              @click="runExport">
              一键熔炼凭证包
            </button>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  downloadVoucherPack,
  rebalance,
  smeltStream,
  type LedgerEntry,
  type LexiCoreSmeltResult,
} from '~/utils/lexicore/api'
import { SUBJECT_OPTIONS, isLowConfidence } from '~/utils/lexicore/subjects'

definePageMeta({ layout: false })

const router = useRouter()

const rawText = ref('')
const applicant = ref('')
const bizDate = ref('')
const dragOver = ref(false)
const busy = ref(false)
const status = ref('')
const entries = ref<LedgerEntry[]>([])
const result = ref<LexiCoreSmeltResult | null>(null)
const flashIdx = ref(-1)
let abortCtl: AbortController | null = null

const displayApplicant = computed(() => result.value?.applicant || applicant.value || '—')
const displayDate = computed(() => result.value?.date || bizDate.value || '—')

const debitLive = computed(() => sumDir('D'))
const creditLive = computed(() => sumDir('C'))
const deltaLive = computed(() => round2(debitLive.value - creditLive.value))

function sumDir(dir: string): number {
  return entries.value.reduce((acc, e) => {
    if (String(e.direction).toUpperCase() !== dir) return acc
    const n = Number(e.amount)
    return acc + (Number.isFinite(n) ? n : 0)
  }, 0)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmtMoney(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtConf(c: string | number | undefined): string {
  const n = Number(c)
  if (Number.isNaN(n)) return '—'
  return `${Math.round(n * 100)}%`
}

function subjectInList(s: string): boolean {
  return SUBJECT_OPTIONS.some((o) => o.value === s)
}

function subjectNeedsSelect(s: string): boolean {
  return !s || s.includes('?')
}

function goHome() {
  abortCtl?.abort()
  router.push('/')
}

function onDrop(ev: DragEvent) {
  dragOver.value = false
  const file = ev.dataTransfer?.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    rawText.value = String(reader.result || '')
  }
  reader.readAsText(file)
}

async function runSmelt() {
  if (!rawText.value.trim() || busy.value) return
  abortCtl?.abort()
  abortCtl = new AbortController()
  busy.value = true
  status.value = '接通全息链路…'
  entries.value = []
  result.value = null
  flashIdx.value = -1
  try {
    await smeltStream(
      {
        text: rawText.value.trim(),
        applicant: applicant.value || undefined,
        date: bizDate.value || null,
      },
      {
        onMeta: (m) => {
          if (m.applicant) applicant.value = m.applicant
          if (m.date) bizDate.value = m.date
          status.value = m.note || '解构进行中…'
        },
        onEntry: (row) => {
          entries.value.push({
            direction: String(row.direction || 'D').toUpperCase(),
            amount: String(row.amount ?? ''),
            subject: row.subject || '',
            summary: row.summary || '',
            confidence: row.confidence,
          })
          flashIdx.value = entries.value.length - 1
          status.value = `吐出分录 #${entries.value.length}`
        },
        onBalance: (b) => {
          status.value = b.balanced
            ? `平账完成 · 借 ${b.debitTotal} / 贷 ${b.creditTotal}`
            : '平账异常'
        },
        onDone: (d) => {
          result.value = d
          entries.value = (d.entries || []).map((e) => ({
            direction: String(e.direction).toUpperCase(),
            amount: String(e.amount),
            subject: e.subject || '',
            summary: e.summary || '',
            confidence: e.confidence,
          }))
          if (d.applicant) applicant.value = d.applicant
          if (d.date) bizDate.value = d.date
          status.value = d.note ? `完成 · ${d.note}` : '熔炼完成'
        },
        onError: (msg) => {
          status.value = msg
        },
      },
      abortCtl.signal,
    )
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      status.value = e instanceof Error ? e.message : '熔炼失败'
    }
  } finally {
    busy.value = false
    flashIdx.value = -1
  }
}

async function runRebalance() {
  if (!entries.value.length) return
  busy.value = true
  status.value = '规则引擎平账…'
  try {
    const d = await rebalance({
      applicant: applicant.value,
      date: bizDate.value,
      entries: entries.value.map((e) => ({
        ...e,
        amount: String(e.amount),
        direction: String(e.direction).toUpperCase(),
      })),
    })
    result.value = d
    entries.value = d.entries.map((e) => ({
      direction: String(e.direction).toUpperCase(),
      amount: String(e.amount),
      subject: e.subject || '',
      summary: e.summary || '',
      confidence: e.confidence,
    }))
    status.value = d.roundingAbsorbed ? '已平衡（含尾差揉入）' : '已平衡'
  } catch (e) {
    status.value = e instanceof Error ? e.message : '平账失败'
  } finally {
    busy.value = false
  }
}

async function runExport() {
  if (!entries.value.length || deltaLive.value !== 0) return
  busy.value = true
  status.value = '生成凭证包…'
  try {
    await downloadVoucherPack({
      applicant: applicant.value,
      date: bizDate.value,
      entries: entries.value.map((e) => ({
        ...e,
        amount: String(e.amount),
        direction: String(e.direction).toUpperCase(),
      })),
    })
    status.value = '凭证包已下载（服务端无留存）'
  } catch (e) {
    status.value = e instanceof Error ? e.message : '导出失败'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onEsc)
})

onUnmounted(() => {
  abortCtl?.abort()
  window.removeEventListener('keydown', onEsc)
})

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') goHome()
}
</script>

<style scoped lang="scss">
$cyan: #2dd4bf;
$emerald: #34d399;
$warn: #fbbf24;
$ink: #070b10;

.lx-shell {
  @apply fixed inset-0 z-[80] flex items-center justify-center;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
    max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  background: radial-gradient(120% 80% at 50% -10%, #0a1620 0%, $ink 55%, #040608 100%);

  @media (min-width: 640px) {
    padding: max(1rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right))
      max(1rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
  }
}

.lx-shell__grid {
  @apply pointer-events-none absolute inset-0 opacity-[0.14];
  background-image:
    linear-gradient(rgba(45, 212, 191, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(52, 211, 153, 0.06) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 65% 55% at 50% 42%, #000 15%, transparent 72%);
}

.lx-modal {
  /* 与勾稽「已加载」工作台同规格：近全屏双栏 */
  @apply relative flex w-full flex-col overflow-hidden;
  width: min(96rem, 100%);
  height: min(96dvh, 100%);
  max-height: min(96dvh, 100%);
  border: 1px solid rgba(45, 212, 191, 0.35);
  border-radius: clamp(0.65rem, 1.6vw, 1.05rem);
  background: linear-gradient(168deg, rgba(12, 22, 30, 0.98), rgba(5, 10, 14, 0.995));
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.035) inset,
    0 28px 80px rgba(0, 0, 0, 0.6),
    0 0 72px rgba(45, 212, 191, 0.14);
  backdrop-filter: blur(18px);
}

.lx-modal__glow {
  @apply pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.28), transparent 70%);
  filter: blur(12px);

  @media (max-width: 639px) {
    @apply h-36 w-36 opacity-70;
  }
}

.lx-modal__head {
  @apply relative z-[1] flex shrink-0 items-start justify-between gap-3 border-b border-white/10;
  padding: clamp(0.85rem, 2.2vw, 1.5rem) clamp(0.85rem, 2.5vw, 2rem);
}

.lx-modal__eyebrow {
  @apply mb-2 flex flex-wrap items-center gap-2.5 font-mono tracking-[0.18em] text-teal-300/80;
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
}

.lx-modal__pulse {
  @apply inline-block h-1.5 w-1.5 rounded-full bg-emerald-400;
  box-shadow: 0 0 10px $emerald;
  animation: lx-pulse 1.6s ease-in-out infinite;
}

.lx-modal__badge {
  @apply rounded border border-teal-400/30 bg-teal-500/10 px-2 py-0.5 tracking-normal text-teal-100/90;
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
}

.lx-modal__title {
  @apply font-display font-semibold tracking-wide text-teal-50;
  font-size: clamp(1.35rem, 3.6vw, 2rem);
  text-shadow: 0 0 24px rgba(45, 212, 191, 0.35);
}

.lx-modal__lead {
  @apply mt-1.5 max-w-3xl font-mono leading-relaxed tracking-wide text-white/55;
  font-size: clamp(0.8rem, 1.9vw, 0.95rem);
}

.lx-modal__close {
  @apply rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-teal-400/40 hover:text-teal-100;
  padding: clamp(0.45rem, 1.2vw, 0.65rem) clamp(0.7rem, 1.6vw, 0.9rem);
  font-size: clamp(0.85rem, 2vw, 1rem);
}

.lx-modal__body {
  @apply relative z-[1] grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2;
}

.lx-pane {
  @apply flex min-h-0 flex-col overflow-y-auto;
  gap: clamp(0.75rem, 1.8vw, 1.1rem);
  padding: clamp(0.85rem, 2.2vw, 1.5rem) clamp(0.85rem, 2.5vw, 2rem);
}

.lx-pane--input {
  @apply border-b border-white/10 lg:border-b-0 lg:border-r;
}

.lx-pane__label {
  @apply flex items-center gap-2 font-mono uppercase tracking-[0.16em] text-emerald-300/80;
  font-size: clamp(0.72rem, 1.7vw, 0.85rem);
}

.lx-field {
  @apply flex flex-col gap-1.5 text-white/55;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);

  input {
    @apply rounded-md border border-white/10 bg-black/30 text-teal-50 outline-none focus:border-teal-400/50;
    padding: clamp(0.55rem, 1.4vw, 0.7rem) clamp(0.75rem, 1.8vw, 0.95rem);
    font-size: clamp(0.9rem, 2vw, 1.05rem);
  }
}

.lx-field--row {
  @apply grid items-center gap-3;
  grid-template-columns: clamp(4.5rem, 8vw, 5.5rem) 1fr;
}

.lx-drop {
  @apply relative flex min-h-0 flex-1 rounded-xl border border-dashed border-teal-500/25 bg-black/25 p-1.5 transition;
}

.lx-drop--hot {
  @apply border-emerald-400/50 bg-emerald-500/5;
  box-shadow: inset 0 0 30px rgba(52, 211, 153, 0.08);
}

.lx-textarea {
  @apply h-full w-full resize-none rounded-lg bg-transparent font-mono leading-relaxed text-teal-50/95 outline-none placeholder:text-white/25;
  min-height: clamp(16rem, 42dvh, 28rem);
  padding: clamp(0.85rem, 2vw, 1.15rem);
  font-size: clamp(0.95rem, 2.1vw, 1.1rem);
}

.lx-drop__hint {
  @apply pointer-events-none absolute bottom-3 right-4 font-mono text-white/30;
  font-size: clamp(0.7rem, 1.6vw, 0.8rem);
}

.lx-btn {
  @apply rounded-lg font-mono tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40;
  padding: clamp(0.7rem, 1.8vw, 0.95rem) clamp(1rem, 2.2vw, 1.35rem);
  font-size: clamp(0.9rem, 2.1vw, 1.05rem);
}

.lx-btn--primary {
  @apply border border-teal-400/40 bg-gradient-to-r from-teal-500/30 to-emerald-500/20 text-teal-50;
  box-shadow: 0 0 24px rgba(45, 212, 191, 0.2);
  &:hover:not(:disabled) {
    box-shadow: 0 0 32px rgba(45, 212, 191, 0.35);
  }
}

.lx-btn--ghost {
  @apply border border-white/15 bg-white/5 text-white/70 hover:border-teal-400/30 hover:text-teal-100;
}

.lx-btn--forge {
  @apply border border-emerald-400/50 bg-emerald-500/20 font-semibold text-emerald-50;
  box-shadow: 0 0 28px rgba(52, 211, 153, 0.25);
}

.lx-status {
  @apply font-mono text-teal-200/70;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}

.lx-pill {
  @apply rounded px-2 py-0.5 font-mono tracking-normal;
  font-size: clamp(0.7rem, 1.6vw, 0.8rem);
}
.lx-pill--ok {
  @apply border border-emerald-400/40 bg-emerald-500/15 text-emerald-200;
}
.lx-pill--warn {
  @apply border border-amber-400/40 bg-amber-500/10 text-amber-200;
}

.lx-meta {
  @apply flex flex-wrap items-center gap-2 font-mono text-white/50;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}
.lx-meta__sep {
  @apply text-white/25;
}
.lx-meta__note {
  @apply text-amber-200/80;
}

.lx-table-wrap {
  @apply min-h-0 flex-1 overflow-auto rounded-lg border border-white/10 bg-black/20;
}

.lx-table {
  @apply w-full border-collapse text-left;
  font-size: clamp(0.9rem, 2vw, 1.05rem);

  th {
    @apply sticky top-0 bg-[#0a1218] font-mono uppercase tracking-wider text-teal-300/70;
    padding: clamp(0.55rem, 1.4vw, 0.75rem) clamp(0.55rem, 1.4vw, 0.85rem);
    font-size: clamp(0.72rem, 1.7vw, 0.85rem);
  }
  td {
    @apply border-t border-white/5 align-middle;
    padding: clamp(0.45rem, 1.2vw, 0.65rem) clamp(0.45rem, 1.2vw, 0.75rem);
  }
}

.lx-row--flash {
  animation: lx-flash 0.55s ease;
}

.lx-row--low td:nth-child(3) {
  box-shadow: inset 0 0 0 1px rgba(251, 191, 36, 0.35);
}

.lx-select,
.lx-input {
  @apply w-full rounded border border-white/10 bg-black/40 text-teal-50 outline-none focus:border-teal-400/40;
  padding: clamp(0.4rem, 1.1vw, 0.55rem) clamp(0.5rem, 1.2vw, 0.7rem);
  font-size: clamp(0.85rem, 1.9vw, 0.98rem);
}

.lx-select--dir {
  width: clamp(5.2rem, 9vw, 6.2rem);
}

.lx-select--warn {
  border-color: rgba(251, 191, 36, 0.55) !important;
  background: rgba(251, 191, 36, 0.08);
  box-shadow: 0 0 12px rgba(251, 191, 36, 0.2);
}

.lx-input--amt {
  @apply font-mono tabular-nums;
  width: clamp(7rem, 12vw, 8.5rem);
}

.lx-conf {
  @apply font-mono text-white/55;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}
.lx-conf--low {
  @apply text-amber-300;
  text-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
}

.lx-empty {
  @apply text-center font-mono text-white/30 !important;
  padding-block: clamp(3rem, 10dvh, 5rem);
  font-size: clamp(0.85rem, 2vw, 1rem);
}

.lx-totals {
  @apply flex flex-wrap gap-4 font-mono text-white/60;
  font-size: clamp(0.85rem, 1.9vw, 0.95rem);
}
.lx-ok {
  @apply text-emerald-300;
}
.lx-bad {
  @apply text-amber-300;
}

.lx-actions {
  @apply mt-auto flex flex-wrap justify-end gap-3 pt-2;
}

@keyframes lx-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.25);
  }
}

@keyframes lx-flash {
  0% {
    background: rgba(45, 212, 191, 0.22);
  }
  100% {
    background: transparent;
  }
}
</style>
