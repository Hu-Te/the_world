<template>
  <div class="recon-shell" role="presentation" @click.self="goHome">
    <div class="recon-shell__grid" aria-hidden="true" />
    <div
      class="recon-modal"
      :class="{ 'recon-modal--filled': !!detail }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recon-modal-title">
      <div class="recon-modal__glow recon-modal__glow--a" aria-hidden="true" />
      <div class="recon-modal__glow recon-modal__glow--b" aria-hidden="true" />
      <div class="recon-modal__frame" aria-hidden="true">
        <i class="c c--tl" /><i class="c c--tr" /><i class="c c--bl" /><i class="c c--br" />
      </div>

      <!-- 顶栏：始终精简 -->
      <header class="recon-modal__head">
        <div class="recon-modal__brand">
          <div class="recon-modal__eyebrow">
            <span class="recon-modal__code">FIN · RECON</span>
            <span class="recon-modal__pulse" aria-hidden="true" />
            <span class="recon-modal__badge">智能校对 · 自动</span>
            <span v-if="detail" class="recon-modal__taskid">#{{ detail.id }}</span>
          </div>
          <div class="recon-modal__title-row">
            <h1 id="recon-modal-title" class="recon-modal__title">
              {{ detail?.title || '银行存款勾稽' }}
            </h1>
            <nav v-if="!detail" class="recon-modal__samples">
              <a href="/samples/recon-corp.csv" download>样例·企业</a>
              <a href="/samples/recon-bank.csv" download>样例·银行</a>
            </nav>
          </div>
          <p class="recon-modal__trust">
            HTTPS 传输；任务密钥仅存本机；关闭本页/删除/超时后服务端物理删除明细，无全站共享列表
          </p>
        </div>
        <div class="recon-modal__head-acts">
          <button
            v-if="detail"
            type="button"
            class="recon-btn recon-btn--ghost"
            :disabled="busy"
            @click="setupOpen = !setupOpen">
            {{ setupOpen ? '收起配置' : '配置' }}
          </button>
          <button
            v-if="detail"
            type="button"
            class="recon-btn recon-btn--ghost"
            :disabled="busy"
            @click="removeCurrentTask">
            删除
          </button>
          <button type="button" class="recon-modal__close" aria-label="关闭" @click="goHome">
            ✕
          </button>
        </div>
      </header>

      <div class="recon-modal__body">
        <!-- 配置区：空态完整展示；有结果默认收起 -->
        <section
          v-show="!detail || setupOpen"
          class="recon-modal__setup"
          :class="{ 'recon-modal__setup--compact': !!detail }">
          <div class="recon-stage">
            <div class="recon-stage__ctrl">
              <label class="recon-field">
                <span>任务名称</span>
                <input
                  v-model="title"
                  type="text"
                  placeholder="如：2026-06 存款勾稽"
                  maxlength="80"
                  :disabled="busy" />
              </label>
              <div class="recon-stage__bal">
                <label class="recon-field">
                  <span>企业期末</span>
                  <input v-model.number="corpEnd" type="number" step="0.01" :disabled="busy" />
                </label>
                <label class="recon-field">
                  <span>银行期末</span>
                  <input v-model.number="bankEnd" type="number" step="0.01" :disabled="busy" />
                </label>
              </div>
              <div class="recon-stage__cta">
                <button
                  type="button"
                  class="recon-btn recon-btn--primary"
                  :disabled="busy || !corpFiles.length || !bankFiles.length"
                  @click="runPipeline">
                  <span class="recon-btn__shine" aria-hidden="true" />
                  {{ busyLabel }}
                </button>
                <p v-if="error" class="recon-modal__error">{{ error }}</p>
                <p v-else-if="hint" class="recon-modal__hint">{{ hint }}</p>
                <p v-else-if="!corpFiles.length || !bankFiles.length" class="recon-modal__hint">
                  两侧各至少上传一个文件（可多选）
                </p>
              </div>
            </div>

            <div class="recon-file-slot" :class="{ 'recon-file-slot--on': corpFiles.length }">
              <label class="recon-file" :class="{ 'recon-file--on': corpFiles.length }">
                <span class="recon-file__tag">CORP</span>
                <span class="recon-file__body">
                  <span class="recon-file__label">企业日记账</span>
                  <em>{{
                    corpFiles.length ? `已选 ${corpFiles.length} 个，继续添加` : '可多选 · CSV / Excel'
                  }}</em>
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  multiple
                  :disabled="busy"
                  @change="onCorpFiles" />
              </label>
              <ul v-if="corpFiles.length" class="recon-file-chips">
                <li v-for="(f, i) in corpFiles" :key="'c-' + f.name + '-' + f.size + '-' + i">
                  <span :title="f.name">{{ f.name }}</span>
                  <button type="button" :disabled="busy" aria-label="移除" @click="removeCorp(i)">
                    ×
                  </button>
                </li>
              </ul>
            </div>

            <div class="recon-file-slot" :class="{ 'recon-file-slot--on': bankFiles.length }">
              <label class="recon-file" :class="{ 'recon-file--on': bankFiles.length }">
                <span class="recon-file__tag">BANK</span>
                <span class="recon-file__body">
                  <span class="recon-file__label">银行对账单</span>
                  <em>{{
                    bankFiles.length ? `已选 ${bankFiles.length} 个，继续添加` : '可多选 · CSV / Excel'
                  }}</em>
                </span>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  multiple
                  :disabled="busy"
                  @change="onBankFiles" />
              </label>
              <ul v-if="bankFiles.length" class="recon-file-chips">
                <li v-for="(f, i) in bankFiles" :key="'b-' + f.name + '-' + f.size + '-' + i">
                  <span :title="f.name">{{ f.name }}</span>
                  <button type="button" :disabled="busy" aria-label="移除" @click="removeBank(i)">
                    ×
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div class="recon-tools">
            <details class="recon-map">
              <summary>
                <span>列名映射</span>
                <em>表头不同时填写</em>
              </summary>
              <div class="recon-map__grid">
                <label class="recon-field">
                  <span>日期</span>
                  <input v-model="colMap.date" type="text" placeholder="交易日期" />
                </label>
                <label class="recon-field">
                  <span>借方</span>
                  <input v-model="colMap.debit" type="text" placeholder="借方金额" />
                </label>
                <label class="recon-field">
                  <span>贷方</span>
                  <input v-model="colMap.credit" type="text" placeholder="贷方金额" />
                </label>
                <label class="recon-field">
                  <span>对方</span>
                  <input v-model="colMap.counterparty" type="text" placeholder="对方户名" />
                </label>
                <label class="recon-field">
                  <span>摘要</span>
                  <input v-model="colMap.summary" type="text" placeholder="摘要" />
                </label>
              </div>
            </details>

          </div>
        </section>

        <!-- 结果主工作区：表格占满剩余高度 -->
        <section v-if="detail" class="recon-modal__work">
          <div class="recon-modal__toolbar">
            <div class="recon-modal__filters">
              <button
                v-for="f in filters"
                :key="f.id"
                type="button"
                class="recon-chip"
                :class="{ 'recon-chip--on': filter === f.id }"
                @click="filter = f.id">
                {{ f.label }}
              </button>
              <span class="recon-modal__filter-tip">
                疑似看虚线并点「确认」；未匹配两侧各点一行即人工连线
              </span>
            </div>
            <div class="recon-modal__stats">
              <span>{{ detail.links.length }} 连线</span>
              <span>疑似 {{ fuzzyCount }}</span>
              <span>{{ detail.corpEntries.length + detail.bankEntries.length }} 行</span>
              <button
                type="button"
                class="recon-chip"
                :class="{ 'recon-chip--on': footOpen === 'balance' }"
                @click="toggleFoot('balance')">
                余额调节
              </button>
              <button
                v-if="visibleAiSuggestions.length"
                type="button"
                class="recon-chip"
                :class="{ 'recon-chip--on': footOpen === 'ai' }"
                @click="toggleFoot('ai')">
                建议 {{ visibleAiSuggestions.length }}
              </button>
            </div>
          </div>

          <div class="recon-modal__main">
            <div class="recon-modal__pane">
              <ReconDualPane
                ref="paneRef"
                :corp="detail.corpEntries"
                :bank="detail.bankEntries"
                :links="detail.links"
                :filter="filter"
                :disabled="busy"
                @link="onManualLink"
                @confirm-fuzzy="onConfirmFuzzy" />
            </div>

            <aside
              v-if="footOpen === 'balance' && detail.balanceSheet"
              class="recon-drawer">
              <header>
                <h2>余额调节</h2>
                <button type="button" class="recon-drawer__x" @click="footOpen = null">✕</button>
              </header>
              <div class="recon-aside__grid">
                <div>
                  <p>企业期末</p>
                  <strong>{{ money(detail.balanceSheet.corpEndBalance) }}</strong>
                </div>
                <div>
                  <p>银行期末</p>
                  <strong>{{ money(detail.balanceSheet.bankEndBalance) }}</strong>
                </div>
                <div>
                  <p>企业调节后</p>
                  <strong>{{ money(detail.balanceSheet.corpAdjusted) }}</strong>
                </div>
                <div>
                  <p>银行调节后</p>
                  <strong>{{ money(detail.balanceSheet.bankAdjusted) }}</strong>
                </div>
              </div>
              <ul>
                <li v-for="b in detail.balanceSheet.buckets" :key="b.key">
                  <span>{{ b.label }}</span>
                  <em>{{ money(b.amount) }}</em>
                </li>
              </ul>
            </aside>

            <aside v-else-if="footOpen === 'ai'" class="recon-drawer">
              <header>
                <h2>智能建议</h2>
                <button type="button" class="recon-drawer__x" @click="footOpen = null">✕</button>
              </header>
              <ul class="recon-aside__suggest">
                <li
                  v-for="(s, i) in visibleAiSuggestions"
                  :key="`${s.corpId}-${s.bankId}-${i}`">
                  <button type="button" :disabled="busy" @click="applyAi(s)">
                    <strong
                      >#{{ s.corpId }} ↔ #{{ s.bankId }} ·
                      {{ Math.round(s.confidence * 100) }}%</strong
                    >
                    <span>{{ s.reason }}</span>
                  </button>
                </li>
              </ul>
            </aside>
          </div>

          <p v-if="error" class="recon-modal__error recon-modal__status">{{ error }}</p>
          <p v-else-if="hint" class="recon-modal__hint recon-modal__status">{{ hint }}</p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  aiAssistRecon,
  confirmFuzzyRecon,
  createReconTask,
  deleteReconTask,
  deleteReconTaskBeacon,
  getReconTask,
  manualLinkRecon,
  runReconMatch,
  uploadReconFiles,
} from '~/utils/recon/api'
import {
  clearReconAccessToken,
  getReconAccessToken,
  saveReconAccessToken,
} from '~/utils/recon/session'
import type {
  AiSuggestion,
  ReconFilter,
  ReconId,
  ReconTaskDetail,
} from '~/utils/recon/types'
import { isFuzzyMatch, isLockedMatch, isReconId } from '~/utils/recon/types'

