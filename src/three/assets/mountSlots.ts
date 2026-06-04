import * as THREE from 'three'
import type { MountainPlacement } from '../terrain/createFloatingIslands'
import { sampleMountainHeight } from '../terrain/createIslandGeometry'
import { sampleGroundHeight } from '../terrain/sampleGroundHeight'
import { VILLAGE_LAYOUT } from '../settlement/createVillages'

export interface ModelMountSlot {
  id: string
  mountainIndex?: number
  villageIndex?: number
  position: [number, number, number]
  rotation?: [number, number, number]
}

export const MODEL_MOUNT_SLOTS: ModelMountSlot[] = [
  { id: 'mountain-0-peak', mountainIndex: 0, position: [0, 0, 0] },
  { id: 'mountain-1-peak', mountainIndex: 1, position: [0, 0, 0] },
  { id: 'mountain-2-peak', mountainIndex: 2, position: [0, 0, 0] },
  { id: 'mountain-3-peak', mountainIndex: 3, position: [0, 0, 0] },
  { id: 'mountain-4-peak', mountainIndex: 4, position: [0, 0, 0] },
  { id: 'mountain-5-peak', mountainIndex: 5, position: [0, 0, 0] },
  { id: 'mountain-6-peak', mountainIndex: 6, position: [0, 0, 0] },
  ...VILLAGE_LAYOUT.map((v, i) => ({
    id: `village-${i}`,
    villageIndex: i,
    position: [v.x, sampleGroundHeight(v.x, v.z), v.z] as [number, number, number],
  })),
]

const anchorMap = new Map<string, THREE.Group>()

export function createModelAnchors(
  placements: MountainPlacement[],
  worldRoot: THREE.Group,
): void {
  anchorMap.clear()

  for (const slot of MODEL_MOUNT_SLOTS) {
    const anchor = new THREE.Group()
    anchor.name = slot.id

    if (slot.mountainIndex !== undefined) {
      const mountain = placements[slot.mountainIndex]
      if (!mountain) continue

      const [lx, ly, lz] = slot.position
      const surfaceY = ly === 0 ? sampleMountainHeight(lx, lz, mountain) : ly
      anchor.position.set(lx, surfaceY, lz)
      if (slot.rotation) anchor.rotation.set(...slot.rotation)
      mountain.group.add(anchor)
    } else {
      anchor.position.set(...slot.position)
      if (slot.rotation) anchor.rotation.set(...slot.rotation)
      worldRoot.add(anchor)
    }

    anchorMap.set(slot.id, anchor)
  }
}

export function getModelAnchor(slotId: string): THREE.Group | undefined {
  return anchorMap.get(slotId)
}
