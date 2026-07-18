<template>
  <div class="xx-shell" role="presentation" @click.self="goHome">
    <div class="xx-shell__grid" aria-hidden="true" />
    <div class="xx-modal" role="dialog" aria-modal="true" aria-labelledby="xx-title">
      <header class="xx-modal__head">
        <div>
          <div class="xx-modal__eyebrow">
            <span class="xx-modal__code">IND · XML</span>
            <span class="xx-modal__badge">Dom4j · OpenAI · SSE</span>
          </div>
          <h1 id="xx-title" class="xx-modal__title">多语言 XML 自动化翻译舱</h1>
          <p class="xx-modal__lead">
            工业词条包上传 → Dom4j 无损解析 → 分片并发翻译 → 虚拟表对照 → 回写导出
          </p>
        </div>
        <button type="button" class="xx-modal__close" aria-label="关闭" @click="goHome">✕</button>
      </header>
      <div class="xx-modal__body">
        <XmlXlateCabin />
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
.xx-shell {
  @apply fixed inset-0 z-[80] flex items-center justify-center;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
    max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
  background: radial-gradient(120% 80% at 50% -10%, #0a1a22 0%, #020617 55%, #020617 100%);
}

.xx-shell__grid {
  @apply pointer-events-none absolute inset-0 opacity-[0.1];
  background-image:
    linear-gradient(rgba(34, 211, 238, 0.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
}

.xx-modal {
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

.xx-modal__head {
  @apply flex shrink-0 items-start justify-between gap-3 border-b border-white/10;
  padding: clamp(0.85rem, 2.2vw, 1.5rem) clamp(0.85rem, 2.5vw, 2rem);
}

.xx-modal__eyebrow {
  @apply mb-2 flex flex-wrap items-center gap-2.5 font-mono tracking-[0.18em] text-cyan-300/80;
  font-size: clamp(0.65rem, 1.6vw, 0.75rem);
}

.xx-modal__badge {
  @apply rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 tracking-normal text-cyan-100/90;
}

.xx-modal__title {
  font-family: 'IBM Plex Sans SC', 'PingFang SC', sans-serif;
  font-size: clamp(1.15rem, 2.4vw, 1.45rem);
  font-weight: 650;
  letter-spacing: 0.04em;
  color: #ecfeff;
}

.xx-modal__lead {
  margin-top: 0.35rem;
  max-width: 40rem;
  font-size: 0.86rem;
  line-height: 1.55;
  color: rgba(186, 230, 253, 0.55);
}

.xx-modal__close {
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.03);
  padding: 0.35rem 0.65rem;
  color: rgba(226, 232, 240, 0.7);
  transition:
    border-color 0.15s,
    color 0.15s,
    background 0.15s;

  &:hover {
    border-color: rgba(34, 211, 238, 0.45);
    background: rgba(34, 211, 238, 0.08);
    color: #cffafe;
  }
}

.xx-modal__body {
  @apply min-h-0 flex-1 overflow-hidden;
}
</style>
