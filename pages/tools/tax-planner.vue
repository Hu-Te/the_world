<template>
  <div class="tp-shell" role="presentation" @click.self="goHome">
    <div class="tp-shell__grid" aria-hidden="true" />
    <div class="tp-modal" role="dialog" aria-modal="true" aria-labelledby="tp-title">
      <div class="tp-modal__glow" aria-hidden="true" />
      <header class="tp-modal__head">
        <div>
          <div class="tp-modal__eyebrow">
            <span class="tp-modal__code">FIN · TAXSCAN</span>
            <span class="tp-modal__pulse" aria-hidden="true" />
            <span class="tp-modal__badge">红利扫描 · 合规筹划</span>
          </div>
          <h1 id="tp-title" class="tp-modal__title">税收红利全息扫描与合规筹划舱</h1>
          <p class="tp-modal__lead">
            科目余额表投递 → 规则引擎（小微红线 / 招待费限额 / 研发加计）→ 智能合规策略 · 即传即销
          </p>
        </div>
        <button type="button" class="tp-modal__close" aria-label="关闭" @click="goHome">✕</button>
      </header>
      <div class="tp-modal__body">
        <TaxPlannerCabin />
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
.tp-shell {
  @apply fixed inset-0 z-[80] flex items-center justify-center;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
    max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  background: radial-gradient(120% 80% at 50% -10%, #0c1a16 0%, #020617 55%, #020617 100%);
}

.tp-shell__grid {
  @apply pointer-events-none absolute inset-0 opacity-[0.1];
  background-image:
    linear-gradient(rgba(16, 185, 129, 0.25) 1px, transparent 1px),
    linear-gradient(90deg, rgba(244, 63, 94, 0.12) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse 65% 55% at 50% 42%, #000 15%, transparent 72%);
}

.tp-modal {
  @apply relative flex w-full flex-col overflow-hidden;
  width: min(96rem, 100%);
  height: min(96dvh, 100%);
  max-height: min(96dvh, 100%);
  border: 1px solid rgba(16, 185, 129, 0.35);
  border-radius: clamp(0.65rem, 1.6vw, 1.05rem);
  background: linear-gradient(168deg, rgba(8, 20, 18, 0.98), rgba(2, 6, 23, 0.995));
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 28px 80px rgba(0, 0, 0, 0.6),
    0 0 72px rgba(16, 185, 129, 0.12);
}

.tp-modal__glow {
  @apply pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full;
  background: radial-gradient(circle, rgba(16, 185, 129, 0.28), transparent 70%);
  filter: blur(12px);
}

.tp-modal__head {
  @apply relative z-[1] flex shrink-0 items-start justify-between gap-3 border-b border-white/10;
  padding: clamp(0.85rem, 2.2vw, 1.5rem) clamp(0.85rem, 2.5vw, 2rem);
}

.tp-modal__eyebrow {
  @apply mb-2 flex flex-wrap items-center gap-2.5 font-mono tracking-[0.18em] text-emerald-300/80;
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
}

.tp-modal__pulse {
  @apply inline-block h-1.5 w-1.5 rounded-full bg-emerald-400;
  box-shadow: 0 0 10px #34d399;
  animation: tp-pulse 1.6s ease-in-out infinite;
}

.tp-modal__badge {
  @apply rounded border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 tracking-normal text-emerald-100/90;
}

.tp-modal__title {
  @apply font-display font-semibold tracking-wide text-emerald-50;
  font-size: clamp(1.25rem, 3.4vw, 1.85rem);
  text-shadow: 0 0 24px rgba(16, 185, 129, 0.35);
}

.tp-modal__lead {
  @apply mt-1.5 max-w-3xl font-mono leading-relaxed text-white/55;
  font-size: clamp(0.8rem, 1.9vw, 0.95rem);
}

.tp-modal__close {
  @apply rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-emerald-400/40 hover:text-emerald-100;
  padding: clamp(0.45rem, 1.2vw, 0.65rem) clamp(0.7rem, 1.6vw, 0.9rem);
}

.tp-modal__body {
  @apply relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden;
}

@keyframes tp-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.25);
  }
}
</style>
