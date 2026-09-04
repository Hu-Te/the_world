/**
 * 财务审计桌面端 — 云端分发客户端。
 * 仅调用 /api/console/finance/desktop/**；禁止与工具舱写云 API 混用。
 */
import { apiFetch } from '~/utils/api/http'

const BASE = '/api/console/finance/desktop'

export type FinanceDesktopManifest = {
  moduleCode: string
  productName: string
  version: string
  minClientVersion: string
  status: string
  readme: string
  windowsArtifact?: string | null
  macosArtifact?: string | null
  dataDirPattern: string
}

export type FinanceDesktopPlatform = 'windows' | 'macos'

export class DownloadAbortedError extends Error {
  constructor(message = '已停止下载') {
    super(message)
    this.name = 'DownloadAbortedError'
  }
}

function apiOrigin(): string {
  const config = useRuntimeConfig()
  return String(config.public.apiOrigin || '').replace(/\/$/, '')
}

function authHeaders(): HeadersInit {
  const auth = useAuthStore()
  auth.hydrate()
  const jwt = auth.accessToken || ''
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

/** 字节 → 可读 MB（保留 1 位小数） */
export function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 0.1) return `${(bytes / 1024).toFixed(0)} KB`
  return `${mb.toFixed(1)} MB`
}

export function fetchFinanceDesktopManifest() {
  return apiFetch<FinanceDesktopManifest>(`${BASE}/manifest`)
}

export type FinanceDesktopDownloadTicket = {
  downloadPath?: string | null
  downloadUrl?: string | null
  filename: string
}

/** 签发短时下载 URL（优先 COS/CDN 绝对地址，否则本站 X-Accel）。 */
export async function issueFinanceDesktopDownloadTicket(
  platform: FinanceDesktopPlatform,
): Promise<FinanceDesktopDownloadTicket> {
  return apiFetch<FinanceDesktopDownloadTicket>(
    `${BASE}/download-ticket?platform=${encodeURIComponent(platform)}`,
    { method: 'POST' },
  )
}

/** 浏览器下载栏拉取安装包（勿再用 fetch 拼 Blob）。 */
export function startFinanceDesktopNativeDownload(ticket: FinanceDesktopDownloadTicket) {
  const absolute = (ticket.downloadUrl || '').trim()
  const path = (ticket.downloadPath || '').trim()
  const url = absolute || (path ? `${apiOrigin()}${path}` : '')
  if (!url) {
    throw new Error('下载地址为空')
  }
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** @deprecated 大包请用 issueFinanceDesktopDownloadTicket + startFinanceDesktopNativeDownload */
export async function downloadFinanceDesktopPackage(
  platform: FinanceDesktopPlatform,
  onProgress?: (loaded: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<{ filename: string; bytes: Blob }> {
  const url = `${apiOrigin()}${BASE}/download?platform=${encodeURIComponent(platform)}`
  const res = await fetch(url, {
    headers: { ...authHeaders(), Accept: 'application/octet-stream' },
    signal,
  })
  if (!res.ok) {
    let msg = `下载失败 (${res.status})`
    try {
      const j = (await res.json()) as { message?: string }
      if (j?.message) msg = j.message
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const total = Number(res.headers.get('Content-Length') || '') || null
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = /filename=\"([^\"]+)\"/.exec(disposition)
  const filename =
    match?.[1] ||
    (platform === 'macos' ? 'finance-desktop-macos.dmg' : 'finance-desktop-windows.zip')

  if (!res.body) {
    return { filename, bytes: await res.blob() }
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  try {
    for (;;) {
      if (signal?.aborted) {
        await reader.cancel()
        throw new DownloadAbortedError()
      }
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        chunks.push(value)
        loaded += value.length
        onProgress?.(loaded, total)
      }
    }
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
      throw new DownloadAbortedError()
    }
    throw e
  }
  return { filename, bytes: new Blob(chunks as BlobPart[]) }
}

export function saveFinanceDesktopBlob(filename: string, bytes: Blob) {
  const a = document.createElement('a')
  const href = URL.createObjectURL(bytes)
  a.href = href
  a.download = filename
  a.click()
  URL.revokeObjectURL(href)
}

export type FinanceDesktopOfflineToken = {
  token: string
  deepLinkUrl: string
}

/** 签发财务桌面离线 JWT，并返回 fintools:// Deep Link。 */
export function issueFinanceOfflineToken() {
  return apiFetch<FinanceDesktopOfflineToken>(`${BASE}/offline-token`, { method: 'POST' })
}
