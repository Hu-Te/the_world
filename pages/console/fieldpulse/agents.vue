<template>
  <PlcCenterShell title="Agent 舰队">
    <template #actions>
      <button type="button" class="plc-btn plc-btn--ghost" @click="reload">刷新</button>
      <button type="button" class="plc-btn" @click="openDl = true">下载 Agent</button>
    </template>

    <div class="agents">
      <header class="agents__bar">
        <div class="agents__stat">
          <span class="agents__stat-label">在线</span>
          <span class="agents__stat-value mono" :data-empty="!agents.length">{{ agents.length }}</span>
        </div>
        <p class="agents__blurb">
          现场代理不在网页创建：本机运行工具包出站连云后，在此刷新可见。部署 Token（
          <code>APP_API_TOKEN</code>
          ）由运维提供，本页不可查看或生成。细节可问深空精灵。
        </p>
      </header>

      <p v-if="error" class="agents__err">{{ error }}</p>

      <section v-if="agents.length" class="agents__fleet" aria-label="在线 Agent">
        <article v-for="a in agents" :key="a.agentId" class="agents__card">
          <div class="agents__card-main">
            <p class="agents__card-name">{{ a.displayName || a.agentId }}</p>
            <p class="agents__card-meta mono">
              <span>{{ a.agentId }}</span>
              <span v-if="a.remoteHost" class="agents__sep">·</span>
              <span v-if="a.remoteHost">{{ a.remoteHost }}</span>
            </p>
          </div>
          <span class="agents__badge">在线</span>
        </article>
      </section>

      <section v-else class="agents__empty" aria-label="空状态">
        <div class="agents__empty-panel">
          <p class="agents__empty-kicker mono">NO LINK</p>
          <h3 class="agents__empty-title">当前无在线 Agent</h3>
          <ol class="agents__empty-steps">
            <li>下载 Windows 工具包并解压</li>
            <li>
              在
              <code>agent.env</code>
              填写部署 Token，并设置唯一
              <code>FIELDPULSE_AGENT_ID</code>
            </li>
            <li>
              运行
              <code>start-agent.bat</code>
              至 connected OK
            </li>
            <li>回到本页点「刷新」</li>
          </ol>
          <div class="agents__empty-actions">
            <button type="button" class="plc-btn" @click="openDl = true">下载 Agent</button>
            <button type="button" class="plc-btn plc-btn--ghost" @click="reload">刷新列表</button>
          </div>
        </div>
      </section>
    </div>

    <FieldPulseAgentDownloadModal :open="openDl" @close="openDl = false" />
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import FieldPulseAgentDownloadModal from '~/components/fieldpulse/FieldPulseAgentDownloadModal.vue'
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
.agents {
  --line: rgba(148, 163, 184, 0.14);
  --panel: rgba(15, 23, 42, 0.55);
  --cyan: #22d3ee;
  --ink: #e2e8f0;
  --muted: #64748b;
  --soft: #94a3b8;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100%;
}

.agents__bar {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.85rem 1.25rem;
  align-items: center;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--line);
  border-radius: 0.55rem;
  background: var(--panel);
  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

.agents__stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 4.5rem;
  padding-right: 1rem;
  border-right: 1px solid var(--line);
  @media (max-width: 720px) {
    flex-direction: row;
    align-items: baseline;
    gap: 0.45rem;
    padding-right: 0;
    border-right: none;
  }
}

.agents__stat-label {
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
}

.agents__stat-value {
  font-size: 1.55rem;
  font-weight: 650;
  color: #6ee7b7;
  line-height: 1;
  &[data-empty='true'] {
    color: var(--muted);
  }
}

.agents__blurb {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.55;
  color: var(--soft);
  code {
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.74em;
    color: #a5f3fc;
  }
}

.agents__err {
  margin: 0;
  color: #fbbf24;
  font-size: 0.82rem;
}

.agents__fleet {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16.5rem, 1fr));
  gap: 0.65rem;
}

.agents__card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 0.95rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(52, 211, 153, 0.22);
  background: linear-gradient(160deg, rgba(6, 40, 32, 0.45), rgba(15, 23, 42, 0.55));
}

.agents__card-name {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ink);
}

.agents__card-meta {
  margin: 0.35rem 0 0;
  font-size: 0.72rem;
  color: var(--muted);
  word-break: break-all;
}

.agents__sep {
  margin: 0 0.2rem;
  opacity: 0.6;
}

.agents__badge {
  flex-shrink: 0;
  font-size: 0.68rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  letter-spacing: 0.06em;
  color: #bbf7d0;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  border: 1px solid rgba(52, 211, 153, 0.4);
  background: rgba(16, 185, 129, 0.12);
}

.agents__empty {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 18rem;
  padding: 0.5rem 0 1rem;
}

.agents__empty-panel {
  width: min(100%, 28rem);
  padding: 1.35rem 1.4rem 1.45rem;
  border-radius: 0.65rem;
  border: 1px solid rgba(34, 211, 238, 0.22);
  background:
    radial-gradient(80% 60% at 50% 0%, rgba(34, 211, 238, 0.1), transparent 70%),
    var(--panel);
  text-align: left;
}

.agents__empty-kicker {
  margin: 0 0 0.35rem;
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: var(--cyan);
}

.agents__empty-title {
  margin: 0 0 0.85rem;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink);
}

.agents__empty-steps {
  margin: 0 0 1.15rem;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.4rem;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--soft);
  code {
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.74em;
    color: #a5f3fc;
  }
}

.agents__empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
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
  margin-left: 0;
  &--ghost {
    background: transparent;
    color: #94a3b8;
    border-color: rgba(255, 255, 255, 0.12);
  }
}
</style>
