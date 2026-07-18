import * as THREE from 'three'
import type { AgingParty } from '~/utils/aging/api'
import { money, num } from '~/utils/aging/api'

export type AgingIslandSelect = (party: AgingParty | null) => void

const BUCKET_HEX: Record<string, number> = {
  WITHIN_ONE_YEAR: 0x38bdf8,
  ONE_TO_TWO_YEARS: 0x22d3ee,
  TWO_TO_THREE_YEARS: 0xfbbf24,
  OVER_THREE_YEARS: 0xf43f5e,
}

type PillarNode = {
  root: THREE.Group
  party: AgingParty
  coreMat: THREE.MeshStandardMaterial
  glowMat: THREE.MeshBasicMaterial
  ringMats: THREE.MeshBasicMaterial[]
  baseY: number
  pickMeshes: THREE.Object3D[]
}

/**
 * Tech “data island” for FIFO aging:
 * - pillar height = open balance
 * - hue / pulse = worst aging bucket
 * - floating billboard = counterparty code + amount
 */
export class AgingIslandScene {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private island = new THREE.Group()
  private decor = new THREE.Group()
  private pillars: PillarNode[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()
  private anim = 0
  private disposed = false
  private onSelect: AgingIslandSelect
  private resizeObs?: ResizeObserver
  private hovered: PillarNode | null = null
  private selectedCode = ''
  private particles?: THREE.Points

  constructor(
    private host: HTMLElement,
    onSelect: AgingIslandSelect,
  ) {
    this.onSelect = onSelect
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(0x020617, 0)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.host.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x020617, 0.028)

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120)
    this.camera.position.set(0, 11.5, 18)
    this.camera.lookAt(0, 2.2, 0)

