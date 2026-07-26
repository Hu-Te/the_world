/** 工脉监控舱：连接 + 点位配置 本地持久化 / 文件导出导入 */

import { newTagId, type FieldPulseTag, type ProtocolType } from '~/utils/fieldpulse/api'

export const FIELDPULSE_CONFIG_KEY = 'fieldpulse.cabin.config.v1'
export const CONFIG_VERSION = 1 as const

export type FieldPulseBulkConfig = {
  db: number
  startByte: number
  startBit: number
  count: number
  type: string
  prefix: string
}

export type FieldPulseCabinConfig = {
  version: typeof CONFIG_VERSION
  exportedAt: string
  name?: string
  protocol: ProtocolType
  ip: string
  port: number
  rack: number
  slot: number
  unitId: number
  pollMs: number
  agentId: string
  tags: Array<Pick<FieldPulseTag, 'tagKey' | 'address' | 'dataType'>>
  bulk?: FieldPulseBulkConfig
}

export type ParsedCabinConfig = {
  config: FieldPulseCabinConfig
  warnings: string[]
}

function isProtocol(v: unknown): v is ProtocolType {
  return v === 'S7' || v === 'MODBUS' || v === 'CUSTOM_HEX'
}

function asNumber(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : v == null ? fallback : String(v)
}

/** 从任意 JSON 解析并校验配置 */
export function parseCabinConfig(raw: unknown): ParsedCabinConfig {
  const warnings: string[] = []
  if (!raw || typeof raw !== 'object') {
    throw new Error('配置文件格式无效（需要 JSON 对象）')
  }
  const o = raw as Record<string, unknown>
  const version = asNumber(o.version, 0)
  if (version !== CONFIG_VERSION) {
    warnings.push(`配置版本为 ${version || '未知'}，已按 v${CONFIG_VERSION} 兼容读取`)
  }

  const protocol = isProtocol(o.protocol) ? o.protocol : 'S7'
  if (!isProtocol(o.protocol)) {
    warnings.push('协议无效，已回退为 S7')
  }

  const tagsRaw = Array.isArray(o.tags) ? o.tags : []
  if (!Array.isArray(o.tags)) {
    warnings.push('缺少 tags 数组，已置为空')
  }

  const tags: FieldPulseCabinConfig['tags'] = []
  const seen = new Set<string>()
  for (const item of tagsRaw) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    const tagKey = asString(t.tagKey).trim()
    const address = asString(t.address).trim()
    const dataType = asString(t.dataType, 'REAL').trim().toUpperCase() || 'REAL'
    if (!tagKey || !address) {
      warnings.push('已跳过缺少变量名或地址的点位')
      continue
    }
    if (seen.has(tagKey)) {
      warnings.push(`重复变量名「${tagKey}」已跳过`)
      continue
    }
    seen.add(tagKey)
    tags.push({ tagKey, address, dataType })
  }

  let bulk: FieldPulseBulkConfig | undefined
  if (o.bulk && typeof o.bulk === 'object') {
    const b = o.bulk as Record<string, unknown>
    bulk = {
      db: Math.max(1, Math.trunc(asNumber(b.db, 1))),
      startByte: Math.max(0, Math.trunc(asNumber(b.startByte, 0))),
      startBit: Math.min(7, Math.max(0, Math.trunc(asNumber(b.startBit, 0)))),
      count: Math.min(128, Math.max(1, Math.trunc(asNumber(b.count, 20)))),
      type: asString(b.type, 'REAL').trim().toUpperCase() || 'REAL',
      prefix: asString(b.prefix, `db${asNumber(b.db, 1)}_`),
    }
  }

  const config: FieldPulseCabinConfig = {
    version: CONFIG_VERSION,
    exportedAt: asString(o.exportedAt, new Date().toISOString()),
    name: o.name != null ? asString(o.name).trim() || undefined : undefined,
    protocol,
    ip: asString(o.ip, '192.168.0.1').trim() || '192.168.0.1',
    port: Math.max(0, Math.trunc(asNumber(o.port, 102))),
    rack: Math.max(0, Math.trunc(asNumber(o.rack, 0))),
    slot: Math.max(0, Math.trunc(asNumber(o.slot, 1))),
    unitId: Math.max(1, Math.trunc(asNumber(o.unitId, 1))),
    pollMs: Math.max(50, Math.trunc(asNumber(o.pollMs, 200))),
    agentId: asString(o.agentId).trim(),
    tags,
    bulk,
  }

  return { config, warnings }
}

export function dedupeTagDefs<T extends { tagKey: string }>(list: T[]): T[] {
  const map = new Map<string, T>()
  for (const item of list) {
    const key = String(item.tagKey || '').trim()
    if (!key) continue
    map.set(key, { ...item, tagKey: key })
  }
  return [...map.values()]
}

export function tagsFromConfig(config: FieldPulseCabinConfig): FieldPulseTag[] {
  return dedupeTagDefs(config.tags).map((t) => ({
    id: newTagId(),
    tagKey: t.tagKey,
    address: t.address,
    dataType: t.dataType,
  }))
}

export function loadLocalConfig(): FieldPulseCabinConfig | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(FIELDPULSE_CONFIG_KEY)
    if (!raw) return null
    return parseCabinConfig(JSON.parse(raw)).config
  } catch {
    return null
  }
}

export function saveLocalConfig(config: FieldPulseCabinConfig): void {
  if (!import.meta.client) return
  try {
    localStorage.setItem(FIELDPULSE_CONFIG_KEY, JSON.stringify(config))
  } catch {
    /* quota */
  }
}

export function buildCabinConfig(input: {
  name?: string
  protocol: ProtocolType
  ip: string
  port: number
  rack: number
  slot: number
  unitId: number
  pollMs: number
  agentId: string
  tags: FieldPulseTag[]
  bulk?: FieldPulseBulkConfig
}): FieldPulseCabinConfig {
  return {
    version: CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    name: input.name?.trim() || undefined,
    protocol: input.protocol,
    ip: input.ip.trim(),
    port: input.port,
    rack: input.rack,
    slot: input.slot,
    unitId: input.unitId,
    pollMs: input.pollMs,
    agentId: input.agentId.trim(),
    tags: dedupeTagDefs(
      input.tags
        .filter((t) => t.tagKey && t.address)
        .map(({ tagKey, address, dataType }) => ({
          tagKey: tagKey.trim(),
          address: address.trim(),
          dataType: String(dataType || 'REAL').trim().toUpperCase(),
        })),
    ),
    bulk: input.bulk,
  }
}

export function downloadCabinConfig(config: FieldPulseCabinConfig, filename?: string): void {
  const json = JSON.stringify(config, null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = filename || `fieldpulse-config-${stamp}.json`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

export async function readCabinConfigFile(file: File): Promise<ParsedCabinConfig> {
  const text = await file.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('无法解析 JSON，请确认文件内容')
  }
  return parseCabinConfig(raw)
}
