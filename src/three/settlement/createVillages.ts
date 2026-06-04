import * as THREE from 'three'
import {
  createWoodMaterial,
  createRoofMaterial,
  createRockMaterial,
  createStandardMaterial,
  createGoldMaterial,
} from '../utils/materials'
import { createSeededRandom, range } from '../utils/random'
import { createCherryTree } from '../nature/createTrees'
import { createStoneLantern } from '../architecture/createBuildings'
import { sampleGroundHeight } from '../terrain/sampleGroundHeight'

export interface VillagePlacement {
  x: number
  z: number
  seed: number
  scale?: number
}

const VILLAGE_LAYOUT: VillagePlacement[] = [
  { x: -45, z: 38, seed: 101, scale: 1.1 },
  { x: 42, z: -32, seed: 202, scale: 1 },
  { x: -30, z: -55, seed: 303, scale: 0.95 },
  { x: 35, z: 58, seed: 404, scale: 1.05 },
  { x: -65, z: -20, seed: 505, scale: 0.9 },
]

function addHouseMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** 民居：石基 + 木构 + 悬山屋面 + 格窗 */
function createFarmhouse(seed: number): THREE.Group {
  const house = new THREE.Group()
  const rand = createSeededRandom(seed)
  const wallMat = createStandardMaterial({ color: 0xe8dcc8, roughness: 0.88 })
  const roofMat = createRoofMaterial()
  const woodMat = createWoodMaterial(true)
  const frameMat = createWoodMaterial()
  const stoneMat = createRockMaterial()
  const trimMat = createGoldMaterial()

  const w = range(rand, 3.8, 5.2)
  const d = range(rand, 3.2, 4.8)
  const h = range(rand, 2.9, 3.7)
  const plinthH = 0.35

  addHouseMesh(
    house,
    new THREE.BoxGeometry(w + 0.3, plinthH, d + 0.3),
    stoneMat,
    0,
    plinthH / 2,
    0,
  )

  addHouseMesh(house, new THREE.BoxGeometry(w, h, d), wallMat, 0, plinthH + h / 2, 0)

  const corners: [number, number][] = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [-w / 2, d / 2],
    [w / 2, d / 2],
  ]
  for (const [sx, sz] of corners) {
    addHouseMesh(
      house,
      new THREE.BoxGeometry(0.14, h + 0.4, 0.14),
      woodMat,
      sx,
      plinthH + h / 2 + 0.2,
      sz,
    )
  }

  const beamY = plinthH + h + 0.15
  addHouseMesh(house, new THREE.BoxGeometry(w + 0.5, 0.12, 0.14), frameMat, 0, beamY, d / 2 + 0.08)
  addHouseMesh(house, new THREE.BoxGeometry(w + 0.5, 0.12, 0.14), frameMat, 0, beamY, -d / 2 - 0.08)
  addHouseMesh(house, new THREE.BoxGeometry(0.14, 0.12, d + 0.5), frameMat, -w / 2 - 0.08, beamY, 0)
  addHouseMesh(house, new THREE.BoxGeometry(0.14, 0.12, d + 0.5), frameMat, w / 2 + 0.08, beamY, 0)

  const roofRise = range(rand, 1.8, 2.4)
  const roofOverhang = 0.55
  const roofY = plinthH + h
  const ridgeY = roofY + roofRise
  const run = d / 2 + roofOverhang
  const hw = (w + roofOverhang * 2) / 2

  const roofPanelMat = roofMat.clone()
  roofPanelMat.side = THREE.DoubleSide

  const roofGeo = new THREE.BufferGeometry()
  roofGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([
        // 前坡（法线朝 +Z 外侧）
        -hw, ridgeY, 0, hw, ridgeY, 0, hw, roofY, run,
        -hw, ridgeY, 0, hw, roofY, run, -hw, roofY, run,
        // 后坡（法线朝 -Z 外侧，独立绕序）
        hw, ridgeY, 0, -hw, ridgeY, 0, -hw, roofY, -run,
        hw, ridgeY, 0, -hw, roofY, -run, hw, roofY, -run,
      ]),
      3,
    ),
  )
  roofGeo.computeVertexNormals()

  const roof = new THREE.Mesh(roofGeo, roofPanelMat)
  roof.castShadow = true
  roof.receiveShadow = true
  house.add(roof)

  addHouseMesh(
    house,
    new THREE.BoxGeometry(hw * 2 + 0.2, 0.16, 0.2),
    roofMat,
    0,
    ridgeY + 0.08,
    0,
  )

  for (const ez of [run, -run]) {
    const eaveTip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 4), roofMat)
    eaveTip.position.set(0, roofY + 0.05, ez)
    eaveTip.rotation.x = ez > 0 ? 0.35 : -0.35
    eaveTip.castShadow = true
    house.add(eaveTip)
  }

  const doorW = 0.95
  addHouseMesh(house, new THREE.BoxGeometry(doorW + 0.2, 2.1, 0.1), frameMat, 0, plinthH + 1.05, d / 2 + 0.05)
  addHouseMesh(house, new THREE.BoxGeometry(doorW, 1.95, 0.12), woodMat, 0, plinthH + 0.98, d / 2 + 0.1)
  addHouseMesh(house, new THREE.BoxGeometry(doorW + 0.35, 0.14, 0.14), trimMat, 0, plinthH + 2.15, d / 2 + 0.08)

  for (const wx of [-w * 0.28, w * 0.28]) {
    addHouseMesh(house, new THREE.BoxGeometry(0.75, 0.95, 0.08), frameMat, wx, plinthH + h * 0.58, d / 2 + 0.05)
    addHouseMesh(house, new THREE.BoxGeometry(0.06, 0.8, 0.1), woodMat, wx, plinthH + h * 0.58, d / 2 + 0.08)
    addHouseMesh(house, new THREE.BoxGeometry(0.55, 0.06, 0.1), woodMat, wx, plinthH + h * 0.58, d / 2 + 0.08)
  }

  if (range(rand, 0, 1) > 0.35) {
    const chimney = addHouseMesh(
      house,
      new THREE.BoxGeometry(0.55, 1.2, 0.55),
      stoneMat,
      -w * 0.32,
      plinthH + h + roofRise * 0.5,
      -d * 0.2,
    )
    addHouseMesh(house, new THREE.BoxGeometry(0.65, 0.1, 0.65), stoneMat, chimney.position.x, chimney.position.y + 0.65, chimney.position.z)
  }

  const steps = 2
  for (let i = 0; i < steps; i++) {
    addHouseMesh(
      house,
      new THREE.BoxGeometry(1.4 - i * 0.15, 0.14, 0.45),
      stoneMat,
      0,
      plinthH - 0.07 - i * 0.14,
      d / 2 + 0.35 + i * 0.2,
    )
  }

  return house
}

