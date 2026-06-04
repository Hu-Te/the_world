<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { CAD_PREVIEW_API } from '@/config/api'
import { CAD_PREVIEW_MAX_BYTES } from '@/config/cadViewer'

const props = withDefaults(
  defineProps<{
    /** When set, skip upload and show tile-ready overlay immediately. */
    initialFileId?: string
    initialFileName?: string
  }>(),
  {
    initialFileId: '',
    initialFileName: '',
  },
)

const emit = defineEmits<{
  ready: [payload: { fileId: string; fileName: string }]
  error: [message: string]
}>()

type Phase = 'idle' | 'uploading' | 'ready' | 'error'

const fileInputRef = ref<HTMLInputElement>()
const phase = ref<Phase>(props.initialFileId ? 'ready' : 'idle')
const statusLine = ref(
  props.initialFileId ? 'Cloud map registered. Tile renderer pending.' : 'Select a DWG or DXF drawing',
)
const fileName = ref(props.initialFileName || '')
const fileId = ref(props.initialFileId || '')
const errorMessage = ref('')

const accept = '.dwg,.dxf,application/acad,image/vnd.dwg'
const isBusy = computed(() => phase.value === 'uploading')
const showOverlay = computed(() => phase.value === 'uploading' || phase.value === 'ready')

function openPicker() {
  if (isBusy.value) return
  fileInputRef.value?.click()
}

function resetError() {
  errorMessage.value = ''
  if (phase.value === 'error') {
    phase.value = 'idle'
    statusLine.value = 'Select a DWG or DXF drawing'
  }
}

async function parseProxyError(res: Response): Promise<string> {
  const fallback = `Upload proxy failed (HTTP ${res.status})`
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
  if (res.status === 504) return 'Cloud gateway timeout'
  if (res.status === 413) return 'Drawing exceeds server upload limit'
  return fallback
}

async function uploadViaProxy(file: File) {
  if (file.size > CAD_PREVIEW_MAX_BYTES) {
    throw new Error(`Drawing exceeds ${Math.round(CAD_PREVIEW_MAX_BYTES / (1024 * 1024))} MB limit`)
  }

  phase.value = 'uploading'
  statusLine.value = 'Streaming drawing to Nexus proxy…'
  resetError()

  const form = new FormData()
  form.append('file', file, file.name)

  statusLine.value = 'Forwarding to cloud tile encoder…'

  const res = await fetch(`${CAD_PREVIEW_API}/upload-proxy`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new Error(await parseProxyError(res))
  }

  statusLine.value = 'Parsing cloud registration response…'

  const data = (await res.json()) as { fileId?: string }
  if (!data.fileId) {
    throw new Error('Cloud gateway response missing fileId')
  }

  fileId.value = data.fileId
  fileName.value = file.name
  phase.value = 'ready'
  statusLine.value = 'Cloud map registered. Initializing WebGL tile renderer…'
  emit('ready', { fileId: data.fileId, fileName: file.name })
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (ext !== 'dwg' && ext !== 'dxf') {
    phase.value = 'error'
    errorMessage.value = 'Only .dwg and .dxf files are supported'
    statusLine.value = 'Unsupported file type'
    emit('error', errorMessage.value)
    return
  }

  try {
    await uploadViaProxy(file)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'CAD cloud upload failed'
    phase.value = 'error'
    errorMessage.value = msg
    statusLine.value = 'Upload failed'
    emit('error', msg)
  }
}

onUnmounted(() => {
  /* tile WebGL lifecycle will attach here */
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
      <div v-if="showOverlay" class="cad-viewer-overlay" aria-live="polite">
        <div v-if="phase === 'uploading'" class="cad-viewer-spinner" aria-hidden="true" />
        <p class="cad-viewer-status">{{ statusLine }}</p>
        <p v-if="phase === 'ready' && fileId" class="cad-viewer-file-id">
          Map ID <code>{{ fileId }}</code>
        </p>
      </div>

      <div
        class="cad-viewer-canvas"
        :class="{ 'cad-viewer-canvas--armed': phase === 'ready' }"
        role="img"
        :aria-label="
          phase === 'ready'
            ? 'WebGL tile renderer ready for initialization'
            : 'CAD preview viewport'
        "
      >
        <div v-if="phase === 'ready'" class="cad-viewer-grid" aria-hidden="true" />
        <p v-if="phase === 'ready'" class="cad-viewer-ready-label">
          WebGL tile layer — awaiting SDK bind
        </p>
        <p v-else-if="phase === 'idle'" class="cad-viewer-idle">DWG 2018+ · Cloud tile pipeline</p>
      </div>

      <div v-if="phase === 'error'" class="cad-viewer-error">
        <p>{{ errorMessage }}</p>
        <button type="button" class="cad-viewer-btn cad-viewer-btn--ghost" @click="openPicker">
          Try again
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
  background: rgba(4, 10, 18, 0.78);
  backdrop-filter: blur(4px);
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
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(ellipse at 50% 40%, rgba(24, 48, 64, 0.35), rgba(6, 12, 20, 0.95));
}

.cad-viewer-canvas--armed {
  border: 1px dashed rgba(106, 184, 204, 0.35);
  margin: 0.65rem;
  border-radius: 8px;
  inset: 0.65rem;
}

.cad-viewer-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(106, 184, 204, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(106, 184, 204, 0.06) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0.85;
}

.cad-viewer-ready-label {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  background: rgba(6, 14, 22, 0.72);
  border: 1px solid rgba(106, 184, 204, 0.25);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(180, 220, 236, 0.88);
}

.cad-viewer-idle {
  margin: 0;
  font-size: 0.8125rem;
  color: rgba(160, 190, 210, 0.5);
  letter-spacing: 0.08em;
  text-transform: uppercase;
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
