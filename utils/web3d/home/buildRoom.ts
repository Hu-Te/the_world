import * as THREE from 'three'
import { CYAN, INK } from './theme'
import type { HomeQuality } from './quality'

/** 舞台面：冷青金属盘 + 精密刻度 */
export function createFloorTexture(
  size: number,
  pushTexture: (t: THREE.Texture) => void,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const mid = size / 2

  const g = ctx.createRadialGradient(mid, mid, size * 0.03, mid, mid, size * 0.5)
  g.addColorStop(0, '#1a2c3c')
  g.addColorStop(0.4, '#101c28')
  g.addColorStop(0.78, '#0a121c')
  g.addColorStop(1, '#070e16')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const gridN = size <= 512 ? 14 : 20
  ctx.strokeStyle = 'rgba(110, 200, 232, 0.06)'
  ctx.lineWidth = 1
  for (let i = 0; i < gridN; i++) {
    const p = (i / gridN) * size
    ctx.beginPath()
    ctx.moveTo(p, 0)
    ctx.lineTo(p, size)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, p)
    ctx.lineTo(size, p)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(140, 200, 220, 0.32)'
  ctx.lineWidth = 1.25
  for (const r of [0.16, 0.28, 0.4].map((k) => k * size)) {
    ctx.beginPath()
    ctx.arc(mid, mid, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  const ticks = size <= 512 ? 56 : 80
  for (let i = 0; i < ticks; i++) {
    const a = (i / ticks) * Math.PI * 2
    const major = i % 5 === 0
    const r0 = size * (major ? 0.438 : 0.452)
    const r1 = size * 0.478
    ctx.strokeStyle = major
      ? 'rgba(190, 220, 240, 0.5)'
      : 'rgba(120, 160, 185, 0.28)'
    ctx.lineWidth = major ? 1.4 : 0.8
    ctx.beginPath()
    ctx.moveTo(mid + Math.cos(a) * r0, mid + Math.sin(a) * r0)
    ctx.lineTo(mid + Math.cos(a) * r1, mid + Math.sin(a) * r1)
    ctx.stroke()
  }

  // 盘心轻晕，避免「压塌」
  const core = ctx.createRadialGradient(mid, mid, 4, mid, mid, size * 0.2)
  core.addColorStop(0, 'rgba(90, 170, 200, 0.18)')
  core.addColorStop(1, 'rgba(90, 170, 200, 0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(mid, mid, size * 0.2, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  tex.generateMipmaps = true
  pushTexture(tex)
  return tex
}

/**
 * 舞台围裙：外缘柔和触底阴影 → 向外淡出进虚空
 * 避免一块死黑圆盘「砸」在星空上
 */
function createApronTexture(
  pushTexture: (t: THREE.Texture) => void,
): THREE.CanvasTexture {
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const mid = size / 2
  // 归一化半径：0 中心 · ~0.42 舞台边缘 · 1 围裙外沿
  const g = ctx.createRadialGradient(mid, mid, mid * 0.32, mid, mid, mid * 0.98)
  g.addColorStop(0, 'rgba(2, 6, 12, 0)')
  g.addColorStop(0.28, 'rgba(2, 6, 12, 0)')
  // 接触阴影带（贴着舞台外侧）
  g.addColorStop(0.38, 'rgba(1, 4, 10, 0.55)')
  g.addColorStop(0.48, 'rgba(2, 6, 12, 0.32)')
  g.addColorStop(0.62, 'rgba(4, 10, 18, 0.14)')
  g.addColorStop(0.8, 'rgba(4, 10, 18, 0.04)')
  g.addColorStop(1, 'rgba(3, 7, 14, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  // 一圈极细青边高光，挂住舞台外沿
  ctx.strokeStyle = 'rgba(110, 200, 232, 0.16)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(mid, mid, mid * 0.405, 0, Math.PI * 2)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  pushTexture(tex)
  return tex
}

/** 外沿环境光晕（加性，抬起舞台悬浮感） */
function createCoronaTexture(
  pushTexture: (t: THREE.Texture) => void,
): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const mid = size / 2
  const g = ctx.createRadialGradient(mid, mid, mid * 0.42, mid, mid, mid * 0.92)
  g.addColorStop(0, 'rgba(110, 200, 232, 0)')
  g.addColorStop(0.35, 'rgba(90, 180, 210, 0.22)')
  g.addColorStop(0.55, 'rgba(70, 150, 190, 0.08)')
  g.addColorStop(1, 'rgba(40, 90, 120, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  pushTexture(tex)
  return tex
}

export function buildRoom(
  scene: THREE.Scene,
  quality: HomeQuality,
  pushTexture: (t: THREE.Texture) => void,
  floorRings: THREE.Mesh[],
): void {
  const seg = quality.circleSeg
  const ink = new THREE.Color(INK)

  // 远场虚空底板：贴天空色，不再硬黑切边
  const voidPlate = new THREE.Mesh(
    new THREE.CircleGeometry(18, Math.max(32, seg / 2)),
    new THREE.MeshBasicMaterial({
      color: ink,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: true,
    }),
  )
  voidPlate.rotation.x = -Math.PI / 2
  voidPlate.position.y = -0.04
  scene.add(voidPlate)

  // 柔围裙：接触阴影 + 外淡出
  const apronTex = createApronTexture(pushTexture)
  const apron = new THREE.Mesh(
    new THREE.CircleGeometry(12.5, seg),
    new THREE.MeshBasicMaterial({
      map: apronTex,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      fog: true,
    }),
  )
  apron.rotation.x = -Math.PI / 2
  apron.position.y = -0.01
  scene.add(apron)

  // 外沿加性光晕：把舞台「托」起来
  const coronaTex = createCoronaTexture(pushTexture)
  const corona = new THREE.Mesh(
    new THREE.CircleGeometry(8.2, seg),
    new THREE.MeshBasicMaterial({
      map: coronaTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  )
  corona.rotation.x = -Math.PI / 2
  corona.position.y = 0.005
  scene.add(corona)

  // 舞台主体
  const floorTex = createFloorTexture(quality.floorTexSize, pushTexture)
  const stage = new THREE.Mesh(
    new THREE.CircleGeometry(5.15, seg),
    new THREE.MeshPhysicalMaterial({
      map: floorTex,
      color: 0xc8d8e4,
      metalness: 0.94,
      roughness: 0.16,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      envMapIntensity: quality.useEnvMap ? 1.65 : 0.7,
    }),
  )
  stage.rotation.x = -Math.PI / 2
  stage.position.y = 0.012
  scene.add(stage)

  // 双层精密外环
  const rimOuter = new THREE.Mesh(
    new THREE.TorusGeometry(5.18, 0.028, 8, quality.torusSeg),
    new THREE.MeshPhysicalMaterial({
      color: 0xb8ccd8,
      metalness: 1,
      roughness: 0.12,
      clearcoat: 1,
      emissive: 0x082030,
      emissiveIntensity: 0.35,
      envMapIntensity: quality.useEnvMap ? 1.8 : 0.8,
    }),
  )
  rimOuter.rotation.x = Math.PI / 2
  rimOuter.position.y = 0.022
  scene.add(rimOuter)

  const rimInner = new THREE.Mesh(
    new THREE.TorusGeometry(5.05, 0.01, 6, Math.max(24, quality.torusSeg - 8)),
    new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  )
  rimInner.rotation.x = Math.PI / 2
  rimInner.position.y = 0.026
  scene.add(rimInner)

  const ringSpecs = [
    { r0: 3.15, r1: 3.32, opacity: 0.5, color: CYAN },
    { r0: 3.5, r1: 3.58, opacity: 0.22, color: 0x5a88a0 },
    { r0: 2.48, r1: 2.56, opacity: 0.34, color: 0x8ab8d0 },
  ]
  for (const s of ringSpecs) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(s.r0, s.r1, seg),
      new THREE.MeshBasicMaterial({
        color: s.color,
        transparent: true,
        opacity: s.opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.028
    scene.add(ring)
    floorRings.push(ring)
  }

  // 盘心托光
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(2.4, Math.max(24, seg / 2)),
    new THREE.MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  )
  glow.rotation.x = -Math.PI / 2
  glow.position.y = 0.02
  scene.add(glow)
}
