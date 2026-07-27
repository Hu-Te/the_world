<template>
  <div class="fp">
    <FieldPulseCabinBar
      :ws-status="wsStatus"
      :session="session"
      :lifecycle-label="session ? lifecycleStateZh(session.lifecycleState) : ''"
      :protocol="protocol"
      :agent-id="agentId"
      :agent-count="agents.length"
      :preview-device-id="previewDeviceId"
      :tag-count="tags.length"
      :busy="busy"
      :show-side="showSide"
      @open="onOpenSession"
      @close="onCloseSession"
      @batch-read="onBatchRead"
      @export="onExportConfig"
      @import="triggerImport"
      @toggle-side="showSide = !showSide" />
    <input
      ref="importInput"
      class="fp-file"
      type="file"
      accept="application/json,.json"
      @change="onImportFile" />

    <p v-if="error" class="fp-banner fp-banner--bad">{{ error }}</p>
    <p v-else-if="tipTone !== 'idle'" class="fp-banner" :class="`fp-banner--${tipTone}`">
      {{ contextualTip }}
    </p>

    <div class="fp-layout" :class="{ 'fp-layout--full': !showSide }">
      <aside v-show="showSide" class="fp-side">
        <FieldPulseCabinConn
          v-model:open="showConn"
          v-model:protocol="protocol"
          v-model:poll-ms="pollMs"
          v-model:agent-id="agentId"
          v-model:ip="ip"
          v-model:port="port"
          v-model:rack="rack"
          v-model:slot="slot"
          v-model:unit-id="unitId"
          :agents="agents"
          :busy="busy"
          :default-port="defaultPort"
          :preview-device-id="previewDeviceId"
          @protocol-change="onProtocolChange"
          @refresh-agents="refreshAgents"
          @download-agent="agentModalOpen = true" />

        <section class="fp-panel fp-panel--tags">
          <div class="fp-panel__row">
            <h2 class="fp-panel__title">
              点位
              <span class="fp-panel__meta">{{ tags.length }}</span>
            </h2>
            <div class="fp-inline fp-inline--tools">
              <button
                type="button"
                class="fp-btn fp-btn--ghost fp-btn--sm"
                :disabled="busy"
                @click="addTag">
                + 点
              </button>
              <button
                v-if="tags.length"
                type="button"
                class="fp-btn fp-btn--ghost fp-btn--sm fp-btn--danger"
                :disabled="busy"
                @click="clearTags">
                清空
              </button>
              <button
                v-if="protocol === 'S7'"
                type="button"
                class="fp-btn fp-btn--ghost fp-btn--sm"
                :class="{ 'fp-btn--on': showBulk }"
                @click="showBulk = !showBulk">
                批量
              </button>
            </div>
          </div>

          <div v-if="protocol === 'S7' && showBulk" class="fp-bulk">
            <div class="fp-grid fp-grid--bulk">
              <label class="fp-field">
                <span>DB</span>
                <input v-model.number="bulkDb" type="number" min="1" />
              </label>
              <label class="fp-field">
                <span>起始字节</span>
                <input v-model.number="bulkStartByte" type="number" min="0" />
              </label>
              <label v-if="isBulkBool" class="fp-field">
                <span>起始位</span>
                <input v-model.number="bulkStartBit" type="number" min="0" max="7" />
              </label>
              <label class="fp-field">
                <span>数量</span>
                <input v-model.number="bulkCount" type="number" min="1" max="128" />
              </label>
              <label class="fp-field">
                <span>类型</span>
                <input
                  v-model.trim="bulkType"
                  list="fp-bulk-types"
                  placeholder="BOOL / INT / REAL"
                  autocomplete="off"
                  @blur="normalizeBulkType" />
                <datalist id="fp-bulk-types">
                  <option v-for="d in bulkTypes" :key="d" :value="d" />
                </datalist>
              </label>
              <label class="fp-field">
                <span>前缀</span>
                <input v-model.trim="bulkPrefix" placeholder="db1_" />
              </label>
            </div>
            <p class="fp-hint">{{ bulkPreviewText }}</p>
            <p v-if="bulkWarnings.length" class="fp-hint fp-hint--warn">
              {{ bulkWarnings.join('；') }}
            </p>
            <div class="fp-actions fp-actions--bulk">
              <button
                type="button"
                class="fp-btn fp-btn--accent fp-btn--sm"
                :disabled="busy"
                @click="onGenerateAndRestart">
                生成并重启
              </button>
              <button
                type="button"
                class="fp-btn fp-btn--ghost fp-btn--sm"
                :disabled="busy"
                @click="onGenerateDbRange(false)">
                仅生成
              </button>
              <button
                type="button"
                class="fp-btn fp-btn--ghost fp-btn--sm"
                :disabled="busy"
                @click="onGenerateDbRange(true)">
                追加
              </button>
              <button
                type="button"
                class="fp-btn fp-btn--ghost fp-btn--sm"
                :disabled="busy"
                title="BOOL@0.0 INT@2.0 DINT@4.0 REAL@8.0"
                @click="onApplyTiaStructure">
                TIA结构
              </button>
            </div>
            <p v-if="lastGenerateTip" class="fp-hint fp-hint--ok">{{ lastGenerateTip }}</p>
          </div>

          <div class="fp-tag-head" aria-hidden="true">
            <span>变量名</span>
            <span>地址</span>
            <span>类型</span>
            <span />
          </div>
          <div class="fp-tag-list" :class="{ 'fp-tag-list--dense': tags.length > 12 }">
            <datalist id="fp-data-types">
              <option v-for="d in dataTypes" :key="d" :value="d" />
            </datalist>
            <div v-if="!tags.length" class="fp-tag-empty">
              暂无点位，用上方「批量」生成或「+ 点」添加
            </div>
            <div v-for="t in tags" :key="t.id" class="fp-tag-row">
              <input v-model.trim="t.tagKey" placeholder="名称" title="变量名" />
              <input v-model.trim="t.address" :placeholder="addressPlaceholder" title="地址" />
              <input
                v-model.trim="t.dataType"
                list="fp-data-types"
                placeholder="类型"
                title="数据类型（可手动输入）"
                autocomplete="off"
                @blur="normalizeTagType(t)" />
              <button
                type="button"
                class="fp-btn fp-btn--ghost fp-btn--sm fp-btn--danger"
                title="删除此变量"
                :disabled="busy"
                @click="removeTag(t.id)">
                删
              </button>
            </div>
          </div>
        </section>

        <section class="fp-panel fp-panel--alarms">
          <button
            type="button"
            class="fp-panel__row fp-panel__toggle"
            @click="showAlarms = !showAlarms">
            <h2 class="fp-panel__title">
              报警
              <span class="fp-panel__meta" :class="{ 'fp-panel__meta--warn': alarms.length }">
                {{ alarms.length }}
              </span>
            </h2>
            <span class="fp-muted">{{ showAlarms ? '收起' : '展开' }}</span>
          </button>
          <ul v-if="showAlarms" class="fp-alarms">
            <li v-for="a in alarms" :key="a.id">
              <span class="fp-mono">{{ formatTime(a.epochMillis) }}</span>
              <strong>{{ lifecycleStateZh(a.state) }}</strong>
              <span class="fp-muted">{{ lifecycleReasonZh(a.reason) }}</span>
            </li>
            <li v-if="!alarms.length" class="fp-muted">暂无记录</li>
          </ul>
        </section>
      </aside>

      <section class="fp-main">
        <div class="fp-main__toolbar">
          <h2 class="fp-panel__title fp-panel__title--inline">全部寄存器</h2>
          <span class="fp-chip">{{ filteredLiveRows.length }}/{{ tags.length }}</span>
          <input
            v-model.trim="liveQuery"
            class="fp-search"
            type="search"
            placeholder="筛选变量名或地址…"
            autocomplete="off" />
          <span class="fp-chip fp-chip--ok">好 {{ liveStats.good }}</span>
          <span class="fp-chip" :class="liveStats.pending ? 'fp-chip--warn' : 'fp-chip--muted'">
            待 {{ liveStats.pending }}
          </span>
          <span class="fp-chip" :class="liveStats.bad ? 'fp-chip--bad' : 'fp-chip--muted'">
            差 {{ liveStats.bad }}
          </span>
          <label class="fp-check">
            <input v-model="showSpark" type="checkbox" />
            曲线
          </label>
          <div class="fp-seg">
            <button
              type="button"
              class="fp-seg__btn"
              :class="{ 'fp-seg__btn--on': liveView === 'table' }"
              @click="liveView = 'table'">
              表
            </button>
            <button
              type="button"
              class="fp-seg__btn"
              :class="{ 'fp-seg__btn--on': liveView === 'cards' }"
              @click="liveView = 'cards'">
              卡
            </button>
          </div>
        </div>

        <div v-if="!filteredLiveRows.length" class="fp-empty">
          {{
            tags.length ? '无匹配点位' : '先在左侧用「DB 批量 → 生成替换」配置寄存器，再启动会话'
          }}
        </div>

        <div v-else-if="liveView === 'cards'" class="fp-cards">
          <article
            v-for="row in filteredLiveRows"
            :key="row.tagKey"
            class="fp-card"
            :class="{
              'fp-card--bad': !row.pending && !isGoodQuality(row.quality),
              'fp-card--pending': row.pending,
            }">
            <div class="fp-card__head">
              <span class="fp-card__name" :title="row.address">{{ row.tagKey }}</span>
              <div class="fp-card__head-actions">
                <span
                  class="fp-q"
                  :class="
                    row.pending
                      ? 'fp-q--pending'
                      : isGoodQuality(row.quality)
                        ? 'fp-q--good'
                        : 'fp-q--bad'
                  ">
                  {{ row.pending ? '等待' : shortQuality(row.quality) }}
                </span>
                <button
                  type="button"
                  class="fp-btn fp-btn--ghost fp-btn--sm fp-btn--danger"
                  title="删除此变量"
                  :disabled="busy"
                  @click="removeTagByKey(row.tagKey)">
                  删
                </button>
              </div>
            </div>
            <div class="fp-card__value">{{ row.pending ? '—' : formatVal(row.value) }}</div>
            <div class="fp-card__meta">
              <span class="fp-mono" :title="row.address">{{ row.address || row.dataType }}</span>
              <span class="fp-mono">{{ formatTime(row.epochMillis) }}</span>
            </div>
            <canvas
              v-if="showSpark && !row.pending"
              :ref="(el) => bindCanvas(row.tagKey, el)"
              class="fp-spark fp-spark--wide"
              width="160"
              height="32" />
          </article>
        </div>

        <div v-else class="fp-table-wrap">
          <table class="fp-table" :class="{ 'fp-table--dense': tags.length > 16 }">
            <thead>
              <tr>
                <th>#</th>
                <th>变量</th>
                <th>地址</th>
                <th>值</th>
                <th>类型</th>
                <th>质量</th>
                <th>时间</th>
                <th v-if="showSpark">曲线</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, idx) in filteredLiveRows"
                :key="row.tagKey"
                :class="{
                  'fp-row--bad': !row.pending && !isGoodQuality(row.quality),
                  'fp-row--pending': row.pending,
                }">
                <td class="fp-table__idx">{{ idx + 1 }}</td>
                <td class="fp-table__key">{{ row.tagKey }}</td>
                <td class="fp-mono fp-table__addr" :title="row.address">
                  {{ row.address || '—' }}
                </td>
                <td class="fp-mono fp-table__val">
                  {{ row.pending ? '—' : formatVal(row.value) }}
                </td>
                <td>{{ row.dataType }}</td>
                <td>
                  <span
                    class="fp-q"
                    :class="
                      row.pending
                        ? 'fp-q--pending'
                        : isGoodQuality(row.quality)
                          ? 'fp-q--good'
                          : 'fp-q--bad'
                    ">
                    {{ row.pending ? '等待' : shortQuality(row.quality) }}
                  </span>
                </td>
                <td class="fp-mono fp-table__time">{{ formatTime(row.epochMillis) }}</td>
                <td v-if="showSpark">
                  <canvas
                    v-if="!row.pending"
                    :ref="(el) => bindCanvas(row.tagKey, el)"
                    class="fp-spark"
                    width="100"
                    height="24" />
                </td>
                <td>
                  <button
                    type="button"
                    class="fp-btn fp-btn--ghost fp-btn--sm fp-btn--danger"
                    title="删除此变量"
                    :disabled="busy"
                    @click="removeTagByKey(row.tagKey)">
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <FieldPulseAgentDownloadModal :open="agentModalOpen" @close="agentModalOpen = false" />
  </div>
