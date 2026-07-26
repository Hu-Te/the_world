<template>
  <PlcCenterShell title="设备台账">
    <template #actions>
      <button type="button" class="plc-btn plc-btn--ghost" @click="reloadAll">刷新</button>
      <button type="button" class="plc-btn" @click="openCreate">
        {{ showForm && !editingId ? '收起' : '新增设备' }}
      </button>
      <button type="button" class="plc-btn plc-btn--ghost" @click="onExport">导出 CSV</button>
    </template>

    <p class="plc-hint">
      云端无法直连工厂内网 PLC：请选择在线 Agent（如 plant-a）代连。改代理 /
      点位后需重新「启动」会话。
    </p>
    <p v-if="error" class="plc-err">{{ error }}</p>

    <form v-if="showForm" class="plc-form" @submit.prevent="save">
      <p class="plc-form__title">{{ editingId ? '编辑设备' : '新增设备' }}</p>
      <label>
        名称
        <input v-model="form.name" required />
      </label>
      <label>
        主机
        <input v-model="form.host" required />
      </label>
      <label>
        端口
        <input v-model.number="form.port" type="number" />
      </label>
      <label>
        Rack
        <input v-model.number="form.rack" type="number" />
      </label>
      <label>
        Slot
        <input v-model.number="form.slot" type="number" />
      </label>
      <label>
        现场代理
        <select v-model="form.agentId">
          <option value="">云端直连（仅同网可达）</option>
          <option
            v-if="form.agentId && !agents.some((a) => a.agentId === form.agentId)"
            :value="form.agentId">
            {{ form.agentId }}（当前离线）
          </option>
          <option v-for="a in agents" :key="a.agentId" :value="a.agentId">
            {{ a.displayName || a.agentId }} · {{ a.agentId }}
          </option>
        </select>
      </label>
      <label>
        轮询周期 (ms)
        <input
          v-model.number="form.pollIntervalMs"
          type="number"
          min="20"
          max="5000"
          step="10"
          required />
      </label>
      <p v-if="!agents.length" class="plc-form__note">
        暂无在线 Agent — 请先启动现场 Agent，再点「刷新」。
      </p>
      <p class="plc-form__note">
        云代理建议轮询 50~100ms；过低会被 RTT 卡住。现场 10ms 级请同网直采，公网代连做不到。
      </p>

      <div class="plc-tags plc-form__wide">
        <div class="plc-tags__head">
          <p class="plc-tags__title">点位配置</p>
          <button type="button" class="plc-btn" @click="addTag">新增点位</button>
        </div>
        <p class="plc-tags__hint">
          地址示例：
          <code>%DB1:4.0:REAL</code>
          、
          <code>M10.0:BOOL</code>
          。
          <strong>历史采集</strong>
          按点位勾选，未勾选只参与实时监控/报警，不写历史库（万级点位时务必按需开启）。左侧把手可拖拽调整顺序，保存后生效。
        </p>
        <div class="plc-tags__table-wrap">
          <table class="plc-tags__table">
            <thead>
              <tr>
                <th class="plc-tags__drag-col" title="拖拽排序"></th>
                <th>名称</th>
                <th>地址</th>
                <th>类型</th>
                <th title="未勾选则只实时推送，不写入历史库">历史采集</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(t, i) in tagRows"
                :key="t._id"
                class="plc-tags__row"
                :class="{
                  'is-dragging': dragFrom === i,
                  'is-drop-target': dragOver === i && dragFrom !== i,
                }"
                @dragover.prevent="onTagDragOver(i)"
                @drop.prevent="onTagDrop(i)">
                <td class="plc-tags__drag-col">
                  <button
                    type="button"
                    class="plc-tags__handle"
                    draggable="true"
                    title="拖拽排序"
                    aria-label="拖拽排序"
                    @dragstart="onTagDragStart($event, i)"
                    @dragend="onTagDragEnd">
                    ⋮⋮
                  </button>
                </td>
                <td>
                  <input v-model.trim="t.tagKey" required placeholder="temperature" />
                </td>
                <td>
                  <input
                    v-model.trim="t.address"
                    required
                    class="mono"
                    placeholder="%DB1:4.0:REAL"
                    @change="syncTypeFromAddress(t)" />
                </td>
                <td>
                  <select v-model="t.dataType" @change="syncAddressTypeSuffix(t)">
                    <option v-for="dt in dataTypes" :key="dt" :value="dt">{{ dt }}</option>
                  </select>
                </td>
                <td class="plc-tags__hist">
                  <label class="plc-check">
                    <input v-model="t.historyEnabled" type="checkbox" />
                    <span>入库</span>
                  </label>
                </td>
                <td>
                  <button type="button" class="link danger" @click="removeTag(i)">删除</button>
                </td>
              </tr>
              <tr v-if="!tagRows.length">
                <td colspan="6" class="empty">暂无点位，请点「新增点位」</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="plc-form__actions">
        <button type="submit" class="plc-btn">{{ editingId ? '保存修改' : '创建' }}</button>
        <button type="button" class="plc-btn plc-btn--ghost" @click="closeForm">取消</button>
      </div>
    </form>

    <div class="plc-table-wrap">
      <table class="plc-table">
        <thead>
          <tr>
            <th>名称</th>
            <th>连接</th>
            <th>代理</th>
            <th>会话</th>
            <th>点位</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in devices" :key="d.id">
            <td>{{ d.name }}</td>
            <td class="mono">{{ d.host }}:{{ d.port }} r{{ d.rack }}/s{{ d.slot }}</td>
            <td>
              <span v-if="d.agentId" class="mono" :class="agentOnline(d.agentId) ? 'ok' : 'warn'">
                {{ d.agentId }}
                <small>{{ agentOnline(d.agentId) ? '在线' : '离线' }}</small>
              </span>
              <span v-else class="idle">直连</span>
            </td>
            <td>
              <span :class="d.sessionActive ? 'ok' : 'idle'">
                {{ d.sessionActive ? '运行中' : '未启动' }}
              </span>
            </td>
            <td>
              <div class="tag-preview">
                <span
                  v-for="t in d.tags.slice(0, 3)"
                  :key="t.tagKey"
                  class="tag-chip mono"
                  :title="t.address">
                  {{ t.tagKey }}
                </span>
                <span v-if="d.tags.length > 3" class="idle">+{{ d.tags.length - 3 }}</span>
                <span v-if="!d.tags.length" class="idle">0</span>
              </div>
            </td>
            <td class="ops">
              <button type="button" class="link" @click="openEdit(d)">编辑</button>
              <button type="button" class="link" @click="start(d.id)">启动</button>
              <button type="button" class="link" @click="stop(d.id)">停止</button>
              <button type="button" class="link danger" @click="remove(d.id)">删除</button>
            </td>
          </tr>
          <tr v-if="!devices.length">
            <td colspan="6" class="empty">暂无设备，请新增台账</td>
          </tr>
        </tbody>
      </table>
    </div>
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import {
  createDevice,
  deleteDevice,
  downloadExport,
  listDevices,
  startDeviceSession,
  stopDeviceSession,
  updateDevice,
  type PlcDevice,
  type PlcTagPoint,
  type UpsertDeviceBody,
} from '~/utils/console/fieldpulseApi'
import { listAgents, type FieldPulseAgent } from '~/utils/fieldpulse/api'

