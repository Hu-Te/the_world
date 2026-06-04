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

function addMeshAt(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  castShadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(x, y, z)
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

/** 木格窗 */
function addLatticeWindow(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  rotY: number,
  width: number,
  height: number,
  frameMat: THREE.Material,
  panelMat: THREE.Material,
): void {
  const frame = new THREE.Group()
  frame.position.set(x, y, z)
  frame.rotation.y = rotY
  parent.add(frame)

  addMeshAt(frame, new THREE.BoxGeometry(width, height, 0.08), frameMat, 0, 0, 0)
  const barW = 0.06
  addMeshAt(frame, new THREE.BoxGeometry(barW, height * 0.82, 0.1), panelMat, 0, 0, 0.04)
  addMeshAt(frame, new THREE.BoxGeometry(width * 0.82, barW, 0.1), panelMat, 0, 0, 0.04)
  addMeshAt(frame, new THREE.BoxGeometry(barW, height * 0.82, 0.1), panelMat, -width * 0.22, 0, 0.04)
  addMeshAt(frame, new THREE.BoxGeometry(barW, height * 0.82, 0.1), panelMat, width * 0.22, 0, 0.04)
}

/** 飞檐翘角 */
function addEaveTips(
  parent: THREE.Object3D,
  radius: number,
  y: number,
  sides: number,
  roofMat: THREE.Material,
  trimMat: THREE.Material,
): void {
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 4), roofMat)
    tip.position.set(Math.cos(angle) * radius * 1.08, y + 0.2, Math.sin(angle) * radius * 1.08)
    tip.rotation.z = Math.cos(angle) * 0.55
    tip.rotation.x = Math.sin(angle) * 0.55
    tip.castShadow = true
    parent.add(tip)

    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), trimMat)
    cap.position.copy(tip.position)
    cap.position.y += 0.28
    parent.add(cap)
  }
}

/** 环形栏杆 */
function addRingRailing(
  parent: THREE.Object3D,
  radius: number,
  y: number,
  sides: number,
  postMat: THREE.Material,
  railMat: THREE.Material,
): void {
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), postMat)
    post.position.set(Math.cos(angle) * radius, y + 0.28, Math.sin(angle) * radius)
    post.castShadow = true
    parent.add(post)
  }

  for (let level of [0.42, 0.62]) {
    const rail = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.05, 6, sides),
      railMat,
    )
    rail.rotation.x = Math.PI / 2
    rail.position.y = y + level
    parent.add(rail)
  }
}

