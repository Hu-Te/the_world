import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { disposeObject3D } from '../utils/dispose'

export interface SciFiSceneHandle {
  group: THREE.Group
  core: THREE.Group
  update: (elapsed: number, delta: number, pointerX?: number, pointerY?: number) => void
  dispose: () => void
}

export interface SciFiSceneContext {
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
}

const CORE_X = 14
const CORE_Y = 5
const CORE_Z = -6

function createStarField(count = 1600): THREE.Points {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const cA = new THREE.Color(0x6a9ab8)
  const cB = new THREE.Color(0x7868a8)

  for (let i = 0; i < count; i++) {
    const radius = 50 + Math.random() * 170
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta) + CORE_X
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.22 + 8
    positions[i * 3 + 2] = radius * Math.cos(phi) + CORE_Z

    const c = cA.clone().lerp(cB, Math.random())
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.15,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    }),
  )
}

function createWirePoly(
  radius: number,
  detail: number,
  color: number,
  opacity: number,
): THREE.LineSegments {
  const geo = new THREE.IcosahedronGeometry(radius, detail)
  const edges = new THREE.EdgesGeometry(geo, 15)
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

function createOrbitRing(radius: number, tube: number, color: number, opacity = 0.4): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 10, 128),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
}

function createHelixLine(segments: number, color: number, opacity: number): THREE.Line {
  const geometry = new THREE.BufferGeometry()
  const positions = new Float32Array((segments + 1) * 3)
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
    }),
  )
}

function updateHelix(line: THREE.Line, elapsed: number, phase: number, tightness: number) {
  const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute
  const count = attr.count
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const angle = t * Math.PI * tightness + elapsed * 0.65 + phase
    const r = 1.6 + t * 2.4
    const y = (t - 0.5) * 4.8
    attr.setXYZ(i, Math.cos(angle) * r, y, Math.sin(angle) * r * 0.78)
  }
  attr.needsUpdate = true
}

