import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export interface GamePostProcessing {
  composer: EffectComposer
  resize: (width: number, height: number) => void
  dispose: () => void
}

/** 游戏轻量 Bloom，突出信标与能量特效 */
export function createGamePostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): GamePostProcessing {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.12, 0.22, 0.92)
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
