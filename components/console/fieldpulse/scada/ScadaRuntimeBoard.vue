<template>
  <div class="scada-runtime">
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
            :canvas-w="doc.width"
            :canvas-h="doc.height"
            :view-scale="viewScale" />
          <p v-if="!doc.nodes.length" class="scada-runtime__empty">暂无组态图元，请先在设计页添加</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ScadaNode from '~/components/console/fieldpulse/scada/ScadaNode.vue'
import type { ScadaDocument } from '~/utils/console/scadaTypes'

const props = defineProps<{
  doc: ScadaDocument
}>()

const viewportEl = ref<HTMLElement | null>(null)
const viewScale = ref(1)
const VIEW_PAD = 8

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

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  measureFit()
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
  overflow: hidden;
}

.scada-runtime__viewport {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: radial-gradient(120% 80% at 50% 0%, #0a1620 0%, #020617 70%);
}

.scada-runtime__stage {
  position: relative;
  flex-shrink: 0;
}

.scada-runtime__board {
  position: relative;
  transform-origin: 0 0;
  background: #070f18;
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.12);
  overflow: hidden;
}

.scada-runtime__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0.22;
  background-image:
    linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
  background-size: 40px 40px;
}

.scada-runtime__empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  color: #64748b;
  font-size: 0.9rem;
  pointer-events: none;
}
</style>
