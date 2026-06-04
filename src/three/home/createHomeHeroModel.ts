import * as THREE from 'three'
import { disposeObject3D } from '../utils/dispose'
import { HOME_HERO_CONFIG } from './homeHeroConfig'
import { isMobileViewport } from '@/utils/device'

const COLORS = {
  teal: 0x6a9098,
  tealBright: 0x8ab4c4,
  tealDeep: 0x3a6878,
  purple: 0x7a6898,
  purpleSoft: 0x9888b0,
  glass: 0x0c141c,
  grass: 0x3d7a36,
  grassLight: 0x4a8f4e,
  rock: 0x5e5850,
  ink: 0xa8c8d8,
  fog: 0x1a5060,
} as const

export interface HomeHeroHandle {
  root: THREE.Group
  update: (elapsed: number, pointerX?: number, pointerY?: number) => void
  mountExternalModel: (model: THREE.Object3D) => void
  dispose: () => void
}

function glassMat(envMap?: THREE.Texture | null, emissive = 0x1a3848): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: COLORS.glass,
    emissive,
    emissiveIntensity: 0.36,
    metalness: 0.86,
    roughness: 0.16,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    transmission: 0.1,
    envMap: envMap ?? undefined,
    envMapIntensity: 1.12,
  })
}

function makeGlowMat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
}

function createPolyWire(
  radius: number,
  detail: number,
  color: number,
  opacity: number,
): THREE.LineSegments {
  const geo = new THREE.IcosahedronGeometry(radius, detail)
  const edges = new THREE.EdgesGeometry(geo, 16)
  geo.dispose()
  return new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
    }),
  )
}

function createGlobeWireframe(radius: number): THREE.Group {
  const group = new THREE.Group()
  const matA = new THREE.LineBasicMaterial({
    color: COLORS.tealBright,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
  })
  const matB = new THREE.LineBasicMaterial({
    color: COLORS.purpleSoft,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
  })

  for (let lat = -75; lat <= 75; lat += 15) {
    const points: THREE.Vector3[] = []
    const phi = (90 - lat) * (Math.PI / 180)
    for (let i = 0; i <= 72; i++) {
      const theta = (i / 72) * Math.PI * 2
      points.push(
        new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        ),
      )
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lat % 30 === 0 ? matA : matB))
  }

  for (let lon = 0; lon < 360; lon += 22.5) {
    const points: THREE.Vector3[] = []
    const theta = lon * (Math.PI / 180)
    for (let i = 0; i <= 36; i++) {
      const phi = (i / 36) * Math.PI
      points.push(
        new THREE.Vector3(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        ),
      )
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lon % 45 === 0 ? matA : matB))
  }

  return group
}

function createHelixRibbon(segments: number, color: number, opacity: number): THREE.Line {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((segments + 1) * 3), 3))
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending }),
  )
}

function updateHelixRibbon(line: THREE.Line, elapsed: number, phase: number, radius: number, height: number) {
  const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < attr.count; i++) {
    const t = i / (attr.count - 1)
    const angle = t * Math.PI * 5.5 + elapsed * 0.42 + phase
    const r = radius + t * 1.8
    const y = (t - 0.5) * height
    attr.setXYZ(i, Math.cos(angle) * r, y, Math.sin(angle) * r * 0.76)
  }
  attr.needsUpdate = true
}

function createDataLink(color: number): {
  line: THREE.Line
  setPath: (from: THREE.Vector3, to: THREE.Vector3, elapsed: number, phase: number) => void
} {
  const segs = 14
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((segs + 1) * 3), 3))
  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
    }),
  )
  const temp = new THREE.Vector3()
  const setPath = (from: THREE.Vector3, to: THREE.Vector3, elapsed: number, phase: number) => {
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      temp.lerpVectors(from, to, t)
      temp.y += Math.sin(t * Math.PI + elapsed * 2.2 + phase) * 0.55 * (1 - Math.abs(t - 0.5) * 1.6)
      attr.setXYZ(i, temp.x, temp.y, temp.z)
    }
    attr.needsUpdate = true
  }
  return { line, setPath }
}

