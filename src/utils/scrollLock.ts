let lockCount = 0

function measureScrollbarWidth(): number {
  return Math.max(window.innerWidth - document.documentElement.clientWidth, 0)
}

/** 锁定页面滚动，并补偿滚动条宽度，避免布局抖动 */
export function lockPageScroll(): void {
  if (lockCount === 0) {
    const scrollbarWidth = measureScrollbarWidth()
    document.documentElement.classList.add('scroll-locked')
    document.documentElement.style.setProperty('--scrollbar-width', `${scrollbarWidth}px`)
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    document.documentElement.style.overscrollBehavior = 'none'
  }
  lockCount += 1
}

/** 解除页面滚动锁定 */
export function unlockPageScroll(): void {
  if (lockCount <= 0) return
  lockCount -= 1
  if (lockCount !== 0) return

  document.documentElement.classList.remove('scroll-locked')
  document.documentElement.style.removeProperty('--scrollbar-width')
  document.body.style.overflow = ''
  document.body.style.touchAction = ''
  document.documentElement.style.overscrollBehavior = ''
}

/** 强制解除（组件卸载时兜底） */
export function resetPageScrollLock(): void {
  lockCount = 0
  document.documentElement.classList.remove('scroll-locked')
  document.documentElement.style.removeProperty('--scrollbar-width')
  document.body.style.overflow = ''
  document.body.style.touchAction = ''
  document.documentElement.style.overscrollBehavior = ''
}
