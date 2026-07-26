<template>
  <div class="spc" tabindex="0" @keydown="onKey">
    <div class="spc__head">
      <h3 class="spc__title">展开拼贴裁剪</h3>
      <span class="spc__asp">比例 {{ aspectLabel }}</span>
    </div>
    <div class="spc__tabs">
      <button
        type="button"
        class="spc__tab spc__tab--auto"
        :class="{ 'spc__tab--on': face === 'auto' }"
        @click="runAutoFilm"
      >
        自动多面
      </button>
      <button
        type="button"
        class="spc__tab"
        :class="{ 'spc__tab--on': face === 'full' }"
        @click="setFace('full')"
      >
        全膜展开
      </button>
      <button
        type="button"
        class="spc__tab"
        :class="{ 'spc__tab--on': face === 'front' }"
        @click="setFace('front')"
      >
        仅正面
      </button>
      <button
        type="button"
        class="spc__tab"
        :class="{ 'spc__tab--on': face === 'back' }"
        @click="setFace('back')"
      >
        仅背面
      </button>
    </div>
    <p class="spc__hint">
      <template v-if="face === 'auto'">
        按刀模 UV（{{ aspectW }}×整膜高）自动裁正/背/封边，无缝贴合。可微调绿框后点确认。
      </template>
      <template v-else-if="face === 'full'">
        框选一整条展开图（约 {{ aspectW }}×{{ aspectH }}，含封边/侧/正/背封）。将铺满贴图，按 U=0→1
        贴合。
      </template>
      <template v-else>
        框哪贴哪（{{ face === 'front' ? '正面' : '背面' }}）。拖完即生效；确认只防渗色，不会改回默认主画面。
      </template>
    </p>

    <div class="spc__zoombar">
      <button type="button" class="spc__zbtn" title="缩小" @click="bumpZoom(-0.5)">−</button>
      <input
        v-model.number="zoom"
        class="spc__range"
        type="range"
        min="1"
        max="12"
        step="0.1"
        @input="onZoomInput"
      />
      <button type="button" class="spc__zbtn" title="放大" @click="bumpZoom(0.5)">+</button>
      <span class="spc__zlabel">{{ Math.round(zoom * 100) }}%</span>
    </div>
    <div class="spc__presets">
      <button type="button" class="spc__zbtn" @click="setZoom(1)">适应</button>
      <button type="button" class="spc__zbtn" @click="setZoom(2)">2×</button>
      <button type="button" class="spc__zbtn" @click="setZoom(4)">4×</button>
      <button type="button" class="spc__zbtn" @click="setZoom(8)">8×</button>
      <button type="button" class="spc__zbtn" @click="zoomToCrop">对准选框</button>
      <button
        type="button"
        class="spc__zbtn"
        :class="{ 'spc__zbtn--on': lockAspect }"
        @click="toggleLockAspect"
      >
        {{ lockAspect ? '比例已锁' : '自由拉边' }}
      </button>
      <button type="button" class="spc__zbtn" @click="expanded = !expanded">
        {{ expanded ? '收起' : '全屏放大' }}
      </button>
    </div>

    <div :class="['spc__stage-wrap', expanded && 'spc__stage-wrap--exp']">
      <div
        ref="stageRef"
        class="spc__stage"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel.prevent="onWheel"
      >
        <img
          ref="imgRef"
          :src="imageUrl"
          class="spc__img"
          alt="展开图纸"
          draggable="false"
          :style="imgStyle"
          @load="onImgLoad"
        />
        <div class="spc__box" :style="boxStyle" data-handle="move">
          <span class="spc__edge" data-handle="n" />
          <span class="spc__edge spc__edge--s" data-handle="s" />
          <span class="spc__edge spc__edge--e" data-handle="e" />
          <span class="spc__edge spc__edge--w" data-handle="w" />
          <i class="spc__corner" data-handle="nw" />
          <i class="spc__corner spc__corner--ne" data-handle="ne" />
          <i class="spc__corner spc__corner--sw" data-handle="sw" />
          <i class="spc__corner spc__corner--se" data-handle="se" />
        </div>
      </div>
    </div>

    <div class="spc__controls">
      <div class="spc__nudge">
        <span class="spc__nudge-label">画面平移</span>
        <div class="spc__pad">
          <button type="button" class="spc__pad-btn spc__pad-btn--ghost" @click="panView(0, panStep)">
            ↑
          </button>
          <div class="spc__pad-mid">
            <button type="button" class="spc__pad-btn" @click="panView(panStep, 0)">←</button>
            <button type="button" class="spc__pad-btn spc__pad-btn--step" @click="cyclePanStep">
              {{ panStep }}
            </button>
            <button type="button" class="spc__pad-btn" @click="panView(-panStep, 0)">→</button>
          </div>
          <button type="button" class="spc__pad-btn spc__pad-btn--ghost" @click="panView(0, -panStep)">
            ↓
          </button>
        </div>
      </div>
      <div class="spc__nudge">
        <span class="spc__nudge-label">选框微调</span>
        <div class="spc__pad">
          <button type="button" class="spc__pad-btn spc__pad-btn--ghost" @click="nudge(0, -step)">
            ↑
          </button>
          <div class="spc__pad-mid">
            <button type="button" class="spc__pad-btn" @click="nudge(-step, 0)">←</button>
            <button type="button" class="spc__pad-btn spc__pad-btn--step" @click="cycleStep">
              {{ step }}px
            </button>
            <button type="button" class="spc__pad-btn" @click="nudge(step, 0)">→</button>
          </div>
          <button type="button" class="spc__pad-btn spc__pad-btn--ghost" @click="nudge(0, step)">
            ↓
          </button>
        </div>
      </div>
    </div>
    <p class="spc__nudge-tip">方向键挪选框 · Alt+方向键挪画面 · +/− 缩放 · 空白处拖动画布</p>

    <div class="spc__meta" v-if="crop.cropWidth > 1">
      {{ Math.round(crop.startX) }},{{ Math.round(crop.startY) }} ·
      {{ Math.round(crop.cropWidth) }}×{{ Math.round(crop.cropHeight) }}px · 当前比
      {{ liveAspect }}
      <template v-if="lockAspect"> · 锁定 {{ aspectLabel }}</template>
      <template v-else> · 自由拉边</template>
    </div>
    <div class="spc__orient">
      <button
        type="button"
        class="spc__btn"
        :class="{ 'spc__btn--on': orient.flipV }"
        @click="toggleFlipV"
      >
        上下翻转
      </button>
      <button
        type="button"
        class="spc__btn"
        :class="{ 'spc__btn--on': orient.flipU }"
        @click="toggleFlipU"
      >
        左右镜像
      </button>
    </div>
    <div class="spc__foot">
      <button type="button" class="spc__btn" @click="resetCrop">重置</button>
      <button type="button" class="spc__btn spc__btn--ok" @click="confirmCrop">确认对齐</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  autoCropAllPanels,
  clampToImage,
  defaultBackPanelCrop,
  defaultFrontPanelCrop,
  defaultFullWrapRowCrop,
  ensureFrontIsVivid,
  insetRect,
  type SoftPackCropRect,
} from '~/utils/pack3d/softPackCrop'
import {
  DEFAULT_TEX_ORIENT,
  type SoftPackTexOrient,
} from '~/utils/pack3d/softPackTexture'

