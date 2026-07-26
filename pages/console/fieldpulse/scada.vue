<template>
  <PlcCenterShell title="组态大屏">
    <template #actions>
      <span class="ws-pill" :class="'is-' + live.wsStatus">WS {{ live.wsLabel }}</span>
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

defineOptions({ name: 'ConsoleFieldpulseScada' })
definePageMeta({
  layout: false,
  /** 切到监控/报警等再回来时保留编辑器实例，避免白屏重挂载 */
  keepalive: true,
})

const auth = useAuthStore()
const live = useLiveDataStore()
const scadaStore = useScadaDocStore()
const devices = ref<PlcDevice[]>([])
const error = ref('')
const saveTip = ref('')
const authReady = ref(false)
const editorRef = ref<{ flushPersist?: () => void; reloadFromCache?: () => void } | null>(null)
/** 本页是否已 retain，避免 hydrate 触发 watch 时双重 retain */
let retainedHere = false

const owner = computed(() => ({
  tenantId: auth.profile?.tenantId ?? 0,
  userId: auth.profile?.userId ?? 0,
}))

const sessionHint = computed(() => {
  if (!auth.isLoggedIn) return '未登录：禁止保存，避免写入共享缓存'
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

function flushEditor() {
  editorRef.value?.flushPersist?.()
}

function onPageHide() {
  // 关标签 / 刷新：keepalive 的 onDeactivated 不一定触发
  flushEditor()
}

function onSaved() {
  error.value = ''
  saveTip.value = `已保存并缓存（租户 ${owner.value.tenantId} / 用户 ${owner.value.userId}）`
  window.setTimeout(() => {
    saveTip.value = ''
  }, 1800)
}

function onRestored(count: number) {
  if (count <= 0) return
  saveTip.value = `已恢复组态缓存 · ${count} 个图元`
  window.setTimeout(() => {
    saveTip.value = ''
  }, 2200)
}

function onEditorError(message: string) {
  error.value = message
}

watch(
  () => [auth.profile?.tenantId ?? 0, auth.profile?.userId ?? 0] as const,
  async (cur, prev) => {
    if (!authReady.value) return
    if (!prev) return
    if (cur[0] === prev[0] && cur[1] === prev[1]) return
    // 切账号：先落盘旧稿，再清内存，避免串租户
    flushEditor()
    scadaStore.clearMemory()
    releaseIfHeld()
    live.resetForUserSwitch()
    retainOnce()
    await reload()
  },
)

onMounted(async () => {
  await auth.hydrate()
  authReady.value = true
  retainOnce()
  await reload()
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('beforeunload', onPageHide)
})

onActivated(async () => {
  if (!authReady.value) {
    await auth.hydrate()
    authReady.value = true
  }
  retainOnce()
  if (!devices.value.length) await reload()
  // 切回大屏：合并磁盘，修复「空稿误显 / 空 flush 后以为丢了」
  nextTick(() => editorRef.value?.reloadFromCache?.())
})

onDeactivated(() => {
  flushEditor()
  releaseIfHeld()
})

onBeforeUnmount(() => {
  flushEditor()
  releaseIfHeld()
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('beforeunload', onPageHide)
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
  color: #64748b;
  font-size: 0.85rem;
}

.scada-page__editor {
  flex: 1;
  min-height: 0;
}

.ws-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  font-size: 0.62rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #94a3b8;

  &.is-open {
    color: #6ee7b7;
    border-color: rgba(52, 211, 153, 0.4);
  }
  &.is-connecting,
  &.is-reconnecting {
    color: #fbbf24;
    border-color: rgba(251, 191, 36, 0.35);
  }
}
</style>
