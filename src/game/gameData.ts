import { VILLAGE_LAYOUT } from '@/three/settlement/createVillages'
import type { NodePoi } from './types'

const NODE_NAMES = ['Alpha 节点', 'Delta 哨站', 'Sigma 中继', 'Nova 终端', 'Orion 基站']

export const NODE_POIS: NodePoi[] = VILLAGE_LAYOUT.map((v, i) => ({
  id: i,
  name: NODE_NAMES[i] ?? `节点 ${i + 1}`,
  x: v.x,
  z: v.z,
}))

export const QUEST_TARGET = 3
export const INTERACT_RADIUS = 10
export const ENERGY_PER_NODE = 30
export const MAX_ENERGY = 100

export function getSyncTier(energy: number): string {
  if (energy >= 100) return '深度同步'
  if (energy >= 60) return '稳定在线'
  if (energy >= 30) return '部分同步'
  return '离线模式'
}
