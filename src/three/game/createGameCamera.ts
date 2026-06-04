import * as THREE from 'three'
import type { PlayerHandle } from './createPlayer'

export interface GameCameraHandle {
  camera: THREE.PerspectiveCamera
  update: (delta: number) => void
  addYaw: (deltaYaw: number) => void
  addPitch: (deltaPitch: number) => void
  zoom: (delta: number) => void
  getYaw: () => number
}

/** 第三人称跟随相机（平滑 + 缩放） */
export function createGameCamera(
  width: number,
  height: number,
  player: PlayerHandle,
): GameCameraHandle {
  const camera = new THREE.PerspectiveCamera(50, width / height, 0.5, 1200)

  let yaw = Math.PI * 0.25
  let pitch = 0.38
  let distance = 17
  const lookOffset = new THREE.Vector3(0, 1.95, 0)
  const currentPos = new THREE.Vector3()
  const desiredPos = new THREE.Vector3()
  const target = new THREE.Vector3()

  const update = (delta: number) => {
    target.copy(player.position).add(lookOffset)

    desiredPos.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      target.y + Math.sin(pitch) * distance + 6,
      target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    )

    const followSpeed = player.isMoving ? 10 : 6
    currentPos.lerp(desiredPos, 1 - Math.exp(-followSpeed * delta))
    camera.position.copy(currentPos)
    camera.lookAt(target)
  }

  const addYaw = (deltaYaw: number) => {
    yaw += deltaYaw
  }

  const addPitch = (deltaPitch: number) => {
    pitch = THREE.MathUtils.clamp(pitch + deltaPitch, 0.18, 0.62)
  }

  const zoom = (delta: number) => {
    distance = THREE.MathUtils.clamp(distance + delta * 0.04, 10, 32)
  }

  update(1)

  return { camera, update, addYaw, addPitch, zoom, getYaw: () => yaw }
}