/** 斗拱层（檐下托举） */
function addBracketRing(
  parent: THREE.Object3D,
  radius: number,
  y: number,
  sides: number,
  woodMat: THREE.Material,
  trimMat: THREE.Material,
): void {
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + Math.PI / sides
    const bracket = new THREE.Group()
    bracket.position.set(Math.cos(angle) * radius * 0.9, y, Math.sin(angle) * radius * 0.9)
    bracket.rotation.y = -angle + Math.PI / 2
    parent.add(bracket)

    addMeshAt(bracket, new THREE.BoxGeometry(0.35, 0.12, 0.22), woodMat, 0, 0, 0)
    addMeshAt(bracket, new THREE.BoxGeometry(0.28, 0.1, 0.18), trimMat, 0, 0.1, 0.04)
    addMeshAt(bracket, new THREE.BoxGeometry(0.2, 0.08, 0.14), woodMat, 0, 0.18, 0.07)
  }
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
  const panelMat = createWoodMaterial()
  const doorMat = createWoodMaterial(true)

  const baseSize = 7
  for (let step = 0; step < 4; step++) {
    const s = baseSize + (3 - step) * 1.1
    addMesh(pagoda, new THREE.BoxGeometry(s, 0.38, s), stoneMat, step * 0.38)
  }

  for (let step = 0; step < 3; step++) {
    const s = baseSize * 0.55
    const sx = -s / 2 + (step + 0.5) * (s / 3)
    addMeshAt(
      pagoda,
      new THREE.BoxGeometry(s / 3.2, 0.22, s * 0.7),
      stoneMat,
      sx,
      1.55,
      baseSize * 0.42,
    )
  }

  const doorFrame = addMesh(
    pagoda,
    new THREE.BoxGeometry(1.4, 2.6, 0.18),
    panelMat,
    2.0,
  )
  doorFrame.position.z = baseSize * 0.42

  addMeshAt(
    pagoda,
    new THREE.BoxGeometry(1.0, 2.2, 0.12),
    doorMat,
    0,
    2.1,
    baseSize * 0.48,
  )

  addMeshAt(
    pagoda,
    new THREE.BoxGeometry(1.8, 0.2, 0.22),
    trimMat,
    0,
    3.35,
    baseSize * 0.46,
  )

  let y = 1.55
  const sides = 8

  for (let i = 0; i < tiers; i++) {
    const scale = 1 - i * 0.12
    const tierHeight = 3.4 - i * 0.2
    const radius = baseSize * 0.42 * scale

    addMesh(
      pagoda,
      new THREE.CylinderGeometry(radius * 0.92, radius, tierHeight, sides),
      wallMat,
      y + tierHeight / 2,
    )

    const windowCount = Math.max(4, sides - i)
    for (let w = 0; w < windowCount; w++) {
      const angle = (w / windowCount) * Math.PI * 2
      addLatticeWindow(
        pagoda,
        Math.cos(angle) * radius * 0.88,
        y + tierHeight * 0.55,
        Math.sin(angle) * radius * 0.88,
        -angle + Math.PI / 2,
        0.75 - i * 0.04,
        1.1 - i * 0.05,
        panelMat,
        pillarMat,
      )
    }

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

      const capital = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.14, 0.28),
        trimMat,
      )
      capital.position.set(pillar.position.x, y + tierHeight - 0.1, pillar.position.z)
      pagoda.add(capital)
    }

    if (i < tiers - 1) {
      addRingRailing(pagoda, radius * 0.78, y + tierHeight * 0.15, sides, pillarMat, panelMat)
    }

    addBracketRing(pagoda, radius, y + tierHeight + 0.02, sides, panelMat, trimMat)

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

    addEaveTips(pagoda, radius * 1.15, y + tierHeight + roofHeight * 0.35, sides, roofMat, trimMat)

    for (let c = 0; c < sides; c++) {
      const angle = (c / sides) * Math.PI * 2 + Math.PI / sides
      const corner = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.5, 0.25), trimMat)
      corner.position.set(
        Math.cos(angle) * radius * 1.05,
        y + tierHeight + 0.3,
        Math.sin(angle) * radius * 1.05,
      )
      pagoda.add(corner)
    }

    const bell = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + (tiers - i) * 0.01, 8, 8),
      trimMat,
    )
    bell.position.y = y + tierHeight + roofHeight * 0.72
    pagoda.add(bell)

    y += tierHeight + roofHeight * 0.65
  }

  const spireBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.45, 2.5, 8),
    trimMat,
  )
  spireBase.position.y = y + 1.2
  pagoda.add(spireBase)

  for (let ring = 0; ring < 3; ring++) {
    const r = 0.35 - ring * 0.08
    const disc = new THREE.Mesh(new THREE.TorusGeometry(r, 0.04, 6, 12), trimMat)
    disc.rotation.x = Math.PI / 2
    disc.position.y = y + 1.6 + ring * 0.45
    pagoda.add(disc)
  }

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), trimMat)
  orb.position.y = y + 2.8
  pagoda.add(orb)

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.8, 6), trimMat)
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
  const floorMat = createWoodMaterial(true)

  const radius = 3.6
  const sides = 6

  addMesh(
    pavilion,
    new THREE.CylinderGeometry(radius + 1.4, radius + 1.6, 0.55, sides),
    stoneMat,
    0.28,
  )

  addMesh(
    pavilion,
    new THREE.CylinderGeometry(radius + 0.15, radius + 0.15, 0.12, sides),
    floorMat,
    0.62,
  )

  addMesh(
    pavilion,
    new THREE.CylinderGeometry(radius + 0.6, radius + 0.6, 0.28, sides),
    trimMat,
    0.58,
  )

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 3.9, 10),
      pillarMat,
    )
    pillar.position.set(Math.cos(angle) * radius, 2.45, Math.sin(angle) * radius)
    pillar.castShadow = true
    pavilion.add(pillar)

    const capital = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.32), trimMat)
    capital.position.set(pillar.position.x, 4.35, pillar.position.z)
    pavilion.add(capital)
  }

  const kingPost = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.26, 3.2, 8),
    pillarMat,
  )
  kingPost.position.y = 2.6
  kingPost.castShadow = true
  pavilion.add(kingPost)

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, radius * 1.05), railMat)
    beam.position.set(Math.cos(angle) * radius * 0.52, 4.1, Math.sin(angle) * radius * 0.52)
    beam.rotation.y = -angle + Math.PI / 2
    pavilion.add(beam)
  }

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const nextAngle = ((i + 1) / sides) * Math.PI * 2
    const midAngle = (angle + nextAngle) / 2
    const dist = radius * 0.52

    for (const level of [0.55, 1.05, 1.55]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, radius * 0.92),
        railMat,
      )
      rail.position.set(Math.cos(midAngle) * dist, level, Math.sin(midAngle) * dist)
      rail.rotation.y = -midAngle + Math.PI / 2
      pavilion.add(rail)
    }

    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.2, 0.12), railMat)
    post.position.set(Math.cos(angle) * radius * 0.88, 1.05, Math.sin(angle) * radius * 0.88)
    pavilion.add(post)
  }

  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 0.55), railMat)
  bench.position.set(0, 0.8, -radius * 0.35)
  bench.castShadow = true
  pavilion.add(bench)

  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.18, 8), stoneMat)
  table.position.set(0, 0.95, radius * 0.2)
  pavilion.add(table)

  addBracketRing(pavilion, radius * 0.95, 4.45, sides, railMat, trimMat)

  const roof1 = new THREE.Mesh(
    new THREE.ConeGeometry(radius + 1.7, 1.65, sides),
    roofMat,
  )
  roof1.position.y = 4.85
  roof1.castShadow = true
  pavilion.add(roof1)

  addEaveTips(pavilion, radius + 1.45, 5.35, sides, roofMat, trimMat)

  const roof2 = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.78, 1.45, sides),
    roofMat,
  )
  roof2.position.y = 5.85
  roof2.castShadow = true
  pavilion.add(roof2)

  addEaveTips(pavilion, radius * 0.65, 6.25, sides, roofMat, trimMat)

  const roofCap = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 12), trimMat)
  roofCap.position.y = 6.65
  pavilion.add(roofCap)

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 6), trimMat)
  finial.position.y = 7.15
  pavilion.add(finial)

  const lanternMat = createStandardMaterial({
    color: Palette.roofCrimson,
    emissive: Palette.roofCrimson,
    emissiveIntensity: 0.22,
    roughness: 0.55,
  })

  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2
    const lantern = new THREE.Group()
    lantern.position.set(
      Math.cos(angle) * (radius + 0.35),
      3.65,
      Math.sin(angle) * (radius + 0.35),
    )
    pavilion.add(lantern)

    addMeshAt(lantern, new THREE.BoxGeometry(0.12, 0.5, 0.12), railMat, 0, -0.25, 0)
    addMeshAt(lantern, new THREE.BoxGeometry(0.38, 0.5, 0.38), lanternMat, 0, 0.05, 0)
    addMeshAt(lantern, new THREE.ConeGeometry(0.28, 0.25, 4), roofMat, 0, 0.42, 0)
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
  const lightMat = createStandardMaterial({
    color: Palette.roofCrimson,
    emissive: 0xffaa55,
    emissiveIntensity: 0.3,
    roughness: 0.45,
  })

  addMesh(lantern, new THREE.BoxGeometry(0.85, 0.28, 0.85), stoneMat, 0.14)
  addMesh(lantern, new THREE.BoxGeometry(0.72, 0.22, 0.72), stoneMat, 0.36)
  addMesh(lantern, new THREE.CylinderGeometry(0.22, 0.3, 1.15, 8), stoneMat, 0.95)
  addMesh(lantern, new THREE.BoxGeometry(0.62, 0.18, 0.62), trimMat, 1.62)

  const chamber = new THREE.Group()
  chamber.position.y = 2.05
  lantern.add(chamber)

  addMeshAt(chamber, new THREE.BoxGeometry(0.58, 0.62, 0.58), stoneMat, 0, 0, 0)
  addMeshAt(chamber, new THREE.BoxGeometry(0.42, 0.48, 0.08), lightMat, 0, 0, 0.3)
  addMeshAt(chamber, new THREE.BoxGeometry(0.42, 0.48, 0.08), lightMat, 0, 0, -0.3)
  addMeshAt(chamber, new THREE.BoxGeometry(0.08, 0.48, 0.42), lightMat, 0.3, 0, 0)
  addMeshAt(chamber, new THREE.BoxGeometry(0.08, 0.48, 0.42), lightMat, -0.3, 0, 0)

  addMesh(lantern, new THREE.BoxGeometry(0.52, 0.14, 0.52), stoneMat, 2.48)
  addMesh(lantern, new THREE.CylinderGeometry(0.48, 0.38, 0.28, 8), trimMat, 2.68)
  addMesh(lantern, new THREE.ConeGeometry(0.55, 0.5, 4), createRoofMaterial(), 2.98)

  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 6, 8), trimMat)
  hook.rotation.x = Math.PI / 2
  hook.position.y = 3.28
  lantern.add(hook)

  return lantern
}
