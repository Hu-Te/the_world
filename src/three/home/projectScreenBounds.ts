import * as THREE from 'three'

export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

const ndc = new THREE.Vector3()
const box = new THREE.Box3()
const corners = Array.from({ length: 8 }, () => new THREE.Vector3())

function isMeshLike(obj: THREE.Object3D): obj is THREE.Mesh | THREE.InstancedMesh {
  return obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh
}

/** 将 Object3D 包围盒投影到屏幕坐标（viewport 像素） */
export function projectObjectScreenBounds(
  root: THREE.Object3D,
  camera: THREE.Camera,
  canvasRect: DOMRect,
  options?: {
    exclude?: (obj: THREE.Object3D) => boolean
    padding?: number
  },
): ScreenRect | null {
  const padding = options?.padding ?? 12
  const exclude = options?.exclude

  root.updateMatrixWorld(true)
  box.makeEmpty()

  root.traverse((obj) => {
    if (exclude?.(obj)) return
    if (isMeshLike(obj)) box.expandByObject(obj)
  })

  if (box.isEmpty()) return null

  const { min, max } = box
  const xs = [min.x, max.x]
  const ys = [min.y, max.y]
  const zs = [min.z, max.z]

  let i = 0
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const corner = corners[i]
        if (!corner) continue
        corner.set(x, y, z)
        i++
      }
    }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let visible = false

  for (const corner of corners) {
    ndc.copy(corner).project(camera)
    visible = true

    const sx = (ndc.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left
    const sy = (-ndc.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top
    minX = Math.min(minX, sx)
    minY = Math.min(minY, sy)
    maxX = Math.max(maxX, sx)
    maxY = Math.max(maxY, sy)
  }

  if (!visible) return null

  return {
    left: minX - padding,
    top: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  }
}

const worldCenter = new THREE.Vector3()

/** 世界坐标中心投影为固定尺寸的屏幕矩形（始终有值） */
export function projectWorldCenterRect(
  root: THREE.Object3D,
  camera: THREE.Camera,
  canvasRect: DOMRect,
  width: number,
  height: number,
): ScreenRect {
  root.updateMatrixWorld(true)
  root.getWorldPosition(worldCenter)
  worldCenter.project(camera)

  const cx = (worldCenter.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left
  const cy = (-worldCenter.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top

  return {
    left: cx - width / 2,
    top: cy - height / 2,
    width,
    height,
  }
}
