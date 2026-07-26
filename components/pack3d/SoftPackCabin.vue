<template>
  <div class="sp">
    <aside class="sp-rail">
      <section class="sp-panel">
        <h2 class="sp-panel__title">图纸</h2>
        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
          class="sp-file"
          @change="onFile" />
        <div class="sp-actions">
          <button type="button" class="sp-btn" :disabled="busy" @click="pickFile">选择</button>
          <button
            type="button"
            class="sp-btn sp-btn--accent"
            :disabled="busy || !file"
            @click="onAnalyze">
            分析
          </button>
          <button type="button" class="sp-btn sp-btn--ghost" :disabled="busy" @click="onDemo">
            {{ busy ? '分析中…' : '演示' }}
          </button>
        </div>
        <p class="sp-meta">
          <span :class="['sp-dot', `sp-dot--${wsStatus}`]" />
          WS {{ wsStatus }}
          <template v-if="taskId">· {{ taskId }}</template>
        </p>
        <p v-if="statusMsg" class="sp-status">{{ statusMsg }}</p>
        <p v-if="hint" class="sp-tip">{{ hint }}</p>
        <p v-if="busy && elapsedSec > 0" class="sp-tip">已等待 {{ elapsedSec }}s</p>
        <p v-if="error" class="sp-error">{{ error }}</p>
        <details v-if="spatialPreview" class="sp-spatial-wrap">
          <summary>聚类预览</summary>
          <pre class="sp-spatial">{{ spatialPreview }}</pre>
        </details>
      </section>

      <section class="sp-panel sp-panel--dims">
        <h2 class="sp-panel__title">验算尺寸 1:1</h2>
        <div v-if="dims" class="sp-dims">
          <div>
            <span>袋型</span>
            <strong>{{ productLabel }}</strong>
          </div>
          <div>
            <span>总宽</span>
            <strong>{{ dims.totalWidth }}</strong>
          </div>
          <div>
            <span>封边</span>
            <strong>{{ dims.sealWidth }}</strong>
          </div>
          <div>
            <span>侧面</span>
            <strong>{{ dims.sideWidth }}</strong>
          </div>
          <div>
            <span>正面宽</span>
            <strong>{{ dims.mainFaceWidth }}</strong>
          </div>
          <div>
            <span>背封</span>
            <strong>{{ dims.backSealWidth }}</strong>
          </div>
          <div>
            <span>正面高</span>
            <strong>{{ faceHeight }}</strong>
          </div>
          <div>
            <span>半厚</span>
            <strong>{{ dims.maxHalfDepth?.toFixed?.(1) ?? '—' }}</strong>
          </div>
          <div>
            <span>成型外宽</span>
            <strong :title="'= 正面宽 + 2×封边'">{{ formedWidthLabel }}</strong>
          </div>
          <p class="sp-dims__why">
            3D 按刀模 1:1：正{{ dims.mainFaceWidth }}×{{ faceHeight }}×{{ fullDepthLabel }} · 外宽{{
              formedWidthLabel
            }}（≠正面宽）
          </p>
          <div class="sp-dims__check">
            <span>闭环</span>
            <strong :class="loopOk ? 'ok' : 'bad'">
              {{ loopOk ? '通过' : '冲突' }}
              <em>{{ loopSum }}</em>
            </strong>
          </div>
          <p v-if="dims.filmLayout" class="sp-dims__why">
            全膜 {{ dims.filmLayout.filmWidth }}×{{ dims.filmLayout.filmHeight }} · 横
            {{ dims.filmLayout.horizontalMm.join('|') }} · 竖
            {{ dims.filmLayout.verticalMm.join('|') }}
          </p>
          <p v-if="dims.rationale" class="sp-dims__why">{{ dims.rationale }}</p>
        </div>
        <p v-else-if="busy" class="sp-muted">分析中…</p>
        <p v-else class="sp-muted">上传图纸后点「分析」</p>
      </section>

      <section v-if="showCropper" class="sp-panel sp-panel--crop">
        <SoftPackCropper
          v-model="cropRect"
          v-model:back-crop="cropBack"
          v-model:orient="texOrient"
          v-model:tex-mode="texMode"
          :image-url="previewUrl!"
          :aspect="cropAspect"
          :total-width="dims.mainFaceWidth"
          :strip-width="dims.totalWidth"
          :face-height="dims.height ?? 90"
          :horiz="dims.filmLayout?.horizontalMm"
          :vert="dims.filmLayout?.verticalMm"
          :roles="dims.filmLayout?.verticalRoles"
          @confirm="onCropConfirm"
        />
      </section>
    </aside>

    <section class="sp-stage">
      <div class="sp-stage__head">
        <h2 class="sp-panel__title">程序化 3D</h2>
        <span v-if="dims" class="sp-stage__tag">{{ productLabel }} · 无 glTF</span>
      </div>
      <div class="sp-stage__body">
        <SoftPackViewport
          v-if="dims"
          :key="meshKey"
          :dims="dims"
          :image-url="textureImageUrl"
          :crop-rect="cropRect"
          :crop-back="cropBack"
          :tex-orient="texOrient"
          :tex-mode="texMode" />
        <div v-else class="sp-view-ph">
          <p class="sp-muted">{{ busy ? '生成中…' : '3D 视口' }}</p>
          <p class="sp-view-ph__hint">尺寸到位后按袋型动态建网</p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { fetchTaskStatus, packageWsUrl, submitAnalyze, type SoftPackDims } from '~/utils/pack3d/api'
