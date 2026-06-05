import { THREED_API } from '@/config/api'

export async function convertStepToGlb(file: File): Promise<ArrayBuffer> {
  const form = new FormData()
  form.append('file', file, file.name)

  const res = await fetch(`${THREED_API}/step-to-gltf`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const message = await parseStepError(res)
    throw new Error(message)
  }

  const contentType = res.headers.get('Content-Type') || ''
  if (
    !contentType.includes('model/gltf-binary') &&
    !contentType.includes('application/octet-stream')
  ) {
    console.warn('[stepModelApi] unexpected Content-Type:', contentType)
  }

  const buffer = await res.arrayBuffer()
  if (buffer.byteLength < 12) {
    throw new Error('STEP conversion returned an empty GLB body')
  }

  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4))
  if (magic !== 'glTF') {
    throw new Error('STEP conversion did not return a valid GLB binary (invalid header)')
  }

  return buffer
}

async function parseStepError(res: Response): Promise<string> {
  const fallback = `STEP conversion failed (HTTP ${res.status})`
  const ct = res.headers.get('Content-Type') || ''
  if (ct.includes('json')) {
    try {
      const data = (await res.json()) as { detail?: string; title?: string }
      if (data.detail) return data.detail
      if (data.title) return data.title
    } catch {
      /* ignore */
    }
  }
  if (res.status === 413) return 'STEP file exceeds server upload limit'
  if (res.status === 504) return 'STEP conversion timed out on server'
  return fallback
}
