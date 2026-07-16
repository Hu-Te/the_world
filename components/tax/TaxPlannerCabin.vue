<template>
  <div class="tp-cabin">
    <div class="tp-grid-bg" aria-hidden="true" />

    <!-- 数据投递舱 -->
    <section class="tp-upload">
      <header class="tp-sec-head">
        <span class="tp-code">DATA · INGEST</span>
        <h2>数据投递舱</h2>
      </header>
      <div
        class="tp-drop"
        :class="{ 'tp-drop--hot': dragOver, 'tp-drop--scan': scanning }"
        @dragover.prevent="dragOver = true"
        @dragleave="dragOver = false"
        @drop.prevent="onDrop">
        <div v-if="scanning" class="tp-particles" aria-hidden="true">
          <span v-for="i in 12" :key="i" class="tp-dot" :style="{ '--i': i }" />
        </div>
        <p class="tp-drop__title">拖入Excel / CSV</p>
        <p class="tp-drop__hint">
          需含科目编码列；支持币别行与「期初/本期/本年累计」双行表头
        </p>
        <div class="tp-drop__acts">
          <label class="tp-btn tp-btn--primary">
            选择文件
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              class="sr-only"
              @change="onFile" />
          </label>
          <a class="tp-btn tp-btn--ghost" href="/samples/tax-trial-balance.csv" download>
            样例 CSV
          </a>
        </div>
        <p v-if="fileName" class="tp-file">{{ fileName }}</p>
      </div>
      <p v-if="report" class="tp-coverage">
        解析 {{ report.parsedLineCount }} 行 · 纳入测算 {{ report.scoredLineCount }} 行 · 未纳入
        {{ report.ignoredLineCount }} 行（资产/负债等）
        <template v-if="report.amountBasis"> · {{ report.amountBasis }}</template>
      </p>
      <div v-if="report" class="tp-breakdown">
        <span>收入 {{ money(report.revenue) }}</span>
        <span>− 成本 {{ money(report.cost) }}</span>
        <span>− 期间费用 {{ money(report.periodExpense) }}</span>
        <span>− 研发 {{ money(report.rdExpense) }}</span>
        <span>− 招待 {{ money(report.entertainmentExpense) }}</span>
        <span>= 估算利润 {{ money(report.estimatedProfit) }}</span>
        <span class="tp-breakdown__ti">→ 所得额 {{ money(report.taxableIncome) }}</span>
      </div>
      <p v-if="error" class="tp-err">{{ error }}</p>
      <p v-else-if="note" class="tp-note">{{ note }}</p>
    </section>

    <!-- 税收红利透视雷达 -->
    <section class="tp-radar">
      <header class="tp-sec-head">
        <span class="tp-code">RADAR · CIT</span>
        <h2>税收红利透视雷达</h2>
      </header>
      <div class="tp-gauge-wrap">
        <svg class="tp-gauge" viewBox="0 0 200 200" aria-label="税负率">
          <circle class="tp-gauge__track" cx="100" cy="100" r="78" />
          <circle
            class="tp-gauge__arc"
            :class="burdenClass"
            cx="100"
            cy="100"
            r="78"
            :style="{ strokeDashoffset: gaugeOffset }" />
          <text x="100" y="92" class="tp-gauge__val">{{ burdenLabel }}</text>
          <text x="100" y="118" class="tp-gauge__sub">税负率 · 估算</text>
        </svg>
        <div class="tp-kpi">
          <div class="tp-kpi__card tp-kpi__card--safe">
            <span>已薅红利 · 估算</span>
            <strong>{{ moneyOrDash(report?.harvestedBenefit, !!report) }}</strong>
          </div>
          <div class="tp-kpi__card tp-kpi__card--risk">
            <span>潜在风险 · 估算</span>
            <strong>{{ moneyOrDash(report?.potentialRisk, !!report) }}</strong>
          </div>
          <div class="tp-kpi__card">
            <span>应纳税所得额 · 估算</span>
            <strong>{{ moneyOrDash(report?.taxableIncome, !!report) }}</strong>
          </div>
          <div class="tp-kpi__card" :class="{ 'tp-kpi__card--warn': report?.microCritical }">
            <span>纳税人状态 · 简化</span>
            <strong>{{ statusLabel }}</strong>
          </div>
        </div>
      </div>
    </section>

    <!-- 智能筹划报告 -->
    <section class="tp-report">
      <header class="tp-sec-head tp-sec-head--row">
        <div>
          <span class="tp-code">PLAN · REPORT</span>
          <h2>智能筹划报告</h2>
        </div>
        <button type="button" class="tp-btn tp-btn--forge" :disabled="!report" @click="exportPdf">
          导出 PDF 底稿
        </button>
      </header>

      <div class="tp-metrics">
        <article class="tp-card" :class="{ 'tp-card--warn': report?.microCritical }">
          <h3>小微 300 万红线 · 预警</h3>
          <p>距上限剩余 {{ moneyOrDash(report?.headroomToCap, !!report) }}</p>
          <p class="tp-card__sub">
            所得额 {{ moneyOrDash(report?.taxableIncome, !!report) }} · 估税
            {{ moneyOrDash(report?.currentEstimatedTax, !!report) }}
          </p>
          <p class="tp-card__sub">
            冲破风险税差 {{ moneyOrDash(report?.cliffIfExceed, !!report) }}
            <template v-if="num(report?.microCliffExtraTax) > 0">
              · 已实现断崖 {{ money(report?.microCliffExtraTax) }}
            </template>
          </p>
        </article>
        <article
          class="tp-card"
          :class="{ 'tp-card--risk': num(report?.entertainmentAddBack) > 0 }">
          <h3>业务招待费 · 估算</h3>
          <p>纳税调增 {{ moneyOrDash(report?.entertainmentAddBack, !!report) }}</p>
          <p class="tp-card__sub">
            限额 {{ moneyOrDash(report?.entertainmentLimit, !!report) }} / 发生
            {{ moneyOrDash(report?.entertainmentExpense, !!report) }}
          </p>
          <button v-if="entCode" type="button" class="tp-link" @click="focusAccount(entCode)">
            跳转科目 {{ entCode }}
          </button>
        </article>
        <article class="tp-card tp-card--safe">
          <h3>研发加计扣除 · 估算</h3>
          <p>加计额 {{ moneyOrDash(report?.rdAdditionalDeduction, !!report) }}</p>
          <p class="tp-card__sub">节税估算 {{ moneyOrDash(report?.rdTaxSaving, !!report) }}</p>
          <button v-if="rdCode" type="button" class="tp-link" @click="focusAccount(rdCode)">
            跳转科目 {{ rdCode }}
          </button>
        </article>
        <article class="tp-card">
          <h3>期间费用 · 估算</h3>
          <p>{{ moneyOrDash(report?.periodExpense, !!report) }}</p>
          <p class="tp-card__sub">销售/管理/财务等（不含已单列招待与研发）</p>
        </article>
      </div>

      <div class="tp-advice">
        <article
          v-for="(a, i) in report?.advice || []"
          :key="i"
          class="tp-advice__item"
          :class="`tp-advice__item--${(a.severity || 'INFO').toLowerCase()}`">
          <header>
            <span class="tp-badge">{{ categoryLabel(a.category) }}</span>
            <h4>{{ a.title }}</h4>
          </header>
          <p>{{ a.summary }}</p>
          <ul>
            <li v-for="(act, j) in a.actions" :key="j">{{ act }}</li>
          </ul>
          <button
            v-if="resolveRelatedCode(a.relatedAccountCode, report?.accountHits)"
            type="button"
            class="tp-link"
            @click="focusAccount(resolveRelatedCode(a.relatedAccountCode, report?.accountHits))">
            对照科目 {{ resolveRelatedCode(a.relatedAccountCode, report?.accountHits) }}
          </button>
        </article>
        <p v-if="!report" class="tp-empty">上传科目余额表后生成筹划卡片</p>
        <p v-else-if="!(report.advice && report.advice.length)" class="tp-empty">
          暂无筹划建议条目
        </p>
      </div>

      <div v-if="focusedHits.length" id="tp-detail" class="tp-detail">
        <h3>科目明细对照 · {{ focusCode }}</h3>
        <table>
          <thead>
            <tr>
              <th>编码</th>
              <th>名称</th>
              <th>角色</th>
              <th>金额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(h, i) in focusedHits" :key="i">
              <td>{{ h.accountCode }}</td>
              <td>{{ h.accountName || '—' }}</td>
              <td>{{ roleLabel(h.role) }}</td>
              <td>{{ money(h.amount) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  escapeHtml,
  money,
  moneyOrDash,
  pct,
  resolveRelatedCode,
  scanTrialBalance,
  validateTaxUpload,
  type AccountHit,
  type TaxReport,
} from '~/utils/tax/api'

const emit = defineEmits<{ scanning: [boolean] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const dragOver = ref(false)
const scanning = ref(false)
const error = ref('')
const note = ref('')
const fileName = ref('')
const report = ref<TaxReport | null>(null)
const focusCode = ref('')

const burdenLabel = computed(() => (report.value ? pct(report.value.taxBurdenRate) : '—'))
const gaugeOffset = computed(() => {
  if (!report.value) return 2 * Math.PI * 78
  const r = Number(report.value.taxBurdenRate || 0)
  const clamped = Math.min(Math.max(r, 0), 0.3) / 0.3
  const circ = 2 * Math.PI * 78
  return circ * (1 - clamped)
})
const burdenClass = computed(() => {
  if (!report.value) return 'tp-gauge__arc--safe'
  const r = Number(report.value.taxBurdenRate || 0)
  if (r >= 0.2) return 'tp-gauge__arc--risk'
  if (r >= 0.08) return 'tp-gauge__arc--warn'
  return 'tp-gauge__arc--safe'
})
const statusLabel = computed(() => {
  const s = report.value?.taxStatus
  if (s === 'MICRO_SMALL') return '小微（简化）'
  if (s === 'MICRO_CRITICAL') return '临界预警'
  if (s === 'STANDARD') return '一般税率'
  return '—'
})

function categoryLabel(c: string | undefined): string {
  switch (c) {
    case 'MICRO':
      return '小微'
    case 'RD':
      return '研发'
    case 'ENTERTAINMENT':
      return '招待费'
    case 'GENERAL':
      return '综合'
    default:
      return c || '综合'
  }
}

function roleLabel(r: string | undefined): string {
  switch (r) {
    case 'REVENUE':
      return '收入'
    case 'COST':
      return '成本'
    case 'PERIOD_EXPENSE':
      return '期间费用'
    case 'R_AND_D':
      return '研发'
    case 'ENTERTAINMENT':
      return '招待费'
    case 'OTHER':
      return '其他'
    default:
      return r || '—'
  }
}
const entCode = computed(
  () => report.value?.accountHits?.find((h) => h.role === 'ENTERTAINMENT')?.accountCode || '',
)
const rdCode = computed(
  () => report.value?.accountHits?.find((h) => h.role === 'R_AND_D')?.accountCode || '',
)
const focusedHits = computed<AccountHit[]>(() => {
  if (!report.value || !focusCode.value) return []
  return report.value.accountHits.filter(
    (h) => h.accountCode === focusCode.value || h.accountCode.startsWith(focusCode.value),
  )
})

function num(v: string | number | undefined | null): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  if (f) void runScan(f)
  input.value = ''
}

function onDrop(ev: DragEvent) {
  dragOver.value = false
  const f = ev.dataTransfer?.files?.[0]
  if (f) void runScan(f)
}

async function runScan(file: File) {
  const bad = validateTaxUpload(file)
  if (bad) {
    error.value = bad
    note.value = ''
    return
  }
  scanning.value = true
  emit('scanning', true)
  error.value = ''
  note.value = '全息扫描中…'
  fileName.value = file.name
  focusCode.value = ''
  try {
    report.value = await scanTrialBalance(file)
    note.value = report.value.note || '扫描完成（内存即销）'
  } catch (e) {
    report.value = null
    error.value = e instanceof Error ? e.message : '扫描失败'
    note.value = ''
  } finally {
    scanning.value = false
    emit('scanning', false)
  }
}

function focusAccount(code: string) {
  focusCode.value = code
  nextTick(() => {
    document.getElementById('tp-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function exportPdf() {
  if (!report.value) return
  const r = report.value
  const w = window.open('', '_blank')
  if (!w) {
    error.value = '浏览器拦截了弹窗，请允许后重试导出'
    return
  }
  const css =
    'body{font-family:ui-sans-serif,system-ui;background:#0b1220;color:#e2e8f0;padding:32px}' +
    'h1{color:#6ee7b7}.card{border:1px solid #334155;border-radius:12px;padding:16px;margin:12px 0}' +
    '.muted{color:#94a3b8;font-size:13px}'
  const adviceHtml = (r.advice || [])
    .map(
      (a) =>
        `<div class="card"><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.summary)}</p><ul>${(
          a.actions || []
        )
          .map((x) => `<li>${escapeHtml(x)}</li>`)
          .join('')}</ul></div>`,
    )
    .join('')
  w.document.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Tax Plan</title><style>${css}</` +
      `style></head><body>` +
      `<h1>税收红利扫描 · 筹划底稿（估算）</h1>` +
      `<p class="muted">Status: ${escapeHtml(r.taxStatus)} · Burden: ${escapeHtml(pct(r.taxBurdenRate))} · 解析 ${escapeHtml(String(r.parsedLineCount))} / 纳入 ${escapeHtml(String(r.scoredLineCount))}</p>` +
      `<div class="card"><b>应纳税所得额</b> ${escapeHtml(money(r.taxableIncome))} · <b>估税</b> ${escapeHtml(money(r.currentEstimatedTax))}</div>` +
      `<div class="card"><b>期间费用</b> ${escapeHtml(money(r.periodExpense))} · <b>成本</b> ${escapeHtml(money(r.cost))}</div>` +
      `<div class="card"><b>距上限剩余</b> ${escapeHtml(money(r.headroomToCap))} · <b>冲破风险税差</b> ${escapeHtml(money(r.cliffIfExceed))}</div>` +
      `<div class="card"><b>已实现断崖</b> ${escapeHtml(money(r.microCliffExtraTax))}</div>` +
      `<div class="card"><b>招待费调增</b> ${escapeHtml(money(r.entertainmentAddBack))} · <b>研发节税</b> ${escapeHtml(money(r.rdTaxSaving))}</div>` +
      `<div class="card"><b>已薅红利</b> ${escapeHtml(money(r.harvestedBenefit))} · <b>潜在风险</b> ${escapeHtml(money(r.potentialRisk))}</div>` +
      adviceHtml +
      `<scr` +
      `ipt>window.onload=function(){window.print()}</scr` +
      `ipt></body></html>`,
  )
  w.document.close()
}
</script>

<style scoped lang="scss">
.tp-cabin {
  @apply relative grid min-h-0 flex-1 gap-0 overflow-hidden;
  grid-template-columns: 1fr;
  @media (min-width: 1100px) {
    grid-template-columns: minmax(16rem, 22rem) minmax(18rem, 1.1fr) minmax(20rem, 1.2fr);
  }
}

.tp-grid-bg {
  @apply pointer-events-none absolute inset-0 opacity-[0.08];
  background-image:
    linear-gradient(rgba(16, 185, 129, 0.35) 1px, transparent 1px),
    linear-gradient(90deg, rgba(244, 63, 94, 0.2) 1px, transparent 1px);
  background-size: 36px 36px;
}

.tp-upload,
.tp-radar,
.tp-report {
  @apply relative z-[1] flex min-h-0 flex-col overflow-y-auto border-white/10;
  padding: clamp(0.85rem, 2vw, 1.35rem);
}

.tp-upload {
  @apply border-b lg:border-b-0 lg:border-r;
}
.tp-radar {
  @apply border-b lg:border-b-0 lg:border-r;
}

.tp-sec-head {
  @apply mb-3;
  h2 {
    @apply font-display font-semibold text-emerald-50;
    font-size: clamp(1.05rem, 2.4vw, 1.35rem);
  }
}
.tp-sec-head--row {
  @apply flex items-start justify-between gap-3;
}

.tp-code {
  @apply mb-1 block font-mono tracking-[0.22em] text-emerald-300/80;
  font-size: clamp(0.65rem, 1.5vw, 0.72rem);
}

.tp-drop {
  @apply relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-emerald-500/30 bg-black/30 text-center;
  min-height: clamp(14rem, 36dvh, 22rem);
  padding: 1.25rem;
}
.tp-drop--hot {
  @apply border-emerald-400/60 bg-emerald-500/5;
}
.tp-drop--scan {
  box-shadow: inset 0 0 40px rgba(16, 185, 129, 0.12);
}

.tp-drop__title {
  @apply font-mono text-emerald-100;
  font-size: clamp(0.95rem, 2vw, 1.1rem);
}
.tp-drop__hint {
  @apply text-white/40;
  font-size: clamp(0.75rem, 1.7vw, 0.85rem);
}
.tp-drop__acts {
  @apply mt-3 flex flex-wrap justify-center gap-2;
}
.tp-file {
  @apply mt-2 font-mono text-xs text-emerald-200/70;
}

.tp-particles {
  @apply pointer-events-none absolute inset-0;
}
.tp-dot {
  @apply absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-emerald-400;
  animation: tp-orbit 2.4s linear infinite;
  animation-delay: calc(var(--i) * -0.18s);
  box-shadow: 0 0 8px #34d399;
}

.tp-btn {
  @apply inline-flex cursor-pointer items-center justify-center rounded-lg font-mono transition disabled:opacity-40;
  padding: 0.55rem 1rem;
  font-size: clamp(0.8rem, 1.8vw, 0.9rem);
}
.tp-btn--primary {
  @apply border border-emerald-400/40 bg-emerald-500/20 text-emerald-50;
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.2);
}
.tp-btn--ghost {
  @apply border border-white/15 bg-white/5 text-white/70 hover:text-emerald-100;
}
.tp-btn--forge {
  @apply shrink-0 border border-emerald-400/50 bg-emerald-500/25 font-semibold text-emerald-50;
}

.tp-coverage {
  @apply mt-2 text-[11px] leading-snug text-slate-400;
}
.tp-breakdown {
  @apply mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-300;
  span {
    @apply rounded bg-slate-800/80 px-1.5 py-0.5;
  }
  &__ti {
    @apply font-medium text-emerald-300/90;
  }
}
.tp-err {
  @apply mt-2 font-mono text-sm text-rose-300;
}
.tp-note {
  @apply mt-2 font-mono text-xs text-emerald-200/70;
}

.tp-gauge-wrap {
  @apply flex flex-col items-center gap-4;
}
.tp-gauge {
  width: min(220px, 70%);
  .tp-gauge__track {
    fill: none;
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 12;
  }
  .tp-gauge__arc {
    fill: none;
    stroke-width: 12;
    stroke-linecap: round;
    stroke-dasharray: 490;
    transform: rotate(-90deg);
    transform-origin: 100px 100px;
    filter: drop-shadow(0 0 8px currentColor);
  }
  .tp-gauge__arc--safe {
    stroke: #34d399;
  }
  .tp-gauge__arc--warn {
    stroke: #fbbf24;
  }
  .tp-gauge__arc--risk {
    stroke: #f43f5e;
  }
  .tp-gauge__val {
    fill: #ecfdf5;
    font-size: 22px;
    font-family: ui-monospace, monospace;
    text-anchor: middle;
  }
  .tp-gauge__sub {
    fill: rgba(255, 255, 255, 0.45);
    font-size: 11px;
    text-anchor: middle;
  }
}

.tp-kpi {
  @apply grid w-full grid-cols-2 gap-2;
}
.tp-kpi__card {
  @apply rounded-lg border border-white/10 bg-black/30 px-3 py-2;
  span {
    @apply block font-mono text-[0.65rem] uppercase tracking-wider text-white/40;
  }
  strong {
    @apply mt-1 block font-mono text-sm text-emerald-50;
  }
}
.tp-kpi__card--safe strong {
  @apply text-emerald-300;
  text-shadow: 0 0 12px rgba(52, 211, 153, 0.45);
}
.tp-kpi__card--risk strong {
  @apply text-rose-300;
  text-shadow: 0 0 12px rgba(244, 63, 94, 0.4);
}
.tp-kpi__card--warn {
  @apply border-amber-400/40;
  strong {
    @apply text-amber-200;
  }
}

.tp-metrics {
  @apply grid gap-2 sm:grid-cols-3;
}
.tp-card {
  @apply rounded-xl border border-white/10 bg-black/25 p-3;
  h3 {
    @apply font-mono text-xs tracking-wide text-white/50;
  }
  p {
    @apply mt-1 font-mono text-sm text-emerald-50;
  }
}
.tp-card__sub {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}
.tp-card--warn {
  @apply border-amber-400/40 bg-amber-500/5;
}
.tp-card--risk {
  @apply border-rose-500/40 bg-rose-500/5;
}
.tp-card--safe {
  @apply border-emerald-500/35 bg-emerald-500/5;
}

.tp-link {
  @apply mt-2 font-mono text-xs text-emerald-300/90 underline-offset-2 hover:underline;
}

.tp-advice {
  @apply mt-3 space-y-2;
}
.tp-advice__item {
  @apply rounded-xl border border-white/10 bg-black/20 p-3;
  h4 {
    @apply font-display text-base text-emerald-50;
  }
  p {
    @apply mt-1 text-sm text-white/60;
  }
  ul {
    @apply mt-2 list-disc space-y-1 pl-5 text-sm text-white/50;
  }
}
.tp-advice__item--warn {
  @apply border-amber-400/35;
}
.tp-advice__item--critical {
  @apply border-rose-500/45;
}
.tp-badge {
  @apply mr-2 inline-block rounded border border-white/15 px-1.5 py-0.5 font-mono text-[0.65rem] text-white/50;
}

.tp-empty {
  @apply py-10 text-center font-mono text-sm text-white/30;
}

.tp-detail {
  @apply mt-4 rounded-xl border border-emerald-500/25 bg-black/30 p-3;
  h3 {
    @apply mb-2 font-mono text-sm text-emerald-200;
  }
  table {
    @apply w-full text-left text-sm;
  }
  th {
    @apply border-b border-white/10 py-1.5 font-mono text-xs text-white/40;
  }
  td {
    @apply border-b border-white/5 py-1.5 font-mono text-emerald-50/90;
  }
}

@keyframes tp-orbit {
  from {
    transform: rotate(calc(var(--i) * 30deg)) translateX(70px) scale(0.6);
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
  to {
    transform: rotate(calc(var(--i) * 30deg + 360deg)) translateX(70px) scale(0.6);
    opacity: 0.2;
  }
}
</style>
