<template>
  <div class="page-home">
    <!-- 不用 ClientOnly：登录必须进 SSR/首屏，否则右上角会一直空 -->
    <IamCornerPortal @open="onIamOpen" />
    <ClientOnly>
      <IamLoginModal
        v-model:open="openLogin"
        @success="onLoginSuccess"
        @close="openLogin = false" />
      <IamSystemSelectModal v-model:open="openSystems" @close="openSystems = false" />
    </ClientOnly>

    <section class="page-home__hero">
      <!-- 壳层常驻：Three 就绪前的深空测控加载首屏 -->
      <div class="page-home__fallback" :class="{ 'is-gone': heroReady }" aria-hidden="true">
        <div class="page-home__fallback-stars" />
        <div class="page-home__fallback-nebula" />
        <div class="page-home__fallback-grid" />
        <div class="page-home__fallback-vignette" />
        <div class="page-home__fallback-glow" />
        <div class="page-home__fallback-stage">
          <span class="page-home__fallback-bracket page-home__fallback-bracket--tl" />
          <span class="page-home__fallback-bracket page-home__fallback-bracket--tr" />
          <span class="page-home__fallback-bracket page-home__fallback-bracket--bl" />
          <span class="page-home__fallback-bracket page-home__fallback-bracket--br" />
          <span class="page-home__fallback-ring page-home__fallback-ring--a" />
          <span class="page-home__fallback-ring page-home__fallback-ring--b" />
          <span class="page-home__fallback-ring page-home__fallback-ring--c" />
          <span class="page-home__fallback-ring page-home__fallback-ring--ticks" />
          <span class="page-home__fallback-sweep" />
          <span class="page-home__fallback-cross" />
          <span class="page-home__fallback-core" />
          <span class="page-home__fallback-pulse" />
          <span class="page-home__fallback-pulse page-home__fallback-pulse--late" />
        </div>
        <div class="page-home__fallback-telemetry">
          <p class="page-home__fallback-status">
            <span class="page-home__fallback-dot" />
            深度链路校准中
          </p>
          <div class="page-home__fallback-bar" role="presentation">
            <i />
          </div>
          <p class="page-home__fallback-meta">
            <span>RADAR LOCK</span>
            <span>SYNC · STANDBY</span>
          </p>
        </div>
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
          <span>精密测控</span>
          <i aria-hidden="true" />
          <span>即开即用</span>
        </p>
        <h1 class="page-home__title">{{ config.public.siteName }}</h1>
        <p class="page-home__lead">校对、核算与检索，汇于同一副控舱。</p>
        <ul class="page-home__traits" aria-label="产品特点">
          <li>
            <em>01</em>
            <span>网页直达，零安装</span>
          </li>
          <li>
            <em>02</em>
            <span>行业分舱，一键入位</span>
          </li>
          <li>
            <em>03</em>
            <span>智能核验，结果可溯</span>
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

const SITE_DESC = '深空测控：浏览器直达的精密测控台。行业分舱入位，校对与核算结果可溯。'

const config = useRuntimeConfig()
const siteName = computed(() => String(config.public.siteName ?? ''))
const auth = useAuthStore()

const canvasRef = ref<{ closeDrill: () => void } | null>(null)
const drillCat = ref<ToolCategory | null>(null)
const tip = ref('')
const heroReady = ref(false)