definePageMeta({ layout: false })

useSeoMeta({
  title: '银行存款勾稽',
  description: '企业日记账与银行对账单自动勾对',
})

const route = useRoute()
const router = useRouter()

const title = ref('')
const corpEnd = ref(0)
const bankEnd = ref(0)
const corpFiles = ref<File[]>([])
const bankFiles = ref<File[]>([])
const MAX_FILES_PER_SIDE = 20
const taskId = ref<ReconId | null>(null)
const detail = ref<ReconTaskDetail | null>(null)
const busy = ref(false)
const phase = ref('')
const error = ref('')
const hint = ref('')
const filter = ref<ReconFilter>('all')
const aiSuggestions = ref<AiSuggestion[]>([])
const setupOpen = ref(false)
const footOpen = ref<'balance' | 'ai' | null>(null)
const paneRef = ref<{ clearSelection: () => void } | null>(null)
const colMap = reactive({
  date: '',
  debit: '',
  credit: '',
  counterparty: '',
  summary: '',
})

let actionSeq = 0

const busyLabel = computed(() => {
  if (!busy.value) return '开始勾稽'
  return phase.value || '处理中…'
})

const filters: Array<{ id: ReconFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'matched', label: '已勾对' },
  { id: 'fuzzy', label: '疑似' },
  { id: 'unmatched', label: '未达' },
]

