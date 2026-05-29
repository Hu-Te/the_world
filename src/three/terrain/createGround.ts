import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { fbm2d } from '../utils/noise'
import { disposeObject3D } from '../utils/dispose'
import { createGrassMaterial } from '../utils/materials'
import type { WorldModule } from '../types'

const GROUND_SIZE = 800
const GROUND_SEGMENTS = 192

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
  const colors = new Float32Array(positions.count * 3)

  const light = new THREE.Color(Palette.grassLight)
  const mid = new THREE.Color(Palette.grassMid)
  const dark = new THREE.Color(Palette.grassDark)

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const noise = fbm2d(x * 0.006, z * 0.006, 6)
    const ridge = fbm2d(x * 0.018 + 50, z * 0.018 + 50, 4)
    const detail = fbm2d(x * 0.08, z * 0.08, 2)
    const height = (noise - 0.42) * 7 + ridge * 3 + detail * 0.8

    positions.setY(i, height)

    const blend = THREE.MathUtils.clamp(noise * 1.05 + ridge * 0.25 + detail * 0.1, 0, 1)
    const color = dark.clone().lerp(mid, blend).lerp(light, blend * 0.7)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.computeVertexNormals()

  const ground = new THREE.Mesh(geometry, createGrassMaterial(true))
  ground.receiveShadow = true
  group.add(ground)

  return {
    group,
    dispose: () => disposeObject3D(group),
  }
}
