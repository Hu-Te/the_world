/**
 * 软包装贴图
 *
 * 模式 A — 仅正面（默认推荐）：框 FRONT 95×90 → 铺满软砖正面
 * 模式 B — 全膜展开：框一整条 seal|side|face|… → 按刀模毫米映射
 */

import * as THREE from 'three'
import {
  filmGussetDepthMm,
  normalizeSoftPackDims,
  type SoftPackDims,
} from '~/utils/pack3d/softPackMesh'
import {
  autoCropAllPanels,
  ensureFrontIsVivid,
  insetRect,
  resolvePanelCrop,
  type SoftPackCropRect,
} from '~/utils/pack3d/softPackCrop'

export type { SoftPackCropRect }

export type SoftPackTexOrient = {
  flipU: boolean
  flipV: boolean
}

export type SoftPackTexMode = 'fullWrap' | 'panels' | 'autoFilm'

export const DEFAULT_TEX_ORIENT: SoftPackTexOrient = {
  flipU: false,
  flipV: false,
}

export type SoftPackUnfoldParams = {
  totalWidth: number
  seal: number
  side: number
  face: number
  backSeal: number
  height: number
  depth: number
  productType?: string
  filmLayout?: SoftPackFilmLayout
}

export type CompositeTexParams = {
  total_width: number
  seal: number
  side: number
  face: number
  height: number
  back_seal?: number
}

export type CompositeCrops = {
  frontImg?: CanvasImageSource | null
  backImg?: CanvasImageSource | null
  /** 整条展开图：铺满画布，不再塞正面槽 */
  fullWrapImg?: CanvasImageSource | null
}

export function toUnfoldParams(
  dims: SoftPackDims & { height?: number },
  heightFallback = 90,
): SoftPackUnfoldParams {
  const d = normalizeSoftPackDims(dims)
  const height = d.height ?? heightFallback
  const film = d.filmLayout
  const depth =
    filmGussetDepthMm(film, 0) ||
    (d.maxHalfDepth && d.maxHalfDepth > 0
      ? d.maxHalfDepth * 2
      : Math.max(16, d.sideWidth * 2))
  return {
    totalWidth: d.totalWidth > 0 ? d.totalWidth : 177,
    seal: d.sealWidth > 0 ? d.sealWidth : 10,
    side: d.sideWidth > 0 ? d.sideWidth : 21,
    face: d.mainFaceWidth > 0 ? d.mainFaceWidth : 95,
    backSeal: d.backSealWidth > 0 ? d.backSealWidth : 20,
    height,
    depth,
    productType: d.productType,
    filmLayout: film,
  }
}

/** 裁剪框比例是否接近「全膜横条」total/height（如 177/90） */
export function isFullWrapCropAspect(
  cropW: number,
  cropH: number,
  totalWidth: number,
  height: number,
): boolean {
  if (cropH < 2) return false
  const got = cropW / cropH
  const want = totalWidth / Math.max(1e-6, height)
  return Math.abs(got - want) / want < 0.28
}

