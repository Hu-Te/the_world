import * as THREE from 'three'
import { createRenderer } from '../core/createRenderer'
import { createSciFiScene, CORE_X, CORE_Y, CORE_Z } from './createSciFiScene'
import { tryLoadHomeHeroGlb } from './loadHomeHeroGlb'
import { createSciFiPostProcessing } from './createSciFiPostProcessing'
import { createHomeToolModels, TOOL_RING_DEFAULT_TILT_X } from './createHomeToolModels'
import type { HomeToolId } from './homeToolIds'
import { createHomeScenePicker } from './createHomeScenePicker'
import { createHomeToolLabels } from './createHomeToolLabels'
import type { Disposer } from '../types'
import { debounce, rafThrottle } from '@/utils/schedule'
import { lockPageScroll, resetPageScrollLock, unlockPageScroll } from '@/utils/scrollLock'
import {
  getDevicePixelRatioCap,
  getToolboxNdc,
  isCoarsePointer,
  isMobileViewport,
} from '@/utils/device'

export type { HomeToolId } from './homeToolIds'

export interface HomeSceneHandle {
  dispose: Disposer
  onToolsExpanded: (cb: (expanded: boolean) => void) => () => void
  onToolSelect: (cb: (toolId: HomeToolId) => void) => () => void
}

const viewportAnchor = new THREE.Vector3()
const viewportDir = new THREE.Vector3()

function readToolboxNdc() {
  return getToolboxNdc()
}

function placeViewportAnchor(
  object: THREE.Object3D,
  camera: THREE.PerspectiveCamera,
  ndcX: number,
  ndcY: number,
  distance: number,
) {
  viewportAnchor.set(ndcX, ndcY, 0.5).unproject(camera)
  viewportDir.copy(viewportAnchor).sub(camera.position).normalize()
  object.position.copy(camera.position).addScaledVector(viewportDir, distance)
  object.quaternion.copy(camera.quaternion)
  object.rotateY(-Math.PI * 0.12)
  object.rotateX(0.08)
}

function setBodyScrollLock(locked: boolean) {
  if (locked) lockPageScroll()
  else unlockPageScroll()
}

