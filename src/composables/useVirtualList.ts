import { computed, onUnmounted, shallowRef, watch, type Ref } from 'vue'

export interface VirtualListOptions {
  rowHeight: number
  overscan?: number
}

export interface VirtualListSlice<T> {
  items: { item: T; index: number }[]
  offsetY: number
  totalHeight: number
}

/**
 * Lightweight windowed list — only mounts visible rows (passive scroll + rAF throttle).
 * Re-binds when containerRef appears (e.g. after v-if switches to visible).
 */
export function useVirtualList<T>(
  source: Ref<readonly T[]>,
  containerRef: Ref<HTMLElement | null>,
  options: VirtualListOptions,
) {
  const scrollTop = shallowRef(0)
  const viewportHeight = shallowRef(0)
  const { rowHeight, overscan = 5 } = options

  let rafId = 0
  let pendingScrollTop = 0
  let resizeObserver: ResizeObserver | null = null
  let boundEl: HTMLElement | null = null

  const applyScroll = () => {
    rafId = 0
    scrollTop.value = pendingScrollTop
  }

  const onScroll = () => {
    const el = containerRef.value
    if (!el) return
    pendingScrollTop = el.scrollTop
    if (!rafId) rafId = requestAnimationFrame(applyScroll)
  }

  const measure = () => {
    const el = containerRef.value
    if (!el) return
    viewportHeight.value = el.clientHeight
    pendingScrollTop = el.scrollTop
    scrollTop.value = pendingScrollTop
  }

  const unbind = () => {
    if (boundEl) {
      boundEl.removeEventListener('scroll', onScroll)
      boundEl = null
    }
    resizeObserver?.disconnect()
    resizeObserver = null
  }

  const bind = (el: HTMLElement | null) => {
    if (boundEl === el) return
    unbind()

    if (!el) {
      viewportHeight.value = 0
      return
    }

    boundEl = el
    measure()
    el.addEventListener('scroll', onScroll, { passive: true })
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(el)
  }

  watch(containerRef, (el) => bind(el), { flush: 'post', immediate: true })

  onUnmounted(() => {
    unbind()
    if (rafId) cancelAnimationFrame(rafId)
  })

  const slice = computed<VirtualListSlice<T>>(() => {
    const count = source.value.length
    const totalHeight = count * rowHeight
    if (count === 0) {
      return { items: [], offsetY: 0, totalHeight: 0 }
    }

    const vp = viewportHeight.value > 0 ? viewportHeight.value : 480
    const start = Math.max(0, Math.floor(scrollTop.value / rowHeight) - overscan)
    const visibleCount = Math.ceil(vp / rowHeight) + overscan * 2
    const end = Math.min(count, start + visibleCount)

    const items: { item: T; index: number }[] = []
    for (let i = start; i < end; i++) {
      items.push({ item: source.value[i]!, index: i })
    }

    return { items, offsetY: start * rowHeight, totalHeight }
  })

  const scrollToTop = () => {
    const el = containerRef.value
    if (!el) return
    el.scrollTop = 0
    scrollTop.value = 0
  }

  return { slice, scrollToTop, measure }
}
