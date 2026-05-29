import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export interface PostProcessing {
  composer: EffectComposer
  resize: (width: number, height: number) => void
  dispose: () => void
}

/** 后期：轻微 Bloom 提升画面层次 */
export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): PostProcessing {
  const composer = new EffectComposer(renderer)

  composer.addPass(new RenderPass(scene, camera))

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.22,
    0.45,
    0.82,
  )
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  return {
    composer,
    resize: (w, h) => {
      composer.setSize(w, h)
      bloom.resolution.set(w, h)
    },
    dispose: () => {
      composer.dispose()
    },
  }
}