function makeVirtualCanvas(totalWidth: number, height: number) {
  const scale = 10
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(totalWidth * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 不可用')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return { canvas, ctx, scale }
}

function drawOriented(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  orient: SoftPackTexOrient,
) {
  ctx.save()
  const ox = dx + (orient.flipU ? dw : 0)
  const oy = dy + (orient.flipV ? dh : 0)
  ctx.translate(ox, oy)
  ctx.scale(orient.flipU ? -1 : 1, orient.flipV ? -1 : 1)
  ctx.drawImage(img, 0, 0, dw, dh)
  ctx.restore()
}

function finishTexture(
  canvas: HTMLCanvasElement,
  userData: Record<string, unknown>,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  // 关闭 mipmap：边缘不再与透明/邻色混出假刀模线
  tex.generateMipmaps = false
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = 4
  tex.flipY = false
  tex.needsUpdate = true
  ;(tex as THREE.Texture & { userData: Record<string, unknown> }).userData = userData
  return tex
}

/**
 * 全膜一键：裁剪图平铺铺满 1770×900，不做插槽偏移。
 */
export function createFullWrapTexture(
  params: CompositeTexParams,
  fullWrapImage: CanvasImageSource,
  orient: SoftPackTexOrient = DEFAULT_TEX_ORIENT,
): THREE.CanvasTexture {
  const totalWidth = params.total_width > 0 ? params.total_width : 177
  const height = params.height > 0 ? params.height : 90
  const { canvas, ctx } = makeVirtualCanvas(totalWidth, height)

  drawOriented(ctx, fullWrapImage, 0, 0, canvas.width, canvas.height, orient)

  return finishTexture(canvas, {
    mode: 'fullWrap',
    totalWidth,
    height,
  })
}

/**
 * 分面拼贴：正面写入 (seal+side) 槽；背面可选。
 */
export function createPanelCompositeTexture(
  params: CompositeTexParams,
  crops: { frontImg: CanvasImageSource; backImg?: CanvasImageSource | null },
  orient: SoftPackTexOrient = DEFAULT_TEX_ORIENT,
): THREE.CanvasTexture {
  const totalWidth = params.total_width > 0 ? params.total_width : 177
  const height = params.height > 0 ? params.height : 90
  const seal = params.seal >= 0 ? params.seal : 10
  const side = params.side >= 0 ? params.side : 21
  const face = params.face > 0 ? params.face : 95
  const backSeal =
    params.back_seal != null && params.back_seal >= 0
      ? params.back_seal
      : Math.max(0, totalWidth - seal * 2 - side * 2 - face)

  const { canvas, ctx, scale } = makeVirtualCanvas(totalWidth, height)
  const startX = (seal + side) * scale
  const drawWidth = face * scale
  drawOriented(ctx, crops.frontImg, startX, 0, drawWidth, canvas.height, orient)

  if (crops.backImg) {
    const backX = (seal + side + face + side + seal) * scale
    const backW = Math.max(1, backSeal * scale)
    drawOriented(ctx, crops.backImg, backX, 0, backW, canvas.height, orient)
  }

  return finishTexture(canvas, {
    mode: 'panels',
    uFace0: (seal + side) / totalWidth,
    uFace1: (seal + side + face) / totalWidth,
    totalWidth,
    face,
    seal,
    side,
  })
}

/** @deprecated 兼容旧名 → 自动判断 full / panels */
export function createCompositeTexture(
  params: CompositeTexParams,
  crops: CompositeCrops,
  orient: SoftPackTexOrient = DEFAULT_TEX_ORIENT,
): THREE.CanvasTexture {
  if (crops.fullWrapImg) {
    return createFullWrapTexture(params, crops.fullWrapImg, orient)
  }
  if (crops.frontImg) {
    return createPanelCompositeTexture(
      params,
      { frontImg: crops.frontImg, backImg: crops.backImg },
      orient,
    )
  }
  throw new Error('createCompositeTexture: 缺少 fullWrapImg 或 frontImg')
}

export async function cropToCanvas(
  image: HTMLImageElement,
  crop: SoftPackCropRect,
  insetRatio = 0.03,
): Promise<HTMLCanvasElement> {
  const iw = image.naturalWidth || image.width
  const ih = image.naturalHeight || image.height

  // 整数收紧：框外 1px 刀模线会被 drawImage 双线性滤波渗进贴图底边
  const padX = Math.max(1, Math.ceil(crop.cropWidth * insetRatio))
  const padY = Math.max(2, Math.ceil(crop.cropHeight * insetRatio))
  const padBottom = padY + Math.max(1, Math.ceil(crop.cropHeight * 0.015))

  let sx = Math.ceil(crop.startX + padX)
  let sy = Math.ceil(crop.startY + padY)
  let ex = Math.floor(crop.startX + crop.cropWidth - padX)
  let ey = Math.floor(crop.startY + crop.cropHeight - padBottom)
  sx = Math.max(0, Math.min(sx, iw - 1))
  sy = Math.max(0, Math.min(sy, ih - 1))
  ex = Math.max(sx + 1, Math.min(ex, iw))
  ey = Math.max(sy + 1, Math.min(ey, ih))
  const sw = ex - sx
  const sh = ey - sy

  const c = document.createElement('canvas')
  c.width = Math.max(64, sw)
  c.height = Math.max(64, sh)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 不可用')
  // 关闭平滑，按像素拷贝，避免再从源图邻域「吸」进框外墨线
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, c.width, c.height)
  return c
}

