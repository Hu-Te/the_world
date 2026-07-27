<template>
  <section class="fp-panel fp-panel--conn">
    <button type="button" class="fp-panel__row fp-panel__toggle" @click="open = !open">
      <h2 class="fp-panel__title">
        连接
        <span class="fp-panel__meta">{{ protocol }} · {{ agentId || '直连' }}</span>
      </h2>
      <span class="fp-muted">{{ open ? '收起' : '展开' }}</span>
    </button>

    <div v-show="open" class="fp-panel__body">
      <div class="fp-grid fp-grid--conn">
        <label class="fp-field">
          <span>协议</span>
          <select v-model="protocol" @change="emit('protocol-change')">
            <option value="S7">S7</option>
            <option value="MODBUS">MODBUS</option>
            <option value="CUSTOM_HEX">CUSTOM_HEX</option>
          </select>
        </label>
        <label v-if="protocol !== 'CUSTOM_HEX'" class="fp-field">
          <span>轮询 ms</span>
          <input v-model.number="pollMs" type="number" min="50" />
        </label>

        <label v-if="protocol === 'S7'" class="fp-field fp-field--wide">
          <span>现场代理</span>
          <div class="fp-inline">
            <select v-model="agentId">
              <option value="">直连（仅同网）</option>
              <option
                v-if="agentId && !agents.some((a) => a.agentId === agentId)"
                :value="agentId">
                {{ agentId }}（离线）
              </option>
              <option v-for="a in agents" :key="a.agentId" :value="a.agentId">
                {{ a.displayName || a.agentId }}
              </option>
            </select>
            <button
              type="button"
              class="fp-btn fp-btn--ghost fp-btn--sm"
              :disabled="busy"
              title="刷新在线代理"
              @click="emit('refresh-agents')">
              刷新
            </button>
            <button
              type="button"
              class="fp-btn fp-btn--ghost fp-btn--sm"
              title="下载现场工具包"
              @click="emit('download-agent')">
              下载
            </button>
          </div>
        </label>

        <label v-if="protocol !== 'CUSTOM_HEX'" class="fp-field fp-field--wide">
          <span>PLC IP</span>
          <input v-model.trim="ip" placeholder="192.168.0.1" />
        </label>

        <label class="fp-field">
          <span>{{ protocol === 'CUSTOM_HEX' ? '监听端口' : '端口' }}</span>
          <input
            v-model.number="port"
            type="number"
            min="0"
            :placeholder="String(defaultPort)" />
        </label>
        <label v-if="protocol === 'S7'" class="fp-field">
          <span>Rack / Slot</span>
          <div class="fp-inline fp-inline--pair">
            <input v-model.number="rack" type="number" min="0" title="Rack" />
            <span class="fp-sep">/</span>
            <input v-model.number="slot" type="number" min="0" title="Slot" />
          </div>
        </label>
        <label v-if="protocol === 'MODBUS'" class="fp-field">
          <span>UnitId</span>
          <input v-model.number="unitId" type="number" min="1" />
        </label>
      </div>
      <p class="fp-hint">{{ previewDeviceId }}</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { FieldPulseAgent, ProtocolType } from '~/utils/fieldpulse/api'

defineProps<{
  agents: FieldPulseAgent[]
  busy: boolean
  defaultPort: number
  previewDeviceId: string
}>()

const emit = defineEmits<{
  'protocol-change': []
  'refresh-agents': []
  'download-agent': []
}>()

const open = defineModel<boolean>('open', { required: true })
const protocol = defineModel<ProtocolType>('protocol', { required: true })
const pollMs = defineModel<number>('pollMs', { required: true })
const agentId = defineModel<string>('agentId', { required: true })
const ip = defineModel<string>('ip', { required: true })
const port = defineModel<number>('port', { required: true })
const rack = defineModel<number>('rack', { required: true })
const slot = defineModel<number>('slot', { required: true })
const unitId = defineModel<number>('unitId', { required: true })
</script>

<style scoped lang="scss">
/* 子组件 scoped 无法继承父级 FieldPulseCabin 同名类，样式自包含 */
.fp-panel {
  @apply shrink-0 rounded-lg border border-cyan-400/25 bg-slate-950/60 p-2;
}
.fp-panel__row {
  @apply mb-0 flex items-center justify-between gap-2;
}
.fp-panel__toggle {
  @apply mb-0 w-full cursor-pointer border-0 bg-transparent p-0 text-left;
}
.fp-panel__title {
  @apply m-0 flex min-w-0 items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-cyan-300/85;
}
.fp-panel__meta {
  @apply rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.62rem] normal-case tracking-normal text-slate-400;
}
.fp-panel__body {
  @apply mt-1.5;
}
.fp-muted {
  @apply text-slate-500;
}
.fp-grid--conn {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem 0.65rem;
}
.fp-field {
  @apply flex flex-col gap-0.5 text-[0.62rem] text-slate-400;
  input,
  select {
    @apply w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[0.78rem] text-cyan-50 outline-none;
  }
}
.fp-field--wide {
  grid-column: 1 / -1;
}
.fp-inline {
  @apply flex items-center gap-1;
  select,
  input {
    @apply min-w-0 flex-1;
  }
}
.fp-inline--pair {
  input {
    @apply text-center;
  }
}
.fp-sep {
  @apply shrink-0 text-slate-500;
}
.fp-btn {
  @apply rounded border border-cyan-400/40 bg-cyan-500/15 px-2.5 py-1 text-[0.8rem] text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-40;
}
.fp-btn--ghost {
  @apply border-white/15 bg-white/5 hover:bg-white/10;
}
.fp-btn--sm {
  @apply px-2 py-0.5 text-[0.72rem];
}
.fp-hint {
  @apply mt-1.5 truncate font-mono text-[0.62rem] leading-snug text-cyan-200/60;
}
</style>
