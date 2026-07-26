import { apiFetch, apiUpload, toolAuthHeaders, toolRequestUrl } from '~/utils/api/http'
import { getReconAccessToken } from './session'
import type { AiSuggestion, ReconId, ReconTaskDetail } from './types'

function reconHeaders(taskId: ReconId): Record<string, string> {
  const token = getReconAccessToken(taskId)
  if (!token) throw new Error('本机会话密钥已失效，请重新上传勾稽')
  return { 'X-Recon-Token': token }
}

export function createReconTask(body: {
  title?: string
  corpEndBalance: number
  bankEndBalance: number
}) {
  return apiFetch<{ taskId: ReconId; accessToken: string; expiresAt: string }>(
    '/api/recon/tasks',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )
}

export function deleteReconTask(taskId: ReconId) {
  return apiFetch<null>(`/api/recon/tasks/${taskId}`, {
    method: 'DELETE',
    headers: reconHeaders(taskId),
  })
}

/** 尽力在页面卸载时销毁任务（无法保证完成） */
export function deleteReconTaskBeacon(taskId: ReconId) {
  if (typeof fetch === 'undefined') return
  let token: string | null = null
  try {
    token = getReconAccessToken(taskId)
  } catch {
    return
  }
  if (!token) return
  let headers: Record<string, string>
  try {
    headers = { Accept: 'application/json', 'X-Recon-Token': token, ...toolAuthHeaders() }
  } catch {
    return
  }
  void fetch(toolRequestUrl(`/api/recon/tasks/${taskId}`), {
    method: 'DELETE',
    headers,
    keepalive: true,
  }).catch(() => {})
}

/** 两侧各可多文件；FormData 同名 part 重复 append */
export function uploadReconFiles(
  taskId: ReconId,
  corpFiles: File[],
  bankFiles: File[],
  columnMap?: Record<string, string>,
) {
  const form = new FormData()
  for (const f of corpFiles) form.append('corpFile', f)
  for (const f of bankFiles) form.append('bankFile', f)
  if (columnMap) form.append('columnMap', JSON.stringify(columnMap))
  return apiUpload<ReconTaskDetail>(
    `/api/recon/tasks/${taskId}/upload`,
    form,
    reconHeaders(taskId),
  )
}

export function runReconMatch(taskId: ReconId) {
  return apiFetch<ReconTaskDetail>(`/api/recon/tasks/${taskId}/match`, {
    method: 'POST',
    headers: reconHeaders(taskId),
  })
}

export function getReconTask(taskId: ReconId) {
  return apiFetch<ReconTaskDetail>(`/api/recon/tasks/${taskId}`, {
    headers: reconHeaders(taskId),
  })
}

export function manualLinkRecon(
  taskId: ReconId,
  corpIds: ReconId[],
  bankIds: ReconId[],
) {
  return apiFetch<ReconTaskDetail>(`/api/recon/tasks/${taskId}/manual-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...reconHeaders(taskId),
    },
    body: JSON.stringify({ corpIds, bankIds }),
  })
}

export function confirmFuzzyRecon(taskId: ReconId, groupId: ReconId) {
  return apiFetch<ReconTaskDetail>(`/api/recon/tasks/${taskId}/confirm-fuzzy`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...reconHeaders(taskId),
    },
    body: JSON.stringify({ groupId }),
  })
}

export function aiAssistRecon(taskId: ReconId) {
  return apiFetch<{ suggestions: AiSuggestion[]; note?: string }>(
    `/api/recon/tasks/${taskId}/ai-assist`,
    {
      method: 'POST',
      headers: reconHeaders(taskId),
    },
  )
}
