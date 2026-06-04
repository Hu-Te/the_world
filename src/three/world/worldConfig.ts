/**
 * 世界配置
 */
export const WORLD_CONFIG = {
  grassField: true,
  clouds: true,
} as const

export type WorldConfig = typeof WORLD_CONFIG
