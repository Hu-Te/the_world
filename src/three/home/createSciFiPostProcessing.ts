import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export interface SciFiPostProcessing {
  composer: EffectComposer
  resize: (width: number, height: number) => void
  dispose: () => void
}

export interface SciFiPostProcessingOptions {
  mobile?: boolean
}

/** 科幻首页 Bloom 后期 */
export function createSciFiPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
  options: SciFiPostProcessingOptions = {},
): SciFiPostProcessing {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const mobile = options.mobile ?? false
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    mobile ? 0.26 : 0.36,
    mobile ? 0.38 : 0.42,
    mobile ? 0.54 : 0.5,
  )
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  return {
    composer,
    resize: (w, h) => {
      composer.setSize(w, h)
      bloom.resolution.set(w, h)
    },
    dispose: () => composer.dispose(),
  }
}
