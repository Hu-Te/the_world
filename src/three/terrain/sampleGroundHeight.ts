import * as THREE from 'three'
import { fbm2d } from '../utils/noise'

/** 与 createGround 一致的地表高度采样，用于村庄贴地 */
export function sampleGroundHeight(worldX: number, worldZ: number): number {
  const noise = fbm2d(worldX * 0.005, worldZ * 0.005, 6)
  const ridge = fbm2d(worldX * 0.015 + 50, worldZ * 0.015 + 50, 4)
  const detail = fbm2d(worldX * 0.06, worldZ * 0.06, 2)
  return (noise - 0.42) * 5 + ridge * 2.2 + detail * 0.5
}
