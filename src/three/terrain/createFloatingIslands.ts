import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import { createSeededRandom, range } from '../utils/random'
import { createStandardMaterial } from '../utils/materials'
import type { WorldModule } from '../types'
import { createIslandMesh, createRockMaterial } from './createIslandGeometry'

export interface IslandPlacement {
  x: number
  z: number
  y: number
  radius: number
  height: number
  seed: number
  group: THREE.Group
}

/** 丘陵布局：贴合绿色大地，不再悬浮 */
const ISLAND_LAYOUT: Omit<IslandPlacement, 'group'>[] = [
  { x: 0, z: 0, y: 0, radius: 38, height: 16, seed: 1.2 },
  { x: -72, z: 28, y: 0, radius: 24, height: 11, seed: 2.4 },
  { x: 68, z: -18, y: 0, radius: 22, height: 10, seed: 3.1 },
  { x: -48, z: -58, y: 0, radius: 18, height: 8, seed: 4.8 },
  { x: 82, z: 52, y: 0, radius: 16, height: 7, seed: 5.5 },
  { x: -110, z: -20, y: 0, radius: 14, height: 6, seed: 6.2 },
  { x: 120, z: 10, y: 0, radius: 12, height: 5, seed: 7.7 },
  { x: 20, z: -95, y: 0, radius: 15, height: 6, seed: 8.3 },
  { x: -95, z: 78, y: 0, radius: 13, height: 5, seed: 9.1 },
  { x: 0, z: 120, y: 0, radius: 11, height: 4, seed: 10.4 },
]

export function createFloatingIslands(): WorldModule & { placements: IslandPlacement[] } {
  const group = new THREE.Group()
  group.name = 'Hills'

  const rand = createSeededRandom(2026)
  const placements: IslandPlacement[] = []

  for (const island of ISLAND_LAYOUT) {
    const islandGroup = new THREE.Group()
    islandGroup.position.set(island.x, island.y, island.z)

    const islandMesh = createIslandMesh(island)
    islandGroup.add(islandMesh)

    const rockCount = Math.floor(range(rand, 3, 7))
    for (let i = 0; i < rockCount; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(range(rand, 0.8, 2), 0),
        createRockMaterial(),
      )
      const angle = range(rand, 0, Math.PI * 2)
      const dist = range(rand, island.radius * 0.25, island.radius * 0.8)
      rock.position.set(Math.cos(angle) * dist, range(rand, 0.3, 2.5), Math.sin(angle) * dist)
      rock.rotation.set(range(rand, 0, 1), range(rand, 0, 1), range(rand, 0, 1))
      rock.castShadow = true
      islandGroup.add(rock)
    }

    group.add(islandGroup)
    placements.push({ ...island, group: islandGroup })
  }

  return {
    group,
    placements,
    dispose: () => disposeObject3D(group),
  }
}

/** 山巅灵石：弱发光晶体 */
export function createSpiritStone(position: THREE.Vector3): THREE.Group {
  const stoneGroup = new THREE.Group()
  stoneGroup.position.copy(position)

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(2.4, 0),
    createStandardMaterial({
      color: Palette.crystal,
      roughness: 0.2,
      metalness: 0.15,
      emissive: Palette.crystal,
      emissiveIntensity: 0.12,
    }),
  )
  core.position.y = 7
  core.castShadow = true
  stoneGroup.add(core)

  stoneGroup.userData.core = core

  return stoneGroup
}

export function updateSpiritStone(stone: THREE.Group, elapsed: number): void {
  const core = stone.userData.core as THREE.Mesh
  core.rotation.y = elapsed * 0.35
}
