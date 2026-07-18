<template>
  <div class="xx-cabin">
    <aside class="xx-rail">
      <section class="xx-block">
        <div class="xx-block__label">01 · 投递</div>
        <label class="xx-upload" :class="{ 'is-ready': !!fileName }">
          <span class="xx-upload__mark">XML</span>
          <span class="xx-upload__title">{{ fileName || '选择工业词条包' }}</span>
          <span class="xx-upload__hint">.xml · ≤8MB · &lt;文本 ID&gt; + 语言子标签</span>
          <input type="file" accept=".xml,text/xml,application/xml" @change="onFile" />
        </label>
        <a class="xx-link" href="/samples/xml-xlate-demo.xml" download>下载样例词条包</a>
      </section>

      <section class="xx-block">
        <div class="xx-block__label">02 · 语言标签</div>
        <p class="xx-flow">按 XML 子标签名识别语言；目标格可能仍是中文，将译成标签所指语言。</p>
        <label class="xx-field">
          <span>源语言标签</span>
          <select v-model="sourceTag" class="xx-input" :disabled="!languageTags.length">
            <option v-for="t in languageTags" :key="t" :value="t">{{ t }}</option>
          </select>
        </label>
        <div class="xx-chips">
          <button
            v-for="t in targetTags"
            :key="t"
            type="button"
            class="xx-chip"
            :class="{ 'is-active': activeTarget === t, 'is-done': translatedTags.has(t) }"
            @click="activeTarget = t">
            {{ t }}{{ translatedTags.has(t) ? ' ✓' : '' }}
          </button>
          <span v-if="!targetTags.length" class="xx-chips__empty">上传后自动识别目标标签</span>
        </div>
      </section>

      <section class="xx-block xx-block--grow">
        <div class="xx-block__label">03 · 执行</div>
        <p class="xx-flow">源：{{ sourceTag || '—' }} → 目标：{{ activeTarget || '—' }}</p>
        <p class="xx-hint">
          逐个目标列翻译（点上方标签切换）。约 {{ translateEta }}。导出只改已译语言标签正文，格式与上传文件一致。
        </p>
        <button
          type="button"
          class="xx-btn xx-btn--primary"
          :disabled="busy || !sessionId || !sourceTag || !activeTarget"
          @click="runTranslate">
          {{ busy ? `翻译进行中… ${progressLabel || ''}`.trim() : `翻译「${activeTarget || '目标'}」列` }}
        </button>
        <button
          type="button"
          class="xx-btn xx-btn--ghost xx-btn--block"
          :disabled="!sessionId || busy || !translatedTags.size"
          @click="runExport">
          导出 XML（仅回写已译标签：{{ exportTagSummary }}）
        </button>

        <div
          v-if="busy || (progressPct > 0 && progressPct < 100)"
          class="xx-progress"
          role="progressbar"
          :aria-valuenow="progressPct">
          <div class="xx-progress__bar" :style="{ width: progressPct + '%' }" />
          <span class="xx-progress__label">{{ progressLabel || '准备中' }} · {{ progressPct }}%</span>
        </div>
        <p v-else-if="lastDoneTag" class="xx-ok">「{{ lastDoneTag }}」列已完成 · {{ translatedSummary }}</p>

        <p v-if="error" class="xx-err">{{ error }}</p>
        <p v-else-if="sessionId" class="xx-meta">
          <span>{{ rows.length }} 条词条</span>
          <span>{{ fileName }}</span>
          <span class="xx-meta__sid">{{ sessionId.slice(0, 10) }}…</span>
        </p>
      </section>
    </aside>

    <section class="xx-stage">
      <header class="xx-stage__head">
        <div>
          <span class="xx-code">GRID · V2</span>
          <h2>虚拟化对照表</h2>
        </div>
        <div class="xx-stage__cols">
          <span class="xx-pill">ID</span>
          <span v-for="t in languageTags" :key="t" class="xx-pill" :class="{ 'xx-pill--lang': t !== sourceTag }">
            {{ t }}
          </span>
        </div>
      </header>

      <ClientOnly>
        <div class="xx-table-host">
          <XmlVirtualTable v-if="rows.length" :columns="columns" :data="rows" />
          <div v-else class="xx-empty">
            <div class="xx-empty__frame" aria-hidden="true">
              <span /><span /><span />
            </div>
            <p class="xx-empty__title">等待词条投递</p>
            <p class="xx-empty__hint">上传「文本 ID + 语言子标签」XML 后，在此对照各语言列</p>
          </div>
        </div>
        <template #fallback>
          <div class="xx-table-host">
            <div class="xx-empty"><p class="xx-empty__hint">表格引擎加载中…</p></div>
          </div>
        </template>
      </ClientOnly>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { Column } from 'element-plus'
