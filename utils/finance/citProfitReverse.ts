/** 企业所得税 × 税后利润逆向推导（纯前端，中间高精度、展示两位轧平） */

export type CitMode = 'minRevenue' | 'maxCost'

/**
 * 多场景输入：
 * - 成本/收入可分项汇总，也可只填合计
 * - 纳税调整：调增、免税、亏损弥补 + 研发加计
 */
export type CitReverseInput = {
  /** 目标税后利润 */
  afterTaxProfit: number
  /** 企业所得税税率，0–1 */
  taxRate: number
  mode: CitMode

  /** —— 成本侧（模式 A；分项与合计可并存，优先分项之和） —— */
  /** 营业成本 */
  operatingCost?: number
  /** 期间费用（销售/管理/财务等） */
  periodExpense?: number
  /** 其他支出（营业外、资产处置亏损、一次性开支等） */
  otherExpense?: number
  /** 兼容旧字段：总成本合计 */
  totalCost?: number

  /** —— 收入侧（模式 B） —— */
  /** 营业收入 */
  operatingRevenue?: number
  /** 其他收益（投资收益、营业外收入等） */
  otherIncome?: number
  /** 兼容旧字段：营收合计 */
  revenue?: number

  /** —— 税政 / 纳税调整 —— */
  /** 研发费用（已计入成本口径时可仍输入用于加计） */
  rdExpense?: number
  /** 加计扣除比例，0–1；100% → 1 */
  rdSuperDeduction?: number
  /** 纳税调增（不得税前扣除：罚款、超标招待费等） */
  taxAddBack?: number
  /** 免税收入 */
  taxExemptIncome?: number
  /** 弥补以前年度亏损 */
  lossCarryforward?: number
}

