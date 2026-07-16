<template>
  <div class="cit-shell" role="presentation" @click.self="goHome">
    <div class="cit-shell__grid" aria-hidden="true" />
    <div class="cit-modal" role="dialog" aria-modal="true" aria-labelledby="cit-title">
      <div class="cit-modal__glow" aria-hidden="true" />
      <header class="cit-modal__head">
        <div>
          <div class="cit-modal__eyebrow">
            <span class="cit-modal__code">FIN · CIT</span>
            <span class="cit-modal__pulse" aria-hidden="true" />
            <span class="cit-modal__badge">利润倒推 · 本机</span>
          </div>
          <h1 id="cit-title" class="cit-modal__title">企税利润倒推</h1>
          <p class="cit-modal__lead">
            目标税后利润 + 成本/收入结构 + 常见纳税调整，反推最低营收或最大可配成本（多场景简化测算）
          </p>
        </div>
        <button type="button" class="cit-modal__close" aria-label="关闭" @click="goHome">✕</button>
      </header>

      <div class="cit-modal__body">
        <section class="cit-panel">
          <div class="cit-modes">
            <button
              type="button"
              class="cit-chip"
              :class="{ 'cit-chip--on': mode === 'minRevenue' }"
              @click="mode = 'minRevenue'">
              估最低营收
            </button>
            <button
              type="button"
              class="cit-chip"
              :class="{ 'cit-chip--on': mode === 'maxCost' }"
              @click="mode = 'maxCost'">
              估最大成本
            </button>
          </div>

          <div class="cit-fields">
            <label class="cit-field">
              <span>目标税后利润</span>
              <input
                v-model.number="afterTax"
                type="number"
                step="0.01"
                min="0"
                placeholder="必填"
              />
            </label>

            <label class="cit-field">
              <span>企业所得税率</span>
              <select v-model="rateKey">
                <option value="0.25">25% 一般企业</option>
                <option value="0.2">20% 示意小微</option>
                <option value="0.15">15% 高新/西部等示意</option>
                <option value="custom">自定义…</option>
              </select>
            </label>
            <label v-if="rateKey === 'custom'" class="cit-field">
              <span>自定义税率 %</span>
              <input v-model.number="customRatePct" type="number" step="0.01" min="0" max="99.99" />
            </label>
          </div>

          <div v-if="mode === 'minRevenue'" class="cit-block">
            <header class="cit-block__head">
              <h3>成本结构</h3>
              <span>合计 {{ money(costSumLive) }}</span>
            </header>
            <div class="cit-fields">
              <label class="cit-field">
                <span>营业成本</span>
                <input
                  v-model.number="operatingCost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="材料/人工/制造等"
                />
              </label>
              <label class="cit-field">
                <span>期间费用</span>
                <input
                  v-model.number="periodExpense"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="销售/管理/财务等"
                />
              </label>
              <label class="cit-field">
                <span>其他支出</span>
                <input
                  v-model.number="otherExpense"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="营业外、一次性等"
                />
              </label>
            </div>
            <p class="cit-block__tip">至少填一项；未填分项记 0。亦可只填其中一类简化。</p>
          </div>

          <div v-else class="cit-block">
            <header class="cit-block__head">
              <h3>收入结构</h3>
              <span>合计 {{ money(revenueSumLive) }}</span>
            </header>
            <div class="cit-fields">
              <label class="cit-field">
                <span>营业收入</span>
                <input
                  v-model.number="operatingRevenue"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="主业收入"
                />
              </label>
              <label class="cit-field">
                <span>其他收益</span>
                <input
                  v-model.number="otherIncome"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="投资收益、营业外等"
                />
              </label>
            </div>
            <p class="cit-block__tip">至少填一项。结论为在既定收入下可容忍的最大成本合计。</p>
          </div>

          <details class="cit-adv" :open="taxOpen">
            <summary @click.prevent="taxOpen = !taxOpen">
              纳税调整 / 研发加计（可选）
              <em>{{ taxOpen ? '收起' : '展开' }}</em>
            </summary>
            <div class="cit-fields">
              <label class="cit-field">
                <span>研发费用</span>
                <input
                  v-model.number="rdExpense"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="已入成本也可填加计"
                />
              </label>
              <label class="cit-field">
                <span>加计扣除比例 %</span>
                <input v-model.number="rdSuperPct" type="number" step="1" min="0" max="200" />
              </label>
              <label class="cit-field">
                <span>纳税调增</span>
                <input
                  v-model.number="taxAddBack"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="罚款、超标招待等"
                />
              </label>
              <label class="cit-field">
                <span>免税收入</span>
                <input
                  v-model.number="taxExempt"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="国债利息等"
                />
              </label>
              <label class="cit-field">
                <span>弥补以前年度亏损</span>
                <input
                  v-model.number="lossCarry"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="可税前弥补额"
                />
              </label>
            </div>
          </details>

          <p v-if="ready && error" class="cit-err">{{ error }}</p>
        </section>

        <section class="cit-result">
          <header class="cit-result__head">
            <h2>测算结果</h2>
            <div class="cit-result__acts">
              <button type="button" class="cit-btn" :disabled="!result" @click="onCopy">
                {{ copied ? '已复制' : '复制摘要' }}
              </button>
              <button type="button" class="cit-btn" :disabled="!result" @click="onSaveHistory">
                存入历史
              </button>
            </div>
          </header>

          <div v-if="result" class="cit-stats">
            <div>
              <p>税前利润</p>
              <strong>{{ money(result.preTaxProfit) }}</strong>
            </div>
            <div>
              <p>应交所得税</p>
              <strong>{{ money(result.incomeTax) }}</strong>
            </div>
            <div>
              <p>应纳税所得额</p>
              <strong>{{ money(result.taxableIncome) }}</strong>
            </div>
            <div>
              <p>有效税负</p>
              <strong>{{ pct(result.effectiveTaxRate) }}</strong>
            </div>
            <div v-if="mode === 'minRevenue' && result.costSum != null">
              <p>成本合计</p>
              <strong>{{ money(result.costSum) }}</strong>
            </div>
            <div v-else-if="result.revenueSum != null">
              <p>收入合计</p>
              <strong>{{ money(result.revenueSum) }}</strong>
            </div>
            <div>
              <p>税基净调整</p>
              <strong>{{ money(result.meta.taxBaseAdj) }}</strong>
            </div>
            <div class="cit-stats__hl">
              <p>{{ mode === 'minRevenue' ? '最低营收' : '最大可配成本' }}</p>
              <strong>
                {{
                  money(
                    mode === 'minRevenue' ? (result.minRevenue ?? 0) : (result.maxCost ?? 0),
                  )
                }}
              </strong>
            </div>
          </div>
          <p v-else class="cit-hint">
            请先填写目标税后利润，并至少填一项{{ mode === 'minRevenue' ? '成本' : '收入' }}
          </p>

          <aside v-if="history.length" class="cit-hist">
            <header>
              <h3>本机历史</h3>
              <button type="button" class="cit-btn cit-btn--ghost" @click="onClearHist">清空</button>
            </header>
            <ul>
              <li v-for="h in history" :key="h.id">
                <button type="button" @click="applyHistory(h)">
                  <strong>{{ h.headline }}</strong>
                  <span>{{ formatTime(h.savedAt) }} · 税后 {{ money(h.result.afterTaxProfit) }}</span>
                </button>
              </li>
            </ul>
          </aside>

          <p class="cit-disclaimer">
            简化模型：会计利润经「调增 − 免税 − 研发加计 − 亏损弥补」得税基；展示轧平「税前 = 税后 +
            税额」。不含增值税、附加税、递延所得税等，非正式申报依据。
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  clearCitHistory,
  loadCitHistory,
  saveCitHistoryItem,
  type CitHistoryItem,
} from '~/utils/finance/citProfitHistory'
import {
  formatCitSummary,
  resolveCostSum,
  resolveRevenueSum,
  reverseCitProfit,
  type CitMode,
  type CitReverseInput,
  type CitReverseResult,
} from '~/utils/finance/citProfitReverse'

