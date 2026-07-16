import type { CitMode, CitReverseInput, CitReverseResult } from './citProfitReverse'

const KEY = 'cit-profit:history:v2'
const MAX = 20

export type CitHistoryItem = {
  id: string
  savedAt: number
  input: CitReverseInput
  headline: string
  result: Pick<
    CitReverseResult,
    | 'preTaxProfit'
    | 'incomeTax'
    | 'afterTaxProfit'
    | 'minRevenue'
    | 'maxCost'
    | 'effectiveTaxRate'
    | 'costSum'
    | 'revenueSum'
  >
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

export function loadCitHistory(): CitHistoryItem[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CitHistoryItem[]
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, MAX)
  } catch {
    return []
  }
}

export function saveCitHistoryItem(
  input: CitReverseInput,
  result: CitReverseResult,
): CitHistoryItem[] {
  const headline =
    input.mode === 'minRevenue'
      ? `最低营收 ${result.minRevenue ?? '—'}`
      : `最大成本 ${result.maxCost ?? '—'}`
  const item: CitHistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
    input: { ...input },
    headline,
    result: {
      preTaxProfit: result.preTaxProfit,
      incomeTax: result.incomeTax,
      afterTaxProfit: result.afterTaxProfit,
      minRevenue: result.minRevenue,
      maxCost: result.maxCost,
      effectiveTaxRate: result.effectiveTaxRate,
      costSum: result.costSum,
      revenueSum: result.revenueSum,
    },
  }
  const next = [
    item,
    ...loadCitHistory().filter((h) => JSON.stringify(h.input) !== JSON.stringify(input)),
  ].slice(0, MAX)
  if (canUseStorage()) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* quota */
    }
  }
  return next
}

export function clearCitHistory() {
  if (canUseStorage()) localStorage.removeItem(KEY)
}

export function modeLabel(mode: CitMode): string {
  return mode === 'minRevenue' ? '估最低营收' : '估最大成本'
}
