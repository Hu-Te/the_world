import * as THREE from 'three'
import { Palette } from '../utils/colors'
import {
  createWoodMaterial,
  createStandardMaterial,
  createRoofMaterial,
  createGoldMaterial,
  createRockMaterial,
} from '../utils/materials'

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  y: number,
  castShadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.y = y
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** 多层飞檐宝塔：石基 + 八角殿 + 飞檐 + 金顶 */
export function createPagoda(tiers = 5): THREE.Group {
  const pagoda = new THREE.Group()
  pagoda.name = 'Pagoda'

  const stoneMat = createRockMaterial()
  const pillarMat = createWoodMaterial(true)
  const roofMat = createRoofMaterial()
  const trimMat = createGoldMaterial()
  const wallMat = createStandardMaterial({ color: 0xf0e6d8, roughness: 0.85 })

  const baseSize = 7
  for (let step = 0; step < 3; step++) {
    const s = baseSize + (2 - step) * 1.2
    addMesh(
      pagoda,
      new THREE.BoxGeometry(s, 0.45, s),
      stoneMat,
      step * 0.45,
    )
  }

  let y = 1.4
  const sides = 8

  for (let i = 0; i < tiers; i++) {
    const scale = 1 - i * 0.12
    const tierHeight = 3.4 - i * 0.2
    const radius = (baseSize * 0.42) * scale

    addMesh(
      pagoda,
      new THREE.CylinderGeometry(radius * 0.92, radius, tierHeight, sides),
      wallMat,
      y + tierHeight / 2,
    )

    for (let p = 0; p < sides; p++) {
      const angle = (p / sides) * Math.PI * 2
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.18, tierHeight * 0.95, 8),
        pillarMat,
      )
      pillar.position.set(
        Math.cos(angle) * radius * 0.82,
        y + tierHeight / 2,
        Math.sin(angle) * radius * 0.82,
      )
      pillar.castShadow = true
      pagoda.add(pillar)
    }

    const roofHeight = 2.4 - i * 0.15
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 1.15, roofHeight, sides),
      roofMat,
    )
    roof.position.y = y + tierHeight + roofHeight / 2
    roof.castShadow = true
    pagoda.add(roof)

    const eave = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.2, radius * 1.22, 0.18, sides),
      trimMat,
    )
    eave.position.y = y + tierHeight + 0.1
    pagoda.add(eave)

    for (let c = 0; c < sides; c++) {
      const angle = (c / sides) * Math.PI * 2 + Math.PI / sides
      const corner = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.5, 0.25),
        trimMat,
      )
      corner.position.set(
        Math.cos(angle) * radius * 1.05,
        y + tierHeight + 0.3,
        Math.sin(angle) * radius * 1.05,
      )
      pagoda.add(corner)
    }

    y += tierHeight + roofHeight * 0.65
  }

  const spireBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.45, 2.5, 8),
    trimMat,
  )
  spireBase.position.y = y + 1.2
  pagoda.add(spireBase)

  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 16),
    trimMat,
  )
  orb.position.y = y + 2.8
  pagoda.add(orb)

  const finial = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 1.8, 6),
    trimMat,
  )
  finial.position.y = y + 3.8
  pagoda.add(finial)

  return pagoda
}

