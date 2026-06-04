<template>
  <canvas
    ref="canvasRef"
    class="draw-canvas"
    :class="{ readonly: readonly }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="endStroke"
    @pointerleave="endStroke"
    @pointercancel="endStroke"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { DrawStroke } from '@/draw/types'

const props = withDefaults(
  defineProps<{
    strokes?: DrawStroke[]
    previewStroke?: DrawStroke | null
    color?: string
    lineWidth?: number
    eraser?: boolean
    readonly?: boolean
  }>(),
  {
    strokes: () => [],
    previewStroke: null,
    color: '#e8f4ff',
    lineWidth: 4,
    eraser: false,
    readonly: false,
  },
)

const emit = defineEmits<{
  'update:strokes': [strokes: DrawStroke[]]
  progress: [stroke: DrawStroke | null]
}>()

const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let drawing = false
let activeStroke: DrawStroke | null = null
let resizeObserver: ResizeObserver | null = null
let lastProgressEmit = 0

function canvasSize() {
  const canvas = canvasRef.value
  if (!canvas) return { width: 1, height: 1 }
  const rect = canvas.getBoundingClientRect()
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
  }
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas || !ctx) return

  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const nextW = Math.max(1, Math.floor(rect.width * dpr))
  const nextH = Math.max(1, Math.floor(rect.height * dpr))

  if (canvas.width === nextW && canvas.height === nextH) return

  canvas.width = nextW
  canvas.height = nextH
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  redraw()
}

function paintBackground() {
  if (!ctx) return
  const { width, height } = canvasSize()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#0a1018'
  ctx.fillRect(0, 0, width, height)
}

function drawStroke(stroke: DrawStroke) {
  if (!ctx || stroke.points.length < 2) return

  const { width, height } = canvasSize()

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = stroke.lineWidth

  if (stroke.eraser) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = stroke.color
  }

  ctx.beginPath()
  ctx.moveTo(stroke.points[0]! * width, stroke.points[1]! * height)
  for (let i = 2; i < stroke.points.length; i += 2) {
    ctx.lineTo(stroke.points[i]! * width, stroke.points[i + 1]! * height)
  }
  ctx.stroke()
}

function redraw() {
  if (!ctx) return
  paintBackground()
  props.strokes.forEach(drawStroke)
  if (activeStroke) drawStroke(activeStroke)
  else if (props.previewStroke) drawStroke(props.previewStroke)
}

function getPos(e: PointerEvent) {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const w = Math.max(rect.width, 1)
  const h = Math.max(rect.height, 1)
  return {
    x: (e.clientX - rect.left) / w,
    y: (e.clientY - rect.top) / h,
  }
}

function emitProgress() {
  const now = performance.now()
  if (now - lastProgressEmit < 40) return
  lastProgressEmit = now
  emit('progress', activeStroke ? { ...activeStroke, points: [...activeStroke.points] } : null)
}

function onPointerDown(e: PointerEvent) {
  if (props.readonly || !ctx) return
  drawing = true
  canvasRef.value?.setPointerCapture(e.pointerId)
  const { x, y } = getPos(e)
  activeStroke = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    points: [x, y, x, y],
    color: props.color,
    lineWidth: props.lineWidth,
    eraser: props.eraser,
  }
  redraw()
  emitProgress()
}

function onPointerMove(e: PointerEvent) {
  if (!drawing || props.readonly || !ctx || !activeStroke) return
  const { x, y } = getPos(e)
  activeStroke.points.push(x, y)
  redraw()
  emitProgress()
}

function endStroke(e: PointerEvent) {
  if (!drawing || !activeStroke) return
  drawing = false
  canvasRef.value?.releasePointerCapture(e.pointerId)
  emit('update:strokes', [...props.strokes, activeStroke])
  activeStroke = null
  emit('progress', null)
}

function clear() {
  emit('update:strokes', [])
  emit('progress', null)
}

function undo() {
  if (props.strokes.length === 0) return
  emit('update:strokes', props.strokes.slice(0, -1))
}

function resetCanvas() {
  activeStroke = null
  emit('update:strokes', [])
  emit('progress', null)
}

watch(
  () => [props.strokes, props.previewStroke],
  () => {
    if (!drawing) redraw()
  },
  { deep: true },
)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  resize()

  resizeObserver = new ResizeObserver(() => resize())
  resizeObserver.observe(canvas)
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

defineExpose({ clear, undo, resetCanvas, resize })
</script>

<style scoped>
.draw-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
  border-radius: 12px;
}

.draw-canvas.readonly {
  cursor: default;
}
</style>
