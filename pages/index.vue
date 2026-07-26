<template>
  <div class="page-home">
    <!-- 不用 ClientOnly：登录必须进 SSR/首屏，否则右上角会一直空 -->
    <IamCornerPortal @open="onIamOpen" />
    <ClientOnly>
      <IamLoginModal v-model:open="openLogin" @success="onLoginSuccess" @close="openLogin = false" />
      <IamSystemSelectModal v-model:open="openSystems" @close="openSystems = false" />
    </ClientOnly>

    <section class="page-home__hero">
      <!-- 壳层常驻：Three 下载期间不能被空 canvas 盖掉 -->
      <div
        class="page-home__fallback"
        :class="{ 'is-gone': heroReady }"
        aria-hidden="true">
        <div class="page-home__fallback-orbit" />
        <div class="page-home__fallback-core" />
      </div>
      <ClientOnly>
        <HomeHeroCanvas
          ref="canvasRef"
          @ready="heroReady = true"
          @drill-open="onDrillOpen"
          @drill-close="onDrillClose"
          @select-tool="onSelectTool" />
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
import IamCornerPortal from '~/components/iam/CornerPortal.vue'
import { getCategory, type ToolCategory, type ToolItem } from '~/utils/tools/catalog'

const IamLoginModal = defineAsyncComponent(() => import('~/components/iam/LoginModal.vue'))
const IamSystemSelectModal = defineAsyncComponent(
  () => import('~/components/iam/SystemSelectModal.vue'),
)

const SITE_DESC = '深空测控：浏览器直达的精密工具测控台。行业分舱选型，校对与核算结果可核。'

const config = useRuntimeConfig()
const siteName = computed(() => String(config.public.siteName ?? ''))
const auth = useAuthStore()

const canvasRef = ref<{ closeDrill: () => void } | null>(null)
const drillCat = ref<ToolCategory | null>(null)
const tip = ref('')
const heroReady = ref(false)

// 首页 JS 一跑就预拉 Three，与 hydration 并行
if (import.meta.client) {
  void import('~/utils/web3d/HomeHeroManager')
}
const openLogin = ref(false)
const openSystems = ref(false)
let tipTimer = 0

useSeoMeta({
  title: () => siteName.value,
  description: SITE_DESC,
  ogTitle: () => siteName.value,
})

const clearTip = () => {
  tip.value = ''
  window.clearTimeout(tipTimer)
}

const showTip = (message: string, ms = 1600) => {
  clearTip()
  tip.value = message
  tipTimer = window.setTimeout(clearTip, ms)
}

const onDrillOpen = (id: string) => {
  clearTip()
  drillCat.value = getCategory(id) ?? null
}

const onDrillClose = () => {
  clearTip()
  drillCat.value = null
}

const closeDrill = () => {
  canvasRef.value?.closeDrill()
}

const onSelectTool = (tool: ToolItem) => {
  const href = tool.href
  if (href?.startsWith('/')) {
    void navigateTo(href)
    return
  }
  if (href) return
  showTip(`${tool.name} · ${tool.badge}`)
}

/** 右上角「登录」：未登录弹登录窗，已登录弹二级系统选择 */
function onIamOpen() {
  auth.hydrate()
  if (auth.isLoggedIn) openSystems.value = true
  else openLogin.value = true
}

function onLoginSuccess() {
  openSystems.value = true
}

onMounted(() => auth.hydrate())
onUnmounted(clearTip)
</script>

<style scoped lang="scss">
.page-home {
  @apply relative h-full;

  &__hero {
    @apply relative isolate h-full overflow-hidden;
  }

  &__fallback {
    @apply absolute inset-0 z-0 bg-ink-950;
    background:
      radial-gradient(ellipse 70% 55% at 50% 42%, rgba(14, 40, 58, 0.55) 0%, transparent 70%),
      radial-gradient(ellipse 100% 80% at 50% 100%, rgba(3, 8, 14, 1) 0%, #03080e 100%);
    transition: opacity 0.4s ease;
    pointer-events: none;

    &.is-gone {
      opacity: 0;
    }
  }

  &__fallback-orbit {
    @apply absolute left-1/2 top-[46%] h-[min(52vw,28rem)] w-[min(52vw,28rem)] -translate-x-1/2 -translate-y-1/2;
    border-radius: 50%;
    border: 1px solid rgba(110, 200, 232, 0.14);
    box-shadow:
      inset 0 0 60px rgba(110, 200, 232, 0.05),
      0 0 0 22px rgba(110, 200, 232, 0.03),
      0 0 90px rgba(110, 200, 232, 0.08);
  }

  &__fallback-core {
    @apply absolute left-1/2 top-[46%] h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full;
    background: radial-gradient(circle, rgba(110, 200, 232, 0.35) 0%, rgba(110, 200, 232, 0.08) 45%, transparent 70%);
    box-shadow: 0 0 48px rgba(110, 200, 232, 0.22);
  }

  &__brand {
    @apply pointer-events-none absolute left-5 top-6 z-[2] max-w-[17.5rem];
    @apply sm:left-8 sm:top-8 sm:max-w-[20rem] lg:left-10;
    animation: home-in 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__eyebrow {
    @apply mb-3 flex items-center gap-2 font-mono text-[0.62rem];
    @apply tracking-[0.2em] text-cyan-soft/70;

    i {
      @apply h-px w-4 bg-cyan-soft/40;
    }
  }

  &__title {
    @apply font-display text-[clamp(2rem,4.6vw,3.1rem)] font-semibold;
    @apply leading-[0.92] tracking-[-0.045em] text-white;
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
      @apply shrink-0 font-mono text-[0.58rem] not-italic;
      @apply tracking-[0.14em] text-cyan-soft/55;
    }

    span {
      @apply text-[0.75rem] leading-snug tracking-wide text-slate-400;
    }
  }

  &__hud {
    @apply pointer-events-auto absolute left-5 top-6 z-[3] flex;
    @apply max-w-[min(20rem,calc(100vw-5rem))] items-start gap-4;
    @apply sm:left-8 sm:top-8 lg:left-10;
    animation: home-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__hud-code {
    @apply font-mono text-[0.68rem] tracking-[0.16em] text-cyan-soft/90;
  }

  &__hud-desc {
    @apply mt-1.5 text-sm leading-relaxed text-slate-400;
  }

  &__hud-back {
    @apply shrink-0 border-b border-cyan-soft/40 pb-0.5 font-mono;
    @apply text-[0.68rem] tracking-[0.18em] text-slate-300 transition;
    @apply hover:border-cyan-soft hover:text-cyan-soft;
  }

  &__tip {
    @apply pointer-events-none absolute bottom-16 left-1/2 z-[3];
    @apply -translate-x-1/2 font-mono text-[0.7rem] tracking-[0.14em] text-slate-300;
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

@keyframes home-pulse {
  0%,
  100% {
    opacity: 0.55;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 0.9;
    transform: translate(-50%, -50%) scale(1.03);
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
