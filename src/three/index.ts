/**
 * Three.js 模拟大世界 — 对外唯一入口
 *
 * @example
 * import { mountWorld } from '@/three'
 *
 * const handle = mountWorld(containerRef.value!)
 * // 卸载时: handle.dispose()
 */

export { mountWorld } from './world/mountWorld'
export type { MountWorldOptions } from './world/mountWorld'

export { mountGame } from './game/mountGame'

export { mountHomeScene } from './home/mountHomeScene'
export type { HomeSceneHandle, HomeToolId } from './home/mountHomeScene'
export { HOME_TOOL_LABELS, HOME_ACTIVE_TOOLS } from './home/homeToolIds'

export type { WorldHandle, WorldModule, Disposer } from './types'
export type { GameHandle } from '@/game/types'

export { WORLD_CONFIG } from './world/worldConfig'
export type { WorldConfig } from './world/worldConfig'

export { MODEL_PLACEMENTS } from './assets/modelRegistry'
export type { ModelPlacement } from './assets/modelRegistry'

export { MODEL_MOUNT_SLOTS } from './assets/mountSlots'
export type { ModelMountSlot } from './assets/mountSlots'
