<template>
  <div class="scada-runtime">
    <p v-if="writeMsg" class="scada-runtime__write" :class="{ err: writeErr }">{{ writeMsg }}</p>
    <div ref="viewportEl" class="scada-runtime__viewport">
      <div
        class="scada-runtime__stage"
        :style="{ width: stageW + 'px', height: stageH + 'px' }">
        <div class="scada-runtime__board" :style="boardStyle">
          <div class="scada-runtime__grid" aria-hidden="true" />
          <ScadaNode
            v-for="n in doc.nodes"
            :key="n.id"
            :node-data="n"
            :selected="false"
            :interactive="false"
            :runtime-write="true"
            :canvas-w="doc.width"
            :canvas-h="doc.height"
            :view-scale="viewScale"
            @write="onWrite" />
          <p v-if="!doc.nodes.length" class="scada-runtime__empty">暂无组态图元，请先在设计页添加</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ScadaNode from '~/components/console/fieldpulse/scada/ScadaNode.vue'
import { listDevices, writeDeviceTag, type PlcDevice } from '~/utils/console/fieldpulseApi'
import type { ScadaDocument } from '~/utils/console/scadaTypes'

const props = defineProps<{
  doc: ScadaDocument
}>()

const viewportEl = ref<HTMLElement | null>(null)
const viewScale = ref(1)
const VIEW_PAD = 8
const devices = ref<PlcDevice[]>([])
const writeMsg = ref('')
const writeErr = ref(false)
let writeBusy = false

const stageW = computed(() => Math.max(1, Math.round(props.doc.width * viewScale.value)))
const stageH = computed(() => Math.max(1, Math.round(props.doc.height * viewScale.value)))
const boardStyle = computed(() => ({
  width: `${props.doc.width}px`,
  height: `${props.doc.height}px`,
  transform: `scale(${viewScale.value})`,
}))

function measureFit() {
  const el = viewportEl.value
  if (!el) return
  const aw = Math.max(0, el.clientWidth - VIEW_PAD * 2)
  const ah = Math.max(0, el.clientHeight - VIEW_PAD * 2)
  if (aw < 48 || ah < 48) return
  const s = Math.min(aw / props.doc.width, ah / props.doc.height)
  viewScale.value = Math.max(0.12, Math.min(s, 3))
}

function resolveDeviceId(bindTag: string): string | null {
  const sep = bindTag.indexOf('::')
  const runtimeId = sep > 0 ? bindTag.slice(0, sep) : ''
  if (!runtimeId) return null
  const d = devices.value.find((x) => x.runtimeDeviceId === runtimeId)
  return d?.id != null ? String(d.id) : null
}

async function onWrite(payload: { bindTag: string; value: unknown }) {
  if (writeBusy) return
  const deviceId = resolveDeviceId(payload.bindTag)
  if (!deviceId) {
    writeErr.value = true
    writeMsg.value = '无法解析绑定设备，请确认台账 runtimeDeviceId 与会话'
    return
  }
  const sep = payload.bindTag.indexOf('::')
  const tagKey = sep > 0 ? payload.bindTag.slice(sep + 2) : payload.bindTag
  writeBusy = true
  writeErr.value = false
  writeMsg.value = '下发中…'
  try {
    await writeDeviceTag(deviceId, tagKey, payload.value)
    writeMsg.value = `已下发 ${tagKey}=${String(payload.value)}`
    window.setTimeout(() => {
      writeMsg.value = ''
    }, 2000)
  } catch (e) {
    writeErr.value = true
    writeMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    writeBusy = false
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  measureFit()
  try {
    devices.value = await listDevices()
  } catch {
    /* ignore */
  }
  if (viewportEl.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => measureFit())
    resizeObserver.observe(viewportEl.value)
  }
  window.addEventListener('resize', measureFit)
})

watch(
  () => [props.doc.width, props.doc.height, props.doc.nodes.length] as const,
  () => nextTick(() => measureFit()),
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measureFit)
})
</script>

<style scoped lang="scss">
.scada-runtime {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.scada-runtime__write {
  flex-shrink: 0;
  margin: 0;
  text-align: center;
  font-size: 0.72rem;
  color: #6ee7b7;

  &.err {
    color: #fca5a5;
  }
}

.scada-runtime__viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scada-runtime__stage {
  position: relative;
}

.scada-runtime__board {
  position: relative;
  transform-origin: 0 0;
  background: #0b1220;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.scada-runtime__grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(148, 163, 184, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
}

.scada-runtime__empty {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: #94a3b8;
  font-size: 0.85rem;
}
</style>
