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
 * index 在同类内区分轮廓，避免三件同款。
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
      if (v === 0) {
        const pie = mesh(geos.cylinder(0.28, 0.28, 0.08, seg), kit.crystal)
        emblem.add(pie)
        emblem.add(mesh(geos.cylinder(0.12, 0.12, 0.1, 10), kit.core, 0.06, 0.02, 0.04))
        emblem.add(mesh(geos.box(0.22, 0.02, 0.04), kit.tip, 0.1, 0.06, 0))
      } else if (v === 1) {
        emblem.add(mesh(geos.rbox(0.5, 0.62, 0.08, 0.03, rs), kit.shell))
        for (let i = 0; i < 4; i++) {
          emblem.add(mesh(geos.box(0.34, 0.02, 0.01), kit.tip, 0, -0.18 + i * 0.12, 0.05))
        }
        emblem.add(mesh(geos.sphere(0.045, 8), kit.core, 0, 0.28, 0.06))
      } else {
        for (const [x, h] of [
          [-0.18, 0.28],
          [0, 0.48],
          [0.18, 0.36],
        ] as const) {
          emblem.add(mesh(geos.cylinder(0.05, 0.055, h, 8), kit.chrome, x, h / 2 - 0.2, 0))
          emblem.add(mesh(geos.sphere(0.03, 8), kit.tip, x, h / 2 - 0.16, 0))
        }
        emblem.add(mesh(geos.rbox(0.5, 0.04, 0.2, 0.02, rs), kit.shell, 0, -0.24, 0))
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
