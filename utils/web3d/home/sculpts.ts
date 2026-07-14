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

function addLightSeam(
  emblem: THREE.Group,
  geos: SharedGeoPool,
  kit: AccentKit,
  w: number,
  x: number,
  y: number,
  z: number,
  axis: 'x' | 'z' = 'x',
): void {
  emblem.add(
    mesh(
      axis === 'x' ? geos.box(w, 0.012, 0.012) : geos.box(0.012, 0.012, w),
      kit.tip,
      x,
      y,
      z,
    ),
  )
}

/**
 * 环绕分类雕塑：产品展柜级体量
 * 各分类有清晰识别轮廓，细节靠共享几何复用。
 */

/** 工业：涡旋舱 + 配重轴 + 双精密环 */
export function sculptIndustry(
  kit: AccentKit,
  geos: SharedGeoPool,
  q: HomeQuality,
): SculptResult {
  const emblem = new THREE.Group()
  const seg = Math.max(16, Math.floor(q.circleSeg / 3))
  const rs = q.device === 'mobile' ? 1 : 3
  const rich = q.device !== 'mobile'

  emblem.add(mesh(geos.rbox(1.18, 0.44, 0.5, 0.09, rs), kit.shell))
  emblem.add(mesh(geos.rbox(1.02, 0.32, 0.12, 0.05, rs), kit.chrome, 0.04, 0.02, 0.22))
  emblem.add(mesh(geos.rbox(0.7, 0.24, 0.06, 0.035, rs), kit.crystal, 0.1, 0.02, 0.28))
  emblem.add(mesh(geos.sphere(0.1, seg), kit.core, 0.1, 0.02, 0.12))

  // 端盖法兰
  emblem.add(mesh(geos.cylinder(0.2, 0.2, 0.06, seg), kit.chrome, 0.55, 0, 0))
  emblem.add(mesh(geos.cylinder(0.12, 0.12, 0.08, seg), kit.shell, 0.62, 0, 0))

  // 左侧动力轴与轴承
  emblem.add(mesh(geos.cylinder(0.06, 0.06, 0.7, seg), kit.chrome, -0.52, 0, 0))
  emblem.add(mesh(geos.cylinder(0.1, 0.1, 0.05, seg), kit.shell, -0.52, 0.26, 0))
  emblem.add(mesh(geos.cylinder(0.1, 0.1, 0.05, seg), kit.shell, -0.52, -0.26, 0))
  emblem.add(mesh(geos.torus(0.14, 0.018, 8, seg), kit.tip, -0.52, 0, 0))

  const gyro = mesh(geos.torus(0.36, 0.018, 10, seg), kit.chrome, 0.16, 0, 0.04)
  gyro.rotation.y = 0.85
  emblem.add(gyro)
  const gyro2 = mesh(geos.torus(0.28, 0.012, 10, seg), kit.tip, 0.16, 0, 0.04)
  gyro2.rotation.x = 1.15
  emblem.add(gyro2)

  addLightSeam(emblem, geos, kit, 0.75, 0.02, 0.23, 0.08)
  addLightSeam(emblem, geos, kit, 0.32, 0.45, 0.23, 0, 'z')

  if (rich) {
    emblem.add(mesh(geos.rbox(0.28, 0.14, 0.18, 0.03, rs), kit.shell, -0.15, 0.28, -0.08))
    emblem.add(mesh(geos.box(0.14, 0.01, 0.01), kit.tip, -0.15, 0.36, -0.08))
    for (const z of [-0.14, 0.14]) {
      emblem.add(mesh(geos.cylinder(0.025, 0.025, 0.2, 8), kit.chrome, 0.35, -0.18, z))
    }
  }

  return { emblem, mats: kit.list }
}