const props = defineProps<{
  imageUrl: string
  /** 当前模式对应的裁剪比例 */
  aspect: number
  totalWidth?: number
  faceHeight?: number
  stripWidth?: number
  horiz?: number[]
  vert?: number[]
  roles?: string[]
  modelValue?: SoftPackCropRect | null
  backCrop?: SoftPackCropRect | null
  orient?: SoftPackTexOrient | null
  /** fullWrap | panels | autoFilm */
  texMode?: 'fullWrap' | 'panels' | 'autoFilm'
}>()

const emit = defineEmits<{
  'update:modelValue': [SoftPackCropRect]
  'update:backCrop': [SoftPackCropRect]
  'update:orient': [SoftPackTexOrient]
  'update:texMode': ['fullWrap' | 'panels' | 'autoFilm']
  confirm: [SoftPackCropRect, 'full' | 'front' | 'back' | 'auto']
}>()

type FaceKind = 'auto' | 'full' | 'front' | 'back'
const face = ref<FaceKind>(
  props.texMode === 'autoFilm' ? 'auto' : props.texMode === 'fullWrap' ? 'full' : 'front',
)
const orient = computed(() => props.orient ?? DEFAULT_TEX_ORIENT)
const expanded = ref(false)
/** 默认关闭：拖一条边只改那一边；开启后才锁 95:90 */
/** 默认自由拉边；需要锁 95:90 时再点「比例已锁」 */
const lockAspect = ref(false)
/** 相对「适应窗口」的额外放大倍数，最高 12× */
const zoom = ref(3)
const panX = ref(0)
const panY = ref(0)
const step = ref(4)
const panStep = ref(48)
const STEPS = [1, 2, 4, 8, 16]
const PAN_STEPS = [24, 48, 96, 160]

