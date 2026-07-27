<template>
  <header class="fp-bar">
    <div class="fp-bar__chips">
      <span class="fp-chip">
        <span :class="['fp-dot', `fp-dot--${wsStatus}`]" />
        WS {{ wsStatus }}
      </span>
      <span
        class="fp-chip"
        :class="session?.connected ? 'fp-chip--ok' : session ? 'fp-chip--warn' : ''">
        {{
          session
            ? `${lifecycleLabel} · ${session.connected ? '已连接' : '未连接'}`
            : '未开会话'
        }}
      </span>
      <span v-if="protocol === 'S7'" class="fp-chip">
        代理 {{ agentId || '直连' }}
        <template v-if="agentCount">· 在线 {{ agentCount }}</template>
      </span>
      <span class="fp-chip fp-chip--muted">{{ previewDeviceId }}</span>
      <span class="fp-chip fp-chip--muted">点位 {{ tagCount }}</span>
    </div>
    <div class="fp-bar__actions">
      <button type="button" class="fp-btn fp-btn--sm" :disabled="busy" @click="$emit('open')">
        启动
      </button>
      <button
        type="button"
        class="fp-btn fp-btn--ghost fp-btn--sm"
        :disabled="!session || busy"
        @click="$emit('close')">
        停止
      </button>
      <button
        type="button"
        class="fp-btn fp-btn--accent fp-btn--sm"
        :disabled="busy || protocol !== 'S7'"
        @click="$emit('batch-read')">
        单次读
      </button>
      <button
        type="button"
        class="fp-btn fp-btn--ghost fp-btn--sm"
        :disabled="busy"
        title="导出连接与点位配置为 JSON"
        @click="$emit('export')">
        导出
      </button>
      <button
        type="button"
        class="fp-btn fp-btn--ghost fp-btn--sm"
        :disabled="busy"
        title="从 JSON 导入配置"
        @click="$emit('import')">
        导入
      </button>
      <button
        type="button"
        class="fp-btn fp-btn--ghost fp-btn--sm"
        :class="{ 'fp-btn--on': showSide }"
        @click="$emit('toggle-side')">
        {{ showSide ? '收起配置' : '配置' }}
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  wsStatus: string
  session: { connected?: boolean; lifecycleState?: string } | null
  lifecycleLabel: string
  protocol: string
  agentId: string
  agentCount: number
  previewDeviceId: string
  tagCount: number
  busy: boolean
  showSide: boolean
}>()

defineEmits<{
  open: []
  close: []
  'batch-read': []
  export: []
  import: []
  'toggle-side': []
}>()
</script>

<style scoped lang="scss">
.fp-bar {
  @apply flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-400/25 bg-slate-950/70 px-2.5 py-2;
}
.fp-bar__chips {
  @apply flex min-w-0 flex-wrap items-center gap-1.5;
}
.fp-bar__actions {
  @apply flex flex-wrap items-center gap-1.5;
}
.fp-chip {
  @apply inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.68rem] text-slate-300;
}
.fp-chip--ok {
  @apply border-emerald-400/35 bg-emerald-500/10 text-emerald-200;
}
.fp-chip--warn {
  @apply border-amber-400/35 bg-amber-500/10 text-amber-100;
}
.fp-chip--muted {
  @apply text-slate-500;
}
.fp-dot {
  @apply inline-block h-1.5 w-1.5 rounded-full bg-slate-500;
}
.fp-dot--open {
  @apply bg-emerald-400;
}
.fp-dot--connecting,
.fp-dot--reconnecting {
  @apply bg-amber-400;
}
.fp-btn {
  @apply rounded border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-1 font-mono text-[0.72rem] text-cyan-100;
}
.fp-btn--sm {
  @apply px-2 py-0.5 text-[0.68rem];
}
.fp-btn--ghost {
  @apply border-white/15 bg-white/5 text-slate-200;
}
.fp-btn--accent {
  @apply border-emerald-400/40 bg-emerald-500/15 text-emerald-100;
}
.fp-btn--on {
  @apply border-cyan-300/50 bg-cyan-400/20;
}
.fp-btn:disabled {
  @apply cursor-not-allowed opacity-40;
}
</style>
