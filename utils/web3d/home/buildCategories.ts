import * as THREE from 'three'
import { TOOL_CATEGORIES, accentToNumber } from '~/utils/tools/catalog'
import {
  createAccentKit,
  createSoftGlowTexture,
  disposeAccentKit,
  type AccentKit,
  type SharedGeoPool,
} from './materials'
import { sculptById } from './sculpts'
import { CATEGORY_BASE_Y, CATEGORY_RADIUS } from './theme'
import type { HomeQuality } from './quality'
import type { CategoryNode } from './types'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** 高分屏 Canvas 浮签，避免 Sprite 缩放导致文字发糊 */
function makeLabel(
  code: string,
  text: string,
  accent: number,
  pushTexture: (t: THREE.Texture) => void,
): THREE.Sprite {
  const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 3)
  const scale = Math.max(2, Math.round(dpr * 2))

  const padX = 22
  const gap = 12
  const fontCode = '500 13px "IBM Plex Mono", ui-monospace, monospace'
  const fontName =
    '500 17px "IBM Plex Sans SC", "PingFang SC", "Hiragino Sans GB", sans-serif'

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = fontCode
  const codeW = Math.ceil(measure.measureText(code).width)
  measure.font = fontName
  const nameW = Math.ceil(measure.measureText(text).width)

  const logicalW = padX * 2 + 6 + codeW + gap + nameW
  const logicalH = 38
  const c = document.createElement('canvas')
  c.width = Math.ceil(logicalW * scale)
  c.height = Math.ceil(logicalH * scale)

  const ctx = c.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const accentHex = `#${accent.toString(16).padStart(6, '0')}`
  const boxX = 0.5
  const boxY = 0.5
  const boxW = logicalW - 1
  const boxH = logicalH - 1

  roundRect(ctx, boxX, boxY, boxW, boxH, 4)
  ctx.fillStyle = 'rgba(4, 10, 16, 0.78)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(110, 200, 232, 0.35)'
  ctx.lineWidth = 1
  ctx.stroke()

  roundRect(ctx, boxX + 1, boxY + 8, 2, boxH - 16, 1)
  ctx.fillStyle = accentHex
  ctx.fill()

  const midY = logicalH / 2
  const textX = padX + 2

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.font = fontCode
  ctx.fillStyle = 'rgba(110, 180, 200, 0.85)'
  ctx.fillText(code, textX, midY)

  ctx.font = fontName
  ctx.fillStyle = 'rgba(228, 240, 248, 0.95)'
  ctx.fillText(text, textX + codeW + gap, midY)

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
  const worldH = 0.3
  sprite.scale.set(worldH * (logicalW / logicalH), worldH, 1)
  sprite.position.y = -1.08
  return sprite
}

/** 分层展台：裙体 + 承托 + 晶面 + 双环 + 立柱 */
function buildPedestal(
  root: THREE.Group,
  kit: AccentKit,
  geos: SharedGeoPool,
  padSeg: number,
  ownedMats: THREE.Material[],
): void {
  const add = (m: THREE.Mesh) => {
    m.userData.sharedResource = true
    root.add(m)
  }

  const skirt = new THREE.Mesh(geos.cylinder(0.42, 0.5, 0.06, padSeg), kit.shell)
  skirt.position.y = -0.8
  add(skirt)

  const mid = new THREE.Mesh(geos.cylinder(0.38, 0.4, 0.04, padSeg), kit.shell)
  mid.position.y = -0.72
  add(mid)

  const platen = new THREE.Mesh(geos.cylinder(0.36, 0.36, 0.03, padSeg), kit.chrome)
  platen.position.y = -0.66
  add(platen)

  const lens = new THREE.Mesh(geos.cylinder(0.28, 0.28, 0.016, padSeg), kit.crystal)
  lens.position.y = -0.638
  add(lens)

  const rimOut = new THREE.Mesh(geos.torus(0.38, 0.012, 10, padSeg), kit.chrome)
  rimOut.rotation.x = Math.PI / 2
  rimOut.position.y = -0.63
  add(rimOut)

  const rimGlowMat = kit.core.clone()
  rimGlowMat.emissiveIntensity = 0.7
  rimGlowMat.transparent = true
  rimGlowMat.opacity = 0.92
  ownedMats.push(rimGlowMat)
  const rimIn = new THREE.Mesh(geos.torus(0.26, 0.008, 8, padSeg), rimGlowMat)
  rimIn.rotation.x = Math.PI / 2
  rimIn.position.y = -0.624
  add(rimIn)

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8
    const foot = new THREE.Mesh(geos.cylinder(0.016, 0.02, 0.1, 8), kit.chrome)
    foot.position.set(Math.sin(a) * 0.32, -0.74, Math.cos(a) * 0.32)
    add(foot)
  }

  const rail = new THREE.Mesh(geos.torus(0.44, 0.006, 8, padSeg), kit.shell)
  rail.rotation.x = Math.PI / 2
  rail.position.y = -0.84
  add(rail)

  // 台面轻晕
  const padGlow = new THREE.Mesh(
    geos.cylinder(0.34, 0.34, 0.008, padSeg),
    kit.tip,
  )
  padGlow.position.y = -0.62
  add(padGlow)
}

