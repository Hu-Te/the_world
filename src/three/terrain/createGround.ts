import * as THREE from 'three'
import { fbm2d } from '../utils/noise'
import { disposeObject3D } from '../utils/dispose'
import { createGrassMaterial } from '../utils/materials'
import { sampleGroundHeight } from './sampleGroundHeight'
import type { WorldModule } from '../types'

const GROUND_SIZE = 800
const GROUND_SEGMENTS = 200

export function createGround(): WorldModule {
  const group = new THREE.Group()
  group.name = 'Ground'

  const geometry = new THREE.PlaneGeometry(
    GROUND_SIZE,
    GROUND_SIZE,
    GROUND_SEGMENTS,
    GROUND_SEGMENTS,
  )
  geometry.rotateX(-Math.PI / 2)

  const positions = geometry.attributes.position as THREE.BufferAttribute

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    positions.setY(i, sampleGroundHeight(x, z))
  }

  geometry.computeVertexNormals()

  const groundMat = createGrassMaterial(false)
  groundMat.roughness = 0.95

  const ground = new THREE.Mesh(geometry, groundMat)
  ground.receiveShadow = true
  group.add(ground)

  return {
    group,
    dispose: () => disposeObject3D(group),
  }
}
