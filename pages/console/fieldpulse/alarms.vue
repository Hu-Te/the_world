<template>
  <PlcCenterShell title="报警中心">
    <template #actions>
      <button type="button" class="plc-btn" :disabled="actionBusy" @click="toggleRuleForm">
        {{ showRule ? '收起' : '新建规则' }}
      </button>
      <button type="button" class="plc-btn plc-btn--ghost" :disabled="actionBusy" @click="onExport">
        导出 CSV
      </button>
      <button
        type="button"
        class="plc-btn plc-btn--ghost"
        :disabled="loading || actionBusy"
        @click.prevent.stop="reloadList">
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </template>

    <div class="plc-alarms" @pointerdown="markInteract">
    <p v-if="error" class="plc-err">{{ error }}</p>

    <form v-if="showRule" class="plc-form" @submit.prevent="saveRule">
      <label>
        设备
        <select v-model="ruleForm.deviceId" required>
          <option disabled value="">选择设备</option>
          <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </label>
      <label>
        点位
        <select v-model="ruleForm.tagKey" required :disabled="!tagOptions.length">
          <option disabled value="">{{ tagOptions.length ? '选择点位' : '请先选择设备' }}</option>
          <option v-for="t in tagOptions" :key="t.tagKey" :value="t.tagKey">
            {{ t.tagKey }} · {{ t.dataType }} · {{ t.address }}
          </option>
        </select>
      </label>
      <label>规则名 <input v-model="ruleForm.ruleName" required placeholder="如：超温告警" /></label>

      <template v-if="isBoolTag">
        <label>
          条件值
          <select v-model="ruleForm.boolValue">
            <option value="true">等于 true</option>
            <option value="false">等于 false</option>
          </select>
        </label>
      </template>
      <template v-else>
        <label>
          比较
          <select v-model="ruleForm.comparator">
            <option v-for="c in comparators" :key="c.value" :value="c.value">{{ c.label }}</option>
          </select>
        </label>
        <label>
          阈值
          <input v-model.number="ruleForm.threshold" type="number" step="any" required />
        </label>
      </template>

      <label>
        触发方式
        <select v-model="ruleForm.triggerMode">
          <option v-for="m in triggerModes" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>
      <label>
        记次周期（秒）
        <input
          v-model.number="ruleForm.cycleSec"
          type="number"
          min="0.5"
          max="3600"
          step="0.5"
          required
          title="LEVEL 持续记次间隔；边沿模式作防抖。最短 0.5 秒。" />
      </label>
      <p class="plc-form__hint">{{ triggerHint }}</p>

      <div class="plc-form__actions">
        <button type="submit" class="plc-btn">保存规则</button>
      </div>
    </form>

    <div class="plc-panel plc-panel--rules">
      <div class="plc-panel__head">
        <h3 class="plc-h">规则</h3>
        <span class="plc-count" :title="`共 ${rules.length} 条`">
          {{ filteredRules.length }}{{ filteredRules.length !== rules.length ? ` / ${rules.length}` : '' }}
        </span>
      </div>
      <div class="plc-filter">
        <input
          v-model.trim="ruleFilter.q"
          type="search"
          class="plc-filter__q"
          placeholder="搜索规则名 / 点位…"
          autocomplete="off" />
        <select v-model="ruleFilter.deviceId">
          <option value="">全部设备</option>
          <option v-for="d in devices" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
        <select v-model="ruleFilter.triggerMode">
          <option value="">全部触发</option>
          <option value="RISING">上升沿</option>
          <option value="LEVEL">持续成立</option>
          <option value="FALLING">下降沿</option>
        </select>
        <button
          v-if="ruleFilterActive"
          type="button"
          class="link"
          @click="resetRuleFilter">
          清空
        </button>
      </div>
      <ul class="plc-list plc-list--scroll">
        <li v-for="r in filteredRules" :key="r.id">
          <div class="rule-main">
            <p class="rule-name">{{ r.ruleName }}</p>
            <p class="rule-meta mono">
              {{ deviceName(r.deviceId) }} · {{ r.tagKey }} · {{ formatRuleCond(r) }}
            </p>
          </div>
          <button
            type="button"
            class="link danger"
            :disabled="actionBusy"
            @click="removeRule(r.id)">
            删除
          </button>
        </li>
        <li v-if="!rules.length" class="muted">暂无规则</li>
        <li v-else-if="!filteredRules.length" class="muted">无匹配规则</li>
      </ul>
    </div>

    <div class="plc-panel">
      <div class="plc-panel__head">
        <h3 class="plc-h">事件</h3>
        <span class="plc-count">{{ events.length }}</span>
        <div class="plc-panel__actions">
          <button
            type="button"
            class="link"
            :disabled="actionBusy || !hasOrphans"
            title="清除规则已删除但仍残留的事件"
            @click="clearOrphans">
            清除孤儿
          </button>
          <button
            type="button"
            class="link"
            :disabled="actionBusy || !hasAcked"
            @click="clearAcked">
            清除已确认
          </button>
          <button
            type="button"
            class="link danger"
            :disabled="actionBusy || !events.length"
            @click="clearAll">
            清空全部
          </button>
        </div>
      </div>
      <div class="plc-table-wrap">
        <table class="plc-table">
          <thead>
            <tr>
              <th>消息</th>
              <th>值</th>
              <th title="次数按规则的「触发方式」累加">次数</th>
              <th>最近发生</th>
              <th>状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="e in events"
              :key="e.id"
              :class="{ 'is-open': !e.acked, 'is-orphan': e.ruleExists === false }">
              <td>
                <p class="evt-msg">
                  {{ cleanMessage(e.message) }}
                  <span v-if="e.ruleExists === false" class="badge is-orphan" title="规则已删除">孤儿</span>
                </p>
                <p class="evt-sub mono">{{ deviceName(e.deviceId) }} · {{ e.tagKey }}</p>
              </td>
              <td class="mono val">{{ formatEventValue(e) }}</td>
              <td class="mono">{{ e.occurrenceCount }}</td>
              <td>
                <p class="mono time">{{ formatTime(e.lastOccurredAt) }}</p>
                <p v-if="e.firstOccurredAt && e.firstOccurredAt !== e.lastOccurredAt" class="evt-sub">
                  首次 {{ formatTime(e.firstOccurredAt) }}
                </p>
              </td>
              <td>
                <span class="badge" :class="e.acked ? 'is-acked' : 'is-open'">
                  {{ e.acked ? '已确认' : '未确认' }}
                </span>
              </td>
              <td class="evt-actions">
                <button
                  v-if="!e.acked"
                  type="button"
                  class="link"
                  :disabled="actionBusy"
                  @click="ack(e.id)">
                  确认
                </button>
                <span v-else class="evt-sub">{{ formatTime(e.ackedAt) }}</span>
                <button
                  type="button"
                  class="link danger"
                  :disabled="actionBusy"
                  @click="removeEvent(e.id)">
                  清除
                </button>
              </td>
            </tr>
            <tr v-if="!events.length">
              <td colspan="6" class="muted empty">暂无报警事件</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </div>
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import {
  ackAlarm,
  clearAlarms,
  clearOrphanAlarms,
  createAlarmRule,
  deleteAlarm,
  deleteAlarmRule,
  downloadExport,
  listAlarmRules,
  listAlarms,
  listDevices,
  type AlarmEvent,
  type AlarmRule,
  type PlcDevice,
} from '~/utils/console/fieldpulseApi'

