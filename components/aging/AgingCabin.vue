<template>
  <div class="ag-cabin">
    <section class="ag-ingest">
      <header class="ag-sec-head">
        <span class="ag-code">DATA · LEDGER</span>
        <h2>往来明细投递</h2>
      </header>

      <ol class="ag-steps">
        <li>准备序时账：默认列序为 编码(A) / 日期(B) / 摘要(C) / 借方(D) / 贷方(E)</li>
        <li>按实际表头调整下方「列索引」（从 0 起算，A=0）</li>
        <li>选择文件、确认审计基准日后扫描</li>
      </ol>

      <div class="ag-drop">
        <label class="ag-upload">
          <span class="ag-upload__title">{{ fileName || '选择往来明细文件' }}</span>
          <span class="ag-upload__hint">支持 .xlsx / .xls / .csv · 最大 5MB</span>
          <input type="file" accept=".xlsx,.xls,.csv" @change="onFile" />
        </label>
        <a class="ag-sample" href="/samples/aging-ledger.csv" download>下载样例 CSV</a>
      </div>

      <div class="ag-map">
        <span class="ag-map__title">列索引映射（0-based）</span>
        <div class="ag-map__grid">
          <label>客商编码<input v-model.number="col.targetCode" type="number" min="0" step="1" /></label>
          <label>业务日期<input v-model.number="col.txDate" type="number" min="0" step="1" /></label>
          <label>借方金额<input v-model.number="col.debitAmount" type="number" min="0" step="1" /></label>
          <label>贷方金额<input v-model.number="col.creditAmount" type="number" min="0" step="1" /></label>
        </div>
      </div>

      <label class="ag-date">
        <span>审计基准日</span>
        <input v-model="auditDate" type="date" />
      </label>

      <button type="button" class="ag-btn" :disabled="busy || !file" @click="run">
        {{ busy ? '分析中…' : 'FIFO 账龄扫描' }}
      </button>

      <p v-if="error" class="ag-err">{{ error }}</p>
      <p v-else-if="report" class="ag-note">
        解析 {{ report.parsedTxCount }} 笔 · 借 {{ report.debitCount }} / 贷 {{ report.creditCount }} · 客商
        {{ report.partyCount }} · {{ report.note }}
      </p>

      <div v-if="report" class="ag-kpis">
        <article>
          <h3>未核销余额</h3>
          <p>{{ money(report.totalOpenBalance) }}</p>
        </article>
        <article>
          <h3>坏账计提估算</h3>
          <p>{{ money(report.totalProvision) }}</p>
        </article>
        <article v-for="(label, key) in BUCKET_LABEL" :key="key">
          <h3>{{ label }} · {{ BUCKET_RATE[key] }}</h3>
          <p>{{ money(report.bucketTotals?.[key]) }}</p>
        </article>
      </div>
    </section>

    <section class="ag-viz">
      <header class="ag-sec-head">
        <span class="ag-code">RADAR · 3D</span>
        <h2>账龄数据岛</h2>
      </header>
      <div class="ag-legend">
        <span class="ag-legend__item"><i class="ag-dot ag-dot--y0" />1年以内</span>
        <span class="ag-legend__item"><i class="ag-dot ag-dot--y1" />1–2年</span>
        <span class="ag-legend__item"><i class="ag-dot ag-dot--y2" />2–3年</span>
        <span class="ag-legend__item"><i class="ag-dot ag-dot--y3" />3年以上</span>
        <span class="ag-legend__meta">柱高 = 未核销金额 · 点击查看明细</span>
      </div>
      <div class="ag-canvas-wrap">
        <ClientOnly>
          <div ref="canvasHost" class="ag-canvas">
            <p v-if="!report" class="ag-canvas__placeholder">上传并扫描后生成全息数据岛</p>
          </div>
          <template #fallback>
            <div class="ag-canvas">
              <p class="ag-canvas__placeholder">3D 视图加载中…</p>
            </div>
          </template>
        </ClientOnly>
        <aside v-if="selected" class="ag-panel">
          <button type="button" class="ag-panel__close" @click="selected = null">✕</button>
          <h3>{{ selected.targetCode }}</h3>
          <p>未核销 {{ money(selected.openBalance) }} · 计提 {{ money(selected.provision) }}</p>
          <p class="ag-panel__sub">最差分桶 {{ BUCKET_LABEL[selected.worstBucket] || selected.worstBucket }}</p>
          <ul>
            <li v-for="(it, i) in selected.openItems.slice(0, 8)" :key="i">
              {{ it.originDate }} · {{ money(it.remaining) }} · {{ it.agingDays }}天 ·
              {{ BUCKET_LABEL[it.bucket] || it.bucket }}
            </li>
          </ul>
        </aside>
      </div>
    </section>

    <section class="ag-table">
      <header class="ag-sec-head">
        <span class="ag-code">PLAN · LIST</span>
        <h2>客商账龄表</h2>
      </header>
      <div class="ag-scroll">
        <table v-if="report?.parties?.length">
          <thead>
            <tr>
              <th>客商</th>
              <th>未核销</th>
              <th>计提</th>
              <th>溢余贷方</th>
              <th>最差分桶</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in report.parties"
              :key="p.targetCode"
              :class="{ 'is-hot': p.worstBucket === 'OVER_THREE_YEARS' }"
              @click="selected = p">
              <td>{{ p.targetCode }}</td>
              <td>{{ money(p.openBalance) }}</td>
              <td>{{ money(p.provision) }}</td>
              <td>{{ money(p.unallocatedCredit) }}</td>
              <td>{{ BUCKET_LABEL[p.worstBucket] || p.worstBucket }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="ag-empty">上传往来明细并扫描后展示 FIFO 结果</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  BUCKET_LABEL,
  BUCKET_RATE,
  DEFAULT_MAPPING_CONFIG,
  money,
  scanAgingLedger,
  validateAgingUpload,
  type AgingParty,
  type AgingReport,
} from '~/utils/aging/api'

