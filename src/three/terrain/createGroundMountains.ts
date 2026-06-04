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
import { sampleGroundHeight } from './sampleGroundHeight'
import type { MountainPlacement } from './createFloatingIslands'

/** 地面山脉布局（远离村庄聚落） */
const GROUND_MOUNTAIN_LAYOUT: Omit<MountainPlacement, 'group' | 'y'>[] = [
  { x: -125, z: 85, radius: 40, peakHeight: 30, seed: 11.1, steepness: 2.45 },
  { x: 115, z: -100, radius: 44, peakHeight: 34, seed: 12.3, steepness: 2.5 },
  { x: -100, z: -115, radius: 36, peakHeight: 26, seed: 13.5, steepness: 2.35 },
  { x: 135, z: 75, radius: 32, peakHeight: 22, seed: 14.7, steepness: 2.3 },
  { x: -155, z: -45, radius: 30, peakHeight: 20, seed: 15.9, steepness: 2.25 },
  { x: 0, z: -140, radius: 48, peakHeight: 38, seed: 16.2, steepness: 2.55 },
  { x: 165, z: 25, radius: 28, peakHeight: 18, seed: 17.4, steepness: 2.2 },
  { x: -80, z: 145, radius: 26, peakHeight: 16, seed: 18.6, steepness: 2.15 },
]

export function createGroundMountains(): WorldModule & { placements: MountainPlacement[] } {
  const group = new THREE.Group()
  group.name = 'GroundMountains'

  const rand = createSeededRandom(3033)
  const placements: MountainPlacement[] = []

  for (const layout of GROUND_MOUNTAIN_LAYOUT) {
    const groundY = sampleGroundHeight(layout.x, layout.z)
    const mountainGroup = new THREE.Group()
    mountainGroup.position.set(layout.x, groundY, layout.z)

    const mesh = createMountainMesh({ ...layout, floating: false })
    mountainGroup.add(mesh)

    const peakY = getMountainPeakY(mesh)
    mountainGroup.userData.peakY = peakY
    mountainGroup.userData.baseY = groundY

    const rockCount = Math.floor(range(rand, 4, 8))
    for (let i = 0; i < rockCount; i++) {
      const angle = range(rand, 0, Math.PI * 2)
      const dist = range(rand, layout.radius * 0.35, layout.radius * 0.92)
      const rx = Math.cos(angle) * dist
      const rz = Math.sin(angle) * dist
      const surfaceY = sampleMountainHeight(rx, rz, layout)
      if (surfaceY < layout.peakHeight * 0.08) continue

      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(range(rand, 0.6, 2.2), 0),
        createRockMaterial(),
      )
      rock.position.set(rx, surfaceY * 0.42, rz)
      rock.rotation.set(range(rand, 0, 1), range(rand, 0, 1), range(rand, 0, 1))
      rock.castShadow = true
      mountainGroup.add(rock)
    }

    group.add(mountainGroup)
    placements.push({ ...layout, y: groundY, group: mountainGroup })
  }

  return {
    group,
    placements,
    dispose: () => disposeObject3D(group),
  }
}
