import * as THREE from 'three'

export function createCamera(width: number, height: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(55, width / height, 0.5, 1200)
  camera.position.set(120, 38, 140)
  return camera
}
