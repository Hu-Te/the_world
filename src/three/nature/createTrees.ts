import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { createWoodMaterial, createFoliageMaterial } from '../utils/materials'
import { createSeededRandom, range } from '../utils/random'

/** 精致阔叶树：主干 + 分枝 + 多团树冠 */
export function createCherryTree(seed: number): THREE.Group {
  const tree = new THREE.Group()
  tree.name = 'BroadleafTree'

  const rand = createSeededRandom(seed)
  const trunkHeight = range(rand, 4, 7)
  const trunkMat = createWoodMaterial(true)
  const foliageMat = createFoliageMaterial(true)
  const foliageDark = createFoliageMaterial(false)

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.45, trunkHeight, 12),
    trunkMat,
  )
  trunk.position.y = trunkHeight / 2
  trunk.castShadow = true
  tree.add(trunk)

  const branchCount = 4
  for (let i = 0; i < branchCount; i++) {
    const branchH = trunkHeight * (0.45 + i * 0.12)
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.12, 1.8, 6),
      trunkMat,
    )
    const angle = (i / branchCount) * Math.PI * 2 + range(rand, 0, 0.5)
    branch.position.set(Math.cos(angle) * 0.3, branchH, Math.sin(angle) * 0.3)
    branch.rotation.z = Math.cos(angle) * 0.6
    branch.rotation.x = Math.sin(angle) * 0.6
    branch.castShadow = true
    tree.add(branch)
  }

  const crownCount = 7
  for (let i = 0; i < crownCount; i++) {
    const radius = range(rand, 1.2, 2.4)
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      i % 2 === 0 ? foliageMat : foliageDark,
    )
    const angle = range(rand, 0, Math.PI * 2)
    const dist = range(rand, 0, 1.8)
    crown.position.set(
      Math.cos(angle) * dist,
      trunkHeight + range(rand, 0.5, 3),
      Math.sin(angle) * dist,
    )
    crown.scale.set(
      range(rand, 0.85, 1.15),
      range(rand, 0.7, 1.05),
      range(rand, 0.85, 1.15),
    )
    crown.castShadow = true
    tree.add(crown)
  }

  return tree
}

/** 精致松树：扭曲树干 + 多层锥冠 */
export function createPineTree(seed: number): THREE.Group {
  const tree = new THREE.Group()
  tree.name = 'PineTree'

  const rand = createSeededRandom(seed)
  const trunkMat = createWoodMaterial(true)
  const foliageMat = createFoliageMaterial(false)
  const foliageLight = createFoliageMaterial(true)

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.34, 6.5, 10),
    trunkMat,
  )
  trunk.position.y = 3.25
  trunk.castShadow = true
  tree.add(trunk)

  const layers = 5
  for (let i = 0; i < layers; i++) {
    const radius = 3.2 - i * 0.55
    const height = 2.6 - i * 0.15
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 12),
      i % 2 === 0 ? foliageMat : foliageLight,
    )
    cone.position.y = 4 + i * 1.45
    cone.castShadow = true
    tree.add(cone)

    const coneLower = new THREE.Mesh(
      new THREE.ConeGeometry(radius * 1.08, height * 0.35, 12),
      createFoliageMaterial(i % 3 === 0),
    )
    coneLower.position.y = cone.position.y - height * 0.35
    coneLower.castShadow = true
    tree.add(coneLower)
  }

  return tree
}

/** 精致灌木：多球组合 */
export function createBush(seed: number): THREE.Group {
  const bush = new THREE.Group()
  const rand = createSeededRandom(seed)
  const mat = createFoliageMaterial(false)
  const matLight = createFoliageMaterial(true)

  const count = 4
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(range(rand, 0.5, 1), 1),
      i === 0 ? matLight : mat,
    )
    mesh.position.set(
      range(rand, -0.6, 0.6),
      range(rand, 0.3, 1),
      range(rand, -0.6, 0.6),
    )
    mesh.castShadow = true
    bush.add(mesh)
  }

  return bush
}

/** 野花点缀 */
export function createWildflowers(seed: number): THREE.Group {
  const flowers = new THREE.Group()
  const rand = createSeededRandom(seed)
  const colors = [0xffeb3b, 0xffffff, 0xff8a80, 0xce93d8]

  for (let i = 0; i < 6; i++) {
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, range(rand, 0.3, 0.6), 4),
      createWoodMaterial(true),
    )
    stem.position.set(range(rand, -0.5, 0.5), 0.2, range(rand, -0.5, 0.5))
    flowers.add(stem)

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.7,
      }),
    )
    head.position.copy(stem.position)
    head.position.y += 0.35
    flowers.add(head)
  }

  return flowers
}
