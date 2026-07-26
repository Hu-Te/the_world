/** 组态画布 JSON Schema（按租户+用户隔离持久化） */

export type ScadaNodeType =
  | 'text'
  | 'display'
  | 'input'
  | 'button'
  | 'image'
  | 'curve'
  | 'lamp'
  | 'pump'
  | 'pipe'
  | 'panel'
  /** @deprecated 兼容旧稿 */
  | 'value'
  | 'rect'

export type ScadaNodeData = {
  id: string
  type: ScadaNodeType
  x: number
  y: number
  w: number
  h: number
  /** 旋转角度（度，顺时针，0–360） */
  rotation?: number
  /** 标题 / 按钮文案 / 占位 */
  text: string
  /**
   * 绑定点位 Key（与 liveDataStore 一致）：
   * `${runtimeDeviceId}::${tagKey}`
   */
  bindTag: string
  /** 图片 URL（仅 image） */
  imageUrl?: string
  /** 单位后缀（display / input / curve） */
  unit?: string
  /** 小数位 */
  decimals?: number
  /** 曲线缓冲点数 */
  historySize?: number
  /**
   * 输入框本地设定值（仅写入当前用户组态稿，不下发 PLC、不进 liveDataMap）
   */
  setpoint?: string
  style?: {
    fontSize?: number
    color?: string
    alarmColor?: string
    alarmThreshold?: number
    background?: string
    borderColor?: string
  }
}

export type ScadaDocument = {
  version: 2
  name: string
  width: number
  height: number
  nodes: ScadaNodeData[]
  updatedAt: string
  /** 归属：防止串用他人本机缓存 */
  tenantId: number
  ownerUserId: number
}

const LEGACY_STORAGE_KEY = 'fieldpulse.scada.doc.v1'

export function scadaStorageKey(tenantId: number, userId: number) {
  return `fieldpulse.scada.doc.v2.t${tenantId}.u${userId}`
}

export function createEmptyScadaDoc(
  name = '未命名画面',
  owner?: { tenantId: number; ownerUserId: number },
): ScadaDocument {
  return {
    version: 2,
    name,
    width: 1280,
    height: 720,
    nodes: [],
    updatedAt: new Date().toISOString(),
    tenantId: owner?.tenantId ?? 0,
    ownerUserId: owner?.ownerUserId ?? 0,
  }
}