type IslandScene = {
  setParties: (parties: AgingParty[]) => void
  dispose: () => void
}

const file = ref<File | null>(null)
const fileName = ref('')
const auditDate = ref(new Date().toISOString().slice(0, 10))
const col = reactive({ ...DEFAULT_MAPPING_CONFIG })
const busy = ref(false)
const error = ref('')
const report = ref<AgingReport | null>(null)
const selected = ref<AgingParty | null>(null)
const canvasHost = ref<HTMLElement | null>(null)
let scene: IslandScene | null = null

onMounted(async () => {
  await nextTick()
  if (!canvasHost.value) return
  try {
    const { AgingIslandScene } = await import('~/utils/aging/AgingIslandScene')
    scene = new AgingIslandScene(canvasHost.value, (p) => {
      selected.value = p
    })
    if (report.value?.parties) {
      scene.setParties(report.value.parties)
    }
  } catch (e) {
    console.warn('AgingIslandScene init failed', e)
  }
})

onUnmounted(() => {
  scene?.dispose()
  scene = null
})

watch(
  () => report.value?.parties,
  (parties) => {
    scene?.setParties(parties || [])
  },
)

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  error.value = ''
  if (!f) return
  const bad = validateAgingUpload(f)
  if (bad) {
    error.value = bad
    file.value = null
    fileName.value = ''
    return
  }
  file.value = f
  fileName.value = f.name
}

