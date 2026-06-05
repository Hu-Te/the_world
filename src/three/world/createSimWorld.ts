import * as THREE from 'three'
import { disposeObject3D } from '../utils/dispose'
import type { WorldModule } from '../types'
import type { LoadedModel } from '../assets/modelLoader'
import { loadRegisteredModels } from '../assets/modelLoader'
import { MODEL_PLACEMENTS, type ModelPlacement } from '../assets/modelRegistry'
import { createModelAnchors } from '../assets/mountSlots'

import { createSky } from '../environment/createSky'
import { createLighting } from '../environment/createLighting'
import { createFog, applyFogToScene, clearFogFromScene } from '../environment/createFog'
import { createGround } from '../terrain/createGround'
import { createGroundMountains } from '../terrain/createGroundMountains'
import { createFloatingIslands } from '../terrain/createFloatingIslands'
import { createCloudMist } from '../effects/createCloudMist'
import { createGrassField } from '../effects/createGrassField'
import { assembleWorldContent } from './assembleWorldContent'
import { WORLD_CONFIG } from './worldConfig'

export interface CreateWorldOptions {
  /** GLB/GLTF 模型清单，默认读取 MODEL_PLACEMENTS */
  modelPlacements?: ModelPlacement[]
  /** 游戏模式：降低草地/阴影开销 */
  performance?: 'default' | 'lite'
}

export interface SimWorld extends WorldModule {
  modelsRoot: THREE.Group
  loadedModels: LoadedModel[]
  getIslandGroup: (index: number) => THREE.Group | undefined
  teardownScene: (scene: THREE.Scene) => void
}

/** 程序化模拟大世界 */
export function createSimWorld(
  scene: THREE.Scene,
  options: CreateWorldOptions = {},
): SimWorld {
  const root = new THREE.Group()
  root.name = 'SimWorld'

  const modelsRoot = new THREE.Group()
  modelsRoot.name = 'ImportedModels'

  const loadedModels: LoadedModel[] = []
  const updaters: Array<(elapsed: number, delta: number) => void> = []

  const register = (module: WorldModule) => {
    root.add(module.group)
    if (module.update) updaters.push(module.update)
  }

  const lite = options.performance === 'lite'

  register(createSky())
  register(createLighting(lite ? 2048 : 4096))
  register(createGround())

  const groundMountains = createGroundMountains()
  register(groundMountains)

  if (WORLD_CONFIG.grassField) {
    register(createGrassField(lite ? 4200 : 8000))
  }

  const fog = createFog()
  applyFogToScene(scene, fog)

  const floatingMountains = createFloatingIslands()
  register(floatingMountains)

  if (WORLD_CONFIG.clouds && !lite) {
    register(createCloudMist())
  }

  const getIslandGroup = (index: number) => floatingMountains.placements[index]?.group

  assembleWorldContent({
    root,
    floatingPlacements: floatingMountains.placements,
    groundPlacements: groundMountains.placements,
  })

  createModelAnchors(floatingMountains.placements, root)

  root.add(modelsRoot)
  scene.add(root)

  const placements = options.modelPlacements ?? MODEL_PLACEMENTS
  void loadRegisteredModels(placements, { modelsRoot, getIslandGroup }).then((models) => {
    loadedModels.push(...models)
  })

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