/** 科幻风首页 3D 背景 */
export function mountHomeScene(container: HTMLElement): HomeSceneHandle {
  const width = Math.max(container.clientWidth, 1)
  const height = Math.max(container.clientHeight, 1)
  const mobile = isMobileViewport()
  const coarsePointer = isCoarsePointer()
  const pixelRatio = getDevicePixelRatioCap()

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x03060c)
  scene.fog = new THREE.FogExp2(0x03060c, 0.006)

  const camera = new THREE.PerspectiveCamera(mobile ? 42 : 40, width / height, 0.1, 500)

  const renderer = createRenderer({ width, height, pixelRatio })
  renderer.toneMappingExposure = mobile ? 0.98 : 1.02
  container.appendChild(renderer.domElement)

  scene.add(new THREE.AmbientLight(0x2a3848, 0.5))
  scene.add(new THREE.HemisphereLight(0x5098b0, 0x080c14, 0.42))

  const sciFi = createSciFiScene({ scene, renderer })
  scene.add(sciFi.group)
  void tryLoadHomeHeroGlb(sciFi.hero)

  const tools = createHomeToolModels(scene.environment)
  sciFi.group.remove(sciFi.toolbox)
  scene.add(sciFi.toolbox)
  sciFi.toolbox.add(tools.group)

  const toolboxWorldPos = new THREE.Vector3()
  const toolboxFill = new THREE.PointLight(0x7a98a8, 3.2, 8)
  scene.add(toolboxFill)

  const postProcessing = createSciFiPostProcessing(renderer, scene, camera, width, height, {
    mobile,
  })
  const toolLabels = createHomeToolLabels()

  const toolListeners = new Set<(toolId: HomeToolId) => void>()
  const expandListeners = new Set<(expanded: boolean) => void>()

  let pointerX = 0
  let pointerY = 0
  let targetX = 0
  let targetY = 0
  let pendingPointerX = 0
  let pendingPointerY = 0
  let visible = !document.hidden
  let inViewport = true
  let toolsExpanded = false
  let hoveredTool: HomeToolId | null = null
  let toolboxHovered = false
  let orbitRotY = 0
  let orbitRotX = TOOL_RING_DEFAULT_TILT_X

  const focus = new THREE.Vector3(CORE_X, CORE_Y, CORE_Z)

  const canvasRect = () => renderer.domElement.getBoundingClientRect()

  const setToolsExpanded = (expanded: boolean) => {
    if (toolsExpanded === expanded) return
    toolsExpanded = expanded
    tools.setExpanded(expanded)
    sciFi.toolboxHandle.setExpanded(expanded)
    tools.setGlowIntensity(expanded ? 2.8 : 0)
    toolboxFill.intensity = expanded ? 4.2 : 3.6
    setBodyScrollLock(expanded)
    picker.syncTouchAction()
    expandListeners.forEach((cb) => cb(expanded))
    if (!expanded) {
      hoveredTool = null
      tools.setHovered(null)
      orbitRotY = 0
      orbitRotX = TOOL_RING_DEFAULT_TILT_X
      tools.resetOrbitRotation()
    }
  }

  const setToolHover = (toolId: HomeToolId | null) => {
    if (hoveredTool === toolId) return
    hoveredTool = toolId
    tools.setHovered(toolId)
  }

  const setToolboxHover = (hovered: boolean) => {
    if (toolboxHovered === hovered) return
    toolboxHovered = hovered
    sciFi.toolboxHandle.setHovered(hovered && !hoveredTool)
  }

  const picker = createHomeScenePicker({
    domElement: renderer.domElement,
    camera,
    getToolboxPickables: () => sciFi.toolboxHandle.getPickMeshes(),
    getToolPickables: () => tools.getPickMeshes(),
    getToolIdFromObject: tools.getToolIdFromObject,
    isExpanded: () => toolsExpanded,
    onToggleToolbox: () => setToolsExpanded(!toolsExpanded),
    onCloseToolbox: () => setToolsExpanded(false),
    onSelectTool: (id) => toolListeners.forEach((cb) => cb(id)),
    onHoverTool: setToolHover,
    onHoverToolbox: setToolboxHover,
    onOrbitDrag: (dx, dy) => {
      if (!toolsExpanded) return
      const touchScale = coarsePointer ? 1.35 : 1
      orbitRotY += dx * 0.012 * touchScale
      orbitRotX = THREE.MathUtils.clamp(
        orbitRotX + dy * 0.007 * touchScale,
        0.18,
        1.08,
      )
      tools.setOrbitRotation(orbitRotY, orbitRotX)
    },
  })

  const applyPointerParallax = () => {
    pointerX = pendingPointerX
    pointerY = pendingPointerY
  }
  const onPointerMove = rafThrottle(applyPointerParallax)

  const trackPointer = (e: PointerEvent) => {
    pendingPointerX = (e.clientX / window.innerWidth - 0.5) * 2
    pendingPointerY = (e.clientY / window.innerHeight - 0.5) * 2
    onPointerMove()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && toolsExpanded) setToolsExpanded(false)
  }

  const onVisibility = () => {
    visible = !document.hidden
  }

  if (!coarsePointer) {
    document.addEventListener('pointermove', trackPointer, { passive: true })
  }

  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('visibilitychange', onVisibility)

  let animationId = 0
  const startTime = performance.now()
  let lastFrame = startTime

  const render = () => {
    animationId = requestAnimationFrame(render)
    if (!visible || !inViewport) return

    const now = performance.now()
    const delta = Math.max(Math.min((now - lastFrame) / 1000, 0.05), 1 / 120)
    lastFrame = now
    const elapsed = (now - startTime) / 1000

    targetX += (pointerX - targetX) * 0.028
    targetY += (pointerY - targetY) * 0.028

    const orbitRadius = mobile ? 34 : 37
    const baseAngle = 0.42
    const lookY = focus.y + targetY * 1.2
    const toolboxNdc = readToolboxNdc()

    camera.position.x = focus.x + Math.sin(baseAngle) * orbitRadius + targetX * 2.5
    camera.position.z = focus.z + Math.cos(baseAngle) * orbitRadius + (mobile ? 27 : 29)
    camera.position.y = (mobile ? 11.5 : 12.5) + targetY * 2 + Math.sin(elapsed * 0.3) * 0.2
    camera.lookAt(focus.x + targetX * 1.5, lookY, focus.z)

    placeViewportAnchor(sciFi.toolbox, camera, toolboxNdc.x, toolboxNdc.y, mobile ? 9.5 : 10.5)

    sciFi.toolbox.getWorldPosition(toolboxWorldPos)
    toolboxFill.position.copy(toolboxWorldPos).add(new THREE.Vector3(0.35, 1.05, 0.75))

    sciFi.core.position.y = focus.y + Math.sin(elapsed * 0.5) * 0.12
    sciFi.update(elapsed, delta, targetX, targetY)
    tools.update(elapsed, delta)

    const labelTargets = toolsExpanded ? tools.getScreenTargets(camera, canvasRect()) : []
    toolLabels.update(toolsExpanded, hoveredTool, labelTargets)

    postProcessing.composer.render()
  }
  render()

  const resizeScene = () => {
    const w = Math.max(container.clientWidth, 1)
    const h = Math.max(container.clientHeight, 1)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setPixelRatio(getDevicePixelRatioCap())
    renderer.setSize(w, h)
    postProcessing.resize(w, h)
  }
  const onResize = debounce(resizeScene, 120)

  const resizeObserver = new ResizeObserver(() => onResize())
  resizeObserver.observe(container)

  const onVisualViewportChange = debounce(resizeScene, 120)
  window.visualViewport?.addEventListener('resize', onVisualViewportChange)
  window.visualViewport?.addEventListener('scroll', onVisualViewportChange)

  const intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      inViewport = entry?.isIntersecting ?? true
    },
    { root: null, threshold: 0.05 },
  )
  intersectionObserver.observe(container)

  return {
    onToolsExpanded: (cb) => {
      expandListeners.add(cb)
      return () => expandListeners.delete(cb)
    },
    onToolSelect: (cb) => {
      toolListeners.add(cb)
      return () => toolListeners.delete(cb)
    },
    dispose: () => {
      cancelAnimationFrame(animationId)
      toolListeners.clear()
      expandListeners.clear()
      picker.dispose()
      toolLabels.dispose()
      onPointerMove.cancel()
      onResize.cancel()
      window.visualViewport?.removeEventListener('resize', onVisualViewportChange)
      window.visualViewport?.removeEventListener('scroll', onVisualViewportChange)
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      setBodyScrollLock(false)
      resetPageScrollLock()
      document.documentElement.style.overscrollBehavior = ''
      if (!coarsePointer) {
        document.removeEventListener('pointermove', trackPointer)
      }
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibility)

      tools.dispose()
      sciFi.dispose()
      postProcessing.dispose()

      scene.environment = null
      renderer.dispose()

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    },
  }
}
