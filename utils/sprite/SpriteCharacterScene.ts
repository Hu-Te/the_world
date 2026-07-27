import * as THREE from 'three'
import { disposeObject3D } from '~/utils/web3d/dispose'

export type SpritePalette = 'tools' | 'platform'

/**
 * 深空精灵 · 精致卡通星灵
 * 半透明星核壳 + 大眼 chibi + 柔光晕环 + 星尘，偏可爱与深空感。
 */
export class SpriteCharacterScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private root = new THREE.Group()
  private actor = new THREE.Group()
  private head = new THREE.Group()
  private face = new THREE.Group()
  private rings = new THREE.Group()
  private dust?: THREE.Points
  private lids: THREE.Mesh[] = []
  private ears = new THREE.Group()
  private limbs = new THREE.Group()
  private torsoExtras = new THREE.Group()
  private pulseMats: THREE.MeshStandardMaterial[] = []
  private shellMats: THREE.MeshPhysicalMaterial[] = []
  private accentMats: THREE.MeshStandardMaterial[] = []
  private anim = 0
  private disposed = false
  private hover = 0
  private targetHover = 0
  private blinkT = 0
  private nextBlink = 2.2
  private palette: SpritePalette = 'tools'
  private resizeObs?: ResizeObserver
  private keyLight: THREE.PointLight
  private rimLight: THREE.DirectionalLight
  private mouthHappy!: THREE.Mesh
  private mouthSad!: THREE.Mesh
  private browL!: THREE.Mesh
  private browR!: THREE.Mesh
  private tearL!: THREE.Mesh
  private tearR!: THREE.Mesh
  private mood: 'sad' | 'happy' = 'sad'
  private eyeGroups: THREE.Group[] = []

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    Object.assign(this.renderer.domElement.style, {
      display: 'block',
      width: '100%',
      height: '100%',
    })
    this.host.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 40)
    this.camera.position.set(0, 0.12, 3.55)
    this.camera.lookAt(0, 0.02, 0)

    this.scene.add(new THREE.HemisphereLight(0xdbeafe, 0x0f172a, 0.85))
    const sun = new THREE.DirectionalLight(0xf8fafc, 0.95)
    sun.position.set(2.4, 3.2, 2.2)
    this.scene.add(sun)
    this.rimLight = new THREE.DirectionalLight(0x67e8f9, 0.7)
    this.rimLight.position.set(-2.6, 1.4, -2)
    this.scene.add(this.rimLight)
    this.keyLight = new THREE.PointLight(0x5eead4, 1.6, 10, 2)
    this.keyLight.position.set(0.15, 0.45, 1.5)
    this.scene.add(this.keyLight)

    this.build()
    this.root.add(this.actor)
    this.scene.add(this.root)
    this.applyPalette('tools')
    this.setMood('sad')

    this.resize()
    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(this.host)
    this.tick()
  }

  setPalette(mode: SpritePalette) {
    if (this.palette !== mode) this.applyPalette(mode)
    this.setMood(mode === 'platform' ? 'happy' : 'sad')
  }

  setHover(on: boolean) {
    this.targetHover = on ? 1 : 0
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.anim)
    this.resizeObs?.disconnect()
    disposeObject3D(this.root)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
  }

  private shell(color: number, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) {
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.18,
      sheen: 1,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color(0xffffff),
      transmission: 0.22,
      thickness: 0.55,
      ior: 1.35,
      transparent: true,
      opacity: 0.92,
      ...opts,
    })
    this.shellMats.push(mat)
    return mat
  }

  private glow(color: number, intensity = 1.2) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.45,
      metalness: 0.1,
      transparent: true,
      opacity: 0.95,
    })
    this.pulseMats.push(mat)
    return mat
  }

  private accent(color: number) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.15,
    })
    this.accentMats.push(mat)
    return mat
  }

  /** 柔和水滴身体轮廓 */
  private latheBody(): THREE.BufferGeometry {
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24
      const y = -0.55 + t * 0.95
      const r =
        0.08 +
        0.26 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 1.15 * (1 - t * 0.18)
      pts.push(new THREE.Vector2(r, y))
    }
    return new THREE.LatheGeometry(pts, 48)
  }

  private buildEye(x: number): THREE.Group {
    const g = new THREE.Group()
    g.position.set(x, 0.05, 0.36)

    const white = new THREE.Mesh(
      new THREE.SphereGeometry(0.118, 28, 20),
      new THREE.MeshPhysicalMaterial({
        color: 0xfffbff,
        roughness: 0.22,
        clearcoat: 0.8,
        clearcoatRoughness: 0.15,
      }),
    )
    white.scale.set(1, 1.18, 0.62)
    g.add(white)

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.072, 24, 18), this.accent(0x0284c7))
    iris.position.z = 0.045
    iris.scale.set(1, 1.08, 0.55)
    g.add(iris)

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.048, 0.008, 8, 32),
      this.glow(0x67e8f9, 0.8),
    )
    ring.position.z = 0.07
    ring.scale.set(1, 1.1, 1)
    g.add(ring)

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.35 }),
    )
    pupil.position.set(0.008, -0.006, 0.085)
    g.add(pupil)

    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    shine.position.set(-0.035, 0.04, 0.1)
    g.add(shine)
    const shine2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    shine2.position.set(0.03, -0.02, 0.1)
    g.add(shine2)

    const lid = new THREE.Mesh(
      new THREE.SphereGeometry(0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
      this.shell(0x7dd3fc, { transmission: 0.05, opacity: 0.98, roughness: 0.4 }),
    )
    lid.rotation.x = Math.PI
    lid.position.set(0, 0.02, 0)
    lid.scale.set(1.02, 0.18, 0.72)
    lid.visible = false
    g.add(lid)
    this.lids.push(lid)
    return g
  }


  /** 圆润精灵耳：外廓 + 内耳光窝 + 耳尖微光 */
  private buildEar(side: -1 | 1): THREE.Group {
    const g = new THREE.Group()

    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 20; i++) {
      const u = i / 20
      const y = u * 0.4
      const r = 0.014 + 0.1 * Math.sin(Math.PI * u) ** 0.9 * (1 - u * 0.32)
      pts.push(new THREE.Vector2(Math.max(0.012, r), y))
    }
    const outer = new THREE.Mesh(
      new THREE.LatheGeometry(pts, 32),
      this.shell(0x7dd3fc, {
        transmission: 0.28,
        opacity: 0.92,
        roughness: 0.3,
        clearcoat: 0.95,
      }),
    )
    outer.scale.set(1.15, 1, 0.62)
    outer.rotation.y = side * 0.35
    g.add(outer)

    const inner = new THREE.Mesh(
      new THREE.SphereGeometry(0.065, 20, 14),
      this.shell(0xfbcfe8, {
        transmission: 0.12,
        opacity: 0.62,
        roughness: 0.5,
        emissive: new THREE.Color(0xf9a8d4),
        emissiveIntensity: 0.3,
      }),
    )
    inner.scale.set(0.9, 1.15, 0.4)
    inner.position.set(side * 0.025, 0.15, 0.04)
    g.add(inner)

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 12), this.glow(0xa5f3fc, 1.15))
    tip.position.set(0, 0.39, 0)
    tip.scale.set(1.05, 0.8, 0.7)
    g.add(tip)

    g.position.set(side * 0.33, 0.18, -0.04)
    g.rotation.set(0.22, side * 0.85, side * -0.55)
    return g
  }



  /** 柔软垂臂：曲线肢体 + 连指手套，避免机械僵直 */
  private buildArm(side: -1 | 1): THREE.Group {
    const root = new THREE.Group()
    const skin = this.shell(0x7dd3fc, { transmission: 0.14, opacity: 0.96, roughness: 0.36 })
    const soft = this.shell(0xbae6fd, { transmission: 0.12, opacity: 0.96, roughness: 0.34 })

    // 肩窝软球
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 14), soft)
    root.add(shoulder)

    // 自然下垂的弯臂曲线（前倾、贴身）
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.06, -0.1, 0.04),
      new THREE.Vector3(side * 0.04, -0.22, 0.1),
      new THREE.Vector3(side * 0.02, -0.32, 0.12),
    )
    const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.038, 10, false), skin)
    root.add(arm)

    // 肘部软鼓（无金属环）
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 12), soft)
    elbow.position.copy(curve.getPoint(0.55))
    root.add(elbow)

    // 连指小手
    const hand = new THREE.Group()
    hand.position.copy(curve.getPoint(1))
    const mitt = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 14), soft)
    mitt.scale.set(1.1, 0.9, 1.05)
    hand.add(mitt)
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), this.glow(0xfbcfe8, 0.55))
    pad.position.set(0, -0.01, 0.03)
    pad.scale.set(1.4, 1, 0.7)
    hand.add(pad)
    // 三枚圆润指尖（不分离僵硬手指）
    for (let i = -1; i <= 1; i++) {
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), soft)
      tip.position.set(i * 0.022, -0.04, 0.015)
      hand.add(tip)
    }
    root.add(hand)

    // 贴身下垂，略向前抱
    root.position.set(side * 0.3, -0.06, 0.08)
    root.rotation.set(0.35, side * -0.15, side * 0.28)
    root.userData.side = side
    root.userData.hand = hand
    return root
  }

  /** 分层身体：外壳 + 腹宝石 + 短肢 + 肩披光带 + 脚垫 */
  private buildTorso(): THREE.Group {
    const torso = new THREE.Group()

    const shell = new THREE.Mesh(
      this.latheBody(),
      this.shell(0x7dd3fc, { roughness: 0.4, transmission: 0.2 }),
    )
    shell.position.y = -0.02
    torso.add(shell)

    // 肩领光环
    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.028, 12, 48),
      this.glow(0x67e8f9, 0.85),
    )
    collar.position.y = 0.08
    collar.rotation.x = Math.PI / 2
    collar.scale.set(1, 0.85, 1)
    torso.add(collar)

    // 胸前星纹带
    const sash = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.016, 10, 40, Math.PI * 1.2),
      this.glow(0xa5f3fc, 0.7),
    )
    sash.position.set(0, -0.12, 0.12)
    sash.rotation.set(1.1, 0, 0.15)
    torso.add(sash)

    // 腹宝石底座
    const gemSeat = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 24, 18),
      this.shell(0xecfeff, { transmission: 0.35, opacity: 0.75, roughness: 0.25 }),
    )
    gemSeat.scale.set(1.1, 0.95, 0.7)
    gemSeat.position.set(0, -0.2, 0.14)
    torso.add(gemSeat)

    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), this.glow(0x5eead4, 1.9))
    gem.position.set(0, -0.2, 0.2)
    gem.rotation.y = Math.PI / 4
    torso.add(gem)

    // 内星核（透过壳可见）
    const starCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.09, 1),
      this.glow(0x67e8f9, 1.4),
    )
    starCore.position.set(0, -0.22, 0)
    torso.add(starCore)

    // 腰侧能量节
    for (const side of [-1, 1] as const) {
      const node = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 14, 12),
        this.glow(0x99f6e4, 1.1),
      )
      node.position.set(side * 0.26, -0.28, 0.02)
      torso.add(node)
      const vent = new THREE.Mesh(
        new THREE.TorusGeometry(0.055, 0.008, 8, 24),
        this.accent(0x0284c7),
      )
      vent.position.copy(node.position)
      vent.rotation.y = Math.PI / 2
      torso.add(vent)
    }

    // 精细手臂
    this.limbs.clear()
    this.limbs.add(this.buildArm(-1), this.buildArm(1))
    torso.add(this.limbs)

    // 脚垫
    for (const side of [-1, 1] as const) {
      const foot = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 12),
        this.shell(0x67e8f9, { transmission: 0.2, opacity: 0.9, roughness: 0.35 }),
      )
      foot.scale.set(1.15, 0.55, 1.3)
      foot.position.set(side * 0.1, -0.55, 0.04)
      torso.add(foot)
    }

    // 肩上小披风光片
    for (const side of [-1, 1] as const) {
      const cape = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
        this.shell(0xa5f3fc, {
          transmission: 0.5,
          opacity: 0.45,
          roughness: 0.2,
          emissive: new THREE.Color(0x22d3ee),
          emissiveIntensity: 0.2,
          side: THREE.DoubleSide,
        }),
      )
      cape.position.set(side * 0.22, 0.02, -0.08)
      cape.rotation.set(0.6, side * 0.4, side * 0.5)
      cape.scale.set(0.9, 1.1, 0.7)
      torso.add(cape)
    }

    // 胸前星点装饰
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        this.glow(0xffffff, 1.2),
      )
      const a = -0.6 + i * 0.24
      d.position.set(Math.sin(a) * 0.12, -0.08 - i * 0.03, 0.22)
      torso.add(d)
    }

    return torso
  }

  private build() {
    // —— 身体：分层星灵躯干 ——
    this.actor.add(this.buildTorso())

    // —— 头 ——
    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.4, 48, 36),
      this.shell(0xbae6fd, { roughness: 0.34, transmission: 0.16 }),
    )
    skull.scale.set(1.04, 0.98, 0.96)
    this.head.add(skull)

    // 额头柔光
    const browGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 20, 14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, depthWrite: false }),
    )
    browGlow.position.set(0, 0.18, 0.3)
    this.head.add(browGlow)

    // 腮红
    const blushMat = new THREE.MeshStandardMaterial({
      color: 0xf9a8d4,
      transparent: true,
      opacity: 0.42,
      roughness: 0.8,
      depthWrite: false,
    })
    const blushL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), blushMat)
    blushL.position.set(-0.24, -0.06, 0.3)
    blushL.scale.set(1.2, 0.7, 0.5)
    const blushR = blushL.clone()
    blushR.position.x = 0.24
    this.head.add(blushL, blushR)

    // 眼睛
    const eyeL = this.buildEye(-0.14)
    const eyeR = this.buildEye(0.14)
    this.eyeGroups = [eyeL, eyeR]
    this.face.add(eyeL, eyeR)

    // 眉毛（忧伤/开心共用，靠旋转区分）
    const browMat = new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.5 })
    this.browL = new THREE.Mesh(new THREE.CapsuleGeometry(0.01, 0.07, 4, 8), browMat)
    this.browL.position.set(-0.15, 0.2, 0.36)
    this.browR = this.browL.clone()
    this.browR.position.x = 0.15
    this.face.add(this.browL, this.browR)

    // 开心嘴 ∪ / 忧伤嘴 ∩（用曲线明确嘴角方向）
    const lipMat = new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.45 })
    const happyCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.055, -0.11, 0.385),
      new THREE.Vector3(0, -0.155, 0.4),
      new THREE.Vector3(0.055, -0.11, 0.385),
    )
    const sadCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.055, -0.155, 0.385),
      new THREE.Vector3(0, -0.105, 0.4),
      new THREE.Vector3(0.055, -0.155, 0.385),
    )
    this.mouthHappy = new THREE.Mesh(new THREE.TubeGeometry(happyCurve, 16, 0.01, 8, false), lipMat)
    this.mouthSad = new THREE.Mesh(new THREE.TubeGeometry(sadCurve, 16, 0.01, 8, false), lipMat.clone())
    this.face.add(this.mouthHappy, this.mouthSad)

    // 泪珠（仅忧伤）
    const tearMat = this.glow(0x7dd3fc, 0.9)
    this.tearL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), tearMat)
    this.tearL.position.set(-0.22, -0.06, 0.34)
    this.tearL.scale.set(0.8, 1.2, 0.7)
    this.tearR = this.tearL.clone()
    this.tearR.position.x = 0.22
    this.face.add(this.tearL, this.tearR)

    // 小鼻点
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.5 }),
    )
    nose.position.set(0, -0.02, 0.4)
    this.face.add(nose)

    this.head.add(this.face)
    this.head.position.y = 0.28
    this.actor.add(this.head)

    // —— 耳朵：圆润立体精灵耳 ——
    this.ears = new THREE.Group()
    this.ears.add(this.buildEar(-1), this.buildEar(1))
    this.head.add(this.ears)

    // —— 天线：细软光丝 ——
    const ant = new THREE.Group()
    const stemCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.08, 0.22, -0.04),
      new THREE.Vector3(0.02, 0.42, 0.02),
    )
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(stemCurve, 20, 0.012, 8, false),
      this.shell(0x99f6e4, { transmission: 0.1, opacity: 0.95, roughness: 0.3 }),
    )
    ant.add(stem)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 16), this.glow(0x5eead4, 2))
    tip.position.copy(stemCurve.getPoint(1))
    ant.add(tip)
    const tipAura = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 16, 12),
      new THREE.MeshBasicMaterial({
        color: 0x5eead4,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    )
    tipAura.position.copy(tip.position)
    ant.add(tipAura)
    ant.position.set(0, 0.36, -0.02)
    this.head.add(ant)

    // —— 深空晕环 ——
    const ringA = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.012, 10, 64),
      this.glow(0x67e8f9, 0.9),
    )
    ringA.rotation.x = Math.PI * 0.42
    ringA.rotation.z = 0.25
    const ringB = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.008, 8, 64),
      this.glow(0xa5f3fc, 0.7),
    )
    ringB.rotation.x = Math.PI * 0.55
    ringB.rotation.y = 0.4
    this.rings.add(ringA, ringB)
    this.rings.position.y = -0.08
    this.actor.add(this.rings)

    // 悬浮小星
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.028 + (i % 2) * 0.01, 0),
        this.glow(0xecfeff, 1.1),
      )
      const a = (i / 5) * Math.PI * 2
      s.position.set(Math.cos(a) * 0.85, Math.sin(a * 2) * 0.25, Math.sin(a) * 0.35)
      s.userData.phase = a
      this.rings.add(s)
    }

    // 星尘
    const n = 64
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 0.4 + Math.random() * 1.1
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = (Math.random() - 0.4) * 1.6
      pos[i * 3 + 2] = Math.sin(a) * r * 0.7
    }
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.dust = new THREE.Points(
      pg,
      new THREE.PointsMaterial({
        color: 0xbae6fd,
        size: 0.028,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    )
    this.root.add(this.dust)
  }

  /** 未登录忧伤 / 登录开心 */
  private setMood(mood: 'sad' | 'happy') {
    this.mood = mood
    const happy = mood === 'happy'
    this.mouthHappy.visible = happy
    this.mouthSad.visible = !happy
    this.tearL.visible = !happy
    this.tearR.visible = !happy
    // 眉：开心上扬，忧伤八字
    this.browL.rotation.z = happy ? 0.25 : -0.45
    this.browR.rotation.z = happy ? -0.25 : 0.45
    this.browL.position.y = happy ? 0.21 : 0.18
    this.browR.position.y = happy ? 0.21 : 0.18
    // 眼睛略下垂 / 提神
    for (const eye of this.eyeGroups) {
      eye.position.y = happy ? 0.05 : 0.02
      eye.rotation.z = 0
      eye.scale.y = happy ? 1 : 0.92
    }
    // 忧伤时手臂更垂，开心略抬
    for (const arm of this.limbs.children) {
      const side = (arm.userData.side as number) || 1
      arm.rotation.x = happy ? 0.25 : 0.45
      arm.rotation.z = side * (happy ? 0.22 : 0.32)
    }
  }

  private applyPalette(mode: SpritePalette) {
    this.palette = mode
    // 统一深空青辉：访客略冷蓝，系统略暖青（不再用紫色分轨）
    const live = mode === 'platform'
    const shell = live ? 0x67e8f9 : 0x7dd3fc
    const soft = live ? 0xecfeff : 0xbae6fd
    const accent = live ? 0x2dd4bf : 0x5eead4
    const iris = live ? 0x0891b2 : 0x0284c7
    this.keyLight.color.setHex(accent)
    this.rimLight.color.setHex(accent)

    for (const m of this.shellMats) {
      m.color.setHex(shell)
      m.sheenColor.setHex(soft)
      if (m.emissive) m.emissive.setHex(accent)
    }
    // 头壳更浅一点：第二个 shell 是头
    if (this.shellMats[1]) this.shellMats[1].color.setHex(soft)

    for (const m of this.pulseMats) {
      m.color.setHex(accent)
      m.emissive.setHex(accent)
    }
    for (const m of this.accentMats) {
      m.color.setHex(iris)
      m.emissive.setHex(iris)
    }
    if (this.dust) {
      ;(this.dust.material as THREE.PointsMaterial).color.setHex(soft)
    }
    this.setMood(mode === 'platform' ? 'happy' : 'sad')
  }

  private tick = () => {
    if (this.disposed) return
    this.anim = requestAnimationFrame(this.tick)
    const t = performance.now() * 0.001
    this.hover += (this.targetHover - this.hover) * 0.14

    const bob = Math.sin(t * 1.9) * 0.04
    this.actor.position.y = bob + this.hover * 0.05
    this.actor.rotation.y = Math.sin(t * 1.15) * 0.12 + this.hover * 0.2
    this.actor.rotation.x = -0.06 + this.hover * -0.1
    this.head.rotation.z = Math.sin(t * 1.4) * 0.035
    this.head.rotation.y = Math.sin(t * 1.6) * 0.05
    this.ears.rotation.z = Math.sin(t * 2.1) * 0.03
    const happy = this.mood === 'happy'
    this.limbs.children.forEach((arm) => {
      const side = (arm.userData.side as number) || 1
      const baseX = happy ? 0.22 : 0.42
      const baseZ = happy ? 0.2 : 0.3
      arm.rotation.x = baseX + Math.sin(t * 1.8 + side) * 0.08 + this.hover * (happy ? -0.12 : 0.05)
      arm.rotation.z = side * (baseZ + Math.sin(t * 2.1) * 0.06)
      arm.rotation.y = Math.sin(t * 1.4 + side) * 0.05
      const hand = arm.userData.hand as THREE.Group | undefined
      if (hand) {
        hand.rotation.x = Math.sin(t * 2.4 + side) * 0.12
        hand.rotation.z = side * Math.sin(t * 1.7) * 0.08
      }
    })
    this.ears.children.forEach((ear, i) => {
      ear.rotation.z += Math.sin(t * 2.4 + i) * 0.0015
    })

    this.rings.rotation.y = t * 0.35
    this.rings.rotation.z = Math.sin(t * 0.7) * 0.08
    this.rings.children.forEach((c, i) => {
      if (c instanceof THREE.Mesh && c.geometry.type === 'OctahedronGeometry') {
        const ph = (c.userData.phase as number) || 0
        c.position.y = Math.sin(t * 2 + ph) * 0.2
        c.rotation.x = t + i
        c.rotation.y = t * 1.3
      }
    })

    this.blinkT += 1 / 60
    if (this.blinkT > this.nextBlink) {
      for (const l of this.lids) l.visible = true
      if (this.blinkT > this.nextBlink + 0.11) {
        for (const l of this.lids) l.visible = false
        this.blinkT = 0
        this.nextBlink = 1.6 + Math.random() * 3
      }
    }

    if (this.dust) {
      this.dust.rotation.y = t * 0.12
      const mat = this.dust.material as THREE.PointsMaterial
      mat.opacity = 0.45 + Math.sin(t * 1.8) * 0.2 + this.hover * 0.15
    }

    for (const m of this.pulseMats) {
      m.emissiveIntensity = 0.85 + Math.sin(t * 3.2) * 0.35 + this.hover * 0.45
    }

    this.renderer.render(this.scene, this.camera)
  }
}
