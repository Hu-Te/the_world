/** XmlXlate 列覆盖 / 待译规则（与后端 XmlTranslateLang 语义对齐） */

export type CoverageRow = {
  id: string
  [langTag: string]: string
}

export type ColumnCoverage = {
  need: number
  filled: number
  sameAsSource: number
  sameRatio: number
  /** 仍待处理条数（与 pendingEntryIds 一致） */
  pending: number
  complete: boolean
}

export function isTraditionalChineseTag(tag: string): boolean {
  const raw = (tag || '').trim()
  if (!raw) return false
  const lower = raw.toLowerCase()
  if (raw.includes('繁体') || raw.includes('繁體') || raw.includes('正体') || raw.includes('正體')) {
    return true
  }
  if (
    lower.includes('zh-hant') ||
    lower.includes('zh_hant') ||
    lower.includes('zh-tw') ||
    lower.includes('zh_tw') ||
    lower.includes('zh-hk') ||
    lower.includes('zh_hk') ||
    lower.includes('traditional')
  ) {
    return true
  }
  return lower === 'hant' || lower === 'tw' || lower === 'hk'
}

export function containsHan(text: string): boolean {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/u.test(text || '')
}

/** 该行在指定目标列是否仍需处理 */
export function rowNeedsWork(
  row: CoverageRow,
  tag: string,
  source: string,
  opts?: { traditionalAlreadyConverted?: boolean },
): boolean {
  const s = (row[source] || '').trim()
  if (!s) return false
  const t = (row[tag] || '').trim()
  if (!t) return true

  if (isTraditionalChineseTag(tag)) {
    // 繁体：本会话已全量转换过则不再因「同形字」卡住；未转换时凡汉字且仍等于源文都待转
    if (opts?.traditionalAlreadyConverted) return false
    return t === s && containsHan(s)
  }

  // 越/英等：含汉字却整句照抄 → 待译；数字/编码相同不算
  return t === s && containsHan(s)
}

/** 繁体列：始终全量送源非空行（OpenCC 秒级幂等，避免启发式漏字如「给/机」） */
export function traditionalConvertIds(rows: CoverageRow[], source: string): string[] {
  const ids: string[] = []
  for (const row of rows) {
    if ((row[source] || '').trim()) ids.push(String(row.id))
  }
  return ids
}

export function pendingEntryIds(
  rows: CoverageRow[],
  tag: string,
  source: string,
  opts?: { traditionalAlreadyConverted?: boolean },
): string[] {
  if (isTraditionalChineseTag(tag) && !opts?.traditionalAlreadyConverted) {
    return traditionalConvertIds(rows, source)
  }
  const ids: string[] = []
  for (const row of rows) {
    if (rowNeedsWork(row, tag, source, opts)) {
      ids.push(String(row.id))
    }
  }
  return ids
}

export function columnCoverage(
  rows: CoverageRow[],
  tag: string,
  source: string,
  opts?: { traditionalAlreadyConverted?: boolean },
): ColumnCoverage {
  let need = 0
  let filled = 0
  let sameAsSource = 0
  let pending = 0
  const traditional = isTraditionalChineseTag(tag)
  const converted = !!opts?.traditionalAlreadyConverted

  for (const row of rows) {
    const s = (row[source] || '').trim()
    if (!s) continue
    need += 1
    const t = (row[tag] || '').trim()
    if (t) {
      filled += 1
      if (t === s && containsHan(s)) sameAsSource += 1
    }
    if (rowNeedsWork(row, tag, source, opts)) pending += 1
  }

  const sameRatio = need > 0 ? sameAsSource / need : 0
  // 繁体：以「本会话已跑过全量 OpenCC」为准（同形字允许仍等于源文）
  // 越/英：待处理为 0 且无汉字照抄
  const complete =
    need > 0 &&
    filled >= need &&
    (traditional ? converted : pending === 0 && sameAsSource === 0)

  return { need, filled, sameAsSource, sameRatio, pending, complete }
}
