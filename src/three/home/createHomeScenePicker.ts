import * as THREE from 'three'
import type { HomeToolId } from './homeToolIds'
import { isCoarsePointer } from '@/utils/device'

type PickTarget = { kind: 'tool'; id: HomeToolId } | { kind: 'toolbox' } | null

interface DragState {
  pointerId: number
  x: number
  y: number
  moved: boolean
  pointerType: string
  target: PickTarget
}

function isPrimaryPointer(e: PointerEvent): boolean {
  return e.pointerType !== 'mouse' || e.button === 0
}

function dragThreshold(pointerType: string): number {
  return pointerType === 'touch' ? 10 : 4
}

export interface HomeScenePickerHandle {
  dispose: () => void
  syncTouchAction: () => void
}

/** Canvas 射线检测 — 事件直接绑在 3D 模型上 */
export function createHomeScenePicker(options: {
  domElement: HTMLCanvasElement
  camera: THREE.Camera
  getToolboxPickables: () => THREE.Object3D[]
  getToolPickables: () => THREE.Object3D[]
  getToolIdFromObject: (obj: THREE.Object3D) => HomeToolId | null
  isExpanded: () => boolean
  onToggleToolbox: () => void
  onCloseToolbox: () => void
  onSelectTool: (id: HomeToolId) => void
  onHoverTool: (id: HomeToolId | null) => void
  onHoverToolbox: (hovered: boolean) => void
  onOrbitDrag: (dx: number, dy: number) => void
}): HomeScenePickerHandle {
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let drag: DragState | null = null
  let hoverFrame = 0
  let pendingHoverEvent: PointerEvent | null = null

  const coarsePointer = isCoarsePointer()
  const syncTouchAction = () => {
    options.domElement.style.touchAction = options.isExpanded() ? 'none' : 'pan-y'
  }
  syncTouchAction()

  const canvasRect = () => options.domElement.getBoundingClientRect()

  const setPointer = (e: PointerEvent) => {
    const rect = canvasRect()
    const w = Math.max(rect.width, 1)
    const h = Math.max(rect.height, 1)
    pointer.x = ((e.clientX - rect.left) / w) * 2 - 1
    pointer.y = -((e.clientY - rect.top) / h) * 2 + 1
  }

  const raycastPick = (): PickTarget => {
    raycaster.setFromCamera(pointer, options.camera)

    if (options.isExpanded()) {
      const toolHits = raycaster.intersectObjects(options.getToolPickables(), true)
      if (toolHits.length > 0) {
        const hit = toolHits[0]
        if (hit) {
          const id = options.getToolIdFromObject(hit.object)
          if (id) return { kind: 'tool', id }
        }
      }
    }

    const boxHits = raycaster.intersectObjects(options.getToolboxPickables(), true)
    if (boxHits.length > 0) return { kind: 'toolbox' }

    return null
  }

  const applyHover = (target: PickTarget) => {
    if (target?.kind === 'tool') {
      options.onHoverTool(target.id)
      options.onHoverToolbox(false)
      return
    }
    if (target?.kind === 'toolbox') {
      options.onHoverTool(null)
      options.onHoverToolbox(true)
      return
    }
    options.onHoverTool(null)
    options.onHoverToolbox(false)
  }

  const runHoverPick = () => {
    hoverFrame = 0
    if (!pendingHoverEvent || drag) return
    setPointer(pendingHoverEvent)
    applyHover(raycastPick())
  }

  const scheduleHoverPick = (e: PointerEvent) => {
    pendingHoverEvent = e
    if (hoverFrame !== 0) return
    hoverFrame = requestAnimationFrame(runHoverPick)
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!isPrimaryPointer(e)) return
    setPointer(e)
    const target = raycastPick()
    drag = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      moved: false,
      pointerType: e.pointerType,
      target,
    }
    options.domElement.setPointerCapture(e.pointerId)
    applyHover(target)
  }

  const onPointerMove = (e: PointerEvent) => {
    setPointer(e)

    if (drag && drag.pointerId === e.pointerId) {
      const dx = e.clientX - drag.x
      const dy = e.clientY - drag.y
      if (Math.abs(dx) + Math.abs(dy) > dragThreshold(drag.pointerType)) {
        drag.moved = true
      }
      if (drag.moved && options.isExpanded() && drag.target) {
        e.preventDefault()
        options.onOrbitDrag(dx, dy)
        drag.x = e.clientX
        drag.y = e.clientY
      }
      return
    }

    if (!coarsePointer) {
      scheduleHoverPick(e)
    }
  }

  const finishPointer = (e: PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) return
    options.domElement.releasePointerCapture(e.pointerId)

    const { moved, target } = drag
    drag = null

    if (moved) return

    if (target?.kind === 'tool') {
      options.onSelectTool(target.id)
      return
    }
    if (target?.kind === 'toolbox') {
      if (options.isExpanded()) options.onCloseToolbox()
      else {
        options.onToggleToolbox()
        syncTouchAction()
      }
      return
    }
    if (options.isExpanded()) options.onCloseToolbox()
  }

  const onPointerUp = (e: PointerEvent) => finishPointer(e)

  const onPointerCancel = (e: PointerEvent) => {
    if (!drag || drag.pointerId !== e.pointerId) return
    options.domElement.releasePointerCapture(e.pointerId)
    drag = null
  }

  options.domElement.addEventListener('pointerdown', onPointerDown)
  options.domElement.addEventListener('pointermove', onPointerMove, { passive: false })
  options.domElement.addEventListener('pointerup', onPointerUp)
  options.domElement.addEventListener('pointercancel', onPointerCancel)

  return {
    syncTouchAction,
    dispose: () => {
      if (hoverFrame !== 0) cancelAnimationFrame(hoverFrame)
      options.domElement.removeEventListener('pointerdown', onPointerDown)
      options.domElement.removeEventListener('pointermove', onPointerMove)
      options.domElement.removeEventListener('pointerup', onPointerUp)
      options.domElement.removeEventListener('pointercancel', onPointerCancel)
    },
  }
}