</template>

<script setup lang="ts">
import FieldPulseAgentDownloadModal from '~/components/fieldpulse/FieldPulseAgentDownloadModal.vue'
import FieldPulseCabinConn from '~/components/fieldpulse/FieldPulseCabinConn.vue'
import {
  closeSession,
  listAgents,
  newTagId,
  openSession,
  s7BatchRead,
  s7DeviceId,
  wsAuthProtocols,
  wsUrl,
  type FieldPulseAgent,
  type FieldPulseSession,
  type FieldPulseTag,
  type ProtocolType,
  type S7DataType,
} from '~/utils/fieldpulse/api'
import { loadAlarms, pushAlarm, type AlarmRow } from '~/utils/fieldpulse/alarmStore'
import { lifecycleReasonZh, lifecycleStateZh } from '~/utils/fieldpulse/lifecycleZh'
import { RobustWebSocket, type WsStatus } from '~/utils/fieldpulse/RobustWebSocket'
import {
  buildCabinConfig,
  dedupeTagDefs,
  downloadCabinConfig,
  loadLocalConfig,
  readCabinConfigFile,
  saveLocalConfig,
  tagsFromConfig,
  type FieldPulseCabinConfig,
} from '~/utils/fieldpulse/configStore'
import { buildS7DbRangeTags, type S7BulkDataType } from '~/utils/fieldpulse/s7DbRange'