const stageRef = ref<HTMLElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const natW = ref(0)
const natH = ref(0)
const baseScale = ref(1)
const disp = ref({ left: 0, top: 0, width: 1, height: 1 })
const crop = ref<SoftPackCropRect>({ startX: 0, startY: 0, cropWidth: 1, cropHeight: 1 })

const aspectLabel = computed(() => props.aspect.toFixed(3))
const liveAspect = computed(() =>
  crop.value.cropHeight > 0 ? (crop.value.cropWidth / crop.value.cropHeight).toFixed(3) : '—',
)
const aspectH = computed(() => Math.round(props.faceHeight ?? 90))
const aspectW = computed(() => {
  if (face.value === 'auto' || face.value === 'full') {
    return Math.round(props.stripWidth ?? props.aspect * (props.faceHeight ?? 90))
  }
  return Math.round(props.totalWidth ?? props.aspect * (props.faceHeight ?? 90))
})

function toggleLockAspect() {
  lockAspect.value = !lockAspect.value
  if (lockAspect.value) {
    publish({ ...crop.value }, true)
  }
}

function toggleFlipV() {
  emit('update:orient', { ...orient.value, flipV: !orient.value.flipV })
}
function toggleFlipU() {
  emit('update:orient', { ...orient.value, flipU: !orient.value.flipU })
}

function setFace(f: FaceKind) {
  if (f === 'auto') {
    runAutoFilm()
    return
  }
  face.value = f
  emit('update:texMode', f === 'full' ? 'fullWrap' : 'panels')
  if (!natW.value) return
  publish(initialCrop(), true)
  centerOnCrop()
}

function runAutoFilm() {
  face.value = 'auto'
  emit('update:texMode', 'autoFilm')
  if (!natW.value) return
  const horiz = props.horiz?.length ? props.horiz : [10, 21, 95, 21, 10, 20]
  const vert = props.vert?.length ? props.vert : [90, 42, 90, 42]
  const roles = props.roles?.length ? props.roles : ['BACK', 'GUSSET', 'FRONT', 'GUSSET']
  let panels = autoCropAllPanels(natW.value, natH.value, horiz, vert, roles)
  const el = imgRef.value
  if (el && (el.naturalWidth || el.width) > 0) {
    panels = ensureFrontIsVivid(el, panels)
  }
  crop.value = panels.front
  emit('update:modelValue', { ...panels.front })
  emit('update:backCrop', { ...panels.back })
  emit('confirm', { ...panels.front }, 'auto')
  centerOnCrop()
}

function initialCrop(): SoftPackCropRect {
  const horiz = props.horiz?.length ? props.horiz : [10, 21, 95, 21, 10, 20]
  const vert = props.vert?.length ? props.vert : [90, 42, 90, 42]
  const roles = props.roles?.length ? props.roles : ['BACK', 'GUSSET', 'FRONT', 'GUSSET']
  if (face.value === 'auto') {
    return autoCropAllPanels(natW.value, natH.value, horiz, vert, roles).front
  }
  if (face.value === 'back') {
    return defaultBackPanelCrop(natW.value, natH.value, horiz, vert, roles)
  }
  if (face.value === 'full') {
    return defaultFullWrapRowCrop(natW.value, natH.value, horiz, vert, roles, 'front')
  }
  return defaultFrontPanelCrop(natW.value, natH.value, horiz, vert, roles)
}

