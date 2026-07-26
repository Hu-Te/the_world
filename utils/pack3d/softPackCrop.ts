/**
 * 裁剪：仅正面必须框 95×90；若误框整张刀模（≈177/264），自动抠 FRONT 面板。
 */

export type SoftPackCropRect = {
  startX: number
  startY: number
  cropWidth: number
  cropHeight: number
}

export function clampToImage(
  r: SoftPackCropRect,
  imageWidth: number,
  imageHeight: number,
): SoftPackCropRect {
  let cropWidth = Math.max(8, Math.min(r.cropWidth, imageWidth))
  let cropHeight = Math.max(8, Math.min(r.cropHeight, imageHeight))
  let startX = Math.min(Math.max(0, r.startX), Math.max(0, imageWidth - cropWidth))
  let startY = Math.min(Math.max(0, r.startY), Math.max(0, imageHeight - cropHeight))
  return { startX, startY, cropWidth, cropHeight }
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0)
}

/** 在矩形内居中裁到目标宽高比（只缩小、不外扩，避免吃进框外刀模线） */
export function centerCropToAspect(r: SoftPackCropRect, aspect: number): SoftPackCropRect {
  const a = Math.max(1e-6, aspect)
  const got = r.cropWidth / Math.max(1e-6, r.cropHeight)
  if (got > a) {
    const cropWidth = r.cropHeight * a
    return {
      startX: r.startX + (r.cropWidth - cropWidth) * 0.5,
      startY: r.startY,
      cropWidth,
      cropHeight: r.cropHeight,
    }
  }
  const cropHeight = r.cropWidth / a
  return {
    startX: r.startX,
    startY: r.startY + (r.cropHeight - cropHeight) * 0.5,
    cropWidth: r.cropWidth,
    cropHeight,
  }
}

/** 向内收缩选框；bottomExtra 专收底边（刀模横线常贴在框下沿外） */
export function insetRect(
  r: SoftPackCropRect,
  ratio: number,
  bottomExtra = 0,
): SoftPackCropRect {
  const ix = r.cropWidth * ratio
  const iy = r.cropHeight * ratio
  const bottom = iy + r.cropHeight * Math.max(0, bottomExtra)
  return {
    startX: r.startX + ix,
    startY: r.startY + iy,
    cropWidth: Math.max(8, r.cropWidth - ix * 2),
    cropHeight: Math.max(8, r.cropHeight - iy - bottom),
  }
}

/**
 * 仅正面/背面：把错误选框（整张刀模、过高等）纠正为 95×90 面板。
 * 若选框比例接近全膜（竖长），按 filmLayout 从中抠 FRONT/BACK 的 face 列。
 */
export function resolvePanelCrop(
  crop: SoftPackCropRect,
  faceMm: number,
  heightMm: number,
  film?: {
    horiz?: number[]
    vert?: number[]
    roles?: string[]
  },
  which: 'front' | 'back' = 'front',
): SoftPackCropRect {
  const targetAspect = faceMm / Math.max(1e-6, heightMm)
  const got = crop.cropWidth / Math.max(1e-6, crop.cropHeight)
  const horiz = film?.horiz?.length ? film.horiz : [10, 21, 95, 21, 10, 20]
  const vert = film?.vert?.length ? film.vert : [90, 42, 90, 42]
  const roles = film?.roles?.length ? film.roles : ['BACK', 'GUSSET', 'FRONT', 'GUSSET']
  const sumH = Math.max(1e-6, sum(horiz))
  const sumV = Math.max(1e-6, sum(vert))
  const filmAspect = sumH / sumV

  if (Math.abs(got - targetAspect) / targetAspect < 0.2) {
    // 比例已对：只内缩，底边多收，躲开框外横线
    return insetRect(crop, 0.04, 0.02)
  }

  const looksLikeFullFilm =
    got < targetAspect * 0.88 || Math.abs(got - filmAspect) / filmAspect < 0.22

  if (looksLikeFullFilm) {
    const want = which === 'front' ? 'FRONT' : 'BACK'
    let rowIdx = roles.findIndex((r) => String(r || '').toUpperCase() === want)
    if (rowIdx < 0) rowIdx = which === 'front' ? Math.min(2, vert.length - 1) : 0
    rowIdx = Math.max(0, Math.min(rowIdx, vert.length - 1))

    let y0 = 0
    for (let i = 0; i < rowIdx; i++) y0 += vert[i] ?? 0
    const yH = Math.max(1e-6, vert[rowIdx] ?? heightMm)
    const faceX0 = (horiz[0] ?? 0) + (horiz[1] ?? 0)
    const faceW = horiz[2] ?? faceMm

    const panel = insetRect(
      {
        startX: crop.startX + crop.cropWidth * (faceX0 / sumH),
        startY: crop.startY + crop.cropHeight * (y0 / sumV),
        cropWidth: crop.cropWidth * (faceW / sumH),
        cropHeight: crop.cropHeight * (yH / sumV),
      },
      0.06,
    )
    return centerCropToAspect(panel, targetAspect)
  }

  return insetRect(centerCropToAspect(crop, targetAspect), 0.04)
}

