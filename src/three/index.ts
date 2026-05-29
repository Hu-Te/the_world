export type { WorldHandle, WorldModule, Disposer } from './types'

export { mountCultivationWorld } from './world/mountWorld'
export { createCultivationWorld } from './world/createCultivationWorld'

export { loadGltfModel, loadRegisteredModels } from './assets/modelLoader'
export type { LoadedModel, LoadModelOptions } from './assets/modelLoader'

export { MODEL_PLACEMENTS } from './assets/modelRegistry'
export type { ModelPlacement } from './assets/modelRegistry'
