<template>
  <div class="sp-view-wrap">
    <div ref="host" class="sp-view" />
    <p v-if="debug" class="sp-view__dbg">{{ debug }}</p>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { createSoftPackGeometry, normalizeSoftPackDims, type SoftPackDims } from '~/utils/pack3d/softPackMesh'
import {
  applySoftPackDrawingMap,
  DEFAULT_TEX_ORIENT,
  toUnfoldParams,
  updateGeometryUVs,
  type SoftPackTexMode,
  type SoftPackTexOrient,
} from '~/utils/pack3d/softPackTexture'
import type { SoftPackCropRect } from '~/utils/pack3d/softPackCrop'

const props = defineProps<{
  dims: SoftPackDims
  imageUrl: string | null
  cropRect?: SoftPackCropRect | null
  cropBack?: SoftPackCropRect | null
  texOrient?: SoftPackTexOrient | null
  texMode?: SoftPackTexMode | null
}>()

const host = ref<HTMLElement | null>(null)
const debug = ref('')

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let mesh: THREE.Mesh | null = null
let raf = 0
let disposed = false
let ro: ResizeObserver | null = null
let buildSeq = 0

function disposeMesh() {
  if (!mesh || !scene) return
  scene.remove(mesh)
  mesh.traverse((obj) => {
    const o = obj as THREE.Mesh
    if (o.geometry) o.geometry.dispose()
    const mat = o.material
    if (!mat) return
    for (const m of Array.isArray(mat) ? mat : [mat]) {
      const sm = m as THREE.MeshStandardMaterial
      sm.map?.dispose()
      sm.dispose()
    }
  })
  mesh = null
}

function framePillow(dims: SoftPackDims, formed: { width?: number; height?: number; depth?: number }) {
  if (!camera) return
  const w = formed.width ?? dims.mainFaceWidth + dims.sealWidth * 2
  const h = formed.height ?? dims.height ?? 90
  const d = formed.depth ?? dims.sideWidth * 2
  const span = Math.max(w, h, d)
  const dist = span * 1.65
  // 近正前略仰视，贴近实拍产品图构图
  camera.position.set(dist * 0.22, h * 0.18, dist * 1.05)
  camera.near = 0.05
  camera.far = Math.max(5000, dist * 40)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
}

async function buildMesh(dims: SoftPackDims) {
  if (!scene) return
  const seq = ++buildSeq
  disposeMesh()

  const height = dims.height ?? 90
  const unfold = toUnfoldParams(dims, height)
  const geo = createSoftPackGeometry({
    dims: normalizeSoftPackDims(dims),
    height: unfold.height,
    radialSegments: 128,
    heightSegments: 144,
  })
  // 占位 UV；贴图时再按 panels 实拍 UV 覆盖
  const mode = props.texMode ?? 'panels'
  updateGeometryUVs(geo, unfold, mode === 'fullWrap' ? 'fullWrap' : 'panels')

  const formed = (geo.userData.formed || {}) as {
    width?: number
    height?: number
    depth?: number
    seal?: number
    label?: string
    productType?: string
  }
  const depth = formed.depth ?? 24

  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.02,
    roughness: 0.42,
    side: THREE.FrontSide,
  })
  const next = new THREE.Mesh(geo, mat)
  next.frustumCulled = false
  if (seq !== buildSeq || disposed || !scene) {
    geo.dispose()
    mat.dispose()
    return
  }
  mesh = next
  scene.add(mesh)
  framePillow(dims, formed)

  const kind = formed.label || '软包装'
  const mm = (n: number | undefined, fb: number) => {
    const v = Number.isFinite(n) ? (n as number) : fb
    return Math.round(v * 10) / 10
  }
  const bodyW = (formed as { bodyWidth?: number }).bodyWidth
  const sideW = (formed as { sideWidth?: number }).sideWidth
  const outerW = formed.width ?? (bodyW ?? dims.mainFaceWidth) + dims.sealWidth * 2
  // 正宽×高×厚（刀模 1:1）· 外宽(=正+2封) · 封边
  debug.value = `${kind} ${mm(bodyW, dims.mainFaceWidth)}×${mm(formed.height, height)}×${mm(depth, dims.maxHalfDepth ? dims.maxHalfDepth * 2 : 42)} mm · 外宽${mm(outerW, dims.mainFaceWidth + dims.sealWidth * 2)} · 封${mm(formed.seal, dims.sealWidth)}（侧${mm(sideW, dims.sideWidth)}）`
  const uvTag = String((geo.userData as { uvVersion?: string }).uvVersion || '')
  const filmW = Number((geo.userData as { filmW?: number }).filmW || 0)
  const formedW = Number((geo.userData as { totalW?: number }).totalW || 0)
  if (uvTag) {
    debug.value += ` · UV ${uvTag} ${Math.round(formedW)}→${Math.round(filmW)}`
  }

  if (props.imageUrl && (props.cropRect || mode === 'autoFilm')) {
    try {
      const orient = props.texOrient ?? DEFAULT_TEX_ORIENT
      const tex = await applySoftPackDrawingMap(
        next,
        props.imageUrl,
        dims,
        props.cropRect,
        orient,
        { mode, cropBack: props.cropBack },
      )
      if (seq !== buildSeq) {
        tex?.dispose()
        return
      }
      const cw = Math.round(props.cropRect?.cropWidth || 0)
      const ch = Math.round(props.cropRect?.cropHeight || 0)
      const label =
        mode === 'autoFilm' ? '自动多面' : mode === 'fullWrap' ? '全膜' : '正+背'
      debug.value += tex ? ` · ${label}${cw ? ` ${cw}×${ch}` : ''}` : ''
    } catch (e) {
      console.warn('[SoftPackViewport] texture failed', e)
    }
  } else if (props.imageUrl && !props.cropRect) {
    debug.value += ' · 点「自动多面」或框选正面'
  }
}