function createHexPlatform(): THREE.Group {
  const platform = new THREE.Group()
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5, 6.2, 0.35, 6),
    new THREE.MeshStandardMaterial({
      color: 0x0a1420,
      emissive: 0x1a5060,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.25,
    }),
  )
  base.position.y = -4.65

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(5.8, 0.06, 6, 48),
    new THREE.MeshBasicMaterial({
      color: 0x3a8898,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = -4.45

  platform.add(base, ring)
  return platform
}

/** 科幻首页 — Nexus 核心（稳定 elapsed 驱动动画） */
export function createSciFiScene(ctx?: SciFiSceneContext): SciFiSceneHandle {
  const group = new THREE.Group()
  group.name = 'SciFiHome'

  let envMap: THREE.Texture | null = null
  let pmrem: THREE.PMREMGenerator | null = null
  if (ctx) {
    pmrem = new THREE.PMREMGenerator(ctx.renderer)
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    ctx.scene.environment = envMap
    ctx.scene.environmentIntensity = 0.75
  }

  const grid = new THREE.GridHelper(130, 65, 0x2a6878, 0x0a1218)
  grid.position.set(CORE_X, -10, CORE_Z)
  group.add(grid)

  const gridGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 110),
    new THREE.MeshBasicMaterial({
      color: 0x1a5060,
      transparent: true,
      opacity: 0.045,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  gridGlow.rotation.x = -Math.PI / 2
  gridGlow.position.set(CORE_X, -9.99, CORE_Z)
  group.add(gridGlow)

  group.add(createStarField())

  const core = new THREE.Group()
  core.position.set(CORE_X, CORE_Y, CORE_Z)

  const glowOuter = new THREE.Mesh(
    new THREE.SphereGeometry(6.8, 32, 32),
    new THREE.MeshBasicMaterial({
      color: 0x1a6080,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  )

  const glowInner = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x2a8898,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  )

  const nucleus = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.2, 3),
    new THREE.MeshPhysicalMaterial({
      color: 0x060c14,
      emissive: 0x18a0b8,
      emissiveIntensity: 0.8,
      metalness: 0.95,
      roughness: 0.06,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMap: envMap ?? undefined,
      envMapIntensity: 1.2,
    }),
  )

  const innerSolid = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.35, 0),
    new THREE.MeshStandardMaterial({
      color: 0x0a1828,
      emissive: 0x44ccff,
      emissiveIntensity: 1.2,
      metalness: 0.9,
      roughness: 0.1,
    }),
  )

  const cageInner = createWirePoly(3, 2, 0x66d0f0, 0.5)
  const cageMid = createWirePoly(4.2, 1, 0x5888b8, 0.28)
  const cageOuter = createWirePoly(5.6, 1, 0x8868a8, 0.14)

  const helixA = createHelixLine(72, 0x55ccff, 0.35)
  const helixB = createHelixLine(72, 0x9977cc, 0.28)

  const rings = [
    { mesh: createOrbitRing(5.8, 0.04, 0x3aa8c0, 0.45), tiltX: Math.PI / 2.4, tiltZ: 0, speed: 0.3 },
    { mesh: createOrbitRing(7.5, 0.032, 0x5878c0, 0.38), tiltX: Math.PI / 3.5, tiltZ: 0.55, speed: -0.24 },
    { mesh: createOrbitRing(9.2, 0.026, 0x7858a8, 0.32), tiltX: Math.PI / 2.1, tiltZ: 1.1, speed: 0.18 },
    { mesh: createOrbitRing(11.5, 0.02, 0x3a6878, 0.22), tiltX: Math.PI / 1.7, tiltZ: 0.3, speed: -0.14 },
  ]
  rings.forEach(({ mesh, tiltX, tiltZ }) => {
    mesh.rotation.x = tiltX
    mesh.rotation.z = tiltZ
    core.add(mesh)
  })

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 1.1, 13, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x2a8898,
      transparent: true,
      opacity: 0.11,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  beam.position.y = -6.5

  const scanBand = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.025, 6, 64),
    new THREE.MeshBasicMaterial({
      color: 0x88eeff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )

  const instCount = 120
  const instGeo = new THREE.SphereGeometry(0.055, 5, 5)
  const instMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexColors: true,
  })
  const orbitDots = new THREE.InstancedMesh(instGeo, instMat, instCount)
  const instanceColors = new Float32Array(instCount * 3)
  const colorA = new THREE.Color(0x55ccff)
  const colorB = new THREE.Color(0xaa77dd)
  for (let i = 0; i < instCount; i++) {
    const c = colorA.clone().lerp(colorB, (i % 4) / 3)
    instanceColors[i * 3] = c.r
    instanceColors[i * 3 + 1] = c.g
    instanceColors[i * 3 + 2] = c.b
  }
  orbitDots.instanceColor = new THREE.InstancedBufferAttribute(instanceColors, 3)

  const dummy = new THREE.Object3D()
  const pulseRings = [0, 0.33, 0.66].map((phase) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 1.58, 56),
      new THREE.MeshBasicMaterial({
        color: 0x3a8898,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -4.5
    ring.userData.phase = phase
    return ring
  })

  const pillars: THREE.Mesh[] = []
  for (let i = 0; i < 4; i++) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 3.5, 0.04),
      new THREE.MeshBasicMaterial({
        color: 0x44aacc,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    pillars.push(pillar)
    core.add(pillar)
  }

  const platform = createHexPlatform()

  const coreLight = new THREE.PointLight(0x3aa8c0, 34, 52)
  coreLight.position.set(1.5, 2, 2.5)
  const accentLight = new THREE.PointLight(0x6644aa, 18, 38)
  accentLight.position.set(-2.5, 1, -1.5)

  core.add(
    glowOuter,
    glowInner,
    nucleus,
    innerSolid,
    cageInner,
    cageMid,
    cageOuter,
    helixA,
    helixB,
    beam,
    scanBand,
    orbitDots,
    platform,
    ...pulseRings,
    coreLight,
    accentLight,
  )
  group.add(core)

  const rimLight = new THREE.DirectionalLight(0x4a8898, 0.45)
  rimLight.position.set(-18, 16, 12)
  group.add(rimLight)

  const update = (elapsed: number, _delta: number, pointerX = 0, pointerY = 0) => {
    const breathe = 1 + Math.sin(elapsed * 1.6) * 0.035
    nucleus.scale.setScalar(breathe)
    innerSolid.rotation.y = elapsed * 0.9
    innerSolid.rotation.x = elapsed * 0.5

    ;(nucleus.material as THREE.MeshPhysicalMaterial).emissiveIntensity =
      0.7 + Math.sin(elapsed * 2) * 0.2 + Math.abs(pointerX) * 0.1

    core.rotation.y = elapsed * 0.2 + pointerX * 0.07
    core.rotation.x = Math.sin(elapsed * 0.16) * 0.07 + pointerY * 0.035

    cageInner.rotation.y = -elapsed * 0.38
    cageInner.rotation.z = elapsed * 0.14
    cageMid.rotation.y = elapsed * 0.22
    cageMid.rotation.x = -elapsed * 0.08
    cageOuter.rotation.y = -elapsed * 0.12
    cageOuter.rotation.z = elapsed * 0.06

    updateHelix(helixA, elapsed, 0, 5)
    updateHelix(helixB, elapsed, Math.PI, 6.5)

    rings.forEach(({ mesh, speed }) => {
      mesh.rotation.y = elapsed * speed
    })

    scanBand.rotation.x = elapsed * 0.7
    scanBand.rotation.y = elapsed * 0.45
    scanBand.position.y = Math.sin(elapsed * 1.2) * 0.35

    glowOuter.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.06)
    glowInner.scale.setScalar(1 + Math.sin(elapsed * 1.8 + 1) * 0.04)
    ;(glowOuter.material as THREE.MeshBasicMaterial).opacity =
      0.04 + Math.sin(elapsed * 1.6) * 0.02

    coreLight.intensity = 30 + Math.sin(elapsed * 2.1) * 9
    accentLight.intensity = 14 + Math.sin(elapsed * 1.7 + 1) * 6

    pulseRings.forEach((ring) => {
      const phase = (elapsed * 0.26 + (ring.userData.phase as number)) % 1
      const scale = 1 + phase * 4
      ring.scale.set(scale, scale, 1)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = (1 - phase) * 0.3
    })

    pillars.forEach((pillar, i) => {
      const angle = elapsed * 0.25 + (i / 4) * Math.PI * 2
      const r = 4.2
      pillar.position.set(Math.cos(angle) * r, 0.5, Math.sin(angle) * r * 0.75)
      pillar.rotation.y = -angle
      ;(pillar.material as THREE.MeshBasicMaterial).opacity =
        0.18 + Math.sin(elapsed * 2 + i) * 0.1
    })

    for (let i = 0; i < instCount; i++) {
      const band = i % 4
      const t = i / instCount
      const angle = elapsed * (0.4 + band * 0.08) + t * Math.PI * 2
      const r = 5 + band * 1.6 + Math.sin(elapsed * 1.5 + i * 0.1) * 0.12
      const y = Math.sin(angle * 1.5 + i * 0.15) * (1 + band * 0.35)
      dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r * 0.7)
      dummy.scale.setScalar(0.7 + band * 0.12)
      dummy.updateMatrix()
      orbitDots.setMatrixAt(i, dummy.matrix)
    }
    orbitDots.instanceMatrix.needsUpdate = true
  }

  const dispose = () => {
    disposeObject3D(group)
    envMap?.dispose()
    pmrem?.dispose()
  }

  return { group, core, update, dispose }
}

export { CORE_X, CORE_Y, CORE_Z }