import { normalizeSoftPackDims } from '~/utils/pack3d/softPackMesh'
import { RobustWebSocket, type WsStatus } from '~/utils/fieldpulse/RobustWebSocket'
import {
  autoCropAllPanels,
  defaultBackPanelCrop,
  type SoftPackCropRect,
} from '~/utils/pack3d/softPackCrop'
import {
  DEFAULT_TEX_ORIENT,
  type SoftPackTexMode,
  type SoftPackTexOrient,
} from '~/utils/pack3d/softPackTexture'

const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
const busy = ref(false)
const error = ref('')
const statusMsg = ref('')
const hint = ref('')
const spatialPreview = ref('')
const taskId = ref('')
const dims = ref<SoftPackDims | null>(null)
const wsStatus = ref<WsStatus>('closed')
const elapsedSec = ref(0)
/** 用户确认的原图像素裁剪框；未确认前不贴图 */
const cropRect = ref<SoftPackCropRect | null>(null)
const cropBack = ref<SoftPackCropRect | null>(null)
const cropConfirmed = ref(false)
const isDemoFile = ref(false)
const texOrient = ref<SoftPackTexOrient>({ ...DEFAULT_TEX_ORIENT })
/** 默认仅正面：贴 95×90 面板，避免全膜把背面字贴到正面 */
const texMode = ref<SoftPackTexMode>('panels')

const faceHeight = computed(() => {
  const d = dims.value
  if (!d) return 90
  return d.height ?? 90
})
/** 成型外宽 = 正面 + 两封边（侧栏折进厚度，不进正视宽） */
const formedWidthLabel = computed(() => {
  const d = dims.value
  if (!d) return '—'
  const w = d.mainFaceWidth + d.sealWidth * 2
  return `${Math.round(w * 10) / 10}`
})
const fullDepthLabel = computed(() => {
  const d = dims.value
  if (!d) return '—'
  if (d.maxHalfDepth && d.maxHalfDepth > 0) return `${Math.round(d.maxHalfDepth * 2 * 10) / 10}`
  const g = d.filmLayout?.verticalMm?.find((_, i) => {
    const r = String(d.filmLayout?.verticalRoles?.[i] || '').toUpperCase()
    return r === 'GUSSET' || r === 'SIDE'
  })
  return g != null ? `${Math.round(g * 10) / 10}` : '—'
})
const productLabel = computed(() => {
  const t = String(dims.value?.productType || '').toUpperCase()
  if (t === 'STAND_UP_POUCH') return '自立袋'
  if (t === 'THREE_SIDE_SEAL') return '三边封'
  if (t === 'PILLOW_POUCH') return '卫生巾外袋'
  return t || '软包装'
})
const cropAspect = computed(() => {
  const d = dims.value
  if (!d) return texMode.value === 'fullWrap' || texMode.value === 'autoFilm' ? 177 / 264 : 95 / 90
  const h = Math.max(1e-6, d.height ?? 90)
  if (texMode.value === 'autoFilm') {
    const fh =
      d.filmLayout?.filmHeight ||
      d.filmLayout?.verticalMm?.reduce((a, b) => a + b, 0) ||
      h * 2 + 84
    const fw = d.filmLayout?.filmWidth || d.totalWidth || 177
    return fw / Math.max(1e-6, fh)
  }
  if (texMode.value === 'fullWrap') {
    return d.totalWidth / h
  }
  // 仅正面：严格 正栏宽/正栏高（如 95/90）
  return d.mainFaceWidth / h
})
const showCropper = computed(
  () => !!previewUrl.value && !!dims.value && !isDemoFile.value && !busy.value,
)
/** 真实图纸：有预览即贴图；演示 1×1 PNG 跳过 */
const textureImageUrl = computed(() =>
  !isDemoFile.value && previewUrl.value ? previewUrl.value : null,
)