function createGameModule(envMap?: THREE.Texture | null): THREE.Group {
  const mod = new THREE.Group()
  mod.name = 'ModuleGame'

  const mat = glassMat(envMap, 0x1a4050)
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.66, 0.16, 6), mat)
  const grid = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.52, 6),
    makeGlowMat(COLORS.tealDeep, 0.35),
  )
  grid.rotation.x = -Math.PI / 2
  grid.position.y = 0.082

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.36, 5, 10), mat)
  body.position.y = 0.42
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), mat)
  head.position.y = 0.72

  const camArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.012, 4, 24, Math.PI * 0.65),
    makeGlowMat(COLORS.tealBright, 0.5),
  )
  camArc.rotation.x = Math.PI / 2
  camArc.rotation.z = 0.4
  camArc.position.set(0.28, 0.55, 0.12)

  const dockRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.72, 0.022, 6, 40),
    makeGlowMat(COLORS.tealBright, 0.48),
  )
  dockRing.rotation.x = Math.PI / 2
  dockRing.position.y = 0.02

  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.06), mat)
  pillar.position.set(0.38, 0.28, -0.28)

  mod.add(pad, grid, body, head, camArc, dockRing, pillar)
  return mod
}

function createWorldModule(envMap?: THREE.Texture | null): THREE.Group {
  const mod = new THREE.Group()
  mod.name = 'ModuleWorld'

  const rockMat = new THREE.MeshStandardMaterial({
    color: COLORS.rock,
    emissive: 0x1a2028,
    emissiveIntensity: 0.14,
    metalness: 0.38,
    roughness: 0.68,
    envMap: envMap ?? undefined,
    envMapIntensity: 0.65,
  })
  const grassMat = new THREE.MeshStandardMaterial({
    color: COLORS.grass,
    emissive: 0x1a3820,
    emissiveIntensity: 0.2,
    metalness: 0.08,
    roughness: 0.8,
  })
  const grassLight = new THREE.MeshStandardMaterial({
    color: COLORS.grassLight,
    emissive: 0x1a4020,
    emissiveIntensity: 0.16,
    metalness: 0.06,
    roughness: 0.85,
  })

  const island = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, 0.42, 10), rockMat)
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.58, 0.07, 10), grassMat)
  top.position.y = 0.22

  const trees = [
    [0.18, 0.48, 0.1],
    [-0.2, 0.42, -0.08],
    [0.05, 0.38, -0.22],
  ] as [number, number, number][]
  for (const [x, y, z] of trees) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.18, 5), rockMat)
    trunk.position.set(x, y - 0.08, z)
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.12 + Math.random() * 0.04, 0.32, 5), grassLight)
    crown.position.set(x, y + 0.08, z)
    mod.add(trunk, crown)
  }

  for (let i = 0; i < 5; i++) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.06 + Math.random() * 0.04, 0), rockMat)
    const a = (i / 5) * Math.PI * 2
    rock.position.set(Math.cos(a) * 0.42, 0.18, Math.sin(a) * 0.42)
    mod.add(rock)
  }

  const fall = new THREE.Mesh(
    new THREE.PlaneGeometry(0.08, 0.35),
    makeGlowMat(COLORS.tealBright, 0.28),
  )
  fall.position.set(-0.32, 0.15, 0.18)
  fall.rotation.y = 0.5

  const mist = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.014, 6, 36),
    makeGlowMat(COLORS.tealBright, 0.36),
  )
  mist.rotation.x = Math.PI / 2
  mist.position.y = -0.02

  const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), makeGlowMat(0xdce8f0, 0.12))
  cloud.position.set(0.1, 0.72, 0.05)
  cloud.scale.set(1.8, 0.45, 1.2)

  mod.add(island, top, fall, mist, cloud)
  return mod
}

