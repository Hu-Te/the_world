import * as THREE from 'three'
import { Palette } from '../utils/colors'

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(Palette.skyHorizon)
  return scene
}
