import type * as THREE from 'three'

export type AccentMaterial =
  | THREE.MeshStandardMaterial
  | THREE.MeshPhysicalMaterial

export type CategoryNode = {
  id: string
  root: THREE.Group
  emblem: THREE.Group
  accentMats: AccentMaterial[]
  glow: THREE.Mesh
  pick: THREE.Mesh
  baseY: number
}

export type SculptResult = {
  emblem: THREE.Group
  mats: AccentMaterial[]
}
