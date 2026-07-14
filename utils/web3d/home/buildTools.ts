import * as THREE from 'three'
import { getCategory, accentToNumber, type ToolItem } from '~/utils/tools/catalog'
import {
  createAccentKit,
  disposeAccentKit,
  type SharedGeoPool,
} from './materials'
import { sculptTool } from './toolSculpts'
import type { HomeQuality } from './quality'

export type ToolNode = {
  id: string
  tool: ToolItem
  root: THREE.Group
  emblem: THREE.Group
  pick: THREE.Mesh
  visual: THREE.Group
  targetScale: number
  /** 环绕基准角（本地） */
  orbitAngle: number
  /** 环绕半径 */
  orbitRadius: number
  /** 相对中心高度 */
  height: number
  phase: number
}

export type ToolsBuildResult = {
  root: THREE.Group
  nodes: ToolNode[]
  pickMeshes: THREE.Mesh[]
  dispose: () => void
}

function makeToolLabel(
  name: string,
  badge: string,
  accent: number,
  pushTexture: (t: THREE.Texture) => void,
): THREE.Sprite {
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2.5)
  const scale = Math.max(2, Math.round(dpr * 2))

  const fontName =
    '500 12px "IBM Plex Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif'
  const fontBadge = '500 9px "IBM Plex Mono", ui-monospace, monospace'

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = fontName
  const nameW = Math.ceil(measure.measureText(name).width)
  measure.font = fontBadge
  const badgeW = Math.ceil(measure.measureText(badge).width)

  const padX = 10
  const gap = 8
  const logicalW = padX * 2 + nameW + gap + badgeW
  const logicalH = 24
  const c = document.createElement('canvas')
  c.width = Math.ceil(logicalW * scale)
  c.height = Math.ceil(logicalH * scale)

  const ctx = c.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingEnabled = false

  const accentHex = `#${accent.toString(16).padStart(6, '0')}`
  ctx.beginPath()
  const r = 3
  ctx.moveTo(r, 0.5)
  ctx.arcTo(logicalW - 0.5, 0.5, logicalW - 0.5, logicalH - 0.5, r)
  ctx.arcTo(logicalW - 0.5, logicalH - 0.5, 0.5, logicalH - 0.5, r)
  ctx.arcTo(0.5, logicalH - 0.5, 0.5, 0.5, r)
  ctx.arcTo(0.5, 0.5, logicalW - 0.5, 0.5, r)
  ctx.closePath()
  ctx.fillStyle = 'rgba(4, 10, 16, 0.82)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(110, 200, 232, 0.32)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = accentHex
  ctx.fillRect(1.5, 5, 2, logicalH - 10)

  const midY = logicalH / 2
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = fontName
  ctx.fillStyle = 'rgba(228, 240, 248, 0.95)'
  ctx.fillText(name, padX + 2, midY)

  ctx.font = fontBadge
  const badgeColor =
    badge === '可用'
      ? 'rgba(110, 200, 168, 0.95)'
      : badge === '内测'
        ? 'rgba(200, 176, 110, 0.95)'
        : 'rgba(140, 160, 176, 0.9)'
  ctx.fillStyle = badgeColor
  ctx.fillText(badge, padX + 2 + nameW + gap, midY)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.needsUpdate = true
  pushTexture(tex)

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 1,
    }),
  )
  const worldH = 0.145
  sprite.scale.set(worldH * (logicalW / logicalH), worldH, 1)
  sprite.position.y = -0.72
  return sprite
}

/**
 * 以分类工具箱为中心，工具沿本地环围绕悬浮
 */
export function buildTools(options: {
  categoryId: string
  geos: SharedGeoPool
  quality: HomeQuality
}): ToolsBuildResult | null {
  const cat = getCategory(options.categoryId)
  if (!cat || cat.tools.length === 0) return null

  const { geos, quality } = options
  const accent = accentToNumber(cat.accent)
  const kit = createAccentKit(accent, quality)
  const ownedMats: THREE.Material[] = []
  const ownedGeos: THREE.BufferGeometry[] = []
  const ownedTex: THREE.Texture[] = []

  const pickGeo = new THREE.BoxGeometry(1.55, 1.7, 1.35)
  ownedGeos.push(pickGeo)

  const root = new THREE.Group()
  root.name = 'toolOrbit'
  const nodes: ToolNode[] = []
  const pickMeshes: THREE.Mesh[] = []

  const tools = cat.tools.slice(0, 3)
  const n = tools.length
  // 围绕工具箱：半径加大，给更大模型留出间距
  const orbitR = n <= 2 ? 2.45 : 2.35
  const baseHeight = 0.62

  tools.forEach((tool, i) => {
    // 微偏起始角，避开正对镜头时整块挡分类
    const orbitAngle = (i / n) * Math.PI * 2 - Math.PI / 2 + 0.35
    const height = baseHeight + (i % 3) * 0.22 - 0.1

    const nodeRoot = new THREE.Group()
    nodeRoot.position.set(
      Math.sin(orbitAngle) * orbitR,
      height,
      Math.cos(orbitAngle) * orbitR,
    )
    nodeRoot.userData.toolId = tool.id

    const visual = new THREE.Group()
    visual.scale.setScalar(0.01)
    nodeRoot.add(visual)

    const { emblem } = sculptTool(cat.id, i, kit, geos, quality)
    emblem.position.y = 0.18
    emblem.scale.setScalar(0.92)
    visual.add(emblem)

    visual.add(
      makeToolLabel(tool.name, tool.badge, accent, (tex) => {
        ownedTex.push(tex)
      }),
    )

    const pickMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    })
    ownedMats.push(pickMat)
    const pick = new THREE.Mesh(pickGeo, pickMat)
    pick.position.y = 0.05
    pick.userData.toolId = tool.id
    pick.userData.sharedResource = true
    nodeRoot.add(pick)
    pickMeshes.push(pick)

    root.add(nodeRoot)
    nodes.push({
      id: tool.id,
      tool,
      root: nodeRoot,
      emblem,
      pick,
      visual,
      targetScale: 1,
      orbitAngle,
      orbitRadius: orbitR,
      height,
      phase: i * 1.7,
    })
  })

  return {
    root,
    nodes,
    pickMeshes,
    dispose: () => {
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Sprite)) return
        const mat = obj.material
        mat.map = null
        mat.dispose()
      })
      disposeAccentKit(kit)
      for (const m of ownedMats) m.dispose()
      for (const g of ownedGeos) g.dispose()
      for (const t of ownedTex) t.dispose()
      while (root.children.length > 0) root.remove(root.children[0]!)
    },
  }
}
