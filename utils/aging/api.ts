/** FIFO Aging API */

export type AgingOpenItem = {
  originDate: string
  remaining: string | number
  agingDays: number
  bucket: string
  provision: string | number
  memo: string
}

export type AgingParty = {
  targetCode: string
  openBalance: string | number
  provision: string | number
  unallocatedCredit: string | number
  worstBucket: string
  bucketBalances: Record<string, string | number>
  openItems: AgingOpenItem[]
}

export type AgingReport = {
  auditDate: string
  parsedTxCount: number
  debitCount: number
  creditCount: number
  partyCount: number
  totalOpenBalance: string | number
  totalProvision: string | number
  bucketTotals: Record<string, string | number>
  parties: AgingParty[]
  note: string
}

export const MAX_AGING_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = ['.xlsx', '.xls', '.csv']

export const BUCKET_LABEL: Record<string, string> = {
  WITHIN_ONE_YEAR: '1年以内',
  ONE_TO_TWO_YEARS: '1–2年',
  TWO_TO_THREE_YEARS: '2–3年',
  OVER_THREE_YEARS: '3年以上',
}

export const BUCKET_RATE: Record<string, string> = {
  WITHIN_ONE_YEAR: '5%',
  ONE_TO_TWO_YEARS: '10%',
  TWO_TO_THREE_YEARS: '50%',
  OVER_THREE_YEARS: '100%',
}

export function validateAgingUpload(file: File): string | null {
  const name = (file.name || '').toLowerCase()
  if (!ALLOWED_EXT.some((ext) => name.endsWith(ext))) {
    return '仅支持 .xlsx / .xls / .csv'
  }
  if (file.size > MAX_AGING_UPLOAD_BYTES) {
    return '文件过大，请控制在 5MB 以内'
  }
  return null
}

/**
 * Column indices for ledger parse (0-based, Excel A=0).
 * Default matches common exports: code | date | memo | debit | credit
 */
export const DEFAULT_MAPPING_CONFIG: Record<string, number> = {
  targetCode: 0,
  txDate: 1,
  debitAmount: 3,
  creditAmount: 4,
}

export async function scanAgingLedger(
  file: File,
  auditDate?: string,
  mappingConfig: Record<string, number> = DEFAULT_MAPPING_CONFIG,
): Promise<AgingReport> {
  const bad = validateAgingUpload(file)
  if (bad) throw new Error(bad)
  const { apiUpload } = await import('~/utils/api/http')
  const form = new FormData()
  form.append('file', file)
  form.append('mappingConfig', JSON.stringify(mappingConfig))
  const q = auditDate ? `?auditDate=${encodeURIComponent(auditDate)}` : ''
  return apiUpload<AgingReport>(`/api/aging/scan${q}`, form)
}

export function money(n: string | number | undefined | null): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '¥0.00'
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(v)
}

export function num(n: string | number | undefined | null): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}
