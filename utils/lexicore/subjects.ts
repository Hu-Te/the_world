/** 常用科目选项（财务校准下拉） */

export type SubjectOption = { value: string; label: string }

export const SUBJECT_OPTIONS: SubjectOption[] = [
  { value: '6602 管理费用', label: '6602 管理费用' },
  { value: '6602.01 管理费用-差旅交通', label: '6602.01 差旅交通' },
  { value: '6602.02 管理费用-业务招待', label: '6602.02 业务招待' },
  { value: '6602.03 管理费用-差旅住宿', label: '6602.03 差旅住宿' },
  { value: '6602.04 管理费用-办公费', label: '6602.04 办公费' },
  { value: '6601 销售费用', label: '6601 销售费用' },
  { value: '6401 主营业务成本', label: '6401 主营业务成本' },
  { value: '1001 库存现金', label: '1001 库存现金' },
  { value: '1002 银行存款', label: '1002 银行存款' },
  { value: '1221 其他应收款', label: '1221 其他应收款' },
  { value: '2241 其他应付款', label: '2241 其他应付款' },
]

export const LOW_CONFIDENCE = 0.85

export function isLowConfidence(c: number | string | undefined | null): boolean {
  const n = Number(c)
  if (Number.isNaN(n)) return true
  return n < LOW_CONFIDENCE
}
