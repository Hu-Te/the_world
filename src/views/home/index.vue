<template>
  <div ref="containerRef" class="world-view" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { mountCultivationWorld, type WorldHandle } from '@/three'

const containerRef = ref<HTMLDivElement>()
let worldHandle: WorldHandle | null = null

onMounted(() => {
  if (containerRef.value) {
    worldHandle = mountCultivationWorld(containerRef.value)
  }
})

onUnmounted(() => {
  worldHandle?.dispose()
  worldHandle = null
})
</script>

<style scoped>
.world-view {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #87ceeb;
}
</style>