    this.scene.add(new THREE.AmbientLight(0x94a3b8, 0.35))
    const key = new THREE.DirectionalLight(0xe0f2fe, 1.15)
    key.position.set(8, 16, 10)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x38bdf8, 0.55)
    rim.position.set(-10, 6, -8)
    this.scene.add(rim)
    const fill = new THREE.PointLight(0x67e8f9, 1.2, 40, 2)
    fill.position.set(0, 6, 0)
    this.scene.add(fill)

    this.buildDecor()
    this.scene.add(this.decor)
    this.scene.add(this.island)

    this.resize()
    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(this.host)
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.addEventListener('click', this.onClick)
    this.loop()
  }

  setParties(parties: AgingParty[]) {
    this.clearPillars()
    this.selectedCode = ''
    const list = [...parties]
      .sort((a, b) => num(b.openBalance) - num(a.openBalance))
      .slice(0, 36)
    if (!list.length) return

    const maxBal = Math.max(...list.map((p) => num(p.openBalance)), 1)
    const n = list.length
    const ringR = Math.min(7.2, 3.2 + n * 0.12)

    list.forEach((party, i) => {
      const h = 0.9 + (num(party.openBalance) / maxBal) * 6.2
      const color = BUCKET_HEX[party.worstBucket] ?? 0x64748b
      const risk = party.worstBucket === 'OVER_THREE_YEARS'
      const warn = party.worstBucket === 'TWO_TO_THREE_YEARS'

      const root = new THREE.Group()
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      root.position.set(Math.cos(angle) * ringR, 0, Math.sin(angle) * ringR)

      // hex pad
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.78, 0.08, 6),
        new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          metalness: 0.85,
          roughness: 0.35,
          emissive: color,
          emissiveIntensity: 0.12,
        }),
      )
      pad.position.y = 0.04
      root.add(pad)

      const padRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.7, 0.018, 8, 48),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }),
      )
      padRing.rotation.x = -Math.PI / 2
      padRing.position.y = 0.09
      root.add(padRing)

      // inner energy core + outer glass shell
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x020617,
        emissive: color,
        emissiveIntensity: risk ? 0.9 : warn ? 0.55 : 0.35,
        metalness: 0.4,
        roughness: 0.25,
      })
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, h, 20), coreMat)
      core.position.y = h / 2 + 0.1
      root.add(core)

      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.4, h + 0.05, 20, 1, true),
        new THREE.MeshPhysicalMaterial({
          color: 0x082f49,
          metalness: 0.1,
          roughness: 0.15,
          transmission: 0.55,
          thickness: 0.35,
          transparent: true,
          opacity: 0.55,
          emissive: color,
          emissiveIntensity: 0.08,
        }),
      )
      shell.position.y = h / 2 + 0.1
      root.add(shell)

      const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: risk ? 0.35 : 0.18,
        depthWrite: false,
      })
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.52, h * 0.92, 20, 1, true), glowMat)
      glow.position.y = h / 2 + 0.1
      root.add(glow)

      // risk orbit rings
      const ringMats: THREE.MeshBasicMaterial[] = []
      const ringCount = risk ? 3 : warn ? 2 : 1
      for (let r = 0; r < ringCount; r++) {
        const rm = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 - r * 0.12 })
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42 + r * 0.08, 0.012, 8, 48), rm)
        ring.rotation.x = Math.PI / 2
        ring.position.y = h * (0.35 + r * 0.2) + 0.1
        root.add(ring)
        ringMats.push(rm)
      }

      // crown beacon
      const crown = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.14, 0),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: color,
          emissiveIntensity: 1.1,
          metalness: 0.2,
          roughness: 0.2,
        }),
      )
      crown.position.y = h + 0.35
      root.add(crown)

      // billboard label
      const label = this.makeLabelSprite(
        party.targetCode,
        money(party.openBalance),
        `#${color.toString(16).padStart(6, '0')}`,
      )
      label.position.set(0, h + 0.85, 0)
      root.add(label)

      root.userData.party = party
      this.island.add(root)

      const pickMeshes = [pad, core, shell, glow, crown]
      pickMeshes.forEach((m) => {
        m.userData.party = party
      })

      this.pillars.push({
        root,
        party,
        coreMat,
        glowMat,
        ringMats,
        baseY: 0,
        pickMeshes,
      })
    })
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.anim)
    this.resizeObs?.disconnect()
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove)
    this.renderer.domElement.removeEventListener('click', this.onClick)
    this.clearPillars()
    this.disposeObject(this.decor)
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.host) {
      this.host.removeChild(this.renderer.domElement)
    }
  }

  private buildDecor() {
    // base plate
    const plate = new THREE.Mesh(
      new THREE.CircleGeometry(11, 72),
      new THREE.MeshStandardMaterial({
        color: 0x07111f,
        metalness: 0.7,
        roughness: 0.55,
        emissive: 0x0ea5e9,
        emissiveIntensity: 0.04,
      }),
    )
    plate.rotation.x = -Math.PI / 2
    this.decor.add(plate)

    // grid
    const grid = new THREE.GridHelper(20, 40, 0x0ea5e9, 0x164e63)
    grid.position.y = 0.02
    const gMat = grid.material as THREE.Material | THREE.Material[]
    if (Array.isArray(gMat)) {
      gMat.forEach((m) => {
        m.transparent = true
        m.opacity = 0.35
      })
    } else {
      gMat.transparent = true
      gMat.opacity = 0.35
    }
    this.decor.add(grid)

    // concentric hologram rings
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.2 + i * 1.7, 0.02, 8, 96),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? 0x22d3ee : 0x38bdf8,
          transparent: true,
          opacity: 0.28 - i * 0.04,
        }),
      )
      ring.rotation.x = -Math.PI / 2
      ring.position.y = 0.05
      this.decor.add(ring)
    }

    // center hub
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.35, 0.18, 32),
      new THREE.MeshStandardMaterial({
        color: 0x0b1220,
        metalness: 0.9,
        roughness: 0.25,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
      }),
    )
    hub.position.y = 0.1
    this.decor.add(hub)
    const hubCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.35, 1),
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.8,
        metalness: 0.3,
        roughness: 0.2,
      }),
    )
    hubCore.position.y = 0.55
    this.decor.add(hubCore)

    // floating particles
    const count = 180
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 2 + Math.random() * 9
      pos[i * 3] = Math.cos(a) * r
      pos[i * 3 + 1] = 0.4 + Math.random() * 7
      pos[i * 3 + 2] = Math.sin(a) * r
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0x7dd3fc,
        size: 0.06,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    )
    this.decor.add(this.particles)
  }

  private makeLabelSprite(code: string, amountText: string, accent: string) {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 160
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // glass panel
    ctx.fillStyle = 'rgba(2, 12, 27, 0.82)'
    roundRect(ctx, 16, 24, 480, 112, 18)
    ctx.fill()
    ctx.strokeStyle = accent
    ctx.lineWidth = 3
    ctx.stroke()

    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(48, 80, 10, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '700 42px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillStyle = '#f0f9ff'
    ctx.fillText(code, 72, 72)

    ctx.font = '500 30px ui-monospace, SFMono-Regular, Menlo, monospace'
    ctx.fillStyle = 'rgba(186, 230, 253, 0.92)'
    ctx.fillText(amountText, 72, 118)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })
    const sprite = new THREE.Sprite(mat)
    sprite.scale.set(2.4, 0.75, 1)
    sprite.userData.disposeTex = () => {
      tex.dispose()
      mat.dispose()
    }
    return sprite
  }

  private clearPillars() {
    for (const p of this.pillars) {
      this.island.remove(p.root)
      this.disposeObject(p.root)
    }
    this.pillars = []
    this.hovered = null
  }

  private disposeObject(obj: THREE.Object3D) {
    obj.traverse((child) => {
      const any = child as THREE.Mesh & { userData: { disposeTex?: () => void } }
      if (any.userData?.disposeTex) any.userData.disposeTex()
      if (any.isMesh) {
        any.geometry?.dispose()
        const mat = any.material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat?.dispose()
      }
      if ((child as THREE.Sprite).isSprite) {
        const sm = (child as THREE.Sprite).material
        sm.map?.dispose()
        sm.dispose()
      }
    })
  }

  private resize = () => {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h, false)
    const el = this.renderer.domElement
    el.style.width = '100%'
    el.style.height = '100%'
    el.style.display = 'block'
  }

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const meshes = this.pillars.flatMap((p) => p.pickMeshes)
    const hits = this.raycaster.intersectObjects(meshes, false)
    const next =
      hits.length > 0
        ? this.pillars.find((p) => p.party.targetCode === (hits[0].object.userData.party as AgingParty).targetCode) ||
          null
        : null
    if (this.hovered !== next) {
      this.hovered = next
      this.renderer.domElement.style.cursor = next ? 'pointer' : 'default'
    }
  }

  private onClick = () => {
    if (this.hovered) {
      this.selectedCode = this.hovered.party.targetCode
      this.onSelect(this.hovered.party)
    } else {
      this.selectedCode = ''
      this.onSelect(null)
    }
  }

  private loop = () => {
    if (this.disposed) return
    this.anim = requestAnimationFrame(this.loop)
    const t = performance.now() * 0.001

    this.island.rotation.y = t * 0.08
    this.decor.rotation.y = t * 0.02
    if (this.particles) {
      this.particles.rotation.y = -t * 0.05
    }

    for (const p of this.pillars) {
      const risk = p.party.worstBucket === 'OVER_THREE_YEARS'
      const selected = p.party.targetCode === this.selectedCode
      const hover = this.hovered === p
      const pulse = risk ? 0.55 + Math.sin(t * 5) * 0.4 : 0.28
      p.coreMat.emissiveIntensity = (selected || hover ? 1.15 : 1) * (risk ? pulse : hover ? 0.7 : 0.4)
      p.glowMat.opacity = risk ? 0.22 + Math.sin(t * 4) * 0.18 : hover ? 0.28 : 0.14
      p.root.position.y = (selected || hover ? 0.12 : 0) + (risk ? Math.sin(t * 2.8 + p.root.position.x) * 0.05 : 0)
      p.root.scale.setScalar(selected ? 1.06 : hover ? 1.03 : 1)
      for (let i = 0; i < p.ringMats.length; i++) {
        p.ringMats[i].opacity = 0.35 + Math.sin(t * 3 + i) * 0.15
      }
    }

    this.renderer.render(this.scene, this.camera)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