definePageMeta({ layout: false })

type TagRow = PlcTagPoint & { _id: string }

const dataTypes = [
  'BOOL',
  'BYTE',
  'WORD',
  'DWORD',
  'LWORD',
  'SINT',
  'USINT',
  'INT',
  'UINT',
  'DINT',
  'UDINT',
  'LINT',
  'ULINT',
  'REAL',
  'LREAL',
  'CHAR',
  'WCHAR',
  'STRING',
  'WSTRING',
] as const

const devices = ref<PlcDevice[]>([])
const agents = ref<FieldPulseAgent[]>([])
const error = ref('')
const showForm = ref(false)
const editingId = ref<string | null>(null)
const form = reactive({
  name: '',
  host: '192.168.0.1',
  port: 102,
  rack: 0,
  slot: 1,
  agentId: '',
  pollIntervalMs: 50,
})
const tagRows = ref<TagRow[]>([])

let tagSeq = 0
function newTagId() {
  tagSeq += 1
  return `t-${Date.now()}-${tagSeq}`
}

function defaultTags(): TagRow[] {
  return [
    {
      _id: newTagId(),
      tagKey: 'temperature',
      address: '%DB1:4.0:REAL',
      dataType: 'REAL',
      historyEnabled: true,
    },
    {
      _id: newTagId(),
      tagKey: 'flag',
      address: 'M10.0:BOOL',
      dataType: 'BOOL',
      historyEnabled: false,
    },
  ]
}

function toTagRows(tags: PlcTagPoint[] | undefined): TagRow[] {
  if (!tags?.length) return []
  return tags.map((t) => ({
    _id: newTagId(),
    tagKey: t.tagKey,
    address: t.address,
    dataType: (t.dataType || 'REAL').toUpperCase(),
    // 旧数据无字段时后端按 true 返回；前端缺省也按 true，避免误关
    historyEnabled: t.historyEnabled !== false,
  }))
}

function extractTypeFromAddress(address: string): string | null {
  const m = address.trim().match(/:([A-Za-z]+)(?:\]|$)/)
  if (!m) return null
  const t = m[1].toUpperCase()
  return (dataTypes as readonly string[]).includes(t) ? t : null
}

