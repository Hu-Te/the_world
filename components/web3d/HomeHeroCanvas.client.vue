<template>
  <div ref="hostRef" class="home-hero-canvas">
    <canvas
      ref="canvasRef"
      class="home-hero-canvas__el"
      aria-label="转着看路，点着进门" />
    <div class="home-hero-canvas__veil" aria-hidden="true" />
    <p class="home-hero-canvas__hint" aria-hidden="true">转着看 · 点着进</p>
  </div>
</template>

<script setup lang="ts">
import type { HomeHeroManager } from '~/utils/web3d/HomeHeroManager'

const emit = defineEmits<{
  select: [id: string]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const hostRef = ref<HTMLElement | null>(null)

let manager: HomeHeroManager | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null

onMounted(() => {
  void nextTick(async () => {
    const canvas = canvasRef.value
    const host = hostRef.value
    if (!canvas || !host) return

    try {
      if (document.fonts?.ready) await document.fonts.ready
      const { HomeHeroManager } = await import('~/utils/web3d/HomeHeroManager')
      manager = new HomeHeroManager({
        canvas,
        onSelectCategory: (id) => emit('select', id),
      })

      const applySize = () => {
        const rect = host.getBoundingClientRect()
        manager?.resize(Math.max(rect.width, 1), Math.max(rect.height, 1))
      }
      applySize()
      requestAnimationFrame(applySize)

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
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  manager?.dispose()
  manager = null
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
  }

  &__veil {
    @apply pointer-events-none absolute inset-0;
    /* 轻压边角，尽量让星空与地平氛围透出来 */
    background:
      radial-gradient(
        ellipse 78% 64% at 50% 42%,
        transparent 0%,
        transparent 62%,
        rgba(3, 8, 14, 0.18) 100%
      ),
      linear-gradient(
        180deg,
        rgba(4, 10, 18, 0.28) 0%,
        transparent 16%,
        transparent 78%,
        rgba(3, 8, 14, 0.38) 100%
      );
  }

  &__hint {
    @apply pointer-events-none absolute bottom-8 left-1/2 z-[1] -translate-x-1/2 font-mono text-[0.62rem] tracking-[0.2em] text-cyan-soft/45;
    text-shadow: 0 0 18px rgba(110, 200, 232, 0.2);
  }
}
</style>
