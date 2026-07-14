/** 雪花 ID：后端 JSON 为字符串，禁止 Number() */
export type ReconId = string

export type ReconEntry = {
  id: ReconId
  side: 'CORP' | 'BANK'
  date: string
  debit: number
  credit: number
  counterparty: string
  summary: string
  matchStatus: 0 | 1 | 2 | 3
  matchGroupId: ReconId | null
}

export type ReconLink = {
  groupId: ReconId
  status: number
  rule: string
  corpIds: ReconId[]
  bankIds: ReconId[]
  score: number
}

export type BalanceBucket = {
  key: string
  label: string
  amount: number
  recordIds: ReconId[]
}

export type BalanceSheet = {
  corpEndBalance: number
  bankEndBalance: number
  corpAdjusted: number
  bankAdjusted: number
  buckets: BalanceBucket[]
}

export type ReconTaskDetail = {
  id: ReconId
  title: string
  corpEndBalance: number
  bankEndBalance: number
  corpEntries: ReconEntry[]
  bankEntries: ReconEntry[]
  links: ReconLink[]
  balanceSheet: BalanceSheet
}

export type ReconTaskSummary = {
  id: ReconId
  title: string
  corpEndBalance: number
  bankEndBalance: number
}

export type AiSuggestion = {
  corpId: ReconId
  bankId: ReconId
  confidence: number
  reason: string
}

export type ReconFilter = 'all' | 'matched' | 'fuzzy' | 'unmatched'

export const STATUS_LABEL: Record<number, string> = {
  0: '未匹配',
  1: '精准',
  2: '疑似',
  3: '人工',
}

/** 已勾定（精准/人工），不可再手选连线 */
export function isLockedMatch(status: number): boolean {
  return status === 1 || status === 3
}

/** 疑似匹配，只允许确认，不允许再手选覆盖 */
export function isFuzzyMatch(status: number): boolean {
  return status === 2
}

export function isReconId(value: unknown): value is ReconId {
  return typeof value === 'string' && /^\d+$/.test(value)
}
