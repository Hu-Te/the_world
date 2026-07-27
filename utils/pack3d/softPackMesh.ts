/**
 * 软包装程序化网格 — 一比一贴近实拍枕袋：
 * 微鼓软砖 + 大圆角 + 左右热封翅连续收合。
 */

import * as THREE from 'three'

export type SoftPackProductType =
  'PILLOW_POUCH' | 'STAND_UP_POUCH' | 'THREE_SIDE_SEAL' | 'UNKNOWN' | string

export type SoftPackProfilePoint = {
  yNorm: number
  halfDepthScale: number
}

export type SoftPackFilmLayout = {
  horizontalMm: number[]
  verticalMm: number[]
  verticalRoles: string[]
  filmWidth: number
  filmHeight: number
}

export type SoftPackDims = {
  productType?: SoftPackProductType
  totalWidth: number
  sealWidth: number
  sideWidth: number
  mainFaceWidth: number
  backSealWidth: number
  height?: number
  maxHalfDepth?: number
  sealFlattenMm?: number
  bellyPower?: number
  depthProfile?: SoftPackProfilePoint[]
  filmLayout?: SoftPackFilmLayout
  rationale?: string
}

export type SoftPackMeshOptions = {
  dims: SoftPackDims
  height?: number
  radialSegments?: number
  heightSegments?: number
}

/** 从 filmLayout 取 FRONT 面板高 */
export function filmFaceHeightMm(film?: SoftPackFilmLayout | null, fallback = 90): number {
  if (!film?.verticalMm?.length) return fallback
  const roles = film.verticalRoles || []
  for (let i = 0; i < film.verticalMm.length; i++) {
    if (String(roles[i] || '').toUpperCase() === 'FRONT') {
      return film.verticalMm[i] ?? fallback
    }
  }
  // 典型 BACK|GUSSET|FRONT|GUSSET → 取第 3 段
  if (film.verticalMm.length >= 3) return film.verticalMm[2] ?? fallback
  return film.verticalMm[0] ?? fallback
}

export function filmGussetDepthMm(film?: SoftPackFilmLayout | null, fallback = 42): number {
  if (!film?.verticalMm?.length) return fallback
  const roles = film.verticalRoles || []
  for (let i = 0; i < film.verticalMm.length; i++) {
    if (['GUSSET', 'SIDE'].includes(String(roles[i] || '').toUpperCase())) {
      return film.verticalMm[i] ?? fallback
    }
  }
  if (film.verticalMm.length >= 2) return film.verticalMm[1] ?? fallback
  return fallback
}

/**
 * 刀模毫米为真相：横 10|21|95|…、竖 FRONT=90。
 * 覆盖 LLM 给的 height=98 等漂移，避免贴图比例错位。
 */
export function normalizeSoftPackDims(dims: SoftPackDims): SoftPackDims {
  const film = dims.filmLayout
  if (!film?.horizontalMm || film.horizontalMm.length < 3) {
    return {
      ...dims,
      height: dims.height && dims.height > 0 ? dims.height : 90,
    }
  }
  const seal = film.horizontalMm[0] ?? dims.sealWidth
  const side = film.horizontalMm[1] ?? dims.sideWidth
  const face = film.horizontalMm[2] ?? dims.mainFaceWidth
  const back =
    film.horizontalMm.length >= 6
      ? (film.horizontalMm[5] ?? dims.backSealWidth)
      : dims.backSealWidth
  const faceH = filmFaceHeightMm(film, dims.height ?? 90)
  const gusset = filmGussetDepthMm(film, Math.max(24, side * 2))
  const total = film.filmWidth > 0 ? film.filmWidth : seal * 2 + side * 2 + face + back
  return {
    ...dims,
    totalWidth: total,
    sealWidth: seal,
    sideWidth: side,
    mainFaceWidth: face,
    backSealWidth: back,
    height: faceH,
    maxHalfDepth: gusset * 0.5,
    filmLayout: {
      ...film,
      filmWidth: film.filmWidth > 0 ? film.filmWidth : total,
      filmHeight:
        film.filmHeight > 0 ? film.filmHeight : film.verticalMm.reduce((a, b) => a + b, 0),
    },
  }
}

