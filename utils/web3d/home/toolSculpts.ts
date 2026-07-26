import * as THREE from 'three'
import type { AccentKit, SharedGeoPool } from './materials'
import type { HomeQuality } from './quality'
import type { SculptResult } from './types'

function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.userData.sharedResource = true
  return m
}

/**
 * 分类下工具轻量雕塑（比分类雕塑小约 0.4 倍）
 * index 在同类内区分轮廓，避免多件同款。
 */
export function sculptTool(
  categoryId: string,
  index: number,
  kit: AccentKit,
  geos: SharedGeoPool,
  q: HomeQuality,
): SculptResult {
  const emblem = new THREE.Group()
  const seg = Math.max(10, Math.floor(q.circleSeg / 4))
  const rs = q.device === 'mobile' ? 1 : 2
  const rich = q.device !== 'mobile'
  const v = index % 3

  switch (categoryId) {
    case 'engineering':
      if (v === 0) {
        emblem.add(mesh(geos.rbox(0.72, 0.06, 0.14, 0.02, rs), kit.chrome))
        emblem.add(mesh(geos.box(0.58, 0.02, 0.02), kit.tip, 0, 0.05, 0))
        for (let i = 0; i < 5; i++) {
          emblem.add(mesh(geos.box(0.012, 0.05, 0.012), kit.shell, -0.28 + i * 0.14, 0.08, 0))
        }
      } else if (v === 1) {
        emblem.add(mesh(geos.rbox(0.55, 0.08, 0.48, 0.03, rs), kit.shell, 0, -0.12, 0))
        emblem.add(mesh(geos.rbox(0.42, 0.04, 0.36, 0.02, rs), kit.crystal, 0, -0.04, 0))
        emblem.add(mesh(geos.box(0.28, 0.01, 0.01), kit.tip, 0, 0.02, 0.16))
      } else {
        emblem.add(mesh(geos.cylinder(0.06, 0.06, 0.55, seg), kit.chrome, 0, 0.05, 0))
        emblem.add(mesh(geos.rbox(0.32, 0.06, 0.08, 0.02, rs), kit.shell, 0, 0.32, 0))
        emblem.add(mesh(geos.torus(0.16, 0.012, 8, seg), kit.tip, 0, -0.18, 0))
      }
      break

    case 'finance':
      // 与 catalog 顺序对齐：0 勾稽 / 1 企税倒推 / 2 语料熔炼 / 3 税收扫描 / 4 往来账龄
      if (index === 0) {
        // 银行存款勾稽：双屏账册 + 配对桥线
        emblem.add(mesh(geos.rbox(0.26, 0.58, 0.06, 0.02, rs), kit.shell, -0.22, 0.02, 0))
        emblem.add(mesh(geos.rbox(0.26, 0.58, 0.06, 0.02, rs), kit.shell, 0.22, 0.02, 0))
        for (let i = 0; i < 4; i++) {
          const y = -0.18 + i * 0.12
          emblem.add(mesh(geos.box(0.16, 0.014, 0.01), kit.tip, -0.22, y, 0.04))
          emblem.add(mesh(geos.box(0.16, 0.014, 0.01), kit.chrome, 0.22, y, 0.04))
        }
        emblem.add(mesh(geos.box(0.28, 0.012, 0.012), kit.core, 0, 0.06, 0.02))
        emblem.add(mesh(geos.box(0.28, 0.012, 0.012), kit.core, 0, -0.08, 0.02))
        emblem.add(mesh(geos.sphere(0.035, 8), kit.tip, 0, 0.2, 0.05))
        if (rich) {
          emblem.add(mesh(geos.rbox(0.58, 0.04, 0.22, 0.015, rs), kit.chrome, 0, -0.34, 0))
        }
      } else if (index === 1) {
        // 企税利润倒推：税后目标 → 反推税前塔 + 加计环
        emblem.add(mesh(geos.cylinder(0.22, 0.28, 0.06, seg), kit.shell, 0, -0.28, 0))
        emblem.add(mesh(geos.cylinder(0.16, 0.2, 0.28, seg), kit.crystal, 0, -0.08, 0))
        emblem.add(mesh(geos.cylinder(0.1, 0.14, 0.22, seg), kit.chrome, 0, 0.16, 0))
        emblem.add(mesh(geos.sphere(0.055, 10), kit.core, 0, 0.34, 0))
        const ring = mesh(geos.torus(0.2, 0.014, 8, seg), kit.tip, 0, 0.02, 0)
        ring.rotation.x = Math.PI / 2
        emblem.add(ring)
        if (rich) {
          const ring2 = mesh(geos.torus(0.26, 0.01, 8, seg), kit.shell, 0, -0.12, 0)
          ring2.rotation.x = Math.PI / 2
          emblem.add(ring2)
          emblem.add(mesh(geos.box(0.02, 0.16, 0.02), kit.tip, 0.32, 0.05, 0))
          emblem.add(mesh(geos.octahedron(0.045), kit.core, 0.32, 0.16, 0))
        }
      } else if (index === 2) {
        // 全息语料熔炼舱：熔炉片 + 核心晶
        emblem.add(mesh(geos.rbox(0.42, 0.42, 0.1, 0.03, rs), kit.shell))
        emblem.add(mesh(geos.octahedron(0.1), kit.core, 0, 0.02, 0.08))
        emblem.add(mesh(geos.torus(0.2, 0.012, 8, seg), kit.tip, 0, -0.02, 0))
      } else if (index === 3) {
        // 税收红利扫描舱：雷达环 + 警示棱锥
        emblem.add(mesh(geos.cylinder(0.28, 0.28, 0.04, seg), kit.shell, 0, -0.2, 0))
        const scan = mesh(geos.torus(0.24, 0.016, 8, seg), kit.tip, 0, -0.08, 0)
        scan.rotation.x = Math.PI / 2
        emblem.add(scan)
        const scan2 = mesh(geos.torus(0.16, 0.012, 8, seg), kit.chrome, 0, 0.02, 0)
        scan2.rotation.x = Math.PI / 2
        emblem.add(scan2)
        emblem.add(mesh(geos.octahedron(0.09), kit.core, 0, 0.18, 0))
        if (rich) {
          emblem.add(mesh(geos.box(0.02, 0.22, 0.02), kit.tip, 0.26, 0.05, 0))
          emblem.add(mesh(geos.sphere(0.03, 8), kit.core, 0.26, 0.2, 0))
        }
      } else {
        // 往来账龄扫描舱：FIFO 队列阶梯柱（短→长 = 账龄加深）+ 队头冲销箭头
        const heights = [0.16, 0.28, 0.42, 0.58]
        for (let i = 0; i < 4; i++) {
          const h = heights[i]
          const x = -0.27 + i * 0.18
          emblem.add(mesh(geos.rbox(0.12, h, 0.12, 0.02, rs), i < 2 ? kit.chrome : kit.shell, x, h / 2 - 0.22, 0))
          emblem.add(mesh(geos.box(0.08, 0.012, 0.01), i >= 3 ? kit.core : kit.tip, x, h - 0.14, 0.07))
        }
        emblem.add(mesh(geos.rbox(0.62, 0.04, 0.2, 0.015, rs), kit.chrome, 0, -0.34, 0))
        // 队头冲销指示：左侧入队球 → 右侧出队楔
        emblem.add(mesh(geos.sphere(0.04, 8), kit.tip, -0.36, -0.08, 0.08))
        emblem.add(mesh(geos.box(0.22, 0.014, 0.014), kit.core, -0.08, -0.08, 0.08))
        const wedge = mesh(geos.octahedron(0.055), kit.core, 0.34, -0.06, 0.08)
        wedge.scale.set(1.2, 0.55, 0.55)
        emblem.add(wedge)
        if (rich) {
          emblem.add(mesh(geos.torus(0.3, 0.01, 8, seg), kit.tip, 0, 0.28, 0))
        }
      }
      break

    case 'ithw':
      if (v === 0) {
        emblem.add(mesh(geos.rbox(0.42, 0.42, 0.42, 0.04, rs), kit.shell))
        emblem.add(mesh(geos.rbox(0.28, 0.28, 0.06, 0.02, rs), kit.crystal, 0, 0, 0.2))
        emblem.add(mesh(geos.box(0.08, 0.08, 0.08), kit.core, 0.12, 0.12, 0.12))
      } else if (v === 1) {
        emblem.add(mesh(geos.rbox(0.55, 0.22, 0.32, 0.04, rs), kit.chrome))
        emblem.add(mesh(geos.box(0.4, 0.02, 0.02), kit.tip, 0, 0.02, 0.14))
        emblem.add(mesh(geos.sphere(0.035, 8), kit.core, -0.18, 0.08, 0.1))
      } else {
        emblem.add(mesh(geos.rbox(0.38, 0.72, 0.28, 0.04, rs), kit.shell))
        for (let i = 0; i < 5; i++) {
          emblem.add(mesh(geos.box(0.26, 0.03, 0.01), kit.tip, 0, -0.24 + i * 0.12, 0.14))
        }
      }
      break

    case 'commerce':
      if (v === 0) {
        emblem.add(mesh(geos.rbox(0.55, 0.42, 0.04, 0.03, rs), kit.shell))
        emblem.add(mesh(geos.box(0.42, 0.01, 0.01), kit.tip, 0, 0.14, 0.03))
        emblem.add(mesh(geos.box(0.01, 0.28, 0.01), kit.tip, -0.2, 0, 0.03))
      } else if (v === 1) {
        emblem.add(mesh(geos.rbox(0.48, 0.28, 0.48, 0.05, rs), kit.shell, 0, -0.06, 0))
        const flap = mesh(geos.rbox(0.48, 0.14, 0.04, 0.03, rs), kit.chrome, 0, 0.18, -0.18)
        flap.rotation.x = -0.5
        emblem.add(flap)
        emblem.add(mesh(geos.octahedron(0.08), kit.core, 0, 0.02, 0.05))
      } else {
        emblem.add(mesh(geos.sphere(0.2, seg), kit.crystal))
        emblem.add(mesh(geos.sphere(0.1, 10), kit.core, 0.08, 0.08, 0.08))
        emblem.add(mesh(geos.torus(0.22, 0.015, 8, seg), kit.tip))
      }
      break

    case 'industry':
      // 0: XML 多语翻译舱；1: 工脉监听舱；其余沿用通用工业雕塑
      if (index === 0) {
        // 文档页 + 语言分流箭头
        emblem.add(mesh(geos.rbox(0.42, 0.55, 0.06, 0.02, rs), kit.shell, -0.08, 0.02, 0))
        for (let i = 0; i < 4; i++) {
          emblem.add(mesh(geos.box(0.28, 0.012, 0.01), kit.tip, -0.08, -0.14 + i * 0.1, 0.04))
        }
        emblem.add(mesh(geos.box(0.18, 0.014, 0.014), kit.core, 0.22, 0.08, 0.02))
        emblem.add(mesh(geos.octahedron(0.05), kit.core, 0.34, 0.08, 0.02))
        emblem.add(mesh(geos.sphere(0.035, 8), kit.tip, 0.22, -0.12, 0.04))
        emblem.add(mesh(geos.sphere(0.035, 8), kit.chrome, 0.34, -0.12, 0.04))
        if (rich) {
          emblem.add(mesh(geos.rbox(0.55, 0.04, 0.2, 0.015, rs), kit.chrome, 0, -0.34, 0))
        }
      } else if (index === 1) {
        // 工控网关：底座 + 信号柱 + 环形脉冲
        emblem.add(mesh(geos.rbox(0.5, 0.12, 0.36, 0.03, rs), kit.shell, 0, -0.16, 0))
        emblem.add(mesh(geos.cylinder(0.06, 0.08, 0.42, seg), kit.chrome, 0, 0.1, 0))
        emblem.add(mesh(geos.torus(0.18, 0.02, 8, seg), kit.tip, 0, 0.22, 0))
        emblem.add(mesh(geos.sphere(0.05, 8), kit.core, 0, 0.34, 0))
        if (rich) {
          emblem.add(mesh(geos.box(0.22, 0.01, 0.01), kit.tip, 0.18, 0.02, 0.08))
          emblem.add(mesh(geos.box(0.22, 0.01, 0.01), kit.tip, -0.18, 0.02, 0.08))
        }
      } else if (v === 0) {
        emblem.add(mesh(geos.rbox(0.55, 0.18, 0.18, 0.03, rs), kit.shell))
        emblem.add(mesh(geos.cylinder(0.05, 0.05, 0.5, seg), kit.chrome, 0.05, 0.12, 0))
        emblem.add(mesh(geos.torus(0.1, 0.015, 8, seg), kit.tip, -0.18, 0, 0))
      } else if (v === 1) {
        emblem.add(mesh(geos.cylinder(0.22, 0.22, 0.12, seg), kit.chrome))
        const tooth = mesh(geos.torus(0.26, 0.04, 8, 12), kit.shell)
        tooth.rotation.x = Math.PI / 2
        emblem.add(tooth)
        emblem.add(mesh(geos.sphere(0.06, 8), kit.core))
      } else {
        emblem.add(mesh(geos.rbox(0.58, 0.1, 0.42, 0.03, rs), kit.shell, 0, -0.08, 0))
        emblem.add(mesh(geos.rbox(0.46, 0.06, 0.08, 0.02, rs), kit.crystal, 0, 0.02, 0.12))
        if (rich) emblem.add(mesh(geos.box(0.3, 0.01, 0.01), kit.tip, 0, 0.08, 0.12))
      }
      break

    default:
      if (v === 0) {
        emblem.add(mesh(geos.rbox(0.55, 0.18, 0.18, 0.03, rs), kit.shell))
        emblem.add(mesh(geos.cylinder(0.05, 0.05, 0.5, seg), kit.chrome, 0.05, 0.12, 0))
        emblem.add(mesh(geos.torus(0.1, 0.015, 8, seg), kit.tip, -0.18, 0, 0))
      } else if (v === 1) {
        emblem.add(mesh(geos.cylinder(0.22, 0.22, 0.12, seg), kit.chrome))
        const tooth = mesh(geos.torus(0.26, 0.04, 8, 12), kit.shell)
        tooth.rotation.x = Math.PI / 2
        emblem.add(tooth)
        emblem.add(mesh(geos.sphere(0.06, 8), kit.core))
      } else {
        emblem.add(mesh(geos.rbox(0.58, 0.1, 0.42, 0.03, rs), kit.shell, 0, -0.08, 0))
        emblem.add(mesh(geos.rbox(0.46, 0.06, 0.08, 0.02, rs), kit.crystal, 0, 0.02, 0.12))
        if (rich) emblem.add(mesh(geos.box(0.3, 0.01, 0.01), kit.tip, 0, 0.08, 0.12))
      }
      break
  }

  return { emblem, mats: kit.list }
}
