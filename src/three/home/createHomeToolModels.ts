import * as THREE from 'three'
import type { HomeToolId } from './homeToolIds'
import { HOME_ACTIVE_TOOLS } from './homeToolIds'
import { disposeObject3D } from '../utils/dispose'

export interface HomeToolModelsHandle {
  group: THREE.Group
  getPickMeshes: () => THREE.Object3D[]
  setExpanded: (expanded: boolean) => void
  setHovered: (id: HomeToolId | null) => void
  setOrbitRotation: (y: number, x: number) => void
  resetOrbitRotation: () => void
  setGlowIntensity: (intensity: number) => void
  update: (elapsed: number, delta: number) => void
  getToolIdFromObject: (obj: THREE.Object3D) => HomeToolId | null
  canPick: () => boolean
  getScreenTargets: (
    camera: THREE.Camera,
    canvasRect: DOMRect,
  ) => { id: HomeToolId; left: number; top: number; width: number; height: number }[]
  dispose: () => void
}

interface ToolSlot {
  id: HomeToolId
  mesh: THREE.Group
  rest: THREE.Vector3
  ringAngle: number
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial
}

/** 工具展示布局（单工具时居中悬浮，多工具时围成圆环） */
export const TOOL_RING_RADIUS = 1.12
export const TOOL_RING_CENTER_Y = 0.52
export const TOOL_RING_START_ANGLE = Math.PI * 0.55
export const TOOL_RING_DEFAULT_TILT_X = 0.48

const TOOL_IDS = HOME_ACTIVE_TOOLS

function buildRingLayout(): { id: HomeToolId; rest: THREE.Vector3; ringAngle: number }[] {
  const n = TOOL_IDS.length
  if (n === 1) {
    const id = TOOL_IDS[0]!
    return [{ id, rest: new THREE.Vector3(0, 0.28, 0.58), ringAngle: 0 }]
  }
  return TOOL_IDS.map((id, i) => {
    const ringAngle = TOOL_RING_START_ANGLE + (i / n) * Math.PI * 2
    const rest = new THREE.Vector3(
      Math.cos(ringAngle) * TOOL_RING_RADIUS,
      0,
      Math.sin(ringAngle) * TOOL_RING_RADIUS,
    )
    return { id, rest, ringAngle }
  })
}

function baseMat(color: number, emissive = 0x1a3040, envMap?: THREE.Texture | null): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.2,
    metalness: 0.72,
    roughness: 0.32,
    envMap: envMap ?? undefined,
    envMapIntensity: 0.95,
    fog: false,
  })
}

