import * as THREE from 'three'
import { loadGltfModel } from '../assets/modelLoader'
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
const PLAYER_GLB = '/models/player/nathan.glb'
const TARGET_HEIGHT = 2.3
/** 行走循环中手臂自然下垂的帧（秒），避免 stop() 回到 T-pose */
const IDLE_POSE_TIME = 0.05
/** 待机时上臂向身体收拢的角度（绕骨骼本地 Y 轴，左右同向） */
const IDLE_ARM_INWARD_DEG = 42

interface BoneCorrection {
  bone: THREE.Bone
  offset: THREE.Quaternion
}

type IdlePose = Map<THREE.Bone, THREE.Quaternion>

function findWalkClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  return (
    clips.find((c) => /walk/i.test(c.name)) ??
    clips.find((c) => /move/i.test(c.name)) ??
    clips[0] ??
    null
  )
}

function fitModelToGround(root: THREE.Object3D, targetHeight: number): void {
  const box = new THREE.Box3().setFromObject(root)
  const size = box.getSize(new THREE.Vector3())
  if (size.y <= 0) return

  const scale = targetHeight / size.y
  root.scale.setScalar(scale)

  box.setFromObject(root)
  root.position.y = -box.min.y
}

function buildIdleArmCorrections(root: THREE.Object3D): BoneCorrection[] {
  const corrections: BoneCorrection[] = []
  const inward = THREE.MathUtils.degToRad(IDLE_ARM_INWARD_DEG)
  const axis = new THREE.Vector3(0, 1, 0)

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Bone)) return
    const name = obj.name.toLowerCase()
    if (!name.includes('upperarm') || name.includes('twist')) return
    if (!name.endsWith('_l') && !name.endsWith('_r')) return

    corrections.push({
      bone: obj,
      offset: new THREE.Quaternion().setFromAxisAngle(axis, inward),
    })
  })

  return corrections
}

function applyIdleArmCorrections(corrections: BoneCorrection[]): void {
  for (const { bone, offset } of corrections) {
    bone.quaternion.multiply(offset)
  }
}

function captureBonePose(root: THREE.Object3D): IdlePose {
  const pose: IdlePose = new Map()
  root.traverse((obj) => {
    if (obj instanceof THREE.Bone) {
      pose.set(obj, obj.quaternion.clone())
    }
  })
  return pose
}

function applyIdlePose(root: THREE.Object3D, pose: IdlePose): void {
  for (const [bone, quat] of pose) {
    bone.quaternion.copy(quat)
  }
  root.traverse((obj) => {
    if (obj instanceof THREE.SkinnedMesh) {
      obj.skeleton.update()
    }
  })
}

/** 第三人称探索角色（GLB + 行走动画，加载失败时无模型占位） */
export function createPlayer(spawnX = 0, spawnZ = 18): PlayerHandle {
  const group = new THREE.Group()
  group.name = 'Player'

  const body = new THREE.Group()
  body.name = 'Avatar'

  const energyCore = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({
      color: 0x88ddff,
      emissive: 0x3399cc,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: 0.92,
    }),
  )
  energyCore.position.set(0.55, 1.85, 0.25)
  energyCore.visible = false

  group.add(body, energyCore)

  const position = new THREE.Vector3()
  let yaw = 0
  let velocityX = 0
  let velocityZ = 0
  let isMoving = false
  let energyVisible = false

  let avatarUpdate: (delta: number) => void = () => {}
  let walkAction: THREE.AnimationAction | null = null
  let avatarDispose: (() => void) | null = null
  let avatarLoaded = false
  let idlePose: IdlePose | null = null
  let avatarRoot: THREE.Object3D | null = null
  let wasMoving = false

  void loadGltfModel({
    url: PLAYER_GLB,
    name: 'Nathan',
    autoPlay: false,
  })
    .then((model) => {
      fitModelToGround(model.root, TARGET_HEIGHT)
      body.add(model.root)
      avatarRoot = model.root
      avatarLoaded = true
      avatarDispose = model.dispose

      const clip = findWalkClip(model.animations)
      if (model.mixer && clip) {
        walkAction = model.mixer.clipAction(clip)
        walkAction.setLoop(THREE.LoopRepeat, Infinity)
        walkAction.play()
        walkAction.time = IDLE_POSE_TIME
        model.update(0)
        applyIdleArmCorrections(buildIdleArmCorrections(model.root))
        idlePose = captureBonePose(model.root)
        walkAction.paused = true
      }

      avatarUpdate = (delta: number) => {
        model.update(delta)
      }
    })
    .catch((err) => {
      console.warn('[player] GLB 加载失败，使用占位:', err)
    })

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

  const update = (elapsed: number, delta: number) => {
    const speed = Math.hypot(velocityX, velocityZ) / MAX_SPEED

    if (isMoving) {
      if (walkAction) {
        if (!wasMoving) {
          walkAction.time = IDLE_POSE_TIME
        }
        walkAction.paused = false
        walkAction.timeScale = THREE.MathUtils.lerp(0.85, 1.35, speed)
        if (!walkAction.isRunning()) walkAction.play()
      }
      avatarUpdate(delta)
    } else if (avatarRoot && idlePose) {
      if (walkAction) {
        walkAction.paused = true
        walkAction.timeScale = 0
      }
      applyIdlePose(avatarRoot, idlePose)
    }

    wasMoving = isMoving

    energyCore.visible = energyVisible && avatarLoaded
    if (energyVisible) {
      energyCore.position.y = 1.85 + Math.sin(elapsed * 4) * 0.08
      energyCore.rotation.y = elapsed * 1.8
    }
  }

  const setEnergyVisible = (visible: boolean) => {
    energyVisible = visible
  }

  const dispose = () => {
    avatarDispose?.()
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
