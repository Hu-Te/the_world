<template>
  <div class="page-home">
    <section class="page-home__hero">
      <ClientOnly>
        <HomeHeroCanvas @select="openToolbox" />
        <template #fallback>
          <div class="page-home__fallback" aria-hidden="true" />
        </template>
      </ClientOnly>

      <header class="page-home__brand">
        <p class="page-home__eyebrow">工具，也值得被陈列</p>
        <h1 class="page-home__title">{{ config.public.siteName }}</h1>
        <p class="page-home__desc">
          转着看路，点着进门。<br class="page-home__br" />工作上的事，交给它们。
        </p>
      </header>
    </section>

    <Teleport to="body">
      <div
        v-if="toolboxCat"
        class="toolbox"
        role="presentation"
        @click.self="closeToolbox">
        <div
          class="toolbox__panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="toolboxTitleId">
          <header class="toolbox__head">
            <div>
              <p class="toolbox__code">{{ toolboxCat.code }} · 工具箱</p>
              <h2 :id="toolboxTitleId" class="toolbox__title">
                {{ toolboxCat.name }}
              </h2>
              <p class="toolbox__lead">{{ toolboxCat.desc }}</p>
            </div>
            <button
              type="button"
              class="toolbox__close"
              aria-label="关闭"
              @click="closeToolbox">
              ✕
            </button>
          </header>

          <ul class="toolbox__list">
            <li
              v-for="tool in toolboxCat.tools"
              :key="tool.id"
              class="toolbox__item">
              <component
                :is="tool.href ? 'a' : 'div'"
                class="toolbox__card"
                :href="tool.href"
                :target="tool.href ? '_blank' : undefined"
                :rel="tool.href ? 'noopener noreferrer' : undefined">
                <div class="toolbox__card-top">
                  <span class="toolbox__name">{{ tool.name }}</span>
                  <span
                    class="toolbox__badge"
                    :class="`toolbox__badge--${tool.badge}`">
                    {{ tool.badge }}
                  </span>
                </div>
                <p class="toolbox__desc">{{ tool.desc }}</p>
              </component>
            </li>
          </ul>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { getCategory, type ToolCategory } from '~/utils/tools/catalog'

const config = useRuntimeConfig()
const toolboxCat = ref<ToolCategory | null>(null)
const toolboxTitleId = 'home-toolbox-title'

useSeoMeta({
  title: () => config.public.siteName as string,
  description: '体面一点的三维工具展厅。转着看路，点着进门。',
  ogTitle: () => config.public.siteName as string,
})

function openToolbox(id: string) {
  const cat = getCategory(id)
  if (!cat) return
  toolboxCat.value = cat
  document.documentElement.style.overflow = 'hidden'
}

function closeToolbox() {
  toolboxCat.value = null
  document.documentElement.style.overflow = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && toolboxCat.value) closeToolbox()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = ''
})
</script>

<style scoped lang="scss">
.page-home {
  @apply relative h-full;

  &__hero {
    @apply relative isolate h-full overflow-hidden;
  }

  &__fallback {
    @apply absolute inset-0 bg-ink-950;
  }

  &__brand {
    @apply pointer-events-none absolute left-5 top-14 z-[2] max-w-[16rem] sm:left-8 sm:top-16 sm:max-w-sm lg:left-10;
    animation: home-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__eyebrow {
    @apply mb-2.5 text-[0.65rem] tracking-[0.22em] text-slate-500;
  }

  &__title {
    @apply font-display text-[clamp(1.85rem,4.2vw,2.9rem)] font-semibold leading-[0.94] tracking-[-0.04em] text-white;
  }

  &__desc {
    @apply mt-3.5 max-w-[15rem] text-[0.8125rem] leading-relaxed text-slate-400 sm:max-w-[18rem] sm:text-sm;
  }

  &__br {
    @apply hidden sm:block;
  }
}

.toolbox {
  @apply fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6;
  background: rgba(2, 6, 12, 0.62);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: toolbox-fade 0.22s ease-out both;

  &__panel {
    @apply flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-white/10;
    max-height: min(78vh, 36rem);
    background: linear-gradient(165deg, rgba(12, 18, 28, 0.96) 0%, rgba(6, 10, 16, 0.98) 100%);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    animation: toolbox-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__head {
    @apply flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6;
  }

  &__code {
    @apply mb-1.5 font-mono text-[0.65rem] tracking-[0.2em] text-slate-500;
  }

  &__title {
    @apply text-lg font-semibold tracking-wide text-slate-50 sm:text-xl;
  }

  &__lead {
    @apply mt-1.5 text-sm leading-relaxed text-slate-400;
  }

  &__close {
    @apply shrink-0 rounded-md px-2.5 py-1.5 font-mono text-sm text-slate-500 transition;
    @apply hover:bg-white/5 hover:text-cyan-soft;
  }

  &__list {
    @apply overflow-y-auto px-3 py-3 sm:px-4;
  }

  &__item + &__item {
    @apply mt-1.5;
  }

  &__card {
    @apply block rounded-lg border border-white/10 px-4 py-3.5 transition;
    background: rgba(255, 255, 255, 0.02);

    &:hover {
      border-color: rgba(110, 200, 232, 0.28);
      background: rgba(110, 200, 232, 0.05);
    }
  }

  &__card-top {
    @apply flex flex-wrap items-baseline gap-2;
  }

  &__name {
    @apply text-[0.9375rem] font-medium tracking-wide text-slate-100;
  }

  &__badge {
    @apply font-mono text-[0.6rem] tracking-wider;

    &--可用 {
      color: rgba(110, 200, 168, 0.9);
    }

    &--内测 {
      color: rgba(200, 176, 110, 0.9);
    }

    &--筹备中 {
      color: rgba(120, 140, 156, 0.85);
    }
  }

  &__desc {
    @apply mt-1.5 text-sm leading-relaxed text-slate-500;
  }
}

@keyframes home-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@keyframes toolbox-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes toolbox-up {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-home__brand,
  .toolbox,
  .toolbox__panel {
    animation: none;
  }
}
</style>