/** 村庄聚落 */
export function createVillage(placement: VillagePlacement): THREE.Group {
  const village = new THREE.Group()
  village.name = `Village_${placement.seed}`

  const rand = createSeededRandom(placement.seed)
  const scale = placement.scale ?? 1
  const groundY = sampleGroundHeight(placement.x, placement.z)

  village.position.set(placement.x, groundY, placement.z)
  village.scale.setScalar(scale)

  const houseCount = Math.floor(range(rand, 5, 9))
  for (let i = 0; i < houseCount; i++) {
    const house = createFarmhouse(placement.seed + i * 17)
    const angle = (i / houseCount) * Math.PI * 2 + range(rand, -0.3, 0.3)
    const dist = range(rand, 6, 14)
    house.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
    house.rotation.y = angle + Math.PI + range(rand, -0.4, 0.4)
    village.add(house)
  }

  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.5, 0.22, 16),
    createRockMaterial(),
  )
  plaza.position.y = 0.11
  plaza.receiveShadow = true
  village.add(plaza)

  const plazaRing = new THREE.Mesh(
    new THREE.TorusGeometry(4.0, 0.12, 6, 24),
    createRockMaterial(),
  )
  plazaRing.rotation.x = Math.PI / 2
  plazaRing.position.y = 0.24
  village.add(plazaRing)

  const lantern = createStoneLantern()
  lantern.position.set(0, 0, 0)
  lantern.scale.setScalar(0.85)
  village.add(lantern)

  const treeCount = 4
  for (let i = 0; i < treeCount; i++) {
    const tree = createCherryTree(placement.seed + i * 31)
    const angle = range(rand, 0, Math.PI * 2)
    const dist = range(rand, 10, 18)
    tree.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist)
    tree.scale.setScalar(range(rand, 0.7, 1))
    village.add(tree)
  }

  return village
}

export function createVillages(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Villages'

  for (const layout of VILLAGE_LAYOUT) {
    group.add(createVillage(layout))
  }

  return group
}

export { VILLAGE_LAYOUT }