type Handle = 'move' | 'pan' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
let dragging: Handle | null = null
let dragOrigin = { x: 0, y: 0, crop: null as SoftPackCropRect | null, panX: 0, panY: 0 }

const imgStyle = computed(() => ({
  left: `${disp.value.left}px`,
  top: `${disp.value.top}px`,
  width: `${disp.value.width}px`,
  height: `${disp.value.height}px`,
}))

function clampCrop(r: SoftPackCropRect): SoftPackCropRect {
  let cropWidth = Math.max(8, r.cropWidth)
  let cropHeight = Math.max(8, r.cropHeight)
  let startX = r.startX
  let startY = r.startY

  if (lockAspect.value) {
    const a = Math.max(1e-6, props.aspect)
    cropHeight = cropWidth / a
  }

  if (cropWidth > natW.value) {
    cropWidth = natW.value
    if (lockAspect.value) cropHeight = cropWidth / Math.max(1e-6, props.aspect)
  }
  if (cropHeight > natH.value) {
    cropHeight = natH.value
    if (lockAspect.value) cropWidth = cropHeight * Math.max(1e-6, props.aspect)
  }

  return clampToImage(
    { startX, startY, cropWidth, cropHeight },
    natW.value,
    natH.value,
  )
}

function publish(r: SoftPackCropRect, alsoConfirm: boolean) {
  const next = clampCrop(r)
  crop.value = next
  if (face.value === 'back') emit('update:backCrop', { ...next })
  else emit('update:modelValue', { ...next })
  if (alsoConfirm) {
    const kind =
      face.value === 'auto' ? 'auto' : face.value === 'full' ? 'full' : face.value === 'back' ? 'back' : 'front'
    emit('confirm', { ...next }, kind)
  }
}

function onImgLoad() {
  const img = imgRef.value
  if (!img) return
  natW.value = img.naturalWidth || img.width
  natH.value = img.naturalHeight || img.height
  layoutDisplay()
  publish(initialCrop(), true)
  centerOnCrop()
}

function layoutDisplay() {
  const stage = stageRef.value
  if (!stage || !natW.value) return
  const sw = stage.clientWidth
  const sh = stage.clientHeight
  baseScale.value = Math.min(sw / natW.value, sh / natH.value)
  const s = baseScale.value * zoom.value
  const width = natW.value * s
  const height = natH.value * s
  // 居中 + 平移
  let left = (sw - width) * 0.5 + panX.value
  let top = (sh - height) * 0.5 + panY.value
  disp.value = { left, top, width, height }
}

/** 把裁剪框滚到视口中央 */
function centerOnCrop() {
  const stage = stageRef.value
  if (!stage || !natW.value) return
  layoutDisplay()
  const s = disp.value.width / Math.max(1, natW.value)
  const boxCx = crop.value.startX + crop.value.cropWidth * 0.5
  const boxCy = crop.value.startY + crop.value.cropHeight * 0.5
  const imgCx = disp.value.left + boxCx * s
  const imgCy = disp.value.top + boxCy * s
  panX.value += stage.clientWidth * 0.5 - imgCx
  panY.value += stage.clientHeight * 0.5 - imgCy
  layoutDisplay()
}

function bumpZoom(d: number) {
  setZoom(Math.round((zoom.value + d) * 10) / 10)
}

function setZoom(z: number) {
  zoom.value = Math.min(12, Math.max(1, z))
  layoutDisplay()
  centerOnCrop()
}

function onZoomInput() {
  zoom.value = Math.min(12, Math.max(1, Number(zoom.value) || 1))
  layoutDisplay()
}

/** 放大并对准当前选框 */
function zoomToCrop() {
  zoom.value = Math.min(12, Math.max(3, zoom.value < 3 ? 4 : zoom.value))
  layoutDisplay()
  centerOnCrop()
}

function panView(dx: number, dy: number) {
  panX.value += dx
  panY.value += dy
  layoutDisplay()
}