import {
  decodeXmlEntities,
  entriesToRows,
  exportTranslatedXml,
  parseProgress,
  translateXmlStream,
  uploadXmlLedger,
  validateXmlUpload,
  type XmlRow,
} from '~/utils/xmlxlate/api'

const XmlVirtualTable = defineAsyncComponent(() => import('./XmlVirtualTable.client.vue'))

const file = ref<File | null>(null)
const fileName = ref('')
const sessionId = ref('')
const languageTags = ref<string[]>([])
const sourceTag = ref('')
const activeTarget = ref('')
const busy = ref(false)
const error = ref('')
const progressLabel = ref('')
const progressPct = ref(0)
const lastDoneTag = ref('')
/** tags translated in this browser session (export only these, not raw source leftovers) */
const translatedTags = ref<Set<string>>(new Set())

/** shallowRef: skip deep proxy on large tables */
const rows = shallowRef<XmlRow[]>([])

const targetTags = computed(() => languageTags.value.filter((t) => t !== sourceTag.value))

const translatedSummary = computed(() => {
  const done = targetTags.value.filter((t) => translatedTags.value.has(t))
  const pending = targetTags.value.filter((t) => !translatedTags.value.has(t))
  if (!done.length) return '尚未翻译任何目标列'
  if (!pending.length) return `已全部译完：${done.join('、')}`
  return `已译 ${done.join('、')} · 待译 ${pending.join('、')}`
})

const exportTagSummary = computed(() => {
  const done = targetTags.value.filter((t) => translatedTags.value.has(t))
  return done.length ? done.join('+') : '无'
})

const translateEta = computed(() => {
  const n = rows.value.length || 0
  if (!n) return '上传后开始'
  // ~50/batch, ~2.5s/batch incl. rate limit
  const minutes = Math.max(1, Math.ceil((n / 50) * 2.5 / 60))
  return `${n} 条预计 ${minutes}–${minutes + 2} 分钟`
})

const columns = computed<Column<XmlRow>[]>(() => {
  const cols: Column<XmlRow>[] = [{ key: 'id', dataKey: 'id', title: 'ID', width: 100, fixed: true }]
  for (const tag of languageTags.value) {
    cols.push({
      key: tag,
      dataKey: tag,
      title: tag,
      width: tag === sourceTag.value ? 260 : 280,
    })
  }
  return cols
})

watch(sourceTag, (s) => {
  if (activeTarget.value === s || !targetTags.value.includes(activeTarget.value)) {
    activeTarget.value = targetTags.value[0] || ''
  }
})

function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  error.value = ''
  if (!f) return
  const bad = validateXmlUpload(f)
  if (bad) {
    error.value = bad
    return
  }
  file.value = f
  fileName.value = f.name
  void ingest()
}

async function ingest() {
  if (!file.value) return
  busy.value = true
  error.value = ''
  progressPct.value = 0
  lastDoneTag.value = ''
  translatedTags.value = new Set()
  try {
    const res = await uploadXmlLedger(file.value)
    sessionId.value = res.sessionId
    languageTags.value = res.languageTags || []
    sourceTag.value = res.suggestedSourceTag || res.languageTags?.[0] || ''
    activeTarget.value = languageTags.value.find((t) => t !== sourceTag.value) || ''
    rows.value = entriesToRows(res.entries)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : '上传失败'
    sessionId.value = ''
    languageTags.value = []
    rows.value = []
  } finally {
    busy.value = false
  }
}