/** 工程：台基 + 层栈楼体 + 结构桁架 */
export function sculptEngineering(
  kit: AccentKit,
  geos: SharedGeoPool,
  q: HomeQuality,
): SculptResult {
  const emblem = new THREE.Group()
  const rs = q.device === 'mobile' ? 1 : 3
  const seg = Math.max(12, Math.floor(q.circleSeg / 4))
  const rich = q.device !== 'mobile'

  emblem.add(mesh(geos.rbox(1.12, 0.1, 0.78, 0.05, rs), kit.shell, 0, -0.38, 0))
  emblem.add(mesh(geos.rbox(1.0, 0.04, 0.68, 0.02, rs), kit.chrome, 0, -0.31, 0))

  const tiers: Array<[number, number, number, THREE.Material]> = [
    [0.9, 0.14, -0.2, kit.crystal],
    [0.72, 0.15, -0.02, kit.shell],
    [0.54, 0.15, 0.16, kit.chrome],
    [0.38, 0.16, 0.34, kit.shell],
    [0.24, 0.18, 0.52, kit.core],
  ]
  for (const [s, h, y, mat] of tiers) {
    emblem.add(mesh(geos.rbox(s, h, s * 0.72, 0.04, rs), mat, 0, y, 0.02))
    emblem.add(mesh(geos.box(s * 0.7, 0.01, 0.01), kit.tip, 0, y + h * 0.52, s * 0.32))
  }

  // 三角构架柱
  for (const x of [-0.42, 0.42]) {
    emblem.add(mesh(geos.cylinder(0.024, 0.024, 0.82, seg), kit.chrome, x, 0.05, -0.32))
  }
  emblem.add(mesh(geos.rbox(0.92, 0.03, 0.04, 0.01, 1), kit.tip, 0, 0.42, -0.32))
  emblem.add(mesh(geos.rbox(0.04, 0.03, 0.55, 0.01, 1), kit.tip, -0.42, 0.2, -0.08))
  emblem.add(mesh(geos.rbox(0.04, 0.03, 0.55, 0.01, 1), kit.tip, 0.42, 0.2, -0.08))

  if (rich) {
    emblem.add(mesh(geos.rbox(0.22, 0.35, 0.22, 0.03, rs), kit.crystal, -0.28, -0.05, 0.28))
    emblem.add(mesh(geos.sphere(0.05, seg), kit.core, 0.3, 0.55, 0.12))
    // 斜撑
    const brace = mesh(geos.cylinder(0.015, 0.015, 0.55, 6), kit.chrome, 0.22, 0.05, -0.18)
    brace.rotation.z = 0.55
    emblem.add(brace)
  }

  return { emblem, mats: kit.list }
}

/** 财务：多层数据环柱 + 旁侧阵列 */
export function sculptFinance(
  kit: AccentKit,
  geos: SharedGeoPool,
  q: HomeQuality,
): SculptResult {
  const emblem = new THREE.Group()
  const seg = Math.max(18, Math.floor(q.circleSeg / 2.5))
  const rs = q.device === 'mobile' ? 1 : 2
  const rich = q.device !== 'mobile'

  emblem.add(mesh(geos.rbox(0.98, 0.07, 0.98, 0.045, rs), kit.shell, 0, -0.4, 0))
  emblem.add(mesh(geos.cylinder(0.34, 0.38, 0.05, seg), kit.chrome, 0, -0.32, 0))
  emblem.add(mesh(geos.cylinder(0.26, 0.26, 0.04, seg), kit.tip, 0, -0.28, 0))

  emblem.add(mesh(geos.cylinder(0.24, 0.24, 0.82, seg), kit.crystal, 0, 0.14, 0))
  emblem.add(mesh(geos.cylinder(0.1, 0.1, 0.74, seg), kit.core, 0, 0.14, 0))
  emblem.add(mesh(geos.sphere(0.08, seg), kit.chrome, 0, 0.58, 0))

  for (const [ry, rr, tube, mat] of [
    [-0.05, 0.32, 0.014, kit.tip],
    [0.18, 0.36, 0.012, kit.chrome],
    [0.4, 0.3, 0.01, kit.tip],
  ] as const) {
    const ring = mesh(geos.torus(rr, tube, 10, seg), mat, 0, ry, 0)
    ring.rotation.x = Math.PI / 2
    emblem.add(ring)
  }

  // 旁侧柱阵列
  const cols: Array<[number, number, number]> = [
    [-0.4, 0.32, 0.32],
    [0.4, 0.48, 0.32],
    [-0.4, 0.4, -0.32],
    [0.4, 0.28, -0.32],
  ]
  for (const [x, h, z] of cols) {
    emblem.add(mesh(geos.cylinder(0.04, 0.045, h, 10), kit.chrome, x, h / 2 - 0.28, z))
    emblem.add(mesh(geos.sphere(0.035, 8), kit.tip, x, h / 2 - 0.24, z))
  }

  if (rich) {
    const orbit = mesh(geos.torus(0.48, 0.008, 8, seg), kit.shell, 0, 0.22, 0)
    orbit.rotation.x = 1.1
    emblem.add(orbit)
    emblem.add(mesh(geos.rbox(0.16, 0.22, 0.04, 0.02, rs), kit.crystal, 0.52, 0.1, 0))
  }

  return { emblem, mats: kit.list }
}

