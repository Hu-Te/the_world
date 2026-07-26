<template>
  <div class="sp-shell" role="presentation" @click.self="goHome">
    <div class="sp-shell__grid" aria-hidden="true" />
    <div class="sp-modal" role="dialog" aria-modal="true" aria-labelledby="sp-title">
      <header class="sp-modal__head">
        <div>
          <div class="sp-modal__eyebrow">
            <span class="sp-modal__code">COM · PACK</span>
            <span class="sp-modal__badge">OCR · AI · Three.js</span>
          </div>
          <h1 id="sp-title" class="sp-modal__title">软包装 3D 打样</h1>
        </div>
        <button type="button" class="sp-modal__close" aria-label="关闭" @click="goHome">✕</button>
      </header>
      <div class="sp-modal__body">
        <SoftPackCabin />
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
.sp-shell {
  @apply fixed inset-0 z-[80] flex items-center justify-center;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
    max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  background: radial-gradient(120% 80% at 50% -10%, #0a1a22 0%, #020617 55%, #020617 100%);
}
.sp-shell__grid {
  @apply pointer-events-none absolute inset-0 opacity-[0.1];
  background-image:
    linear-gradient(rgba(34, 211, 238, 0.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
}
.sp-modal {
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
.sp-modal__head {
  @apply flex shrink-0 items-center justify-between gap-3 border-b border-white/10;
  padding: 0.65rem 1rem;
}
.sp-modal__eyebrow {
  @apply mb-0.5 flex flex-wrap items-center gap-2 font-mono tracking-[0.16em] text-cyan-300/80;
  font-size: 0.65rem;
}
.sp-modal__badge {
  @apply rounded border border-cyan-400/30 px-1.5 py-0.5 text-[0.6rem] tracking-normal text-cyan-200/70;
}
.sp-modal__title {
  @apply font-semibold tracking-wide text-cyan-50;
  font-size: clamp(1.05rem, 2.4vw, 1.35rem);
}
.sp-modal__close {
  @apply rounded border border-white/15 bg-white/5 px-2.5 py-1 text-sm text-slate-300 hover:bg-white/10;
}
.sp-modal__body {
  @apply min-h-0 flex-1 overflow-hidden p-2.5;
}
</style>
