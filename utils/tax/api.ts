/** Tax Dividend Scanner API */

export type AccountHit = {
  accountCode: string
  accountName: string
  role: string
  deductionType: string
  amount: string | number
}

export type AdviceItem = {
  category: string
  title: string
  severity: string
  summary: string
  actions: string[]
  relatedAccountCode: string
}

export type TaxReport = {
  taxStatus: string
  revenue: string | number
  cost: string | number
  periodExpense: string | number
  rdExpense: string | number
  entertainmentExpense: string | number
  estimatedProfit: string | number
  taxableIncome: string | number
  taxBurdenRate: string | number
  currentEstimatedTax: string | number
  microCliffExtraTax: string | number
  headroomToCap: string | number
  cliffIfExceed: string | number
  microCritical: boolean
  entertainmentLimit: string | number
  entertainmentAddBack: string | number
  rdAdditionalDeduction: string | number
  rdTaxSaving: string | number
  harvestedBenefit: string | number
  potentialRisk: string | number
  parsedLineCount: number
  leafLineCount: number
  scoredLineCount: number
  ignoredLineCount: number
  amountBasis: string
  accountHits: AccountHit[]
  advice: AdviceItem[]
  note: string
}

export const MAX_TAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED_EXT = ['.xlsx', '.xls', '.csv']

export function validateTaxUpload(file: File): string | null {
  const name = (file.name || '').toLowerCase()
  if (!ALLOWED_EXT.some((ext) => name.endsWith(ext))) {
    return '仅支持 .xlsx / .xls / .csv'
  }
  if (file.size > MAX_TAX_UPLOAD_BYTES) {
    return '文件过大，请控制在 5MB 以内'
  }
  return null
}

export async function scanTrialBalance(file: File): Promise<TaxReport> {
  const bad = validateTaxUpload(file)
  if (bad) throw new Error(bad)
  const { apiUpload } = await import('~/utils/api/http')
  const form = new FormData()
  form.append('file', file)
  return apiUpload<TaxReport>('/api/tax/scan', form)
}

export function money(n: string | number | undefined | null): string {
  const v = Number(n)
  if (!Number.isFinite(v)) return '¥0.00'
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

/** 无报告时显示破折号，避免假零值 */
export function moneyOrDash(
  n: string | number | undefined | null,
  hasReport: boolean,
): string {
  if (!hasReport) return '—'
  return money(n)
}

export function pct(rate: string | number | undefined | null): string {
  const v = Number(rate)
  if (!Number.isFinite(v)) return '0.00%'
  return `${(v * 100).toFixed(2)}%`
}

export function pctOrDash(
  rate: string | number | undefined | null,
  hasReport: boolean,
): string {
  if (!hasReport) return '—'
  return pct(rate)
}

export function escapeHtml(raw: string): string {
  return String(raw)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 建议科目必须落在命中列表内，防止臆造编码跳转 */
export function resolveRelatedCode(
  code: string | undefined | null,
  hits: AccountHit[] | undefined,
): string {
  const c = (code || '').trim()
  if (!c || !hits?.length) return ''
  const lower = c.toLowerCase()
  return hits.some((h) => (h.accountCode || '').toLowerCase() === lower) ? c : ''
}
