import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

export interface PostProcessing {
  composer: EffectComposer
  resize: (width: number, height: number) => void
  dispose: () => void
}

/** 写实后期：仅色彩输出，无风格化 Bloom */
export function createPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  width: number,
  height: number,
): PostProcessing {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new OutputPass())

  return {
    composer,
    resize: (w, h) => composer.setSize(w, h),
    dispose: () => composer.dispose(),
  }
}
