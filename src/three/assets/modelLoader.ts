import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { disposeObject3D } from '../utils/dispose'
import { getModelAnchor } from './mountSlots'
import type { ModelPlacement } from './modelRegistry'

export interface LoadedModel {
  name: string
  root: THREE.Group
  animations: THREE.AnimationClip[]
  mixer: THREE.AnimationMixer | null
  update: (delta: number) => void
  dispose: () => void
}

export interface LoadModelOptions {
  url: string
  name?: string
  position?: THREE.Vector3 | [number, number, number]
  rotation?: THREE.Euler | [number, number, number]
  scale?: number | THREE.Vector3 | [number, number, number]
  castShadow?: boolean
  receiveShadow?: boolean
  /** 默认 true；角色等需手动控制动画时设为 false */
  autoPlay?: boolean
}

const loader = new GLTFLoader()

function toVector3(
  value?: THREE.Vector3 | [number, number, number],
): THREE.Vector3 | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? new THREE.Vector3(...value) : value
}

function toEuler(
  value?: THREE.Euler | [number, number, number],
): THREE.Euler | undefined {
  if (!value) return undefined
  return Array.isArray(value) ? new THREE.Euler(...value) : value
}

function toScaleVector(
  value?: number | THREE.Vector3 | [number, number, number],
): THREE.Vector3 | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'number') return new THREE.Vector3(value, value, value)
  return Array.isArray(value) ? new THREE.Vector3(...value) : value
}

function prepareGltfMaterials(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return

    const materials = Array.isArray(child.material) ? child.material : [child.material]
    for (const material of materials) {
      if (!material) continue

      const maps = [
        'map',
        'emissiveMap',
        'normalMap',
        'roughnessMap',
        'metalnessMap',
        'aoMap',
      ] as const

      for (const key of maps) {
        const tex = material[key]
        if (tex && 'colorSpace' in tex) {
          tex.colorSpace = THREE.SRGBColorSpace
        }
      }

      if (material instanceof THREE.MeshStandardMaterial) {
        material.envMapIntensity = 1
        material.roughness = Math.min(material.roughness, 0.95)
      }
    }
  })
}

function applyShadowFlags(root: THREE.Object3D, cast: boolean, receive: boolean): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast
      child.receiveShadow = receive
    }
  })
}

export function loadGltfModel(options: LoadModelOptions): Promise<LoadedModel> {
  const {
    url,
    name = url.split('/').pop() ?? 'model',
    castShadow = true,
    receiveShadow = true,
    autoPlay = true,
  } = options

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene
        root.name = name

        prepareGltfMaterials(root)

        const position = toVector3(options.position)
        const rotation = toEuler(options.rotation)
        const scale = toScaleVector(options.scale)

        if (position) root.position.copy(position)
        if (rotation) root.rotation.copy(rotation)
        if (scale) root.scale.copy(scale)

        applyShadowFlags(root, castShadow, receiveShadow)

        const mixer =
          gltf.animations.length > 0 ? new THREE.AnimationMixer(root) : null

        if (mixer && autoPlay) {
          gltf.animations.forEach((clip) => mixer.clipAction(clip).play())
        }

        resolve({
          name,
          root,
          animations: gltf.animations,
          mixer,
          update: (delta: number) => {
            mixer?.update(delta)
          },
          dispose: () => {
            mixer?.stopAllAction()
            disposeObject3D(root)
          },
        })
      },
      undefined,
      (error) => reject(error),
    )
  })
}

export interface LoadModelsContext {
  modelsRoot: THREE.Group
  getIslandGroup?: (index: number) => THREE.Group | undefined
}

export async function loadRegisteredModels(
  placements: ModelPlacement[],
  context: LoadModelsContext,
): Promise<LoadedModel[]> {
  if (placements.length === 0) return []

  const results: LoadedModel[] = []

  for (const placement of placements) {
    try {
      const model = await loadGltfModel({
        url: placement.url,
        name: placement.name,
        position: placement.position,
        rotation: placement.rotation,
        scale: placement.scale,
        castShadow: placement.castShadow,
        receiveShadow: placement.receiveShadow,
      })

      let parent: THREE.Object3D = context.modelsRoot

      if (placement.slotId) {
        const anchor = getModelAnchor(placement.slotId)
        parent = anchor ?? context.modelsRoot
        if (!anchor) {
          console.warn(`[models] 未找到挂点: ${placement.slotId}`)
        }
      } else if (placement.mountainIndex !== undefined) {
        parent = context.getIslandGroup?.(placement.mountainIndex) ?? context.modelsRoot
      }

      parent.add(model.root)
      results.push(model)
    } catch (error) {
      console.warn(`[models] 加载失败: ${placement.url}`, error)
    }
  }

  return results
}