export function defaultFullWrapRowCrop(
  imageWidth: number,
  imageHeight: number,
  horiz = [10, 21, 95, 21, 10, 20],
  vert = [90, 42, 90, 42],
  roles: string[] = ['BACK', 'GUSSET', 'FRONT', 'GUSSET'],
  which: 'front' | 'back' = 'front',
): SoftPackCropRect {
  const sumH = Math.max(1e-6, sum(horiz))
  const sumV = Math.max(1e-6, sum(vert))
  const filmH = imageHeight * 0.76
  const filmW = Math.min(imageWidth * 0.92, filmH * (sumH / sumV))
  const filmX0 = imageWidth * 0.02
  const filmY0 = imageHeight * 0.035

  const want = which === 'front' ? 'FRONT' : 'BACK'
  let rowIdx = roles.findIndex((r) => String(r || '').toUpperCase() === want)
  if (rowIdx < 0) rowIdx = which === 'front' ? Math.min(2, vert.length - 1) : 0
  rowIdx = Math.max(0, Math.min(rowIdx, vert.length - 1))

  let y0 = 0
  for (let i = 0; i < rowIdx; i++) y0 += vert[i] ?? 0
  const yH = Math.max(1e-6, vert[rowIdx] ?? vert[0] ?? 90)

  const ix = filmW * 0.012
  const iy = filmH * (yH / sumV) * 0.04
  return clampToImage(
    {
      startX: filmX0 + ix,
      startY: filmY0 + filmH * (y0 / sumV) + iy,
      cropWidth: filmW - ix * 2,
      cropHeight: filmH * (yH / sumV) - iy * 2,
    },
    imageWidth,
    imageHeight,
  )
}

export function defaultFrontPanelCrop(
  imageWidth: number,
  imageHeight: number,
  horiz = [10, 21, 95, 21, 10, 20],
  vert = [90, 42, 90, 42],
  roles: string[] = ['BACK', 'GUSSET', 'FRONT', 'GUSSET'],
): SoftPackCropRect {
  const sumH = Math.max(1e-6, sum(horiz))
  const sumV = Math.max(1e-6, sum(vert))
  const filmH = imageHeight * 0.7
  const filmW = Math.min(imageWidth * 0.85, filmH * (sumH / sumV))
  const filmX0 = imageWidth * 0.04
  const filmY0 = imageHeight * 0.06

  const faceX0 = (horiz[0] ?? 10) + (horiz[1] ?? 21)
  const faceW = horiz[2] ?? 95
  let rowIdx = roles.findIndex((r) => String(r || '').toUpperCase() === 'FRONT')
  if (rowIdx < 0) rowIdx = Math.min(2, vert.length - 1)
  let frontY0 = 0
  for (let i = 0; i < rowIdx; i++) frontY0 += vert[i] ?? 0
  const frontH = vert[rowIdx] ?? 90

  const raw = {
    startX: filmX0 + filmW * (faceX0 / sumH),
    startY: filmY0 + filmH * (frontY0 / sumV),
    cropWidth: filmW * (faceW / sumH),
    cropHeight: filmH * (frontH / sumV),
  }
  const targetAspect = faceW / Math.max(1e-6, frontH)
  return clampToImage(
    insetRect(centerCropToAspect(raw, targetAspect), 0.07),
    imageWidth,
    imageHeight,
  )
}