/**
 * 整张刀膜纹理（autoFilm）：按 filmLayout 毫米铺满画布。
 */
export function createFullFilmTexture(
  filmImage: CanvasImageSource,
  filmWidthMm: number,
  filmHeightMm: number,
  orient: SoftPackTexOrient = DEFAULT_TEX_ORIENT,
): THREE.CanvasTexture {
  const { canvas, ctx } = makeVirtualCanvas(
    filmWidthMm > 0 ? filmWidthMm : 177,
    filmHeightMm > 0 ? filmHeightMm : 264,
  )
  drawOriented(ctx, filmImage, 0, 0, canvas.width, canvas.height, orient)
  return finishTexture(canvas, {
    mode: 'autoFilm',
    filmWidth: filmWidthMm,
    filmHeight: filmHeightMm,
  })
}

/**
 * 按刀模网格 UV（整膜纹理用）：
 * 机身+封翅只采 FRONT 正栏（95）拉伸铺满，不再从刀模左边「封|侧」起算
 * （否则会把侧栏红线/错位图案贴到正面）。
 * 背面采 BACK 正栏。
 */
export function updateGeometryUVsFromFilm(
  geometry: THREE.BufferGeometry,
  params: SoftPackUnfoldParams,
): void {
  const pos = geometry.attributes.position as THREE.BufferAttribute
  if (!pos) return
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return

  const ud = geometry.userData as {
    halfFace?: number
    halfH?: number
    halfDMax?: number
    seal?: number
    totalW?: number
  }

  const film = params.filmLayout
  const horiz = film?.horizontalMm?.length ? film.horizontalMm : [10, 21, 95, 21, 10, 20]
  const vert = film?.verticalMm?.length ? film.verticalMm : [90, 42, 90, 42]
  const roles = film?.verticalRoles?.length
    ? film.verticalRoles
    : ['BACK', 'GUSSET', 'FRONT', 'GUSSET']
  const sumH = Math.max(
    1e-6,
    horiz.reduce((a, b) => a + b, 0),
  )
  const sumV = Math.max(
    1e-6,
    vert.reduce((a, b) => a + b, 0),
  )

  const sealMm = horiz[0] ?? params.seal
  const sideMm = horiz[1] ?? params.side
  const faceMm = horiz[2] ?? params.face
  const faceX0 = sealMm + sideMm

  let frontY0 = 0
  let frontH = params.height
  let backY0 = 0
  let backH = params.height
  let yAcc = 0
  for (let i = 0; i < vert.length; i++) {
    const role = String(roles[i] || '').toUpperCase()
    const h = vert[i] ?? 0
    if (role === 'FRONT') {
      frontY0 = yAcc
      frontH = h
    }
    if (role === 'BACK') {
      backY0 = yAcc
      backH = h
    }
    yAcc += h
  }

  const cx = (box.max.x + box.min.x) * 0.5
  const cy = (box.max.y + box.min.y) * 0.5
  const cz = (box.max.z + box.min.z) * 0.5
  const halfFace = Math.max(1e-6, ud.halfFace ?? faceMm * 0.5)
  const halfH = Math.max(1e-6, ud.halfH ?? params.height * 0.5)
  const halfD = Math.max(1e-6, ud.halfDMax ?? params.depth * 0.5)
  // 网格成型宽 = 正宽 + 左右封翅（不含刀模「侧栏」）
  const formedW = Math.max(1e-6, ud.totalW ?? faceMm + sealMm * 2)
  const halfFormed = formedW * 0.5

  const uvArr = new Float32Array(pos.count * 2)
  const v = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const lx = v.x - cx
    const ly = v.y - cy
    const lz = v.z - cz
    const tV = THREE.MathUtils.clamp(1 - (ly / halfH + 1) * 0.5, 0, 1)
    // 全成型宽 0→1，拉伸映射到 FRONT/BACK 正栏（封翅吃正栏左右边缘）
    const tUFull = THREE.MathUtils.clamp((lx + halfFormed) / formedW, 0, 1)
    const zN = THREE.MathUtils.clamp(lz / halfD, -1, 1)

    let u: number
    let vv: number

    if (zN >= 0) {
      u = (faceX0 + tUFull * faceMm) / sumH
      vv = (frontY0 + tV * frontH) / sumV
    } else {
      u = (faceX0 + (1 - tUFull) * faceMm) / sumH
      vv = (backY0 + tV * backH) / sumV
    }

    uvArr[i * 2] = THREE.MathUtils.clamp(u, 0, 1)
    uvArr[i * 2 + 1] = THREE.MathUtils.clamp(vv, 0, 1)
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))
  geometry.attributes.uv.needsUpdate = true
  geometry.userData.uvVersion = 'product-pack-v14'
  geometry.userData.filmW = sumH
  geometry.userData.filmH = sumV
}