async function run() {
  if (!file.value) return
  busy.value = true
  error.value = ''
  selected.value = null
  try {
    report.value = await scanAgingLedger(file.value, auditDate.value || undefined, {
      targetCode: Number(col.targetCode),
      txDate: Number(col.txDate),
      debitAmount: Number(col.debitAmount),
      creditAmount: Number(col.creditAmount),
    })
  } catch (err: unknown) {
    report.value = null
    error.value = err instanceof Error ? err.message : '扫描失败'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped lang="scss">
.ag-cabin {
  @apply grid h-full min-h-0 w-full flex-1 gap-3 overflow-auto p-3;
  grid-template-columns: minmax(16rem, 0.9fr) minmax(18rem, 1.2fr) minmax(16rem, 1fr);
  color: #e2e8f0;
}

.ag-sec-head {
  @apply mb-2;
  h2 {
    @apply text-base font-semibold text-sky-50;
  }
}
.ag-code {
  @apply mb-1 block font-mono text-[0.65rem] tracking-[0.18em] text-sky-300/70;
}

.ag-ingest,
.ag-viz,
.ag-table {
  @apply flex min-h-[18rem] min-w-0 flex-col overflow-hidden rounded-xl border border-sky-400/20 bg-slate-950/70 p-3;
}

.ag-viz {
  .ag-sec-head {
    @apply shrink-0;
  }
}

.ag-hint {
  @apply mb-2 shrink-0 font-mono text-[0.7rem] leading-snug text-sky-200/70;
  writing-mode: horizontal-tb;
  white-space: normal;
  word-break: break-word;
}

.ag-legend {
  @apply mb-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.68rem] text-sky-100/80;
  &__item {
    @apply inline-flex items-center gap-1.5;
  }
  &__meta {
    @apply text-white/40;
  }
}
.ag-dot {
  @apply inline-block h-2 w-2 rounded-full;
  box-shadow: 0 0 8px currentColor;
  &--y0 {
    @apply bg-sky-400 text-sky-400;
  }
  &--y1 {
    @apply bg-cyan-300 text-cyan-300;
  }
  &--y2 {
    @apply bg-amber-400 text-amber-400;
  }
  &--y3 {
    @apply bg-rose-500 text-rose-500;
  }
}

.ag-canvas-wrap {
  @apply relative min-h-0 min-w-0 w-full flex-1 overflow-hidden;
}

.ag-canvas {
  @apply relative flex h-full min-h-[200px] w-full items-center justify-center overflow-hidden rounded-lg border border-sky-400/20 bg-[radial-gradient(ellipse_at_center,_#0c4a6e22_0%,_#020617_70%)];
  :deep(canvas) {
    position: absolute !important;
    inset: 0 !important;
    display: block !important;
    width: 100% !important;
    height: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
  }
  &__placeholder {
    @apply relative z-[1] px-3 text-center font-mono text-xs text-white/35;
  }
}

.ag-panel {
  @apply absolute bottom-2 left-2 right-2 z-[2] max-h-[42%] overflow-auto rounded-lg border border-cyan-400/35 bg-slate-950/90 p-2.5 text-sm shadow-[0_0_24px_rgba(34,211,238,0.15)] backdrop-blur-md;
  h3 {
    @apply pr-6 font-mono text-cyan-100;
  }
  &__sub {
    @apply text-xs text-white/50;
  }
  &__close {
    @apply absolute right-2 top-2 rounded border border-white/10 px-1.5 text-xs text-white/50 hover:text-white;
  }
  ul {
    @apply mt-1 space-y-0.5 font-mono text-[0.7rem] text-white/70;
  }
}

.ag-steps {
  @apply mb-3 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-white/55;
}

.ag-drop {
  @apply mb-2 flex flex-col gap-2;
}

.ag-upload {
  @apply relative flex cursor-pointer flex-col gap-1 rounded-lg border border-dashed border-sky-400/35 bg-sky-500/5 px-3 py-4 text-sm text-white/70 transition hover:border-sky-300/50 hover:bg-sky-500/10;
  input[type='file'] {
    @apply absolute inset-0 cursor-pointer opacity-0;
  }
  &__title {
    @apply font-medium text-sky-100;
  }
  &__hint {
    @apply font-mono text-[0.7rem] text-white/40;
  }
}

.ag-sample {
  @apply self-start rounded border border-white/15 px-2 py-1 font-mono text-xs text-sky-200/90 hover:border-sky-400/40;
}

.ag-map {
  @apply mb-2 rounded-lg border border-white/10 bg-white/[0.03] p-2;
  &__title {
    @apply mb-1.5 block font-mono text-[0.68rem] tracking-wide text-sky-300/70;
  }
  &__grid {
    @apply grid grid-cols-2 gap-2;
  }
  label {
    @apply flex flex-col gap-0.5 text-[0.72rem] text-white/55;
  }
  input[type='number'] {
    @apply rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-sm text-sky-50;
  }
}

.ag-date {
  @apply mb-2 flex flex-col gap-1 text-sm text-white/70;
  input[type='date'] {
    @apply rounded border border-white/10 bg-white/5 px-2 py-1 text-sky-50;
  }
}

.ag-btn {
  @apply rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-2 text-sm text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-40;
}

.ag-err {
  @apply mt-2 text-sm text-rose-300;
}
.ag-note {
  @apply mt-2 font-mono text-xs text-white/50;
}

.ag-kpis {
  @apply mt-3 grid grid-cols-2 gap-2 overflow-auto;
  article {
    @apply rounded-lg border border-white/10 bg-white/5 p-2;
    h3 {
      @apply text-[0.7rem] text-white/50;
    }
    p {
      @apply mt-1 font-mono text-sm text-sky-100;
    }
  }
}

.ag-scroll {
  @apply min-h-0 flex-1 overflow-auto;
}
table {
  @apply w-full border-collapse text-left text-sm;
  th,
  td {
    @apply border-b border-white/10 px-2 py-1.5 font-mono;
  }
  th {
    @apply sticky top-0 bg-slate-950 text-[0.7rem] text-white/45;
  }
  tr {
    @apply cursor-pointer transition hover:bg-sky-500/10;
  }
  tr.is-hot td {
    @apply text-rose-200;
  }
}
.ag-empty {
  @apply py-8 text-center text-sm text-white/40;
}

@media (max-width: 1100px) {
  .ag-cabin {
    grid-template-columns: 1fr;
  }
  .ag-canvas {
    min-height: 260px;
  }
}
</style>
