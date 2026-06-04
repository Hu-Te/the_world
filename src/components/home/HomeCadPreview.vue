<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  AcApDocManager,
  AcEdOpenMode,
  type AcApOpenDatabaseOptions,
} from '@mlightcad/cad-simple-viewer'
import type { AcDbProgressdEventArgs } from '@mlightcad/data-model'
import { CAD_VIEWER_BASE_URL, CAD_VIEWER_WORKERS } from '@/config/cadViewer'
import {
  buildCadOpenFailureHint,
  buildCadOpenFailureMessage,
  cadMinimumChunkSize,
  isUnsupportedDwgFile,
  readDwgVersionCode,
} from '@/utils/dwgInfo'

const props = defineProps<{
  file: File
}>()

const emit = defineEmits<{
  error: [message: string]
}>()

const containerRef = ref<HTMLDivElement>()
const status = ref<'loading' | 'ready' | 'error'>('loading')
const statusText = ref('正在解析图纸…')
const failureHint = ref('可尝试另存为 AutoCAD 2013 DXF，或较低版本 DWG 后再预览')
let docManager: AcApDocManager | null = null
let offProgress: (() => void) | undefined

function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsArrayBuffer(file)
  })
}

function bindProgress(manager: AcApDocManager) {
  offProgress?.()
  const handler = (args: AcDbProgressdEventArgs) => {
    const pct = Math.round(args.percentage ?? 0)
    if (pct > 0 && pct < 100) {
      statusText.value = `正在解析图纸… ${pct}%`
    }
  }
  manager.curDocument.database.events.openProgress.addEventListener(handler)
  offProgress = () => {
    manager.curDocument.database.events.openProgress.removeEventListener(handler)
  }
}

function normalizeCadError(e: unknown, fileName: string, buffer: ArrayBuffer): string {
  if (!(e instanceof Error)) return '图纸加载失败'
  if (e.message.includes('conversion stage') || e.message.includes('toLowerCase')) {
    return buildCadOpenFailureMessage(fileName, buffer, props.file.size)
  }
  return e.message
}

async function initViewer() {
  const el = containerRef.value
  if (!el) return

  status.value = 'loading'
  statusText.value = '正在读取文件…'

  let buffer: ArrayBuffer | undefined
  let versionCode: string | null = null

  try {
    buffer = await readArrayBuffer(props.file)
    versionCode = readDwgVersionCode(buffer)

    if (isUnsupportedDwgFile(props.file.name, buffer)) {
      failureHint.value = buildCadOpenFailureHint(versionCode, props.file.size)
      throw new Error(buildCadOpenFailureMessage(props.file.name, buffer, props.file.size))
    }
  } catch (e) {
    const msg =
      buffer !== undefined
        ? normalizeCadError(e, props.file.name, buffer)
        : e instanceof Error
          ? e.message
          : '图纸加载失败'
    status.value = 'error'
    statusText.value = msg
    emit('error', msg)
    return
  }

  try {
    await AcApDocManager.instance.destroy()
  } catch {
    /* 首次无实例 */
  }

  statusText.value = '正在初始化查看器…'

  try {
    docManager =
      AcApDocManager.createInstance({
        container: el,
        autoResize: true,
        baseUrl: CAD_VIEWER_BASE_URL,
        webworkerFileUrls: {
          dxfParser: CAD_VIEWER_WORKERS.dxfParser,
          dwgParser: CAD_VIEWER_WORKERS.dwgParser,
          mtextRender: CAD_VIEWER_WORKERS.mtextRender,
        },
      }) ?? null

    if (!docManager) {
      throw new Error('查看器初始化失败')
    }

    bindProgress(docManager)

    statusText.value = '正在加载字体…'
    await docManager.loadDefaultFonts(['simkai'])

    statusText.value = '正在解析图纸…'
    const options: AcApOpenDatabaseOptions = {
      minimumChunkSize: cadMinimumChunkSize(props.file.size),
      mode: AcEdOpenMode.Read,
    }

    const ok = await docManager.openDocument(props.file.name, buffer, options)
    if (!ok) {
      failureHint.value = buildCadOpenFailureHint(versionCode, props.file.size)
      throw new Error(buildCadOpenFailureMessage(props.file.name, buffer, props.file.size))
    }

    docManager.curView.zoomToFitDrawing()
    status.value = 'ready'
  } catch (e) {
    const msg = normalizeCadError(e, props.file.name, buffer)
    status.value = 'error'
    statusText.value = msg
    emit('error', msg)
  } finally {
    offProgress?.()
    offProgress = undefined
  }
}

function onFitView() {
  try {
    docManager?.curView.zoomToFitDrawing()
  } catch {
    /* ignore */
  }
}

onMounted(() => {
  void initViewer()
})

onUnmounted(() => {
  offProgress?.()
  void docManager?.destroy()
  docManager = null
})
</script>

<template>
  <div class="cad-preview">
    <div v-show="status === 'loading'" class="cad-preview-overlay" aria-live="polite">
      <span class="cad-preview-spinner" aria-hidden="true" />
      <p>{{ statusText }}</p>
    </div>

    <div v-if="status === 'error'" class="cad-preview-overlay cad-preview-overlay--error">
      <p>{{ statusText }}</p>
      <p class="cad-preview-hint">{{ failureHint }}</p>
    </div>

    <div v-show="status === 'ready'" class="cad-preview-toolbar">
      <button type="button" class="cad-preview-tool" @click="onFitView">适应窗口</button>
      <span class="cad-preview-tip">滚轮缩放 · 拖拽平移</span>
    </div>

    <div ref="containerRef" class="cad-preview-canvas" />
  </div>
</template>

<style scoped>
.cad-preview {
  position: relative;
  width: 100%;
  height: min(68vh, 620px);
  min-height: 360px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #2a3238;
}

.cad-preview-canvas {
  width: 100%;
  height: 100%;
}

/* 预览模式隐藏 CAD 命令行 */
.cad-preview-canvas :deep(.ml-cli-container) {
  display: none !important;
}

.cad-preview-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  padding: 1.5rem;
  text-align: center;
  background: rgba(8, 14, 22, 0.82);
  color: rgba(220, 232, 240, 0.88);
  font-size: 0.875rem;
}

.cad-preview-overlay--error {
  color: rgba(255, 200, 200, 0.92);
}

.cad-preview-hint {
  margin: 0;
  max-width: 28rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: rgba(200, 220, 232, 0.55);
}

.cad-preview-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid rgba(136, 204, 238, 0.25);
  border-top-color: #6ab8cc;
  border-radius: 50%;
  animation: cad-spin 0.85s linear infinite;
}

@keyframes cad-spin {
  to {
    transform: rotate(360deg);
  }
}

.cad-preview-toolbar {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.35rem 0.55rem;
  border-radius: 999px;
  background: rgba(6, 12, 20, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(8px);
}

.cad-preview-tool {
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  border: 1px solid rgba(90, 168, 184, 0.4);
  background: rgba(42, 104, 120, 0.35);
  color: #dce8f0;
  font-size: 0.75rem;
  cursor: pointer;
}

.cad-preview-tip {
  font-size: 0.6875rem;
  color: rgba(200, 220, 232, 0.55);
  letter-spacing: 0.02em;
}

@media (max-width: 640px) {
  .cad-preview {
    min-height: 280px;
    height: min(58vh, 480px);
  }

  .cad-preview-toolbar {
    left: 0.65rem;
    right: 0.65rem;
    justify-content: space-between;
  }
}
</style>