let client: RobustWebSocket | null = null
let elapsedTimer: ReturnType<typeof setInterval> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let settledTaskId = ''
const DEMO_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

function startElapsed() {
  elapsedSec.value = 0
  if (elapsedTimer) clearInterval(elapsedTimer)
  elapsedTimer = setInterval(() => {
    elapsedSec.value += 1
    if (elapsedSec.value === 12 && busy.value) {
      hint.value = '大模型 较慢；可再点「演示」走本地启发式'
    }
  }, 1000)
}

function stopElapsed() {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const loopSum = computed(() => {
  const d = dims.value
  if (!d) return '—'
  return (d.sealWidth * 2 + d.sideWidth * 2 + d.mainFaceWidth + d.backSealWidth).toFixed(2)
})

const loopOk = computed(() => {
  const d = dims.value
  if (!d) return false
  return Math.abs(Number(loopSum.value) - d.totalWidth) <= 0.51
})

const meshKey = computed(() => {
  const d = dims.value
  if (!d) return 'empty'
  return [
    'product-pack-v17',
    d.productType || 'PILLOW',
    d.totalWidth,
    d.sealWidth,
    d.sideWidth,
    d.mainFaceWidth,
    d.backSealWidth,
    d.height ?? 90,
    d.maxHalfDepth ?? 0,
    d.bellyPower ?? 0,
    taskId.value,
  ].join('-')
})

function pickFile() {
  fileInput.value?.click()
}

function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  setFile(f)
}

function setFile(f: File, opts?: { clearResult?: boolean; demo?: boolean }) {
  const clearResult = opts?.clearResult !== false
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = f
  previewUrl.value = URL.createObjectURL(f)
  isDemoFile.value = !!opts?.demo
  cropRect.value = null
  cropBack.value = null
  cropConfirmed.value = false
  texOrient.value = { ...DEFAULT_TEX_ORIENT }
  texMode.value = 'panels'
  if (clearResult) {
    dims.value = null
    error.value = ''
    spatialPreview.value = ''
    settledTaskId = ''
  }
  statusMsg.value = `已选 ${f.name}`
}

function onCropConfirm(rect: SoftPackCropRect, which: 'full' | 'front' | 'back' | 'auto' = 'full') {
  if (which === 'back') {
    cropBack.value = { ...rect }
    statusMsg.value = `背面已确认 ${Math.round(rect.cropWidth)}×${Math.round(rect.cropHeight)}px`
    hint.value = '背面已贴上；可旋转模型查看'
  } else if (which === 'auto') {
    cropRect.value = { ...rect }
    texMode.value = 'autoFilm'
    // 同步自动背面框（供微调）
    if (dims.value && previewUrl.value) {
      const img = new Image()
      img.onload = () => {
        const d = dims.value!
        const fl = d.filmLayout
        const panels = autoCropAllPanels(
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          fl?.horizontalMm,
          fl?.verticalMm,
          fl?.verticalRoles,
        )
        cropBack.value = panels.back
      }
      img.src = previewUrl.value
    }
    statusMsg.value = `自动多面 ${Math.round(rect.cropWidth)}×${Math.round(rect.cropHeight)}px`
    hint.value =
      '尺寸已按刀模校正（正栏 95×90）。请再点「自动多面」或「仅正面→确认对齐」'
  } else {
    cropRect.value = { ...rect }
    if (which === 'full') {
      texMode.value = 'fullWrap'
      statusMsg.value = `全膜已确认 ${Math.round(rect.cropWidth)}×${Math.round(rect.cropHeight)}px`
      hint.value = '全膜需框准 FRONT 横条；日常预览建议用「自动多面」'
    } else {
      texMode.value = 'panels'
      statusMsg.value = `已贴选区 ${Math.round(rect.cropWidth)}×${Math.round(rect.cropHeight)}px`
      if (!cropBack.value && dims.value && previewUrl.value) {
        const img = new Image()
        img.onload = () => {
          const d = dims.value!
          const fl = d.filmLayout
          cropBack.value = defaultBackPanelCrop(
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
            fl?.horizontalMm,
            fl?.verticalMm,
            fl?.verticalRoles,
          )
        }
        img.src = previewUrl.value
      }
      hint.value = '3D 正面已按当前选框贴图（框哪贴哪）'
    }
  }
  cropConfirmed.value = !!cropRect.value
}