export function newNodeId() {
  return `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function normalizeNodeType(type: string | undefined): ScadaNodeType {
  if (type === 'value') return 'display'
  if (type === 'rect') return 'panel'
  const allowed: ScadaNodeType[] = [
    'text',
    'display',
    'input',
    'button',
    'image',
    'curve',
    'lamp',
    'pump',
    'pipe',
    'panel',
  ]
  if (type && (allowed as string[]).includes(type)) return type as ScadaNodeType
  return 'display'
}

export function createScadaNode(
  type: ScadaNodeType,
  partial?: Partial<ScadaNodeData>,
): ScadaNodeData {
  const t = normalizeNodeType(type)
  const defaults: Record<
    Exclude<ScadaNodeType, 'value' | 'rect'>,
    Pick<ScadaNodeData, 'w' | 'h' | 'text'> & Partial<ScadaNodeData>
  > = {
    text: { w: 120, h: 32, text: '工序名称' },
    display: { w: 140, h: 56, text: '温度', unit: '℃', decimals: 1 },
    input: { w: 148, h: 56, text: '设定值', unit: '', decimals: 1 },
    button: { w: 108, h: 40, text: '启动' },
    image: { w: 160, h: 100, text: '示意图', imageUrl: '' },
    curve: { w: 220, h: 100, text: '趋势', historySize: 60, decimals: 1 },
    lamp: { w: 64, h: 56, text: '运行' },
    pump: { w: 72, h: 72, text: '泵' },
    pipe: { w: 160, h: 14, text: '' },
    panel: { w: 200, h: 120, text: '区域' },
  }
  const d = defaults[t as Exclude<ScadaNodeType, 'value' | 'rect'>] || defaults.display
  return {
    id: newNodeId(),
    x: 80,
    y: 80,
    w: d.w,
    h: d.h,
    rotation: 0,
    text: d.text,
    bindTag: '',
    imageUrl: d.imageUrl ?? '',
    unit: d.unit ?? '',
    decimals: d.decimals,
    historySize: d.historySize,
    setpoint: '',
    style: {},
    ...partial,
    // 放在 spread 后，避免 partial 覆盖节点类型
    type: t,
  }
}

/** 归一化到 [0, 360) */
export function normalizeRotation(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  const m = ((n % 360) + 360) % 360
  return Math.round(m * 10) / 10
}

export function normalizeNode(n: Partial<ScadaNodeData> & { id?: string }): ScadaNodeData {
  const type = normalizeNodeType(n.type)
  const base = createScadaNode(type)
  return {
    ...base,
    ...n,
    id: n.id || base.id,
    type,
    x: Number(n.x) || 0,
    y: Number(n.y) || 0,
    w: Math.max(12, Number(n.w) || base.w),
    h: Math.max(12, Number(n.h) || base.h),
    rotation: normalizeRotation(n.rotation ?? 0),
    text: n.text ?? base.text,
    bindTag: n.bindTag ?? '',
    imageUrl: n.imageUrl ?? '',
    unit: n.unit ?? base.unit ?? '',
    decimals: n.decimals ?? base.decimals,
    historySize: n.historySize ?? base.historySize,
    setpoint: n.setpoint ?? '',
    style: n.style || {},
  }
}

export function parseOwnedDocument(
  raw: string,
  owner: { tenantId: number; ownerUserId: number },
): ScadaDocument | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ScadaDocument>
    if (!parsed?.nodes || !Array.isArray(parsed.nodes)) return null
    // 已带归属则必须匹配，防止串读
    if (
      parsed.tenantId != null &&
      parsed.ownerUserId != null &&
      (Number(parsed.tenantId) !== owner.tenantId ||
        Number(parsed.ownerUserId) !== owner.ownerUserId)
    ) {
      return null
    }
    return {
      ...createEmptyScadaDoc(parsed.name || '产线概览', owner),
      ...parsed,
      version: 2,
      tenantId: owner.tenantId,
      ownerUserId: owner.ownerUserId,
      nodes: parsed.nodes.map((n) => normalizeNode(n as ScadaNodeData)),
    }
  } catch {
    return null
  }
}

/** 在内存稿与磁盘稿之间选更完整/更新的一份，避免空稿盖住有效缓存 */
export function pickRicherScadaDoc(a: ScadaDocument, b: ScadaDocument): ScadaDocument {
  const an = a.nodes?.length ?? 0
  const bn = b.nodes?.length ?? 0
  if (an === 0 && bn > 0) return b
  if (bn === 0 && an > 0) return a
  const at = a.updatedAt || ''
  const bt = b.updatedAt || ''
  return at >= bt ? a : b
}

/** 只读窥探磁盘（不迁 legacy），供防覆盖判断 */
export function peekScadaDocumentFromDisk(owner: {
  tenantId: number
  ownerUserId: number
}): ScadaDocument | null {
  if (!import.meta.client) return null
  if (owner.tenantId <= 0 || owner.ownerUserId <= 0) return null
  const raw = localStorage.getItem(scadaStorageKey(owner.tenantId, owner.ownerUserId))
  if (!raw) return null
  return parseOwnedDocument(raw, owner)
}

/** 加载当前用户画面；仅当用户键为空时，才把无主 legacy 稿迁入一次。 */
export function loadScadaDocument(owner: {
  tenantId: number
  ownerUserId: number
}): ScadaDocument {
  if (!import.meta.client) return createEmptyScadaDoc('产线概览', owner)
  const key = scadaStorageKey(owner.tenantId, owner.ownerUserId)
  const mine = localStorage.getItem(key)
  if (mine) {
    const parsed = parseOwnedDocument(mine, owner)
    if (parsed) return parsed
    // 解析失败不覆盖磁盘，避免脏写；返回空稿供编辑器使用
    console.warn('[scada] localStorage 解析失败，键=', key)
    return createEmptyScadaDoc('产线概览', owner)
  }
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacy) {
    const migrated = parseOwnedDocument(legacy, owner)
    if (migrated) {
      migrated.tenantId = owner.tenantId
      migrated.ownerUserId = owner.ownerUserId
      localStorage.setItem(key, JSON.stringify(migrated))
      // 迁入后移除无主稿，避免同浏览器下一账号再复制同一份画面
      localStorage.removeItem(LEGACY_STORAGE_KEY)
      return migrated
    }
  }
  return createEmptyScadaDoc('产线概览', owner)
}

export type SaveScadaOptions = {
  /** 允许用空 nodes 覆盖磁盘上的非空稿（显式清空） */
  allowEmptyOverwrite?: boolean
}

export function saveScadaDocument(
  doc: ScadaDocument,
  owner: { tenantId: number; ownerUserId: number },
  opts?: SaveScadaOptions,
) {
  if (!import.meta.client) return
  if (owner.tenantId <= 0 || owner.ownerUserId <= 0) {
    throw new Error('未登录用户不能保存组态（避免污染共享缓存）')
  }
  const key = scadaStorageKey(owner.tenantId, owner.ownerUserId)
  const incomingNodes = Array.isArray(doc.nodes) ? doc.nodes.length : 0
  // 关键：空稿 flush/误保存不得覆盖已有组态
  if (!opts?.allowEmptyOverwrite && incomingNodes === 0) {
    const existing = peekScadaDocumentFromDisk(owner)
    if (existing && existing.nodes.length > 0) {
      console.warn('[scada] 拒绝用空稿覆盖磁盘非空组态，键=', key)
      return null
    }
  }
  const stamped: ScadaDocument = {
    ...doc,
    version: 2,
    tenantId: owner.tenantId,
    ownerUserId: owner.ownerUserId,
    updatedAt: new Date().toISOString(),
    nodes: Array.isArray(doc.nodes) ? doc.nodes : [],
  }
  localStorage.setItem(key, JSON.stringify(stamped))
  return stamped
}

export const SCADA_TYPE_LABELS: Record<string, string> = {
  text: '文本',
  display: '显示框',
  value: '显示框',
  input: '输入框',
  button: '按钮',
  image: '图片',
  curve: '曲线',
  lamp: '指示灯',
  pump: '水泵',
  pipe: '管道',
  panel: '面板',
  rect: '面板',
}
