<template>
  <div class="game-page">
    <div ref="containerRef" class="game-view" />

    <aside class="hud">
      <header class="hud-top">
        <div class="hud-panel stats">
          <div class="avatar-ring">
            <span>{{ state.tier.slice(0, 2) }}</span>
          </div>
          <div class="stats-body">
            <p class="hud-title">操作员</p>
            <p class="realm">{{ state.tier }}</p>
            <div class="qi-bar">
              <i :style="{ width: `${(state.energy / state.maxEnergy) * 100}%` }" />
            </div>
            <p class="qi-text">{{ state.energy }} / {{ state.maxEnergy }} 能量</p>
          </div>
        </div>

        <div class="hud-panel quest">
          <p class="hud-title">主线 · 节点接入</p>
          <p class="quest-progress">{{ state.questProgress }} / {{ state.questTarget }}</p>
          <ul class="quest-list">
            <li
              v-for="node in state.nodes"
              :key="node.id"
              :class="{ done: node.visited, active: state.interactLabel === node.name && state.canInteract }"
            >
              <i>{{ node.visited ? '✓' : '○' }}</i>
              {{ node.name }}
            </li>
          </ul>
        </div>
      </header>

      <div class="minimap-wrap hud-panel">
        <p class="hud-title">区域图</p>
        <svg viewBox="-100 -100 200 200" class="minimap">
          <circle cx="0" cy="0" r="96" class="minimap-bg" />
          <circle
            v-for="node in state.nodes"
            :key="node.id"
            :cx="nodeX(node.id)"
            :cy="nodeY(node.id)"
            r="4"
            class="minimap-village"
            :class="{ done: node.visited, active: state.interactLabel === node.name && state.canInteract }"
          />
          <polygon
            :points="playerArrow"
            class="minimap-player"
          />
        </svg>
      </div>

      <Transition name="toast">
        <p v-if="state.message" class="toast">{{ state.message }}</p>
      </Transition>

      <div v-if="state.canInteract" class="interact-prompt">
        <kbd>E</kbd>
        <span>接入 {{ state.interactLabel }}</span>
      </div>
      <p v-else class="hint">{{ state.hint }}</p>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { mountGame, type GameHandle } from '@/three'
import { bindGameState } from '@/game/useGameState'
import { NODE_POIS } from '@/game/gameData'

const containerRef = ref<HTMLDivElement>()
let gameHandle: GameHandle | null = null
const { state, attach } = bindGameState(() => gameHandle)

const MAP_SCALE = 0.85

function nodeX(id: number) {
  const poi = NODE_POIS[id]
  return poi ? poi.x * MAP_SCALE : 0
}

function nodeY(id: number) {
  const poi = NODE_POIS[id]
  return poi ? poi.z * MAP_SCALE : 0
}

const playerArrow = computed(() => {
  const x = state.value.playerX * MAP_SCALE
  const y = state.value.playerZ * MAP_SCALE
  const yaw = state.value.cameraYaw
  const tipX = x + Math.sin(yaw) * 8
  const tipY = y + Math.cos(yaw) * 8
  const lx = x + Math.sin(yaw + 2.4) * 5
  const ly = y + Math.cos(yaw + 2.4) * 5
  const rx = x + Math.sin(yaw - 2.4) * 5
  const ry = y + Math.cos(yaw - 2.4) * 5
  return `${tipX},${tipY} ${lx},${ly} ${rx},${ry}`
})

onMounted(() => {
  if (containerRef.value) {
    gameHandle = mountGame(containerRef.value)
    attach()
  }
})

onUnmounted(() => {
  gameHandle?.dispose()
  gameHandle = null
})
</script>

<style scoped>
.game-page {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #0a1018;
}

.game-view {
  width: 100%;
  height: 100%;
}

.hud {
  position: fixed;
  inset: 0;
  z-index: 10;
  pointer-events: none;
  padding: 1rem;
}

.hud-top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.hud-panel {
  padding: 0.9rem 1rem;
  border-radius: 14px;
  background: rgba(6, 10, 18, 0.78);
  border: 1px solid rgba(201, 169, 98, 0.18);
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
}

