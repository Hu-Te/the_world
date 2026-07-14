import type { ReconId } from './types'

const PREFIX = 'recon:access:'

export function saveReconAccessToken(taskId: ReconId, accessToken: string) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(PREFIX + String(taskId), accessToken)
}

export function getReconAccessToken(taskId: ReconId): string | null {
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage.getItem(PREFIX + String(taskId))
}

export function clearReconAccessToken(taskId: ReconId) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(PREFIX + String(taskId))
}