function nudge(dx: number, dy: number) {
  publish(
    {
      ...crop.value,
      startX: crop.value.startX + dx,
      startY: crop.value.startY + dy,
    },
    true,
  )
}

function cycleStep() {
  const i = STEPS.indexOf(step.value)
  step.value = STEPS[(i + 1) % STEPS.length]
}

function cyclePanStep() {
  const i = PAN_STEPS.indexOf(panStep.value)
  panStep.value = PAN_STEPS[(i + 1) % PAN_STEPS.length]
}

function onKey(ev: KeyboardEvent) {
  const big = ev.shiftKey ? step.value * 4 : step.value
  const panBig = ev.shiftKey ? panStep.value * 2 : panStep.value
  if (ev.altKey) {
    if (ev.key === 'ArrowLeft') {
      ev.preventDefault()
      panView(panBig, 0)
    } else if (ev.key === 'ArrowRight') {
      ev.preventDefault()
      panView(-panBig, 0)
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault()
      panView(0, panBig)
    } else if (ev.key === 'ArrowDown') {
      ev.preventDefault()
      panView(0, -panBig)
    }
    return
  }
  if (ev.key === 'ArrowLeft') {
    ev.preventDefault()
    nudge(-big, 0)
  } else if (ev.key === 'ArrowRight') {
    ev.preventDefault()
    nudge(big, 0)
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault()
    nudge(0, -big)
  } else if (ev.key === 'ArrowDown') {
    ev.preventDefault()
    nudge(0, big)
  } else if (ev.key === '=' || ev.key === '+') {
    bumpZoom(0.5)
  } else if (ev.key === '-') {
    bumpZoom(-0.5)
  }
}

function onWheel(ev: WheelEvent) {
  const before = Math.max(0.01, zoom.value)
  const next = Math.min(12, Math.max(1, zoom.value * (ev.deltaY > 0 ? 0.88 : 1.15)))
  zoom.value = Math.round(next * 100) / 100
  const stage = stageRef.value
  if (stage) {
    const rect = stage.getBoundingClientRect()
    const mx = ev.clientX - rect.left - stage.clientWidth * 0.5
    const my = ev.clientY - rect.top - stage.clientHeight * 0.5
    const ratio = zoom.value / before
    panX.value = mx + (panX.value - mx) * ratio
    panY.value = my + (panY.value - my) * ratio
  }
  layoutDisplay()
}

function imgToDisp(rect: SoftPackCropRect) {
  const s = disp.value.width / Math.max(1, natW.value)
  return {
    left: disp.value.left + rect.startX * s,
    top: disp.value.top + rect.startY * s,
    width: rect.cropWidth * s,
    height: rect.cropHeight * s,
  }
}

