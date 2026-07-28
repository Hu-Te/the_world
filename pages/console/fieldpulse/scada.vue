<template>
  <PlcCenterShell title="组态设计">
    <template #actions>
      <span class="ws-pill" :class="'is-' + live.wsStatus">WS {{ live.wsLabel }}</span>
      <NuxtLink
        class="plc-btn plc-btn--ghost"
        :to="
          scadaStore.sharedDocumentId != null
            ? `/console/fieldpulse/scada-view?sharedId=${scadaStore.sharedDocumentId}`
            : '/console/fieldpulse/scada-view'
        ">
        运行显示
      </NuxtLink>
      <button
        type="button"
        class="plc-btn"
        :disabled="sessionBusy || !canStartSessions"
        @click="startBoundSessions">
        {{ sessionBusy ? '处理中…' : '启动关联会话' }}
      </button>
      <button
        type="button"
        class="plc-btn plc-btn--ghost"
        :disabled="sessionBusy || activeSessionCount === 0"
        @click="stopBoundSessions">
        停止会话
      </button>
      <button type="button" class="plc-btn plc-btn--ghost" @click="reload">刷新台账</button>
    </template>

    <div class="scada-page">
      <div v-if="collabBanner" class="scada-page__collab">
        {{ collabBanner }}
        <NuxtLink class="scada-page__collab-link" to="/console/fieldpulse/collab">返回工作协同</NuxtLink>
      </div>
      <div v-if="statusLine" class="scada-page__status">
        <span v-if="sessionHint" class="scada-page__warn">{{ sessionHint }}</span>
        <span v-if="error || live.lastError" class="scada-page__err">{{
          error || live.lastError
        }}</span>
        <span v-if="saveTip" class="scada-page__ok">{{ saveTip }}</span>
      </div>

      <ScadaEditor
        v-if="authReady"
        ref="editorRef"
        class="scada-page__editor"
        :devices="devices"
        :tenant-id="owner.tenantId"
        :user-id="owner.userId"
        @saved="onSaved"
        @restored="onRestored"
        @error="onEditorError" />
      <p v-else class="scada-page__boot">正在恢复登录态…</p>
    </div>
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import ScadaEditor from '~/components/console/fieldpulse/scada/ScadaEditor.vue'
import { useLiveDataStore } from '~/stores/liveData'
import { useScadaDocStore } from '~/stores/scadaDoc'
import { listDevices, startDeviceSession, stopDeviceSession, type PlcDevice } from '~/utils/console/fieldpulseApi'
import { purgeLegacyScadaLocalCache } from '~/utils/console/scadaTypes'

defineOptions({ name: 'ConsoleFieldpulseScada' })
definePageMeta({
  layout: false,
  keepalive: true,
})

const auth = useAuthStore()
const live = useLiveDataStore()
const scadaStore = useScadaDocStore()
const route = useRoute()
const devices = ref<PlcDevice[]>([])
const error = ref('')
const saveTip = ref('')
const authReady = ref(false)
const sessionBusy = ref(false)
const editorRef = ref<{ saveDoc?: () => void; reloadIfClean?: () => void } | null>(null)
let retainedHere = false
let unsubPeer: (() => void) | null = null
let legacyPurged = false

function applySharedQuery() {
  const q = route.query.sharedId
  const id = Array.isArray(q) ? q[0] : q
  scadaStore.setSharedContext(id || null)
}

function purgeLegacyOnce() {
  if (legacyPurged) return
  legacyPurged = true
  purgeLegacyScadaLocalCache()
}

const owner = computed(() => ({
  tenantId: auth.profile?.tenantId ?? 0,
  userId: auth.profile?.userId ?? 0,
}))

/** 本系统或协同 WRITE 可启停 */
function canControlDevice(d: PlcDevice) {
  if (d.shared && d.sharedPermission !== 'WRITE') return false
  return true
}

const controllableDevices = computed(() => devices.value.filter(canControlDevice))
const activeSessionCount = computed(
  () => controllableDevices.value.filter((d) => d.sessionActive).length,
)
const canStartSessions = computed(() =>
  controllableDevices.value.some((d) => d.enabled && !d.sessionActive),
)

const sessionHint = computed(() => {
  if (!auth.isLoggedIn) return '未登录：禁止保存（组态仅写入数据库）'
  if (scadaStore.sharedDocumentId != null && !scadaStore.canWriteShared) {
    return '协同只读组态：可查看画面与绑定点位，不可保存；会话须由属主或 WRITE 成员启动'
  }
  if (scadaStore.sharedDocumentId != null) {
    return `协同可写组态 #${scadaStore.sharedDocumentId}：保存将写回属主系统`
  }
  if (!devices.value.length) {
    return '暂无设备台账。协同成员请从「工作协同」打开已挂载组态，并确保属主已挂载设备且已启动会话'
  }
  if (activeSessionCount.value === 0) {
    return '尚未启动会话，绑定点位不会有实时值 — 可点「启动关联会话」'
  }
  return `已启动 ${activeSessionCount.value} 台设备会话`
})

