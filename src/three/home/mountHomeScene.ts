import * as THREE from 'three'
import { createRenderer } from '../core/createRenderer'
import { createSciFiScene, CORE_X, CORE_Y, CORE_Z } from './createSciFiScene'
import { createSciFiPostProcessing } from './createSciFiPostProcessing'
import type { Disposer } from '../types'

export interface HomeSceneHandle {
  dispose: Disposer
  setScrollProgress: (progress: number) => void
}

/** 科幻风首页 3D 背景 */
export function mountHomeScene(container: HTMLElement): HomeSceneHandle {
  const width = Math.max(container.clientWidth, 1)
  const height = Math.max(container.clientHeight, 1)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x03060c)
  scene.fog = new THREE.FogExp2(0x03060c, 0.007)

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500)

  const renderer = createRenderer({ width, height })
  renderer.toneMappingExposure = 0.9
  container.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0x1a2840, 0.38))

  const sciFi = createSciFiScene({ scene, renderer })
  scene.add(sciFi.group)

  const postProcessing = createSciFiPostProcessing(renderer, scene, camera, width, height)

  let pointerX = 0
  let pointerY = 0
  let targetX = 0
  let targetY = 0
  let scrollProgress = 0
  let visible = !document.hidden

  const focus = new THREE.Vector3(CORE_X, CORE_Y, CORE_Z)

  const onPointerMove = (e: PointerEvent) => {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 2
    pointerY = (e.clientY / window.innerHeight - 0.5) * 2
  }

  const onVisibility = () => {
    visible = !document.hidden
    if (visible) clock.getDelta()
  }

  window.addEventListener('pointermove', onPointerMove)
  document.addEventListener('visibilitychange', onVisibility)

  const clock = new THREE.Clock()
  let animationId = 0

  const render = () => {
    animationId = requestAnimationFrame(render)
    if (!visible) return

    const elapsed = clock.getElapsedTime()
    const delta = clock.getDelta()

    targetX += (pointerX - targetX) * 0.035
    targetY += (pointerY - targetY) * 0.035

    const orbitRadius = 34 - scrollProgress * 8
    const orbitAngle = elapsed * 0.075 + scrollProgress * 0.4
    const lookY = focus.y + targetY * 1.5 - scrollProgress * 2

    camera.position.x = focus.x + Math.sin(orbitAngle) * orbitRadius + targetX * 4
    camera.position.z = focus.z + Math.cos(orbitAngle) * orbitRadius + 28
    camera.position.y = 12 + targetY * 3 + Math.sin(elapsed * 0.3) * 0.8 - scrollProgress * 6
    camera.lookAt(focus.x + targetX * 2, lookY, focus.z)

    sciFi.core.position.y = focus.y + Math.sin(elapsed * 0.5) * 0.25 - scrollProgress * 1.5
    sciFi.update(elapsed, delta, targetX, targetY)
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
    setScrollProgress: (progress) => {
      scrollProgress = THREE.MathUtils.clamp(progress, 0, 1)
    },
    dispose: () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('visibilitychange', onVisibility)

      sciFi.dispose()
      postProcessing.dispose()

      scene.environment = null
      renderer.dispose()

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
  }
}