// Three 改由 HomeHeroCanvas 首帧后再拉，避免抢 FCP 带宽
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
    @apply absolute inset-0 z-0;
    pointer-events: none;
    overflow: hidden;
    background:
      radial-gradient(ellipse 48% 38% at 50% 46%, rgba(18, 72, 96, 0.55) 0%, transparent 70%),
      radial-gradient(ellipse 70% 50% at 18% 22%, rgba(14, 80, 110, 0.14) 0%, transparent 55%),
      radial-gradient(ellipse 80% 55% at 82% 18%, rgba(45, 160, 180, 0.1) 0%, transparent 50%),
      radial-gradient(ellipse 100% 90% at 50% 100%, #01040a 0%, #00050a 55%, #000208 100%);
    transition:
      opacity 0.7s ease,
      visibility 0.7s ease;

    &.is-gone {
      opacity: 0;
      visibility: hidden;
    }
  }

  &__fallback-stars {
    @apply absolute inset-0;
    opacity: 0.85;
    background-image:
      radial-gradient(1px 1px at 12% 18%, rgba(236, 254, 255, 0.7), transparent),
      radial-gradient(1px 1px at 28% 62%, rgba(165, 243, 252, 0.55), transparent),
      radial-gradient(1.5px 1.5px at 44% 24%, rgba(255, 255, 255, 0.45), transparent),
      radial-gradient(1px 1px at 63% 71%, rgba(110, 200, 232, 0.5), transparent),
      radial-gradient(1px 1px at 78% 32%, rgba(236, 254, 255, 0.55), transparent),
      radial-gradient(1.5px 1.5px at 88% 58%, rgba(165, 243, 252, 0.4), transparent),
      radial-gradient(1px 1px at 8% 78%, rgba(255, 255, 255, 0.35), transparent),
      radial-gradient(1px 1px at 52% 12%, rgba(110, 200, 232, 0.45), transparent),
      radial-gradient(1px 1px at 35% 88%, rgba(236, 254, 255, 0.35), transparent),
      radial-gradient(1.5px 1.5px at 70% 8%, rgba(255, 255, 255, 0.4), transparent);
    animation: home-twinkle 5.5s ease-in-out infinite;
  }

  &__fallback-nebula {
    @apply absolute inset-0;
    background:
      radial-gradient(ellipse 42% 28% at 50% 48%, rgba(45, 212, 191, 0.07), transparent 70%),
      radial-gradient(ellipse 30% 22% at 62% 40%, rgba(56, 189, 248, 0.06), transparent 65%);
    filter: blur(18px);
  }

  &__fallback-grid {
    @apply absolute inset-0;
    opacity: 0.28;
    background-image:
      linear-gradient(rgba(110, 200, 232, 0.09) 1px, transparent 1px),
      linear-gradient(90deg, rgba(110, 200, 232, 0.09) 1px, transparent 1px);
    background-size: 56px 56px;
    mask-image: radial-gradient(ellipse 58% 52% at 50% 46%, #000 12%, transparent 78%);
    transform: perspective(600px) rotateX(42deg) scale(1.35);
    transform-origin: 50% 55%;
  }

  &__fallback-vignette {
    @apply absolute inset-0;
    background:
      radial-gradient(ellipse 70% 60% at 50% 45%, transparent 40%, rgba(0, 2, 8, 0.55) 100%),
      linear-gradient(
        180deg,
        rgba(0, 2, 8, 0.35) 0%,
        transparent 22%,
        transparent 70%,
        rgba(0, 2, 8, 0.65) 100%
      );
  }

  &__fallback-glow {
    @apply absolute left-1/2 top-[44%] h-[min(78vw,40rem)] w-[min(78vw,40rem)] -translate-x-1/2 -translate-y-1/2;
    border-radius: 50%;
    background: radial-gradient(
      circle,
      rgba(94, 234, 212, 0.18) 0%,
      rgba(56, 189, 248, 0.08) 32%,
      rgba(14, 80, 110, 0.04) 52%,
      transparent 70%
    );
    filter: blur(1px);
    animation: home-glow 4s ease-in-out infinite;
  }

  &__fallback-stage {
    @apply absolute left-1/2 top-[46%] h-[min(56vw,28rem)] w-[min(56vw,28rem)] -translate-x-1/2 -translate-y-1/2;
  }

  &__fallback-bracket {
    @apply absolute;
    width: 1.35rem;
    height: 1.35rem;
    border-color: rgba(94, 234, 212, 0.55);
    border-style: solid;
    border-width: 0;
    opacity: 0.75;

    &--tl {
      top: -0.4rem;
      left: -0.4rem;
      border-top-width: 1.5px;
      border-left-width: 1.5px;
    }
    &--tr {
      top: -0.4rem;
      right: -0.4rem;
      border-top-width: 1.5px;
      border-right-width: 1.5px;
    }
    &--bl {
      bottom: -0.4rem;
      left: -0.4rem;
      border-bottom-width: 1.5px;
      border-left-width: 1.5px;
    }
    &--br {
      bottom: -0.4rem;
      right: -0.4rem;
      border-bottom-width: 1.5px;
      border-right-width: 1.5px;
    }
  }

  &__fallback-ring {
    @apply absolute inset-0 rounded-full;
    border: 1px solid rgba(110, 200, 232, 0.16);
    box-shadow: inset 0 0 40px rgba(110, 200, 232, 0.04);

    &--a {
      animation: home-orbit 18s linear infinite;
      border-top-color: rgba(165, 243, 252, 0.65);
      border-right-color: rgba(110, 200, 232, 0.08);
      box-shadow:
        inset 0 0 50px rgba(110, 200, 232, 0.05),
        0 0 30px rgba(45, 212, 191, 0.06);
    }
    &--b {
      inset: 11%;
      border-color: rgba(110, 200, 232, 0.12);
      border-style: dashed;
      border-bottom-color: rgba(94, 234, 212, 0.55);
      animation: home-orbit-rev 12s linear infinite;
    }
    &--c {
      inset: 24%;
      border-color: rgba(110, 200, 232, 0.1);
      border-left-color: rgba(56, 189, 248, 0.5);
      animation: home-orbit 8s linear infinite;
      box-shadow:
        inset 0 0 28px rgba(110, 200, 232, 0.08),
        0 0 40px rgba(110, 200, 232, 0.08);
    }
    &--ticks {
      inset: 6%;
      border: none;
      background: conic-gradient(
        from 0deg,
        transparent 0deg 8deg,
        rgba(165, 243, 252, 0.35) 8deg 9deg,
        transparent 9deg 38deg,
        rgba(110, 200, 232, 0.28) 38deg 39deg,
        transparent 39deg 70deg,
        rgba(165, 243, 252, 0.3) 70deg 71deg,
        transparent 71deg 100deg,
        rgba(110, 200, 232, 0.25) 100deg 101deg,
        transparent 101deg 360deg
      );
      mask-image: radial-gradient(circle, transparent 68%, #000 69%, #000 71%, transparent 72%);
      animation: home-orbit-rev 28s linear infinite;
      opacity: 0.7;
    }
  }

  &__fallback-sweep {
    @apply absolute inset-[8%] rounded-full;
    background: conic-gradient(
      from 0deg,
      transparent 0deg,
      rgba(94, 234, 212, 0.01) 40deg,
      rgba(94, 234, 212, 0.18) 78deg,
      transparent 90deg,
      transparent 360deg
    );
    mask-image: radial-gradient(circle, transparent 42%, #000 43%, #000 98%, transparent 99%);
    animation: home-orbit 3.6s linear infinite;
    opacity: 0.85;
  }

  &__fallback-cross {
    @apply absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2;
    width: 46%;
    height: 46%;
    opacity: 0.42;
    background:
      linear-gradient(
        90deg,
        transparent 49.15%,
        rgba(165, 243, 252, 0.45) 49.15%,
        rgba(165, 243, 252, 0.45) 50.85%,
        transparent 50.85%
      ),
      linear-gradient(
        0deg,
        transparent 49.15%,
        rgba(165, 243, 252, 0.45) 49.15%,
        rgba(165, 243, 252, 0.45) 50.85%,
        transparent 50.85%
      );
  }

  &__fallback-core {
    @apply absolute left-1/2 top-1/2 h-[5rem] w-[5rem] -translate-x-1/2 -translate-y-1/2 rounded-full;
    background: radial-gradient(
      circle at 35% 30%,
      rgba(236, 254, 255, 0.95) 0%,
      rgba(110, 200, 232, 0.55) 26%,
      rgba(14, 116, 144, 0.32) 52%,
      rgba(2, 20, 32, 0.15) 68%,
      transparent 74%
    );
    box-shadow:
      0 0 24px rgba(94, 234, 212, 0.45),
      0 0 70px rgba(56, 189, 248, 0.28),
      0 0 120px rgba(14, 116, 144, 0.18);
    animation: home-pulse 2.8s ease-in-out infinite;
  }

  &__fallback-pulse {
    @apply absolute left-1/2 top-1/2 h-[5rem] w-[5rem] -translate-x-1/2 -translate-y-1/2 rounded-full;
    border: 1px solid rgba(165, 243, 252, 0.4);
    animation: home-ripple 2.8s ease-out infinite;

    &--late {
      animation-delay: 1.4s;
      border-color: rgba(94, 234, 212, 0.28);
    }
  }

  &__fallback-telemetry {
    @apply absolute bottom-[14%] left-1/2 flex w-[min(18rem,70vw)] -translate-x-1/2 flex-col items-center gap-2.5;
  }

  &__fallback-status {
    @apply flex items-center gap-2.5;
    @apply font-mono text-[0.7rem] tracking-[0.32em] text-cyan-soft/80;
    text-shadow: 0 0 16px rgba(94, 234, 212, 0.35);
  }

  &__fallback-dot {
    @apply inline-block h-1.5 w-1.5 rounded-full bg-cyan-soft;
    box-shadow: 0 0 12px rgba(110, 200, 232, 0.95);
    animation: home-pulse-dot 1.2s ease-in-out infinite;
  }

  &__fallback-bar {
    @apply relative h-[2px] w-full overflow-hidden rounded-full;
    background: rgba(110, 200, 232, 0.12);
    box-shadow: 0 0 12px rgba(45, 212, 191, 0.12);

    i {
      @apply absolute inset-y-0 left-0 block w-2/5;
      background: linear-gradient(
        90deg,
        transparent,
        rgba(94, 234, 212, 0.95),
        rgba(165, 243, 252, 0.4)
      );
      box-shadow: 0 0 10px rgba(94, 234, 212, 0.55);
      animation: home-scanbar 1.8s ease-in-out infinite;
    }
  }

  &__fallback-meta {
    @apply flex w-full items-center justify-between;
    @apply font-mono text-[0.52rem] tracking-[0.22em] text-slate-500;

    span:first-child {
      color: rgba(94, 234, 212, 0.55);
    }
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
    opacity: 0.75;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.07);
  }
}

@keyframes home-pulse-dot {
  0%,
  100% {
    opacity: 0.55;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes home-glow {
  0%,
  100% {
    opacity: 0.75;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.04);
  }
}

@keyframes home-twinkle {
  0%,
  100% {
    opacity: 0.65;
  }
  50% {
    opacity: 0.95;
  }
}

@keyframes home-orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes home-orbit-rev {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes home-ripple {
  0% {
    opacity: 0.55;
    transform: translate(-50%, -50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.2);
  }
}

@keyframes home-scanbar {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(280%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-home__brand,
  .page-home__hud,
  .page-home__tip,
  .page-home__traits li,
  .page-home__fallback-ring,
  .page-home__fallback-core,
  .page-home__fallback-pulse,
  .page-home__fallback-dot,
  .page-home__fallback-sweep,
  .page-home__fallback-stars,
  .page-home__fallback-glow,
  .page-home__fallback-bar i {
    animation: none;
  }
}
</style>