async function runTranslate() {
  if (!sessionId.value || !sourceTag.value || !activeTarget.value) return
  const target = activeTarget.value
  const source = sourceTag.value
  busy.value = true
  error.value = ''
  progressPct.value = 0
  progressLabel.value = `0/? · ${target}`
  let marked = false
  const markDone = () => {
    if (marked) return
    marked = true
    busy.value = false
    progressPct.value = 100
    lastDoneTag.value = target
    const next = new Set(translatedTags.value)
    next.add(target)
    translatedTags.value = next
  }
  try {
    await translateXmlStream(
      {
        sessionId: sessionId.value,
        sourceTag: source,
        targetTag: target,
      },
      {
        onProgress: (p) => {
          const { pct, done, total } = parseProgress(p.progress)
          progressPct.value = pct
          progressLabel.value = `${done}/${total} · ${target}`
          if (p.data?.length) {
            const patch = new Map(p.data.map((d) => [d.id, decodeXmlEntities(d.text ?? '')]))
            rows.value = rows.value.map((row) => {
              const t = patch.get(row.id)
              return t == null ? row : { ...row, [target]: t }
            })
            triggerRef(rows)
            // As soon as server stored a batch, allow export of this tag
            if (!translatedTags.value.has(target)) {
              const next = new Set(translatedTags.value)
              next.add(target)
              translatedTags.value = next
            }
          }
          if (pct >= 100) markDone()
        },
        onDone: () => markDone(),
        onError: (msg) => {
          error.value = msg
        },
      },
    )
    markDone()
    // Warn if target column still mostly equals source (model copied Chinese)
    const sample = rows.value.slice(0, 40)
    let same = 0
    let compared = 0
    for (const row of sample) {
      const s = (row[source] || '').trim()
      const t = (row[target] || '').trim()
      if (!s) continue
      compared++
      if (s === t) same++
    }
    if (compared >= 8 && same / compared >= 0.7) {
      error.value =
        `「${target}」列多数仍与「${source}」相同，可能模型未真正翻译。请重试翻译该列；导出前请确认对照表已是目标语言。`
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : '翻译失败'
  } finally {
    busy.value = false
  }
}

async function runExport() {
  if (!sessionId.value || !translatedTags.value.size) return
  error.value = ''
  try {
    const translationsByTag: Record<string, Record<string, string>> = {}
    for (const tag of translatedTags.value) {
      const map: Record<string, string> = {}
      for (const row of rows.value) {
        const t = row[tag]
        if (t) map[row.id] = t
      }
      if (Object.keys(map).length) translationsByTag[tag] = map
    }
    // Backend also merges session translations; empty FE map still exports server-side results.
    const blob = await exportTranslatedXml({
      sessionId: sessionId.value,
      filenameSuffix: 'translated',
      translationsByTag,
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(fileName.value || 'strings').replace(/\.xml$/i, '')}_translated.xml`
    a.click()
    URL.revokeObjectURL(a.href)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : '导出失败'
  }
}
</script>

<style scoped lang="scss">
.xx-cabin {
  --xx-ink: #e8f4f8;
  --xx-muted: rgba(226, 242, 248, 0.55);
  --xx-line: rgba(34, 211, 238, 0.22);
  --xx-glow: rgba(34, 211, 238, 0.14);
  display: grid;
  grid-template-columns: minmax(17.5rem, 20rem) minmax(0, 1fr);
  gap: 0.85rem;
  height: 100%;
  min-height: 0;
  padding: 0.85rem 1rem 1rem;
  color: var(--xx-ink);
  font-family: 'IBM Plex Sans SC', 'PingFang SC', sans-serif;
}

.xx-rail {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 0.75rem;
  overflow: auto;
}

.xx-block {
  border: 1px solid var(--xx-line);
  border-radius: 0.85rem;
  background:
    linear-gradient(165deg, rgba(8, 28, 36, 0.92), rgba(2, 10, 18, 0.88));
  padding: 0.9rem 0.95rem;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);

  &--grow {
    flex: 1;
  }

  &__label {
    margin-bottom: 0.65rem;
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    color: rgba(103, 232, 249, 0.72);
  }
}

.xx-upload {
  position: relative;
  display: flex;
  cursor: pointer;
  flex-direction: column;
  gap: 0.25rem;
  border: 1px dashed rgba(34, 211, 238, 0.4);
  border-radius: 0.7rem;
  background: rgba(6, 182, 212, 0.06);
  padding: 1rem 0.85rem 0.95rem 3.2rem;
  transition:
    border-color 0.2s,
    background 0.2s,
    box-shadow 0.2s;

  &:hover,
  &.is-ready {
    border-color: rgba(34, 211, 238, 0.7);
    background: rgba(6, 182, 212, 0.1);
    box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.12);
  }

  input {
    position: absolute;
    inset: 0;
    cursor: pointer;
    opacity: 0;
  }

  &__mark {
    position: absolute;
    top: 50%;
    left: 0.75rem;
    display: grid;
    height: 2rem;
    width: 2rem;
    place-items: center;
    transform: translateY(-50%);
    border: 1px solid rgba(34, 211, 238, 0.35);
    border-radius: 0.4rem;
    background: rgba(8, 47, 73, 0.65);
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    color: #a5f3fc;
  }

  &__title {
    font-size: 0.92rem;
    font-weight: 600;
    color: #ecfeff;
  }

  &__hint {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    color: rgba(165, 243, 252, 0.45);
  }
}

.xx-link {
  display: inline-block;
  margin-top: 0.55rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  color: rgba(165, 243, 252, 0.85);
  text-decoration: underline;
  text-underline-offset: 3px;

  &:hover {
    color: #ecfeff;
  }
}

.xx-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.55rem;
  min-height: 1.8rem;

  &__empty {
    font-size: 0.78rem;
    color: var(--xx-muted);
  }
}

.xx-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid rgba(34, 211, 238, 0.28);
  border-radius: 999px;
  background: rgba(8, 47, 73, 0.55);
  padding: 0.2rem 0.35rem 0.2rem 0.65rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  color: #cffafe;
  transition:
    background 0.15s,
    border-color 0.15s;

  &.is-active {
    border-color: rgba(34, 211, 238, 0.75);
    background: rgba(6, 182, 212, 0.28);
    color: #fff;
  }

  &.is-done:not(.is-active) {
    border-color: rgba(74, 222, 128, 0.45);
    color: #bbf7d0;
  }

  &__x {
    display: grid;
    height: 1.15rem;
    width: 1.15rem;
    place-items: center;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.25);
    line-height: 1;
    opacity: 0.7;

    &:hover {
      opacity: 1;
      background: rgba(244, 63, 94, 0.45);
    }
  }
}

.xx-row {
  display: flex;
  gap: 0.45rem;
}

.xx-input {
  min-width: 0;
  flex: 1;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.5rem;
  background: rgba(2, 6, 23, 0.55);
  padding: 0.5rem 0.65rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.82rem;
  color: #ecfeff;
  outline: none;

  &:focus {
    border-color: rgba(34, 211, 238, 0.55);
  }
}

.xx-flow {
  margin-bottom: 0.75rem;
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--xx-muted);
}

.xx-hint {
  margin: -0.35rem 0 0.75rem;
  font-size: 0.74rem;
  line-height: 1.45;
  color: rgba(125, 211, 252, 0.75);
}

.xx-ok {
  margin-top: 0.65rem;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #86efac;
}

.xx-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.65rem;
  font-size: 0.75rem;
  color: rgba(165, 243, 252, 0.7);
}

.xx-btn {
  border-radius: 0.55rem;
  border: 1px solid transparent;
  padding: 0.62rem 0.85rem;
  font-size: 0.86rem;
  font-weight: 600;
  transition:
    background 0.15s,
    border-color 0.15s,
    opacity 0.15s;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &--primary {
    width: 100%;
    margin-bottom: 0.45rem;
    border-color: rgba(34, 211, 238, 0.55);
    background: linear-gradient(180deg, rgba(8, 145, 178, 0.95), rgba(14, 116, 144, 0.92));
    color: #ecfeff;
    box-shadow: 0 8px 24px rgba(8, 145, 178, 0.28);

    &:hover:not(:disabled) {
      background: linear-gradient(180deg, rgba(6, 182, 212, 0.95), rgba(8, 145, 178, 0.95));
    }
  }

  &--ghost {
    border-color: rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.04);
    color: #e0f2fe;

    &:hover:not(:disabled) {
      border-color: rgba(34, 211, 238, 0.35);
      background: rgba(34, 211, 238, 0.08);
    }
  }

  &--block {
    width: 100%;
  }
}

.xx-progress {
  position: relative;
  margin-top: 0.75rem;
  height: 1.65rem;
  overflow: hidden;
  border: 1px solid rgba(34, 211, 238, 0.25);
  border-radius: 999px;
  background: rgba(2, 6, 23, 0.55);

  &__bar {
    height: 100%;
    background: linear-gradient(90deg, #0e7490, #22d3ee 70%, #a5f3fc);
    transition: width 0.25s ease;
  }

  &__label {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.9);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }
}

.xx-err {
  margin-top: 0.65rem;
  font-size: 0.82rem;
  color: #fda4af;
}

.xx-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem 0.75rem;
  margin-top: 0.7rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  color: rgba(165, 243, 252, 0.5);

  &__sid {
    opacity: 0.75;
  }
}

.xx-stage {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--xx-line);
  border-radius: 0.9rem;
  background:
    radial-gradient(80% 60% at 70% 0%, rgba(8, 145, 178, 0.12), transparent 55%),
    linear-gradient(180deg, rgba(4, 16, 24, 0.95), rgba(2, 8, 16, 0.98));
  padding: 0.85rem;
}

.xx-stage__head {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.65rem;
  margin-bottom: 0.7rem;

  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #ecfeff;
  }
}

.xx-code {
  display: block;
  margin-bottom: 0.2rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: rgba(103, 232, 249, 0.7);
}

.xx-stage__cols {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.xx-pill {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  padding: 0.15rem 0.55rem;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  color: rgba(226, 242, 248, 0.65);

  &--lang {
    border-color: rgba(34, 211, 238, 0.35);
    background: rgba(6, 182, 212, 0.12);
    color: #a5f3fc;
  }
}

.xx-table-host {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.65rem;
  background:
    linear-gradient(180deg, rgba(2, 12, 20, 0.9), rgba(0, 0, 0, 0.35));
}

.xx-empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.45rem;
  padding: 1.5rem;
  text-align: center;

  &__frame {
    display: flex;
    gap: 0.35rem;
    margin-bottom: 0.55rem;

    span {
      display: block;
      width: 0.55rem;
      height: 2.2rem;
      border-radius: 2px;
      background: linear-gradient(180deg, rgba(34, 211, 238, 0.15), rgba(34, 211, 238, 0.55));
      animation: xx-bar 1.4s ease-in-out infinite;

      &:nth-child(2) {
        height: 2.8rem;
        animation-delay: 0.15s;
      }
      &:nth-child(3) {
        height: 1.7rem;
        animation-delay: 0.3s;
      }
    }
  }

  &__title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #e0f2fe;
  }

  &__hint {
    margin: 0;
    max-width: 22rem;
    font-size: 0.8rem;
    line-height: 1.5;
    color: rgba(186, 230, 253, 0.45);
  }
}

@keyframes xx-bar {
  0%,
  100% {
    opacity: 0.35;
    transform: scaleY(0.85);
  }
  50% {
    opacity: 1;
    transform: scaleY(1);
  }
}

@media (max-width: 960px) {
  .xx-cabin {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .xx-rail {
    overflow: visible;
  }

  .xx-table-host {
    min-height: 22rem;
  }
}
</style>
