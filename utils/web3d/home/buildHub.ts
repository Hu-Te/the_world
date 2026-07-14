import * as THREE from 'three'
import { CYAN, ICE } from './theme'
import type { HomeQuality } from './quality'
import type { SharedGeoPool } from './materials'

function mark(obj: THREE.Object3D): void {
  obj.userData.sharedResource = true
}

/** 高密度仪表盘 */
function createDialTexture(pushTexture: (t: THREE.Texture) => void): THREE.CanvasTexture {
  const size = 512
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const mid = size / 2

  const plate = ctx.createRadialGradient(mid, mid, 6, mid, mid, mid * 0.98)
  plate.addColorStop(0, 'rgba(22, 40, 56, 0.98)')
  plate.addColorStop(0.45, 'rgba(12, 22, 34, 0.95)')
  plate.addColorStop(1, 'rgba(5, 10, 16, 0.25)')
  ctx.fillStyle = plate
  ctx.beginPath()
  ctx.arc(mid, mid, mid * 0.98, 0, Math.PI * 2)
  ctx.fill()

  for (const [r, a, w] of [
    [0.94, 0.4, 2],
    [0.82, 0.28, 1.4],
    [0.66, 0.35, 1.6],
    [0.48, 0.22, 1.2],
    [0.28, 0.3, 1.4],
  ] as const) {
    ctx.strokeStyle = `rgba(130, 200, 225, ${a})`
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.arc(mid, mid, mid * r, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2 - Math.PI / 2
    const major = i % 6 === 0
    const r0 = mid * (major ? 0.68 : 0.8)
    const r1 = mid * 0.91
    ctx.strokeStyle = major
      ? 'rgba(200, 235, 250, 0.65)'
      : 'rgba(110, 160, 185, 0.3)'
    ctx.lineWidth = major ? 1.6 : 0.7
    ctx.beginPath()
    ctx.moveTo(mid + Math.cos(a) * r0, mid + Math.sin(a) * r0)
    ctx.lineTo(mid + Math.cos(a) * r1, mid + Math.sin(a) * r1)
    ctx.stroke()
  }

  // 扇区弧强调
  ctx.strokeStyle = 'rgba(110, 200, 232, 0.55)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(mid, mid, mid * 0.74, -0.4, 0.9)
  ctx.stroke()

  const core = ctx.createRadialGradient(mid, mid, 2, mid, mid, mid * 0.2)
  core.addColorStop(0, 'rgba(170, 230, 255, 0.45)')
  core.addColorStop(1, 'rgba(110, 200, 232, 0)')
  ctx.fillStyle = core
  ctx.beginPath()
  ctx.arc(mid, mid, mid * 0.2, 0, Math.PI * 2)
  ctx.fill()

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 2
  pushTexture(tex)
  return tex
}

function createSoftHubGlow(
  pushTexture: (t: THREE.Texture) => void,
): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 124)
  g.addColorStop(0, 'rgba(150, 220, 250, 0.7)')
  g.addColorStop(0.3, 'rgba(100, 190, 220, 0.28)')
  g.addColorStop(0.65, 'rgba(60, 140, 180, 0.08)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  pushTexture(tex)
  return tex
}

/** 缺口轨：共享弧段几何 */
function addSegmentedOrbit(
  parent: THREE.Group,
  ownedGeos: THREE.BufferGeometry[],
  radius: number,
  tube: number,
  pieces: number,
  mat: THREE.Material,
  tubSeg: number,
): void {
  const span = (Math.PI * 2) / pieces
  const arc = span * 0.68
  const geo = new THREE.TorusGeometry(
    radius,
    tube,
    6,
    Math.max(10, Math.floor(tubSeg / pieces)),
    arc,
  )
  ownedGeos.push(geo)
  for (let i = 0; i < pieces; i++) {
    const m = new THREE.Mesh(geo, mat)
    m.rotation.x = Math.PI / 2
    m.rotation.z = i * span
    mark(m)
    parent.add(m)
  }
}

