import { apiFetch } from '~/utils/api/http'

export type PlcTagPoint = {
  tagKey: string
  address: string
  dataType: string
  /** 是否降采样写入历史曲线；高并发下按需勾选 */
  historyEnabled?: boolean
}

export type PlcDevice = {
  id: string
  name: string
  protocolType: string
  host: string
  port: number
  rack: number
  slot: number
  unitId: number
  pollIntervalMs: number
  agentId: string | null
  tags: PlcTagPoint[]
  enabled: boolean
  runtimeDeviceId: string
  sessionActive: boolean
  /** 经工作协同挂载 */
  shared?: boolean
  sharedPermission?: string | null
}

export type PlcDashboard = {
  deviceCount: number | string
  enabledDeviceCount: number | string
  activeSessionCount: number | string
  onlineAgentCount: number | string
  unackedAlarmCount: number | string
  todayAlarmCount: number | string
}

export type AlarmRule = {
  id: string
  deviceId: string
  tagKey: string
  ruleName: string
  comparator: string
  threshold: number
  /** RISING | LEVEL | FALLING */
  triggerMode?: string
  /** 记次周期（毫秒） */
  cycleMs?: number
  enabled: boolean
}

export type AlarmEvent = {
  id: string
  deviceId: string
  ruleId: string
  tagKey: string
  severity: string
  message: string
  valueText: string | null
  occurrenceCount: number
  firstOccurredAt: string
  lastOccurredAt: string
  acked: boolean
  ackedAt: string | null
  /** false=规则已删后的历史残留 */
  ruleExists?: boolean
}

export type TrendSeries = {
  runtimeDeviceId: string
  tagKey: string
  points: { t: string; v: string; quality: string | null }[]
}

export type UpsertDeviceBody = {
  name: string
  protocolType: string
  host: string
  port: number
  rack: number
  slot: number
  unitId: number
  pollIntervalMs: number
  agentId?: string | null
  tags: PlcTagPoint[]
  enabled: boolean
}

const BASE = '/api/console/fieldpulse'

export function fetchDashboard() {
  return apiFetch<PlcDashboard>(`${BASE}/dashboard`)
}

export function listDevices() {
  return apiFetch<PlcDevice[]>(`${BASE}/devices`)
}