function syncTypeFromAddress(row: TagRow) {
  const t = extractTypeFromAddress(row.address)
  if (t) row.dataType = t
}

function syncAddressTypeSuffix(row: TagRow) {
  const addr = row.address.trim()
  if (!addr) return
  if (/:[A-Za-z]+$/.test(addr)) {
    row.address = addr.replace(/:[A-Za-z]+$/, `:${row.dataType}`)
  }
}

function addTag() {
  tagRows.value.push({
    _id: newTagId(),
    tagKey: '',
    address: '%DB1:0.0:REAL',
    dataType: 'REAL',
    historyEnabled: false,
  })
}

function removeTag(index: number) {
  tagRows.value.splice(index, 1)
}

const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)

function onTagDragStart(e: DragEvent, index: number) {
  dragFrom.value = index
  dragOver.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function onTagDragOver(index: number) {
  if (dragFrom.value == null || dragFrom.value === index) {
    dragOver.value = index
    return
  }
  dragOver.value = index
}

function onTagDrop(toIndex: number) {
  const from = dragFrom.value
  if (from == null || from === toIndex) {
    onTagDragEnd()
    return
  }
  const rows = tagRows.value.slice()
  const [moved] = rows.splice(from, 1)
  rows.splice(toIndex, 0, moved)
  tagRows.value = rows
  onTagDragEnd()
}

function onTagDragEnd() {
  dragFrom.value = null
  dragOver.value = null
}

function agentOnline(agentId: string) {
  return agents.value.some((a) => a.agentId === agentId)
}

function resetForm() {
  editingId.value = null
  form.name = ''
  form.host = '192.168.0.1'
  form.port = 102
  form.rack = 0
  form.slot = 1
  form.agentId = agents.value[0]?.agentId ?? ''
  form.pollIntervalMs = 50
  tagRows.value = defaultTags()
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

function openCreate() {
  if (showForm.value && !editingId.value) {
    closeForm()
    return
  }
  resetForm()
  showForm.value = true
}

function openEdit(d: PlcDevice) {
  editingId.value = d.id
  form.name = d.name
  form.host = d.host
  form.port = d.port
  form.rack = d.rack
  form.slot = d.slot
  form.agentId = d.agentId || ''
  form.pollIntervalMs = d.pollIntervalMs > 0 ? d.pollIntervalMs : 50
  tagRows.value = toTagRows(d.tags)
  if (!tagRows.value.length) tagRows.value = defaultTags()
  showForm.value = true
}

function buildTags(): PlcTagPoint[] {
  const out: PlcTagPoint[] = []
  const seen = new Set<string>()
  for (const t of tagRows.value) {
    const key = t.tagKey.trim()
    const address = t.address.trim()
    const dataType = (t.dataType || 'REAL').trim().toUpperCase()
    if (!key || !address) {
      throw new Error('点位名称与地址不能为空')
    }
    if (seen.has(key)) {
      throw new Error(`点位名称重复: ${key}`)
    }
    seen.add(key)
    out.push({
      tagKey: key,
      address,
      dataType,
      historyEnabled: Boolean(t.historyEnabled),
    })
  }
  if (!out.length) {
    throw new Error('请至少配置一个点位')
  }
  return out
}

function toBody(): UpsertDeviceBody {
  const poll = Number(form.pollIntervalMs)
  return {
    name: form.name,
    protocolType: 'S7',
    host: form.host,
    port: form.port,
    rack: form.rack,
    slot: form.slot,
    unitId: 0,
    pollIntervalMs: Number.isFinite(poll) && poll > 0 ? Math.max(20, Math.min(5000, poll)) : 50,
    agentId: form.agentId || null,
    tags: buildTags(),
    enabled: true,
  }
}

async function reloadAll() {
  error.value = ''
  try {
    const [devs, ags] = await Promise.all([listDevices(), listAgents()])
    devices.value = devs
    agents.value = ags
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function save() {
  error.value = ''
  try {
    const body = toBody()
    if (editingId.value) {
      const prev = devices.value.find((x) => x.id === editingId.value)
      if (prev?.sessionActive) {
        await stopDeviceSession(editingId.value)
      }
      await updateDevice(editingId.value, body)
    } else {
      await createDevice(body)
    }
    closeForm()
    await reloadAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function start(id: string) {
  try {
    await startDeviceSession(id)
    await reloadAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function stop(id: string) {
  try {
    await stopDeviceSession(id)
    await reloadAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function remove(id: string) {
  if (!confirm('确认删除该设备？')) return
  try {
    await deleteDevice(id)
    await reloadAll()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onExport() {
  try {
    await downloadExport('devices.csv')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(reloadAll)
</script>

<style scoped lang="scss">
.plc-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.1rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(110, 200, 232, 0.2);
  background: rgba(0, 0, 0, 0.25);

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.72rem;
    color: #94a3b8;
  }

  input,
  select,
  textarea {
    border-radius: 0.4rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #e2e8f0;
    padding: 0.45rem 0.55rem;
    font-size: 0.85rem;
  }

  select {
    cursor: pointer;
  }

  &__title {
    grid-column: 1 / -1;
    margin: 0;
    font-size: 0.82rem;
    color: #ecfeff;
    letter-spacing: 0.06em;
  }

  &__note {
    grid-column: 1 / -1;
    margin: -0.25rem 0 0;
    font-size: 0.72rem;
    color: #fbbf24;
  }

  &__wide {
    grid-column: 1 / -1;
  }

  &__actions {
    grid-column: 1 / -1;
    display: flex;
    gap: 0.5rem;
  }
}

.plc-tags {
  padding-top: 0.35rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);

  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
  }

  &__title {
    margin: 0;
    font-size: 0.78rem;
    color: #ecfeff;
  }

  &__hint {
    margin: 0 0 0.55rem;
    font-size: 0.7rem;
    color: #64748b;

    code {
      color: #67e8f9;
      font-family: ui-monospace, 'IBM Plex Mono', monospace;
    }
  }

  &__table-wrap {
    overflow: auto;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;

    th,
    td {
      padding: 0.4rem 0.35rem;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      vertical-align: middle;
    }

    th {
      color: #64748b;
      font-weight: 500;
      font-size: 0.7rem;
    }

    input,
    select {
      width: 100%;
      min-width: 0;
    }

    .empty {
      color: #64748b;
      text-align: center;
      padding: 0.75rem;
    }
  }

  &__hist {
    width: 5.5rem;
    white-space: nowrap;
  }

  &__drag-col {
    width: 1.75rem;
    padding-left: 0.15rem !important;
    padding-right: 0.15rem !important;
  }

  &__handle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.7rem;
    border: none;
    border-radius: 0.3rem;
    background: transparent;
    color: #64748b;
    cursor: grab;
    font-size: 0.72rem;
    letter-spacing: -0.12em;
    line-height: 1;
    user-select: none;

    &:active {
      cursor: grabbing;
      color: #67e8f9;
    }

    &:hover {
      color: #94a3b8;
      background: rgba(255, 255, 255, 0.05);
    }
  }

  &__row {
    transition: background 0.12s ease;

    &.is-dragging {
      opacity: 0.45;
    }

    &.is-drop-target td {
      box-shadow: inset 0 2px 0 0 rgba(103, 232, 249, 0.65);
    }
  }
}

.plc-check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;

  input {
    width: auto !important;
    accent-color: #22d3ee;
  }
}

.plc-table-wrap {
  overflow: auto;
}

.plc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;

  th,
  td {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    padding: 0.65rem 0.5rem;
    text-align: left;
  }

  th {
    color: #64748b;
    font-weight: 500;
    font-size: 0.72rem;
  }

  .mono {
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.78rem;

    small {
      margin-left: 0.35rem;
      font-size: 0.68rem;
      opacity: 0.85;
    }
  }

  .ok {
    color: #6ee7b7;
  }
  .warn {
    color: #fbbf24;
  }
  .idle {
    color: #64748b;
  }
  .empty {
    color: #64748b;
    text-align: center;
  }
  .ops {
    display: flex;
    flex-wrap: wrap;
    gap: 0.55rem;
  }
}

.tag-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}

.tag-chip {
  display: inline-block;
  padding: 0.12rem 0.4rem;
  border-radius: 0.3rem;
  background: rgba(110, 200, 232, 0.1);
  border: 1px solid rgba(110, 200, 232, 0.22);
  color: #a5f3fc;
  font-size: 0.7rem;
}

.link {
  border: none;
  background: none;
  color: #67e8f9;
  cursor: pointer;
  font-size: 0.78rem;
  &.danger {
    color: #fca5a5;
  }
}

.plc-err {
  color: #fbbf24;
  margin-bottom: 0.75rem;
}

.plc-hint {
  color: #64748b;
  font-size: 0.78rem;
  margin: 0 0 0.85rem;
  line-height: 1.45;
}

.plc-btn {
  border-radius: 0.4rem;
  border: 1px solid rgba(110, 200, 232, 0.4);
  background: rgba(110, 200, 232, 0.12);
  padding: 0.45rem 0.85rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: #ecfeff;
  cursor: pointer;
  margin-left: 0.4rem;

  &--ghost {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.12);
    color: #94a3b8;
  }
}
</style>
