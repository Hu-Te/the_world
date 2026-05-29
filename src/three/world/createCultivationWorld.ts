import * as THREE from 'three'
import { disposeObject3D } from '../utils/dispose'
import { createSeededRandom, range } from '../utils/random'
import type { WorldModule } from '../types'
import type { LoadedModel } from '../assets/modelLoader'

import { createSky } from '../environment/createSky'
import { createLighting } from '../environment/createLighting'
import { createFog, applyFogToScene, clearFogFromScene } from '../environment/createFog'
import { createGround } from '../terrain/createGround'
import {
  createFloatingIslands,
  createSpiritStone,
  updateSpiritStone,
} from '../terrain/createFloatingIslands'
import {
  createPagoda,
  createPavilion,
  createSpiritBridge,
  createStoneLantern,
} from '../architecture/createBuildings'
import { createCherryTree, createPineTree, createBush, createWildflowers } from '../nature/createTrees'
import { createWaterfall } from '../nature/createWaterfall'
import { createCloudMist } from '../effects/createCloudMist'
import { createGrassField } from '../effects/createGrassField'

export interface CultivationWorld extends WorldModule {
  modelsRoot: THREE.Group
  loadedModels: LoadedModel[]
  getIslandGroup: (index: number) => THREE.Group | undefined
  teardownScene: (scene: THREE.Scene) => void
}

export function createCultivationWorld(scene: THREE.Scene): CultivationWorld {
  const root = new THREE.Group()
  root.name = 'CultivationWorld'

  const modelsRoot = new THREE.Group()
  modelsRoot.name = 'ImportedModels'

  const loadedModels: LoadedModel[] = []
  const updaters: Array<(elapsed: number, delta: number) => void> = []

  const register = (module: WorldModule) => {
    root.add(module.group)
    if (module.update) {
      updaters.push(module.update)
    }
  }

  register(createSky())
  register(createLighting())
  register(createGround())
  register(createGrassField())

  const fog = createFog()
  applyFogToScene(scene, fog)

  const islands = createFloatingIslands()
  register(islands)
  register(createCloudMist())

  const getIslandGroup = (index: number) => islands.placements[index]?.group

  const rand = createSeededRandom(9527)
  const mainIsland = islands.placements[0]!
  const islandA = islands.placements[1]!
  const islandB = islands.placements[2]!

  const pagoda = createPagoda(5)
  pagoda.position.set(0, 0.5, 0)
  pagoda.scale.setScalar(1.05)
  mainIsland.group.add(pagoda)

  const spiritStone = createSpiritStone(new THREE.Vector3(0, 0, 0))
  mainIsland.group.add(spiritStone)
  updaters.push((elapsed) => updateSpiritStone(spiritStone, elapsed))

  islands.placements.slice(1, 5).forEach((spot, index) => {
    const pavilion = createPavilion()
    pavilion.position.set(0, 0.3, 0)
    pavilion.rotation.y = index * 0.8
    pavilion.scale.setScalar(0.95 + index * 0.04)
    spot.group.add(pavilion)
  })

  const bridge = createSpiritBridge(48)
  bridge.position.set(
    (islandA.x + islandB.x) / 2,
    0.5,
    (islandA.z + islandB.z) / 2,
  )
  bridge.rotation.y = Math.atan2(islandB.x - islandA.x, islandB.z - islandA.z)
  root.add(bridge)

  const waterfall = createWaterfall(new THREE.Vector3(-14, 2, 10), 18)
  mainIsland.group.add(waterfall.group)
  if (waterfall.update) {
    updaters.push(waterfall.update)
  }

  for (let i = 0; i < 8; i++) {
    const lantern = createStoneLantern()
    const angle = (i / 8) * Math.PI * 2
    lantern.position.set(Math.cos(angle) * 28, 0, Math.sin(angle) * 28)
    lantern.rotation.y = -angle + Math.PI
    lantern.scale.setScalar(1.1)
    root.add(lantern)
  }

  islands.placements.forEach((spot, index) => {
    const treeCount = index === 0 ? 18 : 7
    for (let i = 0; i < treeCount; i++) {
      const tree =
        index % 3 === 0
          ? createPineTree(index * 100 + i)
          : createCherryTree(index * 100 + i)

      const angle = range(rand, 0, Math.PI * 2)
      const dist = range(rand, spot.radius * 0.25, spot.radius * 0.8)
      tree.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
      tree.rotation.y = range(rand, 0, Math.PI * 2)
      tree.scale.setScalar(range(rand, 0.9, 1.3))
      spot.group.add(tree)
    }

    for (let i = 0; i < 5; i++) {
      const bush = createBush(index * 50 + i)
      const angle = range(rand, 0, Math.PI * 2)
      const dist = range(rand, spot.radius * 0.35, spot.radius * 0.9)
      bush.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
      spot.group.add(bush)
    }

    if (index < 3) {
      for (let i = 0; i < 4; i++) {
        const flowers = createWildflowers(index * 20 + i)
        flowers.position.set(
          range(rand, -spot.radius * 0.5, spot.radius * 0.5),
          0,
          range(rand, -spot.radius * 0.5, spot.radius * 0.5),
        )
        spot.group.add(flowers)
      }
    }
  })

  root.add(modelsRoot)
  scene.add(root)

  return {
    group: root,
    modelsRoot,
    loadedModels,
    getIslandGroup,
    update: (elapsed, delta) => {
      updaters.forEach((fn) => fn(elapsed, delta))
      loadedModels.forEach((model) => model.update(delta))
    },
    dispose: () => {
      loadedModels.forEach((model) => model.dispose())
      loadedModels.length = 0
      scene.remove(root)
      disposeObject3D(root)
    },
    teardownScene: (targetScene) => {
      clearFogFromScene(targetScene)
    },
  }
}