definePageMeta({ layout: false })

const comparators = [
  { value: 'GT', label: '大于' },
  { value: 'GTE', label: '大于等于' },
  { value: 'LT', label: '小于' },
  { value: 'LTE', label: '小于等于' },
  { value: 'EQ', label: '等于' },
] as const

const triggerModes = [
  { value: 'RISING', label: '上升沿（条件刚成立时 +1）' },
  { value: 'LEVEL', label: '持续成立（按记次周期 +1）' },
  { value: 'FALLING', label: '下降沿（条件刚解除时 +1）' },
] as const

const devices = ref<PlcDevice[]>([])
const rules = ref<AlarmRule[]>([])
const events = ref<AlarmEvent[]>([])
const error = ref('')
const loading = ref(false)
/** 确认/删除等写操作进行中，禁止轮询冲掉 DOM */
const actionBusy = ref(false)
/** 指针交互宽限：避免 mousedown 后整表重绘导致 click 丢失 */
let interactUntil = 0
const showRule = ref(false)

function markInteract() {
  interactUntil = Date.now() + 2500
}

function normalizeId(v: string | number | null | undefined): string {
  return v == null ? '' : String(v)
}

function normalizeEvents(list: AlarmEvent[]): AlarmEvent[] {
  return list.map((e) => ({
    ...e,
    id: normalizeId(e.id),
    deviceId: normalizeId(e.deviceId),
    ruleId: normalizeId(e.ruleId),
  }))
}