function buildToolModel(
  id: HomeToolId,
  envMap?: THREE.Texture | null,
): { group: THREE.Group; mat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group()
  group.userData.toolId = id

  let mat = baseMat(0x588098, 0x1a3040, envMap)

  switch (id) {
    case 'zip-compress': {
      mat = baseMat(0x5a8898, 0x1a3848, envMap)
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.26), mat)
      b1.position.y = 0.11
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.28), mat)
      b2.position.y = 0.28
      group.add(b1, b2)
      break
    }
    case 'zip-extract': {
      mat = new THREE.MeshPhysicalMaterial({
        color: 0x4a7888,
        emissive: 0x1a3848,
        emissiveIntensity: 0.28,
        metalness: 0.78,
        roughness: 0.26,
        clearcoat: 0.55,
        clearcoatRoughness: 0.25,
        envMap: envMap ?? undefined,
        envMapIntensity: 1,
        fog: false,
      })

      const archive = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.32), mat)
      archive.position.y = 0.15

      const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.045, 0.34), mat)
      band.position.set(0, 0.26, 0)

      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.035, 0.24), mat)
      flap.position.set(0, 0.32, -0.08)
      flap.rotation.x = -0.92

      const zipTrack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.022, 0.045), mat)
      zipTrack.position.set(0, 0.3, 0.1)

      const zipPull = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.02), mat)
      zipPull.position.set(0.12, 0.3, 0.12)

      const chip = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.09, 0.014),
        new THREE.MeshStandardMaterial({
          color: 0x6aa8b8,
          emissive: 0x2a6878,
          emissiveIntensity: 0.4,
          metalness: 0.65,
          roughness: 0.3,
          envMap: envMap ?? undefined,
          envMapIntensity: 0.95,
          fog: false,
        }),
      )
      chip.position.set(-0.1, 0.2, 0.162)

      group.add(archive, band, flap, zipTrack, zipPull, chip)
      break
    }
    case 'file-preview': {
      mat = baseMat(0x5a8898, 0x1a3848, envMap)
      const page = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.018), mat)
      page.position.y = 0.19

      const lineMat = baseMat(0x6aa0b0, 0x204858, envMap)
      const lines = [0.26, 0.2, 0.14].map((y) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.018, 0.02), lineMat)
        line.position.set(0, y, 0.012)
        return line
      })

      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 10, 28), mat)
      lens.position.set(0.14, 0.1, 0.05)
      lens.rotation.x = Math.PI / 2

      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.02), mat)
      handle.position.set(0.22, 0.02, 0.05)
      handle.rotation.z = -0.55

      group.add(page, ...lines, lens, handle)
      break
    }
    case 'timestamp': {
      mat = baseMat(0x588890, 0x183840, envMap)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 10, 32), mat)
      ring.rotation.x = Math.PI / 2
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.14, 0.018), mat)
      hand.position.y = 0.05
      group.add(ring, hand)
      break
    }
    case 'uuid': {
      mat = baseMat(0x6890a0, 0x203848, envMap)
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.24), mat)
      const pins = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.06), mat)
      pins.position.set(0, -0.05, 0.1)
      group.add(chip, pins)
      break
    }
    case 'color': {
      mat = baseMat(0x58a0b8, 0x1a3848, envMap)
      mat.emissive.set(0x3388aa)
      mat.emissiveIntensity = 0.28
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), mat)
      group.add(sphere)
      break
    }
    case 'copy-link': {
      mat = baseMat(0x568088, 0x1a3040, envMap)
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 20), mat)
      ring.rotation.y = Math.PI / 4
      const ring2 = ring.clone()
      ring2.rotation.y = -Math.PI / 4
      ring2.position.x = 0.12
      group.add(ring, ring2)
      break
    }
    case 'goto-game':
    case 'goto-world':
    case 'goto-draw': {
      const colors = {
        'goto-game': 0x4a7888,
        'goto-world': 0x506880,
        'goto-draw': 0x588898,
      } as const
      mat = baseMat(colors[id], 0x1a3848, envMap)
      mat.emissiveIntensity = 0.24
      const portal = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 6), mat)
      portal.rotation.x = Math.PI / 2
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.08, 0),
        new THREE.MeshStandardMaterial({
          color: 0x88b8c8,
          emissive: 0x2a6878,
          emissiveIntensity: 0.38,
          metalness: 0.68,
          roughness: 0.28,
          envMap: envMap ?? undefined,
          envMapIntensity: 0.95,
          fog: false,
        }),
      )
      group.add(portal, core)
      break
    }
  }

  group.traverse((c) => {
    if (c instanceof THREE.Mesh && !c.userData.toolId) c.userData.toolId = id
  })

  return { group, mat }
}

