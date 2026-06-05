<script setup lang="ts">
import { useHomeTools } from '@/composables/useHomeTools'
import { FILE_PREVIEW_ACCEPT } from '@/utils/filePreview'
import HomeFilePreview from '@/components/home/HomeFilePreview.vue'
import HomeLanScanModal from '@/components/home/HomeLanScanModal.vue'

const {
  toast,
  previewLoading,
  previewLoadingHint,
  previewLoadingElapsed,
  zipExtractRef,
  filePreviewRef,
  previewOpen,
  previewState,
  lanScanOpen,
  onZipExtract,
  onFilePreview,
  closePreview,
  closeLanScan,
  openFilePreviewPicker,
  activateTool,
} = useHomeTools()

defineExpose({ activateTool })
</script>

<template>
  <input
    ref="zipExtractRef"
    type="file"
    accept=".zip,application/zip"
    class="sr-only"
    @change="onZipExtract"
  />
  <input
    ref="filePreviewRef"
    type="file"
    :accept="FILE_PREVIEW_ACCEPT"
    class="sr-only"
    @change="onFilePreview"
  />

  <HomeFilePreview
    v-if="previewOpen && previewState"
    :state="previewState"
    @close="closePreview"
    @replace="openFilePreviewPicker"
  />

  <HomeLanScanModal v-if="lanScanOpen" @close="closeLanScan" />

  <Transition name="toast">
    <p v-if="toast" class="tool-toast" role="status">{{ toast }}</p>
  </Transition>

  <Transition name="loading">
    <div
      v-if="previewLoading"
      class="preview-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="preview-loading-card">
        <div class="preview-loading-spinner" aria-hidden="true" />
        <p class="preview-loading-title">{{ previewLoadingHint }}</p>
        <p v-if="previewLoadingElapsed >= 8" class="preview-loading-meta">
          已等待 {{ previewLoadingElapsed }} 秒 · 请勿关闭页面
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.tool-toast {
  position: fixed;
  right: max(1.25rem, env(safe-area-inset-right));
  bottom: calc(5.5rem + env(safe-area-inset-bottom));
  left: auto;
  z-index: 90;
  max-width: min(320px, calc(100vw - 2.5rem - env(safe-area-inset-left) - env(safe-area-inset-right)));
  margin: 0;
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  border: 1px solid rgba(136, 204, 238, 0.28);
  background: rgba(8, 16, 28, 0.88);
  backdrop-filter: blur(8px);
  color: rgba(220, 232, 240, 0.9);
  font-size: 0.8125rem;
  pointer-events: none;
}

@media (max-width: 640px) {
  .tool-toast {
    right: max(1rem, env(safe-area-inset-right));
    left: max(1rem, env(safe-area-inset-left));
    bottom: calc(6.25rem + env(safe-area-inset-bottom));
    max-width: none;
    text-align: center;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

.preview-loading {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(3, 8, 14, 0.62);
  backdrop-filter: blur(6px);
  pointer-events: none;
}

.preview-loading-card {
  max-width: min(420px, 100%);
  padding: 1.35rem 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(136, 204, 238, 0.28);
  background: rgba(8, 16, 28, 0.94);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.45);
  text-align: center;
}

.preview-loading-spinner {
  width: 36px;
  height: 36px;
  margin: 0 auto 1rem;
  border: 2px solid rgba(136, 204, 238, 0.18);
  border-top-color: #6ec8e8;
  border-radius: 50%;
  animation: preview-spin 0.85s linear infinite;
}

@keyframes preview-spin {
  to {
    transform: rotate(360deg);
  }
}

.preview-loading-title {
  margin: 0;
  color: rgba(228, 240, 248, 0.92);
  font-size: 0.9375rem;
  line-height: 1.55;
}

.preview-loading-meta {
  margin: 0.65rem 0 0;
  color: rgba(180, 210, 224, 0.62);
  font-size: 0.75rem;
}

.loading-enter-active,
.loading-leave-active {
  transition: opacity 0.25s ease;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}
</style>
