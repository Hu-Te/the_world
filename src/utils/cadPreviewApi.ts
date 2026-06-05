import { CAD_PREVIEW_API } from '@/config/api'
import { FilePreviewError } from '@/utils/filePreview'

interface ProblemDetail {
  detail?: string
  title?: string
  status?: number
}

export interface CadUploadProxyResult {
  fileId: string
  mapId?: string
  uploadName?: string
  gatewayStatus?: string
}

/**
 * Stream DWG/DXF to Java upload-proxy, then to cloud tile encoder (2018+ DWG).
 */
export async function uploadCadCloudProxy(file: File): Promise<CadUploadProxyResult> {
  const form = new FormData()
  form.append('file', file, file.name)

  const res = await fetch(`${CAD_PREVIEW_API}/upload-proxy`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new FilePreviewError(await parseCadPreviewError(res))
  }

  const data = (await res.json()) as {
    fileId?: string
    mapId?: string
    uploadName?: string
    gatewayStatus?: string
  }
  if (!data.fileId) {
    throw new FilePreviewError('Cloud gateway response missing fileId')
  }

  return {
    fileId: data.fileId,
    mapId: data.mapId ?? data.fileId,
    uploadName: data.uploadName,
    gatewayStatus: data.gatewayStatus,
  }
}

/**
 * @deprecated Legacy CLI SVG path; use uploadCadCloudProxy for DWG 2018+.
 */
export async function fetchCadSvgPreview(file: File): Promise<Blob> {
  const form = new FormData()
  form.append('file', file, file.name)

  const res = await fetch(`${CAD_PREVIEW_API}/preview-large`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    throw new FilePreviewError(await parseCadPreviewError(res))
  }

  return res.blob()
}

async function parseCadPreviewError(res: Response): Promise<string> {
  const fallback = `图纸预览失败（HTTP ${res.status}）`
  const ct = res.headers.get('Content-Type') || ''

  if (ct.includes('json')) {
    try {
      const data = (await res.json()) as ProblemDetail & { error?: string }
      if (data.detail) return data.detail
      if (data.error) return data.error
      if (data.title) return data.title
    } catch {
      /* ignore */
    }
  }

  try {
    const text = (await res.text()).trim()
    if (text) return text.slice(0, 300)
  } catch {
    /* ignore */
  }

  if (res.status === 413) return '图纸超过服务端大小上限'
  if (res.status === 504) return '图纸转换超时，请稍后重试或改用 DXF'
  if (res.status === 422) return '无法转换该图纸，请检查格式或在 CAD 中另存为 DXF 后重试'

  return fallback
}
