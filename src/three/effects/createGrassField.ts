import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import { createSeededRandom, range } from '../utils/random'
import type { WorldModule } from '../types'

const DEFAULT_BLADE_COUNT = 8000

export function createGrassField(bladeCount = DEFAULT_BLADE_COUNT): WorldModule {
  const group = new THREE.Group()
  group.name = 'GrassField'

  const bladeGeo = new THREE.PlaneGeometry(0.22, 0.85, 1, 2)
  bladeGeo.translate(0, 0.42, 0)

  const bladeMat = new THREE.MeshStandardMaterial({
    color: Palette.grassMid,
    roughness: 0.95,
    side: THREE.DoubleSide,
  })

  const mesh = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount)
  mesh.receiveShadow = true

  const dummy = new THREE.Object3D()
  const rand = createSeededRandom(3344)
  const spread = 260
  let placed = 0

  for (let attempt = 0; attempt < bladeCount * 4 && placed < bladeCount; attempt++) {
    const x = range(rand, -spread, spread)
    const z = range(rand, -spread, spread)
    const dist = Math.sqrt(x * x + z * z)

    if (dist < 35 || dist > spread) continue

    dummy.position.set(x, 0.15 + range(rand, 0, 0.25), z)
    dummy.rotation.set(0, range(rand, 0, Math.PI * 2), 0)
    const s = 0.6 + range(rand, 0, 0.5)
    dummy.scale.set(s, s * (0.8 + range(rand, 0, 0.3)), 1)
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
