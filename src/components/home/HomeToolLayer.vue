<script setup lang="ts">
import { useHomeTools } from '@/composables/useHomeTools'
import { FILE_PREVIEW_ACCEPT } from '@/utils/filePreview'
import HomeFilePreview from '@/components/home/HomeFilePreview.vue'

const {
  toast,
  zipExtractRef,
  filePreviewRef,
  previewOpen,
  previewState,
  onZipExtract,
  onFilePreview,
  closePreview,
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

  <Transition name="toast">
    <p v-if="toast" class="tool-toast" role="status">{{ toast }}</p>
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
</style>