async function pullTaskStatus(id: string) {
  if (!id) return
  try {
    const st = await fetchTaskStatus(id)
    if (st.status === 'DONE' && st.dims) {
      applyResult({ taskId: st.taskId, dims: st.dims, spatialDocument: st.spatialDocument }, 'rest')
    } else if (st.status === 'FAILED') {
      applyError({ taskId: st.taskId, message: st.message || '分析失败' })
    }
  } catch {
    /* ignore */
  }
}

function parseDims(raw: unknown): SoftPackDims | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const num = (k: string) => {
    const v = o[k]
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
    return Number.isFinite(n) ? n : NaN
  }
  const totalWidth = num('totalWidth')
  const sealWidth = num('sealWidth')
  const sideWidth = num('sideWidth')
  const mainFaceWidth = num('mainFaceWidth')
  const backSealWidth = num('backSealWidth')
  if (
    [totalWidth, sealWidth, sideWidth, mainFaceWidth, backSealWidth].some((n) => Number.isNaN(n))
  ) {
    return null
  }
  const height = num('height')
  const maxHalfDepth = num('maxHalfDepth')
  const sealFlattenMm = num('sealFlattenMm')
  const bellyPower = num('bellyPower')
  const productType =
    typeof o.productType === 'string' && o.productType.trim()
      ? o.productType.trim()
      : 'PILLOW_POUCH'
  const rationale = typeof o.rationale === 'string' ? o.rationale : undefined
  let depthProfile: SoftPackDims['depthProfile']
  if (Array.isArray(o.depthProfile)) {
    depthProfile = o.depthProfile
      .map((p) => {
        if (!p || typeof p !== 'object') return null
        const pt = p as Record<string, unknown>
        const yNorm =
          typeof pt.yNorm === 'number' ? pt.yNorm : typeof pt.y_norm === 'number' ? pt.y_norm : NaN
        const halfDepthScale =
          typeof pt.halfDepthScale === 'number'
            ? pt.halfDepthScale
            : typeof pt.half_depth_scale === 'number'
              ? pt.half_depth_scale
              : NaN
        if (!Number.isFinite(yNorm) || !Number.isFinite(halfDepthScale)) return null
        return { yNorm, halfDepthScale }
      })
      .filter((x): x is { yNorm: number; halfDepthScale: number } => !!x)
  }
  return normalizeSoftPackDims({
    productType,
    totalWidth,
    sealWidth,
    sideWidth,
    mainFaceWidth,
    backSealWidth,
    height: Number.isFinite(height) ? height : undefined,
    maxHalfDepth: Number.isFinite(maxHalfDepth) ? maxHalfDepth : undefined,
    sealFlattenMm: Number.isFinite(sealFlattenMm) ? sealFlattenMm : undefined,
    bellyPower: Number.isFinite(bellyPower) ? bellyPower : undefined,
    depthProfile,
    filmLayout: parseFilmLayout(o.filmLayout),
    rationale,
  })
}

function parseFilmLayout(raw: unknown): SoftPackDims['filmLayout'] {
  if (!raw || typeof raw !== 'object') return undefined
  const fl = raw as Record<string, unknown>
  const toNums = (v: unknown) =>
    Array.isArray(v)
      ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : []
  const horizontalMm = toNums(fl.horizontalMm ?? fl.horizontal_mm)
  const verticalMm = toNums(fl.verticalMm ?? fl.vertical_mm)
  const verticalRoles = Array.isArray(fl.verticalRoles ?? fl.vertical_roles)
    ? (fl.verticalRoles ?? fl.vertical_roles).map((x) => String(x))
    : []
  const filmWidth = Number(fl.filmWidth ?? fl.film_width)
  const filmHeight = Number(fl.filmHeight ?? fl.film_height)
  if (horizontalMm.length < 4 || verticalMm.length < 2) return undefined
  return {
    horizontalMm,
    verticalMm,
    verticalRoles:
      verticalRoles.length === verticalMm.length
        ? verticalRoles
        : ['BACK', 'GUSSET', 'FRONT', 'GUSSET'].slice(0, verticalMm.length),
    filmWidth: Number.isFinite(filmWidth)
      ? filmWidth
      : horizontalMm.reduce((a, b) => a + b, 0),
    filmHeight: Number.isFinite(filmHeight)
      ? filmHeight
      : verticalMm.reduce((a, b) => a + b, 0),
  }
}