function tick() {
  if (disposed || !renderer || !scene || !camera) return
  if (mesh) mesh.rotation.y += 0.0008
  renderer.render(scene, camera)
  raf = requestAnimationFrame(tick)
}

function onResize() {
  if (!host.value || !renderer || !camera) return
  const w = Math.max(2, host.value.clientWidth)
  const h = Math.max(2, host.value.clientHeight)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, true)
}

onMounted(async () => {
  if (!host.value) return
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x071018)

  camera = new THREE.PerspectiveCamera(38, 1, 0.05, 8000)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  host.value.appendChild(renderer.domElement)

  scene.add(new THREE.HemisphereLight(0xd8f0ff, 0x3a2818, 0.95))
  const key = new THREE.DirectionalLight(0xffffff, 1.15)
  key.position.set(70, 120, 160)
  scene.add(key)
  const rim = new THREE.DirectionalLight(0x88d5ff, 0.4)
  rim.position.set(-90, 40, -60)
  scene.add(rim)

  const grid = new THREE.GridHelper(320, 32, 0x2a6a7a, 0x143040)
  grid.position.y = -48
  scene.add(grid)

  onResize()
  ro = new ResizeObserver(() => onResize())
  ro.observe(host.value)
  window.addEventListener('resize', onResize)
  tick()

  await nextTick()
  onResize()
  await buildMesh(props.dims)
})

watch(
  () =>
    [
      props.dims.totalWidth,
      props.dims.sealWidth,
      props.dims.sideWidth,
      props.dims.mainFaceWidth,
      props.dims.backSealWidth,
      props.dims.height,
      props.dims.productType,
      props.dims.maxHalfDepth,
      props.dims.bellyPower,
      JSON.stringify(props.dims.depthProfile ?? []),
      props.imageUrl,
      props.cropRect?.startX,
      props.cropRect?.startY,
      props.cropRect?.cropWidth,
      props.cropRect?.cropHeight,
      props.cropBack?.startX,
      props.cropBack?.startY,
      props.cropBack?.cropWidth,
      props.cropBack?.cropHeight,
      props.texOrient?.flipU,
      props.texOrient?.flipV,
      props.texMode,
    ] as const,
  () => {
    if (scene) void buildMesh(props.dims)
  },
)

onUnmounted(() => {
  disposed = true
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
  ro?.disconnect()
  ro = null
  disposeMesh()
  renderer?.dispose()
  if (renderer?.domElement.parentElement) {
    renderer.domElement.parentElement.removeChild(renderer.domElement)
  }
  renderer = null
  scene = null
  camera = null
})
</script>

<style scoped lang="scss">
.sp-view-wrap {
  @apply absolute inset-0;
}
.sp-view {
  @apply h-full w-full overflow-hidden bg-slate-950;
  canvas {
    @apply block h-full w-full;
  }
}
.sp-view__dbg {
  @apply pointer-events-none absolute bottom-2 left-2 rounded bg-black/55 px-2 py-0.5 font-mono text-[0.65rem] text-cyan-200/90;
}
</style>