const dataTypes: S7DataType[] = [
  'REAL',
  'LREAL',
  'INT',
  'DINT',
  'BOOL',
  'BYTE',
  'WORD',
  'DWORD',
  'STRING',
  'HEX_RAW',
]

const bulkTypes: S7BulkDataType[] = [
  'REAL',
  'INT',
  'DINT',
  'BOOL',
  'BYTE',
  'WORD',
  'DWORD',
  'LREAL',
]

const bootConfig = import.meta.client ? loadLocalConfig() : null

const protocol = ref<ProtocolType>(bootConfig?.protocol ?? 'S7')
const ip = ref(bootConfig?.ip ?? '192.168.0.1')
const port = ref(bootConfig?.port ?? 102)
const rack = ref(bootConfig?.rack ?? 0)
const slot = ref(bootConfig?.slot ?? 1)
const unitId = ref(bootConfig?.unitId ?? 1)
const pollMs = ref(bootConfig?.pollMs ?? 200)
const agentId = ref(bootConfig?.agentId ?? '')
const agents = ref<FieldPulseAgent[]>([])
const agentModalOpen = ref(false)
const showSide = ref(true)
const showConn = ref(true)
const showBulk = ref(true)
const showAlarms = ref(false)
const liveQuery = ref('')
const liveView = ref<'table' | 'cards'>('table')
const showSpark = ref(true)
const lastGenerateTip = ref('')
const importInput = ref<HTMLInputElement | null>(null)
let persistTimer = 0
let skipPersist = false

const bulkDb = ref(bootConfig?.bulk?.db ?? 1)
const bulkStartByte = ref(bootConfig?.bulk?.startByte ?? 0)
const bulkStartBit = ref(bootConfig?.bulk?.startBit ?? 0)
const bulkCount = ref(bootConfig?.bulk?.count ?? 20)
const bulkType = ref(bootConfig?.bulk?.type ?? 'REAL')
const bulkPrefix = ref(bootConfig?.bulk?.prefix ?? 'db1_')
const bulkWarnings = ref<string[]>([])

function defaultTags(): FieldPulseTag[] {
  return [
    { id: newTagId(), tagKey: 'temperature', address: '%DB1:4.0:REAL', dataType: 'REAL' },
    { id: newTagId(), tagKey: 'flag', address: '%I0.0:BOOL', dataType: 'BOOL' },
  ]
}

const tags = ref<FieldPulseTag[]>(bootConfig ? tagsFromConfig(bootConfig) : defaultTags())

const session = ref<FieldPulseSession | null>(null)
const busy = ref(false)
const error = ref('')
const wsStatus = ref<WsStatus>('closed')
const alarms = ref<AlarmRow[]>([])

type LiveRow = {
  tagKey: string
  address: string
  value: unknown
  dataType: string
  quality: string
  epochMillis: number
  history: number[]
  pending: boolean
}
const liveMap = reactive<Record<string, LiveRow>>({})
const canvases = new Map<string, HTMLCanvasElement>()
let pendingTelemetry: Array<Record<string, unknown>> = []
let raf = 0
let client: RobustWebSocket | null = null

const defaultPort = computed(() => {
  if (protocol.value === 'MODBUS') return 502
  if (protocol.value === 'CUSTOM_HEX') return 9500
  return 102
})

const addressPlaceholder = computed(() => {
  if (protocol.value === 'MODBUS') return 'holding-register:1:INT'
  if (protocol.value === 'CUSTOM_HEX') return 'offset:4,len:4'
  return '%DB1:4.0:REAL'
})

const previewDeviceId = computed(() => {
  if (protocol.value === 'S7') {
    if (!ip.value.trim()) return '（请填写 IP）'
    return s7DeviceId(ip.value, port.value, rack.value, slot.value)
  }
  return session.value?.deviceId || '（启动会话后由服务端分配）'
})

/** 右侧只展示当前点位表；不把历史残留值叠进去 */
const liveRows = computed(() => {
  const rows: LiveRow[] = []
  const seen = new Set<string>()
  for (const t of tags.value) {
    const key = t.tagKey?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    const live = liveMap[key]
    if (live) {
      rows.push({
        ...live,
        tagKey: key,
        address: t.address || live.address,
        dataType: t.dataType || live.dataType,
        pending: false,
      })
    } else {
      rows.push({
        tagKey: key,
        address: t.address,
        value: null,
        dataType: t.dataType,
        quality: '',
        epochMillis: 0,
        history: [],
        pending: true,
      })
    }
  }
  return rows.sort((a, b) => a.tagKey.localeCompare(b.tagKey, undefined, { numeric: true }))
})

const filteredLiveRows = computed(() => {
  const q = liveQuery.value.trim().toLowerCase()
  if (!q) return liveRows.value
  return liveRows.value.filter(
    (r) => r.tagKey.toLowerCase().includes(q) || (r.address || '').toLowerCase().includes(q),
  )
})

const liveStats = computed(() => {
  let good = 0
  let bad = 0
  let pending = 0
  for (const r of liveRows.value) {
    if (r.pending) {
      pending++
      continue
    }
    if (isGoodQuality(r.quality)) good++
    else bad++
  }
  return { good, bad, pending }
})

function isGoodQuality(q: string) {
  return !q || q === 'GOOD' || q.startsWith('GOOD')
}

function shortQuality(q: string) {
  if (!q) return '—'
  if (q === 'GOOD' || q.startsWith('GOOD')) return 'OK'
  if (q.startsWith('BAD')) return 'BAD'
  return q.length > 10 ? q.slice(0, 10) + '…' : q
}

