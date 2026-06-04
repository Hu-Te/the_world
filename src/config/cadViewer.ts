/** CAD 预览资源（字体等）CDN */
export const CAD_VIEWER_BASE_URL = 'https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/'

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`

/** Web Worker 脚本路径（复制到 public/assets，dev/build 均可访问） */
export const CAD_VIEWER_WORKERS = {
  dxfParser: asset('dxf-parser-worker.js'),
  dwgParser: asset('libredwg-parser-worker.js'),
  mtextRender: asset('mtext-renderer-worker.js'),
} as const

/** 单文件大小上限（与 Java `CAD_MAX_UPLOAD_BYTES` 默认 100MB 对齐） */
export const CAD_PREVIEW_MAX_BYTES = 100 * 1024 * 1024
