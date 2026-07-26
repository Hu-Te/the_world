<template>
  <div class="fp-shell" role="presentation" @click.self="goHome">
    <div class="fp-shell__grid" aria-hidden="true" />
    <div class="fp-modal" role="dialog" aria-modal="true" aria-labelledby="fp-title">
      <header class="fp-modal__head">
        <div>
          <div class="fp-modal__eyebrow">
            <span class="fp-modal__code">IND · S7</span>
            <span class="fp-modal__badge">PLC4X · Netty · WS</span>
          </div>
          <h1 id="fp-title" class="fp-modal__title">工脉监听舱</h1>
          <p class="fp-modal__lead">
            西门子 S7 直连 / 批量读 → 连接缓存 → 200ms 节流推送 → 实时点表与本地报警
          </p>
        </div>
        <button type="button" class="fp-modal__close" aria-label="关闭" @click="goHome">✕</button>
      </header>
      <div class="fp-modal__body">
        <FieldPulseCabin />
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
.fp-shell {
  @apply fixed inset-0 z-[80] flex items-center justify-center;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
    max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  background: radial-gradient(120% 80% at 50% -10%, #0a1a22 0%, #020617 55%, #020617 100%);
}

.fp-shell__grid {
  @apply pointer-events-none absolute inset-0 opacity-[0.1];
  background-image:
    linear-gradient(rgba(34, 211, 238, 0.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
}

.fp-modal {
  @apply relative flex w-full flex-col overflow-hidden;
  width: min(96rem, 100%);
  height: min(96dvh, 100%);
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-radius: clamp(0.65rem, 1.6vw, 1.05rem);
  background: linear-gradient(168deg, rgba(6, 20, 28, 0.98), rgba(2, 6, 23, 0.995));
  box-shadow:
    0 28px 80px rgba(0, 0, 0, 0.6),
    0 0 72px rgba(34, 211, 238, 0.12);
}

.fp-modal__head {
  @apply flex shrink-0 items-start justify-between gap-3 border-b border-white/10;
  padding: clamp(0.85rem, 2.2vw, 1.5rem) clamp(0.85rem, 2.5vw, 2rem);
}

.fp-modal__eyebrow {
  @apply mb-2 flex flex-wrap items-center gap-2.5 font-mono tracking-[0.18em] text-cyan-300/80;
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
}

.fp-modal__badge {
  @apply rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 tracking-[0.12em] text-cyan-200/90;
}

.fp-modal__code {
  @apply text-cyan-400/90;
}

.fp-modal__title {
  @apply font-semibold tracking-wide text-cyan-50;
  font-size: clamp(1.25rem, 3vw, 1.75rem);
}

.fp-modal__lead {
  @apply mt-1 max-w-3xl text-sm leading-relaxed text-slate-400;
}

.fp-modal__close {
  @apply rounded border border-white/15 bg-white/5 px-3 py-1.5 text-slate-200 hover:bg-white/10;
}

.fp-modal__body {
  @apply min-h-0 flex-1 overflow-hidden p-3;
}
</style>
