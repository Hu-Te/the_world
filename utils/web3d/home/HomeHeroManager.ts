/**
 * 首页沉浸场景：固定悬浮分类 · 环视 + 点击选中
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  IDLE_FRAME_INTERVAL_MS,
  PAUSE_WHEN_HIDDEN,
  resolvePixelRatioCap,
} from '../performanceBudget'
import { disposeObject3D } from '../dispose'
import { SharedGeoPool } from './materials'
import { resolveHomeQuality } from './quality'
import { buildRoom } from './buildRoom'
import { buildHub } from './buildHub'
import { buildCategories } from './buildCategories'
import { buildParticles } from './buildParticles'
import { buildBackdrop, type BackdropHandle } from './buildBackdrop'
import { CYAN, INK, CATEGORY_BASE_Y } from './theme'
import type { CategoryNode } from './types'

export interface HomeHeroManagerOptions {
  canvas: HTMLCanvasElement
  pixelRatioCap?: number
  /** 点击分类模型：打开工具箱 */
  onSelectCategory?: (id: string) => void
}

function shortestAngleDiff(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

export class HomeHeroManager {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer

  private readonly controls: OrbitControls
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointerNdc = new THREE.Vector2(-2, -2)
  private readonly clock = new THREE.Clock()
  private readonly categories: CategoryNode[] = []
  private readonly pickMeshes: THREE.Object3D[] = []
  private readonly textures: THREE.Texture[] = []
  private readonly geos = new SharedGeoPool()
  private readonly quality = resolveHomeQuality()
  private disposeCategoryOwned: (() => void) | null = null
  private readonly hub: THREE.Group
  private readonly hubAnim = {
    ring: null as THREE.Object3D | null,
    ring2: null as THREE.Object3D | null,
    ring3: null as THREE.Object3D | null,
    cage: null as THREE.Object3D | null,
    stack: null as THREE.Object3D | null,
    halo: null as THREE.Object3D | null,
    core: null as THREE.Object3D | null,
    spark: null as THREE.Object3D | null,
    floorGlow: null as THREE.Mesh | null,
  }
  private readonly particles: THREE.Points
  private readonly floorRings: THREE.Mesh[] = []
  private backdrop: BackdropHandle | null = null
  private readonly pmrem: THREE.PMREMGenerator | null = null
  private envMap: THREE.Texture | null = null
  private readonly onSelectCategory?: (id: string) => void
  private readonly floorRingBaseOpacity = [0.48, 0.22, 0.32]

  private focusedId: string | null = null
  private hoveredId: string | null = null
  private interacting = false
  private pointerDown: {
    x: number
    y: number
    hitId: string | null
    didDrag: boolean
  } | null = null
  private animationId = 0
  private disposed = false
  private inViewport = true
  private pageVisible = true
  private lastFrameAt = 0
  private needsRender = true
  private width = 1
  private height = 1

  constructor(options: HomeHeroManagerOptions) {
    const {
      canvas,
      pixelRatioCap = Math.min(resolvePixelRatioCap(), this.quality.maxDpr),
      onSelectCategory,
    } = options
    this.onSelectCategory = onSelectCategory

    this.scene = new THREE.Scene()
    // 背景由 buildBackdrop 设置星空穹顶；此处先铺底色防止白闪
    this.scene.background = new THREE.Color(INK)

    this.width = Math.max(canvas.clientWidth || 1, 1)
    this.height = Math.max(canvas.clientHeight || 1, 1)

    this.camera = new THREE.PerspectiveCamera(36, this.width / this.height, 0.1, 80)
    // 固定仰角：只能水平环绕，不可上下拖拽；半径拉远保留当前视角感
    const orbitTargetY = CATEGORY_BASE_Y * 0.72
    const polar = 1.315
    const radius = 12.6
    this.camera.position.set(
      0,
      orbitTargetY + radius * Math.cos(polar),
      radius * Math.sin(polar),
    )

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality.device === 'desktop',
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap))
    this.renderer.setSize(this.width, this.height, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.02
    this.renderer.shadowMap.enabled = false

    if (this.quality.useEnvMap) {
      this.pmrem = new THREE.PMREMGenerator(this.renderer)
      this.envMap = this.buildCoolEnvMap()
      this.scene.environment = this.envMap
      this.scene.environmentIntensity = 0.95
    }

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.07
    this.controls.enablePan = false
    this.controls.enableZoom = false
    this.controls.enableRotate = true
    this.controls.minPolarAngle = polar
    this.controls.maxPolarAngle = polar
    this.controls.target.set(0, orbitTargetY, 0)
    this.controls.addEventListener('start', () => {
      this.interacting = true
      this.needsRender = true
    })
    this.controls.addEventListener('end', () => {
      this.interacting = false
      this.needsRender = true
    })
    this.controls.addEventListener('change', () => {
      this.needsRender = true
    })

    // 全冷色三点光：去掉暖白主光，统一青钢调
    this.scene.add(new THREE.AmbientLight(0x081018, 0.22))
    this.scene.add(new THREE.HemisphereLight(0x8eb8d0, 0x040810, 0.48))
    const key = new THREE.DirectionalLight(0xd2e8f4, 1.45)
    key.position.set(4.5, 11, 3.5)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0x4a7a98, 0.38)
    fill.position.set(-6.5, 3.5, -2)
    this.scene.add(fill)
    const rim = new THREE.DirectionalLight(0x7ad0f0, 0.95)
    rim.position.set(-1.5, 3.5, -6)
    this.scene.add(rim)

    const pushTex = (t: THREE.Texture) => this.textures.push(t)

    this.backdrop = buildBackdrop(this.scene, this.quality, pushTex)
    buildRoom(this.scene, this.quality, pushTex, this.floorRings)
    this.hub = buildHub(this.geos, this.quality, pushTex)
    this.scene.add(this.hub)
    this.hubAnim.ring = this.hub.getObjectByName('hubRing') ?? null
    this.hubAnim.ring2 = this.hub.getObjectByName('hubRing2') ?? null
    this.hubAnim.ring3 = this.hub.getObjectByName('hubRing3') ?? null
    this.hubAnim.cage = this.hub.getObjectByName('hubCage') ?? null
    this.hubAnim.stack = this.hub.getObjectByName('hubStack') ?? null
    this.hubAnim.halo = this.hub.getObjectByName('hubHalo') ?? null
    this.hubAnim.core = this.hub.getObjectByName('hubCore') ?? null
    this.hubAnim.spark = this.hub.getObjectByName('hubSpark') ?? null
    this.hubAnim.floorGlow = (this.hub.getObjectByName('hubFloorGlow') as THREE.Mesh | undefined) ?? null

    const built = buildCategories(this.scene, this.geos, this.quality, pushTex)
    this.categories.push(...built.nodes)
    this.disposeCategoryOwned = built.disposeOwned
    for (const c of this.categories) this.pickMeshes.push(c.pick)

    this.particles = buildParticles(this.quality.particleCount)
    this.scene.add(this.particles)

    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('pointerdown', this.onPointerDown, { capture: true })
    canvas.addEventListener('pointerup', this.onPointerUp, { capture: true })
    document.addEventListener('visibilitychange', this.onVisibility)

    this.updateFacingFocus(true)
    this.tick()
  }

  private buildCoolEnvMap(): THREE.Texture {
    const envScene = new THREE.Scene()
    envScene.background = new THREE.Color(0x0a1522)
    envScene.add(new THREE.AmbientLight(0x4a7088, 0.55))
    envScene.add(new THREE.HemisphereLight(0xa8d0e8, 0x060c14, 0.9))
    const a = new THREE.DirectionalLight(0xc8e4f4, 2.2)
    a.position.set(4, 7, 2)
    envScene.add(a)
    const b = new THREE.DirectionalLight(0x3a6080, 1.1)
    b.position.set(-5, 2, -4)
    envScene.add(b)
    const c = new THREE.DirectionalLight(0x70c8e8, 0.8)
    c.position.set(0, 3, -6)
    envScene.add(c)
    return this.pmrem!.fromScene(envScene, 0.04).texture
  }

  private orbitToCategory(id: string): void {
    const node = this.categories.find((c) => c.id === id)
    if (!node) return
    const angle = (node.root.userData.angle as number) ?? 0
    const dist = Math.hypot(this.camera.position.x, this.camera.position.z) || 12.6
    const y = this.camera.position.y
    this.camera.position.set(Math.sin(angle) * dist, y, Math.cos(angle) * dist)
    this.controls.update()
    this.updateFacingFocus(true)
    this.needsRender = true
  }

  private openToolbox(id: string): void {
    this.focusedId = id
    this.onSelectCategory?.(id)
    this.needsRender = true
  }

  private syncPointerNdc(e: PointerEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const w = Math.max(rect.width, 1)
    const h = Math.max(rect.height, 1)
    this.pointerNdc.x = ((e.clientX - rect.left) / w) * 2 - 1
    this.pointerNdc.y = -((e.clientY - rect.top) / h) * 2 + 1
  }

  private hitCategoryId(): string | null {
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const hits = this.raycaster.intersectObjects(this.pickMeshes, false)
    return (hits[0]?.object.userData.categoryId as string) ?? null
  }

  private getFacingCategoryId(): string | null {
    const camAngle = Math.atan2(this.camera.position.x, this.camera.position.z)
    let bestId: string | null = null
    let bestDiff = Infinity
    for (const c of this.categories) {
      const a = (c.root.userData.angle as number) ?? 0
      const diff = shortestAngleDiff(camAngle, a)
      if (diff < bestDiff) {
        bestDiff = diff
        bestId = c.id
      }
    }
    return bestId
  }

  private updateFacingFocus(force = false): void {
    const id = this.getFacingCategoryId()
    if (id === this.focusedId && !force) return
    this.focusedId = id
    this.needsRender = true
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    this.syncPointerNdc(e)
    if (this.pointerDown) {
      const dx = e.clientX - this.pointerDown.x
      const dy = e.clientY - this.pointerDown.y
      if (dx * dx + dy * dy > 25) {
        this.pointerDown.didDrag = true
        // 按下在模型上但转为拖拽时，恢复环视
        if (!this.controls.enableRotate) {
          this.controls.enableRotate = true
          this.renderer.domElement.style.cursor = 'grabbing'
        }
      }
    }
    const hit = this.hitCategoryId()
    if (hit !== this.hoveredId) {
      this.hoveredId = hit
      this.renderer.domElement.style.cursor = hit
        ? 'pointer'
        : this.interacting || this.pointerDown
          ? 'grabbing'
          : 'grab'
      this.needsRender = true
    } else if (this.pointerDown) {
      this.needsRender = true
    }
  }

  private readonly onPointerLeave = () => {
    this.pointerNdc.set(-2, -2)
    this.pointerDown = null
    this.controls.enableRotate = true
    if (this.hoveredId) {
      this.hoveredId = null
    }
    this.renderer.domElement.style.cursor = 'grab'
    this.needsRender = true
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    this.syncPointerNdc(e)
    const hitId = this.hitCategoryId()
    this.pointerDown = { x: e.clientX, y: e.clientY, hitId, didDrag: false }
    // 点在模型上先禁旋转，保证单击可选中
    this.controls.enableRotate = !hitId
    this.renderer.domElement.style.cursor = hitId ? 'pointer' : 'grabbing'
  }

  private readonly onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0) return
    const down = this.pointerDown
    this.pointerDown = null
    this.controls.enableRotate = true

    if (down && !down.didDrag) {
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      if (dx * dx + dy * dy <= 100) {
        this.syncPointerNdc(e)
        const id = this.hitCategoryId() ?? down.hitId
        if (id) {
          this.orbitToCategory(id)
          this.openToolbox(id)
        }
      }
    }

    this.renderer.domElement.style.cursor = this.hitCategoryId() ? 'pointer' : 'grab'
    this.needsRender = true
  }

  private updateMotion(t: number): void {
    for (const c of this.categories) {
      const hovering = c.id === this.hoveredId
      const facing = c.id === this.focusedId

      const target = hovering ? 1.045 : facing ? 1.0 : 0.965
      const s = c.root.scale.x + (target - c.root.scale.x) * 0.14
      c.root.scale.setScalar(s)
      c.root.position.y = c.baseY

      const core = c.accentMats[3]
      if (core && 'emissiveIntensity' in core) {
        core.emissiveIntensity = hovering ? 1.15 : facing ? 0.85 : 0.55
      }
      ;(c.glow.material as THREE.MeshBasicMaterial).opacity = hovering
        ? 0.26
        : facing
          ? 0.16
          : 0.1

      c.emblem.rotation.y = hovering ? t * 0.32 : t * 0.07
    }

    const ha = this.hubAnim
    if (ha.ring) ha.ring.rotation.y = t * 0.55
    if (ha.ring2) {
      ha.ring2.rotation.z = -t * 0.72
      ha.ring2.rotation.y = t * 0.18
    }
    if (ha.ring3) {
      ha.ring3.rotation.y = t * 0.88
      ha.ring3.rotation.x = 0.4 + Math.sin(t * 0.4) * 0.08
    }
    if (ha.cage) ha.cage.rotation.y = -t * 0.22
    if (ha.stack) ha.stack.rotation.y = t * 0.05
    if (ha.halo) {
      ha.halo.rotation.y = Math.sin(t * 0.35) * 0.12
      ha.halo.position.y = 0.18 + Math.sin(t * 0.75) * 0.02
    }
    if (ha.core) {
      ha.core.rotation.y = t * 1.05
      ha.core.rotation.x = Math.sin(t * 0.45) * 0.15
      ha.core.rotation.z = Math.cos(t * 0.35) * 0.08
      ha.core.position.y = 0.18 + Math.sin(t * 1.25) * 0.032
      ha.core.scale.setScalar(1 + Math.sin(t * 2.0) * 0.03)
    }
    if (ha.spark) {
      ha.spark.rotation.y = t * 0.35
      ha.spark.rotation.x = t * 0.12
    }
    if (ha.floorGlow?.material instanceof THREE.MeshBasicMaterial) {
      ha.floorGlow.material.opacity = 0.82 + Math.sin(t * 1.1) * 0.12
      const s = 1 + Math.sin(t * 0.9) * 0.045
      ha.floorGlow.scale.set(s, s, 1)
    }
    this.hub.rotation.y = t * 0.032
    this.particles.rotation.y = t * 0.018
    this.backdrop?.update(t)

    const focusBoost = this.focusedId ? 1 : 0
    for (let i = 0; i < this.floorRings.length; i++) {
      const mat = this.floorRings[i]!.material as THREE.MeshBasicMaterial
      const base = this.floorRingBaseOpacity[i] ?? 0.2
      mat.opacity = base + Math.sin(t * 1.1 + i) * 0.04 + focusBoost * 0.05
    }
  }

  setInViewport(inView: boolean): void {
    this.inViewport = inView
    if (inView) this.needsRender = true
  }

  private get canRender(): boolean {
    return this.inViewport && this.pageVisible
  }

  private readonly onVisibility = () => {
    this.pageVisible = !document.hidden
    if (this.pageVisible) this.needsRender = true
  }

  resize(width: number, height: number): void {
    if (this.disposed) return
    this.width = Math.max(width, 1)
    this.height = Math.max(height, 1)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(this.width, this.height, false)
    this.needsRender = true
  }

  private tick = (): void => {
    if (this.disposed) return
    this.animationId = requestAnimationFrame(this.tick)
    if (PAUSE_WHEN_HIDDEN && !this.canRender) return

    const now = performance.now()
    const busy = this.interacting || this.hoveredId !== null
    if (!busy && !this.needsRender && now - this.lastFrameAt < IDLE_FRAME_INTERVAL_MS) {
      return
    }

    const t = this.clock.getElapsedTime()
    this.controls.update()
    this.updateFacingFocus()
    this.updateMotion(t)
    this.renderer.render(this.scene, this.camera)
    this.lastFrameAt = now
    if (!this.interacting && !busy) this.needsRender = false
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.animationId)
    document.removeEventListener('visibilitychange', this.onVisibility)
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerleave', this.onPointerLeave)
    el.removeEventListener('pointerdown', this.onPointerDown, { capture: true } as EventListenerOptions)
    el.removeEventListener('pointerup', this.onPointerUp, { capture: true } as EventListenerOptions)
    this.controls.dispose()
    el.style.cursor = ''

    this.disposeCategoryOwned?.()
    const hubMats = this.hub.userData.ownedMats as THREE.Material[] | undefined
    if (hubMats) for (const m of hubMats) m.dispose()
    const hubGeos = this.hub.userData.ownedGeos as THREE.BufferGeometry[] | undefined
    if (hubGeos) for (const geo of hubGeos) geo.dispose()

    for (const t of this.textures) t.dispose()
    this.textures.length = 0
    // 避免与 disposeObject3D 对同一贴图二次释放
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh.isMesh && !(obj instanceof THREE.Sprite) && !(obj instanceof THREE.Points)) return
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : []
      for (const mat of mats) {
        if (!mat) continue
        for (const key of Object.keys(mat) as (keyof THREE.Material)[]) {
          const v = mat[key]
          if (v instanceof THREE.Texture) {
            ;(mat as THREE.Material & Record<string, unknown>)[key as string] = null
          }
        }
      }
    })
    this.envMap?.dispose()
    this.pmrem?.dispose()
    this.geos.dispose()
    disposeObject3D(this.scene)
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