async function startBoundSessions() {
  sessionBusy.value = true
  error.value = ''
  try {
    const targets = controllableDevices.value.filter((d) => d.enabled && !d.sessionActive)
    if (!targets.length) {
      error.value = '没有可启动的设备（需启用且有写权限）'
      return
    }
    const errors: string[] = []
    for (const d of targets) {
      try {
        await startDeviceSession(d.id)
      } catch (e) {
        errors.push(`${d.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    await reload()
    if (errors.length) error.value = errors.join('；')
    else saveTip.value = `已启动 ${targets.length} 台会话`
  } finally {
    sessionBusy.value = false
  }
}

async function stopBoundSessions() {
  sessionBusy.value = true
  error.value = ''
  try {
    const targets = controllableDevices.value.filter((d) => d.sessionActive)
    for (const d of targets) {
      try {
        await stopDeviceSession(d.id)
      } catch (e) {
        error.value = e instanceof Error ? e.message : String(e)
      }
    }
    await reload()
  } finally {
    sessionBusy.value = false
  }
}
const collabBanner = computed(() => {
  if (scadaStore.sharedDocumentId == null) return ''
  const perm = scadaStore.sharedPermission === 'WRITE' ? '可写' : '只读'
  const name = scadaStore.doc?.name || '组态画面'
  return `协同挂载组态「${name}」· ${perm} · 文档 #${scadaStore.sharedDocumentId}`
})

const statusLine = computed(
  () => Boolean(sessionHint.value || error.value || live.lastError || saveTip.value),
)

async function reload() {
  error.value = ''
  live.clearError()
  try {
    devices.value = await listDevices()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function retainOnce() {
  if (retainedHere) return
  live.retain()
  retainedHere = true
}

function releaseIfHeld() {
  if (!retainedHere) return
  live.release()
  retainedHere = false
}

function bindPeer() {
  unsubPeer?.()
  unsubPeer = scadaStore.subscribePeerReload(
    { tenantId: owner.value.tenantId, ownerUserId: owner.value.userId },
    () => nextTick(() => editorRef.value?.reloadIfClean?.()),
  )
}

function onSaved(doc: { nodes?: unknown[] }) {
  error.value = ''
  const n = doc.nodes?.length ?? 0
  saveTip.value =
    n === 0
      ? '已清空并写入数据库'
      : `已保存到数据库 · ${n} 个图元（租户 ${owner.value.tenantId} / 用户 ${owner.value.userId}）`
  window.setTimeout(() => {
    saveTip.value = ''
  }, 1800)
}

function onRestored(count: number) {
  if (count <= 0) return
  saveTip.value = `已从数据库加载 · ${count} 个图元`
  window.setTimeout(() => {
    saveTip.value = ''
  }, 2200)
}

function onEditorError(message: string) {
  error.value = message
}

function onFocus() {
  nextTick(() => editorRef.value?.reloadIfClean?.())
}

watch(
  () => [auth.profile?.tenantId ?? 0, auth.profile?.userId ?? 0] as const,
  async (cur, prev) => {
    if (!authReady.value) return
    if (!prev) return
    if (cur[0] === prev[0] && cur[1] === prev[1]) return
    scadaStore.clearMemory()
    releaseIfHeld()
    live.resetForUserSwitch()
    retainOnce()
    bindPeer()
    await reload()
  },
)

onMounted(async () => {
  purgeLegacyOnce()
  applySharedQuery()
  await auth.hydrate()
  authReady.value = true
  retainOnce()
  await reload()
  bindPeer()
  window.addEventListener('focus', onFocus)
})

onActivated(async () => {
  applySharedQuery()
  if (!authReady.value) {
    await auth.hydrate()
    authReady.value = true
  }
  retainOnce()
  if (!devices.value.length) await reload()
  bindPeer()
  nextTick(() => editorRef.value?.reloadIfClean?.())
})

watch(
  () => route.query.sharedId,
  () => {
    applySharedQuery()
    nextTick(() => editorRef.value?.reloadIfClean?.())
  },
)

onDeactivated(() => {
  releaseIfHeld()
  unsubPeer?.()
  unsubPeer = null
})

onBeforeUnmount(() => {
  releaseIfHeld()
  unsubPeer?.()
  unsubPeer = null
  window.removeEventListener('focus', onFocus)
})
</script>

<style scoped lang="scss">
.scada-page {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  height: 100%;
  min-height: 0;
  width: 100%;
  flex: 1;
  overflow: hidden;
}

.scada-page__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem 0.65rem;
  flex-shrink: 0;
  width: 100%;
  text-align: center;
  font-size: 0.7rem;
}

.scada-page__collab {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-shrink: 0;
  padding: 0.45rem 0.7rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(110, 196, 184, 0.35);
  background: rgba(14, 116, 144, 0.2);
  color: #a5f3fc;
  font-size: 0.78rem;
}

.scada-page__collab-link {
  color: #ecfeff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.scada-page__warn {
  color: #fbbf24;
}

.scada-page__err {
  color: #fca5a5;
}

.scada-page__ok {
  color: #6ee7b7;
}

.scada-page__boot {
  margin: 2rem auto;
  color: #94a3b8;
  font-size: 0.85rem;
}

.scada-page__editor {
  flex: 1;
  min-height: 0;
}
</style>
