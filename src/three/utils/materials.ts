import * as THREE from 'three'
import { Palette } from './colors'
import {
  getSharedGrassColorMap,
  getSharedGrassNormalMap,
  getSharedRockNormalMap,
  getSharedRoofTileMap,
} from './proceduralTextures'

export interface StandardMaterialOptions {
  color?: number
  roughness?: number
  metalness?: number
  emissive?: number
  emissiveIntensity?: number
  vertexColors?: boolean
  map?: THREE.Texture
  normalMap?: THREE.Texture
  transparent?: boolean
  opacity?: number
}

export function createStandardMaterial(
  options: StandardMaterialOptions = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: options.color ?? 0xffffff,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.02,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    vertexColors: options.vertexColors ?? false,
    map: options.map,
    normalMap: options.normalMap,
    normalScale: options.normalMap ? new THREE.Vector2(0.6, 0.6) : undefined,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  })
}

export function createGrassMaterial(vertexColors = false): THREE.MeshStandardMaterial {
  return createStandardMaterial({
    color: Palette.grassMid,
    roughness: 0.88,
    metalness: 0,
    vertexColors,
    map: vertexColors ? undefined : getSharedGrassColorMap(),
    normalMap: getSharedGrassNormalMap(),
  })
}

export function createRockMaterial(): THREE.MeshStandardMaterial {
  return createStandardMaterial({
    color: Palette.rock,
    roughness: 0.92,
    normalMap: getSharedRockNormalMap(),
  })
}

export function createWoodMaterial(dark = false): THREE.MeshStandardMaterial {
  return createStandardMaterial({
    color: dark ? Palette.woodDark : Palette.wood,
    roughness: 0.78,
    metalness: 0,
  })
}

export function createFoliageMaterial(light = false): THREE.MeshStandardMaterial {
  return createStandardMaterial({
    color: light ? Palette.foliageLight : Palette.foliage,
    roughness: 0.85,
  })
}

export function createRoofMaterial(): THREE.MeshStandardMaterial {
  const mat = createStandardMaterial({
    color: 0xffffff,
    roughness: 0.65,
    map: getSharedRoofTileMap(),
    normalMap: getSharedRockNormalMap(),
  })
  mat.normalScale.set(0.3, 0.3)
  return mat
}

export function createWaterMaterial(): THREE.MeshStandardMaterial {
  return createStandardMaterial({
    color: Palette.water,
    roughness: 0.08,
    metalness: 0.35,
    transparent: true,
    opacity: 0.85,
  })
}

export function createGoldMaterial(): THREE.MeshStandardMaterial {
  return createStandardMaterial({
    color: Palette.roofGold,
    roughness: 0.35,
    metalness: 0.75,
  })
}
