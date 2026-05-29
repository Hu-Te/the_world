import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

import { createScene } from '../core/createScene'
import { createCamera } from '../core/createCamera'
import { createRenderer } from '../core/createRenderer'
import { createControls } from '../core/createControls'
import { createPostProcessing } from '../core/createPostProcessing'
import { loadRegisteredModels } from '../assets/modelLoader'
import { MODEL_PLACEMENTS } from '../assets/modelRegistry'
import { createCultivationWorld } from './createCultivationWorld'
import type { WorldHandle } from '../types'

export function mountCultivationWorld(container: HTMLElement): WorldHandle {
  const width = Math.max(container.clientWidth, 1)
  const height = Math.max(container.clientHeight, 1)

  const scene = createScene()
  const camera = createCamera(width, height)
  const renderer = createRenderer({ width, height })
  const controls = createControls(camera, renderer.domElement)

  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const environmentMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environmentMap
  scene.environmentIntensity = 0.65

  const postProcessing = createPostProcessing(renderer, scene, camera, width, height)

  container.appendChild(renderer.domElement)

  const world = createCultivationWorld(scene)

  void loadRegisteredModels(MODEL_PLACEMENTS, {
    modelsRoot: world.modelsRoot,
    getIslandGroup: world.getIslandGroup,
  }).then((models) => {
    world.loadedModels.push(...models)
  })

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
    dispose: () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)

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
