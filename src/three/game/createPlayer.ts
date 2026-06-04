import * as THREE from 'three'
import { createStandardMaterial } from '../utils/materials'
import { sampleGroundHeight } from '../terrain/sampleGroundHeight'

export interface PlayerHandle {
  group: THREE.Group
  position: THREE.Vector3
  yaw: number
  isMoving: boolean
  setPosition: (x: number, z: number) => void
  move: (dx: number, dz: number, delta: number) => void
  update: (elapsed: number, delta: number) => void
  setEnergyVisible: (visible: boolean) => void
  dispose: () => void
}

const WORLD_LIMIT = 95
const MAX_SPEED = 20
const ACCEL = 38
const DECEL = 52

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.rotation.set(rx, ry, rz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** 探索员角色：防护服、头盔、背包、能量环 */
export function createPlayer(spawnX = 0, spawnZ = 18): PlayerHandle {
  const group = new THREE.Group()
  group.name = 'Player'

  const body = new THREE.Group()
  body.name = 'Body'

  const suitMat = createStandardMaterial({ color: 0x3a5068, roughness: 0.75, metalness: 0.15 })
  const darkMat = createStandardMaterial({ color: 0x1a2838, roughness: 0.85 })
  const visorMat = createStandardMaterial({
    color: 0x88ccff,
    roughness: 0.1,
    metalness: 0.6,
    emissive: 0x226688,
    emissiveIntensity: 0.35,
  })
  const packMat = createStandardMaterial({ color: 0x2a3848, roughness: 0.8, metalness: 0.2 })

  addMesh(body, new THREE.CylinderGeometry(0.5, 0.62, 1.35, 10), suitMat, 0, 0.85, 0)
  addMesh(body, new THREE.BoxGeometry(0.52, 0.42, 0.36), suitMat, 0, 1.55, 0)
  addMesh(body, new THREE.SphereGeometry(0.36, 14, 14), darkMat, 0, 2.05, 0)
  addMesh(body, new THREE.BoxGeometry(0.44, 0.14, 0.22), visorMat, 0, 2.02, 0.22)

  addMesh(body, new THREE.BoxGeometry(0.22, 0.55, 0.28), packMat, 0, 1.35, -0.38)
  addMesh(body, new THREE.CylinderGeometry(0.04, 0.04, 0.35, 6), visorMat, 0.12, 1.75, -0.38, 0.3, 0, 0)

  addMesh(body, new THREE.BoxGeometry(0.18, 0.55, 0.14), suitMat, -0.55, 1.2, 0, 0, 0, 0.2)
  addMesh(body, new THREE.BoxGeometry(0.18, 0.55, 0.14), suitMat, 0.55, 1.2, 0, 0, 0, -0.2)

  const aura = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.05, 32),
    new THREE.MeshBasicMaterial({
      color: 0x55aacc,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  )
  aura.rotation.x = -Math.PI / 2
  aura.position.y = 0.06

  const energyCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0x88ddff,
      emissive: 0x3399cc,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
    }),
  )
  energyCore.position.set(0.38, 1.45, 0.25)
  energyCore.visible = false

  group.add(body, aura, energyCore)

  const position = new THREE.Vector3()
  let yaw = 0
  let velocityX = 0
  let velocityZ = 0
  let isMoving = false
  let energyVisible = false

  const syncGround = () => {
    position.y = sampleGroundHeight(position.x, position.z) + 0.05
    group.position.copy(position)
    group.rotation.y = yaw
  }

  const setPosition = (x: number, z: number) => {
    position.x = THREE.MathUtils.clamp(x, -WORLD_LIMIT, WORLD_LIMIT)
    position.z = THREE.MathUtils.clamp(z, -WORLD_LIMIT, WORLD_LIMIT)
    syncGround()
  }

  setPosition(spawnX, spawnZ)

  const move = (dx: number, dz: number, delta: number) => {
    const inputLen = Math.hypot(dx, dz)
    let targetVx = 0
    let targetVz = 0

    if (inputLen > 0) {
      const nx = dx / inputLen
      const nz = dz / inputLen
      targetVx = nx * MAX_SPEED
      targetVz = nz * MAX_SPEED
      yaw = Math.atan2(nx, nz)
    }

    const rate = inputLen > 0 ? ACCEL : DECEL
    velocityX = THREE.MathUtils.damp(velocityX, targetVx, rate, delta)
    velocityZ = THREE.MathUtils.damp(velocityZ, targetVz, rate, delta)

    isMoving = Math.hypot(velocityX, velocityZ) > 0.15

    position.x = THREE.MathUtils.clamp(position.x + velocityX * delta, -WORLD_LIMIT, WORLD_LIMIT)
    position.z = THREE.MathUtils.clamp(position.z + velocityZ * delta, -WORLD_LIMIT, WORLD_LIMIT)
    syncGround()
  }

  const update = (elapsed: number, _delta: number) => {
    const bob = isMoving ? Math.sin(elapsed * 14) * 0.06 : 0
    const lean = isMoving ? 0.08 : 0
    body.position.y = bob
    body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, lean, 0.12)

    const pulse = 0.18 + Math.sin(elapsed * 3) * 0.06
    aura.scale.setScalar(1 + (isMoving ? Math.sin(elapsed * 10) * 0.05 : 0))
    ;(aura.material as THREE.MeshBasicMaterial).opacity = isMoving ? pulse + 0.1 : pulse

    energyCore.visible = energyVisible
    if (energyVisible) {
      energyCore.position.y = 1.45 + Math.sin(elapsed * 4) * 0.08
      energyCore.rotation.y = elapsed * 1.5
    }
  }

  const setEnergyVisible = (visible: boolean) => {
    energyVisible = visible
  }

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })
  }

  return {
    group,
    position,
    get yaw() {
      return yaw
    },
    get isMoving() {
      return isMoving
    },
    setPosition,
    move,
    update,
    dispose,
    setEnergyVisible,
  }
}
