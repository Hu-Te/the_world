<template>
  <PlcCenterShell title="运行显示">
    <template #actions>
      <span class="ws-pill" :class="'is-' + live.wsStatus">WS {{ live.wsLabel }}</span>
      <NuxtLink class="plc-btn plc-btn--ghost" to="/console/fieldpulse/scada">返回设计</NuxtLink>
      <button type="button" class="plc-btn plc-btn--ghost" @click="openFullscreen">全屏</button>
    </template>

    <div ref="pageEl" class="scada-view">
      <div v-if="statusLine" class="scada-view__status">
        <span v-if="sessionHint" class="warn">{{ sessionHint }}</span>
        <span v-if="error || live.lastError" class="err">{{ error || live.lastError }}</span>
        <span v-if="docTip" class="ok">{{ docTip }}</span>
      </div>

      <ScadaRuntimeBoard v-if="authReady && canPersist" class="scada-view__board" :doc="doc" />
      <p v-else-if="!authReady" class="scada-view__boot">正在恢复登录态…</p>
      <p v-else class="scada-view__boot">请登录后查看运行画面</p>
    </div>
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import ScadaRuntimeBoard from '~/components/console/fieldpulse/scada/ScadaRuntimeBoard.vue'
import { useLiveDataStore } from '~/stores/liveData'
import { useScadaDocStore } from '~/stores/scadaDoc'
import {
  createEmptyScadaDoc,
  isValidScadaOwner,
  type ScadaDocument,
} from '~/utils/console/scadaTypes'

defineOptions({ name: 'ConsoleFieldpulseScadaView' })
definePageMeta({
  layout: false,
  keepalive: true,
})

const auth = useAuthStore()
const live = useLiveDataStore()
const scadaStore = useScadaDocStore()
const route = useRoute()

const authReady = ref(false)
const error = ref('')
const docTip = ref('')
const pageEl = ref<HTMLElement | null>(null)
const doc = ref<ScadaDocument>(createEmptyScadaDoc('产线概览'))
let retainedHere = false
let unsubPeer: (() => void) | null = null

function applySharedQuery() {
  const q = route.query.sharedId
  const id = Array.isArray(q) ? q[0] : q
  scadaStore.setSharedContext(id || null)
}

const owner = computed(() => ({
  tenantId: auth.profile?.tenantId ?? 0,
  ownerUserId: auth.profile?.userId ?? 0,
}))

const canPersist = computed(() => isValidScadaOwner(owner.value))

const sessionHint = computed(() => {
  if (!auth.isLoggedIn) return '未登录：无法从数据库加载组态'
  if (scadaStore.sharedDocumentId != null) {
    return `协同组态 #${scadaStore.sharedDocumentId}`
  }
  if (!doc.value.nodes.length) return '组态为空：请先在「组态设计」添加图元并保存'
  return ''
})

const statusLine = computed(
  () => Boolean(sessionHint.value || error.value || live.lastError || docTip.value),
)

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

async function reloadDoc() {
  if (!canPersist.value) {
    doc.value = createEmptyScadaDoc('产线概览')
    return
  }
  try {
    const loaded = await scadaStore.load(owner.value)
    doc.value = loaded
    if (loaded.nodes.length > 0) {
      docTip.value = `运行中 · ${loaded.nodes.length} 个图元 · ${loaded.name || '未命名'}`
      window.setTimeout(() => {
        docTip.value = ''
      }, 2000)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

function bindPeer() {
  unsubPeer?.()
  unsubPeer = scadaStore.subscribePeerReload(owner.value, () => {
    void reloadDoc()
  })
}

function openFullscreen() {
  const el = pageEl.value
  if (!el) return
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else {
    void el.requestFullscreen?.()
  }
}

watch(
  () => [owner.value.tenantId, owner.value.ownerUserId] as const,
  () => {
    if (!authReady.value) return
    bindPeer()
    void reloadDoc()
  },
)

onMounted(async () => {
  applySharedQuery()
  await auth.hydrate()
  authReady.value = true
  retainOnce()
  await reloadDoc()
  bindPeer()
  window.addEventListener('focus', reloadDoc)
})

onActivated(async () => {
  applySharedQuery()
  if (!authReady.value) {
    await auth.hydrate()
    authReady.value = true
  }
  retainOnce()
  bindPeer()
  await reloadDoc()
})

watch(
  () => route.query.sharedId,
  async () => {
    applySharedQuery()
    await reloadDoc()
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
  window.removeEventListener('focus', reloadDoc)
})
</script>

<style scoped lang="scss">
.scada-view {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  height: 100%;
  min-height: 0;
  width: 100%;
  flex: 1;
  overflow: hidden;
}

.scada-view__status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem 0.65rem;
  flex-shrink: 0;
  font-size: 0.7rem;
  text-align: center;

  .warn {
    color: #fbbf24;
  }
  .err {
    color: #fca5a5;
  }
  .ok {
    color: #6ee7b7;
  }
}

.scada-view__boot {
  margin: 2rem auto;
  color: #94a3b8;
  font-size: 0.85rem;
}

.scada-view__board {
  flex: 1;
  min-height: 0;
}
</style>
