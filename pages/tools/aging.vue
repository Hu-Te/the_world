<template>
  <div class="ag-shell" role="presentation" @click.self="goHome">
    <div class="ag-shell__grid" aria-hidden="true" />
    <div class="ag-modal" role="dialog" aria-modal="true" aria-labelledby="ag-title">
      <header class="ag-modal__head">
        <div>
          <div class="ag-modal__eyebrow">
            <span class="ag-modal__code">FIN · AGING</span>
            <span class="ag-modal__badge">FIFO · 坏账计提</span>
          </div>
          <h1 id="ag-title" class="ag-modal__title">往来账龄全息扫描舱</h1>
          <p class="ag-modal__lead">
            序时账投递 → FIFO 冲销队列 → 分桶账龄 / 坏账计提 → 3D 数据岛 · 即传即销
          </p>
        </div>
        <button type="button" class="ag-modal__close" aria-label="关闭" @click="goHome">✕</button>
      </header>
      <div class="ag-modal__body">
        <AgingCabin />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const router = useRouter()

function goHome() {
  router.push('/')
}

function onEsc(e: KeyboardEvent) {
  if (e.key === 'Escape') goHome()
}

onMounted(() => window.addEventListener('keydown', onEsc))
onUnmounted(() => window.removeEventListener('keydown', onEsc))
</script>

<style scoped lang="scss">
.ag-shell {
  @apply fixed inset-0 z-[80] flex items-center justify-center;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
    max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  background: radial-gradient(120% 80% at 50% -10%, #0c1524 0%, #020617 55%, #020617 100%);
}

.ag-shell__grid {
  @apply pointer-events-none absolute inset-0 opacity-[0.1];
  background-image:
    linear-gradient(rgba(56, 189, 248, 0.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(244, 63, 94, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
}

.ag-modal {
  @apply relative flex w-full flex-col overflow-hidden;
  width: min(96rem, 100%);
  height: min(96dvh, 100%);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: clamp(0.65rem, 1.6vw, 1.05rem);
  background: linear-gradient(168deg, rgba(8, 16, 28, 0.98), rgba(2, 6, 23, 0.995));
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.6), 0 0 72px rgba(56, 189, 248, 0.12);
}

.ag-modal__head {
  @apply flex shrink-0 items-start justify-between gap-3 border-b border-white/10;
  padding: clamp(0.85rem, 2.2vw, 1.5rem) clamp(0.85rem, 2.5vw, 2rem);
}

.ag-modal__eyebrow {
  @apply mb-2 flex flex-wrap items-center gap-2.5 font-mono tracking-[0.18em] text-sky-300/80;
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
}

.ag-modal__badge {
  @apply rounded border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 tracking-normal text-sky-100/90;
}

.ag-modal__title {
  @apply font-display font-semibold tracking-wide text-sky-50;
  font-size: clamp(1.25rem, 3.4vw, 1.85rem);
}

.ag-modal__lead {
  @apply mt-1.5 max-w-3xl font-mono leading-relaxed text-white/55;
  font-size: clamp(0.8rem, 1.9vw, 0.95rem);
}

.ag-modal__close {
  @apply rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-sky-400/40 hover:text-sky-100;
  padding: clamp(0.45rem, 1.2vw, 0.65rem) clamp(0.7rem, 1.6vw, 0.9rem);
}

.ag-modal__body {
  @apply flex min-h-0 flex-1 flex-col overflow-hidden;
  min-height: 0;
}
</style>
