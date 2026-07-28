import { apiFetch } from '~/utils/api/http'

const BASE = '/api/console/finance'

export type FxAccountLine = {
  accountCode: string
  accountName: string
  currencyCode: string
  foreignBalance: string | number
  bookLocalAmount: string | number
  priorYearClosingRate: string | number
  adjustmentRate: string | number
  adjustedLocalAmount: string | number
  exchangeDifference: string | number
}

export type FxYearEndAdjustment = {
  id: string | number
  tenantId: string | number
  fiscalYear: number
  title: string
  functionalCurrency: string
  status: string
  totalExchangeDifference: string | number
  lines: FxAccountLine[]
  createdAt: string
  updatedAt: string
}

export type CreateFxAdjustmentBody = {
  fiscalYear: number
  title?: string
  functionalCurrency?: string
}

export type AddFxLineBody = {
  accountCode: string
  accountName?: string
  currencyCode: string
  foreignBalance: number | string
  bookLocalAmount: number | string
  priorYearClosingRate: number | string
  adjustmentRate: number | string
}

export function listFxAdjustments() {
  return apiFetch<FxYearEndAdjustment[]>(`${BASE}/fx-adjustments`)
}

export function getFxAdjustment(id: string | number) {
  return apiFetch<FxYearEndAdjustment>(`${BASE}/fx-adjustments/${id}`)
}

export function createFxAdjustment(body: CreateFxAdjustmentBody) {
  return apiFetch<FxYearEndAdjustment>(`${BASE}/fx-adjustments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function addFxLine(id: string | number, body: AddFxLineBody) {
  return apiFetch<FxYearEndAdjustment>(`${BASE}/fx-adjustments/${id}/lines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function calculateFxAdjustment(id: string | number) {
  return apiFetch<FxYearEndAdjustment>(`${BASE}/fx-adjustments/${id}/calculate`, {
    method: 'POST',
  })
}

export function postFxAdjustment(id: string | number) {
  return apiFetch<FxYearEndAdjustment>(`${BASE}/fx-adjustments/${id}/post`, {
    method: 'POST',
  })
}
