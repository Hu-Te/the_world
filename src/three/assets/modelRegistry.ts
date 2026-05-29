import type * as THREE from 'three'

/** 模型放置配置：将 GLB/GLTF 放入 public/models/ 后在此登记 */
export interface ModelPlacement {
  /** 相对 public 的路径，如 `/models/sect-hall.glb` */
  url: string
  name: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  /** 挂到指定浮岛索引；不填则挂到 modelsRoot */
  islandIndex?: number
  castShadow?: boolean
  receiveShadow?: boolean
}

/**
 * 模型清单：后续导入模型时在此追加即可。
 * 示例：
 * { url: '/models/pagoda.glb', name: 'MainPagoda', islandIndex: 0, position: [0, 8, 0], scale: 2 }
 */
export const MODEL_PLACEMENTS: ModelPlacement[] = []