export function defaultBackPanelCrop(
  imageWidth: number,
  imageHeight: number,
  horiz = [10, 21, 95, 21, 10, 20],
  vert = [90, 42, 90, 42],
  roles: string[] = ['BACK', 'GUSSET', 'FRONT', 'GUSSET'],
): SoftPackCropRect {
  const sumH = Math.max(1e-6, sum(horiz))
  const sumV = Math.max(1e-6, sum(vert))
  const filmH = imageHeight * 0.7
  const filmW = Math.min(imageWidth * 0.85, filmH * (sumH / sumV))
  const filmX0 = imageWidth * 0.04
  const filmY0 = imageHeight * 0.06

  const faceX0 = (horiz[0] ?? 10) + (horiz[1] ?? 21)
  const faceW = horiz[2] ?? 95
  let rowIdx = roles.findIndex((r) => String(r || '').toUpperCase() === 'BACK')
  if (rowIdx < 0) rowIdx = 0
  let y0 = 0
  for (let i = 0; i < rowIdx; i++) y0 += vert[i] ?? 0
  const yH = vert[rowIdx] ?? 90

  const raw = {
    startX: filmX0 + filmW * (faceX0 / sumH),
    startY: filmY0 + filmH * (y0 / sumV),
    cropWidth: filmW * (faceW / sumH),
    cropHeight: filmH * (yH / sumV),
  }
  return clampToImage(
    insetRect(centerCropToAspect(raw, faceW / Math.max(1e-6, yH)), 0.07),
    imageWidth,
    imageHeight,
  )
}

export function defaultUnfoldStripCrop(
  imageWidth: number,
  imageHeight: number,
  aspect: number,
  horiz?: number[],
  vert?: number[],
  roles?: string[],
): SoftPackCropRect {
  if (horiz?.length && vert?.length) {
    return defaultFullWrapRowCrop(imageWidth, imageHeight, horiz, vert, roles, 'front')
  }
  const a = Math.max(1e-6, aspect)
  let cropHeight = imageHeight * 0.34
  let cropWidth = cropHeight * a
  if (cropWidth > imageWidth * 0.72) {
    cropWidth = imageWidth * 0.72
    cropHeight = cropWidth / a
  }
  return clampToImage(
    {
      startX: imageWidth * 0.03,
      startY: imageHeight * 0.08,
      cropWidth: cropWidth * 0.94,
      cropHeight: cropHeight * 0.9,
    },
    imageWidth,
    imageHeight,
  )
}

export function defaultCropRect(
  imageWidth: number,
  imageHeight: number,
  aspect: number,
): SoftPackCropRect {
  if (aspect > 0.85 && aspect < 1.35) {
    return defaultFrontPanelCrop(imageWidth, imageHeight)
  }
  return defaultUnfoldStripCrop(imageWidth, imageHeight, aspect)
}

/** 估算刀模整膜在图中的矩形（按 filmWidth:filmHeight） */
export function estimateFilmRect(
  imageWidth: number,
  imageHeight: number,
  filmWidthMm: number,
  filmHeightMm: number,
): SoftPackCropRect {
  const aspect = filmWidthMm / Math.max(1e-6, filmHeightMm)
  let cropHeight = imageHeight * 0.78
  let cropWidth = cropHeight * aspect
  if (cropWidth > imageWidth * 0.88) {
    cropWidth = imageWidth * 0.88
    cropHeight = cropWidth / aspect
  }
  // 刀模多在左侧略偏上
  const startX = Math.max(imageWidth * 0.02, (imageWidth - cropWidth) * 0.12)
  const startY = Math.max(imageHeight * 0.03, (imageHeight - cropHeight) * 0.08)
  return clampToImage(
    insetRect({ startX, startY, cropWidth, cropHeight }, 0.01),
    imageWidth,
    imageHeight,
  )
}

export type SoftPackAutoPanels = {
  film: SoftPackCropRect
  front: SoftPackCropRect
  back: SoftPackCropRect
  /** 正面行左侧边（供侧缘续色） */
  frontLeftSide: SoftPackCropRect
  frontRightSide: SoftPackCropRect
}

/**
 * 根据 UV/刀模毫米布局，一次算出整膜 + 正/背/侧 多面裁剪框。
 */
