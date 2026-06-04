<template>
  <div class="world-page">
    <router-link class="back-btn" to="/">← 返回</router-link>
    <div ref="containerRef" class="world-view" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { mountWorld, type WorldHandle } from '@/three'

const containerRef = ref<HTMLDivElement>()
let worldHandle: WorldHandle | null = null

onMounted(() => {
  if (containerRef.value) {
    worldHandle = mountWorld(containerRef.value, {
      interactive: true,
      autoRotate: false,
    })
  }
})

onUnmounted(() => {
  worldHandle?.dispose()
  worldHandle = null
})
</script>

<style scoped>
.world-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #0f141e;
}

.world-view {
  width: 100%;
  height: 100%;
}

.back-btn {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 10;
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  color: #f5f0e8;
  font-size: 0.8125rem;
  text-decoration: none;
}
</style>
