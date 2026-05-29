import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import { createSeededRandom, range } from '../utils/random'
import type { WorldModule } from '../types'

const BLADE_COUNT = 14000

export function createGrassField(): WorldModule {
  const group = new THREE.Group()
  group.name = 'GrassField'

  const bladeGeo = new THREE.PlaneGeometry(0.3, 1.1, 1, 3)
  bladeGeo.translate(0, 0.55, 0)

  const bladeMat = new THREE.MeshStandardMaterial({
    color: Palette.grassMid,
    roughness: 0.92,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.InstancedMesh(bladeGeo, bladeMat, BLADE_COUNT)
  mesh.castShadow = true
  mesh.receiveShadow = true

  const dummy = new THREE.Object3D()
  const rand = createSeededRandom(3344)
  const spread = 300
  let placed = 0

  for (let attempt = 0; attempt < BLADE_COUNT * 4 && placed < BLADE_COUNT; attempt++) {
    const x = range(rand, -spread, spread)
    const z = range(rand, -spread, spread)
    const dist = Math.sqrt(x * x + z * z)

    if (dist < 25 || dist > spread) continue

    dummy.position.set(x, 0.2 + range(rand, 0, 0.5), z)
    dummy.rotation.set(
      range(rand, -0.15, 0.15),
      range(rand, 0, Math.PI * 2),
      range(rand, -0.15, 0.15),
    )
    const s = 0.7 + range(rand, 0, 0.9)
    dummy.scale.set(s, s * (0.9 + range(rand, 0, 0.4)), 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(placed, dummy.matrix)
    placed++
  }

  mesh.count = placed
  mesh.instanceMatrix.needsUpdate = true
  group.add(mesh)

  return {
    group,
    dispose: () => disposeObject3D(group),
  }
}
