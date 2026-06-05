<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import vjmap from '@/lib/vjmap'
import 'vjmap/dist/vjmap.min.css'
import { CAD_PREVIEW_API } from '@/config/api'
import { CAD_PREVIEW_MAX_BYTES } from '@/config/cadViewer'
import { VJMAP_ACCESS_TOKEN, VJMAP_SERVICE_URL } from '@/config/vjmapCloud'
import { appApiFetch } from '@/utils/apiAuth'
import {
  CAD_RENDER_HINTS,
  CAD_UPLOAD_HINTS,
  startSlowLoadingHints,
} from '@/utils/slowLoadingHint'

const props = withDefaults(
  defineProps<{
    initialFileId?: string
    initialMapId?: string
    initialUploadName?: string
    initialFileName?: string
  }>(),
  {
    initialFileId: '',
    initialMapId: '',
    initialUploadName: '',
    initialFileName: '',
  },
)

const emit = defineEmits<{
  ready: [payload: { fileId: string; mapId: string; fileName: string }]
  error: [message: string]
}>()

type Phase = 'idle' | 'uploading' | 'rendering' | 'ready' | 'error'

const fileInputRef = ref<HTMLInputElement>()
const mapContainerRef = ref<HTMLDivElement>()
const phase = ref<Phase>(props.initialFileId ? 'rendering' : 'idle')
const statusLine = ref(
  props.initialFileId ? '正在加载 WebGL 地图切片…' : '请选择 DWG 或 DXF 图纸',
)
const slowHint = ref('')
const elapsedSec = ref(0)
const fileName = ref(props.initialFileName || '')
const fileId = ref(props.initialFileId || '')
const mapId = ref(props.initialMapId || props.initialFileId || '')
const uploadName = ref(props.initialUploadName || '')
const errorMessage = ref('')

let mapInstance: vjmap.Map | null = null
let serviceInstance: vjmap.Service | null = null
let stopBusyHints: (() => void) | null = null

function beginBusyHints(kind: 'upload' | 'render') {
  stopBusyHints?.()
  const steps = kind === 'upload' ? CAD_UPLOAD_HINTS : CAD_RENDER_HINTS
  stopBusyHints = startSlowLoadingHints(steps, (text, sec) => {
    slowHint.value = text
    elapsedSec.value = sec
  })
}

function endBusyHints() {
  stopBusyHints?.()
  stopBusyHints = null
  slowHint.value = ''
  elapsedSec.value = 0
}

const accept = '.dwg,.dxf,application/acad,image/vnd.dwg'
const isBusy = computed(() => phase.value === 'uploading' || phase.value === 'rendering')
const showLoadingOverlay = computed(() => phase.value === 'uploading' || phase.value === 'rendering')

function openPicker() {
  if (isBusy.value) return
  fileInputRef.value?.click()
}

function resetError() {
  errorMessage.value = ''
  if (phase.value === 'error') {
    phase.value = 'idle'
    statusLine.value = '请选择 DWG 或 DXF 图纸'
  }
}

function failRender(message: string) {
  console.error('[CadViewer]', message)
  endBusyHints()
  phase.value = 'error'
  errorMessage.value = message
  statusLine.value = '地图加载失败'
  emit('error', message)
}

function destroyMap() {
  try {
    mapInstance?.remove()
  } catch (err) {
    console.warn('[CadViewer] map remove failed', err)
  } finally {
    mapInstance = null
    serviceInstance = null
  }
}

function toLngLatPair(point: unknown): [number, number] {
  if (Array.isArray(point) && point.length >= 2) {
    return [Number(point[0]), Number(point[1])]
  }
  if (point && typeof point === 'object') {
    const p = point as { lng?: number; lon?: number; lat?: number }
    return [p.lng ?? p.lon ?? 0, p.lat ?? 0]
  }
  return [0, 0]
}

function fitMapToDrawing(map: vjmap.Map, projection: vjmap.GeoProjection) {
  try {
    const extent = projection.getMapExtent()
    const min = toLngLatPair(projection.toLngLat([extent.min.x, extent.min.y]))
    const max = toLngLatPair(projection.toLngLat([extent.max.x, extent.max.y]))
    map.fitBounds([min, max], { padding: 48, duration: 0 })
  } catch (err) {
    console.warn('[CadViewer] fitBounds failed, using default zoom', err)
    map.setZoom(2)
  }
}