function finishNormals(geo: THREE.BufferGeometry) {
  if (geo.getAttribute('normal')) geo.deleteAttribute('normal')
  geo.computeVertexNormals()
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute | undefined
  if (nrm) nrm.needsUpdate = true
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
}

/** 超椭圆：n 越小越圆润（实拍大圆角软包） */
function sectionYZ(ang: number, halfH: number, halfD: number, n: number) {
  const c = Math.cos(ang)
  const s = Math.sin(ang)
  const ay = Math.abs(c)
  const az = Math.abs(s)
  const rn = Math.pow(Math.pow(ay, n) + Math.pow(az, n), 1 / Math.max(1.01, n))
  const r = rn > 1e-8 ? 1 / rn : 1
  return { y: halfH * c * r, z: halfD * s * r }
}

/**
 * 实拍枕袋：微鼓机身 + 大圆角 + 左右外伸热封翅。
 */
function createEndSealPillow(opts: SoftPackMeshOptions): THREE.BufferGeometry {
  const dims = normalizeSoftPackDims(opts.dims)
  const faceW = Math.max(24, dims.mainFaceWidth)
  const sideW = Math.max(4, dims.sideWidth)
  const bodyH = Math.max(24, opts.height ?? dims.height ?? filmFaceHeightMm(dims.filmLayout, 90))

  const filmGusset = dims.filmLayout?.verticalMm?.find((_, i) => {
    const r = String(dims.filmLayout?.verticalRoles?.[i] || '').toUpperCase()
    return r === 'GUSSET' || r === 'SIDE'
  })
  // 厚度 = 竖向 Gusset 段（如 42），或 2×半厚；禁止再 *0.9 / 按正面宽比例硬压，否则会变成 37.8
  const bodyD = Math.max(
    8,
    dims.maxHalfDepth && dims.maxHalfDepth > 0
      ? dims.maxHalfDepth * 2
      : filmGusset && filmGusset > 0
        ? filmGusset
        : Math.max(sideW * 2, 24),
  )

  // 封边跟刀模（如 10），禁止 clamp 到 9.5
  const seal = Math.max(1, dims.sealWidth || 10)
  const backSeal = Math.max(0, dims.backSealWidth || 0)
  const bodyW = faceW
  const totalW = bodyW + seal * 2
  const filmW = Math.max(
    dims.totalWidth > 0 ? dims.totalWidth : faceW + sideW * 2 + seal * 2 + backSeal,
    faceW + sideW * 2 + seal * 2 + backSeal,
  )

  const halfBody = bodyW * 0.5
  const halfFace = halfBody
  const halfH = bodyH * 0.5
  const halfD = bodyD * 0.5
  // 封翅高度与机身一致（仅厚度压扁）；勿再 *0.97，否则标注会漂到 ~88
  const sealHalfH = halfH
  const sealHalfD = Math.max(0.25, halfD * 0.02)

  const segX = Math.max(140, opts.heightSegments ?? 144)
  const segC = Math.max(120, opts.radialSegments ?? 128)
  const nBody = 3.5
  const nSeal = 8
  // 微鼓仅作观感，不改 userData 标注尺寸
  const bellyAmp = 0.03

  const posArr: number[] = []
  const uvArr: number[] = []
  const idxArr: number[] = []

  for (let ix = 0; ix <= segX; ix++) {
    const tx = ix / segX
    const x = -totalW * 0.5 + tx * totalW
    const absX = Math.abs(x)

    let tSeal = 0
    if (absX > halfBody) {
      tSeal = THREE.MathUtils.clamp((absX - halfBody) / seal, 0, 1)
    }
    // 短肩线：收合利落
    const shoulder = Math.min(seal * 0.5, halfBody * 0.07)
    let shoulderK = 0
    if (absX > halfBody - shoulder && absX <= halfBody) {
      shoulderK = THREE.MathUtils.smoothstep(halfBody - shoulder, halfBody, absX)
    }
    const sealK = tSeal * tSeal * (3 - 2 * tSeal)
    const pinch = Math.max(sealK, shoulderK * 0.9)

    const alongBody = THREE.MathUtils.clamp((x + halfBody) / Math.max(1e-6, bodyW), 0, 1)
    const belly = 1 + bellyAmp * Math.sin(Math.PI * alongBody) * (1 - pinch)

    const hR = THREE.MathUtils.lerp(halfH * belly, sealHalfH, pinch)
    const dR = THREE.MathUtils.lerp(halfD * belly, sealHalfD, pinch)
    const n = THREE.MathUtils.lerp(nBody, nSeal, pinch)

    for (let ic = 0; ic <= segC; ic++) {
      const tc = ic / segC
      const ang = tc * Math.PI * 2
      const section = sectionYZ(ang, hR, dR, n)
      const y = section.y
      let z = section.z

      if (pinch > 0.01) {
        z *= THREE.MathUtils.lerp(1, 0.06, pinch)
      }
      // 不做齿纹顶点扰动，避免颗粒感与拉丝

      posArr.push(x, y, z)
      uvArr.push(tx, THREE.MathUtils.clamp(1 - (y / halfH + 1) * 0.5, 0, 1))
    }
  }

  for (let ix = 0; ix < segX; ix++) {
    for (let ic = 0; ic < segC; ic++) {
      const a = ix * (segC + 1) + ic
      const b = a + segC + 1
      idxArr.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2))
  geo.setIndex(idxArr)
  finishNormals(geo)

  geo.userData.formed = {
    productType: 'PILLOW_POUCH',
    label: '卫生巾外袋',
    width: Math.round(totalW * 10) / 10,
    bodyWidth: Math.round(faceW * 10) / 10,
    sideWidth: Math.round(sideW * 10) / 10,
    height: Math.round(bodyH * 10) / 10,
    depth: Math.round(bodyD * 10) / 10,
    seal: Math.round(seal * 10) / 10,
    source: 'procedural-1to1',
  }
  geo.userData.halfFace = halfFace
  geo.userData.halfMid = halfBody
  geo.userData.halfW = halfFace
  geo.userData.halfH = halfH
  geo.userData.halfDMax = halfD
  geo.userData.side = sideW
  geo.userData.seal = seal
  geo.userData.totalW = totalW
  geo.userData.filmW = filmW
  geo.userData.uvVersion = 'product-pack-v19'
  geo.userData.orient = 'product-flange'
  return geo
}

/**
 * 自立袋 / 三边封：与枕袋同一套「正栏 + 左右封翅」刀模 1:1 建网。
 * 旧版 upright 砖只有正面宽、无封翅，会把「外宽」误标成 95（应为 正+2封）。
 */
function createUprightSoftBrick(opts: SoftPackMeshOptions): THREE.BufferGeometry {
  const geo = createEndSealPillow(opts)
  const type = String(opts.dims.productType || '').toUpperCase()
  const formed = (geo.userData.formed || {}) as Record<string, unknown>
  formed.productType = type
  formed.label = type === 'STAND_UP_POUCH' ? '自立袋' : '三边封'
  formed.source = 'procedural-1to1'
  geo.userData.formed = formed
  geo.userData.orient = 'upright-flange'
  geo.userData.uvVersion = 'product-pack-v19'
  return geo
}

export function createSoftPackGeometry(opts: SoftPackMeshOptions): THREE.BufferGeometry {
  const type = String(opts.dims.productType || 'PILLOW_POUCH').toUpperCase()
  if (type === 'STAND_UP_POUCH' || type === 'THREE_SIDE_SEAL') {
    return createUprightSoftBrick(opts)
  }
  return createEndSealPillow(opts)
}