function applyResult(msg: Record<string, unknown>, from: 'ws' | 'rest') {
  const tid = String(msg.taskId || taskId.value || '')
  if (tid && settledTaskId === tid && dims.value) return
  const d = parseDims(msg.dims)
  if (!d) return
  busy.value = false
  stopElapsed()
  stopPoll()
  dims.value = d
  if (tid) {
    taskId.value = tid
    settledTaskId = tid
  }
  if (msg.spatialDocument) spatialPreview.value = String(msg.spatialDocument)
  statusMsg.value = from === 'rest' ? '验算通过（REST）' : '验算通过，已驱动 3D'
  hint.value = isDemoFile.value
    ? ''
    : '推荐框选「全膜展开」一整条（含封边/侧/正）；将一键铺满贴图。也可切到仅正面/背面分面拼贴'
  error.value = ''
  if (!isDemoFile.value) {
    cropConfirmed.value = false
  }
}

function applyError(msg: Record<string, unknown>) {
  const tid = String(msg.taskId || '')
  if (tid && taskId.value && tid !== taskId.value) return
  if (tid) settledTaskId = tid
  busy.value = false
  stopElapsed()
  stopPoll()
  error.value = String(msg.message || '分析失败')
  statusMsg.value = ''
}

function ensureWs() {
  if (client) return
  client = new RobustWebSocket(
    packageWsUrl(),
    onWsMessage,
    (s) => {
      wsStatus.value = s
    },
    () => {
      if (taskId.value && busy.value) {
        client?.send({ type: 'subscribe', taskId: taskId.value })
      }
    },
  )
  client.connect()
}

function onWsMessage(data: unknown) {
  if (!data || typeof data !== 'object') return
  const msg = data as Record<string, unknown>
  const type = String(msg.type || '')
  const msgTask = msg.taskId != null ? String(msg.taskId) : ''
  if (taskId.value && msgTask && msgTask !== taskId.value) return

  if (type === 'subscribed') {
    if (!dims.value) statusMsg.value = `已订阅 ${msg.taskId}`
    if (!dims.value && msgTask) void pullTaskStatus(msgTask)
  } else if (type === 'progress') {
    if (dims.value) return
    statusMsg.value = String(msg.message || msg.stage || '处理中…')
    if (msg.hint) hint.value = String(msg.hint)
    if (msg.spatialPreview) spatialPreview.value = String(msg.spatialPreview)
  } else if (type === 'result') {
    applyResult(msg, 'ws')
  } else if (type === 'error') {
    applyError(msg)
  }
}

async function waitWsOpen(maxMs = 8000) {
  ensureWs()
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    if (wsStatus.value === 'open' && client) return true
    await new Promise((r) => setTimeout(r, 100))
  }
  return wsStatus.value === 'open' && !!client
}

function startPoll(id: string) {
  stopPoll()
  let ticks = 0
  const tick = async () => {
    ticks += 1
    if (taskId.value !== id) {
      stopPoll()
      return
    }
    if (!busy.value && dims.value) {
      stopPoll()
      return
    }
    try {
      const st = await fetchTaskStatus(id)
      if (st.status === 'DONE' && st.dims) {
        applyResult(
          { taskId: st.taskId, dims: st.dims, spatialDocument: st.spatialDocument },
          'rest',
        )
      } else if (st.status === 'FAILED') {
        applyError({ taskId: st.taskId, message: st.message || '分析失败' })
      } else if (ticks >= 90) {
        stopPoll()
        if (busy.value) {
          busy.value = false
          stopElapsed()
          error.value = '等待超时'
        }
      }
    } catch {
      /* ignore */
    }
  }
  void tick()
  pollTimer = setInterval(() => void tick(), 1200)
}