export type CategoryBuildResult = {
  nodes: CategoryNode[]
  kits: AccentKit[]
  disposeOwned: () => void
}

export function buildCategories(
  scene: THREE.Scene,
  geos: SharedGeoPool,
  quality: HomeQuality,
  pushTexture: (t: THREE.Texture) => void,
): CategoryBuildResult {
  const nodes: CategoryNode[] = []
  const kits: AccentKit[] = []
  const ownedMats: THREE.Material[] = []
  const ownedGeos: THREE.BufferGeometry[] = []
  const n = TOOL_CATEGORIES.length
  const padSeg = Math.max(20, Math.floor(quality.circleSeg / 2.5))

  const softGlowGeo = new THREE.PlaneGeometry(1.6, 1.6)
  const pickGeo = new THREE.BoxGeometry(1.4, 1.7, 1.4)
  ownedGeos.push(softGlowGeo, pickGeo)

  TOOL_CATEGORIES.forEach((cat, i) => {
    const accent = accentToNumber(cat.accent)
    const accentHex = `#${accent.toString(16).padStart(6, '0')}`
    const angle = (i / n) * Math.PI * 2
    const kit = createAccentKit(accent, quality)
    kits.push(kit)

    const root = new THREE.Group()
    root.position.set(
      Math.sin(angle) * CATEGORY_RADIUS,
      CATEGORY_BASE_Y,
      Math.cos(angle) * CATEGORY_RADIUS,
    )
    root.lookAt(0, CATEGORY_BASE_Y, 0)
    root.userData.categoryId = cat.id
    root.userData.angle = angle

    // 软光晕
    const glowTex = createSoftGlowTexture(accentHex, pushTexture)
    const glowMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    ownedMats.push(glowMat)
    const glow = new THREE.Mesh(softGlowGeo, glowMat)
    glow.rotation.x = -Math.PI / 2
    glow.position.y = -0.98
    glow.scale.setScalar(1.15)
    glow.userData.sharedResource = true
    root.add(glow)

    buildPedestal(root, kit, geos, padSeg, ownedMats)

    const { emblem, mats } = sculptById(cat.id, kit, geos, quality)
    emblem.position.y = 0.18
    emblem.scale.setScalar(1.06)
    root.add(emblem)
    root.add(makeLabel(cat.code, cat.name, accent, pushTexture))

    const pick = new THREE.Mesh(
      pickGeo,
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    )
    pick.userData.categoryId = cat.id
    pick.userData.sharedResource = true
    ownedMats.push(pick.material as THREE.Material)
    root.add(pick)

    scene.add(root)
    nodes.push({
      id: cat.id,
      root,
      emblem,
      accentMats: mats,
      glow,
      pick,
      baseY: CATEGORY_BASE_Y,
    })
  })

  return {
    nodes,
    kits,
    disposeOwned: () => {
      for (const kit of kits) disposeAccentKit(kit)
      for (const m of ownedMats) m.dispose()
      for (const g of ownedGeos) g.dispose()
    },
  }
}
