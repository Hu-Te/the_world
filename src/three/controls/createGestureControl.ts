import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { isCameraContextAvailable } from '../../utils/camera'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

type Landmark = { x: number; y: number; z: number }

export interface GestureControlOptions {
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  previewContainer?: HTMLElement
}

export interface GestureControlHandle {
  start: () => Promise<void>
  stop: () => void
  toggle: () => Promise<void>
  isActive: () => boolean
  dispose: () => void
}

interface HandSample {
  x: number
  y: number
  pinch: number
}

async function loadMediaPipe() {
  return import('@mediapipe/tasks-vision')
}

function dist3(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

function sampleHand(landmarks: Landmark[]): HandSample {
  const wrist = landmarks[0]!
  const indexMcp = landmarks[5]!
  const middleMcp = landmarks[9]!
  const x = 1 - (wrist.x + indexMcp.x + middleMcp.x) / 3
  const y = (wrist.y + indexMcp.y + middleMcp.y) / 3
  const pinch = dist3(landmarks[4]!, landmarks[8]!)
  return { x, y, pinch }
}

/** Google MediaPipe 手势 → OrbitControls 相机控制 */
export function createGestureControl(options: GestureControlOptions): GestureControlHandle {
  const { camera, controls } = options

  let landmarker: Awaited<
    ReturnType<Awaited<ReturnType<typeof loadMediaPipe>>['HandLandmarker']['createFromOptions']>
  > | null = null
  let video: HTMLVideoElement | null = null
  let previewWrap: HTMLDivElement | null = null
  let stream: MediaStream | null = null
  let rafId = 0
  let active = false
  let lastVideoTime = -1
  let prevSample: HandSample | null = null
  let autoRotateBefore = false

  const spherical = new THREE.Spherical()
  const offset = new THREE.Vector3()

  function ensurePreview(): HTMLDivElement {
    if (previewWrap) return previewWrap

    const wrap = document.createElement('div')
    wrap.className = 'gesture-preview'
    wrap.style.display = 'none'
    wrap.innerHTML =
      '<span class="gesture-preview-label">手势预览</span><span class="gesture-preview-hint">移动手掌旋转 · 捏合缩放</span><span class="gesture-preview-status">等待识别…</span>'

    const target = options.previewContainer ?? document.body
    target.appendChild(wrap)
    previewWrap = wrap
    return wrap
  }

  function setPreviewStatus(text: string): void {
    previewWrap
      ?.querySelector('.gesture-preview-status')
      ?.replaceChildren(document.createTextNode(text))
  }

  async function bindVideoStream(v: HTMLVideoElement, mediaStream: MediaStream): Promise<void> {
    v.srcObject = mediaStream
    v.autoplay = true
    v.muted = true
    v.playsInline = true
    v.setAttribute('playsinline', 'true')
    v.setAttribute('webkit-playsinline', 'true')

    await new Promise<void>((resolve, reject) => {
      v.onloadedmetadata = () => resolve()
      v.onerror = () => reject(new Error('摄像头画面加载失败'))
    })

    await v.play()
  }

  async function initLandmarker(): Promise<void> {
    if (landmarker) return

    const { FilesetResolver, HandLandmarker } = await loadMediaPipe()
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE)
    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
    })
  }

  function applyGesture(sample: HandSample): void {
    if (!prevSample) {
      prevSample = sample
      return
    }

    const dx = sample.x - prevSample.x
    const dy = sample.y - prevSample.y
    const dPinch = sample.pinch - prevSample.pinch
    prevSample = sample

    offset.copy(camera.position).sub(controls.target)
    spherical.setFromVector3(offset)

    spherical.theta -= dx * 2.8
    spherical.phi += dy * 2.2
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.25, Math.PI / 2.05)

    const pinchFactor = 1 - dPinch * 4.5
    spherical.radius = THREE.MathUtils.clamp(
      spherical.radius * THREE.MathUtils.clamp(pinchFactor, 0.92, 1.08),
      controls.minDistance,
      controls.maxDistance,
    )

    offset.setFromSpherical(spherical)
    camera.position.copy(controls.target).add(offset)
    controls.update()
  }

  function detectLoop(): void {
    if (!active || !landmarker || !video) return

    rafId = requestAnimationFrame(detectLoop)

    if (video.readyState < 2 || video.currentTime === lastVideoTime) return
    lastVideoTime = video.currentTime

    const result = landmarker.detectForVideo(video, performance.now())
    if (!result.landmarks.length) {
      prevSample = null
      setPreviewStatus('请将手掌放入画面')
      return
    }

    setPreviewStatus('识别中')
    applyGesture(sampleHand(result.landmarks[0]!))
  }

  async function start(): Promise<void> {
    if (active) return

    if (!isCameraContextAvailable()) {
      throw new DOMException('Camera requires secure context', 'SecurityError')
    }

    await initLandmarker()

    const wrap = ensurePreview()
    wrap.style.display = 'block'

    video = document.createElement('video')
    video.className = 'gesture-preview-video'
    wrap.appendChild(video)

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })

    await bindVideoStream(video, stream)
    setPreviewStatus('请将手掌放入画面')

    autoRotateBefore = controls.autoRotate
    controls.autoRotate = false
    controls.enabled = false
    prevSample = null
    active = true
    detectLoop()
  }

  function stop(): void {
    if (!active) return

    active = false
    cancelAnimationFrame(rafId)
    prevSample = null
    controls.enabled = true
    controls.autoRotate = autoRotateBefore

    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      stream = null
    }

    if (video) {
      video.pause()
      video.srcObject = null
      video.remove()
      video = null
    }

    if (previewWrap) {
      previewWrap.style.display = 'none'
    }

    lastVideoTime = -1
  }

  async function toggle(): Promise<void> {
    if (active) {
      stop()
    } else {
      await start()
    }
  }

  function dispose(): void {
    stop()
    landmarker?.close()
    landmarker = null
    previewWrap?.remove()
    previewWrap = null
  }

  return {
    start,
    stop,
    toggle,
    isActive: () => active,
    dispose,
  }
}
