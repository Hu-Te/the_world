import * as THREE from 'three'
import type { HomeQuality } from './quality'
import { CYAN, ICE, INK } from './theme'

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createSpaceTexture(
  size: number,
  pushTexture: (t: THREE.Texture) => void,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const rnd = mulberry32(0x7a31c2)

  // 深空底色：中心略亮，四周沉入墨色
  const base = ctx.createRadialGradient(
    size * 0.5,
    size * 0.38,
    size * 0.04,
    size * 0.5,
    size * 0.52,
    size * 0.78,
  )
  base.addColorStop(0, '#142436')
  base.addColorStop(0.28, '#0a1524')
  base.addColorStop(0.58, '#050c16')
  base.addColorStop(0.85, '#03070e')
  base.addColorStop(1, '#010309')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)

  // 星云团（克制：少而薄，避免整片发雾）
  const blobs: Array<[number, number, number, string, string]> = [
    [0.28, 0.22, 0.34, 'rgba(50, 110, 170, 0.11)', 'rgba(50, 110, 170, 0.03)'],
    [0.72, 0.3, 0.28, 'rgba(70, 140, 180, 0.07)', 'rgba(70, 140, 180, 0.02)'],
    [0.52, 0.58, 0.36, 'rgba(30, 80, 130, 0.08)', 'rgba(30, 80, 130, 0.025)'],
    [0.18, 0.52, 0.24, 'rgba(60, 160, 180, 0.06)', 'rgba(60, 160, 180, 0.02)'],
    [0.82, 0.55, 0.26, 'rgba(80, 120, 170, 0.055)', 'rgba(80, 120, 170, 0.018)'],
  ]
  for (const [ux, uy, ur, c0, c1] of blobs) {
    const g = ctx.createRadialGradient(
      size * ux,
      size * uy,
      0,
      size * ux,
      size * uy,
      size * ur,
    )
    g.addColorStop(0, c0)
    g.addColorStop(0.55, c1)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }

  // 顶部极光倾向（柔，无横条）
  const aurora = ctx.createRadialGradient(
    size * 0.5,
    0,
    size * 0.05,
    size * 0.5,
    size * 0.2,
    size * 0.45,
  )
  aurora.addColorStop(0, 'rgba(70, 200, 180, 0.08)')
  aurora.addColorStop(0.5, 'rgba(60, 140, 200, 0.03)')
  aurora.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = aurora
  ctx.fillRect(0, 0, size, size)

  // 底部沉入，避免水平亮带
  const bottom = ctx.createLinearGradient(0, size * 0.7, 0, size)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(1, 3, 8, 0.5)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, 0, size, size)

  // 远星（硬边小点，避免糊成雾）
  const starN = size <= 512 ? 520 : 980
  for (let i = 0; i < starN; i++) {
    const x = rnd() * size
    const y = rnd() * size * 0.88
    const roll = rnd()
    const r = roll < 0.05 ? 1.35 : roll < 0.22 ? 0.85 : 0.4
    const a = 0.35 + rnd() * 0.65
    const cool = rnd() > 0.22
    ctx.fillStyle = cool
      ? `rgba(220, 238, 255, ${a.toFixed(2)})`
      : `rgba(255, 228, 190, ${(a * 0.85).toFixed(2)})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // 亮星十字（更小光晕）
  const bright = size <= 512 ? 14 : 26
  for (let i = 0; i < bright; i++) {
    const x = rnd() * size
    const y = rnd() * size * 0.72
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 5)
    glow.addColorStop(0, 'rgba(235, 248, 255, 0.95)')
    glow.addColorStop(0.4, 'rgba(140, 210, 245, 0.22)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, 5, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(200, 230, 255, 0.55)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(x - 6, y)
    ctx.lineTo(x + 6, y)
    ctx.moveTo(x, y - 6)
    ctx.lineTo(x, y + 6)
    ctx.stroke()
  }

  // 四角暗角（减轻，避免整片发灰）
  const vignette = ctx.createRadialGradient(
    size * 0.5,
    size * 0.45,
    size * 0.38,
    size * 0.5,
    size * 0.5,
    size * 0.78,
  )
  vignette.addColorStop(0, 'rgba(0,0,0,0)')
  vignette.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  pushTexture(tex)
  return tex
}

function createHazeTexture(pushTexture: (t: THREE.Texture) => void): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 124)
  g.addColorStop(0, 'rgba(110, 200, 232, 0.55)')
  g.addColorStop(0.35, 'rgba(90, 160, 200, 0.18)')
  g.addColorStop(0.7, 'rgba(40, 80, 120, 0.05)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  pushTexture(tex)
  return tex
}

function makeStarField(
  count: number,
  radiusMin: number,
  radiusSpan: number,
  size: number,
  elevBias: number,
): THREE.Points {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const cCyan = new THREE.Color(CYAN)
  const cIce = new THREE.Color(ICE)
  const cSteel = new THREE.Color(0x9ab8cc)
  const cWhite = new THREE.Color(0xd8e8f4)
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const elev = elevBias + Math.random() * 1.05
    const r = radiusMin + Math.random() * radiusSpan
    positions[i * 3] = Math.cos(a) * r * Math.cos(elev)
    positions[i * 3 + 1] = Math.sin(elev) * r + 1.5
    positions[i * 3 + 2] = Math.sin(a) * r * Math.cos(elev)
    const roll = Math.random()
    const tint =
      roll < 0.2 ? cIce : roll < 0.45 ? cCyan : roll < 0.7 ? cSteel : cWhite
    colors[i * 3] = tint.r
    colors[i * 3 + 1] = tint.g
    colors[i * 3 + 2] = tint.b
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  )
}

export type BackdropHandle = {
  root: THREE.Group
  update: (t: number) => void
}

/**
 * 沉浸式背景：深空穹顶 · 双层星屑 · 地平雾 · 极光环带
 * 贴图 / Points / 基础材质，无自定义 shader。
 */
export function buildBackdrop(
  scene: THREE.Scene,
  quality: HomeQuality,
  pushTexture: (t: THREE.Texture) => void,
): BackdropHandle {
  const root = new THREE.Group()
  const mobile = quality.device === 'mobile'
  const texSize = quality.domeTexSize
  const spaceTex = createSpaceTexture(texSize, pushTexture)

  const domeSegW = mobile ? 24 : 40
  const domeSegH = mobile ? 16 : 24
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(28, domeSegW, domeSegH),
    new THREE.MeshBasicMaterial({
      map: spaceTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  )
  dome.rotation.y = 0.35
  root.add(dome)

  // 双层远星：内外差速转动，景深更足
  const starsNear = makeStarField(
    quality.backdropStarsNear,
    12,
    8,
    mobile ? 0.04 : 0.055,
    -0.1,
  )
  const starsFar = makeStarField(
    quality.backdropStarsFar,
    18,
    9,
    mobile ? 0.028 : 0.038,
    0.05,
  )
  ;(starsFar.material as THREE.PointsMaterial).opacity = 0.62
  root.add(starsNear, starsFar)

  // 地面雾盘（收小，不拉出地平横带）
  const hazeTex = createHazeTexture(pushTexture)
  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    new THREE.MeshBasicMaterial({
      map: hazeTex,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  )
  haze.rotation.x = -Math.PI / 2
  haze.position.y = 0.02
  root.add(haze)

  // 中心窄光柱（不再大面积洗白中景）
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.55, 11, 12, 1, true),
    new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.028,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  )
  beam.position.y = 5.2
  root.add(beam)

  const beamCore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.12, 8, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xb0dcec,
      transparent: true,
      opacity: 0.04,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  )
  beamCore.position.y = 4.5
  root.add(beamCore)

  scene.add(root)
  scene.background = new THREE.Color(INK)
  scene.fog = new THREE.FogExp2(0x03070e, mobile ? 0.016 : 0.009)

  const beamMat = beam.material as THREE.MeshBasicMaterial
  const beamCoreMat = beamCore.material as THREE.MeshBasicMaterial
  const hazeMat = haze.material as THREE.MeshBasicMaterial
  const starsNearMat = starsNear.material as THREE.PointsMaterial
  const starsFarMat = starsFar.material as THREE.PointsMaterial

  return {
    root,
    update(t: number) {
      dome.rotation.y = t * 0.01
      starsNear.rotation.y = t * 0.016
      starsFar.rotation.y = -t * 0.008

      const breathe = Math.sin(t * 0.65)
      const breathe2 = Math.sin(t * 0.9 + 1.2)
      beamMat.opacity = 0.018 + breathe * 0.006
      beamCoreMat.opacity = 0.025 + breathe2 * 0.01
      hazeMat.opacity = 0.14 + breathe * 0.025
      haze.scale.setScalar(1 + breathe * 0.02)
      starsNearMat.opacity = 0.88 + breathe2 * 0.06
      starsFarMat.opacity = 0.62 + breathe * 0.05
    },
  }
}