/**
 * 正面铺满画布（95×90 预览用）。
 */
export function createFaceFillTexture(
  params: { face: number; height: number },
  frontImage: CanvasImageSource,
  orient: SoftPackTexOrient = DEFAULT_TEX_ORIENT,
): THREE.CanvasTexture {
  const face = params.face > 0 ? params.face : 95
  const height = params.height > 0 ? params.height : 90
  const { canvas, ctx } = makeVirtualCanvas(face, height)
  drawOriented(ctx, frontImage, 0, 0, canvas.width, canvas.height, orient)
  return finishTexture(canvas, { mode: 'panels', face, height })
}

/**
 * 正+背图集：左半正面、右半背面（各占 U 0–0.5 / 0.5–1）。
 */
export function createFrontBackAtlasTexture(
  params: { face: number; height: number },
  crops: { frontImg: CanvasImageSource; backImg?: CanvasImageSource | null },
  orient: SoftPackTexOrient = DEFAULT_TEX_ORIENT,
): THREE.CanvasTexture {
  const face = params.face > 0 ? params.face : 95
  const height = params.height > 0 ? params.height : 90
  const scale = 10
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(face * scale * 2)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D 不可用')
  ctx.fillStyle = '#f4f4f4'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const half = canvas.width / 2
  drawOriented(ctx, crops.frontImg, 0, 0, half, canvas.height, orient)
  if (crops.backImg) {
    drawOriented(ctx, crops.backImg, half, 0, half, canvas.height, orient)
  }
  return finishTexture(canvas, { mode: 'atlas', face, height })
}

/**
 * UV：
 * - panels / atlas：正面软砖铺满正面图；背面用图集右半或浅灰
 * - fullWrap：体宽对齐刀模「正面」槽 [seal+side, seal+side+face]
 */