function normalizeRules(list: AlarmRule[]): AlarmRule[] {
  return list.map((r) => ({
    ...r,
    id: normalizeId(r.id),
    deviceId: normalizeId(r.deviceId),
  }))
}

function eventsFingerprint(list: AlarmEvent[]) {
  return list
    .map(
      (e) =>
        `${e.id}|${e.acked ? 1 : 0}|${e.occurrenceCount}|${e.lastOccurredAt}|${e.ackedAt || ''}|${e.ruleExists === false ? 0 : 1}|${e.message}`,
    )
    .join(';')
}

function rulesFingerprint(list: AlarmRule[]) {
  return list.map((r) => `${r.id}|${r.ruleName}|${r.enabled ? 1 : 0}|${r.cycleMs || 0}`).join(';')
}
const ruleForm = reactive({
  deviceId: '' as string,
  tagKey: '',
  ruleName: '',
  comparator: 'GT',
  threshold: 80,
  boolValue: 'true' as 'true' | 'false',
  triggerMode: 'LEVEL' as 'RISING' | 'LEVEL' | 'FALLING',
  cycleSec: 2,
})

const hasAcked = computed(() => events.value.some((e) => e.acked))
const hasOrphans = computed(() => events.value.some((e) => e.ruleExists === false))

const ruleFilter = reactive({
  q: '',
  deviceId: '' as string,
  triggerMode: '' as '' | 'RISING' | 'LEVEL' | 'FALLING',
})

const ruleFilterActive = computed(
  () => Boolean(ruleFilter.q || ruleFilter.deviceId || ruleFilter.triggerMode),
)

const filteredRules = computed(() => {
  const q = ruleFilter.q.trim().toLowerCase()
  return rules.value.filter((r) => {
    if (ruleFilter.deviceId && String(r.deviceId) !== ruleFilter.deviceId) return false
    if (ruleFilter.triggerMode && (r.triggerMode || 'LEVEL') !== ruleFilter.triggerMode) {
      return false
    }
    if (!q) return true
    const hay = `${r.ruleName} ${r.tagKey} ${deviceName(r.deviceId)}`.toLowerCase()
    return hay.includes(q)
  })
})

function resetRuleFilter() {
  ruleFilter.q = ''
  ruleFilter.deviceId = ''
  ruleFilter.triggerMode = ''
}

const selectedDevice = computed(() => devices.value.find((d) => d.id === ruleForm.deviceId))
const tagOptions = computed(() => selectedDevice.value?.tags ?? [])
const selectedTag = computed(() => tagOptions.value.find((t) => t.tagKey === ruleForm.tagKey))
const isBoolTag = computed(() => (selectedTag.value?.dataType || '').toUpperCase() === 'BOOL')

const triggerHint = computed(() => {
  const sec = Number(ruleForm.cycleSec) || 2
  switch (ruleForm.triggerMode) {
    case 'RISING':
      return `仅在条件从不成立变为成立时记一次；${sec} 秒内重复边沿会防抖。清除未确认事件后，若条件仍成立会立刻再记。`
    case 'FALLING':
      return `仅在条件从成立变为不成立时记一次；${sec} 秒内重复边沿会防抖。`
    default:
      return `条件保持成立期间，约每 ${sec} 秒累加一次。确认后会开新事件继续计次；清除后若条件仍成立也会重新开事件。`
  }
})

