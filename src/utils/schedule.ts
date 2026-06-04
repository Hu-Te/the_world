/** 防抖 — 适合 resize、scroll 结束后的布局更新 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  waitMs: number,
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null

  const debounced = ((...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, waitMs)
  }) as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  return debounced
}

/** 每帧最多执行一次 — 适合 pointermove、scroll 高频事件 */
export function rafThrottle<T extends (...args: never[]) => void>(
  fn: T,
): T & { cancel: () => void } {
  let frame = 0
  let pending: Parameters<T> | null = null

  const throttled = ((...args: Parameters<T>) => {
    pending = args
    if (frame !== 0) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (pending) {
        fn(...pending)
        pending = null
      }
    })
  }) as T & { cancel: () => void }

  throttled.cancel = () => {
    if (frame !== 0) {
      cancelAnimationFrame(frame)
      frame = 0
    }
    pending = null
  }

  return throttled
}