export function updateGeometryUVs(
  geometry: THREE.BufferGeometry,
  params: SoftPackUnfoldParams,
  mode: SoftPackTexMode = 'panels',
  opts?: { atlas?: boolean },
): void {
  const pos = geometry.attributes.position as THREE.BufferAttribute
  if (!pos) return
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  if (!box) return

  const ud = geometry.userData as {
    halfFace?: number
    halfH?: number
    halfDMax?: number
    totalW?: number
    filmW?: number
    seal?: number
    side?: number
  }

  const seal = Math.max(0, params.seal)
  const side = Math.max(0, params.side)
  const face = Math.max(1e-6, params.face)
  const backSeal = Math.max(0, params.backSeal)
  const filmW = Math.max(
    1e-6,
    ud.filmW ?? params.totalWidth ?? seal * 2 + side * 2 + face + backSeal,
  )
  const uSideL = (seal + side) / filmW
  const uFaceR = (seal + side + face) / filmW

  const cx = (box.max.x + box.min.x) * 0.5
  const cy = (box.max.y + box.min.y) * 0.5
  const cz = (box.max.z + box.min.z) * 0.5

  const halfFace = Math.max(1e-6, ud.halfFace ?? face * 0.5)
  const halfH = Math.max(1e-6, ud.halfH ?? params.height * 0.5)
  const halfD = Math.max(1e-6, ud.halfDMax ?? params.depth * 0.5)
  const formedW = Math.max(1e-6, ud.totalW ?? face + seal * 2)
  const atlas = !!opts?.atlas

  const uvArr = new Float32Array(pos.count * 2)
  const v = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const lx = v.x - cx
    const ly = v.y - cy
    const lz = v.z - cz

    const tUFace = THREE.MathUtils.clamp((lx + halfFace) / (halfFace * 2), 0, 1)
    const zN = THREE.MathUtils.clamp(lz / halfD, -1, 1)
    // 按高度铺 V，保证正面 logo/水花完整落在正视面（周向展开会把顶部 logo 卷走）
    const tV = THREE.MathUtils.clamp(1 - (ly / halfH + 1) * 0.5, 0, 1)
    let u: number
    let vv = tV

    if (mode === 'fullWrap') {
      if (Math.abs(lx) <= halfFace) {
        u = uSideL + tUFace * (uFaceR - uSideL)
      } else if (lx < 0) {
        const t = THREE.MathUtils.clamp((-lx - halfFace) / Math.max(1e-6, seal), 0, 1)
        u = uSideL * (1 - t)
      } else {
        const t = THREE.MathUtils.clamp((lx - halfFace) / Math.max(1e-6, seal), 0, 1)
        u = uFaceR + t * (1 - uFaceR)
      }
      if (zN < 0) {
        u = atlas ? 0.5 + (1 - tUFace) * 0.5 : 1 - u
        if (!atlas) u = Math.min(0.999, Math.max(uFaceR, u))
      }
    } else {
      // 机身铺满正面图；封翅只续左右边缘色（不拉长、不拉丝）
      // U/V 同时内缩，避免贴到裁剪图最外一圈（刀模线渗色区）
      const inset = 0.045
      const mapUV = (t: number) => inset + THREE.MathUtils.clamp(t, 0, 1) * (1 - 2 * inset)
      const onSeal = Math.abs(lx) > halfFace
      const tFace = onSeal ? (lx < 0 ? 0 : 1) : tUFace
      const uTex = mapUV(tFace)
      vv = mapUV(tV)
      if (onSeal || zN >= -0.05) {
        u = atlas ? uTex * 0.5 : uTex
      } else {
        u = atlas ? 0.5 + (1 - mapUV(tUFace)) * 0.5 : 0.001
        if (!atlas) vv = 0.5
      }
    }

    uvArr[i * 2] = THREE.MathUtils.clamp(u, 0, 1)
    uvArr[i * 2 + 1] = THREE.MathUtils.clamp(vv, 0, 1)
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2))
  geometry.attributes.uv.needsUpdate = true
  geometry.userData.uvVersion = 'product-pack-v17'
  geometry.userData.filmW = face
  geometry.userData.totalW = formedW
}

export function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图纸加载失败'))
    img.src = url
  })
}

export type ApplyMapOptions = {
  mode?: SoftPackTexMode
  cropBack?: SoftPackCropRect | null
}

/**
 * 贴图入口。
 * autoFilm：按刀模 UV 自动多面裁剪 + 无缝贴合（推荐）
 * panels：手动正/背面
 * fullWrap：单条横膜
 */
