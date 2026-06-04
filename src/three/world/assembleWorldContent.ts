import type * as THREE from 'three'
import type { MountainPlacement } from '../terrain/createFloatingIslands'
import { createPagoda, createPavilion } from '../architecture/createBuildings'
import { createCherryTree, createPineTree } from '../nature/createTrees'
import { createSeededRandom, range } from '../utils/random'
import { sampleMountainHeight } from '../terrain/createIslandGeometry'
import { createVillages } from '../settlement/createVillages'

export interface WorldContentContext {
  root: THREE.Group
  floatingPlacements: MountainPlacement[]
  groundPlacements?: MountainPlacement[]
}

function decorateMountainTrees(
  mountain: MountainPlacement,
  index: number,
  rand: () => number,
  treeCount: number,
  usePine: boolean,
): void {
  for (let i = 0; i < treeCount; i++) {
    const tree = usePine
      ? createPineTree(index * 50 + i)
      : createCherryTree(index * 50 + i)
    const angle = range(rand, 0, Math.PI * 2)
    const dist = range(rand, mountain.radius * 0.35, mountain.radius * 0.82)
    const tx = Math.cos(angle) * dist
    const tz = Math.sin(angle) * dist
    const ty = sampleMountainHeight(tx, tz, mountain)
    if (ty < mountain.peakHeight * 0.15) continue
    tree.position.set(tx, ty, tz)
    tree.rotation.y = range(rand, 0, Math.PI * 2)
    tree.scale.setScalar(range(rand, 0.7, 1.1))
    mountain.group.add(tree)
  }
}

/** 地面村庄 + 浮山楼阁 + 地面山林 */
export function assembleWorldContent(ctx: WorldContentContext): void {
  const { root, floatingPlacements, groundPlacements = [] } = ctx

  root.add(createVillages())

  const rand = createSeededRandom(777)

  floatingPlacements.forEach((mountain, index) => {
    const peakY = mountain.group.userData.peakY as number

    if (index === 0) {
      const pagoda = createPagoda(5)
      pagoda.position.set(0, peakY * 0.78, 0)
      pagoda.scale.setScalar(0.92)
      mountain.group.add(pagoda)
    } else if (index < 5) {
      const pavilion = createPavilion()
      pavilion.position.set(0, peakY * 0.72, 0)
      pavilion.rotation.y = index * 0.9
      pavilion.scale.setScalar(0.82 + index * 0.03)
      mountain.group.add(pavilion)
    } else {
      const small = createPavilion()
      small.position.set(0, peakY * 0.68, 0)
      small.scale.setScalar(0.65)
      mountain.group.add(small)
    }

    decorateMountainTrees(mountain, index, rand, index === 0 ? 6 : 3, false)
  })

  let tallestGround = 0
  let tallestIndex = 0
  groundPlacements.forEach((mountain, index) => {
    if (mountain.peakHeight > tallestGround) {
      tallestGround = mountain.peakHeight
      tallestIndex = index
    }
  })

  groundPlacements.forEach((mountain, index) => {
    const peakY = mountain.group.userData.peakY as number
    const treeCount = Math.floor(range(rand, 8, 14))

    if (index === tallestIndex) {
      const pavilion = createPavilion()
      pavilion.position.set(0, peakY * 0.68, 0)
      pavilion.scale.setScalar(0.75)
      mountain.group.add(pavilion)
    }

    decorateMountainTrees(mountain, index + 100, rand, treeCount, true)
  })
}
