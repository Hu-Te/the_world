<template>
  <PlcCenterShell title="组态设计">
    <template #actions>
      <span class="ws-pill" :class="'is-' + live.wsStatus">WS {{ live.wsLabel }}</span>
      <NuxtLink class="plc-btn plc-btn--ghost" to="/console/fieldpulse/scada-view">运行显示</NuxtLink>
      <button type="button" class="plc-btn plc-btn--ghost" @click="reload">刷新台账</button>
    </template>

    <div class="scada-page">
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
import { listDevices, type PlcDevice } from '~/utils/console/fieldpulseApi'
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

const sessionHint = computed(() => {
  if (!auth.isLoggedIn) return '未登录：禁止保存（组态仅写入数据库）'
  if (scadaStore.sharedDocumentId != null && !scadaStore.canWriteShared) {
    return '协同只读组态：可查看，不可保存'
  }
  if (scadaStore.sharedDocumentId != null) {
    return `协同组态 #${scadaStore.sharedDocumentId}（可写）`
  }
  if (!devices.value.length) return '暂无设备台账'
  const active = devices.value.filter((d) => d.sessionActive).length
  if (active === 0) return '尚未启动会话，绑定点位不会有实时值'
  return ''
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