definePageMeta({ layout: false })

useSeoMeta({
  title: '企税利润倒推',
  description: '多场景企税倒推：成本/收入分项 + 纳税调整，估最低营收或最大成本',
})

const mode = ref<CitMode>('minRevenue')
const afterTax = ref<number | null>(null)
const rateKey = ref('0.25')
const customRatePct = ref(25)

const operatingCost = ref<number | null>(null)
const periodExpense = ref<number | null>(null)
const otherExpense = ref<number | null>(null)
const operatingRevenue = ref<number | null>(null)
const otherIncome = ref<number | null>(null)

const rdExpense = ref<number | null>(null)
const rdSuperPct = ref(100)
const taxAddBack = ref<number | null>(null)
const taxExempt = ref<number | null>(null)
const lossCarry = ref<number | null>(null)
const taxOpen = ref(false)

const copied = ref(false)
const history = ref<CitHistoryItem[]>([])

function isNum(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

const taxRate = computed(() => {
  if (rateKey.value === 'custom') return (Number(customRatePct.value) || 0) / 100
  return Number(rateKey.value) || 0.25
})

const costDraft = computed(
  (): CitReverseInput => ({
    afterTaxProfit: 0,
    taxRate: 0,
    mode: 'minRevenue',
    operatingCost: operatingCost.value ?? undefined,
    periodExpense: periodExpense.value ?? undefined,
    otherExpense: otherExpense.value ?? undefined,
  }),
)

const revenueDraft = computed(
  (): CitReverseInput => ({
    afterTaxProfit: 0,
    taxRate: 0,
    mode: 'maxCost',
    operatingRevenue: operatingRevenue.value ?? undefined,
    otherIncome: otherIncome.value ?? undefined,
  }),
)

const costSumLive = computed(() => resolveCostSum(costDraft.value) ?? 0)
const revenueSumLive = computed(() => resolveRevenueSum(revenueDraft.value) ?? 0)

const ready = computed(() => {
  if (!isNum(afterTax.value)) return false
  if (mode.value === 'minRevenue') return resolveCostSum(costDraft.value) != null
  return resolveRevenueSum(revenueDraft.value) != null
})

const currentInput = computed((): CitReverseInput => ({
  afterTaxProfit: afterTax.value ?? 0,
  taxRate: taxRate.value,
  mode: mode.value,
  operatingCost: operatingCost.value ?? undefined,
  periodExpense: periodExpense.value ?? undefined,
  otherExpense: otherExpense.value ?? undefined,
  operatingRevenue: operatingRevenue.value ?? undefined,
  otherIncome: otherIncome.value ?? undefined,
  rdExpense: rdExpense.value ?? 0,
  rdSuperDeduction: (Number(rdSuperPct.value) || 0) / 100,
  taxAddBack: taxAddBack.value ?? 0,
  taxExemptIncome: taxExempt.value ?? 0,
  lossCarryforward: lossCarry.value ?? 0,
}))

const output = computed(() => {
  if (!ready.value) return null
  return reverseCitProfit(currentInput.value)
})
const result = computed<CitReverseResult | null>(() =>
  output.value?.ok ? output.value : null,
)
const error = computed(() =>
  output.value && !output.value.ok ? output.value.message : '',
)

function money(n: number) {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function pct(n: number) {
  return `${(n * 100).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function goHome() {
  void navigateTo('/')
}

async function onCopy() {
  if (!result.value) return
  const text = formatCitSummary(currentInput.value, result.value)
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1600)
  } catch {
    /* ignore */
  }
}

function onSaveHistory() {
  if (!result.value) return
  history.value = saveCitHistoryItem(currentInput.value, result.value)
}

function onClearHist() {
  clearCitHistory()
  history.value = []
}

function applyHistory(h: CitHistoryItem) {
  mode.value = h.input.mode
  afterTax.value = h.input.afterTaxProfit
  operatingCost.value = h.input.operatingCost ?? null
  periodExpense.value = h.input.periodExpense ?? null
  otherExpense.value = h.input.otherExpense ?? null
  // 兼容旧历史仅有 totalCost
  if (
    !isNum(operatingCost.value) &&
    !isNum(periodExpense.value) &&
    !isNum(otherExpense.value) &&
    isNum(h.input.totalCost)
  ) {
    periodExpense.value = h.input.totalCost
  }
  operatingRevenue.value = h.input.operatingRevenue ?? null
  otherIncome.value = h.input.otherIncome ?? null
  if (
    !isNum(operatingRevenue.value) &&
    !isNum(otherIncome.value) &&
    isNum(h.input.revenue)
  ) {
    operatingRevenue.value = h.input.revenue
  }
  rdExpense.value = h.input.rdExpense ?? null
  rdSuperPct.value = Math.round((h.input.rdSuperDeduction ?? 1) * 100)
  taxAddBack.value = h.input.taxAddBack ?? null
  taxExempt.value = h.input.taxExemptIncome ?? null
  lossCarry.value = h.input.lossCarryforward ?? null
  taxOpen.value = Boolean(
    (h.input.rdExpense ?? 0) ||
      (h.input.taxAddBack ?? 0) ||
      (h.input.taxExemptIncome ?? 0) ||
      (h.input.lossCarryforward ?? 0),
  )
  const r = h.input.taxRate
  if (Math.abs(r - 0.25) < 1e-9) rateKey.value = '0.25'
  else if (Math.abs(r - 0.2) < 1e-9) rateKey.value = '0.2'
  else if (Math.abs(r - 0.15) < 1e-9) rateKey.value = '0.15'
  else {
    rateKey.value = 'custom'
    customRatePct.value = Math.round(r * 10000) / 100
  }
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') goHome()
}

onMounted(() => {
  history.value = loadCitHistory()
  window.addEventListener('keydown', onKey)
  document.documentElement.style.overflow = 'hidden'
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})
</script>

<style scoped lang="scss">
$glow-soft: 0 0 10px rgba(110, 196, 184, 0.35), 0 0 2px rgba(180, 240, 220, 0.45);
$glow-strong: 0 0 14px rgba(110, 196, 184, 0.55), 0 0 4px rgba(200, 250, 230, 0.65);
$glow-title: 0 0 18px rgba(110, 196, 184, 0.45), 0 0 6px rgba(230, 255, 245, 0.5);

.cit-shell {
  @apply fixed inset-0 z-[60] flex items-center justify-center;
  padding:
    max(0.5rem, env(safe-area-inset-top))
    max(0.5rem, env(safe-area-inset-right))
    max(0.5rem, env(safe-area-inset-bottom))
    max(0.5rem, env(safe-area-inset-left));
  background:
    radial-gradient(ellipse 65% 45% at 50% -8%, rgba(110, 196, 184, 0.14), transparent 55%),
    rgba(2, 6, 12, 0.84);
  backdrop-filter: blur(18px) saturate(1.2);

  @media (min-width: 640px) {
    padding: max(1rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right))
      max(1rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
  }

  &__grid {
    @apply pointer-events-none absolute inset-0 opacity-[0.05];
    background-image:
      linear-gradient(rgba(110, 196, 184, 0.4) 1px, transparent 1px),
      linear-gradient(90deg, rgba(110, 196, 184, 0.4) 1px, transparent 1px);
    background-size: 40px 40px;
  }
}

.cit-modal {
  @apply relative flex w-full flex-col overflow-hidden;
  width: min(68rem, 100%);
  max-height: min(94dvh, 100%);
  border: 1px solid rgba(110, 196, 184, 0.35);
  border-radius: clamp(0.65rem, 1.6vw, 1.05rem);
  background: linear-gradient(168deg, rgba(12, 22, 28, 0.98), rgba(5, 10, 14, 0.995));
  box-shadow:
    0 0 0 1px rgba(110, 196, 184, 0.08),
    0 0 48px rgba(110, 196, 184, 0.12);

  &__glow {
    @apply pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full;
    background: radial-gradient(circle, rgba(110, 196, 184, 0.28), transparent 70%);
    filter: blur(12px);

    @media (max-width: 639px) {
      @apply h-36 w-36 opacity-70;
    }
  }

  &__head {
    @apply relative z-[1] flex shrink-0 items-start justify-between gap-3 border-b border-white/10;
    padding: clamp(0.85rem, 2.2vw, 1.5rem) clamp(0.85rem, 2.5vw, 2rem);
  }

  &__eyebrow {
    @apply flex flex-wrap items-center gap-2.5;
  }

  &__code {
    @apply font-mono tracking-[0.28em] text-emerald-200;
    font-size: clamp(0.65rem, 1.6vw, 0.75rem);
    text-shadow: $glow-soft;
  }

  &__pulse {
    @apply h-2 w-2 rounded-full bg-emerald-300;
    box-shadow: 0 0 10px rgba(110, 196, 184, 0.95);
  }

  &__badge {
    @apply rounded border border-emerald-400/35 bg-emerald-400/15 px-2 py-0.5;
    @apply font-mono tracking-[0.12em] text-emerald-100;
    font-size: clamp(0.62rem, 1.5vw, 0.7rem);
    text-shadow: $glow-soft;
  }

  &__title {
    @apply mt-2 font-display tracking-wide text-slate-50;
    font-size: clamp(1.2rem, 3.6vw, 1.875rem);
    text-shadow: $glow-title;
  }

  &__lead {
    @apply mt-2 max-w-2xl font-mono leading-relaxed tracking-wide text-slate-300;
    font-size: clamp(0.75rem, 2vw, 0.875rem);
    text-shadow: $glow-soft;
  }

  &__close {
    @apply shrink-0 rounded border border-white/15 px-2.5 py-1.5 font-mono text-slate-200;
    @apply hover:border-emerald-400/50 hover:text-emerald-100;
    font-size: clamp(0.85rem, 2vw, 1rem);
    text-shadow: $glow-soft;
  }

  &__body {
    @apply relative z-[1] grid min-h-0 flex-1 gap-0 overflow-y-auto;
    grid-template-columns: 1fr;

    @media (min-width: 900px) {
      grid-template-columns: 1fr 1fr;
    }
  }
}

.cit-panel {
  @apply border-b border-white/10;
  padding: clamp(0.85rem, 2.5vw, 2rem);

  @media (min-width: 900px) {
    @apply border-b-0 border-r;
  }
}

.cit-modes {
  @apply mb-5 flex flex-wrap gap-2.5;
}

.cit-chip {
  @apply rounded border border-white/15 px-3 py-1.5 font-mono tracking-wider text-slate-300 sm:px-4 sm:py-2;
  font-size: clamp(0.75rem, 2vw, 0.875rem);
  text-shadow: $glow-soft;

  &--on {
    @apply border-emerald-400/55 bg-emerald-400/15 text-emerald-100;
    text-shadow: $glow-strong;
    box-shadow: 0 0 16px rgba(110, 196, 184, 0.18);
  }
}

.cit-fields {
  @apply grid gap-3;
  grid-template-columns: 1fr;

  @media (min-width: 480px) {
    @apply gap-4;
    grid-template-columns: 1fr 1fr;
  }
}

.cit-block {
  @apply mt-5 rounded-lg border border-white/10 bg-white/[0.03];
  padding: clamp(0.75rem, 2vw, 1rem);

  &__head {
    @apply mb-3 flex flex-wrap items-baseline justify-between gap-2;

    h3 {
      @apply font-mono tracking-[0.14em] text-emerald-100;
      font-size: clamp(0.72rem, 1.8vw, 0.8rem);
      text-shadow: $glow-soft;
    }

    span {
      @apply font-mono text-slate-300;
      font-size: clamp(0.7rem, 1.7vw, 0.8rem);
      text-shadow: $glow-soft;
    }
  }

  &__tip {
    @apply mt-2.5 font-mono leading-relaxed text-slate-400;
    font-size: clamp(0.65rem, 1.5vw, 0.72rem);
    text-shadow: $glow-soft;
  }
}

.cit-adv {
  @apply mt-5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04];
  padding: clamp(0.65rem, 1.8vw, 0.85rem) clamp(0.75rem, 2vw, 1rem);

  summary {
    @apply flex cursor-pointer list-none items-center justify-between gap-2;
    @apply font-mono tracking-[0.12em] text-emerald-100/90;
    font-size: clamp(0.72rem, 1.8vw, 0.8rem);
    text-shadow: $glow-soft;

    em {
      @apply not-italic text-slate-400;
      font-size: clamp(0.65rem, 1.5vw, 0.72rem);
    }
  }

  .cit-fields {
    @apply mt-3;
  }
}

.cit-field {
  @apply flex flex-col gap-1.5;
  min-width: 0;

  span {
    @apply font-mono tracking-[0.12em] text-emerald-100/80;
    font-size: clamp(0.68rem, 1.7vw, 0.75rem);
    text-shadow: $glow-soft;
  }

  input,
  select {
    @apply w-full min-w-0 rounded-md border border-white/15 bg-black/30 px-2.5 py-2 sm:px-3 sm:py-2.5;
    @apply font-mono text-slate-50 outline-none;
    @apply focus:border-emerald-400/55;
    font-size: clamp(0.875rem, 2.2vw, 1rem);
    text-shadow: $glow-soft;
  }

  input::placeholder {
    @apply text-slate-400;
  }
}

.cit-err {
  @apply mt-4 font-mono text-sm text-rose-200;
  text-shadow: 0 0 10px rgba(251, 113, 133, 0.45);
}

.cit-result {
  @apply flex flex-col;
  gap: clamp(0.85rem, 2vw, 1.25rem);
  padding: clamp(0.85rem, 2.5vw, 2rem);

  &__head {
    @apply flex flex-wrap items-center justify-between gap-2;

    h2 {
      @apply font-mono tracking-[0.16em] text-emerald-100;
      font-size: clamp(0.75rem, 2vw, 0.875rem);
      text-shadow: $glow-soft;
    }
  }

  &__acts {
    @apply flex flex-wrap gap-2;
  }
}

.cit-btn {
  @apply rounded border border-emerald-400/45 px-3 py-1.5 font-mono tracking-wider text-emerald-100;
  @apply hover:border-emerald-300/70 disabled:opacity-35;
  font-size: clamp(0.72rem, 1.9vw, 0.875rem);
  text-shadow: $glow-soft;

  &--ghost {
    @apply border-white/15 text-slate-300 hover:border-white/25 hover:text-slate-100;
  }
}

.cit-stats {
  @apply grid grid-cols-2;
  gap: clamp(0.5rem, 1.5vw, 0.875rem);

  div {
    @apply rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2.5 sm:px-3.5 sm:py-3;
    min-width: 0;
  }

  p {
    @apply font-mono tracking-[0.12em] text-emerald-100/75;
    font-size: clamp(0.65rem, 1.6vw, 0.75rem);
    text-shadow: $glow-soft;
  }

  strong {
    @apply mt-1.5 block break-all font-mono text-slate-50;
    font-size: clamp(0.95rem, 2.8vw, 1.25rem);
    text-shadow: $glow-strong;
  }

  &__hl {
    @apply col-span-2 border-emerald-400/35 bg-emerald-400/[0.08];

    strong {
      font-size: clamp(1.15rem, 3.4vw, 1.5rem);
      @apply text-emerald-100;
      text-shadow: $glow-title;
    }
  }
}

.cit-hint {
  @apply font-mono text-slate-300;
  font-size: clamp(0.75rem, 2vw, 0.875rem);
  text-shadow: $glow-soft;
}

.cit-hist {
  @apply rounded-lg border border-white/10 p-4;

  header {
    @apply mb-2.5 flex items-center justify-between;
  }

  h3 {
    @apply font-mono text-xs tracking-[0.14em] text-emerald-100/80;
    text-shadow: $glow-soft;
  }

  ul {
    @apply max-h-44 space-y-1.5 overflow-y-auto;
  }

  button {
    @apply flex w-full flex-col items-start gap-0.5 rounded px-2.5 py-2 text-left;
    @apply hover:bg-white/[0.05];

    strong {
      @apply font-mono text-sm text-slate-100;
      text-shadow: $glow-soft;
    }

    span {
      @apply font-mono text-xs text-slate-400;
    }
  }
}

.cit-disclaimer {
  @apply mt-auto font-mono leading-relaxed tracking-wide text-slate-400;
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
  text-shadow: $glow-soft;
}

@media (max-width: 479px) {
  .cit-stats {
    grid-template-columns: 1fr;

    &__hl {
      grid-column: 1;
    }
  }
}
</style>
