import type * as THREE from 'three'

/** 模型放置配置：将 GLB/GLTF 放入 public/models/ 后在此登记 */
export interface ModelPlacement {
  /** 相对 public 的路径，如 `/models/sect-hall.glb` */
  url: string
  name: string

  /**
   * 挂到预定义锚点（推荐）。
   * 见 assets/mountSlots.ts 中 MODEL_MOUNT_SLOTS。
   */
  slotId?: string

  /** 相对锚点或父级的局部偏移 */
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]

  /** 无 slotId 时：挂到指定山体索引 */
  mountainIndex?: number
  castShadow?: boolean
  receiveShadow?: boolean
}

/**
 * 模型清单：后续在此追加。
 *
 * @example
 * // 浮山楼阁
 * { url: '/models/pagoda.glb', name: 'SkyPagoda', slotId: 'mountain-0-peak', scale: 1.2 }
 * // 地面村庄
 * { url: '/models/village.glb', name: 'EastVillage', slotId: 'village-0', scale: 1 }
 */
export const MODEL_PLACEMENTS: ModelPlacement[] = []
