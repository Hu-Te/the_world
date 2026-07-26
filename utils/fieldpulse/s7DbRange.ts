/**
 * S7 DB 连续点位生成（PLC4X 绝对地址：%DBn:byte.bit:TYPE）。
 * 步进与西门子数据长度对齐，避免错位读导致数值错误。
 */

export type S7BulkDataType =
  | 'BOOL'
  | 'BYTE'
  | 'INT'
  | 'WORD'
  | 'DINT'
  | 'DWORD'
  | 'REAL'
  | 'LREAL'

export type S7BulkTag = {
  tagKey: string
  address: string
  dataType: S7BulkDataType
}

/** 类型占用字节数（BOOL 按位，返回 0 表示走 bit 步进） */
export function s7TypeStrideBytes(type: S7BulkDataType): number {
  switch (type) {
    case 'BOOL':
      return 0
    case 'BYTE':
      return 1
    case 'INT':
    case 'WORD':
      return 2
    case 'DINT':
    case 'DWORD':
    case 'REAL':
      return 4
    case 'LREAL':
      return 8
    default:
      return 4
  }
}

/** 多字节类型对齐要求（字节边界） */
export function s7TypeAlignBytes(type: S7BulkDataType): number {
  switch (type) {
    case 'BOOL':
    case 'BYTE':
      return 1
    case 'INT':
    case 'WORD':
      return 2
    case 'DINT':
    case 'DWORD':
    case 'REAL':
      return 2 // S7 常允许 2 对齐；严格 4 对齐可用 alignStrict
    case 'LREAL':
      return 4
    default:
      return 1
  }
}

export function alignDown(offset: number, align: number): number {
  if (align <= 1) return offset
  return Math.floor(offset / align) * align
}

export function alignUp(offset: number, align: number): number {
  if (align <= 1) return offset
  return Math.ceil(offset / align) * align
}

export type BuildDbRangeOpts = {
  dbNumber: number
  /** 起始字节偏移 */
  startByte: number
  /** BOOL 时的起始位 0–7 */
  startBit?: number
  count: number
  dataType: S7BulkDataType
  /** 变量名前缀，默认 db{n}_ */
  namePrefix?: string
  /**
   * true：起始偏移自动上对齐到类型边界（保证不读错位）
   * false：严格使用用户输入（不对齐时抛错）
   */
  autoAlign?: boolean
  /** 最大点数，默认 128（避免单次 PDU/轮询过载） */
  maxCount?: number
}

export type BuildDbRangeResult = {
  tags: S7BulkTag[]
  /** 实际使用的起始字节（可能因对齐调整） */
  effectiveStartByte: number
  effectiveStartBit: number
  /** 末尾占用到的下一字节偏移（不含） */
  endByteExclusive: number
  warnings: string[]
}

/**
 * 生成连续 DB 点位。地址格式与现有工脉一致：`%DB1:4.0:REAL`
 */
export function buildS7DbRangeTags(opts: BuildDbRangeOpts): BuildDbRangeResult {
  const db = Math.trunc(opts.dbNumber)
  const count = Math.trunc(opts.count)
  const maxCount = opts.maxCount ?? 128
  const autoAlign = opts.autoAlign !== false
  const warnings: string[] = []

  if (!Number.isFinite(db) || db < 1) {
    throw new Error('DB 号必须 ≥ 1')
  }
  if (!Number.isFinite(count) || count < 1) {
    throw new Error('数量必须 ≥ 1')
  }
  if (count > maxCount) {
    throw new Error(`单次最多 ${maxCount} 点（过多易超 PLC PDU / 拖慢轮询）。请缩小数量或分批。`)
  }

  let startByte = Math.trunc(opts.startByte)
  let startBit = Math.trunc(opts.startBit ?? 0)
  if (!Number.isFinite(startByte) || startByte < 0) {
    throw new Error('起始字节必须 ≥ 0')
  }
  if (startBit < 0 || startBit > 7) {
    throw new Error('起始位必须在 0–7')
  }

  const type = opts.dataType
  const stride = s7TypeStrideBytes(type)
  const align = s7TypeAlignBytes(type)
  const prefix =
    (opts.namePrefix && opts.namePrefix.trim()) || `db${db}_`

  if (type !== 'BOOL') {
    startBit = 0
    if (startByte % align !== 0) {
      if (autoAlign) {
        const aligned = alignUp(startByte, align)
        warnings.push(
          `起始字节 ${opts.startByte} 未按 ${type} 的 ${align} 字节对齐，已调整为 ${aligned}，避免读错数值`,
        )
        startByte = aligned
      } else {
        throw new Error(
          `起始字节 ${startByte} 未按 ${type} 对齐（需 ${align} 字节边界）。请改起始偏移或开启自动对齐。`,
        )
      }
    }
  }

  const tags: S7BulkTag[] = []
  let byte = startByte
  let bit = startBit

  for (let i = 0; i < count; i++) {
    const tagKey = `${prefix}${i}`
    const address = `%DB${db}:${byte}.${bit}:${type}`
    tags.push({ tagKey, address, dataType: type })

    if (type === 'BOOL') {
      bit += 1
      if (bit > 7) {
        bit = 0
        byte += 1
      }
    } else {
      byte += stride
    }
  }

  const endByteExclusive =
    type === 'BOOL' ? (bit === 0 ? byte : byte + 1) : byte

  return {
    tags,
    effectiveStartByte: startByte,
    effectiveStartBit: type === 'BOOL' ? startBit : 0,
    endByteExclusive,
    warnings,
  }
}