const deviceMap = computed(() => {
  const m = new Map<string, string>()
  for (const d of devices.value) m.set(d.id, d.name)
  return m
})

watch(
  () => ruleForm.deviceId,
  () => {
    const tags = tagOptions.value
    if (!tags.length) {
      ruleForm.tagKey = ''
      return
    }
    if (!tags.some((t) => t.tagKey === ruleForm.tagKey)) {
      ruleForm.tagKey = tags[0].tagKey
    }
  },
)

watch(
  () => ruleForm.tagKey,
  (key) => {
    if (!key) return
    if (isBoolTag.value) {
      ruleForm.comparator = 'EQ'
      ruleForm.boolValue = 'true'
      ruleForm.triggerMode = 'RISING'
      if (!ruleForm.ruleName.trim() || ruleForm.ruleName.endsWith('超限')) {
        ruleForm.ruleName = `${key} 信号`
      }
    } else {
      ruleForm.triggerMode = 'LEVEL'
      if (!ruleForm.ruleName.trim()) {
        ruleForm.ruleName = `${key} 超限`
        ruleForm.comparator = 'GT'
        ruleForm.threshold = 80
      }
    }
  },
)

function deviceName(id: string | number | null | undefined) {
  if (id == null || id === '') return '—'
  return deviceMap.value.get(String(id)) || String(id)
}

function findTagType(deviceId: string | number, tagKey: string) {
  const d = devices.value.find((x) => x.id === String(deviceId))
  const t = d?.tags.find((x) => x.tagKey === tagKey)
  return (t?.dataType || '').toUpperCase()
}

function comparatorLabel(code: string) {
  return comparators.find((c) => c.value === code)?.label || code
}

function triggerLabel(code: string | undefined) {
  return triggerModes.find((m) => m.value === code)?.label || code || '持续成立'
}

function formatRuleCond(r: AlarmRule) {
  const type = findTagType(r.deviceId, r.tagKey)
  const cond =
    type === 'BOOL' && r.comparator === 'EQ'
      ? r.threshold === 1 || r.threshold === 1.0
        ? '= true'
        : '= false'
      : `${comparatorLabel(r.comparator)} ${r.threshold}`
  const modeShort =
    r.triggerMode === 'RISING' ? '上升沿' : r.triggerMode === 'FALLING' ? '下降沿' : '持续'
  const cycleSec =
    r.cycleMs != null && r.cycleMs > 0 ? `${(r.cycleMs / 1000).toFixed(r.cycleMs % 1000 ? 1 : 0)}s` : '2s'
  return `${cond} · ${modeShort} · ${cycleSec}`
}

function cycleMsFromForm() {
  const sec = Number(ruleForm.cycleSec)
  const ms = Math.round((Number.isFinite(sec) && sec > 0 ? sec : 2) * 1000)
  return Math.min(3_600_000, Math.max(500, ms))
}

