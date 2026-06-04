import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import type { WorldModule } from '../types'

export function createFog(): WorldModule {
  const group = new THREE.Group()
  group.name = 'Fog'

  const fog = new THREE.Fog(Palette.fog, 120, 520)
  group.userData.sceneFog = fog

  return {
    group,
    dispose: () => disposeObject3D(group),
  }
}

export function applyFogToScene(scene: THREE.Scene, fogModule: WorldModule): void {
  scene.fog = fogModule.group.userData.sceneFog as THREE.Fog
}

export function clearFogFromScene(scene: THREE.Scene): void {
  scene.fog = null
}