export async function applySoftPackDrawingMap(
  mesh: THREE.Mesh,
  imageUrl: string,
  dims: SoftPackDims & { height?: number },
  crop: SoftPackCropRect | null | undefined,
  orient: SoftPackTexOrient = DEFAULT_TEX_ORIENT,
  cropBackOrOpts?: SoftPackCropRect | null | ApplyMapOptions,
): Promise<THREE.CanvasTexture | null> {
  const params = toUnfoldParams(dims)

  let mode: SoftPackTexMode = 'panels'
  let cropBack: SoftPackCropRect | null | undefined
  if (cropBackOrOpts && typeof cropBackOrOpts === 'object' && 'mode' in cropBackOrOpts) {
    mode = cropBackOrOpts.mode ?? 'panels'
    cropBack = cropBackOrOpts.cropBack
  } else {
    cropBack = cropBackOrOpts as SoftPackCropRect | null | undefined
  }

  const img = await loadHtmlImage(imageUrl)
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (Math.min(iw, ih) < 64) return null

  const film = dims.filmLayout
  const filmHint = {
    horiz: film?.horizontalMm,
    vert: film?.verticalMm,
    roles: film?.verticalRoles,
  }

  // —— 自动多面：始终用刀模 FRONT/BACK 紧抠，忽略整膜/偏框 ——
  if (mode === 'autoFilm') {
    let panels = autoCropAllPanels(
      iw,
      ih,
      filmHint.horiz,
      filmHint.vert,
      filmHint.roles,
    )
    panels = ensureFrontIsVivid(img, panels, iw, ih)
    const frontCanvas = await cropToCanvas(img, panels.front, 0.04)
    const backCanvas = await cropToCanvas(img, panels.back, 0.04)
    updateGeometryUVs(mesh.geometry as THREE.BufferGeometry, params, 'panels', { atlas: true })
    const tex = createFrontBackAtlasTexture(
      { face: params.face, height: params.height },
      { frontImg: frontCanvas, backImg: backCanvas },
      orient,
    )
    const mat = mesh.material as THREE.MeshStandardMaterial
    if (mat.map) mat.map.dispose()
    mat.map = tex
    mat.color.set(0xffffff)
    mat.roughness = 0.42
    mat.metalness = 0.02
    mat.side = THREE.FrontSide
    mat.needsUpdate = true
    return tex
  }

  if (!crop || crop.cropWidth < 2 || crop.cropHeight < 2) return null

  const looksFull = isFullWrapCropAspect(
    crop.cropWidth,
    crop.cropHeight,
    params.totalWidth,
    params.height,
  )
  if (mode === 'fullWrap' && looksFull) {
    mode = 'fullWrap'
  } else if (mode === 'fullWrap' && !looksFull) {
    mode = 'panels'
  }

  let frontCrop = crop
  let backCropResolved = cropBack
  if (mode === 'panels') {
    const panels = ensureFrontIsVivid(
      img,
      autoCropAllPanels(iw, ih, filmHint.horiz, filmHint.vert, filmHint.roles),
      iw,
      ih,
    )
    // 用户框选哪块就贴哪块。仅当框明显是「整张刀模」时，才从中抠 FRONT 栏。
    const looksFull = isFullWrapCropAspect(
      crop.cropWidth,
      crop.cropHeight,
      params.totalWidth,
      Math.max(params.height * 2, params.totalWidth * 0.8),
    )
    const filmAspect =
      (params.filmLayout?.filmWidth || params.totalWidth) /
      Math.max(1e-6, params.filmLayout?.filmHeight || params.height * 2.5)
    const got = crop.cropWidth / Math.max(1e-6, crop.cropHeight)
    const looksLikeFullFilmSheet =
      Math.abs(got - filmAspect) / Math.max(1e-6, filmAspect) < 0.25 &&
      crop.cropWidth * crop.cropHeight > iw * ih * 0.35

    if (looksFull || looksLikeFullFilmSheet) {
      frontCrop = resolvePanelCrop(crop, params.face, params.height, filmHint, 'front')
    } else {
      frontCrop = insetRect(crop, 0.03, 0.02)
    }

    if (cropBack && cropBack.cropWidth > 2 && cropBack.cropHeight > 2) {
      const backGot = cropBack.cropWidth / Math.max(1e-6, cropBack.cropHeight)
      const backLooksFilm =
        Math.abs(backGot - filmAspect) / Math.max(1e-6, filmAspect) < 0.25 &&
        cropBack.cropWidth * cropBack.cropHeight > iw * ih * 0.35
      backCropResolved = backLooksFilm
        ? resolvePanelCrop(cropBack, params.face, params.height, filmHint, 'back')
        : insetRect(cropBack, 0.03, 0.02)
    } else {
      backCropResolved = panels.back
    }
  }

  const hasBack = !!(
    backCropResolved &&
    backCropResolved.cropWidth > 2 &&
    backCropResolved.cropHeight > 2
  )
  const useAtlas = mode === 'panels' && hasBack
  updateGeometryUVs(mesh.geometry as THREE.BufferGeometry, params, mode, { atlas: useAtlas })

  const inset = mode === 'fullWrap' ? 0.01 : 0.035
  const cropped = await cropToCanvas(img, frontCrop, inset)

  const texParams = {
    total_width: params.totalWidth,
    seal: params.seal,
    side: params.side,
    face: params.face,
    height: params.height,
    back_seal: params.backSeal,
  }

  let tex: THREE.CanvasTexture
  if (mode === 'fullWrap') {
    tex = createFullWrapTexture(texParams, cropped, orient)
  } else if (useAtlas && backCropResolved) {
    const backImage = await cropToCanvas(img, backCropResolved, inset)
    tex = createFrontBackAtlasTexture(
      { face: params.face, height: params.height },
      { frontImg: cropped, backImg: backImage },
      orient,
    )
  } else {
    tex = createFaceFillTexture(
      { face: params.face, height: params.height },
      cropped,
      orient,
    )
  }

  const mat = mesh.material as THREE.MeshStandardMaterial
  if (mat.map) mat.map.dispose()
  mat.map = tex
  mat.color.set(0xffffff)
  mat.roughness = 0.34
  mat.metalness = 0.04
  mat.side = THREE.FrontSide
  mat.needsUpdate = true
  return tex
}