export type CitReverseResult = {
  ok: true
  preTaxProfit: number
  taxableIncome: number
  incomeTax: number
  afterTaxProfit: number
  minRevenue?: number
  maxCost?: number
  /** 有效税负 = 税额 / |税前| */
  effectiveTaxRate: number
  /** 成本合计（模式 A） */
  costSum?: number
  /** 收入合计（模式 B） */
  revenueSum?: number
  meta: {
    preTaxRaw: number
    /** 应纳税所得额相对会计利润的净调整：调增 - 免税 - 加计 - 亏损 */
    taxBaseAdj: number
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

function nonNeg(n: number | undefined | null): number {
  const v = toRaw(n ?? 0)
  if (!Number.isFinite(v)) return NaN
  return Math.max(0, v)
}

function isFilled(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

/** 成本分项优先；否则用 totalCost；都未填返回 null */
export function resolveCostSum(input: CitReverseInput): number | null {
  const hasBreakdown = [input.operatingCost, input.periodExpense, input.otherExpense].some(
    isFilled,
  )
  if (hasBreakdown) {
    return toRaw(
      nonNeg(input.operatingCost) + nonNeg(input.periodExpense) + nonNeg(input.otherExpense),
    )
  }
  if (isFilled(input.totalCost)) return nonNeg(input.totalCost)
  return null
}

/** 收入分项优先；否则用 revenue；都未填返回 null */
export function resolveRevenueSum(input: CitReverseInput): number | null {
  const hasBreakdown = [input.operatingRevenue, input.otherIncome].some(isFilled)
  if (hasBreakdown) {
    return toRaw(nonNeg(input.operatingRevenue) + nonNeg(input.otherIncome))
  }
  if (isFilled(input.revenue)) return nonNeg(input.revenue)
  return null
}

/**
 * π - t·max(0, π + Adj) = P
 * Adj = 调增 - 免税 - 研发加计 - 亏损弥补
 * 当 π+Adj>0：π = (P + t·Adj) / (1-t)
 * 当无税：π = P
 */
export function reverseCitProfit(input: CitReverseInput): CitReverseOutput {
  const P = toRaw(input.afterTaxProfit)
  const t = toRaw(input.taxRate)
  const rd = nonNeg(input.rdExpense ?? 0)
  const lambda = Math.max(0, toRaw(input.rdSuperDeduction ?? 0))
  const addBack = nonNeg(input.taxAddBack ?? 0)
  const exempt = nonNeg(input.taxExemptIncome ?? 0)
  const loss = nonNeg(input.lossCarryforward ?? 0)

  if (!Number.isFinite(P)) {
    return { ok: false, message: '请输入有效的目标税后利润' }
  }
  if (!Number.isFinite(t) || t < 0 || t >= 1) {
    return { ok: false, message: '税率须在 0%～100% 之间（不含 100%）' }
  }
  if ([rd, lambda, addBack, exempt, loss].some((x) => !Number.isFinite(x))) {
    return { ok: false, message: '税政或调整项无效（须 ≥ 0）' }
  }
  if (lambda > 2) {
    return { ok: false, message: '加计扣除比例异常，请控制在 0%～200%' }
  }

  const rdExtra = toRaw(rd * lambda)
  const adj = toRaw(addBack - exempt - rdExtra - loss)

  let preTaxRaw = toRaw((P + t * adj) / (1 - t))
  if (!Number.isFinite(preTaxRaw)) {
    return { ok: false, message: '无法求解税前利润，请检查输入' }
  }

  // 无应税所得时：税额为 0，税前 = 税后
  let taxableRaw = toRaw(preTaxRaw + adj)
  if (taxableRaw <= 0) {
    preTaxRaw = P
    taxableRaw = 0
  }

  const preTaxProfit = roundMoney(preTaxRaw)
  const afterTaxProfit = roundMoney(P)
  let incomeTax = roundMoney(preTaxProfit - afterTaxProfit)
  if (incomeTax < 0) incomeTax = 0
  const taxableIncome = roundMoney(Math.max(0, taxableRaw))

  const base: CitReverseResult = {
    ok: true,
    preTaxProfit,
    taxableIncome,
    incomeTax,
    afterTaxProfit,
    effectiveTaxRate:
      preTaxProfit === 0
        ? 0
        : roundMoney((incomeTax / Math.abs(preTaxProfit)) * 10000) / 10000,
    meta: {
      preTaxRaw,
      taxBaseAdj: adj,
      rdExtraDeduction: rdExtra,
    },
  }

  if (input.mode === 'minRevenue') {
    const C = resolveCostSum(input)
    if (C == null || !Number.isFinite(C) || C < 0) {
      return { ok: false, message: '请填写至少一项成本（营业成本 / 期间费用 / 其他支出）' }
    }
    return {
      ...base,
      costSum: roundMoney(C),
      minRevenue: roundMoney(preTaxProfit + C),
    }
  }

  const R = resolveRevenueSum(input)
  if (R == null || !Number.isFinite(R) || R < 0) {
    return { ok: false, message: '请填写至少一项收入（营业收入 / 其他收益）' }
  }
  return {
    ...base,
    revenueSum: roundMoney(R),
    maxCost: roundMoney(R - preTaxProfit),
  }
}

export function formatCitSummary(
  input: CitReverseInput,
  result: CitReverseResult,
): string {
  const pct = (x: number) => `${roundMoney(x * 100)}%`
  const money = (n: number) => `${roundMoney(n)}`
  const lines = [
    '【企税利润倒推摘要】',
    `模式：${input.mode === 'minRevenue' ? '估最低营收' : '估最大成本'}`,
    `目标税后利润：${money(result.afterTaxProfit)}`,
    `企业所得税率：${pct(input.taxRate)}`,
    `研发费用：${money(input.rdExpense ?? 0)}；加计：${pct(input.rdSuperDeduction ?? 0)}`,
    `纳税调增：${money(input.taxAddBack ?? 0)}；免税收入：${money(input.taxExemptIncome ?? 0)}；弥补亏损：${money(input.lossCarryforward ?? 0)}`,
    `税基净调整：${money(result.meta.taxBaseAdj)}`,
    `税前利润：${money(result.preTaxProfit)}`,
    `应纳税所得额：${money(result.taxableIncome)}`,
    `应交所得税：${money(result.incomeTax)}`,
    `有效税负：${pct(result.effectiveTaxRate)}`,
  ]
  if (result.minRevenue != null) {
    lines.push(
      `成本·营业 ${money(input.operatingCost ?? 0)} + 期间 ${money(input.periodExpense ?? 0)} + 其他 ${money(input.otherExpense ?? 0)} = ${money(result.costSum ?? 0)}`,
    )
    lines.push(`结论·最低营收：${money(result.minRevenue)}`)
  }
  if (result.maxCost != null) {
    lines.push(
      `收入·营业 ${money(input.operatingRevenue ?? 0)} + 其他 ${money(input.otherIncome ?? 0)} = ${money(result.revenueSum ?? 0)}`,
    )
    lines.push(`结论·最大可配成本：${money(result.maxCost)}`)
  }
  lines.push('（简化测算，含常见纳税调整；非正式申报依据）')
  return lines.join('\n')
}
