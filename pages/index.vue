<template>
  <div class="page-home">
    <section class="page-home__hero">
      <ClientOnly>
        <HomeHeroCanvas
          ref="canvasRef"
          @drill-open="onDrillOpen"
          @drill-close="onDrillClose"
          @select-tool="onSelectTool" />
        <template #fallback>
          <div class="page-home__fallback" aria-hidden="true" />
        </template>
      </ClientOnly>

      <header v-show="!drillCat" class="page-home__brand">
        <p class="page-home__eyebrow">
          <span>精密工具</span>
          <i aria-hidden="true" />
          <span>即开即用</span>
        </p>
        <h1 class="page-home__title">{{ config.public.siteName }}</h1>
        <p class="page-home__lead">把校对、核算与检索，放进一条轨道。</p>
        <ul class="page-home__traits" aria-label="产品特点">
          <li>
            <em>01</em>
            <span>浏览器直达，零安装</span>
          </li>
          <li>
            <em>02</em>
            <span>行业分舱，场景即选</span>
          </li>
          <li>
            <em>03</em>
            <span>智能校对，结果可核</span>
          </li>
        </ul>
      </header>

      <aside v-if="drillCat" class="page-home__hud" role="status" aria-live="polite">
        <div class="page-home__hud-text">
          <p class="page-home__hud-code">{{ drillCat.code }} · {{ drillCat.name }}</p>
          <p class="page-home__hud-desc">{{ drillCat.desc }}</p>
        </div>
        <button type="button" class="page-home__hud-back" @click="closeDrill">返回</button>
      </aside>

      <p v-if="tip" class="page-home__tip" role="status">
        {{ tip }}
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { getCategory, type ToolCategory, type ToolItem } from '~/utils/tools/catalog'

const config = useRuntimeConfig()
const canvasRef = ref<{ closeDrill: () => void } | null>(null)
const drillCat = ref<ToolCategory | null>(null)
const tip = ref('')
let tipTimer = 0

useSeoMeta({
  title: () => config.public.siteName as string,
  description: '深空测控：浏览器直达的精密工具测控台。行业分舱选型，校对与核算结果可核。',
  ogTitle: () => config.public.siteName as string,
})

function onDrillOpen(id: string) {
  tip.value = ''
  window.clearTimeout(tipTimer)
  drillCat.value = getCategory(id) ?? null
}

function onDrillClose() {
  tip.value = ''
  window.clearTimeout(tipTimer)
  drillCat.value = null
}

function closeDrill() {
  canvasRef.value?.closeDrill()
}

function onSelectTool(tool: ToolItem) {
  if (tool.href?.startsWith('/')) {
    void navigateTo(tool.href)
    return
  }
  if (tool.href) return
  tip.value = `${tool.name} · ${tool.badge}`
  window.clearTimeout(tipTimer)
  tipTimer = window.setTimeout(() => {
    tip.value = ''
  }, 1600)
}

onUnmounted(() => {
  window.clearTimeout(tipTimer)
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
    @apply pointer-events-none absolute left-5 top-6 z-[2] max-w-[17.5rem] sm:left-8 sm:top-8 sm:max-w-[20rem] lg:left-10;
    animation: home-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__eyebrow {
    @apply mb-3 flex items-center gap-2 font-mono text-[0.62rem] tracking-[0.2em] text-cyan-soft/70;

    i {
      @apply h-px w-4 bg-cyan-soft/40;
    }
  }

  &__title {
    @apply font-display text-[clamp(2rem,4.6vw,3.1rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-white;
    text-shadow: 0 0 40px rgba(110, 200, 232, 0.12);
  }

  &__lead {
    @apply mt-3.5 max-w-[18rem] text-[0.875rem] leading-[1.65] text-slate-300/90;
  }

  &__traits {
    @apply mt-5 space-y-2 border-l border-white/10 pl-3.5;

    li {
      @apply flex items-baseline gap-2.5;
      animation: home-in 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;

      &:nth-child(1) {
        animation-delay: 0.12s;
      }
      &:nth-child(2) {
        animation-delay: 0.2s;
      }
      &:nth-child(3) {
        animation-delay: 0.28s;
      }
    }

    em {
      @apply shrink-0 font-mono text-[0.58rem] not-italic tracking-[0.14em] text-cyan-soft/55;
    }

    span {
      @apply text-[0.75rem] leading-snug tracking-wide text-slate-400;
    }
  }

  &__hud {
    @apply pointer-events-auto absolute left-5 top-6 z-[3] flex max-w-[min(20rem,calc(100vw-5rem))] items-start gap-4 sm:left-8 sm:top-8 lg:left-10;
    animation: home-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__hud-code {
    @apply font-mono text-[0.68rem] tracking-[0.16em] text-cyan-soft/90;
  }

  &__hud-desc {
    @apply mt-1.5 text-sm leading-relaxed text-slate-400;
  }

  &__hud-back {
    @apply shrink-0 border-b border-cyan-soft/40 pb-0.5 font-mono text-[0.68rem] tracking-[0.18em] text-slate-300 transition;
    @apply hover:border-cyan-soft hover:text-cyan-soft;
  }

  &__tip {
    @apply pointer-events-none absolute bottom-16 left-1/2 z-[3] -translate-x-1/2 font-mono text-[0.7rem] tracking-[0.14em] text-slate-300;
    text-shadow: 0 0 20px rgba(110, 200, 232, 0.25);
    animation: home-in 0.25s ease-out both;
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

@media (prefers-reduced-motion: reduce) {
  .page-home__brand,
  .page-home__hud,
  .page-home__tip,
  .page-home__traits li {
    animation: none;
  }
}
</style>