function cleanMessage(msg: string | null | undefined) {
  if (!msg) return '—'
  return msg.replace(/\s*持续\s*$/, '').trim() || msg
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function formatEventValue(e: AlarmEvent) {
  const type = findTagType(e.deviceId, e.tagKey)
  const raw = e.valueText
  if (type === 'BOOL' && raw != null && raw !== '') {
    const n = Number(raw)
    if (raw === 'true' || n === 1) return 'true'
    if (raw === 'false' || n === 0) return 'false'
  }
  return raw ?? '—'
}

function toggleRuleForm() {
  showRule.value = !showRule.value
  if (showRule.value && !ruleForm.deviceId && devices.value[0]) {
    ruleForm.deviceId = devices.value[0].id
  }
}

async function reloadList() {
  error.value = ''
  loading.value = true
  try {
    const [devs, nextRules, nextEvents] = await Promise.all([
      listDevices(),
      listAlarmRules(),
      listAlarms(undefined, 200),
    ])
    devices.value = devs.map((d) => ({ ...d, id: normalizeId(d.id) }))
    rules.value = normalizeRules(nextRules)
    events.value = normalizeEvents(nextEvents)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

async function saveRule() {
  try {
    if (!ruleForm.deviceId) {
      error.value = '请选择设备'
      return
    }
    if (!ruleForm.tagKey) {
      error.value = '请选择点位'
      return
    }
    const cycleMs = cycleMsFromForm()
    const body = isBoolTag.value
      ? {
          deviceId: ruleForm.deviceId,
          tagKey: ruleForm.tagKey,
          ruleName: ruleForm.ruleName,
          comparator: 'EQ',
          threshold: ruleForm.boolValue === 'true' ? 1 : 0,
          triggerMode: ruleForm.triggerMode,
          cycleMs,
          enabled: true,
        }
      : {
          deviceId: ruleForm.deviceId,
          tagKey: ruleForm.tagKey,
          ruleName: ruleForm.ruleName,
          comparator: ruleForm.comparator,
          threshold: ruleForm.threshold,
          triggerMode: ruleForm.triggerMode,
          cycleMs,
          enabled: true,
        }
    await createAlarmRule(body)
    showRule.value = false
    ruleForm.ruleName = ''
    await reloadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function withAction(fn: () => Promise<void>) {
  if (actionBusy.value) return
  actionBusy.value = true
  markInteract()
  error.value = ''
  try {
    await fn()
    await reloadList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    actionBusy.value = false
    markInteract()
  }
}

async function removeRule(id: string) {
  if (!confirm('删除该规则？关联事件将一并清除。')) return
  await withAction(() => deleteAlarmRule(normalizeId(id)))
}

async function ack(id: string) {
  await withAction(() => ackAlarm(normalizeId(id)))
}

async function removeEvent(id: string) {
  await withAction(() => deleteAlarm(normalizeId(id)))
}

async function clearOrphans() {
  if (!confirm('清除所有「规则已删除」的孤儿事件？')) return
  await withAction(() => clearOrphanAlarms().then(() => undefined))
}

async function clearAcked() {
  if (!confirm('清除所有已确认事件？')) return
  await withAction(() => clearAlarms(true).then(() => undefined))
}

async function clearAll() {
  if (!confirm('清空全部事件（含未确认）？此操作不可恢复。')) return
  await withAction(() => clearAlarms().then(() => undefined))
}

async function onExport() {
  try {
    await downloadExport('alarms.csv')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

let pollTimer: ReturnType<typeof setInterval> | null = null

async function silentReload() {
  if (loading.value || actionBusy.value || document.hidden) return
  if (Date.now() < interactUntil) return
  try {
    const [devs, nextRules, nextEvents] = await Promise.all([
      listDevices(),
      listAlarmRules(),
      listAlarms(undefined, 200),
    ])
    // 二次检查：请求期间用户可能已按下按钮
    if (loading.value || actionBusy.value || Date.now() < interactUntil) return
    const normRules = normalizeRules(nextRules)
    const normEvents = normalizeEvents(nextEvents)
    devices.value = devs.map((d) => ({ ...d, id: normalizeId(d.id) }))
    if (rulesFingerprint(normRules) !== rulesFingerprint(rules.value)) {
      rules.value = normRules
    }
    if (eventsFingerprint(normEvents) !== eventsFingerprint(events.value)) {
      events.value = normEvents
    }
  } catch {
    // 静默轮询失败不打断操作
  }
}

onMounted(() => {
  reloadList()
  // 5s 足够；过密整表替换会吞掉 click（点不动）
  pollTimer = setInterval(silentReload, 5000)
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped lang="scss">
.plc-alarms {
  min-height: 0;
}

.plc-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.65rem;
  margin-bottom: 1rem;
  padding: 0.9rem;
  border: 1px solid rgba(110, 200, 232, 0.2);
  border-radius: 0.65rem;
  background: rgba(0, 0, 0, 0.22);

  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.72rem;
    color: #94a3b8;
  }

  input,
  select {
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #e2e8f0;
    padding: 0.4rem 0.5rem;
  }

  &__actions {
    display: flex;
    align-items: flex-end;
  }

  &__hint {
    grid-column: 1 / -1;
    margin: 0;
    font-size: 0.72rem;
    color: #64748b;
  }
}

.plc-panel {
  margin-bottom: 1rem;
  border: 1px solid rgba(110, 200, 232, 0.16);
  border-radius: 0.65rem;
  background: rgba(0, 0, 0, 0.22);
  overflow: hidden;

  &__head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.7rem 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  &__actions {
    margin-left: auto;
    display: flex;
    gap: 0.75rem;
  }

  &--rules {
    display: flex;
    flex-direction: column;
  }
}

.plc-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(8, 18, 32, 0.35);

  &__q {
    flex: 1 1 10rem;
    min-width: 8rem;
  }

  input,
  select {
    border-radius: 0.35rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(0, 0, 0, 0.35);
    color: #e2e8f0;
    padding: 0.35rem 0.5rem;
    font-size: 0.75rem;
  }

  select {
    max-width: 9.5rem;
  }
}

.evt-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  white-space: nowrap;
}

.plc-h {
  margin: 0;
  font-size: 0.85rem;
  color: #cbd5e1;
  font-weight: 500;
}

.plc-count {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  color: #64748b;
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 999px;
  padding: 0.05rem 0.45rem;
}

.plc-list {
  list-style: none;
  margin: 0;
  padding: 0;

  &--scroll {
    max-height: 16rem;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding: 0.7rem 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 0.84rem;

    &:last-child {
      border-bottom: none;
    }
  }
}

.rule-main {
  min-width: 0;
}

.rule-name {
  margin: 0;
  color: #e2e8f0;
}

.rule-meta {
  margin: 0.2rem 0 0;
  font-size: 0.72rem;
  color: #64748b;
}

.plc-table-wrap {
  overflow: auto;
}

.plc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;

  th,
  td {
    padding: 0.65rem 0.9rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    text-align: left;
    vertical-align: top;
  }

  th {
    color: #64748b;
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    background: rgba(8, 18, 32, 0.85);
    position: sticky;
    top: 0;
  }

  tbody tr.is-open td {
    background: rgba(251, 113, 133, 0.04);
  }

  .val {
    color: #ecfeff;
    font-variant-numeric: tabular-nums;
  }

  .time {
    margin: 0;
    color: #cbd5e1;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .empty {
    text-align: center;
    padding: 1.2rem;
  }
}

.evt-msg {
  margin: 0;
  color: #e2e8f0;
}

.evt-sub {
  margin: 0.2rem 0 0;
  font-size: 0.68rem;
  color: #64748b;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.12rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  letter-spacing: 0.04em;

  &.is-open {
    color: #fda4af;
    background: rgba(244, 63, 94, 0.12);
    border: 1px solid rgba(244, 63, 94, 0.3);
  }

  &.is-acked {
    color: #6ee7b7;
    background: rgba(52, 211, 153, 0.1);
    border: 1px solid rgba(52, 211, 153, 0.28);
  }

  &.is-orphan {
    margin-left: 0.35rem;
    color: #fcd34d;
    background: rgba(245, 158, 11, 0.12);
    border: 1px solid rgba(245, 158, 11, 0.35);
  }
}

tbody tr.is-orphan td {
  opacity: 0.88;
}

.mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.75rem;
}

.muted {
  color: #64748b;
}

.link {
  border: none;
  background: none;
  color: #67e8f9;
  cursor: pointer;
  font-size: 0.78rem;
  position: relative;
  z-index: 2;
  padding: 0.15rem 0.25rem;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &.danger {
    color: #fca5a5;
  }
}

.plc-err {
  color: #fbbf24;
  margin-bottom: 0.75rem;
}

.plc-btn {
  border-radius: 0.4rem;
  border: 1px solid rgba(110, 200, 232, 0.4);
  background: rgba(110, 200, 232, 0.12);
  padding: 0.4rem 0.7rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  color: #ecfeff;
  cursor: pointer;
  margin-left: 0.35rem;

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  &--ghost {
    background: transparent;
    color: #94a3b8;
    border-color: rgba(255, 255, 255, 0.12);
  }
}
</style>
