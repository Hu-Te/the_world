/** 触屏 / 粗指针设备（手机、平板） */
export function isCoarsePointer(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}

/** 窄屏 H5 布局（与 CSS 断点 768 对齐） */
export function isMobileViewport(): boolean {
  const w = window.visualViewport?.width ?? window.innerWidth
  return w < 768
}

export function getDevicePixelRatioCap(): number {
  return isMobileViewport() ? 1.5 : 2
}

/** 工具箱视口锚点 — 手机略靠内，避免贴边难点的 */
export function getToolboxNdc(): { x: number; y: number } {
  if (isMobileViewport()) {
    return { x: 0.68, y: -0.74 }
  }
  return { x: 0.58, y: -0.66 }
}

export function getViewportSize(): { width: number; height: number } {
  const vv = window.visualViewport
  return {
    width: Math.max(vv?.width ?? window.innerWidth, 1),
    height: Math.max(vv?.height ?? window.innerHeight, 1),
  }
}
