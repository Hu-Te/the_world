const DWG_VERSION_LABELS: Record<string, string> = {
  AC1012: 'AutoCAD R13',
  AC1014: 'AutoCAD R14',
  AC1015: 'AutoCAD 2000',
  AC1018: 'AutoCAD 2004',
  AC1021: 'AutoCAD 2007',
  AC1024: 'AutoCAD 2010',
  AC1027: 'AutoCAD 2013',
  AC1032: 'AutoCAD 2018',
  AC1035: 'AutoCAD 2021+',
}

/** 读取 DWG 文件头版本（如 AC1032） */
export function readDwgVersionCode(buffer: ArrayBuffer): string | null {
  if (buffer.byteLength < 6) return null
  const head = new TextDecoder('ascii').decode(new Uint8Array(buffer, 0, 6)).trim()
  if (!head.startsWith('AC')) return null
  return head.slice(0, 6)
}

export function formatDwgVersion(code: string | null): string | null {
  if (!code) return null
  return DWG_VERSION_LABELS[code] ?? code
}

/** LibreDWG 对 2018+ 支持有限 */
export function isDwgVersionRisky(code: string | null): boolean {
  if (!code) return false
  return code >= 'AC1032'
}

export function isUnsupportedDwgFile(fileName: string, buffer: ArrayBuffer): boolean {
  if (!fileName.toLowerCase().endsWith('.dwg')) return false
  return isDwgVersionRisky(readDwgVersionCode(buffer))
}

const LARGE_CAD_BYTES = 15 * 1024 * 1024

export function buildCadOpenFailureMessage(
  fileName: string,
  buffer: ArrayBuffer,
  fileSize?: number,
): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.dxf')) {
    return '无法解析该 DXF 图纸，文件可能已损坏或含有暂不支持的图元'
  }

  const code = readDwgVersionCode(buffer)
  const label = formatDwgVersion(code)
  const large = (fileSize ?? buffer.byteLength) > LARGE_CAD_BYTES

  if (code && isDwgVersionRisky(code)) {
    return label
      ? `检测到 ${label}（${code}）格式，当前浏览器引擎暂不支持此版本 DWG`
      : `检测到较新版本 DWG（${code}），当前浏览器引擎暂不支持`
  }

  if (code === 'AC1027' && large) {
    return '图纸已是 AutoCAD 2013 格式，但体量较大或图元复杂，浏览器引擎无法完整解析'
  }

  if (label) {
    return large
      ? `无法解析该 DWG（${label}），大体积工业图建议改用 DXF 预览`
      : `无法解析该 DWG（${label}），文件可能已损坏或含有暂不支持的图元`
  }

  return '无法解析该图纸，可能是版本过新或文件已损坏'
}

export function buildCadOpenFailureHint(code: string | null, fileSize?: number): string {
  if (code && isDwgVersionRisky(code)) {
    return '请在 AutoCAD / 中望 CAD 中「另存为」AutoCAD 2013 DXF（推荐），或 AutoCAD 2013 DWG（AC1027）后再预览'
  }
  if (code === 'AC1027' || (fileSize ?? 0) > LARGE_CAD_BYTES) {
    return '请优先「另存为 AutoCAD 2013 DXF」再预览（不要只降 DWG 版本）；复杂电气图常需 DXF 才能解析。也可用 CAD 直接打开'
  }
  return '可尝试另存为 AutoCAD 2013 DXF，或较低版本 DWG 后再预览'
}

/** 大文件提高分块大小，减轻解析压力 */
export function cadMinimumChunkSize(fileSize: number): number {
  if (fileSize > 20 * 1024 * 1024) return 12000
  if (fileSize > 8 * 1024 * 1024) return 8000
  if (fileSize > 2 * 1024 * 1024) return 4000
  return 1500
}
