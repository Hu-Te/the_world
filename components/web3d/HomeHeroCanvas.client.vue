<template>
  <div ref="hostRef" class="home-hero-canvas" :data-ready="ready ? '1' : undefined">
    <canvas
      ref="canvasRef"
      class="home-hero-canvas__el"
      :class="{ 'is-ready': ready }"
      aria-label="环视分舱，点入工位" />
    <div class="home-hero-canvas__veil" aria-hidden="true" />
    <p v-show="ready" class="home-hero-canvas__hint" aria-hidden="true">
      {{ hintText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { HomeHeroManager } from '~/utils/web3d/HomeHeroManager'
import type { ToolItem } from '~/utils/tools/catalog'

const emit = defineEmits<{
  ready: []
  'drill-open': [id: string]
  'drill-close': []
  'select-tool': [tool: ToolItem]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hostRef = ref<HTMLElement | null>(null)
const drilling = ref(false)
const ready = ref(false)

const hintText = computed(() =>
  drilling.value ? '环视工具 · 点选进入 · Esc 返回' : '环视分舱 · 右上角登录进入系统',
)

let manager: HomeHeroManager | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null
let cancelled = false

onMounted(() => {
  cancelled = false
  // 先让首屏 CSS 壳层完成绘制，再拉 Three，降低 FCP 争抢
  const start = () => {
    void nextTick(async () => {
      const canvas = canvasRef.value
      const host = hostRef.value
      if (!canvas || !host) return

      try {
        const { HomeHeroManager } = await import('~/utils/web3d/HomeHeroManager')
        if (cancelled) return

        manager = new HomeHeroManager({
          canvas,
          onDrillOpen: (id) => {
            drilling.value = true
            emit('drill-open', id)
          },
          onDrillClose: () => {
            drilling.value = false
            emit('drill-close')
          },
          onSelectTool: (tool) => emit('select-tool', tool),
        })

        const applySize = () => {
          const rect = host.getBoundingClientRect()
          manager?.resize(Math.max(rect.width, 1), Math.max(rect.height, 1))
        }
        applySize()

        // 等真正画出一帧再露 canvas，避免盖住 CSS 壳层后空黑屏
        requestAnimationFrame(() => {
          if (cancelled) return
          applySize()
          ready.value = true
          emit('ready')
        })

        resizeObserver = new ResizeObserver(applySize)
        resizeObserver.observe(host)

        intersectionObserver = new IntersectionObserver(
          ([entry]) => manager?.setInViewport(Boolean(entry?.isIntersecting)),
          { threshold: 0 },
        )
        intersectionObserver.observe(host)
      } catch (err) {
        console.error('[HomeHeroCanvas] init failed', err)
      }
    })
  }
  requestAnimationFrame(() => requestAnimationFrame(start))
})

onUnmounted(() => {
  cancelled = true
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  manager?.dispose()
  manager = null
})

defineExpose({
  closeDrill: () => manager?.closeDrill(),
})
</script>

<style scoped lang="scss">
.home-hero-canvas {
  @apply absolute inset-0 z-0 overflow-hidden;
  pointer-events: auto;
  touch-action: none;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &__el {
    @apply absolute inset-0 block h-full w-full;
    opacity: 0;
    transition: opacity 0.35s ease;

    &.is-ready {
      opacity: 1;
    }
  }

  &__veil {
    @apply pointer-events-none absolute inset-0;
    background:
      radial-gradient(
        ellipse 82% 68% at 50% 40%,
        transparent 0%,
        transparent 72%,
        rgba(3, 8, 14, 0.1) 100%
      ),
      linear-gradient(
        180deg,
        rgba(4, 10, 18, 0.14) 0%,
        transparent 14%,
        transparent 82%,
        rgba(3, 8, 14, 0.22) 100%
      );
  }

  &__hint {
    @apply pointer-events-none absolute bottom-8 left-1/2 z-[1] -translate-x-1/2 font-mono text-[0.62rem] tracking-[0.2em] text-cyan-soft/45;
    text-shadow: 0 0 18px rgba(110, 200, 232, 0.2);
  }
}
</style>