/** 工具箱展开后的 3D 工具模型 */
export function createHomeToolModels(envMap?: THREE.Texture | null): HomeToolModelsHandle {
  const group = new THREE.Group()
  group.name = 'HomeToolModels'
  group.visible = false
  group.frustumCulled = false
  group.renderOrder = 20

  const orbitPivot = new THREE.Group()
  orbitPivot.name = 'HomeToolsOrbit'
  orbitPivot.position.y = TOOL_RING_CENTER_Y
  orbitPivot.rotation.order = 'YXZ'
  orbitPivot.rotation.x = TOOL_RING_DEFAULT_TILT_X
  group.add(orbitPivot)

  const toolGlow = new THREE.PointLight(0x6a98a8, 0, 3.8)
  toolGlow.position.set(0, 0.08, 0.28)
  orbitPivot.add(toolGlow)

  const collapseOrigin = new THREE.Vector3(0, 0, 0)

  const slots: ToolSlot[] = buildRingLayout().map(({ id, rest, ringAngle }) => {
    const { group: mesh, mat } = buildToolModel(id, envMap)
    mesh.position.copy(collapseOrigin)
    mesh.scale.setScalar(0.001)
    orbitPivot.add(mesh)
    return { id, mesh, rest, ringAngle, mat }
  })

  let expanded = false
  let expandT = 0
  let hovered: HomeToolId | null = null

  const setOrbitRotation = (y: number, x: number) => {
    orbitPivot.rotation.y = y
    orbitPivot.rotation.x = x
    orbitPivot.rotation.z = 0
  }

  const resetOrbitRotation = () => {
    orbitPivot.rotation.y = 0
    orbitPivot.rotation.x = TOOL_RING_DEFAULT_TILT_X
    orbitPivot.rotation.z = 0
  }

  const setGlowIntensity = (intensity: number) => {
    toolGlow.intensity = intensity
  }

  const setExpanded = (value: boolean) => {
    expanded = value
    if (value) {
      expandT = Math.max(expandT, 0.35)
      group.visible = true
    } else {
      resetOrbitRotation()
    }
  }

  const setHovered = (id: HomeToolId | null) => {
    hovered = id
  }

  const getToolIdFromObject = (obj: THREE.Object3D): HomeToolId | null => {
    let cur: THREE.Object3D | null = obj
    while (cur) {
      const id = cur.userData.toolId as HomeToolId | undefined
      if (id) return id
      cur = cur.parent
    }
    return null
  }

  const update = (elapsed: number, delta: number) => {
    const target = expanded ? 1 : 0
    const dt = Math.max(delta, 1 / 120)
    expandT += (target - expandT) * Math.min(1, dt * 10)
    group.visible = expanded || expandT > 0.02

    const ease = 1 - Math.pow(1 - expandT, 3)

    slots.forEach((slot, i) => {
      const single = slots.length === 1
      const phase = elapsed * 1.4 + i * 0.35
      const floatY = Math.sin(phase) * (single ? 0.035 : 0.025) * ease
      slot.mesh.position.lerpVectors(collapseOrigin, slot.rest, ease)
      slot.mesh.position.y += floatY
      const s = THREE.MathUtils.lerp(0.05, single ? 1.35 : 1.08, ease)
      slot.mesh.scale.setScalar(s)
      slot.mesh.rotation.y = single
        ? Math.sin(elapsed * 0.55) * 0.18
        : Math.atan2(slot.rest.x, slot.rest.z)

      const isHover = hovered === slot.id
      slot.mat.emissiveIntensity = 0.18 + (isHover ? 0.32 : 0) + ease * 0.2
      if (slot.id === 'color') {
        slot.mat.emissiveIntensity += 0.12 * ease
        slot.mat.emissive.setHSL((elapsed * 0.05) % 1, 0.5, 0.32)
      }
    })
  }

  const worldPos = new THREE.Vector3()
  const ndc = new THREE.Vector3()

  const canPick = () => expanded

  const getScreenTargets = (camera: THREE.Camera, canvasRect: DOMRect) => {
    if (!canPick() || expandT < 0.32) return []

    group.updateMatrixWorld(true)
    const radius = 56
    const targets: { id: HomeToolId; left: number; top: number; width: number; height: number }[] =
      []

    for (const slot of slots) {
      slot.mesh.getWorldPosition(worldPos)
      ndc.copy(worldPos).project(camera)
      if (ndc.z > 1) continue

      const cx = (ndc.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left
      const cy = (-ndc.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) continue

      targets.push({
        id: slot.id,
        left: cx - radius,
        top: cy - radius,
        width: radius * 2,
        height: radius * 2,
      })
    }

    return targets
  }

  const getPickMeshes = () => slots.map((slot) => slot.mesh)

  const dispose = () => {
    disposeObject3D(group)
  }

  return {
    group,
    getPickMeshes,
    setExpanded,
    setHovered,
    setOrbitRotation,
    resetOrbitRotation,
    setGlowIntensity,
    update,
    getToolIdFromObject,
    canPick,
    getScreenTargets,
    dispose,
  }
}
