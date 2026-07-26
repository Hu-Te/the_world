/**
 * 首页沉浸场景：固定悬浮分类 · 环视 + 点击钻入工具展
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
import { buildTools, type ToolsBuildResult, type ToolNode } from './buildTools'
import { INK, CATEGORY_BASE_Y } from './theme'
import type { CategoryNode } from './types'
import type { ToolItem } from '~/utils/tools/catalog'

export interface HomeHeroManagerOptions {
  canvas: HTMLCanvasElement
  pixelRatioCap?: number
  /** 进入分类钻入态 */
  onDrillOpen?: (id: string) => void
  /** 退出钻入态 */
  onDrillClose?: () => void
  /** 点选工具节点 */
  onSelectTool?: (tool: ToolItem) => void
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
  private readonly scratchWorld = new THREE.Vector3()
  private readonly scratchScreen = new THREE.Vector3()
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
  private readonly onDrillOpen?: (id: string) => void
  private readonly onDrillClose?: () => void
  private readonly onSelectTool?: (tool: ToolItem) => void
  private readonly floorRingBaseOpacity = [0.48, 0.22, 0.32]

  private mode: 'browse' | 'drill' = 'browse'
  private drillCategoryId: string | null = null
  private toolsBuilt: ToolsBuildResult | null = null
  private toolReveal = 0
  private pulseToolId: string | null = null
  private pulseUntil = 0
  private hoveredToolId: string | null = null
  private orbitSpin = 0
  private cameraTweening = false
  private readonly browsePolar = 1.315
  private readonly browseRadius = 12.6
  private readonly drillPolar = 1.18
  private readonly drillRadius = 6.1
  private readonly browseTarget = new THREE.Vector3(0, CATEGORY_BASE_Y * 0.72, 0)
  private readonly viewTarget = new THREE.Vector3(0, CATEGORY_BASE_Y * 0.72, 0)
  private viewRadius = 12.6
  private viewPolar = 1.315
  private viewAzimuth = 0
  private readonly desiredTarget = new THREE.Vector3(0, CATEGORY_BASE_Y * 0.72, 0)
  private desiredRadius = 12.6
  private desiredPolar = 1.315
  private desiredAzimuth = 0
  private readonly camOffset = new THREE.Vector3()
  private drillHost: CategoryNode | null = null
  private readonly lookScratch = new THREE.Vector3()

  private focusedId: string | null = null
  private hoveredId: string | null = null
  private interacting = false
  private pointerDown: {
    x: number
    y: number
    hitCategoryId: string | null
    hitToolId: string | null
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
      onDrillOpen,
      onDrillClose,
      onSelectTool,
    } = options
    this.onDrillOpen = onDrillOpen
    this.onDrillClose = onDrillClose
    this.onSelectTool = onSelectTool

    this.scene = new THREE.Scene()
    // 背景由 buildBackdrop 设置星空穹顶；此处先铺底色防止白闪
    this.scene.background = new THREE.Color(INK)

    this.width = Math.max(canvas.clientWidth || 1, 1)
    this.height = Math.max(canvas.clientHeight || 1, 1)

    this.camera = new THREE.PerspectiveCamera(36, this.width / this.height, 0.1, 80)
    // 固定仰角：只能水平环绕，不可上下拖拽；半径拉远保留当前视角感
    const orbitTargetY = CATEGORY_BASE_Y * 0.72
    this.viewPolar = this.browsePolar
    this.viewRadius = this.browseRadius
    this.desiredPolar = this.browsePolar
    this.desiredRadius = this.browseRadius
    this.viewTarget.copy(this.browseTarget)
    this.desiredTarget.copy(this.browseTarget)
    this.viewAzimuth = 0
    this.desiredAzimuth = 0
    this.camera.position.set(
      0,
      orbitTargetY + this.browseRadius * Math.cos(this.browsePolar),
      this.browseRadius * Math.sin(this.browsePolar),
    )

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // 桌面开抗锯齿；手机关以省 GPU（DPR 已提到 2，边缘仍可接受）
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
    this.controls.minPolarAngle = this.browsePolar
    this.controls.maxPolarAngle = this.browsePolar
    this.controls.minDistance = this.browseRadius
    this.controls.maxDistance = this.browseRadius
    this.controls.target.copy(this.browseTarget)
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

    // 先挂轻量粒子并开渲，分类雕塑下一帧再补（缩短黑屏等待）
    this.particles = buildParticles(Math.min(28, this.quality.particleCount))
    this.scene.add(this.particles)

    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerleave', this.onPointerLeave)
    canvas.addEventListener('pointerdown', this.onPointerDown, { capture: true })
    canvas.addEventListener('pointerup', this.onPointerUp, { capture: true })
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('keydown', this.onKeydown)

    this.updateFacingFocus(true)
    this.tick()

    requestAnimationFrame(() => {
      if (this.disposed) return
      const built = buildCategories(this.scene, this.geos, this.quality, pushTex)
      this.categories.push(...built.nodes)
      this.disposeCategoryOwned = built.disposeOwned
      for (const c of this.categories) this.pickMeshes.push(c.pick)
      this.needsRender = true
      this.updateFacingFocus(true)
    })
  }

  get isDrilling(): boolean {
    return this.mode === 'drill'
  }

  get activeCategoryId(): string | null {
    return this.drillCategoryId
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

  private applyCameraRig(force = false): void {
    const k = force ? 1 : 0.11
    this.viewTarget.lerp(this.desiredTarget, k)
    this.viewRadius += (this.desiredRadius - this.viewRadius) * k
    this.viewPolar += (this.desiredPolar - this.viewPolar) * k

    let daz = this.desiredAzimuth - this.viewAzimuth
    while (daz > Math.PI) daz -= Math.PI * 2
    while (daz < -Math.PI) daz += Math.PI * 2
    this.viewAzimuth += daz * k

    this.controls.target.copy(this.viewTarget)
    this.controls.minPolarAngle = this.viewPolar
    this.controls.maxPolarAngle = this.viewPolar
    this.controls.minDistance = this.viewRadius
    this.controls.maxDistance = this.viewRadius

    const sinP = Math.sin(this.viewPolar)
    this.camOffset.set(
      Math.sin(this.viewAzimuth) * this.viewRadius * sinP,
      this.viewRadius * Math.cos(this.viewPolar),
      Math.cos(this.viewAzimuth) * this.viewRadius * sinP,
    )
    this.camera.position.copy(this.viewTarget).add(this.camOffset)
    this.controls.update()
  }

  private syncViewFromCamera(): void {
    this.viewTarget.copy(this.controls.target)
    this.camOffset.copy(this.camera.position).sub(this.controls.target)
    const len = this.camOffset.length()
    if (len < 1e-4) return
    this.viewRadius = len
    this.viewAzimuth = Math.atan2(this.camOffset.x, this.camOffset.z)
    this.viewPolar = Math.acos(
      THREE.MathUtils.clamp(this.camOffset.y / len, -1, 1),
    )
  }

  private isViewSettled(): boolean {
    const td = this.viewTarget.distanceTo(this.desiredTarget)
    const rd = Math.abs(this.viewRadius - this.desiredRadius)
    let ad = this.desiredAzimuth - this.viewAzimuth
    while (ad > Math.PI) ad -= Math.PI * 2
    while (ad < -Math.PI) ad += Math.PI * 2
    return td < 0.04 && rd < 0.08 && Math.abs(ad) < 0.03
  }

  private updateCameraTransition(): void {
    if (this.cameraTweening) {
      this.applyCameraRig(false)
      if (this.isViewSettled()) {
        this.applyCameraRig(true)
        this.cameraTweening = false
        // 结算后把 desired 锁到当前，避免回弹；仅保持模式半径/极角
        this.desiredAzimuth = this.viewAzimuth
        this.desiredRadius = this.mode === 'drill' ? this.drillRadius : this.browseRadius
        this.desiredPolar = this.mode === 'drill' ? this.drillPolar : this.browsePolar
        this.controls.minDistance = this.desiredRadius
        this.controls.maxDistance = this.desiredRadius
        this.controls.minPolarAngle = this.desiredPolar
        this.controls.maxPolarAngle = this.desiredPolar
      }
      this.needsRender = true
      return
    }

    this.syncViewFromCamera()
    this.desiredAzimuth = this.viewAzimuth
    // 锁半径与仰角，允许水平环视（工具箱或展厅中心）
    this.viewRadius = this.desiredRadius
    this.viewPolar = this.desiredPolar
    this.controls.minDistance = this.desiredRadius
    this.controls.maxDistance = this.desiredRadius
    this.controls.minPolarAngle = this.desiredPolar
    this.controls.maxPolarAngle = this.desiredPolar
    this.controls.target.copy(this.desiredTarget)
  }

  private setBrowseView(fromAngle?: number): void {
    this.desiredTarget.copy(this.browseTarget)
    this.desiredRadius = this.browseRadius
    this.desiredPolar = this.browsePolar
    this.desiredAzimuth =
      fromAngle !== undefined
        ? fromAngle
        : Math.atan2(this.camera.position.x - this.controls.target.x, this.camera.position.z - this.controls.target.z)
    this.cameraTweening = true
  }

  private setDrillView(node: CategoryNode): void {
    const angle = (node.root.userData.angle as number) ?? 0
    this.desiredTarget.set(
      node.root.position.x,
      node.root.position.y + 0.2,
      node.root.position.z,
    )
    this.desiredRadius = this.drillRadius
    this.desiredPolar = this.drillPolar
    this.desiredAzimuth = angle
    this.cameraTweening = true
  }

  private clearTools(): void {
    if (!this.toolsBuilt) return
    this.toolsBuilt.root.parent?.remove(this.toolsBuilt.root)
    this.toolsBuilt.dispose()
    this.toolsBuilt = null
    this.toolReveal = 0
    this.hoveredToolId = null
    this.pulseToolId = null
    this.orbitSpin = 0
  }

  /** 进入分类：镜头切到工具箱中心，工具环绕悬浮 */
  openCategory(id: string): void {
    const node = this.categories.find((c) => c.id === id)
    if (!node) return

    this.clearTools()

    const built = buildTools({
      categoryId: id,
      geos: this.geos,
      quality: this.quality,
    })
    if (!built) return

    this.toolsBuilt = built
    node.root.add(built.root)
    this.drillHost = node
    this.mode = 'drill'
    this.drillCategoryId = id
    this.focusedId = id
    this.toolReveal = 0
    this.orbitSpin = 0
    this.setDrillView(node)
    this.onDrillOpen?.(id)
    this.needsRender = true
  }

  /** 退出钻入态 */
  closeDrill(): void {
    if (this.mode !== 'drill') return
    const angle = this.drillHost
      ? ((this.drillHost.root.userData.angle as number) ?? this.viewAzimuth)
      : this.viewAzimuth
    this.clearTools()
    this.mode = 'browse'
    this.drillCategoryId = null
    this.drillHost = null
    this.setBrowseView(angle)
    this.onDrillClose?.()
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

  /** 射线优先；失败则用屏幕邻近兜底（半径约 56px） */
  private hitToolId(): string | null {
    if (!this.toolsBuilt) return null
    this.raycaster.setFromCamera(this.pointerNdc, this.camera)
    const hits = this.raycaster.intersectObjects(this.toolsBuilt.pickMeshes, false)
    const rayId = hits[0]?.object.userData.toolId as string | undefined
    if (rayId) return rayId

    const w = Math.max(this.width, 1)
    const h = Math.max(this.height, 1)
    const px = (this.pointerNdc.x * 0.5 + 0.5) * w
    const py = (-this.pointerNdc.y * 0.5 + 0.5) * h
    const maxDistSq = 42 * 42
    let bestId: string | null = null
    let bestDist = maxDistSq

    for (const node of this.toolsBuilt.nodes) {
      node.pick.getWorldPosition(this.scratchWorld)
      this.scratchScreen.copy(this.scratchWorld).project(this.camera)
      if (this.scratchScreen.z > 1) continue
      const sx = (this.scratchScreen.x * 0.5 + 0.5) * w
      const sy = (-this.scratchScreen.y * 0.5 + 0.5) * h
      const d = (sx - px) * (sx - px) + (sy - py) * (sy - py)
      if (d < bestDist) {
        bestDist = d
        bestId = node.id
      }
    }
    return bestId
  }

  /** drill 态下：是否点到活跃分类底座（不算误关） */
  private hitActiveCategory(): boolean {
    if (this.mode !== 'drill' || !this.drillCategoryId) return false
    return this.hitCategoryId() === this.drillCategoryId
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
    if (this.mode === 'drill') return
    const id = this.getFacingCategoryId()
    if (id === this.focusedId && !force) return
    this.focusedId = id
    this.needsRender = true
  }

  private updateCursor(): void {
    const el = this.renderer.domElement
    if (this.mode === 'drill') {
      el.style.cursor = this.hoveredToolId
        ? 'pointer'
        : this.hoveredId
          ? 'pointer'
          : this.interacting || this.pointerDown
            ? 'grabbing'
            : 'grab'
      return
    }
    el.style.cursor = this.hoveredId
      ? 'pointer'
      : this.interacting || this.pointerDown
        ? 'grabbing'
        : 'grab'
  }

  private selectToolNode(node: ToolNode): void {
    this.onSelectTool?.(node.tool)
    const href = node.tool.href
    if (!href) {
      this.pulseToolId = node.id
      this.pulseUntil = performance.now() + 520
      this.needsRender = true
      return
    }
    if (href.startsWith('/')) {
      // 站内路由由页面侧 navigateTo 处理
      return
    }
    window.open(href, '_blank', 'noopener,noreferrer')
  }

  private readonly onKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.mode === 'drill') {
      this.closeDrill()
    }
  }

  private readonly onPointerMove = (e: PointerEvent) => {
    this.syncPointerNdc(e)
    if (this.pointerDown) {
      const dx = e.clientX - this.pointerDown.x
      const dy = e.clientY - this.pointerDown.y
      if (dx * dx + dy * dy > 16) {
        this.pointerDown.didDrag = true
        this.renderer.domElement.style.cursor = 'grabbing'
      }
    }

    const toolHit = this.mode === 'drill' ? this.hitToolId() : null
    const catHit = this.hitCategoryId()

    if (toolHit !== this.hoveredToolId) {
      this.hoveredToolId = toolHit
      this.needsRender = true
    }
    if (catHit !== this.hoveredId) {
      this.hoveredId = catHit
      this.needsRender = true
    } else if (this.pointerDown) {
      this.needsRender = true
    }
    this.updateCursor()
  }

  private readonly onPointerLeave = () => {
    this.pointerNdc.set(-2, -2)
    this.pointerDown = null
    this.controls.enableRotate = true
    this.hoveredId = null
    this.hoveredToolId = null
    this.renderer.domElement.style.cursor = 'grab'
    this.needsRender = true
  }

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    if (this.cameraTweening) return
    this.syncPointerNdc(e)
    const hitToolId = this.mode === 'drill' ? this.hitToolId() : null
    const hitCategoryId = this.hitCategoryId()
    this.pointerDown = {
      x: e.clientX,
      y: e.clientY,
      hitCategoryId,
      hitToolId,
      didDrag: false,
    }
    // 始终允许拖拽环视；单击在 pointerup 且未拖动时判定
    this.controls.enableRotate = true
    this.updateCursor()
  }

  private readonly onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0) return
    const down = this.pointerDown
    this.pointerDown = null
    this.controls.enableRotate = true

    if (down && !down.didDrag) {
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      // 略收紧：拖动超过 ~7px 就算环视，不算点击
      if (dx * dx + dy * dy <= 49) {
        this.syncPointerNdc(e)
        if (this.mode === 'drill') {
          const toolId = this.hitToolId() ?? down.hitToolId
          if (toolId && this.toolsBuilt) {
            const node = this.toolsBuilt.nodes.find((n) => n.id === toolId)
            if (node) this.selectToolNode(node)
          } else {
            const catId = this.hitCategoryId() ?? down.hitCategoryId
            if (catId && catId !== this.drillCategoryId) {
              this.openCategory(catId)
            } else if (!catId && !this.hitActiveCategory()) {
              this.closeDrill()
            }
          }
        } else {
          const id = this.hitCategoryId() ?? down.hitCategoryId
          if (id) this.openCategory(id)
        }
      }
    }

    this.updateCursor()
    this.needsRender = true
  }

  private updateMotion(t: number): void {
    const drilling = this.mode === 'drill'
    const drillId = this.drillCategoryId

    for (const c of this.categories) {
      const hovering = !drilling && c.id === this.hoveredId
      const facing = c.id === this.focusedId
      const active = drilling && c.id === drillId
      const faded = drilling && c.id !== drillId

      const target = faded
        ? 0.42
        : hovering
          ? 1.045
          : active
            ? 1.06
            : facing
              ? 1.0
              : 0.965
      const s = c.root.scale.x + (target - c.root.scale.x) * 0.14
      c.root.scale.setScalar(s)
      c.root.position.y = c.baseY
      // 淡出分类不参与点选，避免挡工具
      c.pick.visible = !faded

      const core = c.accentMats[3]
      if (core && 'emissiveIntensity' in core) {
        core.emissiveIntensity = faded
          ? 0.12
          : hovering
            ? 1.15
            : active
              ? 1.2
              : facing
                ? 0.85
                : 0.55
      }
      ;(c.glow.material as THREE.MeshBasicMaterial).opacity = faded
        ? 0.02
        : hovering
          ? 0.26
          : active
            ? 0.28
            : facing
              ? 0.16
              : 0.1

      c.emblem.rotation.y = hovering || active ? t * 0.32 : t * 0.07
    }

    if (this.toolsBuilt) {
      this.toolReveal = Math.min(1, this.toolReveal + 0.07)
      const pauseSpin = Boolean(this.hoveredToolId || this.pulseToolId)
      if (!pauseSpin) this.orbitSpin += 0.0065
      this.toolsBuilt.root.rotation.y = this.orbitSpin

      const now = performance.now()
      for (const node of this.toolsBuilt.nodes) {
        const hovering = node.id === this.hoveredToolId
        const a = node.orbitAngle
        const breathe = 1 + Math.sin(t * 1.1 + node.phase) * 0.03
        const r = node.orbitRadius * (0.92 + 0.08 * this.toolReveal) * breathe
        const y =
          node.height +
          Math.sin(t * 1.35 + node.phase) * 0.06 +
          (1 - this.toolReveal) * 0.35

        node.root.position.set(Math.sin(a) * r, y, Math.cos(a) * r)

        // lookAt 需要世界坐标：朝向环外侧
        this.lookScratch.set(Math.sin(a) * (r + 2), y, Math.cos(a) * (r + 2))
        this.toolsBuilt.root.localToWorld(this.lookScratch)
        node.root.lookAt(this.lookScratch)

        let target = node.targetScale * (0.2 + 0.8 * this.toolReveal)
        if (hovering) target *= 1.12
        if (this.pulseToolId === node.id && now < this.pulseUntil) {
          const p = 1 - (this.pulseUntil - now) / 520
          target *= 1 + Math.sin(p * Math.PI) * 0.16
        }
        const cur = node.visual.scale.x
        node.visual.scale.setScalar(cur + (target - cur) * 0.18)
        node.emblem.rotation.y = hovering ? t * 0.65 : t * 0.2
      }
      if (this.pulseToolId && now >= this.pulseUntil) this.pulseToolId = null
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
    const busy =
      this.interacting ||
      this.hoveredId !== null ||
      this.hoveredToolId !== null ||
      this.cameraTweening ||
      Boolean(this.toolsBuilt && this.toolReveal < 1)
    if (!busy && !this.needsRender && now - this.lastFrameAt < IDLE_FRAME_INTERVAL_MS) {
      return
    }

    const t = this.clock.getElapsedTime()
    this.controls.update()
    this.updateCameraTransition()
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
    window.removeEventListener('keydown', this.onKeydown)
    const el = this.renderer.domElement
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerleave', this.onPointerLeave)
    el.removeEventListener('pointerdown', this.onPointerDown, { capture: true } as EventListenerOptions)
    el.removeEventListener('pointerup', this.onPointerUp, { capture: true } as EventListenerOptions)
    this.controls.dispose()
    el.style.cursor = ''

    this.clearTools()
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