export function createDevice(body: UpsertDeviceBody) {
  return apiFetch<PlcDevice>(`${BASE}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function updateDevice(id: string, body: UpsertDeviceBody) {
  return apiFetch<PlcDevice>(`${BASE}/devices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteDevice(id: string) {
  return apiFetch<null>(`${BASE}/devices/${id}`, { method: 'DELETE' })
}

export function startDeviceSession(id: string) {
  return apiFetch<{ deviceId: string }>(`${BASE}/devices/${id}/session/start`, { method: 'POST' })
}

export function stopDeviceSession(id: string) {
  return apiFetch<null>(`${BASE}/devices/${id}/session/stop`, { method: 'POST' })
}

export function listAlarmRules(deviceId?: string) {
  const q = deviceId != null ? `?deviceId=${deviceId}` : ''
  return apiFetch<AlarmRule[]>(`${BASE}/alarm-rules${q}`)
}

export function createAlarmRule(body: {
  deviceId: string
  tagKey: string
  ruleName: string
  comparator: string
  threshold: number
  triggerMode: string
  cycleMs?: number
  enabled: boolean
}) {
  return apiFetch<AlarmRule>(`${BASE}/alarm-rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteAlarmRule(id: string) {
  return apiFetch<null>(`${BASE}/alarm-rules/${id}`, { method: 'DELETE' })
}

export function listAlarms(acked?: boolean, limit = 100) {
  const params = new URLSearchParams()
  if (acked != null) params.set('acked', String(acked))
  params.set('limit', String(limit))
  return apiFetch<AlarmEvent[]>(`${BASE}/alarms?${params}`)
}

export function ackAlarm(id: string) {
  return apiFetch<null>(`${BASE}/alarms/${id}/ack`, { method: 'POST' })
}

export function deleteAlarm(id: string) {
  return apiFetch<null>(`${BASE}/alarms/${id}`, { method: 'DELETE' })
}

/** ackedOnly=true 仅清已确认；不传则清空全部 */
export function clearAlarms(ackedOnly?: boolean) {
  const q = ackedOnly == null ? '' : `?ackedOnly=${ackedOnly}`
  return apiFetch<number>(`${BASE}/alarms${q}`, { method: 'DELETE' })
}

/** 清除规则已不存在的孤儿事件 */
export function clearOrphanAlarms() {
  return apiFetch<number>(`${BASE}/alarms/orphans`, { method: 'DELETE' })
}

export function fetchTrends(runtimeDeviceId: string, tagKey: string, from?: string, to?: string) {
  const params = new URLSearchParams({ runtimeDeviceId, tagKey })
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  return apiFetch<TrendSeries>(`${BASE}/trends?${params}`)
}

export function exportUrl(kind: 'devices.csv' | 'alarms.csv' | 'snapshot.json') {
  const config = useRuntimeConfig()
  const origin = String(config.public.apiOrigin || '').replace(/\/$/, '')
  return `${origin}${BASE}/export/${kind}`
}

export async function downloadExport(kind: 'devices.csv' | 'alarms.csv') {
  const auth = useAuthStore()
  auth.hydrate()
  const res = await fetch(exportUrl(kind), {
    headers: auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {},
  })
  if (!res.ok) throw new Error(`导出失败 (${res.status})`)
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `fp-${kind}`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** 组态：数据库唯一真相 */
export type ScadaDocumentRemote = {
  id?: string | number | null
  name: string
  width: number
  height: number
  nodes: unknown[]
  updatedAt: string
  tenantId: string | number
  ownerUserId: string | number
  persisted?: boolean
  revision?: number
  shared?: boolean
  sharedPermission?: string | null
}

export function fetchScadaDocument(sharedId?: string | number) {
  const q = sharedId != null && sharedId !== '' ? `?sharedId=${sharedId}` : ''
  return apiFetch<ScadaDocumentRemote>(`${BASE}/scada${q}`)
}

export function saveScadaDocumentRemote(
  body: {
    name: string
    width: number
    height: number
    nodes: unknown[]
    revision: number
  },
  sharedId?: string | number,
) {
  const q = sharedId != null && sharedId !== '' ? `?sharedId=${sharedId}` : ''
  return apiFetch<ScadaDocumentRemote>(`${BASE}/scada${q}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** ─── 工作协同 ─────────────────────────────────────────── */

const COLLAB = `${BASE}/collab`

export type CollabSpace = {
  id: number | string
  name: string
  note: string | null
  ownerUserId: number | string
  ownerDisplayName?: string | null
  myRole: string
  createdAt: string
}

export type CollabBoard = {
  contentJson: string
  revision: number | string
  updatedByUserId: number | string | null
  updatedAt: string | null
}

export type CollabMember = {
  userId: number | string
  tenantId: number | string
  displayName?: string | null
  username?: string | null
  role: string
  joinedAt: string
}

export type CollabResource = {
  id: number | string
  resourceType: string
  resourceId: number | string
  resourceLabel?: string | null
  permission: string
  ownerTenantId: number | string
}

export type CollabSpaceDetail = {
  space: CollabSpace
  board: CollabBoard
  members: CollabMember[]
  resources: CollabResource[]
}

export type CollabInviteCreated = {
  inviteId: number | string
  joinKey: string
  role: string
  expiresAt: string
  maxUses: number
}

export type CollabInvite = {
  id: number | string
  role: string
  expiresAt: string
  maxUses: number
  usedCount: number
  revoked: boolean
  createdAt: string | null
}

export type CollabJoinResult = {
  spaceId: number | string
  name: string
  role: string
}

export function listCollabSpaces() {
  return apiFetch<CollabSpace[]>(`${COLLAB}/spaces`)
}

export function createCollabSpace(body: { name: string; note?: string }) {
  return apiFetch<CollabSpace>(`${COLLAB}/spaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function fetchCollabDetail(spaceId: string | number) {
  return apiFetch<CollabSpaceDetail>(`${COLLAB}/spaces/${spaceId}`)
}

export function createCollabInvite(
  spaceId: string | number,
  body: { role: string; ttlHours?: number; maxUses?: number },
) {
  return apiFetch<CollabInviteCreated>(`${COLLAB}/spaces/${spaceId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function listCollabInvites(spaceId: string | number) {
  return apiFetch<CollabInvite[]>(`${COLLAB}/spaces/${spaceId}/invites`)
}

export function revokeCollabInvite(inviteId: string | number) {
  return apiFetch<null>(`${COLLAB}/invites/${inviteId}`, { method: 'DELETE' })
}

export function joinCollabSpace(joinKey: string) {
  return apiFetch<CollabJoinResult>(`${COLLAB}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ joinKey }),
  })
}

export function putCollabBoard(
  spaceId: string | number,
  body: { contentJson: string; expectedRevision?: number },
) {
  return apiFetch<CollabBoard>(`${COLLAB}/spaces/${spaceId}/board`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function removeCollabMember(spaceId: string | number, userId: string | number) {
  return apiFetch<null>(`${COLLAB}/spaces/${spaceId}/members/${userId}`, { method: 'DELETE' })
}

export function leaveCollabSpace(spaceId: string | number) {
  return apiFetch<null>(`${COLLAB}/spaces/${spaceId}/leave`, { method: 'POST' })
}

export function deleteCollabSpace(spaceId: string | number) {
  return apiFetch<null>(`${COLLAB}/spaces/${spaceId}`, { method: 'DELETE' })
}

export function grantCollabResource(
  spaceId: string | number,
  body: { resourceType: string; resourceId: number | string; permission: string },
) {
  return apiFetch<CollabResource>(`${COLLAB}/spaces/${spaceId}/resources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function revokeCollabResource(spaceId: string | number, resourceRowId: string | number) {
  return apiFetch<null>(`${COLLAB}/spaces/${spaceId}/resources/${resourceRowId}`, {
    method: 'DELETE',
  })
}
