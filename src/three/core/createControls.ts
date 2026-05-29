import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export function createControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  const controls = new OrbitControls(camera, domElement)

  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.target.set(0, 12, 0)
  controls.minDistance = 25
  controls.maxDistance = 320
  controls.maxPolarAngle = Math.PI / 2.08
  controls.minPolarAngle = 0.2
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.2
  controls.enablePan = true
  controls.screenSpacePanning = true

  return controls
}
