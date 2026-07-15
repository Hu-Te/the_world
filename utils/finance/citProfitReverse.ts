/** 企业所得税 × 税后利润逆向推导（纯前端，中间高精度、展示两位轧平） */

export type CitMode = 'minRevenue' | 'maxCost'

export type CitReverseInput = {
  /** 目标税后利润 */
  afterTaxProfit: number
  /** 企业所得税税率，0–1 */
  taxRate: number
  /** 研发费用（已计入成本口径时可仍输入用于加计） */
  rdExpense: number
  /** 加计扣除比例，0–1；100% → 1 */
  rdSuperDeduction: number
  mode: CitMode
  /** 模式 A：给定总成本 */
  totalCost?: number
  /** 模式 B：给定营收 */
  revenue?: number
}

export type CitReverseResult = {
  ok: true
  /** 税前利润 π（展示两位） */
  preTaxProfit: number
  /** 应纳税所得额 */
  taxableIncome: number
  /** 应交所得税（轧平使 preTax = afterTaxDisp + tax） */
  incomeTax: number
  /** 展示用税后（与输入一致，两位） */
  afterTaxProfit: number
  /** 模式 A */
  minRevenue?: number
  /** 模式 B */
  maxCost?: number
  /** 有效税负 incomeTax / |preTax| */
  effectiveTaxRate: number
  /** 中间量说明（未 round） */
  meta: {
    preTaxRaw: number
    rdExtraDeduction: number
  }
}

export type CitReverseError = {
  ok: false
  message: string
}

export type CitReverseOutput = CitReverseResult | CitReverseError

const SCALE = 1e8

function toRaw(n: number): number {
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * SCALE) / SCALE
}

/** 四舍五入到分 */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return NaN
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * 由目标税后利润反推税前利润。
 * 假设税前利润覆盖研发加计：π - t·max(0, π - RD·λ) = P
 * 在 π > RD·λ 时：π = (P - t·RD·λ) / (1-t)
 */
export function reverseCitProfit(input: CitReverseInput): CitReverseOutput {
  const P = toRaw(input.afterTaxProfit)
  const t = toRaw(input.taxRate)
  const rd = Math.max(0, toRaw(input.rdExpense ?? 0))
  const lambda = Math.max(0, toRaw(input.rdSuperDeduction ?? 0))

  if (!Number.isFinite(P)) {
    return { ok: false, message: '请输入有效的目标税后利润' }
  }
  if (!Number.isFinite(t) || t < 0 || t >= 1) {
    return { ok: false, message: '税率须在 0%～100% 之间（不含 100%）' }
  }
  if (!Number.isFinite(rd) || !Number.isFinite(lambda)) {
    return { ok: false, message: '研发费用或加计比例无效' }
  }
  if (lambda > 2) {
    return { ok: false, message: '加计扣除比例异常，请控制在 0%～200%' }
  }

  const rdExtra = toRaw(rd * lambda)
  const preTaxRaw = toRaw((P - t * rdExtra) / (1 - t))

  if (!Number.isFinite(preTaxRaw)) {
    return { ok: false, message: '无法求解税前利润，请检查输入' }
  }

  // 应纳税所得额（中间高精度）
  let taxableRaw = toRaw(preTaxRaw - rdExtra)
  if (taxableRaw < 0) taxableRaw = 0
  const taxRaw = toRaw(taxableRaw * t)

  // 展示轧平：税前两位；税后按输入两位；税额 = 税前 - 税后（减法挤入税额）
  const preTaxProfit = roundMoney(preTaxRaw)
  const afterTaxProfit = roundMoney(P)
  let incomeTax = roundMoney(preTaxProfit - afterTaxProfit)
  if (incomeTax < 0) incomeTax = 0
  // 若因加计导致名义税后与反推不完全一致，仍以轧平关系展示
  const taxableIncome = roundMoney(Math.max(0, preTaxProfit - roundMoney(rdExtra)))

  const base: CitReverseResult = {
    ok: true,
    preTaxProfit,
    taxableIncome,
    incomeTax,
    afterTaxProfit,
    effectiveTaxRate:
      preTaxProfit === 0 ? 0 : roundMoney((incomeTax / Math.abs(preTaxProfit)) * 10000) / 10000,
    meta: { preTaxRaw, rdExtraDeduction: rdExtra },
  }

  if (input.mode === 'minRevenue') {
    const C = toRaw(input.totalCost ?? 0)
    if (!Number.isFinite(C) || C < 0) {
      return { ok: false, message: '请输入有效的总成本（≥0）' }
    }
    return { ...base, minRevenue: roundMoney(preTaxProfit + C) }
  }

  const R = toRaw(input.revenue ?? 0)
  if (!Number.isFinite(R) || R < 0) {
    return { ok: false, message: '请输入有效的营收（≥0）' }
  }
  const maxCost = roundMoney(R - preTaxProfit)
  return { ...base, maxCost }
}

export function formatCitSummary(
  input: CitReverseInput,
  result: CitReverseResult,
): string {
  const pct = (x: number) => `${roundMoney(x * 100)}%`
  const lines = [
    '【企税利润倒推摘要】',
    `模式：${input.mode === 'minRevenue' ? '估最低营收' : '估最大成本'}`,
    `目标税后利润：${result.afterTaxProfit}`,
    `企业所得税率：${pct(input.taxRate)}`,
    `研发费用：${roundMoney(input.rdExpense)}；加计比例：${pct(input.rdSuperDeduction)}`,
    `税前利润：${result.preTaxProfit}`,
    `应纳税所得额：${result.taxableIncome}`,
    `应交所得税：${result.incomeTax}`,
  ]
  if (result.minRevenue != null) {
    lines.push(`总成本：${roundMoney(input.totalCost ?? 0)}`)
    lines.push(`结论·最低营收：${result.minRevenue}`)
  }
  if (result.maxCost != null) {
    lines.push(`给定营收：${roundMoney(input.revenue ?? 0)}`)
    lines.push(`结论·最大成本：${result.maxCost}`)
  }
  lines.push('（简化测算，非正式申报依据）')
  return lines.join('\n')
}
