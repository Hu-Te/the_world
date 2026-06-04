import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import type { WorldModule } from '../types'

export function createLighting(): WorldModule {
  const group = new THREE.Group()
  group.name = 'Lighting'

  group.add(new THREE.AmbientLight(0xffffff, 0.25))

  const hemi = new THREE.HemisphereLight(Palette.skyHorizon, Palette.grassDark, 0.45)
  group.add(hemi)

  const sun = new THREE.DirectionalLight(0xfff9f2, 2.8)
  sun.position.set(140, 180, 90)
  sun.castShadow = true
  sun.shadow.mapSize.set(4096, 4096)
  sun.shadow.camera.near = 20
  sun.shadow.camera.far = 600
  sun.shadow.camera.left = -200
  sun.shadow.camera.right = 200
  sun.shadow.camera.top = 200
  sun.shadow.camera.bottom = -200
  sun.shadow.bias = -0.0001
  sun.shadow.normalBias = 0.04
  sun.shadow.radius = 2
  group.add(sun)

  const fill = new THREE.DirectionalLight(0xb8d4f8, 0.28)
  fill.position.set(-100, 80, -120)
  group.add(fill)

  return {
    group,
    dispose: () => disposeObject3D(group),
  }
}
