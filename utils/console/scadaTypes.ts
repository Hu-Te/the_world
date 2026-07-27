/** 组态画布 JSON Schema（持久化仅在服务端 fp_scada_document） */

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
  /** 管道流动方向（绑定点位为真时动画）；相对图元局部 X 轴 */
  pipeFlowDir?: 'forward' | 'reverse'
  /** 管道端头：圆弧 / 直角 */
  pipeCorner?: 'round' | 'square'
  style?: {
    fontSize?: number
    /** CSS font-family，空则用默认 */
    fontFamily?: string
    color?: string
    alarmColor?: string
    alarmThreshold?: number
    background?: string
    borderColor?: string
  }
}

/** 属性面板可选字体 */
export const SCADA_FONT_OPTIONS: { id: string; label: string; css: string }[] = [
  { id: '', label: '默认', css: '' },
  {
    id: 'sans',
    label: '无衬线',
    css: '"IBM Plex Sans SC", "PingFang SC", "Noto Sans SC", sans-serif',
  },
  {
    id: 'mono',
    label: '等宽',
    css: 'ui-monospace, "IBM Plex Mono", "SF Mono", Menlo, monospace',
  },
  {
    id: 'display',
    label: '显示体',
    css: '"DIN Alternate", "Helvetica Neue", "Arial Narrow", sans-serif',
  },
]

/** 系统外观预设（一点写入 style） */
export const SCADA_STYLE_PRESETS: {
  id: string
  label: string
  style: NonNullable<ScadaNodeData['style']>
}[] = [
  {
    id: 'cyan',
    label: '工业青',
    style: { color: '#ecfeff', background: 'rgba(8,28,40,0.92)', borderColor: 'rgba(34,211,238,0.45)' },
  },
  {
    id: 'amber',
    label: '琥珀告警',
    style: { color: '#fef3c7', background: 'rgba(45,28,8,0.92)', borderColor: 'rgba(251,191,36,0.55)' },
  },
  {
    id: 'emerald',
    label: '运行绿',
    style: { color: '#d1fae5', background: 'rgba(6,32,24,0.92)', borderColor: 'rgba(52,211,153,0.5)' },
  },
  {
    id: 'slate',
    label: '暗底白字',
    style: { color: '#f1f5f9', background: 'rgba(15,23,42,0.95)', borderColor: 'rgba(148,163,184,0.4)' },
  },
  {
    id: 'rose',
    label: '故障红',
    style: { color: '#ffe4e6', background: 'rgba(40,10,18,0.94)', borderColor: 'rgba(251,113,133,0.55)' },
  },
  {
    id: 'violet',
    label: '信号紫',
    style: { color: '#ede9fe', background: 'rgba(24,16,40,0.94)', borderColor: 'rgba(167,139,250,0.5)' },
  },
  {
    id: 'clear',
    label: '透明文字',
    style: { color: '#e2e8f0', background: 'transparent', borderColor: 'transparent' },
  },
  {
    id: 'reset',
    label: '恢复默认',
    style: {},
  },
]

/**
 * 归属 ID：后端 Long 经 Jackson ToStringSerializer 以字符串下发。
 * 禁止用 Number() 比较/作键——雪花 ID 会丢精度，且 string !== number 会导致解析失败。
 */
export type ScadaOwnerId = string | number

export type ScadaOwnerRef = {
  tenantId: ScadaOwnerId
  ownerUserId: ScadaOwnerId
}

export type ScadaDocument = {
  version: 2
  name: string
  width: number
  height: number
  nodes: ScadaNodeData[]
  /** 服务端生成的 ISO 时间 */
  updatedAt: string
  /** 乐观锁，与库表 revision 对齐 */
  revision: number
  tenantId: ScadaOwnerId
  ownerUserId: ScadaOwnerId
}

export function normalizeScadaOwnerId(id: ScadaOwnerId | null | undefined): string {
  if (id == null) return ''
  return String(id).trim()
}

/** 有效登录归属（排除 0 / 空） */
export function isValidScadaOwner(owner: ScadaOwnerRef): boolean {
  const t = normalizeScadaOwnerId(owner.tenantId)
  const u = normalizeScadaOwnerId(owner.ownerUserId)
  return Boolean(t && u && t !== '0' && u !== '0')
}

export function sameScadaOwner(a: ScadaOwnerRef, b: ScadaOwnerRef): boolean {
  return (
    normalizeScadaOwnerId(a.tenantId) === normalizeScadaOwnerId(b.tenantId) &&
    normalizeScadaOwnerId(a.ownerUserId) === normalizeScadaOwnerId(b.ownerUserId)
  )
}

export function createEmptyScadaDoc(
  name = '未命名画面',
  owner?: ScadaOwnerRef,
): ScadaDocument {
  return {
    version: 2,
    name,
    width: 1280,
    height: 720,
    nodes: [],
    updatedAt: '',
    revision: 0,
    tenantId: owner ? normalizeScadaOwnerId(owner.tenantId) || '0' : '0',
    ownerUserId: owner ? normalizeScadaOwnerId(owner.ownerUserId) || '0' : '0',
  }
}

/** 清理历史 localStorage 组态键（一次性；数据库已是唯一真相） */
export function purgeLegacyScadaLocalCache() {
  if (!import.meta.client) return
  try {
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (k === 'fieldpulse.scada.doc.v1' || k.startsWith('fieldpulse.scada.doc.v2.')) {
        drop.push(k)
      }
    }
    for (const k of drop) localStorage.removeItem(k)
  } catch {
    /* ignore */
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
    pipe: { w: 160, h: 14, text: '', pipeFlowDir: 'forward', pipeCorner: 'round' },
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
    pipeFlowDir: d.pipeFlowDir ?? 'forward',
    pipeCorner: d.pipeCorner ?? 'round',
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
    pipeFlowDir: n.pipeFlowDir === 'reverse' ? 'reverse' : 'forward',
    pipeCorner: n.pipeCorner === 'square' ? 'square' : 'round',
    style: {
      ...(n.style || {}),
      fontSize:
        n.style?.fontSize != null && Number.isFinite(Number(n.style.fontSize))
          ? Math.min(48, Math.max(10, Number(n.style.fontSize)))
          : n.style?.fontSize,
      fontFamily: n.style?.fontFamily || undefined,
    },
  }
}

/** 解析导入 JSON 并改挂到当前用户（不落浏览器缓存） */
export function parseImportDocument(
  raw: string | Partial<ScadaDocument>,
  owner: ScadaOwnerRef,
): ScadaDocument | null {
  try {
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<ScadaDocument>
    if (!parsed?.nodes || !Array.isArray(parsed.nodes)) return null
    return {
      ...createEmptyScadaDoc(parsed.name || '产线概览', owner),
      name: parsed.name || '产线概览',
      width: Number(parsed.width) > 0 ? Number(parsed.width) : 1280,
      height: Number(parsed.height) > 0 ? Number(parsed.height) : 720,
      nodes: parsed.nodes.map((n) => normalizeNode(n as ScadaNodeData)),
      revision: 0,
      updatedAt: '',
    }
  } catch {
    return null
  }
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