function createDrawModule(envMap?: THREE.Texture | null): THREE.Group {
  const mod = new THREE.Group()
  mod.name = 'ModuleDraw'

  const mat = glassMat(envMap, 0x182838)
  const easelLeg = new THREE.BoxGeometry(0.04, 0.52, 0.04)
  for (const x of [-0.28, 0.28]) {
    const leg = new THREE.Mesh(easelLeg, mat)
    leg.position.set(x, -0.18, -0.12)
    leg.rotation.x = 0.22
    mod.add(leg)
  }

  const board = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.045, 0.6), mat)
  board.position.y = 0.04
  const canvas = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.012, 0.5),
    new THREE.MeshStandardMaterial({
      color: 0x101820,
      emissive: 0x0a1820,
      emissiveIntensity: 0.25,
      metalness: 0.2,
      roughness: 0.75,
    }),
  )
  canvas.position.y = 0.068

  const strokes: THREE.Line[] = []
  for (let s = 0; s < 3; s++) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      pts.push(
        new THREE.Vector3(
          -0.24 + t * 0.48,
          0.078 + Math.sin(t * Math.PI * (1.8 + s * 0.4) + s) * (0.08 - s * 0.015),
          -0.04 + Math.cos(t * Math.PI * (2 + s * 0.3)) * (0.1 - s * 0.02),
        ),
      )
    }
    const stroke = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({
        color: s === 0 ? COLORS.ink : s === 1 ? COLORS.tealBright : COLORS.purpleSoft,
        transparent: true,
        opacity: 0.75 - s * 0.15,
        blending: THREE.AdditiveBlending,
      }),
    )
    strokes.push(stroke)
    mod.add(stroke)
  }

  const frame = new THREE.Mesh(
    new THREE.TorusGeometry(0.52, 0.016, 4, 36),
    makeGlowMat(COLORS.purpleSoft, 0.42),
  )
  frame.rotation.x = Math.PI / 2
  frame.position.y = 0.08

  const frameOuter = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.01, 4, 36),
    makeGlowMat(COLORS.teal, 0.22),
  )
  frameOuter.rotation.x = Math.PI / 2
  frameOuter.position.y = 0.06

  mod.add(board, canvas, frame, frameOuter)
  mod.userData.strokes = strokes
  return mod
}

function createObservatoryBase(envMap?: THREE.Texture | null): THREE.Group {
  const base = new THREE.Group()
  const mat = glassMat(envMap, 0x143038)
  const trim = glassMat(envMap, 0x1a4858)

  const tierA = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 6.2, 0.38, 6), mat)
  tierA.position.y = -4.88
  const tierB = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 0.18, 6), trim)
  tierB.position.y = -4.58
  const tierC = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.12, 6), mat)
  tierC.position.y = -4.42

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), trim)
    pillar.position.set(Math.cos(a) * 5.1, -4.1, Math.sin(a) * 5.1 * 0.78)
    pillar.rotation.y = -a
    base.add(pillar)
  }

  const ledCount = 42
  const leds = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.14, 0.04, 0.08),
    makeGlowMat(COLORS.tealBright, 0.55),
    ledCount,
  )
  const ledDummy = new THREE.Object3D()
  for (let i = 0; i < ledCount; i++) {
    const a = (i / ledCount) * Math.PI * 2
    ledDummy.position.set(Math.cos(a) * 5.55, -4.36, Math.sin(a) * 5.55 * 0.78)
    ledDummy.rotation.y = -a
    ledDummy.updateMatrix()
    leds.setMatrixAt(i, ledDummy.matrix)
  }
  leds.instanceMatrix.needsUpdate = true

  const rims = [
    { r: 5.6, c: COLORS.teal, o: 0.45 },
    { r: 6.5, c: COLORS.purple, o: 0.22 },
    { r: 7.4, c: COLORS.tealBright, o: 0.12 },
  ].map(({ r, c, o }) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.028, 8, 80), makeGlowMat(c, o))
    ring.rotation.x = Math.PI / 2
    ring.position.y = -4.34
    return ring
  })

  base.add(tierA, tierB, tierC, leds, ...rims)
  return base
}

