import { CAD_PREVIEW_MAX_BYTES } from '@/config/cadViewer'
import { uploadCadCloudProxy } from '@/utils/cadPreviewApi'

export type FilePreviewKind = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'cad' | 'unsupported'

export interface FilePreviewState {
  name: string
  size: number
  mime: string
  kind: FilePreviewKind
  url: string
  /** VJMAP fileid after upload-proxy */
  cloudFileId?: string
  /** VJMAP suggested mapid for WebGL tiles */
  cloudMapId?: string
  /** Original upload filename returned by cloud gateway */
  cloudUploadName?: string
  /** @deprecated Legacy SVG preview URL */
  svgUrl?: string
  text?: string
  truncated?: boolean
}

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'js',
  'mjs',
  'cjs',
  'ts',
  'jsx',
  'tsx',
  'vue',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'xml',
  'csv',
  'yaml',
  'yml',
  'log',
  'sql',
  'glsl',
  'env',
  'ini',
  'toml',
  'sh',
  'bat',
])
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'avif', 'svg'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'mov'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'])
const CAD_EXTENSIONS = new Set(['dwg', 'dxf'])

const TEXT_MAX_BYTES = 512 * 1024

export class FilePreviewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FilePreviewError'
  }
}

function getExtension(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function detectFilePreviewKind(file: File): FilePreviewKind {
  const ext = getExtension(file.name)
  const mime = file.type.toLowerCase()

  if (mime.startsWith('image/') || IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (mime.startsWith('video/') || VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (mime.startsWith('audio/') || AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (
    ext === 'dwg' ||
    ext === 'dxf' ||
    mime === 'application/acad' ||
    mime === 'image/vnd.dwg' ||
    mime.includes('dwg') ||
    mime.includes('dxf')
  ) {
    return 'cad'
  }
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/javascript' ||
    mime === 'application/xml' ||
    TEXT_EXTENSIONS.has(ext)
  ) {
    return 'text'
  }
  return 'unsupported'
}

async function readTextPreview(file: File): Promise<{ text: string; truncated: boolean }> {
  const slice = file.size > TEXT_MAX_BYTES ? file.slice(0, TEXT_MAX_BYTES) : file
  const text = await slice.text()
  return { text, truncated: file.size > TEXT_MAX_BYTES }
}

export async function buildFilePreview(file: File): Promise<FilePreviewState> {
  const kind = detectFilePreviewKind(file)

  if (kind === 'cad') {
    if (file.size > CAD_PREVIEW_MAX_BYTES) {
      throw new FilePreviewError(
        `图纸超过 ${formatFileSize(CAD_PREVIEW_MAX_BYTES)} 上限，请压缩或拆分后再预览`,
      )
    }
    const ext = getExtension(file.name)
    if (!CAD_EXTENSIONS.has(ext)) {
      throw new FilePreviewError('仅支持 .dwg 与 .dxf 格式')
    }
  }

  const url = URL.createObjectURL(file)
  const base = {
    name: file.name,
    size: file.size,
    mime: file.type || '未知类型',
    kind,
    url,
  }

  if (kind === 'cad') {
    const { fileId, mapId, uploadName } = await uploadCadCloudProxy(file)
    return {
      ...base,
      cloudFileId: fileId,
      cloudMapId: mapId ?? fileId,
      cloudUploadName: uploadName ?? file.name,
      mime: 'application/vnd.nexus.cad-cloud',
    }
  }

  if (kind === 'text') {
    const { text, truncated } = await readTextPreview(file)
    return { ...base, text, truncated }
  }

  return base
}

export function revokeFilePreview(state: FilePreviewState | null): void {
  if (state?.url) URL.revokeObjectURL(state.url)
}

export const FILE_PREVIEW_ACCEPT =
  'image/*,video/*,audio/*,.pdf,.dwg,.dxf,.txt,.md,.json,.js,.ts,.jsx,.tsx,.vue,.css,.html,.xml,.csv,.yaml,.yml,.svg,.log,.sql,.glsl'
