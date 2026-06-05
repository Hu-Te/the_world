/** 首页背景大模型 — 世界模拟枢纽（程序化）或自定义 GLB */
import { resolvePublicUrl } from '@/utils/publicUrl'

export const HOME_HERO_CONFIG = {
  url: resolvePublicUrl('models/home/hero.glb'),
  scale: 3.8,
  rotation: [0, 0, 0] as [number, number, number],
  proceduralScale: 1.14,
} as const