/** IT：双刀片机架 + 背板总线 + 状态灯矩阵 */
export function sculptIthw(
  kit: AccentKit,
  geos: SharedGeoPool,
  q: HomeQuality,
): SculptResult {
  const emblem = new THREE.Group()
  const rs = q.device === 'mobile' ? 1 : 3
  const seg = Math.max(12, Math.floor(q.circleSeg / 4))
  const rich = q.device !== 'mobile'

  // 底座托
  emblem.add(mesh(geos.rbox(0.78, 0.07, 0.36, 0.035, rs), kit.chrome, 0, -0.58, 0))
  emblem.add(mesh(geos.rbox(0.7, 0.03, 0.28, 0.02, rs), kit.tip, 0, -0.53, 0))

  // 主刀片
  emblem.add(mesh(geos.rbox(0.52, 1.08, 0.18, 0.055, rs), kit.shell, -0.12, 0, 0))
  emblem.add(mesh(geos.rbox(0.4, 0.92, 0.05, 0.035, rs), kit.crystal, -0.12, 0.02, 0.1))
  // 副刀片
  emblem.add(mesh(geos.rbox(0.34, 0.85, 0.12, 0.04, rs), kit.shell, 0.28, -0.05, -0.02))
  emblem.add(mesh(geos.rbox(0.24, 0.7, 0.04, 0.03, rs), kit.chrome, 0.28, -0.02, 0.06))

  // 前脸灯矩阵
  emblem.add(mesh(geos.box(0.018, 0.78, 0.01), kit.tip, -0.28, 0.02, 0.12))
  for (let i = 0; i < 6; i++) {
    emblem.add(mesh(geos.box(0.28, 0.014, 0.01), kit.tip, -0.08, -0.32 + i * 0.14, 0.12))
  }
  for (let i = 0; i < 4; i++) {
    emblem.add(mesh(geos.box(0.16, 0.012, 0.01), kit.core, 0.28, -0.22 + i * 0.14, 0.1))
  }

  // 顶模块
  emblem.add(mesh(geos.rbox(0.1, 0.18, 0.03, 0.015, 1), kit.chrome, -0.22, 0.6, 0))
  emblem.add(mesh(geos.sphere(0.04, seg), kit.core, 0.05, 0.58, 0.04))
  emblem.add(mesh(geos.cylinder(0.02, 0.02, 0.16, 8), kit.tip, 0.22, 0.55, 0))

  if (rich) {
    // 背板散热鳍
    for (let i = 0; i < 5; i++) {
      emblem.add(
        mesh(geos.box(0.42, 0.02, 0.01), kit.chrome, -0.12, -0.3 + i * 0.16, -0.1),
      )
    }
    emblem.add(mesh(geos.rbox(0.18, 0.22, 0.12, 0.03, rs), kit.crystal, 0.28, 0.42, 0.02))
    const bus = mesh(geos.torus(0.22, 0.01, 8, 20), kit.tip, -0.12, -0.2, 0)
    bus.rotation.y = Math.PI / 2
    emblem.add(bus)
  }

  return { emblem, mats: kit.list }
}