.stats {
  display: flex;
  gap: 0.75rem;
  width: min(280px, 46vw);
}

.avatar-ring {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 0.875rem;
  font-weight: 700;
  color: #ffe4a8;
  background: radial-gradient(circle at 30% 30%, #5a7898, #243448);
  border: 2px solid rgba(201, 169, 98, 0.55);
  box-shadow: 0 0 16px rgba(201, 169, 98, 0.25);
}

.stats-body {
  flex: 1;
}

.hud-title {
  margin: 0 0 0.2rem;
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  color: rgba(201, 169, 98, 0.85);
}

.realm {
  margin: 0 0 0.45rem;
  font-size: 1rem;
  font-weight: 600;
  color: #f5f0e8;
}

.qi-bar {
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.qi-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4ecfb0, #c9a962, #ffe4a8);
  box-shadow: 0 0 10px rgba(78, 207, 176, 0.45);
  transition: width 0.35s ease;
}

.qi-text {
  margin: 0.35rem 0 0;
  font-size: 0.6875rem;
  color: rgba(245, 240, 232, 0.55);
}

.quest {
  width: min(220px, 40vw);
}

.quest-progress {
  margin: 0;
  font-size: 1.625rem;
  font-weight: 700;
  color: #e8c878;
}

.quest-list {
  margin: 0.55rem 0 0;
  padding: 0;
  list-style: none;
}

.quest-list li {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.22rem 0;
  font-size: 0.75rem;
  color: rgba(245, 240, 232, 0.55);
}

.quest-list li i {
  font-style: normal;
  width: 1rem;
  color: rgba(201, 169, 98, 0.6);
}

.quest-list li.done {
  color: rgba(120, 200, 160, 0.85);
}

.quest-list li.done i {
  color: #5ecfb0;
}

.quest-list li.active {
  color: #ffe4a8;
  text-shadow: 0 0 10px rgba(255, 228, 168, 0.35);
}

.minimap-wrap {
  position: absolute;
  right: 1rem;
  bottom: 4.5rem;
  width: 148px;
}

.minimap {
  width: 100%;
  height: auto;
  display: block;
}

.minimap-bg {
  fill: rgba(255, 255, 255, 0.03);
  stroke: rgba(201, 169, 98, 0.2);
  stroke-width: 1;
}

.minimap-village {
  fill: rgba(136, 221, 255, 0.75);
}

.minimap-village.done {
  fill: rgba(94, 207, 176, 0.85);
}

.minimap-village.active {
  fill: #ffe4a8;
}

.minimap-player {
  fill: rgba(245, 240, 232, 0.95);
}

.interact-prompt {
  position: absolute;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  background: rgba(20, 36, 32, 0.9);
  border: 1px solid rgba(120, 220, 200, 0.35);
  box-shadow: 0 0 24px rgba(78, 207, 176, 0.2);
}

.interact-prompt kbd {
  display: inline-grid;
  place-items: center;
  min-width: 1.75rem;
  height: 1.75rem;
  padding: 0 0.35rem;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: inherit;
  color: #031018;
  background: linear-gradient(180deg, #9ff5e8, #5ecfb0);
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.25);
}

.interact-prompt span {
  font-size: 0.875rem;
  color: #e8fff8;
}

.hint {
  position: absolute;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  margin: 0;
  font-size: 0.8125rem;
  color: rgba(245, 240, 232, 0.45);
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 4.75rem;
  transform: translateX(-50%);
  max-width: min(90vw, 440px);
  margin: 0;
  padding: 0.75rem 1.15rem;
  border-radius: 12px;
  text-align: center;
  font-size: 0.875rem;
  line-height: 1.55;
  color: #f5e6c0;
  background: rgba(24, 44, 38, 0.92);
  border: 1px solid rgba(120, 220, 200, 0.28);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

@media (max-width: 640px) {
  .hud-top {
    flex-direction: column;
  }

  .stats,
  .quest {
    width: 100%;
  }

  .minimap-wrap {
    width: 120px;
    bottom: 5rem;
  }
}
</style>