const fuzzyCount = computed(
  () => detail.value?.corpEntries.filter((e) => isFuzzyMatch(e.matchStatus)).length ?? 0,
)

const occupiedEntryIds = computed(() => {
  const set = new Set<ReconId>()
  if (!detail.value) return set
  for (const e of [...detail.value.corpEntries, ...detail.value.bankEntries]) {
    if (isLockedMatch(e.matchStatus) || isFuzzyMatch(e.matchStatus)) set.add(e.id)
  }
  return set
})

const visibleAiSuggestions = computed(() =>
  aiSuggestions.value.filter(
    (s) => !occupiedEntryIds.value.has(s.corpId) && !occupiedEntryIds.value.has(s.bankId),
  ),
)

function toggleFoot(kind: 'balance' | 'ai') {
  footOpen.value = footOpen.value === kind ? null : kind
}

function buildColumnMap(): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(colMap)) {
    const t = v.trim()
    if (t) out[k] = t
  }
  return Object.keys(out).length ? out : undefined
}

function money(n: number) {
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function goHome() {
  // 主动离开工作台：尽力物理删 + 清本机密钥（刷新同页保留密钥，靠 TTL 兜底）
  destroySessionBestEffort()
  void navigateTo('/')
}

function destroySessionBestEffort() {
  if (taskId.value == null) return
  const id = taskId.value
  deleteReconTaskBeacon(id)
  clearReconAccessToken(id)
}

function fileKey(f: File) {
  return `${f.name}::${f.size}::${f.lastModified}`
}

function mergeFiles(current: File[], incoming: FileList | null): File[] {
  if (!incoming?.length) return current
  const map = new Map(current.map((f) => [fileKey(f), f]))
  for (const f of Array.from(incoming)) {
    map.set(fileKey(f), f)
  }
  const next = Array.from(map.values())
  if (next.length > MAX_FILES_PER_SIDE) {
    error.value = `每侧最多 ${MAX_FILES_PER_SIDE} 个文件`
    return next.slice(0, MAX_FILES_PER_SIDE)
  }
  return next
}

function onCorpFiles(e: Event) {
  const input = e.target as HTMLInputElement
  corpFiles.value = mergeFiles(corpFiles.value, input.files)
  input.value = ''
}

function onBankFiles(e: Event) {
  const input = e.target as HTMLInputElement
  bankFiles.value = mergeFiles(bankFiles.value, input.files)
  input.value = ''
}

function removeCorp(index: number) {
  corpFiles.value = corpFiles.value.filter((_, i) => i !== index)
}

function removeBank(index: number) {
  bankFiles.value = bankFiles.value.filter((_, i) => i !== index)
}

function applyDetail(d: ReconTaskDetail) {
  detail.value = d
  taskId.value = d.id
  title.value = d.title || title.value
  setupOpen.value = false
  footOpen.value = null
}

async function syncTaskUrl(id: ReconId) {
  await router.replace({ query: { ...route.query, taskId: String(id) } })
}

async function runAiQuiet(id: ReconId) {
  phase.value = '智能校对中…'
  try {
    const res = await aiAssistRecon(id)
    aiSuggestions.value = res.suggestions || []
    const n = visibleAiSuggestions.value.length
    const note = res.note?.trim()
    hint.value = n
      ? `勾稽完成，智能校对给出 ${n} 条建议`
      : note
        ? `勾稽完成 · ${note}`
        : `勾稽完成 · ${detail.value?.links.length ?? 0} 组连线`
    if (n) footOpen.value = 'ai'
  } catch {
    hint.value = `勾稽完成 · ${detail.value?.links.length ?? 0} 组连线 · 智能校对暂不可用`
  }
}

async function runPipeline() {
  if (!corpFiles.value.length || !bankFiles.value.length) return
  const seq = ++actionSeq
  busy.value = true
  error.value = ''
  hint.value = ''
  aiSuggestions.value = []
  let createdId: ReconId | null = null
  try {
    phase.value = '创建任务…'
    const created = await createReconTask({
      title: title.value.trim() || '银行存款勾稽',
      corpEndBalance: Number(corpEnd.value) || 0,
      bankEndBalance: Number(bankEnd.value) || 0,
    })
    createdId = created.taskId
    saveReconAccessToken(createdId, created.accessToken)
    if (seq !== actionSeq) return

    taskId.value = createdId
    phase.value = `上传解析…（企业 ${corpFiles.value.length} · 银行 ${bankFiles.value.length}）`
    await uploadReconFiles(
      createdId,
      corpFiles.value,
      bankFiles.value,
      buildColumnMap(),
    )
    if (seq !== actionSeq) return

    phase.value = '规则勾对…'
    const matched = await runReconMatch(createdId)
    if (seq !== actionSeq) return

    applyDetail(matched)
    await syncTaskUrl(createdId)
    await runAiQuiet(createdId)
  } catch (e) {
    if (seq === actionSeq) {
      error.value = e instanceof Error ? e.message : '勾稽失败'
      if (createdId != null && detail.value?.id !== createdId) {
        try {
          await deleteReconTask(createdId)
        } catch {
          /* 清理失败不阻断 */
        }
        clearReconAccessToken(createdId)
      }
    }
  } finally {
    if (seq === actionSeq) {
      busy.value = false
      phase.value = ''
    }
  }
}

async function openTask(id: ReconId) {
  if (busy.value) return
  if (!getReconAccessToken(id)) {
    error.value = '任务密钥已失效或不属于本机会话，请重新上传勾稽'
    return
  }
  const seq = ++actionSeq
  busy.value = true
  error.value = ''
  hint.value = ''
  try {
    phase.value = '加载任务…'
    const d = await getReconTask(id)
    if (seq !== actionSeq) return
    applyDetail(d)
    aiSuggestions.value = []
    hint.value = `已加载任务 #${id}`
    await syncTaskUrl(id)
  } catch (e) {
    if (seq === actionSeq) {
      clearReconAccessToken(id)
      error.value = e instanceof Error ? e.message : '任务加载失败'
    }
  } finally {
    if (seq === actionSeq) {
      busy.value = false
      phase.value = ''
    }
  }
}

async function removeCurrentTask() {
  if (!taskId.value || busy.value) return
  const id = taskId.value
  const seq = ++actionSeq
  busy.value = true
  error.value = ''
  try {
    await deleteReconTask(id)
    if (seq !== actionSeq) return
    clearReconAccessToken(id)
    taskId.value = null
    detail.value = null
    aiSuggestions.value = []
    setupOpen.value = false
    footOpen.value = null
    hint.value = `已删除任务 #${id}`
    const q = { ...route.query }
    delete q.taskId
    await router.replace({ query: q })
  } catch (e) {
    if (seq === actionSeq) {
      error.value = e instanceof Error ? e.message : '删除失败'
    }
  } finally {
    if (seq === actionSeq) {
      busy.value = false
    }
  }
}

async function onManualLink(corpIds: ReconId[], bankIds: ReconId[]) {
  if (!taskId.value || busy.value) return
  if (corpIds.some((id) => occupiedEntryIds.value.has(id))) {
    paneRef.value?.clearSelection()
    error.value = '所选流水已勾对，请先确认疑似或改选未匹配行'
    return
  }
  if (bankIds.some((id) => occupiedEntryIds.value.has(id))) {
    paneRef.value?.clearSelection()
    error.value = '所选流水已勾对，请先确认疑似或改选未匹配行'
    return
  }
  const seq = ++actionSeq
  busy.value = true
  error.value = ''
  try {
    const next = await manualLinkRecon(taskId.value, corpIds, bankIds)
    if (seq !== actionSeq) return
    applyDetail(next)
    setupOpen.value = false
    hint.value = '已人工勾对'
    paneRef.value?.clearSelection()
  } catch (e) {
    if (seq === actionSeq) {
      error.value = e instanceof Error ? e.message : '人工勾对失败'
      paneRef.value?.clearSelection()
    }
  } finally {
    if (seq === actionSeq) busy.value = false
  }
}

async function onConfirmFuzzy(groupId: ReconId) {
  if (!taskId.value || busy.value) return
  const seq = ++actionSeq
  busy.value = true
  error.value = ''
  try {
    const next = await confirmFuzzyRecon(taskId.value, groupId)
    if (seq !== actionSeq) return
    applyDetail(next)
    setupOpen.value = false
    hint.value = `已确认疑似组 #${groupId}`
  } catch (e) {
    if (seq === actionSeq) {
      error.value = e instanceof Error ? e.message : '确认失败'
    }
  } finally {
    if (seq === actionSeq) busy.value = false
  }
}

async function applyAi(s: AiSuggestion) {
  if (!taskId.value || busy.value) return
  if (
    occupiedEntryIds.value.has(s.corpId) ||
    occupiedEntryIds.value.has(s.bankId)
  ) {
    return
  }
  await onManualLink([s.corpId], [s.bankId])
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') goHome()
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  document.documentElement.style.overflow = 'hidden'

  const q = route.query.taskId
  if (typeof q === 'string' && q.trim()) {
    const id = q.trim()
    if (!isReconId(id)) {
      error.value = '链接中的 taskId 无效'
      return
    }
    await openTask(id)
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})
</script>

<style scoped lang="scss">
$glow-soft: 0 0 10px rgba(110, 200, 232, 0.35), 0 0 2px rgba(180, 230, 250, 0.4);
$glow-strong: 0 0 14px rgba(110, 200, 232, 0.55), 0 0 4px rgba(190, 235, 255, 0.6);
$glow-title: 0 0 18px rgba(110, 200, 232, 0.45), 0 0 6px rgba(220, 245, 255, 0.5);

.recon-shell {
  @apply fixed inset-0 z-[60] flex items-center justify-center;
  padding:
    max(0.5rem, env(safe-area-inset-top))
    max(0.5rem, env(safe-area-inset-right))
    max(0.5rem, env(safe-area-inset-bottom))
    max(0.5rem, env(safe-area-inset-left));
  background:
    radial-gradient(ellipse 65% 45% at 50% -8%, rgba(110, 200, 232, 0.14), transparent 55%),
    rgba(2, 6, 12, 0.84);
  backdrop-filter: blur(18px) saturate(1.2);
  -webkit-backdrop-filter: blur(18px) saturate(1.2);
  animation: recon-fade 0.28s ease-out both;

  @media (min-width: 640px) {
    padding: max(1rem, env(safe-area-inset-top)) max(1.25rem, env(safe-area-inset-right))
      max(1rem, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
  }

  &__grid {
    @apply pointer-events-none absolute inset-0 opacity-[0.055];
    background-image:
      linear-gradient(rgba(110, 200, 232, 0.4) 1px, transparent 1px),
      linear-gradient(90deg, rgba(110, 200, 232, 0.4) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(ellipse 65% 55% at 50% 42%, #000 15%, transparent 72%);
  }
}

.recon-modal {
  @apply relative flex w-full flex-col overflow-hidden;
  width: min(68rem, 100%);
  height: auto;
  max-height: min(94dvh, 100%);
  border: 1px solid rgba(110, 200, 232, 0.35);
  border-radius: clamp(0.65rem, 1.6vw, 1.05rem);
  background: linear-gradient(
    168deg,
    rgba(14, 24, 36, 0.98) 0%,
    rgba(7, 12, 20, 0.99) 55%,
    rgba(4, 9, 14, 0.995) 100%
  );
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.035) inset,
    0 28px 80px rgba(0, 0, 0, 0.6),
    0 0 72px rgba(110, 200, 232, 0.14);
  animation: recon-up 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;

  &--filled {
    width: min(96rem, 100%);
    height: min(96dvh, 100%);
    max-height: min(96dvh, 100%);
  }

  &__glow {
    @apply pointer-events-none absolute rounded-full;
    filter: blur(12px);

    &--a {
      @apply -left-16 -top-20 h-52 w-52;
      background: radial-gradient(circle, rgba(110, 200, 232, 0.3), transparent 70%);
    }
    &--b {
      @apply -bottom-24 -right-14 h-56 w-56;
      background: radial-gradient(circle, rgba(60, 130, 170, 0.18), transparent 70%);
    }

    @media (max-width: 639px) {
      &--a,
      &--b {
        @apply h-32 w-32 opacity-60;
      }
    }
  }

  &__frame {
    @apply pointer-events-none absolute inset-0 z-[2];
    .c {
      @apply absolute h-3 w-3 sm:h-3.5 sm:w-3.5;
      border-color: rgba(110, 200, 232, 0.55);
      border-style: solid;
      &--tl { @apply left-2 top-2 border-l border-t sm:left-2.5 sm:top-2.5; }
      &--tr { @apply right-2 top-2 border-r border-t sm:right-2.5 sm:top-2.5; }
      &--bl { @apply bottom-2 left-2 border-b border-l sm:bottom-2.5 sm:left-2.5; }
      &--br { @apply bottom-2 right-2 border-b border-r sm:bottom-2.5 sm:right-2.5; }
    }
  }

  &__head {
    @apply relative z-[3] flex shrink-0 items-start justify-between gap-2 sm:items-center sm:gap-3;
    padding: clamp(0.75rem, 2vw, 1.25rem) clamp(0.75rem, 2.5vw, 2rem);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__brand {
    @apply min-w-0 flex-1;
  }

  &__eyebrow {
    @apply flex flex-wrap items-center gap-2 sm:gap-2.5;
  }

  &__code {
    @apply font-mono tracking-[0.28em] text-cyan-soft;
    font-size: clamp(0.65rem, 1.6vw, 0.75rem);
    text-shadow: $glow-soft;
  }

  &__pulse {
    @apply h-2 w-2 rounded-full bg-cyan-soft;
    box-shadow: 0 0 10px rgba(110, 200, 232, 0.95);
    animation: recon-pulse 1.8s ease-in-out infinite;
  }

  &__badge {
    @apply rounded border border-cyan-soft/30 bg-cyan-soft/15 px-2 py-0.5;
    @apply font-mono tracking-[0.12em] text-cyan-soft;
    font-size: clamp(0.62rem, 1.5vw, 0.7rem);
    text-shadow: $glow-soft;
  }

  &__taskid {
    @apply font-mono tracking-wider text-slate-300;
    font-size: clamp(0.65rem, 1.6vw, 0.75rem);
    text-shadow: $glow-soft;
  }

  &__title-row {
    @apply mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:mt-2;
  }

  &__trust {
    @apply mt-1.5 max-w-2xl font-mono leading-snug tracking-wide text-slate-300 sm:mt-2;
    font-size: clamp(0.7rem, 1.9vw, 0.875rem);
    text-shadow: $glow-soft;
  }

  &__title {
    @apply font-display font-semibold tracking-tight text-white;
    font-size: clamp(1.15rem, 3.4vw, 1.875rem);
    text-shadow: $glow-title;
    word-break: break-word;
  }

  &__samples {
    @apply flex flex-wrap gap-2 font-mono tracking-wide text-cyan-soft sm:gap-2.5;
    font-size: clamp(0.72rem, 1.9vw, 0.875rem);
    text-shadow: $glow-soft;

    a {
      @apply underline-offset-2 transition hover:underline;
    }
  }

  &__head-acts {
    @apply flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2;
  }

  &__close {
    @apply rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 sm:px-3;
    @apply font-mono text-slate-200 transition;
    @apply hover:border-cyan-soft/40 hover:text-cyan-soft;
    font-size: clamp(0.85rem, 2vw, 1rem);
    text-shadow: $glow-soft;
  }

  &__body {
    @apply relative z-[1] flex min-h-0 flex-1 flex-col gap-0 overflow-hidden;
  }

  &__setup {
    @apply shrink-0;
    padding: clamp(0.75rem, 2.2vw, 1.5rem) clamp(0.75rem, 2.5vw, 2rem);
    gap: clamp(0.75rem, 2vw, 1rem);
    display: flex;
    flex-direction: column;
  }

  &__setup--compact {
    @apply overflow-y-auto border-b border-white/10;
    max-height: min(42dvh, 22rem);
  }

  &__work {
    @apply flex min-h-0 flex-1 flex-col overflow-hidden;
  }

  &__toolbar {
    @apply flex shrink-0 flex-wrap items-center justify-between gap-2;
    padding: 0.6rem clamp(0.75rem, 2.5vw, 2rem);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  &__filters,
  &__stats {
    @apply flex flex-wrap items-center gap-1.5 sm:gap-2;
  }

  &__stats span {
    @apply font-mono tracking-wider text-slate-300;
    font-size: clamp(0.65rem, 1.6vw, 0.75rem);
    text-shadow: $glow-soft;
  }

  &__main {
    @apply relative flex min-h-0 flex-1 overflow-hidden;
    flex-direction: column;

    @media (min-width: 900px) {
      flex-direction: row;
    }
  }

  &__pane {
    @apply flex min-h-0 min-w-0 flex-1 flex-col px-2 pb-2 pt-2 sm:px-4;
  }

  &__status {
    @apply shrink-0;
    padding: 0.5rem clamp(0.75rem, 2.5vw, 2rem);
  }

  &__error {
    @apply text-red-200;
    font-size: clamp(0.75rem, 2vw, 0.875rem);
    text-shadow: 0 0 10px rgba(251, 113, 133, 0.4);
  }

  &__hint {
    @apply text-slate-300;
    font-size: clamp(0.75rem, 2vw, 0.875rem);
    text-shadow: $glow-soft;
  }
}

/* —— 空态指挥台：控制台 | 企业 | 银行 —— */
.recon-stage {
  @apply grid gap-3 sm:gap-4;
  grid-template-columns: 1fr;
  align-items: stretch;

  @media (min-width: 768px) and (max-width: 1099px) {
    grid-template-columns: 1fr 1fr;

    &__ctrl {
      grid-column: 1 / -1;
    }
  }

  @media (min-width: 1100px) {
    grid-template-columns: minmax(14rem, 0.9fr) minmax(0, 1fr) minmax(0, 1fr);
  }

  &__ctrl {
    @apply flex flex-col gap-3 rounded-lg border border-white/10 p-3 sm:gap-3.5 sm:p-4;
    background: linear-gradient(160deg, rgba(110, 200, 232, 0.07), rgba(0, 0, 0, 0.28));
  }

  &__bal {
    @apply grid grid-cols-2 gap-2 sm:gap-3;
  }

  &__cta {
    @apply mt-auto flex flex-col gap-2 pt-1;
  }
}

.recon-tools {
  @apply flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5;
}

.recon-file-slot {
  @apply flex min-h-0 min-w-0 flex-col gap-2;

  &--on {
    .recon-file {
      border-style: solid;
      border-color: rgba(110, 200, 232, 0.45);
    }
  }
}

.recon-file {
  @apply relative flex cursor-pointer flex-col overflow-hidden;
  @apply rounded-lg border border-dashed border-white/20 px-4 py-4 transition duration-300 sm:px-5 sm:py-5;
  min-height: clamp(7.5rem, 22vw, 13rem);
  background:
    linear-gradient(155deg, rgba(110, 200, 232, 0.07), transparent 60%),
    rgba(0, 0, 0, 0.3);

  &:hover {
    border-color: rgba(110, 200, 232, 0.48);
    background:
      linear-gradient(155deg, rgba(110, 200, 232, 0.12), transparent 60%),
      rgba(0, 0, 0, 0.3);
  }

  &--on {
    border-style: solid;
    border-color: rgba(110, 200, 232, 0.45);
  }

  &__tag {
    @apply absolute left-3 top-3 font-mono tracking-[0.24em] text-cyan-soft/80 sm:left-4 sm:top-3.5;
    font-size: clamp(0.65rem, 1.6vw, 0.75rem);
    text-shadow: $glow-soft;
  }

  &__body {
    @apply m-auto flex flex-col items-center justify-center gap-1.5 px-2 text-center sm:gap-2;
  }

  &__label {
    @apply font-medium tracking-wide text-slate-50;
    font-size: clamp(0.95rem, 2.8vw, 1.125rem);
    white-space: nowrap;
    text-shadow: $glow-strong;
  }

  em {
    @apply font-mono not-italic leading-snug text-slate-300;
    font-size: clamp(0.72rem, 1.9vw, 0.875rem);
    white-space: normal;
    text-align: center;
    text-shadow: $glow-soft;
  }

  input {
    @apply absolute inset-0 z-[1] cursor-pointer opacity-0 disabled:cursor-not-allowed;
  }
}

.recon-file-chips {
  @apply flex max-h-[5rem] flex-wrap content-start gap-1.5 overflow-y-auto;

  li {
    @apply flex max-w-full items-center gap-1 rounded border border-white/10 bg-black/40 py-1 pl-2 pr-1;
    @apply font-mono text-slate-200;
    font-size: clamp(0.65rem, 1.6vw, 0.75rem);
    text-shadow: $glow-soft;
  }

  span {
    @apply min-w-0 truncate;
    max-width: min(12rem, 42vw);
  }

  button {
    @apply relative z-[2] rounded px-1 text-slate-400 transition hover:bg-white/10 hover:text-cyan-soft;
    @apply disabled:opacity-40;
  }
}

.recon-field {
  @apply flex min-w-0 flex-col gap-1.5 tracking-[0.1em] text-cyan-soft/85;
  font-size: clamp(0.68rem, 1.7vw, 0.75rem);
  text-shadow: $glow-soft;

  input {
    @apply w-full min-w-0 rounded-md border border-white/10 bg-black/40 px-2.5 py-2 text-slate-50 outline-none sm:px-3 sm:py-2.5;
    @apply transition focus:border-cyan-soft/40 disabled:opacity-50;
    font-size: clamp(0.875rem, 2.2vw, 1rem);
    text-shadow: $glow-soft;
  }

  input::placeholder {
    @apply text-slate-400;
  }
}

.recon-map {
  @apply min-w-0 flex-1 overflow-hidden rounded-md border border-white/10 bg-black/20;

  summary {
    @apply flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 sm:px-3.5;
    @apply font-mono tracking-[0.12em] text-slate-200;
    @apply hover:text-cyan-soft;
    font-size: clamp(0.7rem, 1.8vw, 0.75rem);
    text-shadow: $glow-soft;

    em {
      @apply font-sans not-italic tracking-normal text-slate-400;
      font-size: clamp(0.65rem, 1.6vw, 0.75rem);
    }
  }

  &__grid {
    @apply grid gap-2 border-t border-white/10 px-3 py-2.5 sm:gap-2.5 sm:px-3.5 sm:py-3;
    grid-template-columns: repeat(2, minmax(0, 1fr));

    @media (min-width: 640px) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    @media (min-width: 1100px) {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }
}

.recon-btn {
  @apply relative overflow-hidden rounded-md border border-white/10 px-3 py-2 sm:px-3.5;
  @apply font-mono tracking-[0.12em] text-slate-200 transition;
  @apply hover:border-cyan-soft/40 hover:text-cyan-soft disabled:cursor-not-allowed disabled:opacity-40;
  font-size: clamp(0.72rem, 1.9vw, 0.875rem);
  text-shadow: $glow-soft;

  &--primary {
    @apply w-full font-medium tracking-[0.14em] text-cyan-soft;
    padding-block: clamp(0.65rem, 1.8vw, 0.75rem);
    font-size: clamp(0.875rem, 2.3vw, 1rem);
    border-color: rgba(110, 200, 232, 0.55);
    background: linear-gradient(
      90deg,
      rgba(110, 200, 232, 0.32),
      rgba(110, 200, 232, 0.16),
      rgba(110, 200, 232, 0.06)
    );
    box-shadow: 0 0 28px rgba(110, 200, 232, 0.22);
    text-shadow: $glow-strong;

    &:not(:disabled):hover {
      @apply text-white;
      border-color: rgba(110, 200, 232, 0.75);
      box-shadow: 0 0 36px rgba(110, 200, 232, 0.32);
    }
  }

  &--ghost {
    @apply border-transparent px-2 py-1.5 text-slate-300 hover:bg-white/5 hover:text-cyan-soft sm:px-2.5;
  }

  &__shine {
    @apply pointer-events-none absolute inset-y-0 -left-1/3 w-1/3;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    animation: recon-shine 3.2s ease-in-out infinite;
  }
}

.recon-modal__filter-tip {
  @apply ml-0 max-w-full font-mono leading-snug tracking-wide text-slate-400 sm:ml-1 sm:max-w-[18rem];
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
  text-shadow: $glow-soft;
}

.recon-chip {
  @apply rounded border border-white/10 px-2 py-0.5 sm:px-2.5 sm:py-1;
  @apply font-mono tracking-wider text-slate-300 transition;
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
  text-shadow: $glow-soft;
  &--on {
    @apply border-cyan-soft/40 bg-cyan-soft/10 text-cyan-soft;
    text-shadow: $glow-strong;
  }
}

.recon-drawer {
  @apply absolute inset-y-0 right-0 z-10 flex flex-col overflow-hidden;
  @apply border-l border-cyan-soft/20;
  width: min(22rem, 92%);
  background: linear-gradient(180deg, rgba(8, 16, 26, 0.97), rgba(4, 8, 14, 0.98));
  box-shadow: -16px 0 40px rgba(0, 0, 0, 0.35);
  animation: recon-drawer 0.22s ease-out both;

  header {
    @apply flex items-center justify-between border-b border-white/10 px-3 py-2.5 sm:px-4 sm:py-3;
  }

  h2 {
    @apply font-mono tracking-[0.14em] text-slate-200;
    font-size: clamp(0.75rem, 2vw, 0.875rem);
    text-shadow: $glow-soft;
  }

  &__x {
    @apply font-mono text-sm text-slate-300 hover:text-cyan-soft;
  }

  .recon-aside__grid,
  ul {
    @apply overflow-y-auto px-3 py-3 sm:px-4 sm:py-3.5;
  }
}

.recon-aside__grid {
  @apply mb-2.5 grid grid-cols-2 gap-2.5;

  p {
    @apply text-xs text-slate-300;
    text-shadow: $glow-soft;
  }
  strong {
    @apply font-mono text-base text-slate-50;
    text-shadow: $glow-strong;
  }
}

.recon-drawer ul {
  @apply space-y-2;

  li {
    @apply flex items-center justify-between gap-2 text-sm text-slate-200;
    em {
      @apply font-mono not-italic text-cyan-soft;
      text-shadow: $glow-soft;
    }
  }
}

.recon-aside__suggest {
  @apply space-y-2;

  button {
    @apply w-full rounded-md border border-white/10 px-3 py-2.5 text-left transition;
    @apply hover:border-cyan-soft/40 hover:bg-cyan-soft/5 disabled:opacity-40;

    strong {
      @apply block font-mono text-sm text-slate-50;
      text-shadow: $glow-soft;
    }
    span {
      @apply mt-1 block text-xs text-slate-400;
    }
  }
}

.recon-modal--filled :deep(.recon-pane) {
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
}

@keyframes recon-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes recon-up {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes recon-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.12); }
}

@keyframes recon-shine {
  0%, 55% { transform: translateX(0); opacity: 0; }
  70% { opacity: 1; }
  100% { transform: translateX(320%); opacity: 0; }
}

@keyframes recon-drawer {
  from { transform: translateX(12px); opacity: 0; }
  to { transform: none; opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .recon-shell,
  .recon-modal,
  .recon-modal__pulse,
  .recon-btn__shine,
  .recon-drawer {
    animation: none;
  }
}
</style>
