import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { fbm2d } from '../utils/noise'
import { createGrassMaterial, createRockMaterial } from '../utils/materials'

export interface IslandOptions {
  radius: number
  height: number
  seed: number
  segments?: number
}

/**
 * 自然丘陵：半球体塑形 + 噪声起伏，单 Mesh 无接缝。
 */
export function createIslandMesh({
  radius,
  height,
  seed,
  segments = 64,
}: IslandOptions): THREE.Group {
  const island = new THREE.Group()
  island.name = 'Island'

  const geo = new THREE.SphereGeometry(radius, segments, segments / 2, 0, Math.PI * 2, 0, Math.PI * 0.48)
  geo.scale(1, height / radius, 1)

  const positions = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(positions.count * 3)

  const grassLight = new THREE.Color(Palette.grassLight)
  const grassMid = new THREE.Color(Palette.grassMid)
  const grassDark = new THREE.Color(Palette.grassDark)
  const soil = new THREE.Color(Palette.soil)
  const rock = new THREE.Color(Palette.rock)

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const y = positions.getY(i)
    const z = positions.getZ(i)
    const noise = fbm2d(x * 0.12 + seed, z * 0.12 + seed, 5)
    const ripple = fbm2d(x * 0.25 + seed * 2, z * 0.25 + seed * 2, 3)

    positions.setXYZ(
      i,
      x + x * ripple * 0.04,
      y + noise * 1.8,
      z + z * ripple * 0.04,
    )

    const ny = positions.getY(i) / height
    const slope = 1 - ny
    const color = grassMid
      .clone()
      .lerp(grassLight, ny * 0.8 + noise * 0.2)
      .lerp(grassDark, slope * 0.25)
      .lerp(soil, Math.max(0, slope - 0.5) * 0.6)
      .lerp(rock, Math.max(0, slope - 0.75) * 1.2)

    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const hill = new THREE.Mesh(geo, createGrassMaterial(true))
  hill.castShadow = true
  hill.receiveShadow = true
  island.add(hill)

  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.85, radius * 1.05, segments),
    createRockMaterial(),
  )
  baseRing.rotation.x = -Math.PI / 2
  baseRing.position.y = 0.05
  baseRing.receiveShadow = true
  island.add(baseRing)

  return island
}

export { createGrassMaterial, createRockMaterial }
