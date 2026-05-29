import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { disposeObject3D } from '../utils/dispose'
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

function applyShadowFlags(root: THREE.Object3D, cast: boolean, receive: boolean): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast
      child.receiveShadow = receive
    }
  })
}

/** 加载单个 GLTF/GLB 模型 */
export function loadGltfModel(options: LoadModelOptions): Promise<LoadedModel> {
  const {
    url,
    name = url.split('/').pop() ?? 'model',
    castShadow = true,
    receiveShadow = true,
  } = options

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const root = gltf.scene
        root.name = name

        const position = toVector3(options.position)
        const rotation = toEuler(options.rotation)
        const scale = toScaleVector(options.scale)

        if (position) root.position.copy(position)
        if (rotation) root.rotation.copy(rotation)
        if (scale) root.scale.copy(scale)

        applyShadowFlags(root, castShadow, receiveShadow)

        const mixer =
          gltf.animations.length > 0 ? new THREE.AnimationMixer(root) : null

        if (mixer) {
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

/** 按注册表批量加载模型并挂到场景 */
export async function loadRegisteredModels(
  placements: ModelPlacement[],
  context: LoadModelsContext,
): Promise<LoadedModel[]> {
  if (placements.length === 0) {
    return []
  }

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

      const parent =
        placement.islandIndex !== undefined
          ? context.getIslandGroup?.(placement.islandIndex)
          : context.modelsRoot

      ;(parent ?? context.modelsRoot).add(model.root)
      results.push(model)
    } catch (error) {
      console.warn(`[models] 加载失败: ${placement.url}`, error)
    }
  }

  return results
}
