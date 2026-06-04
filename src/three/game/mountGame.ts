import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

import { createScene } from '../core/createScene'
import { createRenderer } from '../core/createRenderer'
import { createSimWorld } from '../world/createSimWorld'
import { createPlayer } from './createPlayer'
import { createGameCamera } from './createGameCamera'
import { createVillageMarkers } from './createVillageMarkers'
import { createGamePostProcessing } from './createGamePostProcessing'
import { createQiBurstUpdater } from './createQiBurst'
import {
  NODE_POIS,
  QUEST_TARGET,
  INTERACT_RADIUS,
  ENERGY_PER_NODE,
  MAX_ENERGY,
  getSyncTier,
} from '@/game/gameData'
import type { GameHandle, GameSnapshot } from '@/game/types'

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const

/** 页游模式：第三人称探索 + 节点交互 */
export function mountGame(container: HTMLElement): GameHandle {
  const width = Math.max(container.clientWidth, 1)
  const height = Math.max(container.clientHeight, 1)

  const scene = createScene()
  const renderer = createRenderer({ width, height })
  renderer.toneMappingExposure = 0.9
  container.appendChild(renderer.domElement)

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const environmentMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environmentMap
  scene.environmentIntensity = 0.9

  const player = createPlayer()
  scene.add(player.group)

  const markers = createVillageMarkers(NODE_POIS)
  scene.add(markers.group)

  const gameCamera = createGameCamera(width, height, player)
  const postProcessing = createGamePostProcessing(renderer, scene, gameCamera.camera, width, height)

  const world = createSimWorld(scene)

  const keys = new Set<string>()
  let pointerDown = false
  let lastPointerX = 0
  let lastPointerY = 0

  const visited = new Set<number>()
  let energy = 0
  let message = '进入模拟世界，接入三座节点收集能量。'
  let nearbyPoi: (typeof NODE_POIS)[number] | null = null
  let lastHintKey = ''
  let toastTimer = 0
  const burstUpdaters: Array<(delta: number) => boolean> = []

  const listeners = new Set<(snapshot: GameSnapshot) => void>()

  const buildSnapshot = (): GameSnapshot => ({
    tier: getSyncTier(energy),
    energy,
    maxEnergy: MAX_ENERGY,
    questProgress: Math.min(visited.size, QUEST_TARGET),
    questTarget: QUEST_TARGET,
    visitedCount: visited.size,
    message: toastTimer > 0 ? message : '',
    hint: nearbyPoi && !visited.has(nearbyPoi.id)
      ? `接入 ${nearbyPoi.name}`
      : 'WASD 移动 · 拖拽视角 · 滚轮缩放',
    canInteract: Boolean(nearbyPoi && !visited.has(nearbyPoi.id)),
    interactLabel: nearbyPoi ? nearbyPoi.name : '',
    playerX: player.position.x,
    playerZ: player.position.z,
    cameraYaw: gameCamera.getYaw(),
    nodes: NODE_POIS.map((poi) => ({
      id: poi.id,
      name: poi.name,
      visited: visited.has(poi.id),
    })),
  })

  const emit = () => {
    listeners.forEach((fn) => fn(buildSnapshot()))
  }

  const interact = () => {
    if (!nearbyPoi || visited.has(nearbyPoi.id)) return

    visited.add(nearbyPoi.id)
    energy = Math.min(MAX_ENERGY, energy + ENERGY_PER_NODE)
    player.setEnergyVisible(energy >= 30)
    toastTimer = 4

    message =
      visited.size >= QUEST_TARGET
        ? `链路贯通！接入 ${nearbyPoi.name}，同步等级提升至 ${getSyncTier(energy)}。`
        : `${nearbyPoi.name} 已接入，能量 +${ENERGY_PER_NODE}`

    burstUpdaters.push(
      createQiBurstUpdater(scene, player.position.x, player.position.y, player.position.z),
    )

    emit()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if ((MOVE_KEYS as readonly string[]).includes(e.code)) {
      keys.add(e.code)
      e.preventDefault()
    }
    if (e.code === 'KeyE') interact()
  }

  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    pointerDown = true
    lastPointerX = e.clientX
    lastPointerY = e.clientY
  }

  const onPointerUp = () => {
    pointerDown = false
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!pointerDown) return
    const dx = e.clientX - lastPointerX
    const dy = e.clientY - lastPointerY
    lastPointerX = e.clientX
    lastPointerY = e.clientY
    gameCamera.addYaw(-dx * 0.004)
    gameCamera.addPitch(-dy * 0.003)
  }

  const onWheel = (e: WheelEvent) => {
    gameCamera.zoom(e.deltaY)
    e.preventDefault()
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

  const clock = new THREE.Clock()
  let animationId = 0

  const render = () => {
    animationId = requestAnimationFrame(render)
    const delta = clock.getDelta()
    const elapsed = clock.getElapsedTime()

    if (toastTimer > 0) {
      toastTimer = Math.max(0, toastTimer - delta)
    }

    let dx = 0
    let dz = 0
    if (keys.has('KeyW')) dz -= 1
    if (keys.has('KeyS')) dz += 1
    if (keys.has('KeyA')) dx -= 1
    if (keys.has('KeyD')) dx += 1

    if (dx !== 0 || dz !== 0) {
      const yaw = gameCamera.getYaw()
      const sin = Math.sin(yaw)
      const cos = Math.cos(yaw)
      player.move(dx * cos + dz * sin, -dx * sin + dz * cos, delta)
    } else {
      player.move(0, 0, delta)
    }

    nearbyPoi = null
    let bestDist = INTERACT_RADIUS
    for (const poi of NODE_POIS) {
      const dist = Math.hypot(player.position.x - poi.x, player.position.z - poi.z)
      if (dist < bestDist) {
        bestDist = dist
        nearbyPoi = poi
      }
    }

    player.update(elapsed, delta)
    markers.update(elapsed, nearbyPoi?.id ?? null, visited)

    for (let i = burstUpdaters.length - 1; i >= 0; i--) {
      const tick = burstUpdaters[i]
      if (tick && !tick(delta)) burstUpdaters.splice(i, 1)
    }

    const hintKey = `${nearbyPoi?.id ?? 'none'}-${visited.has(nearbyPoi?.id ?? -1)}-${Math.round(player.position.x)}-${Math.round(player.position.z)}`
    if (hintKey !== lastHintKey || toastTimer > 0) {
      lastHintKey = hintKey
      emit()
    }

    world.update?.(elapsed, delta)
    gameCamera.update(delta)
    postProcessing.composer.render()
  }

  render()
  emit()

  const onResize = () => {
    const w = Math.max(container.clientWidth, 1)
    const h = Math.max(container.clientHeight, 1)
    gameCamera.camera.aspect = w / h
    gameCamera.camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    postProcessing.resize(w, h)
  }
  window.addEventListener('resize', onResize)

  return {
    getSnapshot: buildSnapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      listener(buildSnapshot())
      return () => listeners.delete(listener)
    },
    dispose: () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('wheel', onWheel)

      listeners.clear()
      markers.dispose()
      player.dispose()
      world.teardownScene(scene)
      world.dispose()
      postProcessing.dispose()

      scene.environment = null
      environmentMap.dispose()
      pmremGenerator.dispose()
      renderer.dispose()

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
  }
}
