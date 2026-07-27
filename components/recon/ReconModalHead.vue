<template>
  <header class="recon-modal__head">
    <div class="recon-modal__brand">
      <div class="recon-modal__eyebrow">
        <span class="recon-modal__code">FIN · RECON</span>
        <span class="recon-modal__pulse" aria-hidden="true" />
        <span class="recon-modal__badge">智能校对 · 自动</span>
        <span v-if="taskId" class="recon-modal__taskid">#{{ taskId }}</span>
      </div>
      <div class="recon-modal__title-row">
        <h1 id="recon-modal-title" class="recon-modal__title">
          {{ title || '银行存款勾稽' }}
        </h1>
        <nav v-if="!taskId" class="recon-modal__samples">
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
        v-if="taskId"
        type="button"
        class="recon-btn recon-btn--ghost"
        :disabled="busy"
        @click="emit('toggle-setup')">
        {{ setupOpen ? '收起配置' : '配置' }}
      </button>
      <button
        v-if="taskId"
        type="button"
        class="recon-btn recon-btn--ghost"
        :disabled="busy"
        @click="emit('remove')">
        删除
      </button>
      <button type="button" class="recon-modal__close" aria-label="关闭" @click="emit('close')">
        ✕
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title?: string | null
  taskId?: string | number | null
  busy?: boolean
  setupOpen?: boolean
}>()

const emit = defineEmits<{
  'toggle-setup': []
  remove: []
  close: []
}>()
</script>
