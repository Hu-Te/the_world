import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

import { createScene } from '../core/createScene'
import { createCamera } from '../core/createCamera'
import { createRenderer } from '../core/createRenderer'
import { createControls } from '../core/createControls'
import { createPostProcessing } from '../core/createPostProcessing'
import type { ModelPlacement } from '../assets/modelRegistry'
import type { WorldHandle } from '../types'
import { createSimWorld } from './createSimWorld'
import type { GestureControlHandle } from '../controls/createGestureControl'

export interface MountWorldOptions {
  /** 可选：覆盖默认 GLB 模型清单 */
  modelPlacements?: ModelPlacement[]
  /** 是否允许鼠标交互（首页背景建议 false） */
  interactive?: boolean
  /** 自动旋转 */
  autoRotate?: boolean
  /** 启用手势控制模块（需用户授权摄像头） */
  gestureControl?: boolean
}

/**
 * Three.js 模拟大世界 — 唯一挂载入口
 *
 * 整合：场景 / 相机 / 渲染器 / 后期 / 世界内容 / 模型加载 / 动画循环
 */
export function mountWorld(
  container: HTMLElement,
  options: MountWorldOptions = {},
): WorldHandle {
  const width = Math.max(container.clientWidth, 1)
  const height = Math.max(container.clientHeight, 1)

  const scene = createScene()
  const camera = createCamera(width, height)
  const renderer = createRenderer({ width, height })
  const controls = createControls(camera, renderer.domElement)
  controls.enabled = options.interactive ?? true
  controls.autoRotate = options.autoRotate ?? true

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const environmentMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environmentMap
  scene.environmentIntensity = 0.85

  const postProcessing = createPostProcessing(renderer, scene, camera, width, height)

  container.appendChild(renderer.domElement)

  const world = createSimWorld(scene, {
    modelPlacements: options.modelPlacements,
  })

  let gesture: GestureControlHandle | undefined
  let gestureImpl: GestureControlHandle | null = null
  const gestureReady = options.gestureControl
    ? import('../controls/createGestureControl').then(({ createGestureControl }) => {
        gestureImpl = createGestureControl({
          camera,
          controls,
          previewContainer: container,
        })
        return gestureImpl
      })
    : null

  if (gestureReady) {
    const ensureGesture = async () => gestureImpl ?? (await gestureReady)

    gesture = {
      start: async () => (await ensureGesture()).start(),
      stop: () => gestureImpl?.stop(),
      toggle: async () => (await ensureGesture()).toggle(),
      isActive: () => gestureImpl?.isActive() ?? false,
      dispose: () => gestureImpl?.dispose(),
    }
  }

  const clock = new THREE.Clock()
  let animationId = 0

  const render = () => {
    animationId = requestAnimationFrame(render)

    const delta = clock.getDelta()
    const elapsed = clock.getElapsedTime()

    world.update?.(elapsed, delta)
    controls.update()
    postProcessing.composer.render()
  }
  render()

  const onResize = () => {
    const w = Math.max(container.clientWidth, 1)
    const h = Math.max(container.clientHeight, 1)

    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    postProcessing.resize(w, h)
  }
  window.addEventListener('resize', onResize)

  return {
    gesture,
    dispose: () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)

      gesture?.dispose()
      world.teardownScene(scene)
      world.dispose()
      controls.dispose()
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