/** 电商：礼盒展开体 + 丝带光 + 悬浮展品 */
export function sculptCommerce(
  kit: AccentKit,
  geos: SharedGeoPool,
  q: HomeQuality,
): SculptResult {
  const emblem = new THREE.Group()
  const rs = q.device === 'mobile' ? 1 : 3
  const seg = Math.max(14, Math.floor(q.circleSeg / 3))
  const rich = q.device !== 'mobile'

  // 盒体
  emblem.add(mesh(geos.rbox(0.82, 0.52, 0.82, 0.09, rs), kit.shell, 0, -0.04, 0))
  emblem.add(mesh(geos.rbox(0.72, 0.04, 0.72, 0.03, rs), kit.chrome, 0, 0.24, 0))
  // 正面视窗
  emblem.add(mesh(geos.rbox(0.55, 0.32, 0.04, 0.03, rs), kit.crystal, 0, 0.0, 0.4))
  emblem.add(mesh(geos.box(0.38, 0.014, 0.014), kit.tip, 0, 0.28, 0.4))

  // 丝带十字
  emblem.add(mesh(geos.box(0.82, 0.04, 0.08), kit.tip, 0, 0.08, 0))
  emblem.add(mesh(geos.box(0.08, 0.04, 0.82), kit.tip, 0, 0.08, 0))
  emblem.add(mesh(geos.sphere(0.07, seg), kit.core, 0, 0.16, 0))

  // 掀开的盖
  const lid = mesh(geos.rbox(0.82, 0.2, 0.06, 0.045, rs), kit.shell, 0, 0.4, -0.28)
  lid.rotation.x = -0.55
  emblem.add(lid)
  emblem.add(mesh(geos.box(0.5, 0.012, 0.012), kit.tip, 0, 0.48, -0.26))

  // 盒内展物
  emblem.add(mesh(geos.octahedron(0.12), kit.core, -0.18, 0.08, 0.12))
  emblem.add(mesh(geos.sphere(0.08, seg), kit.chrome, 0.2, 0.06, 0.1))
  emblem.add(mesh(geos.rbox(0.16, 0.1, 0.16, 0.03, rs), kit.crystal, 0.02, -0.02, -0.1))

  if (rich) {
    emblem.add(mesh(geos.cylinder(0.05, 0.05, 0.03, seg), kit.chrome, 0.3, 0.28, 0.3))
    emblem.add(mesh(geos.cylinder(0.05, 0.05, 0.03, seg), kit.chrome, -0.3, 0.28, 0.3))
    const orbit = mesh(geos.torus(0.38, 0.01, 8, seg), kit.shell, 0, 0.05, 0)
    orbit.rotation.x = Math.PI / 2
    emblem.add(orbit)
    // 悬浮标牌条
    emblem.add(mesh(geos.rbox(0.28, 0.08, 0.02, 0.015, 1), kit.chrome, 0.48, 0.2, 0.15))
  }

  return { emblem, mats: kit.list }
}

export function sculptById(
  id: string,
  kit: AccentKit,
  geos: SharedGeoPool,
  q: HomeQuality,
): SculptResult {
  switch (id) {
    case 'engineering':
      return sculptEngineering(kit, geos, q)
    case 'finance':
      return sculptFinance(kit, geos, q)
    case 'ithw':
      return sculptIthw(kit, geos, q)
    case 'commerce':
      return sculptCommerce(kit, geos, q)
    case 'industry':
    default:
      return sculptIndustry(kit, geos, q)
  }
}