const bulkPreviewText = computed(() => {
  try {
    const type = normalizeBulkTypeValue(bulkType.value)
    const r = buildS7DbRangeTags({
      dbNumber: bulkDb.value,
      startByte: bulkStartByte.value,
      startBit: bulkStartBit.value,
      count: Math.min(Math.max(1, bulkCount.value || 1), 3),
      dataType: type,
      namePrefix: bulkPrefix.value || undefined,
      autoAlign: true,
    })
    const sample = r.tags.map((t) => t.address).join(' → ')
    const more = bulkCount.value > 3 ? ` … 共 ${bulkCount.value} 点` : ''
    return `${sample}${more}（占用至字节 ${r.endByteExclusive}）`
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
})

watch([bulkDb, bulkType], () => {
  if (!bulkPrefix.value || /^db\d+_$/i.test(bulkPrefix.value)) {
    bulkPrefix.value = `db${bulkDb.value}_`
  }
})

const isBulkBool = computed(
  () =>
    String(bulkType.value || '')
      .trim()
      .toUpperCase() === 'BOOL',
)

// const operationSteps = computed(() => {
//   if (protocol.value === 'CUSTOM_HEX') {
//     return [
//       '确认本机防火墙放行监听端口，再点「启动会话」打开 TCP 监听',
//       '下位机主动连入本机 IP:端口；点位地址用 offset:N,len:M',
//       '有设备连入后，实时值区会刷新；离开页面会自动停止会话',
//     ]
//   }
//   if (protocol.value === 'MODBUS') {
//     return [
//       '填写设备 IP、端口（默认 502）、UnitId，并配置保持寄存器点位',
//       '点「启动会话」开始轮询；同网段、设备允许主站访问',
//       '会话在线后实时值自动更新；不用时点「停止会话」释放连接',
//     ]
//   }
//   return [
//     '填写 PLC 内网 IP，并在「现场代理」选择已上线的 Agent（云端勿直连）',
//     '用「按 DB 批量生成」生成连续点位（类型步进自动对齐），或手动加点位',
//     '启动会话后看实时值；改点位需先停止再启动。单次批量读可先验证',
//   ]
// })

const tipTone = computed<'idle' | 'ok' | 'warn' | 'bad'>(() => {
  if (error.value) return 'bad'
  if (wsStatus.value !== 'open') return 'warn'
  const state = session.value?.lifecycleState
  if (state === 'ONLINE' && session.value?.connected) {
    if (liveStats.value.pending > 0) return 'warn'
    return 'ok'
  }
  if (state === 'RECONNECTING' || state === 'OFFLINE') return 'warn'
  return 'idle'
})

const contextualTip = computed(() => {
  if (error.value) {
    return `当前异常：${error.value}。请核对设备参数后重试「单次读」或重新「启动」。`
  }
  if (wsStatus.value === 'reconnecting' || wsStatus.value === 'connecting') {
    return '实时通道连接中…请确认本机后端已启动，稍后会自动重连。'
  }
  if (wsStatus.value === 'closed') {
    return '实时通道未接通。请确认后端已启动，并刷新页面。'
  }
  if (!session.value) {
    if (tags.value.length <= 2) {
      return 'WS 已就绪。要看整块 DB：左侧填数量 →「生成替换」→「启动」；右侧「全部寄存器」会列出所有点。'
    }
    return `已配置 ${tags.value.length} 个点位。点「启动」后右侧显示全部寄存器实时值。`
  }
  const state = session.value.lifecycleState
  if (state === 'ONLINE' && session.value.connected) {
    if (liveStats.value.pending > 0) {
      return `会话在线，但有 ${liveStats.value.pending} 个点尚未推送。若刚改过点位，请点「停止」再「启动」，或用「生成并重启」。`
    }
    return `设备在线，右侧共 ${tags.value.length} 个寄存器。修改点位后需停止再启动。`
  }
  if (state === 'RECONNECTING') {
    return '设备暂时连不上，系统正在重试。请检查 IP/端口/机架插槽、PLC 上电、以及 Agent 窗口是否仍开着。'
  }
  if (state === 'OFFLINE') {
    return '会话已离线。可点「启动」重新拉起，或先用「单次读」验证连通性。'
  }
  return '会话已建立，等待设备状态更新…'
})

function onProtocolChange() {
  port.value = defaultPort.value
  if (protocol.value === 'S7') {
    tags.value = [
      { id: newTagId(), tagKey: 'temperature', address: '%DB1:4.0:REAL', dataType: 'REAL' },
      { id: newTagId(), tagKey: 'flag', address: '%I0.0:BOOL', dataType: 'BOOL' },
    ]
  } else if (protocol.value === 'MODBUS') {
    tags.value = [
      { id: newTagId(), tagKey: 'holding1', address: 'holding-register:1:INT', dataType: 'INT' },
    ]
  } else {
    tags.value = [
      { id: newTagId(), tagKey: 'temperature', address: 'offset:4,len:4', dataType: 'REAL' },
    ]
  }
}

function addTag() {
  tags.value.push({
    id: newTagId(),
    tagKey: `tag${tags.value.length + 1}`,
    address: addressPlaceholder.value,
    dataType: 'INT',
  })
}

function removeTag(id: string) {
  const victim = tags.value.find((t) => t.id === id)
  tags.value = tags.value.filter((t) => t.id !== id)
  if (victim?.tagKey) {
    Reflect.deleteProperty(liveMap, victim.tagKey)
    canvases.delete(victim.tagKey)
  }
  if (session.value) {
    lastGenerateTip.value = '已删除变量。当前会话仍按旧点位轮询，请「停止」再「启动」后生效。'
  }
}

function removeTagByKey(tagKey: string) {
  const hit = tags.value.find((t) => t.tagKey === tagKey)
  if (hit) {
    removeTag(hit.id)
    return
  }
  Reflect.deleteProperty(liveMap, tagKey)
  canvases.delete(tagKey)
}

function clearTags() {
  if (!tags.value.length) return
  tags.value = []
  clearLiveMap()
  lastGenerateTip.value = session.value
    ? '已清空点位。请「停止」会话，或重新配置后「启动」。'
    : '已清空点位。'
}

function normalizeBulkTypeValue(raw: string): S7BulkDataType {
  const t = String(raw || '')
    .trim()
    .toUpperCase()
  if (!(bulkTypes as string[]).includes(t)) {
    throw new Error(`不支持的类型「${raw}」。可用：${bulkTypes.join(' / ')}`)
  }
  return t as S7BulkDataType
}

function normalizeBulkType() {
  try {
    bulkType.value = normalizeBulkTypeValue(bulkType.value)
  } catch {
    // 预览区会显示错误；失焦时不强行改回，避免打断输入
  }
}

function normalizeTagType(tag: FieldPulseTag) {
  const t = String(tag.dataType || '')
    .trim()
    .toUpperCase()
  if (t) tag.dataType = t
  // S7 绝对地址末尾 :TYPE 与类型框保持一致
  if (t && tag.address && /^%[^:]+:[^:]+:[A-Za-z_]+(\([^)]*\))?$/i.test(tag.address.trim())) {
    tag.address = tag.address.trim().replace(/:[A-Za-z_]+(\([^)]*\))?$/i, `:${t}`)
  }
}