/**
 * 中央科技核：多层陀螺仪 + 数据柱 + 缺口轨道
 * 命名节点保持兼容：hubStack / hubCore / hubRing / hubRing2 / hubRing3 / hubCage / hubHalo / hubSpark / hubFloorGlow
 */
export function buildHub(
  geos: SharedGeoPool,
  quality: HomeQuality,
  pushTexture: (t: THREE.Texture) => void,
): THREE.Group {
  const g = new THREE.Group()
  g.position.y = 1.25
  const seg = Math.max(32, quality.torusSeg)
  const rs = quality.device === 'mobile' ? 1 : 2
  const rich = quality.device !== 'mobile'
  const owned: THREE.Material[] = []
  const ownedGeos: THREE.BufferGeometry[] = []
  const env = quality.useEnvMap ? 2.15 : 0.95
  const sph = (r: number) => geos.sphere(r, quality.device === 'mobile' ? 14 : 22)

  const shell = new THREE.MeshPhysicalMaterial({
    color: 0x0c141e,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 0,
    envMapIntensity: env * 0.9,
  })
  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xe4eef6,
    metalness: 1,
    roughness: 0.06,
    clearcoat: 0.35,
    clearcoatRoughness: 0.12,
    envMapIntensity: env,
  })
  const crystal = new THREE.MeshPhysicalMaterial({
    color: 0xeef8fc,
    metalness: 0,
    roughness: 0.08,
    transmission: quality.useHubTransmission ? 0.9 : 0,
    thickness: 1.7,
    ior: 1.46,
    transparent: true,
    opacity: quality.useHubTransmission ? 1 : 0.48,
    clearcoat: quality.useHubTransmission ? 1 : 0.25,
    clearcoatRoughness: 0.08,
    envMapIntensity: env,
    emissive: CYAN,
    emissiveIntensity: 0.22,
  })
  const frost = new THREE.MeshPhysicalMaterial({
    color: 0xb8d4e4,
    metalness: 0.1,
    roughness: 0.22,
    transparent: true,
    opacity: 0.26,
    clearcoat: 0,
    emissive: CYAN,
    emissiveIntensity: 0.14,
  })
  const core = new THREE.MeshPhysicalMaterial({
    color: 0xd0eefc,
    metalness: 0.4,
    roughness: 0.08,
    emissive: CYAN,
    emissiveIntensity: 1.55,
    clearcoat: 0.4,
  })
  const tipCyan = new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.95,
  })
  const tipIce = new THREE.MeshBasicMaterial({
    color: ICE,
    transparent: true,
    opacity: 0.9,
  })
  const ringHi = new THREE.MeshPhysicalMaterial({
    color: 0xc0d8e6,
    metalness: 1,
    roughness: 0.05,
    emissive: 0x144058,
    emissiveIntensity: 0.75,
    clearcoat: 1,
    envMapIntensity: env,
  })

  owned.push(shell, chrome, crystal, frost, core, tipCyan, tipIce, ringHi)

  // —— 脚下光晕 ——
  const glowTex = createSoftHubGlow(pushTexture)
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  owned.push(glowMat)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), glowMat)
  glow.rotation.x = -Math.PI / 2
  glow.position.y = -0.76
  glow.name = 'hubFloorGlow'
  ownedGeos.push(glow.geometry)
  g.add(glow)

  // —— 多层仪座 ——
  const stack = new THREE.Group()
  stack.name = 'hubStack'

  stack.add(
    (() => {
      const m = new THREE.Mesh(geos.cylinder(0.82, 0.94, 0.055, seg), shell)
      m.position.y = -0.68
      mark(m)
      return m
    })(),
  )
  stack.add(
    (() => {
      const m = new THREE.Mesh(geos.cylinder(0.7, 0.74, 0.04, seg), chrome)
      m.position.y = -0.61
      mark(m)
      return m
    })(),
  )

  const dialTex = createDialTexture(pushTexture)
  const dialMat = new THREE.MeshPhysicalMaterial({
    map: dialTex,
    metalness: 0.6,
    roughness: 0.22,
    clearcoat: 0.7,
    emissive: CYAN,
    emissiveIntensity: 0.12,
    envMapIntensity: quality.useEnvMap ? 1.3 : 0.65,
  })
  owned.push(dialMat)
  const dial = new THREE.Mesh(geos.cylinder(0.62, 0.62, 0.02, seg), dialMat)
  dial.position.y = -0.575
  mark(dial)
  stack.add(dial)

  const dialGlass = new THREE.Mesh(geos.cylinder(0.6, 0.6, 0.014, seg), crystal)
  dialGlass.position.y = -0.56
  mark(dialGlass)
  stack.add(dialGlass)

  const baseRim = new THREE.Mesh(geos.torus(0.72, 0.014, 10, seg), ringHi)
  baseRim.rotation.x = Math.PI / 2
  baseRim.position.y = -0.575
  mark(baseRim)
  stack.add(baseRim)

  const baseRim2 = new THREE.Mesh(geos.torus(0.8, 0.007, 8, seg), tipCyan)
  baseRim2.rotation.x = Math.PI / 2
  baseRim2.position.y = -0.585
  mark(baseRim2)
  stack.add(baseRim2)

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const jewel = new THREE.Mesh(
      sph(i % 3 === 0 ? 0.02 : 0.012),
      i % 2 === 0 ? tipCyan : tipIce,
    )
    jewel.position.set(Math.cos(a) * 0.72, -0.575, Math.sin(a) * 0.72)
    mark(jewel)
    stack.add(jewel)
  }

  // 三层托柱
  const pedestal = new THREE.Mesh(geos.cylinder(0.1, 0.16, 0.22, 16), chrome)
  pedestal.position.y = -0.42
  mark(pedestal)
  stack.add(pedestal)
  const pedMid = new THREE.Mesh(geos.cylinder(0.08, 0.1, 0.12, 14), shell)
  pedMid.position.y = -0.28
  mark(pedMid)
  stack.add(pedMid)
  const pedCollar = new THREE.Mesh(geos.torus(0.14, 0.012, 8, 24), tipCyan)
  pedCollar.rotation.x = Math.PI / 2
  pedCollar.position.y = -0.22
  mark(pedCollar)
  stack.add(pedCollar)
  const pedTop = new THREE.Mesh(geos.cylinder(0.16, 0.16, 0.03, 16), chrome)
  pedTop.position.y = -0.18
  mark(pedTop)
  stack.add(pedTop)

  g.add(stack)

  // —— 枢核（多壳） ——
  const coreGroup = new THREE.Group()
  coreGroup.name = 'hubCore'
  coreGroup.position.y = 0.18

  coreGroup.add(
    (() => {
      const m = new THREE.Mesh(sph(0.09), core)
      mark(m)
      return m
    })(),
  )
  coreGroup.add(
    (() => {
      const m = new THREE.Mesh(geos.octahedron(0.14), tipIce)
      mark(m)
      return m
    })(),
  )
  coreGroup.add(
    (() => {
      const m = new THREE.Mesh(sph(0.2), crystal)
      mark(m)
      return m
    })(),
  )
  coreGroup.add(
    (() => {
      const m = new THREE.Mesh(sph(0.29), frost)
      mark(m)
      return m
    })(),
  )

  const eq = new THREE.Mesh(geos.torus(0.24, 0.01, 8, 36), tipCyan)
  eq.rotation.x = Math.PI / 2
  mark(eq)
  coreGroup.add(eq)
  const mer = new THREE.Mesh(geos.torus(0.24, 0.008, 8, 32), tipIce)
  mark(mer)
  coreGroup.add(mer)
  const mer2 = new THREE.Mesh(geos.torus(0.24, 0.006, 8, 28), chrome)
  mer2.rotation.z = Math.PI / 2
  mark(mer2)
  coreGroup.add(mer2)

  // 核周小卫星
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2
    const sat = new THREE.Mesh(geos.rbox(0.05, 0.05, 0.05, 0.01, rs), chrome)
    sat.position.set(Math.cos(a) * 0.34, Math.sin(a * 1.3) * 0.08, Math.sin(a) * 0.34)
    mark(sat)
    coreGroup.add(sat)
  }

  g.add(coreGroup)

  // —— 轨道 A：水平缺口精密环 ——
  const orbitA = new THREE.Group()
  orbitA.name = 'hubRing'
  orbitA.position.y = 0.18
  addSegmentedOrbit(orbitA, ownedGeos, 0.5, 0.016, rich ? 6 : 4, chrome, seg)
  const ringAIn = new THREE.Mesh(geos.torus(0.44, 0.006, 6, seg), tipCyan)
  ringAIn.rotation.x = Math.PI / 2
  mark(ringAIn)
  orbitA.add(ringAIn)
  for (let i = 0; i < (rich ? 6 : 4); i++) {
    const a = (i / (rich ? 6 : 4)) * Math.PI * 2 + 0.15
    const node = new THREE.Mesh(sph(0.025), tipCyan)
    node.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5)
    mark(node)
    orbitA.add(node)
    const fin = new THREE.Mesh(geos.rbox(0.08, 0.02, 0.035, 0.006, rs), shell)
    fin.position.set(Math.cos(a) * 0.5, 0.025, Math.sin(a) * 0.5)
    fin.rotation.y = -a
    mark(fin)
    orbitA.add(fin)
  }
  g.add(orbitA)

  // —— 轨道 B：倾斜双环 ——
  const orbitB = new THREE.Group()
  orbitB.name = 'hubRing2'
  orbitB.position.y = 0.18
  orbitB.rotation.x = 1.05
  addSegmentedOrbit(orbitB, ownedGeos, 0.66, 0.013, rich ? 5 : 3, ringHi, seg)
  const ringBSolid = new THREE.Mesh(geos.torus(0.6, 0.005, 6, Math.max(28, seg - 8)), tipIce)
  mark(ringBSolid)
  orbitB.add(ringBSolid)
  for (let i = 0; i < (rich ? 5 : 3); i++) {
    const a = (i / (rich ? 5 : 3)) * Math.PI * 2 + 0.2
    const node = new THREE.Mesh(sph(0.02), tipCyan)
    node.position.set(Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0)
    mark(node)
    orbitB.add(node)
  }
  g.add(orbitB)

  // —— 轨道 C：大倾角外环 ——
  const orbitC = new THREE.Group()
  orbitC.name = 'hubRing3'
  orbitC.position.y = 0.18
  orbitC.rotation.set(0.4, 0.55, 0.9)
  const ringC = new THREE.Mesh(geos.torus(0.84, 0.011, 8, seg), chrome)
  mark(ringC)
  orbitC.add(ringC)
  const ringC2 = new THREE.Mesh(geos.torus(0.78, 0.005, 6, Math.max(28, seg - 8)), tipCyan)
  mark(ringC2)
  orbitC.add(ringC2)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3
    const pod = new THREE.Mesh(geos.rbox(0.1, 0.028, 0.04, 0.008, rs), shell)
    pod.position.set(Math.cos(a) * 0.84, Math.sin(a) * 0.84, 0)
    pod.lookAt(0, 0, 0)
    mark(pod)
    orbitC.add(pod)
  }
  g.add(orbitC)

  // —— 笼架：6 条经弧 + 腰环 ——
  const cage = new THREE.Group()
  cage.name = 'hubCage'
  cage.position.y = 0.18
  const arcGeo = new THREE.TorusGeometry(0.46, 0.008, 6, 32, Math.PI * 0.78)
  ownedGeos.push(arcGeo)
  for (let i = 0; i < (rich ? 6 : 4); i++) {
    const a = (i / (rich ? 6 : 4)) * Math.PI * 2
    const arc = new THREE.Mesh(arcGeo, shell)
    arc.rotation.y = a
    arc.rotation.z = Math.PI / 2
    mark(arc)
    cage.add(arc)
  }
  const waist = new THREE.Mesh(geos.torus(0.4, 0.01, 8, seg), chrome)
  waist.rotation.x = Math.PI / 2
  mark(waist)
  cage.add(waist)
  const waist2 = new THREE.Mesh(geos.torus(0.4, 0.006, 6, seg), tipCyan)
  waist2.rotation.x = Math.PI / 2
  waist2.position.y = 0.12
  mark(waist2)
  cage.add(waist2)
  g.add(cage)

  // —— 四角数据塔 + 能量纽带 ——
  const pillars: Array<[number, number, number]> = [
    [-0.62, 0.62, 0.42],
    [0.62, 0.62, 0.52],
    [0.62, -0.62, 0.36],
    [-0.62, -0.62, 0.48],
  ]
  for (const [x, z, h] of pillars) {
    const col = new THREE.Mesh(geos.cylinder(0.035, 0.042, h, 12), crystal)
    col.position.set(x, -0.45 + h / 2, z)
    mark(col)
    g.add(col)
    const cap = new THREE.Mesh(sph(0.04), tipCyan)
    cap.position.set(x, -0.45 + h + 0.02, z)
    mark(cap)
    g.add(cap)
    const base = new THREE.Mesh(geos.cylinder(0.055, 0.055, 0.03, 10), chrome)
    base.position.set(x, -0.46, z)
    mark(base)
    g.add(base)

    if (rich) {
      const dx = -x
      const dy = 0.18 - (-0.45 + h)
      const dz = -z
      const len = Math.hypot(dx, dy, dz)
      const linkGeo = new THREE.CylinderGeometry(0.005, 0.005, len, 5)
      ownedGeos.push(linkGeo)
      const link = new THREE.Mesh(linkGeo, tipCyan)
      link.position.set(x * 0.5, (-0.45 + h + 0.18) / 2, z * 0.5)
      link.lookAt(0, 0.18, 0)
      link.rotateX(Math.PI / 2)
      mark(link)
      g.add(link)
    }
  }

  // —— 外晕环 ——
  const halo = new THREE.Group()
  halo.name = 'hubHalo'
  halo.position.y = 0.18

  const haloRing = new THREE.Mesh(geos.torus(1.02, 0.007, 6, seg), tipCyan)
  haloRing.rotation.x = Math.PI / 2
  mark(haloRing)
  halo.add(haloRing)

  const haloOuter = new THREE.Mesh(geos.torus(1.12, 0.004, 6, Math.max(28, seg - 8)), tipIce)
  haloOuter.rotation.x = Math.PI / 2
  mark(haloOuter)
  halo.add(haloOuter)

  const discMat = new THREE.MeshBasicMaterial({
    color: CYAN,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  owned.push(discMat)
  const disc = new THREE.Mesh(geos.cylinder(1.0, 1.0, 0.01, seg), discMat)
  mark(disc)
  halo.add(disc)
  g.add(halo)

  // —— 星屑 ——
  const sparkN = quality.device === 'mobile' ? 28 : 56
  const sparkPos = new Float32Array(sparkN * 3)
  for (let i = 0; i < sparkN; i++) {
    const a = Math.random() * Math.PI * 2
    const elev = (Math.random() - 0.35) * Math.PI
    const r = 0.28 + Math.random() * 0.7
    sparkPos[i * 3] = Math.cos(a) * Math.cos(elev) * r
    sparkPos[i * 3 + 1] = 0.18 + Math.sin(elev) * r * 0.55
    sparkPos[i * 3 + 2] = Math.sin(a) * Math.cos(elev) * r
  }
  const sparkGeo = new THREE.BufferGeometry()
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3))
  ownedGeos.push(sparkGeo)
  const sparkMat = new THREE.PointsMaterial({
    color: 0xc0e8f8,
    size: 0.024,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  })
  owned.push(sparkMat)
  const spark = new THREE.Points(sparkGeo, sparkMat)
  spark.name = 'hubSpark'
  g.add(spark)

  g.userData.ownedMats = owned
  g.userData.ownedGeos = ownedGeos
  return g
}