async function initCadMap(targetMapId: string, targetFileId: string, targetUploadName?: string) {
  if (!VJMAP_ACCESS_TOKEN) {
    failRender('缺少 VJMAP 访问令牌，请在环境变量中配置 VITE_VJMAP_ACCESS_TOKEN')
    return
  }

  const container = mapContainerRef.value
  if (!container) {
    failRender('CAD 视口未就绪')
    return
  }

  phase.value = 'rendering'
  statusLine.value = '正在连接云端地图服务…'
  beginBusyHints('render')
  destroyMap()

  await nextTick()

  try {
    const svc = new vjmap.Service(VJMAP_SERVICE_URL, VJMAP_ACCESS_TOKEN)
    serviceInstance = svc

    const openResult = await svc.openMap({
      mapid: targetMapId,
      fileid: targetFileId,
      uploadname: targetUploadName || undefined,
      mapopenway: vjmap.MapOpenWay.GeomRender,
      style: vjmap.openMapDarkStyle(),
    })

    if (openResult?.error) {
      const errText =
        typeof openResult.error === 'string'
          ? openResult.error
          : JSON.stringify(openResult.error)
      failRender(`云端打开地图失败：${errText}`)
      return
    }

    statusLine.value = '正在绑定矢量瓦片图层…'

    const projection = new vjmap.GeoProjection(openResult.bounds)
    const center = projection.toLngLat(projection.getMapExtent().center())

    const map = new vjmap.Map({
      container,
      style: svc.vectorStyle(),
      center,
      zoom: 2,
      pitch: 0,
      renderWorldCopies: false,
      doubleClickZoom: true,
      dragRotate: false,
    })

    mapInstance = map
    map.attach(svc, projection)

    const revealMap = () => {
      fitMapToDrawing(map, projection)
      endBusyHints()
      phase.value = 'ready'
      statusLine.value = '交互式预览已就绪'
    }

    if (map.loaded()) {
      revealMap()
    } else {
      map.once('load', revealMap)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '地图初始化失败'
    failRender(msg)
  }
}

async function parseProxyError(res: Response): Promise<string> {
  const fallback = `上传失败（HTTP ${res.status}）`
  const ct = res.headers.get('Content-Type') || ''
  if (ct.includes('json')) {
    try {
      const data = (await res.json()) as { detail?: string; title?: string }
      if (data.detail) return data.detail
      if (data.title) return data.title
    } catch {
      /* ignore */
    }
  }
  if (res.status === 504) return '云端处理超时，请稍后重试或改用 DXF'
  if (res.status === 413) return '图纸超过服务端大小上限'
  return fallback
}

async function beginMapSession(
  resolvedFileId: string,
  resolvedMapId: string,
  resolvedUploadName: string,
  displayName: string,
) {
  fileId.value = resolvedFileId
  mapId.value = resolvedMapId
  uploadName.value = resolvedUploadName
  fileName.value = displayName

  await initCadMap(resolvedMapId, resolvedFileId, resolvedUploadName || undefined)

  if (phase.value === 'ready') {
    emit('ready', { fileId: resolvedFileId, mapId: resolvedMapId, fileName: displayName })
  }
}

async function uploadViaProxy(file: File) {
  if (file.size > CAD_PREVIEW_MAX_BYTES) {
    throw new Error(`图纸超过 ${Math.round(CAD_PREVIEW_MAX_BYTES / (1024 * 1024))} MB 上限`)
  }

  phase.value = 'uploading'
  statusLine.value = '正在上传图纸…'
  beginBusyHints('upload')
  resetError()
  destroyMap()

  const form = new FormData()
  form.append('file', file, file.name)
  statusLine.value = '正在转发至云端转码服务…'

  const res = await appApiFetch(`${CAD_PREVIEW_API}/upload-proxy`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new Error(await parseProxyError(res))
  }

  statusLine.value = '正在解析云端响应…'

  const data = (await res.json()) as {
    fileId?: string
    mapId?: string
    uploadName?: string
  }
  if (!data.fileId) {
    throw new Error('云端响应缺少 fileId')
  }

  const resolvedMapId = data.mapId ?? data.fileId
  console.info('[CadViewer] cloud upload ok', {
    fileId: data.fileId,
    mapId: resolvedMapId,
    uploadName: data.uploadName ?? file.name,
  })
  await beginMapSession(
    data.fileId,
    resolvedMapId,
    data.uploadName ?? file.name,
    file.name,
  )
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext !== 'dwg' && ext !== 'dxf') {
    phase.value = 'error'
    errorMessage.value = '仅支持 .dwg 与 .dxf 格式'
    statusLine.value = '不支持的文件类型'
    emit('error', errorMessage.value)
    return
  }

  try {
    await uploadViaProxy(file)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '图纸上传失败'
    endBusyHints()
    phase.value = 'error'
    errorMessage.value = msg
    statusLine.value = '上传失败'
    emit('error', msg)
  }
}

onMounted(() => {
  if (props.initialFileId) {
    void beginMapSession(
      props.initialFileId,
      props.initialMapId || props.initialFileId,
      props.initialUploadName || props.initialFileName,
      props.initialFileName || 'CAD drawing',
    )
  }
})

onUnmounted(() => {
  endBusyHints()
  destroyMap()
})
</script>