function onGenerateDbRange(append: boolean) {
  error.value = ''
  bulkWarnings.value = []
  lastGenerateTip.value = ''
  try {
    const type = normalizeBulkTypeValue(bulkType.value)
    bulkType.value = type
    const result = buildS7DbRangeTags({
      dbNumber: bulkDb.value,
      startByte: bulkStartByte.value,
      startBit: bulkStartBit.value,
      count: bulkCount.value,
      dataType: type,
      namePrefix: bulkPrefix.value || undefined,
      autoAlign: true,
      maxCount: 128,
    })
    bulkWarnings.value = result.warnings
    if (result.effectiveStartByte !== bulkStartByte.value) {
      bulkStartByte.value = result.effectiveStartByte
    }
    const next: FieldPulseTag[] = result.tags.map((t) => ({
      id: newTagId(),
      tagKey: t.tagKey,
      address: t.address,
      dataType: t.dataType as S7DataType,
    }))
    tags.value = dedupeTagDefs(append ? [...tags.value, ...next] : next)
    if (tags.value.length >= 40 && pollMs.value < 300) {
      pollMs.value = 300
    }
    if (tags.value.length > 24) {
      showSpark.value = false
    }
    replaceLiveForTags()
    if (session.value) {
      lastGenerateTip.value = `已生成 ${next.length} 点（当前列表 ${tags.value.length}）。会话仍用旧点位，请点「停止」再「启动」，或直接「生成并重启」。`
    } else {
      lastGenerateTip.value = `已生成 ${next.length} 点，右侧已列出。点「启动」开始采集。`
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onGenerateAndRestart() {
  onGenerateDbRange(false)
  if (error.value) return
  await onOpenSession()
  if (!error.value) {
    lastGenerateTip.value = `已生成并启动，右侧监控 ${tags.value.length} 个寄存器。`
  }
}

/** 匹配 TIA Portal 常见静态布局（如 SJK1：BOOL@0.0 / INT@2.0 / DINT@4.0 / REAL@8.0） */
async function onApplyTiaStructure() {
  error.value = ''
  bulkWarnings.value = []
  const db = Math.max(1, Math.trunc(bulkDb.value || 1))
  tags.value = [
    { id: newTagId(), tagKey: '闪烁BOOL', address: `%DB${db}:0.0:BOOL`, dataType: 'BOOL' },
    { id: newTagId(), tagKey: 'INT', address: `%DB${db}:2.0:INT`, dataType: 'INT' },
    { id: newTagId(), tagKey: 'DINT', address: `%DB${db}:4.0:DINT`, dataType: 'DINT' },
    { id: newTagId(), tagKey: 'REAL', address: `%DB${db}:8.0:REAL`, dataType: 'REAL' },
  ]
  clearLiveMap()
  if (session.value) {
    await onOpenSession()
    lastGenerateTip.value = error.value
      ? `已写入 TIA 结构，但重启失败：${error.value}`
      : `已按 TIA 结构配置并重启 DB${db}（BOOL/INT/DINT/REAL），请看右侧全部寄存器。`
  } else {
    lastGenerateTip.value = `已按 TIA 结构配置 DB${db}：BOOL@0.0、INT@2.0、DINT@4.0、REAL@8.0。点「启动」即可在右侧看到。`
  }
}

/** 展示精度：整数原样；浮点保留 REAL 有效精度，避免 round(3位) 失真 */
function formatVal(v: unknown) {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return String(v)
    if (Number.isInteger(v)) return String(v)
    // 极小/极大（未初始化区常见）用科学计数；常见量程用定点
    const abs = Math.abs(v)
    if (abs !== 0 && (abs < 1e-4 || abs >= 1e7)) {
      return v.toExponential(4)
    }
    return Number.parseFloat(v.toPrecision(7)).toString()
  }
  if (typeof v === 'string') {
    const n = Number(v)
    if (v.trim() !== '' && Number.isFinite(n) && !Number.isInteger(n)) {
      return formatVal(n)
    }
  }
  return String(v)
}

function formatTime(ms: number) {
  if (!ms) return '—'
  return new Date(ms).toLocaleTimeString()
}

function bindCanvas(tagKey: string, el: unknown) {
  if (el instanceof HTMLCanvasElement) canvases.set(tagKey, el)
}

function drawSpark(tagKey: string) {
  const canvas = canvases.get(tagKey)
  const row = liveMap[tagKey]
  if (!canvas || !row) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  const hist = row.history
  if (hist.length < 2) return
  const min = Math.min(...hist)
  const max = Math.max(...hist)
  const span = max - min || 1
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  hist.forEach((v, i) => {
    const x = (i / (hist.length - 1)) * (w - 2) + 1
    const y = h - 2 - ((v - min) / span) * (h - 4)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.stroke()
}

function flushTelemetry() {
  raf = 0
  const batch = pendingTelemetry
  pendingTelemetry = []
  const allowed = new Set(tags.value.map((t) => t.tagKey.trim()).filter(Boolean))
  for (const item of batch) {
    const tagKey = String(item.tagKey || '').trim()
    if (!tagKey || !allowed.has(tagKey)) continue
    const num = typeof item.value === 'number' ? item.value : Number(item.value)
    const prev = liveMap[tagKey]
    const history = prev?.history ? [...prev.history] : []
    if (Number.isFinite(num)) {
      history.push(num)
      if (history.length > 40) history.shift()
    }
    liveMap[tagKey] = {
      tagKey,
      address: tags.value.find((t) => t.tagKey === tagKey)?.address || prev?.address || '',
      value: item.value,
      dataType: String(item.dataType || prev?.dataType || ''),
      quality: String(item.quality || ''),
      epochMillis: Number(item.epochMillis || Date.now()),
      history,
      pending: false,
    }
    drawSpark(tagKey)
  }
  pruneLiveMap()
}

function enqueueTelemetry(items: unknown) {
  if (!Array.isArray(items)) return
  pendingTelemetry.push(...(items as Array<Record<string, unknown>>))
  if (!raf) raf = requestAnimationFrame(flushTelemetry)
}

function onWsMessage(data: unknown) {
  if (!data || typeof data !== 'object') return
  const msg = data as Record<string, unknown>
  const type = String(msg.type || '')
  if (type === 'telemetry') {
    enqueueTelemetry(msg.items)
  } else if (type === 'lifecycle') {
    const item = msg.item as Record<string, unknown> | undefined
    if (!item) return
    const state = String(item.state || '')
    if (state === 'OFFLINE' || state === 'RECONNECTING') {
      alarms.value = pushAlarm({
        deviceId: String(item.deviceId || ''),
        state,
        reason: lifecycleReasonZh(String(item.reason || '')),
        epochMillis: Number(item.epochMillis || Date.now()),
      })
    }
    if (session.value && session.value.deviceId === item.deviceId) {
      session.value = {
        ...session.value,
        lifecycleState: state as FieldPulseSession['lifecycleState'],
        connected: state === 'ONLINE',
      }
    }
  } else if (type === 's7.batchReadResult') {
    if (!msg.ok) {
      error.value = lifecycleReasonZh(String(msg.message || '批量读取失败'))
      return
    }
    if (!msg.values) return
    const values = msg.values as Record<string, unknown>
    const items = Object.keys(values)
      .filter((k) => !k.endsWith('__quality'))
      .map((tagKey) => ({
        tagKey,
        value: values[tagKey],
        dataType: tags.value.find((t) => t.tagKey === tagKey)?.dataType || '',
        quality: String(values[`${tagKey}__quality`] || 'GOOD'),
        epochMillis: Number(msg.epochMillis || Date.now()),
      }))
    enqueueTelemetry(items)
  } else if (type === 'error') {
    error.value = lifecycleReasonZh(String(msg.message || 'WebSocket 错误'))
  }
}

function clearLiveMap() {
  for (const key of Object.keys(liveMap)) {
    Reflect.deleteProperty(liveMap, key)
  }
  pendingTelemetry = []
  canvases.clear()
}

/** 只保留当前点位表中的实时值，去掉历史残留 */
function pruneLiveMap() {
  const allowed = new Set(tags.value.map((t) => t.tagKey.trim()).filter(Boolean))
  for (const key of Object.keys(liveMap)) {
    if (!allowed.has(key)) {
      Reflect.deleteProperty(liveMap, key)
      canvases.delete(key)
    }
  }
  pendingTelemetry = pendingTelemetry.filter((item) =>
    allowed.has(String(item.tagKey || '').trim()),
  )
}

function replaceLiveForTags() {
  clearLiveMap()
}

function replaceTags(next: FieldPulseTag[]) {
  tags.value = dedupeTagDefs(next)
  replaceLiveForTags()
}

async function cleanupSession(opts?: { keepalive?: boolean }) {
  const id = session.value?.deviceId
  if (!id) {
    clearLiveMap()
    return
  }
  try {
    await closeSession(id, opts)
  } catch {
    /* 卸载/刷新时尽力关闭，忽略网络错误 */
  }
  session.value = null
  clearLiveMap()
}

function ensureWs() {
  if (client) return
  client = new RobustWebSocket(
    wsUrl('tools'),
    onWsMessage,
    (s) => {
      wsStatus.value = s
    },
    null,
    wsAuthProtocols(),
  )
  client.connect()
}

async function onOpenSession() {
  error.value = ''
  busy.value = true
  try {
    if (session.value?.deviceId) {
      await cleanupSession()
    } else {
      clearLiveMap()
    }
    ensureWs()
    const s = await openSession({
      protocolType: protocol.value,
      host: protocol.value === 'CUSTOM_HEX' ? '' : ip.value,
      port: port.value,
      rack: rack.value,
      slot: slot.value,
      unitId: unitId.value,
      pollIntervalMs: pollMs.value,
      agentId: protocol.value === 'S7' && agentId.value ? agentId.value : undefined,
      tags: tags.value
        .filter((t) => t.tagKey && t.address)
        .map(({ tagKey, address, dataType }) => ({
          tagKey,
          address,
          dataType: String(dataType || 'REAL')
            .trim()
            .toUpperCase() as S7DataType,
        })),
    })
    session.value = s
  } catch (e) {
    error.value = lifecycleReasonZh(e instanceof Error ? e.message : String(e))
  } finally {
    busy.value = false
  }
}

async function onCloseSession() {
  if (!session.value) return
  busy.value = true
  error.value = ''
  try {
    await cleanupSession()
  } catch (e) {
    error.value = lifecycleReasonZh(e instanceof Error ? e.message : String(e))
  } finally {
    busy.value = false
  }
}

async function onBatchRead() {
  error.value = ''
  busy.value = true
  try {
    ensureWs()
    const tagMap: Record<string, string> = {}
    for (const t of tags.value) {
      if (t.tagKey && t.address) tagMap[t.tagKey] = t.address
    }
    const deviceId = s7DeviceId(ip.value, port.value, rack.value, slot.value)
    const viaAgent = agentId.value || undefined
    // 优先走 WS 指令（与 Hub 对齐）；未连通时回落 REST
    if (client && wsStatus.value === 'open') {
      client.send({
        type: 's7.batchRead',
        requestId: `r-${Date.now().toString(36)}`,
        ip: ip.value,
        port: port.value,
        rack: rack.value,
        slot: slot.value,
        deviceId,
        agentId: viaAgent,
        tags: tagMap,
      })
      return
    }
    const values = await s7BatchRead({
      ip: ip.value,
      port: port.value,
      rack: rack.value,
      slot: slot.value,
      deviceId,
      agentId: viaAgent,
      tags: tagMap,
    })
    const items = Object.keys(values)
      .filter((k) => !k.endsWith('__quality'))
      .map((tagKey) => ({
        tagKey,
        value: values[tagKey],
        dataType: tags.value.find((t) => t.tagKey === tagKey)?.dataType || '',
        quality: String(values[`${tagKey}__quality`] || 'GOOD'),
        epochMillis: Date.now(),
      }))
    enqueueTelemetry(items)
  } catch (e) {
    error.value = lifecycleReasonZh(e instanceof Error ? e.message : String(e))
  } finally {
    busy.value = false
  }
}

function snapshotConfig(name?: string): FieldPulseCabinConfig {
  return buildCabinConfig({
    name,
    protocol: protocol.value,
    ip: ip.value,
    port: port.value,
    rack: rack.value,
    slot: slot.value,
    unitId: unitId.value,
    pollMs: pollMs.value,
    agentId: agentId.value,
    tags: tags.value,
    bulk: {
      db: bulkDb.value,
      startByte: bulkStartByte.value,
      startBit: bulkStartBit.value,
      count: bulkCount.value,
      type: bulkType.value,
      prefix: bulkPrefix.value,
    },
  })
}

function persistConfigSoon() {
  if (!import.meta.client || skipPersist) return
  if (persistTimer) window.clearTimeout(persistTimer)
  persistTimer = window.setTimeout(() => {
    persistTimer = 0
    saveLocalConfig(snapshotConfig())
  }, 400)
}

function applyConfig(config: FieldPulseCabinConfig, opts?: { tip?: string; warnings?: string[] }) {
  skipPersist = true
  try {
    // 导入/恢复一律整体覆盖，不与现有点位叠加
    protocol.value = config.protocol
    ip.value = config.ip
    port.value = config.port
    rack.value = config.rack
    slot.value = config.slot
    unitId.value = config.unitId
    pollMs.value = config.pollMs
    agentId.value = config.agentId
    replaceTags(tagsFromConfig(config))
    if (config.bulk) {
      bulkDb.value = config.bulk.db
      bulkStartByte.value = config.bulk.startByte
      bulkStartBit.value = config.bulk.startBit
      bulkCount.value = config.bulk.count
      bulkType.value = config.bulk.type
      bulkPrefix.value = config.bulk.prefix
      showBulk.value = true
    }
    const warnText = opts?.warnings?.length ? `（${opts.warnings.join('；')}）` : ''
    lastGenerateTip.value =
      opts?.tip ||
      `已载入配置：${tags.value.length} 个点位${config.name ? `「${config.name}」` : ''}${warnText}。点「启动」即可采集。`
    if (session.value) {
      lastGenerateTip.value += ' 当前会话仍用旧点位，请先「停止」再「启动」。'
    }
  } finally {
    skipPersist = false
    saveLocalConfig(snapshotConfig(config.name))
  }
}

function onExportConfig() {
  error.value = ''
  try {
    const cfg = snapshotConfig()
    downloadCabinConfig(cfg)
    lastGenerateTip.value = `已导出 ${cfg.tags.length} 个点位配置（JSON）。下次用「导入」或自动恢复即可。`
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function triggerImport() {
  importInput.value?.click()
}

async function onImportFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  error.value = ''
  try {
    const { config, warnings } = await readCabinConfigFile(file)
    applyConfig(config, {
      tip: `已从「${file.name}」覆盖导入 ${config.tags.length} 个点位（不叠加）`,
      warnings,
    })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

watch(
  [
    protocol,
    ip,
    port,
    rack,
    slot,
    unitId,
    pollMs,
    agentId,
    tags,
    bulkDb,
    bulkStartByte,
    bulkStartBit,
    bulkCount,
    bulkType,
    bulkPrefix,
  ],
  () => persistConfigSoon(),
  { deep: true },
)

function onPageHide() {
  saveLocalConfig(snapshotConfig())
  void cleanupSession({ keepalive: true })
}

async function refreshAgents() {
  try {
    agents.value = await listAgents()
    if (agentId.value && !agents.value.some((a) => a.agentId === agentId.value)) {
      // 保留已保存的 agentId，即使暂时不在线，便于下次导入后仍选中
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // 在线列表需登录；匿名仍可手动填写 agentId 连接
    if (/401|403|未登录|未解锁|UNAUTHORIZED|FORBIDDEN/i.test(msg)) {
      agents.value = []
      return
    }
    error.value = lifecycleReasonZh(msg)
  }
}

let agentPollTimer = 0

onMounted(() => {
  alarms.value = loadAlarms()
  // 配置已在 setup 同步加载；此处只提示，避免再次 apply 造成叠加
  if (bootConfig) {
    lastGenerateTip.value = bootConfig.tags.length
      ? `已自动恢复上次配置：${tags.value.length} 个点位（覆盖加载，不会叠加）`
      : '已恢复连接参数（尚无点位）'
  }
  replaceLiveForTags()
  ensureWs()
  void refreshAgents()
  agentPollTimer = window.setInterval(() => {
    void refreshAgents()
  }, 8000)
  window.addEventListener('pagehide', onPageHide)
})

onUnmounted(() => {
  window.removeEventListener('pagehide', onPageHide)
  if (persistTimer) window.clearTimeout(persistTimer)
  if (agentPollTimer) clearInterval(agentPollTimer)
  if (raf) cancelAnimationFrame(raf)
  saveLocalConfig(snapshotConfig())
  void cleanupSession()
  client?.close()
  client = null
})
</script>

<style scoped lang="scss">
.fp {
  @apply flex h-full min-h-0 flex-col gap-2;
  padding: 0.15rem;
}

.fp-bar {
  @apply flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-400/25 bg-slate-950/70 px-2.5 py-2;
}
.fp-bar__chips {
  @apply flex min-w-0 flex-wrap items-center gap-1.5;
}
.fp-bar__actions {
  @apply flex flex-wrap items-center gap-1.5;
}
.fp-file {
  @apply sr-only;
}

.fp-chip {
  @apply inline-flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.68rem] text-slate-300;
}
.fp-chip--ok {
  @apply border-emerald-400/35 bg-emerald-500/10 text-emerald-200;
}
.fp-chip--warn {
  @apply border-amber-400/35 bg-amber-500/10 text-amber-100;
}
.fp-chip--bad {
  @apply border-rose-400/35 bg-rose-500/10 text-rose-200;
}
.fp-chip--muted {
  @apply text-slate-500;
}

.fp-banner {
  @apply shrink-0 rounded-md border px-2.5 py-1.5 text-[0.78rem] leading-snug;
}
.fp-banner--ok {
  @apply border-emerald-400/25 bg-emerald-500/10 text-emerald-200;
}
.fp-banner--warn {
  @apply border-amber-400/25 bg-amber-500/10 text-amber-100;
}
.fp-banner--bad {
  @apply border-rose-400/30 bg-rose-500/10 text-rose-200;
}

.fp-layout {
  @apply grid min-h-0 flex-1 gap-2;
  grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
}
.fp-layout--full {
  grid-template-columns: 1fr;
}
@media (max-width: 900px) {
  .fp-layout {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}

.fp-side {
  @apply flex min-h-0 flex-col gap-2 overflow-hidden;
}
.fp-main {
  @apply flex min-h-0 flex-col overflow-hidden rounded-lg border border-cyan-400/25 bg-slate-950/60;
}
.fp-main__toolbar {
  @apply flex shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-2.5 py-2;
}

.fp-panel {
  @apply rounded-lg border border-cyan-400/25 bg-slate-950/60 p-2;
}
.fp-panel--conn {
  @apply shrink-0;
}
.fp-panel--tags {
  @apply flex min-h-0 flex-1 flex-col overflow-hidden;
}
.fp-panel--alarms {
  @apply shrink-0;
}
.fp-panel__body {
  @apply mt-1.5;
}
.fp-panel__title {
  @apply m-0 flex min-w-0 items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-cyan-300/85;
}
.fp-panel__title--inline {
  @apply mr-1;
}
.fp-panel__meta {
  @apply rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.62rem] normal-case tracking-normal text-slate-400;
}
.fp-panel__meta--warn {
  @apply bg-amber-500/15 text-amber-200;
}
.fp-panel__row {
  @apply mb-0 flex items-center justify-between gap-2;
}
.fp-panel__toggle {
  @apply mb-0 w-full cursor-pointer border-0 bg-transparent p-0 text-left;
}

.fp-bulk {
  @apply mb-2 mt-2 shrink-0 rounded-md border border-cyan-400/15 bg-slate-900/55 p-2;
}
.fp-grid {
  @apply grid gap-1.5;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.fp-grid--conn {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.fp-grid--bulk {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.fp-field {
  @apply flex flex-col gap-0.5 text-[0.62rem] text-slate-400;
  input,
  select {
    @apply w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[0.78rem] text-cyan-50 outline-none;
  }
}
.fp-field--wide {
  grid-column: 1 / -1;
}
.fp-inline {
  @apply flex items-center gap-1;
  select,
  input {
    @apply min-w-0 flex-1;
  }
}
.fp-inline--pair {
  input {
    @apply text-center;
  }
}
.fp-inline--tools {
  @apply flex-wrap justify-end;
}
.fp-sep {
  @apply shrink-0 text-slate-500;
}

.fp-hint {
  @apply mt-1 font-mono text-[0.62rem] leading-snug text-slate-500;
}
.fp-hint--warn {
  @apply text-amber-200/85;
}
.fp-hint--ok {
  @apply text-emerald-300/90;
}
.fp-hint--device {
  @apply mt-1.5 truncate text-cyan-200/60;
}

.fp-check {
  @apply ml-auto flex items-center gap-1 font-mono text-[0.68rem] text-slate-400;
  input {
    @apply accent-cyan-400;
  }
}

.fp-tag-head {
  @apply mb-1 mt-2 grid shrink-0 gap-1 px-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-slate-500;
  grid-template-columns: 0.85fr 1.15fr 5.5rem 2rem;
}
.fp-tag-list {
  @apply min-h-0 flex-1 space-y-1 overflow-auto pr-0.5;
}
.fp-tag-list--dense {
  .fp-tag-row input {
    @apply py-0.5 text-[0.68rem];
  }
}
.fp-tag-empty {
  @apply rounded border border-dashed border-white/10 px-2 py-3 text-center font-mono text-[0.68rem] text-slate-500;
}
.fp-dot {
  @apply inline-block h-2 w-2 rounded-full bg-slate-500;
}
.fp-dot--open {
  @apply bg-emerald-400;
}
.fp-dot--connecting,
.fp-dot--reconnecting {
  @apply bg-amber-400;
}
.fp-dot--closed {
  @apply bg-rose-400;
}

.fp-actions {
  @apply mt-2 flex flex-wrap gap-1.5;
}
.fp-actions--tight {
  @apply mt-1.5;
}
.fp-actions--bulk {
  @apply mt-1.5 gap-1;
}

.fp-btn {
  @apply rounded border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[0.8rem] text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40;
}
.fp-btn--ghost {
  @apply border-white/15 bg-white/5 hover:bg-white/10;
}
.fp-btn--accent {
  @apply border-emerald-400/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25;
}
.fp-btn--sm {
  @apply px-2 py-0.5 text-[0.72rem];
}
.fp-btn--on {
  @apply border-cyan-300/50 bg-cyan-500/25;
}
.fp-btn--danger {
  @apply border-rose-400/40 text-rose-200 hover:bg-rose-500/20;
}

.fp-card__head-actions {
  @apply flex shrink-0 items-center gap-1;
}

.fp-muted {
  @apply text-slate-500;
}
.fp-mono {
  @apply font-mono;
}

.fp-tag-row {
  @apply grid gap-1;
  grid-template-columns: 0.85fr 1.15fr 5.5rem 2rem;
  input,
  select {
    @apply min-w-0 rounded border border-white/10 bg-black/40 px-1.5 py-1 font-mono text-[0.72rem] text-cyan-50;
  }
  .fp-btn {
    @apply justify-self-end px-1;
  }
}

.fp-search {
  @apply min-w-[9rem] flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[0.78rem] text-cyan-50 outline-none;
}

.fp-seg {
  @apply ml-auto flex overflow-hidden rounded border border-white/15;
}
.fp-seg__btn {
  @apply border-0 bg-transparent px-2.5 py-1 font-mono text-[0.7rem] text-slate-400 hover:bg-white/5;
}
.fp-seg__btn--on {
  @apply bg-cyan-500/20 text-cyan-100;
}

.fp-empty {
  @apply flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-500;
}

.fp-table-wrap {
  @apply min-h-0 flex-1 overflow-auto;
}
.fp-table {
  @apply w-full border-collapse text-left text-[0.82rem] text-slate-200;
  th {
    @apply sticky top-0 z-[1] bg-slate-950/95 px-2.5 py-2 font-mono text-[0.62rem] uppercase tracking-wider text-cyan-300/70;
  }
  td {
    @apply border-t border-white/5 px-2.5 py-2 align-middle;
  }
}
.fp-table--dense {
  @apply text-[0.76rem];
  th {
    @apply px-2 py-1.5;
  }
  td {
    @apply px-2 py-1;
  }
  .fp-table__val {
    @apply text-[0.9rem];
  }
}
.fp-table__idx {
  @apply w-8 font-mono text-[0.7rem] text-slate-500;
}
.fp-table__key {
  @apply font-mono text-cyan-100/90;
}
.fp-table__addr {
  @apply max-w-[11rem] truncate text-[0.72rem] text-slate-400;
}
.fp-table__val {
  @apply text-base font-semibold tracking-wide text-cyan-50;
}
.fp-table__time {
  @apply text-[0.72rem] text-slate-400;
}
.fp-row--bad {
  @apply bg-rose-500/[0.06];
}
.fp-row--pending {
  @apply opacity-55;
}

.fp-q {
  @apply rounded px-1.5 py-0.5 font-mono text-[0.65rem];
}
.fp-q--good {
  @apply bg-emerald-500/15 text-emerald-300;
}
.fp-q--bad {
  @apply bg-rose-500/15 text-rose-300;
}
.fp-q--pending {
  @apply bg-amber-500/15 text-amber-200;
}

.fp-cards {
  @apply grid min-h-0 flex-1 content-start gap-2 overflow-auto p-2.5;
  grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
}
.fp-card {
  @apply rounded-lg border border-cyan-400/20 bg-black/35 p-2.5;
}
.fp-card--bad {
  @apply border-rose-400/30 bg-rose-950/20;
}
.fp-card--pending {
  @apply border-dashed opacity-60;
}
.fp-card__head {
  @apply mb-1 flex items-center justify-between gap-2;
}
.fp-card__name {
  @apply truncate font-mono text-[0.72rem] text-cyan-200/90;
}
.fp-card__value {
  @apply font-mono text-xl font-semibold leading-tight text-cyan-50;
  word-break: break-all;
}
.fp-card__meta {
  @apply mt-1 flex justify-between font-mono text-[0.65rem] text-slate-500;
}

.fp-spark {
  @apply block rounded bg-black/30;
}
.fp-spark--wide {
  @apply mt-2 w-full;
}

.fp-alarms {
  @apply mt-2 max-h-28 space-y-1 overflow-auto text-[0.72rem] text-slate-300;
  li {
    @apply flex flex-wrap gap-2 border-b border-white/5 py-1;
  }
}
</style>
