import type * as THREE from 'three'

/** 资源释放函数 */
export type Disposer = () => void

/** 世界子模块统一接口：场景节点 + 可选帧更新 + 释放 */
export interface WorldModule {
  group: THREE.Group
  update?: (elapsed: number, delta: number) => void
  dispose: Disposer
}

/** 挂载后返回的控制句柄 */
export interface WorldHandle {
  dispose: Disposer
  /** MediaPipe 手势控制（mountWorld gestureControl: true 时可用） */
  gesture?: import('../controls/createGestureControl').GestureControlHandle
}