/** 世界模拟枢纽 · 完整版 — 3D 展示级层次 */
export function createHomeHeroModel(envMap?: THREE.Texture | null): HomeHeroHandle {
  const root = new THREE.Group()
  root.name = 'WorldSimHub'
  root.scale.setScalar(
    HOME_HERO_CONFIG.proceduralScale * (isMobileViewport() ? 0.9 : 1),
  )

  const hub = new THREE.Group()
  hub.name = 'HubRig'
  root.add(hub)

  const bodyGroup = new THREE.Group()
  bodyGroup.name = 'HubBody'
  hub.add(bodyGroup)

  const glowInner = new THREE.Mesh(
    new THREE.SphereGeometry(3.8, 32, 32),
    makeGlowMat(COLORS.fog, 0.055),
  )
  const glowOuter = new THREE.Mesh(
    new THREE.SphereGeometry(6.2, 36, 36),
    makeGlowMat(COLORS.tealDeep, 0.035),
  )

  const globeWire = createGlobeWireframe(6.4)
  const cageInner = createPolyWire(3.2, 2, COLORS.tealBright, 0.38)
  const cageOuter = createPolyWire(4.6, 1, COLORS.purpleSoft, 0.16)

  const coreInner = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.95, 0),
    new THREE.MeshPhysicalMaterial({
      color: 0x040810,
      emissive: COLORS.tealBright,
      emissiveIntensity: 0.85,
      metalness: 0.94,
      roughness: 0.06,
      clearcoat: 1,
      envMap: envMap ?? undefined,
      envMapIntensity: 1.35,
    }),
  )

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.75, 2),
    new THREE.MeshPhysicalMaterial({
      color: 0x060c12,
      emissive: COLORS.tealDeep,
      emissiveIntensity: 0.58,
      metalness: 0.92,
      roughness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMap: envMap ?? undefined,
      envMapIntensity: 1.28,
    }),
  )

  const coreShell = new THREE.Mesh(
    new THREE.SphereGeometry(2.15, 32, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0x080e14,
      emissive: 0x142830,
      emissiveIntensity: 0.22,
      metalness: 0.95,
      roughness: 0.04,
      clearcoat: 1,
      transmission: 0.18,
      transparent: true,
      opacity: 0.88,
      envMap: envMap ?? undefined,
      envMapIntensity: 1.4,
    }),
  )

  const coreRings = [
    { r: 2.45, tilt: 0, speed: 0.14 },
    { r: 2.85, tilt: Math.PI / 3.2, speed: -0.1 },
    { r: 3.25, tilt: Math.PI / 1.8, speed: 0.07 },
  ].map(({ r, tilt, speed }) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 8, 72), makeGlowMat(COLORS.tealBright, 0.45))
    ring.rotation.x = Math.PI / 2 + tilt * 0.35
    ring.rotation.z = tilt
    ring.userData.speed = speed
    return ring
  })

  const orbitPaths = [5.6, 6.8].map((r, i) => {
    const path = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.01 + i * 0.004, 6, 112),
      makeGlowMat(i === 0 ? COLORS.teal : COLORS.purpleSoft, 0.28 - i * 0.08),
    )
    path.rotation.x = Math.PI / 2.05 + i * 0.12
    return path
  })

  const scanBand = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.018, 8, 88),
    makeGlowMat(COLORS.tealBright, 0.5),
  )

  const helixA = createHelixRibbon(64, COLORS.tealBright, 0.26)
  const helixB = createHelixRibbon(64, COLORS.purpleSoft, 0.18)

  const moduleOrbit = new THREE.Group()
  const modules = [
    { mesh: createGameModule(envMap), phase: 0 },
    { mesh: createWorldModule(envMap), phase: (Math.PI * 2) / 3 },
    { mesh: createDrawModule(envMap), phase: ((Math.PI * 2) / 3) * 2 },
  ]
  const moduleRadius = 5.6
  modules.forEach(({ mesh, phase }) => {
    mesh.position.set(Math.cos(phase) * moduleRadius, 0.2, Math.sin(phase) * moduleRadius * 0.72)
    mesh.rotation.y = -phase + Math.PI / 2
    mesh.userData.phase = phase
    moduleOrbit.add(mesh)
  })

  const dataLinks = modules.map((m, i) =>
    createDataLink(i === 0 ? COLORS.tealBright : i === 1 ? COLORS.grassLight : COLORS.purpleSoft),
  )

  const haloRings = [
    { r: 7.8, c: COLORS.tealBright, o: 0.24, tx: Math.PI / 2.25, tz: 0.3, sp: 0.11 },
    { r: 9.2, c: COLORS.purpleSoft, o: 0.16, tx: Math.PI / 2.7, tz: 0.75, sp: -0.08 },
    { r: 10.8, c: COLORS.teal, o: 0.1, tx: Math.PI / 2.05, tz: 1.15, sp: 0.06 },
    { r: 12.4, c: COLORS.purple, o: 0.07, tx: Math.PI / 1.85, tz: 0.45, sp: -0.04 },
  ].map(({ r, c, o, tx, tz, sp }) => {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 6, 112), makeGlowMat(c, o))
    mesh.rotation.x = tx
    mesh.rotation.z = tz
    return { mesh, speed: sp }
  })

  bodyGroup.add(
    glowOuter,
    glowInner,
    globeWire,
    cageInner,
    cageOuter,
    coreShell,
    core,
    coreInner,
    ...coreRings,
    ...orbitPaths,
    scanBand,
    helixA,
    helixB,
    moduleOrbit,
    ...dataLinks.map((d) => d.line),
    ...haloRings.map((h) => h.mesh),
  )

  const microCount = 18
  const microOrbiters = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.09, 0),
    glassMat(envMap, 0x1a3848),
    microCount,
  )
  hub.add(microOrbiters)

  const instCount = 128
  const ambientDots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.044, 6, 6),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    }),
    instCount,
  )
  const dotColors = new Float32Array(instCount * 3)
  const cA = new THREE.Color(COLORS.tealBright)
  const cB = new THREE.Color(COLORS.purpleSoft)
  for (let i = 0; i < instCount; i++) {
    const c = cA.clone().lerp(cB, (i % 6) / 5)
    dotColors[i * 3] = c.r
    dotColors[i * 3 + 1] = c.g
    dotColors[i * 3 + 2] = c.b
  }
  ambientDots.instanceColor = new THREE.InstancedBufferAttribute(dotColors, 3)

  const riseCount = 40
  const riseDots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.028, 4, 4),
    makeGlowMat(COLORS.tealBright, 0.65),
    riseCount,
  )

  const pulseRings = [0, 0.25, 0.5, 0.75].map((phase) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 1.98, 72),
      makeGlowMat(COLORS.teal, 0.2),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -4.62
    ring.userData.phase = phase
    return ring
  })

  const platform = createObservatoryBase(envMap)
  const coreLight = new THREE.PointLight(COLORS.tealBright, 36, 58)
  coreLight.position.set(1.4, 2.4, 2.4)
  const accentLight = new THREE.PointLight(COLORS.purple, 16, 44)
  accentLight.position.set(-2.4, 1.5, -1.6)
  const fillLight = new THREE.PointLight(COLORS.tealDeep, 10, 36)
  fillLight.position.set(0, -1.5, 3.5)

  hub.add(ambientDots, riseDots, ...pulseRings, platform, coreLight, accentLight, fillLight)

  const coreMat = core.material as THREE.MeshPhysicalMaterial
  const innerMat = coreInner.material as THREE.MeshPhysicalMaterial
  const dummy = new THREE.Object3D()
  const linkFrom = new THREE.Vector3()
  const linkTo = new THREE.Vector3()
  let externalMounted = false

  const update = (elapsed: number, pointerX = 0, pointerY = 0) => {
    if (!externalMounted) {
      coreInner.rotation.y = elapsed * 0.65
      coreInner.rotation.x = elapsed * 0.38
      core.rotation.y = elapsed * 0.14
      core.rotation.x = Math.sin(elapsed * 0.18) * 0.06
      coreMat.emissiveIntensity = 0.54 + Math.sin(elapsed * 1.5) * 0.08 + Math.abs(pointerX) * 0.1
      innerMat.emissiveIntensity = 0.8 + Math.sin(elapsed * 2) * 0.12

      globeWire.rotation.y = elapsed * 0.05
      cageInner.rotation.y = -elapsed * 0.2
      cageInner.rotation.z = elapsed * 0.08
      cageOuter.rotation.y = elapsed * 0.12
      cageOuter.rotation.x = -elapsed * 0.04

      coreRings.forEach((ring) => {
        ring.rotation.z += (ring.userData.speed as number) * 0.016
      })

      orbitPaths.forEach((path, i) => {
        path.rotation.z = elapsed * (0.04 - i * 0.015)
      })

      scanBand.rotation.x = elapsed * 0.45
      scanBand.rotation.y = elapsed * 0.28
      scanBand.position.y = Math.sin(elapsed * 0.85) * 0.32

      updateHelixRibbon(helixA, elapsed, 0, 3.8, 5.5)
      updateHelixRibbon(helixB, elapsed, Math.PI, 4.6, 5.5)

      moduleOrbit.rotation.y = elapsed * 0.065

      modules.forEach(({ mesh }) => {
        const phase = mesh.userData.phase as number
        const bob = Math.sin(elapsed * 1.05 + phase) * 0.14
        mesh.position.y = 0.2 + bob
        if (mesh.name === 'ModuleDraw') {
          mesh.rotation.z = Math.sin(elapsed * 0.85 + phase) * 0.07
        }
      })

      glowInner.scale.setScalar(1 + Math.sin(elapsed * 1.2) * 0.014)
      glowOuter.scale.setScalar(1 + Math.sin(elapsed * 0.95) * 0.012)
    }

    hub.rotation.y = elapsed * 0.045 + pointerX * 0.038
    hub.rotation.x = Math.sin(elapsed * 0.07) * 0.022 + pointerY * 0.016

    haloRings.forEach(({ mesh, speed }) => {
      mesh.rotation.y = elapsed * speed
    })

    if (!externalMounted) {
      modules.forEach(({ mesh }, i) => {
        mesh.getWorldPosition(linkTo)
        hub.worldToLocal(linkTo)
        linkFrom.set(0, 0, 0)
        dataLinks[i]!.setPath(linkFrom, linkTo, elapsed, mesh.userData.phase as number)
      })
    }

    coreLight.intensity = 34 + Math.sin(elapsed * 1.5) * 4
    accentLight.intensity = 14 + Math.sin(elapsed * 1.2 + 1) * 3

    pulseRings.forEach((ring) => {
      const phase = (elapsed * 0.13 + (ring.userData.phase as number)) % 1
      ring.scale.set(1 + phase * 1.8, 1 + phase * 1.8, 1)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.18
    })

    for (let i = 0; i < instCount; i++) {
      const t = i / instCount
      const band = i % 4
      const angle = elapsed * (0.26 + band * 0.05) + t * Math.PI * 2
      const r = 6.8 + band * 1.15
      const y = Math.sin(angle * 1.4 + i * 0.11) * (0.75 + band * 0.22)
      dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.64)
      dummy.scale.setScalar(0.6 + band * 0.1)
      dummy.updateMatrix()
      ambientDots.setMatrixAt(i, dummy.matrix)
    }
    ambientDots.instanceMatrix.needsUpdate = true

    for (let i = 0; i < riseCount; i++) {
      const phase = ((elapsed * 0.18 + i / riseCount) % 1)
      const a = (i / riseCount) * Math.PI * 2 + elapsed * 0.08
      const r = 3.5 + (i % 5) * 0.45
      dummy.position.set(Math.cos(a) * r, -4.2 + phase * 9, Math.sin(a) * r * 0.72)
      dummy.scale.setScalar(0.5 + (1 - phase) * 0.5)
      dummy.updateMatrix()
      riseDots.setMatrixAt(i, dummy.matrix)
    }
    riseDots.instanceMatrix.needsUpdate = true

    for (let i = 0; i < microCount; i++) {
      const t = i / microCount
      const angle = elapsed * 0.32 + t * Math.PI * 2
      const r = 8.2 + (i % 4) * 0.55
      dummy.position.set(Math.cos(angle) * r, Math.sin(elapsed * 1.2 + t * 6) * 0.5, Math.sin(angle) * r * 0.68)
      dummy.rotation.set(elapsed * 0.5, angle, 0)
      dummy.updateMatrix()
      microOrbiters.setMatrixAt(i, dummy.matrix)
    }
    microOrbiters.instanceMatrix.needsUpdate = true
  }

  const mountExternalModel = (model: THREE.Object3D) => {
    while (bodyGroup.children.length > 0) {
      bodyGroup.remove(bodyGroup.children[0]!)
    }
    bodyGroup.add(model)
    externalMounted = true
  }

  const dispose = () => {
    disposeObject3D(root)
  }

  return { root, update, mountExternalModel, dispose }
}
