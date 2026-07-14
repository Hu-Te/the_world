import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { AccentMaterial } from './types'
import type { HomeQuality } from './quality'

export function markShared(obj: THREE.Object3D): void {
  obj.userData.sharedResource = true
}

export function isSharedResource(obj: THREE.Object3D): boolean {
  return Boolean(obj.userData.sharedResource)
}

/** 共享几何池 */
export class SharedGeoPool {
  private readonly map = new Map<string, THREE.BufferGeometry>()

  box(w: number, h: number, d: number): THREE.BoxGeometry {
    const key = `b:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}`
    let g = this.map.get(key)
    if (!g) {
      g = new THREE.BoxGeometry(w, h, d)
      this.map.set(key, g)
    }
    return g as THREE.BoxGeometry
  }

  /** 圆角盒：产品级外形关键 */
  rbox(w: number, h: number, d: number, radius = 0.05, seg = 2): THREE.BufferGeometry {
    const key = `rb:${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${radius.toFixed(3)}:${seg}`
    let g = this.map.get(key)
    if (!g) {
      g = new RoundedBoxGeometry(w, h, d, seg, radius)
      this.map.set(key, g)
    }
    return g
  }

  sphere(r: number, seg = 16): THREE.SphereGeometry {
    const key = `s:${r.toFixed(3)}:${seg}`
    let g = this.map.get(key)
    if (!g) {
      g = new THREE.SphereGeometry(r, seg, Math.max(10, Math.floor(seg * 0.75)))
      this.map.set(key, g)
    }
    return g as THREE.SphereGeometry
  }

  cylinder(rt: number, rb: number, h: number, seg: number): THREE.CylinderGeometry {
    const key = `c:${rt.toFixed(3)}:${rb.toFixed(3)}:${h.toFixed(3)}:${seg}`
    let g = this.map.get(key)
    if (!g) {
      g = new THREE.CylinderGeometry(rt, rb, h, seg)
      this.map.set(key, g)
    }
    return g as THREE.CylinderGeometry
  }

  torus(r: number, tube: number, radSeg: number, tubSeg: number): THREE.TorusGeometry {
    const key = `t:${r.toFixed(3)}:${tube.toFixed(3)}:${radSeg}:${tubSeg}`
    let g = this.map.get(key)
    if (!g) {
      g = new THREE.TorusGeometry(r, tube, radSeg, tubSeg)
      this.map.set(key, g)
    }
    return g as THREE.TorusGeometry
  }

  octahedron(r: number): THREE.OctahedronGeometry {
    const key = `o:${r.toFixed(3)}`
    let g = this.map.get(key)
    if (!g) {
      g = new THREE.OctahedronGeometry(r, 0)
      this.map.set(key, g)
    }
    return g as THREE.OctahedronGeometry
  }

  dispose(): void {
    for (const g of this.map.values()) g.dispose()
    this.map.clear()
  }
}

export type AccentKit = {
  shell: AccentMaterial
  crystal: AccentMaterial
  chrome: AccentMaterial
  core: AccentMaterial
  tip: THREE.MeshBasicMaterial
  list: AccentMaterial[]
}

/** 钛壳 / 清漆玻璃 / 镜面金属 / 灯芯 —— 统一冷青金属质感 */
export function createAccentKit(accent: number, quality: HomeQuality): AccentKit {
  const env = quality.useEnvMap ? 1.85 : 0.8

  const shell = new THREE.MeshPhysicalMaterial({
    color: 0x0c141e,
    metalness: 1,
    roughness: 0.22,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    envMapIntensity: env,
    emissive: accent,
    emissiveIntensity: 0.06,
  })

  const crystal = new THREE.MeshPhysicalMaterial({
    color: 0xc8e4f0,
    metalness: 0.12,
    roughness: 0.05,
    transparent: true,
    opacity: 0.38,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: quality.useEnvMap ? 2.0 : 1.0,
    emissive: accent,
    emissiveIntensity: 0.22,
  })

  const chrome = new THREE.MeshPhysicalMaterial({
    color: 0xd8e6f0,
    metalness: 1,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: quality.useEnvMap ? 2.4 : 1.1,
    emissive: accent,
    emissiveIntensity: 0.04,
  })

  const core = new THREE.MeshPhysicalMaterial({
    color: accent,
    metalness: 0.55,
    roughness: 0.1,
    emissive: accent,
    emissiveIntensity: 1.35,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  })

  const tip = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.95,
  })

  return { shell, crystal, chrome, core, tip, list: [shell, crystal, chrome, core] }
}

export function disposeAccentKit(kit: AccentKit): void {
  for (const m of kit.list) m.dispose()
  kit.tip.dispose()
}

/** 脚下软光晕贴图 */
export function createSoftGlowTexture(
  accentHex: string,
  pushTexture: (t: THREE.Texture) => void,
): THREE.CanvasTexture {
  const size = 256
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 120)
  g.addColorStop(0, `${accentHex}cc`)
  g.addColorStop(0.25, `${accentHex}55`)
  g.addColorStop(0.55, `${accentHex}18`)
  g.addColorStop(1, `${accentHex}00`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  pushTexture(tex)
  return tex
}
