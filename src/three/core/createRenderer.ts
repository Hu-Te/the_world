import * as THREE from 'three'

export interface RendererOptions {
  width: number
  height: number
  pixelRatio?: number
}

export function createRenderer({ width, height, pixelRatio }: RendererOptions): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  })

  renderer.setSize(width, height)
  renderer.setPixelRatio(pixelRatio ?? Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  return renderer
}
