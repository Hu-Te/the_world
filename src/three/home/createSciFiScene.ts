import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { disposeObject3D } from '../utils/dispose'
import { createHomeToolbox, type HomeToolboxHandle } from './createHomeToolbox'
import { createHomeHeroModel, type HomeHeroHandle } from './createHomeHeroModel'

export interface SciFiSceneHandle {
  group: THREE.Group
  core: THREE.Group
  hero: HomeHeroHandle
  toolbox: THREE.Group
  toolboxHandle: HomeToolboxHandle
  update: (elapsed: number, delta: number, pointerX?: number, pointerY?: number) => void
  dispose: () => void
}

export interface SciFiSceneContext {
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
}

const CORE_X = 14
const CORE_Y = 5
const CORE_Z = -6

function createAmbientStars(count = 1200): THREE.Points {
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const cA = new THREE.Color(0x6a9098)
  const cB = new THREE.Color(0x8aa8b8)
  const cC = new THREE.Color(0x9888b0)

  for (let i = 0; i < count; i++) {
    const radius = 55 + Math.random() * 140
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta) + CORE_X
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.18 + 8
    positions[i * 3 + 2] = radius * Math.cos(phi) + CORE_Z

    const pick = Math.random()
    const c = pick < 0.55 ? cA.clone().lerp(cB, Math.random()) : cA.clone().lerp(cC, Math.random())
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.11,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    }),
  )
}

/** 观测台地面坐标环 — 替代硬科幻网格 */
function createCoordinateDeck(): THREE.Group {
  const deck = new THREE.Group()
  deck.position.set(CORE_X, -9.98, CORE_Z)

  const ringMat = new THREE.LineBasicMaterial({
    color: 0x3a6878,
    transparent: true,
    opacity: 0.22,
  })

  ;[18, 28, 42, 58].forEach((r) => {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 80; i++) {
      const a = (i / 80) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r))
    }
    deck.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMat))
  })

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(Math.cos(a) * 58, 0, Math.sin(a) * 58),
    ]
    deck.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMat))
  }

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(62, 64),
    new THREE.MeshBasicMaterial({
      color: 0x1a3848,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  glow.rotation.x = -Math.PI / 2
  deck.add(glow)

  return deck
}

/** 首页背景 — 世界模拟枢纽 + 观测台氛围 */
export function createSciFiScene(ctx?: SciFiSceneContext): SciFiSceneHandle {
  const group = new THREE.Group()
  group.name = 'WorldSimHome'

  let envMap: THREE.Texture | null = null
  let pmrem: THREE.PMREMGenerator | null = null
  if (ctx) {
    pmrem = new THREE.PMREMGenerator(ctx.renderer)
    envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    ctx.scene.environment = envMap
    ctx.scene.environmentIntensity = 0.88
  }

  group.add(createCoordinateDeck(), createAmbientStars())

  const core = new THREE.Group()
  core.position.set(CORE_X, CORE_Y, CORE_Z)

  const hero = createHomeHeroModel(envMap)
  core.add(hero.root)
  group.add(core)

  const toolbox = createHomeToolbox(envMap)
  group.add(toolbox.group)

  const rimLight = new THREE.DirectionalLight(0x6a9098, 0.38)
  rimLight.position.set(-16, 16, 12)
  group.add(rimLight)

  const update = (elapsed: number, _delta: number, pointerX = 0, pointerY = 0) => {
    hero.update(elapsed, pointerX, pointerY)
    toolbox.update(elapsed, _delta, pointerX, pointerY)
  }

  const dispose = () => {
    hero.dispose()
    disposeObject3D(group)
    envMap?.dispose()
    pmrem?.dispose()
  }

  return { group, core, hero, toolbox: toolbox.group, toolboxHandle: toolbox, update, dispose }
}

export { CORE_X, CORE_Y, CORE_Z }