<template>
  <div class="cad-viewer">
    <header class="cad-viewer-head">
      <div class="cad-viewer-brand">
        <span class="cad-viewer-pulse" aria-hidden="true" />
        <div>
          <p class="cad-viewer-kicker">NEXUS CAD CLOUD</p>
          <p class="cad-viewer-title">{{ fileName || 'Large drawing preview' }}</p>
        </div>
      </div>
      <button type="button" class="cad-viewer-btn" :disabled="isBusy" @click="openPicker">
        {{ phase === 'ready' ? 'Replace file' : 'Upload drawing' }}
      </button>
    </header>

    <input
      ref="fileInputRef"
      type="file"
      class="cad-viewer-input"
      :accept="accept"
      @change="onFileChange"
    />

    <div class="cad-viewer-stage">
      <div v-if="showLoadingOverlay" class="cad-viewer-overlay" aria-live="polite">
        <div class="cad-viewer-spinner" aria-hidden="true" />
        <p class="cad-viewer-status">{{ statusLine }}</p>
        <p v-if="slowHint" class="cad-viewer-slow-hint">{{ slowHint }}</p>
        <p v-if="elapsedSec >= 8" class="cad-viewer-elapsed">已等待 {{ elapsedSec }} 秒</p>
        <p v-if="fileId && phase === 'rendering'" class="cad-viewer-file-id">
          fileid <code>{{ fileId }}</code>
          <span v-if="mapId"> · mapid <code>{{ mapId }}</code></span>
        </p>
      </div>

      <div
        id="cad-canvas-container"
        ref="mapContainerRef"
        class="cad-viewer-canvas"
        :class="{ 'cad-viewer-canvas--live': phase === 'ready' }"
        role="application"
        aria-label="VJMAP WebGL CAD viewport"
      />

      <p v-if="phase === 'idle'" class="cad-viewer-idle">DWG 2018+ · Cloud tile pipeline</p>

      <div v-if="phase === 'error'" class="cad-viewer-error">
        <p>{{ errorMessage }}</p>
        <button type="button" class="cad-viewer-btn cad-viewer-btn--ghost" @click="openPicker">
          重试
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cad-viewer {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: min(68vh, 620px);
  min-height: 360px;
  border-radius: 12px;
  border: 1px solid rgba(106, 184, 204, 0.28);
  background: linear-gradient(165deg, rgba(8, 14, 24, 0.96) 0%, rgba(14, 26, 38, 0.92) 100%);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35) inset,
    0 18px 48px rgba(0, 0, 0, 0.42);
  overflow: hidden;
}

.cad-viewer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(106, 184, 204, 0.15);
  flex-shrink: 0;
}

.cad-viewer-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.cad-viewer-pulse {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #5ec8e8;
  box-shadow: 0 0 12px rgba(94, 200, 232, 0.85);
  animation: cad-pulse 1.6s ease-in-out infinite;
}

@keyframes cad-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.92);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
}

.cad-viewer-kicker {
  margin: 0;
  font-size: 0.625rem;
  letter-spacing: 0.18em;
  color: rgba(136, 204, 238, 0.65);
}

.cad-viewer-title {
  margin: 0.15rem 0 0;
  font-size: 0.875rem;
  color: rgba(228, 240, 248, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: min(420px, 52vw);
}

.cad-viewer-btn {
  flex-shrink: 0;
  padding: 0.45rem 0.95rem;
  border-radius: 999px;
  border: 1px solid rgba(90, 168, 184, 0.45);
  background: rgba(42, 104, 120, 0.38);
  color: #dce8f0;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.cad-viewer-btn:hover:not(:disabled) {
  background: rgba(52, 128, 148, 0.55);
  border-color: rgba(120, 200, 220, 0.65);
}

.cad-viewer-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.cad-viewer-btn--ghost {
  background: transparent;
}

.cad-viewer-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.cad-viewer-stage {
  position: relative;
  flex: 1;
  min-height: 0;
}

.cad-viewer-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  text-align: center;
  background: rgba(4, 10, 18, 0.82);
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.cad-viewer-spinner {
  width: 42px;
  height: 42px;
  border: 2px solid rgba(106, 184, 204, 0.2);
  border-top-color: #6ab8cc;
  border-radius: 50%;
  animation: cad-spin 0.9s linear infinite;
}

@keyframes cad-spin {
  to {
    transform: rotate(360deg);
  }
}

.cad-viewer-status {
  margin: 0;
  font-size: 0.875rem;
  color: rgba(210, 228, 240, 0.9);
  letter-spacing: 0.02em;
}

.cad-viewer-slow-hint {
  margin: 0;
  max-width: 28rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: rgba(180, 210, 224, 0.78);
}

.cad-viewer-elapsed {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(150, 190, 210, 0.55);
}

.cad-viewer-file-id {
  margin: 0;
  font-size: 0.75rem;
  color: rgba(160, 200, 220, 0.75);
}

.cad-viewer-file-id code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: #8ed4f0;
}

.cad-viewer-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
  background: #0a1218;
}

.cad-viewer-canvas--live {
  opacity: 1;
  pointer-events: auto;
  z-index: 1;
}

.cad-viewer-canvas :deep(.mapboxgl-canvas) {
  outline: none;
}

.cad-viewer-idle {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: 0.8125rem;
  color: rgba(160, 190, 210, 0.5);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  pointer-events: none;
}

.cad-viewer-error {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: rgba(48, 16, 20, 0.88);
  border: 1px solid rgba(220, 120, 120, 0.35);
  color: rgba(255, 200, 200, 0.92);
  font-size: 0.8125rem;
}
</style>
