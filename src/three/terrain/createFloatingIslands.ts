import * as THREE from 'three'
import { disposeObject3D } from '../utils/dispose'
import { createSeededRandom, range } from '../utils/random'
import { createRockMaterial } from '../utils/materials'
import type { WorldModule } from '../types'
import {
  createMountainMesh,
  getMountainPeakY,
  sampleMountainHeight,
} from './createIslandGeometry'


export interface MountainPlacement {
  x: number
  z: number
  /** 悬浮高度（世界 Y） */
  y: number
  radius: number
  peakHeight: number
  seed: number
  steepness?: number
  group: THREE.Group
}

export type IslandPlacement = MountainPlacement

/** 空中浮山布局 */
const FLOATING_MOUNTAIN_LAYOUT: Omit<MountainPlacement, 'group'>[] = [
  { x: 0, z: 0, y: 44, radius: 30, peakHeight: 22, seed: 1.2, steepness: 2.5 },
  { x: -68, z: 30, y: 58, radius: 22, peakHeight: 16, seed: 2.4, steepness: 2.3 },
  { x: 65, z: -18, y: 52, radius: 20, peakHeight: 14, seed: 3.1, steepness: 2.2 },
  { x: -50, z: -60, y: 72, radius: 17, peakHeight: 12, seed: 4.8, steepness: 2.1 },
  { x: 78, z: 55, y: 56, radius: 16, peakHeight: 11, seed: 5.5, steepness: 2.0 },
  { x: -90, z: -10, y: 64, radius: 14, peakHeight: 10, seed: 6.2 },
  { x: 95, z: 8, y: 68, radius: 13, peakHeight: 9, seed: 7.7 },
]

export function createFloatingIslands(): WorldModule & { placements: MountainPlacement[] } {
  const group = new THREE.Group()
  group.name = 'FloatingMountains'

  const rand = createSeededRandom(2026)
  const placements: MountainPlacement[] = []

  


  for (const layout of FLOATING_MOUNTAIN_LAYOUT) {
    const mountainGroup = new THREE.Group()
    mountainGroup.position.set(layout.x, layout.y, layout.z)


    

    const mesh = createMountainMesh({ ...layout, floating: true })
    mountainGroup.add(mesh)

    const peakY = getMountainPeakY(mesh)
    mountainGroup.userData.peakY = peakY
    mountainGroup.userData.baseY = layout.y

    const rockCount = Math.floor(range(rand, 2, 4))
    for (let i = 0; i < rockCount; i++) {
      const angle = range(rand, 0, Math.PI * 2)
      const dist = range(rand, layout.radius * 0.4, layout.radius * 0.85)
      const rx = Math.cos(angle) * dist
      const rz = Math.sin(angle) * dist
      const groundY = sampleMountainHeight(rx, rz, layout)
      if (groundY < layout.peakHeight * 0.1) continue

      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(range(rand, 0.5, 1.8), 0),
        createRockMaterial(),
      )
      rock.position.set(rx, groundY * 0.45, rz)
      rock.rotation.set(range(rand, 0, 1), range(rand, 0, 1), range(rand, 0, 1))
      rock.castShadow = true
      mountainGroup.add(rock)
    }

    group.add(mountainGroup)
    placements.push({ ...layout, group: mountainGroup })
  }

  return {
    group,
    placements,
    update: (elapsed) => {
      placements.forEach((mountain, index) => {
        const baseY = mountain.group.userData.baseY as number
        mountain.group.position.y = baseY + Math.sin(elapsed * 0.28 + index * 1.1) * 1.4
        mountain.group.rotation.y = Math.sin(elapsed * 0.1 + index * 0.6) * 0.018
      })
    },
    dispose: () => disposeObject3D(group),
  }
}

export function createSpiritStone(peakY: number): THREE.Group {
  const stoneGroup = new THREE.Group()
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.8, 0),
    new THREE.MeshStandardMaterial({
      color: 0xa8d8ff,
      roughness: 0.2,
      metalness: 0.15,
      emissive: 0x9ecae8,
      emissiveIntensity: 0.1,
    }),
  )
  core.position.y = peakY + 1.2
  core.castShadow = true
  stoneGroup.add(core)
  stoneGroup.userData.core = core
  return stoneGroup
}

export function updateSpiritStone(stone: THREE.Group, elapsed: number): void {
  const core = stone.userData.core as THREE.Mesh
  core.rotation.y = elapsed * 0.35
}

export function placeOnMountainSurface(
  placement: MountainPlacement,
  localX: number,
  localZ: number,
): THREE.Vector3 {
  const y = sampleMountainHeight(localX, localZ, placement)
  return new THREE.Vector3(localX, y, localZ)
}