/** @deprecated */
export function generateCleanTexture(
  image: HTMLImageElement,
  params: SoftPackUnfoldParams,
  crop: SoftPackCropRect,
  orient?: SoftPackTexOrient,
): THREE.CanvasTexture {
  const iw = image.naturalWidth || image.width
  const ih = image.naturalHeight || image.height
  const sx = Math.max(0, crop.startX)
  const sy = Math.max(0, crop.startY)
  const sw = Math.max(1, Math.min(crop.cropWidth, iw - sx))
  const sh = Math.max(1, Math.min(crop.cropHeight, ih - sy))
  const tmp = document.createElement('canvas')
  tmp.width = Math.max(64, Math.round(sw))
  tmp.height = Math.max(64, Math.round(sh))
  tmp.getContext('2d')?.drawImage(image, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height)
  const p = {
    total_width: params.totalWidth,
    seal: params.seal,
    side: params.side,
    face: params.face,
    height: params.height,
    back_seal: params.backSeal,
  }
  if (isFullWrapCropAspect(sw, sh, params.totalWidth, params.height)) {
    return createFullWrapTexture(p, tmp, orient)
  }
  return createFaceFillTexture({ face: params.face, height: params.height }, tmp, orient)
}

export function processTexture(
  image: HTMLImageElement,
  params: SoftPackUnfoldParams,
  crop: SoftPackCropRect,
  orient?: SoftPackTexOrient,
): THREE.CanvasTexture {
  return generateCleanTexture(image, params, crop, orient)
}
