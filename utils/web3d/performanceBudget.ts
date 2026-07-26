/**
 * WebGL 性能预算（首页氛围与后续 3D 能力共用）
 * 业务代码优先读这些常量，不散落魔法数字。
 */
import type { Object3D, Mesh, BufferGeometry } from 'three'

/** 同时存在的 WebGLRenderer 上限（含隐藏页） */
export const MAX_WEBGL_CONTEXTS = 1

/** 手机 / 粗指针设备的 DPR 上限（过低会糊） */
export const PIXEL_RATIO_CAP_MOBILE = 2

/** 桌面 DPR 上限：对齐常见 Retina(=2)，避免整幅 canvas 被拉伸发糊 */
export const PIXEL_RATIO_CAP_DESKTOP = 2

/** 默认关闭实时阴影 */
export const ENABLE_SHADOWS_DEFAULT = false

/** 无交互时目标帧间隔（ms） */
export const IDLE_FRAME_INTERVAL_MS = 1000 / 30

/** 视口不可见 / 后台 Tab 必须停渲染 */
export const PAUSE_WHEN_HIDDEN = true

export type DeviceClass = 'mobile' | 'desktop'

export function detectDeviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'desktop'
  const coarse =
    window.matchMedia?.('(pointer: coarse)').matches ||
    window.matchMedia?.('(max-width: 768px)').matches
  return coarse ? 'mobile' : 'desktop'
}

export function resolvePixelRatioCap(
  device: DeviceClass = detectDeviceClass(),
): number {
  return device === 'mobile' ? PIXEL_RATIO_CAP_MOBILE : PIXEL_RATIO_CAP_DESKTOP
}

/** 统计 Object3D 树三角形数（粗估） */
export function countTriangles(root: Object3D): number {
  let total = 0
  root.traverse((obj) => {
    const mesh = obj as Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry as BufferGeometry | undefined
    if (!geo) return
    const index = geo.index
    if (index) {
      total += index.count / 3
      return
    }
    const pos = geo.getAttribute('position')
    if (pos) total += pos.count / 3
  })
  return Math.floor(total)
}
