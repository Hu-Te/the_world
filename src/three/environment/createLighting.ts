import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import type { WorldModule } from '../types'

export function createLighting(): WorldModule {
  const group = new THREE.Group()
  group.name = 'Lighting'

  group.add(new THREE.AmbientLight(0xffffff, 0.35))

  const hemi = new THREE.HemisphereLight(Palette.skyHorizon, Palette.grassMid, 0.55)
  group.add(hemi)

  const sun = new THREE.DirectionalLight(0xfff5e8, 2.1)
  sun.position.set(120, 160, 80)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 500
  sun.shadow.camera.left = -180
  sun.shadow.camera.right = 180
  sun.shadow.camera.top = 180
  sun.shadow.camera.bottom = -180
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = 0.02
  group.add(sun)

  const fill = new THREE.DirectionalLight(0xc8e6ff, 0.35)
  fill.position.set(-80, 60, -100)
  group.add(fill)

  return {
    group,
    dispose: () => disposeObject3D(group),
  }
}