/** 六角亭台：石台 + 立柱 + 双层飞檐 + 灯笼 */
export function createPavilion(): THREE.Group {
  const pavilion = new THREE.Group()
  pavilion.name = 'Pavilion'

  const stoneMat = createRockMaterial()
  const pillarMat = createWoodMaterial(true)
  const roofMat = createRoofMaterial()
  const trimMat = createGoldMaterial()
  const railMat = createWoodMaterial()

  const radius = 3.6
  const sides = 6

  addMesh(
    pavilion,
    new THREE.CylinderGeometry(radius + 1.2, radius + 1.4, 0.5, sides),
    stoneMat,
    0.25,
  )

  addMesh(
    pavilion,
    new THREE.CylinderGeometry(radius + 0.6, radius + 0.6, 0.3, sides),
    trimMat,
    0.55,
  )

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.2, 3.8, 10),
      pillarMat,
    )
    pillar.position.set(Math.cos(angle) * radius, 2.4, Math.sin(angle) * radius)
    pillar.castShadow = true
    pavilion.add(pillar)
  }

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const nextAngle = ((i + 1) / sides) * Math.PI * 2
    const midAngle = (angle + nextAngle) / 2
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.7, radius * 0.95),
      railMat,
    )
    rail.position.set(
      Math.cos(midAngle) * radius * 0.5,
      1.2,
      Math.sin(midAngle) * radius * 0.5,
    )
    rail.rotation.y = -midAngle + Math.PI / 2
    pavilion.add(rail)
  }

  const roof1 = new THREE.Mesh(
    new THREE.ConeGeometry(radius + 1.6, 1.6, sides),
    roofMat,
  )
  roof1.position.y = 4.8
  roof1.castShadow = true
  pavilion.add(roof1)

  const roof2 = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.75, 1.4, sides),
    roofMat,
  )
  roof2.position.y = 5.8
  roof2.castShadow = true
  pavilion.add(roof2)

  const roofCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 12),
    trimMat,
  )
  roofCap.position.y = 6.6
  pavilion.add(roofCap)

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.55, 0.35),
      createStandardMaterial({
        color: Palette.roofCrimson,
        emissive: Palette.roofCrimson,
        emissiveIntensity: 0.15,
        roughness: 0.6,
      }),
    )
    lantern.position.set(
      Math.cos(angle) * (radius + 0.3),
      3.6,
      Math.sin(angle) * (radius + 0.3),
    )
    pavilion.add(lantern)
  }

  return pavilion
}

/** 石拱桥：拱券 + 栏杆 + 桥墩 */
export function createSpiritBridge(length: number): THREE.Group {
  const bridge = new THREE.Group()
  bridge.name = 'StoneBridge'

  const stoneMat = createRockMaterial()
  const trimMat = createStandardMaterial({ color: Palette.rockDark, roughness: 0.9 })

  const archSegments = 24
  const archRadius = length * 0.35
  const deckWidth = 3.2

  for (let i = 0; i < archSegments; i++) {
    const t = i / (archSegments - 1)
    const angle = Math.PI * t
    const x = Math.cos(angle) * archRadius
    const y = Math.sin(angle) * archRadius * 0.28 - archRadius * 0.28 + 1.5

    const block = new THREE.Mesh(
      new THREE.BoxGeometry(deckWidth, 0.55, length / archSegments + 0.15),
      stoneMat,
    )
    block.position.set(0, y, t * length - length / 2)
    block.rotation.x = Math.cos(angle) * 0.12
    block.castShadow = true
    block.receiveShadow = true
    bridge.add(block)

    const railL = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 1.0, length / archSegments + 0.1),
      trimMat,
    )
    railL.position.set(-deckWidth / 2 - 0.15, y + 0.7, block.position.z)
    bridge.add(railL)

    const railR = railL.clone()
    railR.position.x = deckWidth / 2 + 0.15
    bridge.add(railR)
  }

  for (const z of [-length * 0.35, length * 0.35]) {
    const pier = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.5, 3.5, 8),
      stoneMat,
    )
    pier.position.set(0, -0.5, z)
    pier.castShadow = true
    bridge.add(pier)
  }

  return bridge
}

/** 石灯笼 */
export function createStoneLantern(): THREE.Group {
  const lantern = new THREE.Group()
  const stoneMat = createRockMaterial()
  const trimMat = createGoldMaterial()

  addMesh(lantern, new THREE.BoxGeometry(0.7, 0.35, 0.7), stoneMat, 0.17)
  addMesh(lantern, new THREE.CylinderGeometry(0.2, 0.28, 1.2, 8), stoneMat, 0.9)
  addMesh(lantern, new THREE.BoxGeometry(0.55, 0.6, 0.55), stoneMat, 1.7)

  const lightBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.45, 0.4),
    createStandardMaterial({
      color: Palette.roofCrimson,
      emissive: 0xffaa55,
      emissiveIntensity: 0.25,
      roughness: 0.5,
    }),
  )
  lightBox.position.y = 2.15
  lantern.add(lightBox)

  addMesh(lantern, new THREE.CylinderGeometry(0.45, 0.35, 0.25, 8), trimMat, 2.55)
  addMesh(
    lantern,
    new THREE.ConeGeometry(0.5, 0.45, 4),
    createRoofMaterial(),
    2.9,
  )

  return lantern
}
