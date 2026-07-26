<template>
  <PlcCenterShell title="运行看板">
    <template #actions>
      <button type="button" class="plc-btn" @click="reload">刷新</button>
    </template>

    <p v-if="error" class="plc-err">{{ error }}</p>

    <div v-else class="dash">
      <section class="dash__hero">
        <div>
          <p class="dash__eyebrow">STATUS · OVERVIEW</p>
          <h3 class="dash__hero-title">舱况一览</h3>
          <p class="dash__hero-lead">
            租户内设备、会话与报警的实时聚合。细粒度调试请用工具舱「工脉监听舱」。
          </p>
        </div>
        <NuxtLink class="dash__tool-link" to="/tools/fieldpulse">打开工脉监听舱 →</NuxtLink>
      </section>

      <div class="dash__kpi">
        <article
          v-for="(card, i) in cards"
          :key="card.label"
          class="dash__card"
          :style="{ '--i': i }">
          <p class="dash__label">{{ card.label }}</p>
          <p class="dash__value">{{ card.value }}</p>
          <div class="dash__bar" aria-hidden="true" />
        </article>
      </div>
    </div>
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import { fetchDashboard, type PlcDashboard } from '~/utils/console/fieldpulseApi'

definePageMeta({ layout: false })

const dash = ref<PlcDashboard | null>(null)
const error = ref('')

const cards = computed(() => {
  const d = dash.value
  if (!d) return []
  return [
    { label: '设备总数', value: d.deviceCount },
    { label: '已启用', value: d.enabledDeviceCount },
    { label: '活动会话', value: d.activeSessionCount },
    { label: '在线 Agent', value: d.onlineAgentCount },
    { label: '未确认报警', value: d.unackedAlarmCount },
    { label: '今日报警', value: d.todayAlarmCount },
  ]
})

async function reload() {
  error.value = ''
  try {
    dash.value = await fetchDashboard()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(reload)
</script>

<style scoped lang="scss">
.dash__hero {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.15rem;
  padding: 1.1rem 1.15rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(34, 211, 238, 0.28);
  background:
    radial-gradient(ellipse at 0% 0%, rgba(34, 211, 238, 0.12), transparent 55%),
    linear-gradient(165deg, rgba(8, 24, 34, 0.95), rgba(2, 8, 18, 0.98));
  box-shadow: 0 0 40px rgba(34, 211, 238, 0.06);
}

.dash__eyebrow {
  margin: 0 0 0.4rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  color: rgba(34, 211, 238, 0.8);
}

.dash__hero-title {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: #ecfeff;
}

.dash__hero-lead {
  margin: 0.45rem 0 0;
  max-width: 34rem;
  font-size: 0.84rem;
  line-height: 1.55;
  color: #94a3b8;
}

.dash__tool-link {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: #67e8f9;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
}

.dash__kpi {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 0.85rem;
}

.dash__card {
  position: relative;
  overflow: hidden;
  border-radius: 0.8rem;
  border: 1px solid rgba(34, 211, 238, 0.22);
  background: linear-gradient(165deg, rgba(10, 22, 36, 0.96), rgba(3, 8, 18, 0.99));
  padding: 1.05rem 1rem 1.15rem;
  animation: dash-in 0.45s ease both;
  animation-delay: calc(var(--i, 0) * 45ms);

  &:hover {
    border-color: rgba(34, 211, 238, 0.45);
    box-shadow: 0 0 28px rgba(34, 211, 238, 0.1);
  }
}

@keyframes dash-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dash__label {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: #64748b;
}

.dash__value {
  margin: 0.5rem 0 0;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 1.7rem;
  font-weight: 500;
  color: #ecfeff;
  letter-spacing: -0.02em;
}

.dash__bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.65), transparent);
  opacity: 0.7;
}
</style>
