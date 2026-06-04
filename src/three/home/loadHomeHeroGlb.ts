import { loadGltfModel } from '../assets/modelLoader'
import { HOME_HERO_CONFIG } from './homeHeroConfig'
import type { HomeHeroHandle } from './createHomeHeroModel'

/** 若 public 下存在 hero.glb，则替换程序化环阵反应堆 */
export async function tryLoadHomeHeroGlb(hero: HomeHeroHandle): Promise<boolean> {
  try {
    const probe = await fetch(HOME_HERO_CONFIG.url, { method: 'HEAD' })
    if (!probe.ok) return false

    const model = await loadGltfModel({
      url: HOME_HERO_CONFIG.url,
      name: 'HomeHeroGlb',
      scale: HOME_HERO_CONFIG.scale,
      rotation: HOME_HERO_CONFIG.rotation,
      castShadow: false,
      receiveShadow: false,
    })

    hero.mountExternalModel(model.root)
    return true
  } catch {
    return false
  }
}
