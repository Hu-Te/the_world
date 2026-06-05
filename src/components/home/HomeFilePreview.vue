<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import CadViewer from '@/components/CadViewer.vue'
import type { FilePreviewState } from '@/utils/filePreview'
import { formatFileSize } from '@/utils/filePreview'

defineProps<{
  state: FilePreviewState
}>()

const emit = defineEmits<{
  close: []
  replace: []
}>()

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <div class="preview-root" role="dialog" aria-modal="true" :aria-label="`预览 ${state.name}`">
      <button type="button" class="preview-backdrop" aria-label="关闭预览" @click="emit('close')" />

      <article class="preview-panel" :class="{ 'preview-panel--cad': state.kind === 'cad' }">
        <header class="preview-head">
          <div class="preview-meta">
            <p class="preview-name" :title="state.name">{{ state.name }}</p>
            <p class="preview-sub">
              <span>{{ formatFileSize(state.size) }}</span>
              <span class="preview-dot" />
              <span>{{
                state.kind === 'cad' ? 'DWG / DXF · Cloud tiles' : state.mime || '未知类型'
              }}</span>
            </p>
          </div>
          <div class="preview-actions">
            <button type="button" class="preview-btn" @click="emit('replace')">换文件</button>
            <button type="button" class="preview-btn preview-btn--ghost" @click="emit('close')">关闭</button>
          </div>
        </header>

        <div class="preview-body">
          <img v-if="state.kind === 'image'" :src="state.url" :alt="state.name" class="preview-image" />

          <video
            v-else-if="state.kind === 'video'"
            :src="state.url"
            class="preview-video"
            controls
            playsinline
          />

          <audio v-else-if="state.kind === 'audio'" :src="state.url" class="preview-audio" controls />

          <iframe
            v-else-if="state.kind === 'pdf'"
            :src="state.url"
            class="preview-pdf"
            :title="state.name"
          />

          <pre v-else-if="state.kind === 'text'" class="preview-text">{{ state.text }}</pre>

          <CadViewer
            v-else-if="state.kind === 'cad'"
            class="preview-cad-viewer"
            :initial-file-id="state.cloudFileId"
            :initial-map-id="state.cloudMapId"
            :initial-upload-name="state.cloudUploadName"
            :initial-file-name="state.name"
          />

          <div v-else class="preview-fallback">
            <p>暂不支持在线预览此格式</p>
            <p class="preview-fallback-hint">可选择其他文件，或在本地应用中打开</p>
          </div>
        </div>

        <p v-if="state.truncated" class="preview-truncated">文本过长，仅显示前 512 KB</p>
      </article>
    </div>
  </Teleport>
</template>

<style scoped>
.preview-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
    max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
}

.preview-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(3, 6, 12, 0.72);
  backdrop-filter: blur(6px);
  cursor: pointer;
}

.preview-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: min(920px, 100%);
  max-height: min(82vh, 760px);
  border-radius: 16px;
  border: 1px solid rgba(136, 204, 238, 0.22);
  background: rgba(6, 12, 20, 0.94);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.preview-panel--cad {
  width: min(1080px, 100%);
  max-height: min(88vh, 820px);
}

.preview-cad-viewer {
  flex: 1;
  min-height: 360px;
}

.preview-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.15rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.preview-meta {
  min-width: 0;
}

.preview-name {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #eef4f8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preview-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: rgba(200, 220, 232, 0.62);
}

.preview-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(136, 180, 196, 0.5);
}

.preview-actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
}

.preview-btn {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(90, 168, 184, 0.45);
  background: rgba(42, 104, 120, 0.35);
  color: #dce8f0;
  font-size: 0.8125rem;
  cursor: pointer;
  touch-action: manipulation;
}

.preview-btn--ghost {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem 1.15rem;
  overflow: auto;
  background: rgba(0, 0, 0, 0.22);
}

.preview-body:has(.preview-cad-viewer) {
  align-items: stretch;
  justify-content: stretch;
  padding: 0.75rem;
}

.preview-cad-svg {
  width: 100%;
  height: min(68vh, 620px);
  min-height: 360px;
  border: 0;
  border-radius: 8px;
  background: #e8eef2;
}

.preview-image {
  max-width: 100%;
  max-height: min(62vh, 560px);
  object-fit: contain;
  border-radius: 8px;
}

.preview-video {
  width: 100%;
  max-height: min(62vh, 560px);
  border-radius: 8px;
  background: #000;
}

.preview-audio {
  width: min(420px, 100%);
}

.preview-pdf {
  width: 100%;
  height: min(62vh, 560px);
  border: 0;
  border-radius: 8px;
  background: #fff;
}

.preview-text {
  width: 100%;
  max-height: min(62vh, 560px);
  margin: 0;
  padding: 0.85rem 1rem;
  overflow: auto;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 14, 22, 0.88);
  color: rgba(220, 232, 240, 0.88);
  font-size: 0.8125rem;
  line-height: 1.65;
  font-family: ui-monospace, 'SF Mono', 'Menlo', monospace;
  white-space: pre-wrap;
  word-break: break-word;
}

.preview-fallback {
  text-align: center;
  color: rgba(220, 232, 240, 0.78);
}

.preview-fallback p {
  margin: 0;
}

.preview-fallback-hint {
  margin-top: 0.45rem !important;
  font-size: 0.8125rem;
  color: rgba(200, 220, 232, 0.52);
}

.preview-truncated {
  margin: 0;
  padding: 0.55rem 1.15rem 0.85rem;
  font-size: 0.75rem;
  color: rgba(200, 220, 232, 0.55);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

@media (max-width: 640px) {
  .preview-head {
    flex-direction: column;
  }

  .preview-actions {
    width: 100%;
  }

  .preview-btn {
    flex: 1;
  }
}
</style>
