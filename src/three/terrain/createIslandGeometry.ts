import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { fbm2d } from '../utils/noise'
import { createGrassMaterial, createRockMaterial } from '../utils/materials'

export interface MountainOptions {
  radius: number
  peakHeight: number
  seed: number
  steepness?: number
  segments?: number
  /** 浮空仙山：生成倒锥岩柱 */
  floating?: boolean
}

export function sampleMountainHeight(
  localX: number,
  localZ: number,
  options: MountainOptions,
): number {
  const { radius, peakHeight, seed, steepness = 2.2 } = options
  const dist = Math.sqrt(localX * localX + localZ * localZ) / radius
  if (dist >= 1) return 0

  const ridge = fbm2d(localX * 0.07 + seed, localZ * 0.07 + seed, 5)
  const detail = fbm2d(localX * 0.18 + seed * 1.7, localZ * 0.18 + seed * 1.7, 3)

  const edgeFade = 1 - THREE.MathUtils.smoothstep(0.82, 1, dist)
  const profile = Math.pow(1 - dist, steepness) * edgeFade
  const ridgeBoost = ridge * 2.2 * (1 - dist) * edgeFade
  const rough = (detail - 0.5) * 1.2 * (1 - dist * 0.6) * edgeFade

  return Math.max(0, profile * peakHeight + ridgeBoost + rough)
}

function mountainVertexColor(
  height: number,
  peakHeight: number,
  dist: number,
): THREE.Color {
  const grassLight = new THREE.Color(Palette.grassLight)
  const grassMid = new THREE.Color(Palette.grassMid)
  const grassDark = new THREE.Color(Palette.grassDark)
  const soil = new THREE.Color(Palette.soil)
  const rock = new THREE.Color(Palette.rock)

  const elevation = peakHeight > 0 ? height / peakHeight : 0
  const slope = THREE.MathUtils.clamp(dist * 1.15, 0, 1)

  return grassMid
    .clone()
    .lerp(grassLight, elevation * 0.55)
    .lerp(grassDark, (1 - elevation) * 0.15)
    .lerp(soil, Math.max(0, slope - 0.55) * 0.25)
    .lerp(rock, Math.max(0, slope - 0.75) * 0.35)
}

function createFloatingUnderSkirt(radius: number, seed: number): THREE.Mesh {
  const skirtGeo = new THREE.ConeGeometry(radius * 0.88, radius * 1.5, 48, 1, true)
  const skirtPos = skirtGeo.attributes.position as THREE.BufferAttribute

  for (let i = 0; i < skirtPos.count; i++) {
    const x = skirtPos.getX(i)
    const z = skirtPos.getZ(i)
    const ripple = fbm2d(x * 0.1 + seed * 2, z * 0.1 + seed * 2, 3) * 2
    skirtPos.setY(i, skirtPos.getY(i) + ripple)
  }
  skirtGeo.computeVertexNormals()

  const skirt = new THREE.Mesh(skirtGeo, createRockMaterial())
  skirt.rotation.x = Math.PI
  skirt.position.y = -radius * 0.35
  skirt.castShadow = true
  return skirt
}

function createMistRing(radius: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.75, radius * 0.12, 8, 48),
    new THREE.MeshStandardMaterial({
      color: Palette.fog,
      transparent: true,
      opacity: 0.35,
      roughness: 1,
      depthWrite: false,
    }),
  )
  ring.rotation.x = Math.PI / 2
  ring.position.y = -1.5
  return ring
}

export function createMountainMesh(options: MountainOptions): THREE.Group {
  const { radius, peakHeight, seed, segments = 80, floating = false } = options

  const mountain = new THREE.Group()
  mountain.name = floating ? 'FloatingMountain' : 'Mountain'

  const geo = new THREE.CircleGeometry(radius, segments)
  geo.rotateX(-Math.PI / 2)

  const positions = geo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(positions.count * 3)

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i)
    const z = positions.getZ(i)
    const dist = Math.sqrt(x * x + z * z) / radius
    const y = sampleMountainHeight(x, z, options)

    positions.setY(i, y)

    const color = mountainVertexColor(y, peakHeight, dist)
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const bodyMat = createGrassMaterial(true)
  bodyMat.roughness = 0.92
  bodyMat.vertexColors = true

  const body = new THREE.Mesh(geo, bodyMat)
  body.castShadow = true
  body.receiveShadow = true
  mountain.add(body)

  if (floating) {
    mountain.add(createFloatingUnderSkirt(radius, seed))
    mountain.add(createMistRing(radius))
  }

  mountain.userData.peakHeight = sampleMountainHeight(0, 0, options)

  return mountain
}

export function getMountainPeakY(mountain: THREE.Group): number {
  return (mountain.userData.peakHeight as number) ?? 0
}

export const createIslandMesh = createMountainMesh
export type IslandOptions = MountainOptions

export { createGrassMaterial }