export function autoCropAllPanels(
  imageWidth: number,
  imageHeight: number,
  horiz = [10, 21, 95, 21, 10, 20],
  vert = [90, 42, 90, 42],
  roles: string[] = ['BACK', 'GUSSET', 'FRONT', 'GUSSET'],
): SoftPackAutoPanels {
  const sumH = Math.max(1e-6, sum(horiz))
  const sumV = Math.max(1e-6, sum(vert))
  const film = estimateFilmRect(imageWidth, imageHeight, sumH, sumV)

  const cell = (x0: number, w: number, y0: number, h: number, inset = 0.04) =>
    clampToImage(
      insetRect(
        {
          startX: film.startX + film.cropWidth * (x0 / sumH),
          startY: film.startY + film.cropHeight * (y0 / sumV),
          cropWidth: film.cropWidth * (w / sumH),
          cropHeight: film.cropHeight * (h / sumV),
        },
        inset,
      ),
      imageWidth,
      imageHeight,
    )

  const seal = horiz[0] ?? 10
  const side = horiz[1] ?? 21
  const face = horiz[2] ?? 95
  const faceX0 = seal + side

  let frontY0 = 0
  let frontH = vert[2] ?? 90
  let backY0 = 0
  let backH = vert[0] ?? 90
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

  function tightFaceCell(x0: number, w: number, y0: number, h: number): SoftPackCropRect {
    const raw = {
      startX: film.startX + film.cropWidth * (x0 / sumH),
      startY: film.startY + film.cropHeight * (y0 / sumV),
      cropWidth: film.cropWidth * (w / sumH),
      cropHeight: film.cropHeight * (h / sumV),
    }
    // 水平内缩 5%，垂直 2% — 保住顶部 logo，只去掉分栏线
    const ix = raw.cropWidth * 0.05
    const iy = raw.cropHeight * 0.02
    return clampToImage(
      {
        startX: raw.startX + ix,
        startY: raw.startY + iy,
        cropWidth: Math.max(8, raw.cropWidth - ix * 2),
        cropHeight: Math.max(8, raw.cropHeight - iy * 2),
      },
      imageWidth,
      imageHeight,
    )
  }

  return {
    film,
    front: tightFaceCell(faceX0, face, frontY0, frontH),
    back: tightFaceCell(faceX0, face, backY0, backH),
    frontLeftSide: cell(seal, side, frontY0, frontH, 0.1),
    frontRightSide: cell(faceX0 + face, side, frontY0, frontH, 0.1),
  }
}

/**
 * 选框是否像正面面板（≈95/90），而不是整膜（≈177/264）。
 */
export function isFacePanelAspect(cropWidth: number, cropHeight: number): boolean {
  const got = cropWidth / Math.max(1e-6, cropHeight)
  const face = 95 / 90
  const film = 177 / 264
  const dFace = Math.abs(got - face) / face
  const dFilm = Math.abs(got - film) / film
  return dFace < 0.28 && dFace <= dFilm
}

/**
 * 采样裁剪区「印刷鲜艳度」：正面彩图通常远高于白底说明书。
 * 用于纠正 FRONT/BACK 行标反了或 film 框偏了的情况。
 */
export function scoreCropVividness(
  image: CanvasImageSource,
  rect: SoftPackCropRect,
): number {
  const w = Math.max(8, Math.round(rect.cropWidth))
  const h = Math.max(8, Math.round(rect.cropHeight))
  const c = document.createElement('canvas')
  const sw = Math.min(64, w)
  const sh = Math.min(64, h)
  c.width = sw
  c.height = sh
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 0
  ctx.drawImage(
    image,
    rect.startX,
    rect.startY,
    rect.cropWidth,
    rect.cropHeight,
    0,
    0,
    sw,
    sh,
  )
  const data = ctx.getImageData(0, 0, sw, sh).data
  let vivid = 0
  let redInk = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const sat = max === 0 ? 0 : (max - min) / max
    const lum = (r + g + b) / (3 * 255)
    // 彩图：高饱和；白底黑字：低饱和
    vivid += sat * (0.35 + 0.65 * (1 - Math.abs(lum - 0.55)))
    // 刀模红线：高 R 低 G/B
    if (r > 160 && r > g * 1.6 && r > b * 1.6) redInk += 1
    n += 1
  }
  if (n <= 0) return 0
  const redPenalty = (redInk / n) * 0.85
  return vivid / n - redPenalty
}

/** 若「背面」比「正面」更鲜艳则对调；不再用整膜扫描（易框进侧栏折线） */
export function ensureFrontIsVivid(
  image: CanvasImageSource,
  panels: SoftPackAutoPanels,
  _imageWidth?: number,
  _imageHeight?: number,
): SoftPackAutoPanels {
  const vf = scoreCropVividness(image, panels.front)
  const vb = scoreCropVividness(image, panels.back)
  if (vb > vf + 0.04) {
    return { ...panels, front: panels.back, back: panels.front }
  }
  return panels
}