const boxStyle = computed(() => {
  const b = imgToDisp(crop.value)
  return {
    left: `${b.left}px`,
    top: `${b.top}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
  }
})

function onPointerDown(ev: PointerEvent) {
  const t = ev.target as HTMLElement
  const handle = (t.closest('[data-handle]') as HTMLElement | null)?.dataset.handle as
    | Handle
    | undefined
  ev.preventDefault()
  stageRef.value?.setPointerCapture(ev.pointerId)

  if (!handle) {
    // 空白处拖动画布
    dragging = 'pan'
    dragOrigin = {
      x: ev.clientX,
      y: ev.clientY,
      crop: null,
      panX: panX.value,
      panY: panY.value,
    }
    return
  }

  dragging = handle
  dragOrigin = {
    x: ev.clientX,
    y: ev.clientY,
    crop: { ...crop.value },
    panX: panX.value,
    panY: panY.value,
  }
}

function onPointerMove(ev: PointerEvent) {
  if (!dragging) return

  if (dragging === 'pan') {
    panX.value = dragOrigin.panX + (ev.clientX - dragOrigin.x)
    panY.value = dragOrigin.panY + (ev.clientY - dragOrigin.y)
    layoutDisplay()
    return
  }

  if (!dragOrigin.crop) return
  const scale = natW.value / Math.max(1, disp.value.width)
  const dx = (ev.clientX - dragOrigin.x) * scale
  const dy = (ev.clientY - dragOrigin.y) * scale
  const o = dragOrigin.crop
  const a = Math.max(1e-6, props.aspect)
  let next = { ...o }

  if (dragging === 'move') {
    next.startX = o.startX + dx
    next.startY = o.startY + dy
    crop.value = clampCrop(next)
    return
  }

  const fromW = dragging.includes('w')
  const fromE = dragging.includes('e')
  const fromN = dragging.includes('n')
  const fromS = dragging.includes('s')

  if (!lockAspect.value) {
    // 自由拉边：只动被拖的边，对边不动
    if (fromE) next.cropWidth = Math.max(8, o.cropWidth + dx)
    if (fromW) {
      next.cropWidth = Math.max(8, o.cropWidth - dx)
      next.startX = o.startX + o.cropWidth - next.cropWidth
    }
    if (fromS) next.cropHeight = Math.max(8, o.cropHeight + dy)
    if (fromN) {
      next.cropHeight = Math.max(8, o.cropHeight - dy)
      next.startY = o.startY + o.cropHeight - next.cropHeight
    }
    crop.value = clampCrop(next)
    return
  }

  // 锁定比例：以宽为准联动高（边角同逻辑）
  let newW = o.cropWidth
  if (fromE) newW = o.cropWidth + dx
  if (fromW) newW = o.cropWidth - dx
  if ((fromN || fromS) && !fromE && !fromW) {
    const dH = fromS ? dy : -dy
    newW = (o.cropHeight + dH) * a
  }
  newW = Math.max(8, newW)
  next.cropWidth = newW
  next.cropHeight = newW / a
  if (fromW) next.startX = o.startX + o.cropWidth - newW
  if (fromN) next.startY = o.startY + o.cropHeight - next.cropHeight
  crop.value = clampCrop(next)
}

function onPointerUp() {
  if (!dragging) return
  const wasPan = dragging === 'pan'
  dragging = null
  if (!wasPan) publish(crop.value, true)
}

function resetCrop() {
  if (!natW.value) return
  publish(initialCrop(), true)
  zoom.value = 3
  centerOnCrop()
}

function confirmCrop() {
  let next = clampCrop(crop.value)
  if (face.value === 'auto') {
    publish(next, true)
    emit('update:texMode', 'autoFilm')
    return
  }
  // 仅正面/背面：完全尊重用户框选，只做防渗色内缩。
  // 不再 resolvePanelCrop 强行抠刀模 FRONT（否则框到供应商信息区仍会贴成 Cranberry 正面）。
  if (face.value === 'front' || face.value === 'back') {
    next = insetRect(next, 0.03, 0.02)
    next = clampToImage(next, natW.value, natH.value)
  }
  publish(next, true)
}

watch(
  () => props.aspect,
  () => {
    if (!natW.value || !lockAspect.value) return
    // 仅在锁定比例时按当前框重算高，绝不跳回默认正面栏
    publish({ ...crop.value }, true)
  },
)

watch(expanded, () => nextTick(() => {
  layoutDisplay()
  centerOnCrop()
}))

onMounted(() => {
  window.addEventListener('resize', layoutDisplay)
  nextTick(() => {
    const img = imgRef.value
    if (img && (img.complete || img.naturalWidth > 0)) onImgLoad()
  })
})
onUnmounted(() => window.removeEventListener('resize', layoutDisplay))
</script>

<style scoped lang="scss">
.spc {
  @apply flex flex-col gap-1.5 outline-none;
}
.spc__head {
  @apply flex items-center justify-between gap-2;
}
.spc__title {
  @apply font-mono text-[0.65rem] tracking-[0.14em] text-cyan-300/85 uppercase;
}
.spc__asp {
  @apply font-mono text-[0.6rem] text-slate-500;
}
.spc__hint {
  @apply text-[0.68rem] leading-snug text-slate-500;
}
.spc__zoombar {
  @apply flex items-center gap-1.5;
}
.spc__range {
  @apply h-1.5 flex-1 cursor-pointer accent-cyan-400;
}
.spc__zbtn {
  @apply shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[0.65rem] text-slate-300 hover:bg-white/10;
}
.spc__zbtn--on {
  @apply border-cyan-400/50 bg-cyan-500/20 text-cyan-100;
}
.spc__zlabel {
  @apply w-10 shrink-0 text-right font-mono text-[0.6rem] text-slate-500;
}
.spc__stage-wrap {
  @apply relative;
}
.spc__stage-wrap--exp {
  position: fixed;
  inset: 4vh 4vw;
  z-index: 80;
  display: flex;
  flex-direction: column;
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(34, 211, 238, 0.35);
  background: rgba(2, 6, 23, 0.96);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.55);
  .spc__stage {
    flex: 1;
    min-height: 0;
    height: auto !important;
  }
}
.spc__stage {
  @apply relative w-full touch-none overflow-hidden rounded border border-cyan-400/25 bg-slate-950;
  height: min(58vh, 34rem);
  min-height: 22rem;
  user-select: none;
  cursor: grab;
}
.spc__stage:active {
  cursor: grabbing;
}
.spc__presets {
  @apply flex flex-wrap gap-1;
}
.spc__controls {
  @apply grid grid-cols-2 gap-2;
}
.spc__img {
  @apply pointer-events-none absolute max-w-none;
}
.spc__box {
  @apply absolute box-border cursor-move border-2 border-cyan-300/90 bg-cyan-400/10;
  box-shadow: 0 0 0 9999px rgba(2, 6, 23, 0.55);
}
.spc__edge {
  @apply absolute left-0 right-0 top-0 h-3 cursor-n-resize;
}
.spc__edge--s {
  @apply top-auto bottom-0 cursor-s-resize;
}
.spc__edge--e {
  @apply left-auto right-0 top-0 h-full w-3 cursor-e-resize;
}
.spc__edge--w {
  @apply left-0 top-0 h-full w-3 cursor-w-resize;
}
.spc__corner {
  @apply absolute -left-1.5 -top-1.5 z-[1] h-3.5 w-3.5 rounded-sm border border-cyan-100 bg-cyan-400;
  cursor: nwse-resize;
}
.spc__corner--ne {
  @apply left-auto -right-1.5 cursor-nesw-resize;
}
.spc__corner--sw {
  @apply top-auto -bottom-1.5 cursor-nesw-resize;
}
.spc__corner--se {
  @apply left-auto top-auto -bottom-1.5 -right-1.5 cursor-nwse-resize;
}
.spc__nudge {
  @apply flex flex-col items-center gap-1 rounded border border-white/10 bg-white/[0.03] p-2;
}
.spc__nudge-label {
  @apply self-start font-mono text-[0.6rem] uppercase tracking-wider text-slate-500;
}
.spc__pad {
  @apply flex flex-col items-center gap-1;
}
.spc__pad-mid {
  @apply flex items-center gap-1;
}
.spc__pad-btn {
  @apply h-8 w-8 rounded border border-cyan-400/35 bg-cyan-500/15 text-sm text-cyan-100 hover:bg-cyan-500/30;
}
.spc__pad-btn--ghost {
  @apply border-white/15 bg-white/5 text-slate-200 hover:bg-white/10;
}
.spc__pad-btn--step {
  @apply w-12 font-mono text-[0.65rem];
}
.spc__nudge-tip {
  @apply text-center text-[0.6rem] text-slate-600;
}
.spc__meta {
  @apply font-mono text-[0.6rem] text-slate-500;
}
.spc__tabs {
  @apply flex gap-1;
}
.spc__tab {
  @apply flex-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[0.7rem] text-slate-400 hover:bg-white/10;
}
.spc__tab--on {
  @apply border-cyan-400/50 bg-cyan-500/20 text-cyan-100;
}
.spc__tab--auto.spc__tab--on {
  @apply border-emerald-400/50 bg-emerald-500/25 text-emerald-50;
}
.spc__orient {
  @apply flex gap-1.5;
}
.spc__foot {
  @apply flex gap-1.5;
}
.spc__btn {
  @apply flex-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[0.72rem] text-slate-300 hover:bg-white/10;
}
.spc__btn--on {
  @apply border-cyan-400/50 bg-cyan-500/20 text-cyan-100;
}
.spc__btn--ok {
  @apply border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25;
}
</style>