async function onAnalyze() {
  if (!file.value) return
  error.value = ''
  hint.value = ''
  busy.value = true
  dims.value = null
  taskId.value = ''
  settledTaskId = ''
  stopPoll()
  startElapsed()
  try {
    const ok = await waitWsOpen()
    if (!ok) throw new Error('WebSocket 未连通（需后端 8787）')
    const accepted = await submitAnalyze(file.value)
    taskId.value = accepted.taskId
    if (!dims.value) statusMsg.value = `受理 ${accepted.taskId}`
    client?.send({ type: 'subscribe', taskId: accepted.taskId })
    startPoll(accepted.taskId)
  } catch (e) {
    busy.value = false
    stopElapsed()
    stopPoll()
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onDemo() {
  setFile(new File([DEMO_PNG], 'pillow-demo.png', { type: 'image/png' }), { demo: true })
  await onAnalyze()
}

onMounted(() => ensureWs())

onUnmounted(() => {
  stopElapsed()
  stopPoll()
  client?.close()
  client = null
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped lang="scss">
.sp {
  @apply grid h-full min-h-0 gap-3 p-0.5;
  grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
  grid-template-rows: 1fr;
}

@media (max-width: 860px) {
  .sp {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(16rem, 1fr);
    overflow: auto;
  }
}

.sp-rail {
  @apply flex min-h-0 flex-col gap-2 overflow-y-auto;
}

.sp-panel {
  @apply shrink-0 rounded-lg border border-cyan-400/25 bg-slate-950/60 p-2.5;
}

.sp-panel--dims {
  @apply shrink-0;
}

.sp-panel--crop {
  @apply shrink-0;
}

.sp-panel__title {
  @apply mb-1.5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-cyan-300/85;
}

.sp-file {
  @apply hidden;
}

.sp-actions {
  @apply flex flex-wrap gap-1.5;
}

.sp-btn {
  @apply rounded border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[0.8rem] text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40;
}

.sp-btn--ghost {
  @apply border-white/15 bg-white/5 hover:bg-white/10;
}

.sp-btn--accent {
  @apply border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25;
}

.sp-meta {
  @apply mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-[0.65rem] text-slate-500;
}

.sp-dot {
  @apply inline-block h-1.5 w-1.5 rounded-full bg-slate-500;
}
.sp-dot--open {
  @apply bg-emerald-400;
}
.sp-dot--connecting,
.sp-dot--reconnecting {
  @apply bg-amber-400;
}
.sp-dot--closed {
  @apply bg-rose-400;
}

.sp-status {
  @apply mt-1 text-[0.78rem] leading-snug text-cyan-100/90;
}
.sp-tip {
  @apply mt-1 text-[0.7rem] leading-snug text-amber-200/85;
}
.sp-error {
  @apply mt-1 text-[0.78rem] text-rose-300;
}
.sp-muted {
  @apply text-[0.8rem] text-slate-500;
}

.sp-spatial-wrap {
  @apply mt-1.5;
  summary {
    @apply cursor-pointer font-mono text-[0.65rem] text-slate-500 hover:text-cyan-300/80;
  }
}
.sp-spatial {
  @apply mt-1 max-h-24 overflow-auto rounded bg-black/40 p-1.5 font-mono text-[0.6rem] leading-relaxed text-slate-400;
}

.sp-dims {
  @apply grid gap-1.5;
  grid-template-columns: 1fr 1fr;
  div {
    @apply rounded border border-white/10 bg-black/30 px-2 py-1.5;
    span {
      @apply block font-mono text-[0.55rem] uppercase tracking-wider text-slate-500;
    }
    strong {
      @apply font-mono text-[0.95rem] text-cyan-100;
    }
  }
}
.sp-dims__check {
  @apply col-span-2;
  strong.ok {
    @apply text-emerald-300;
  }
  strong.bad {
    @apply text-rose-300;
  }
  em {
    @apply ml-1 not-italic text-slate-400;
    font-size: 0.8em;
  }
}

.sp-dims__why {
  @apply col-span-2 mt-1 text-xs leading-snug text-slate-400;
}

.sp-stage {
  @apply flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-cyan-400/25 bg-slate-950/60;
}

.sp-stage__head {
  @apply flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-2;
  .sp-panel__title {
    @apply mb-0;
  }
}

.sp-stage__tag {
  @apply font-mono text-[0.6rem] uppercase tracking-wider text-slate-500;
}

.sp-stage__body {
  @apply relative min-h-0 flex-1;
}

.sp-view-ph {
  @apply absolute inset-0 flex flex-col items-center justify-center gap-1 border border-dashed border-cyan-400/15 bg-slate-950/50;
}
.sp-view-ph__hint {
  @apply text-[0.7rem] text-slate-600;
}
</style>
