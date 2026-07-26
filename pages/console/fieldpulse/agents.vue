<template>
  <PlcCenterShell title="Agent 舰队">
    <template #actions>
      <button type="button" class="plc-btn" @click="reload">刷新</button>
      <button type="button" class="plc-btn plc-btn--ghost" @click="openDl = true">下载 Agent</button>
    </template>
    <p class="plc-lead">
      现场 Agent 与工具舱共用同一通道（部署 Token）。平台会话可绑定 agentId 经内网代连 PLC。
    </p>
    <p v-if="error" class="plc-err">{{ error }}</p>
    <ul class="plc-list">
      <li v-for="a in agents" :key="a.agentId" class="plc-item">
        <div>
          <p class="name">{{ a.displayName || a.agentId }}</p>
          <p class="meta mono">{{ a.agentId }} · {{ a.remoteHost }}</p>
        </div>
        <span class="ok">在线</span>
      </li>
      <li v-if="!agents.length" class="muted">当前无在线 Agent</li>
    </ul>
    <FieldPulseAgentDownloadModal :open="openDl" @close="openDl = false" />
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import { listAgents, type FieldPulseAgent } from '~/utils/fieldpulse/api'

definePageMeta({ layout: false })

const agents = ref<FieldPulseAgent[]>([])
const error = ref('')
const openDl = ref(false)

async function reload() {
  error.value = ''
  try {
    agents.value = await listAgents()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(reload)
</script>

<style scoped lang="scss">
.plc-lead {
  color: #94a3b8;
  font-size: 0.88rem;
}
.plc-list {
  list-style: none;
  margin: 1rem 0 0;
  padding: 0;
}
.plc-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.name {
  margin: 0;
  font-weight: 600;
}
.meta {
  margin: 0.25rem 0 0;
  font-size: 0.75rem;
  color: #64748b;
}
.mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
}
.ok {
  color: #6ee7b7;
  font-size: 0.78rem;
}
.muted {
  color: #64748b;
}
.plc-err {
  color: #fbbf24;
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
  &--ghost {
    background: transparent;
    color: #94a3b8;
    border-color: rgba(255, 255, 255, 0.12);
  }
}
</style>
