<template>
  <div class="plc-cabin">
    <div class="plc-cabin__atmosphere" aria-hidden="true">
      <div class="plc-cabin__grid" />
      <div class="plc-cabin__glow plc-cabin__glow--tl" />
      <div class="plc-cabin__glow plc-cabin__glow--br" />
      <div class="plc-cabin__scan" />
    </div>

    <div class="plc-cabin__frame">
      <aside class="plc-cabin__rail">
        <div class="plc-cabin__brand">
          <div class="plc-cabin__brand-row">
            <span class="plc-cabin__code">IND · S7</span>
            <span class="plc-cabin__badge">平台舱</span>
          </div>
          <h1 class="plc-cabin__product">PLC 数据管控中心</h1>
          <p class="plc-cabin__tagline">多设备编排 · 报警 · 曲线 · 同场 Agent</p>
        </div>

        <nav class="plc-cabin__nav" aria-label="子系统导航">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="plc-cabin__nav-item"
            active-class="is-active">
            <span class="plc-cabin__nav-code">{{ item.code }}</span>
            <span class="plc-cabin__nav-label">{{ item.label }}</span>
            <span class="plc-cabin__nav-pulse" aria-hidden="true" />
          </NuxtLink>
        </nav>

        <div class="plc-cabin__rail-foot">
          <p class="plc-cabin__user">
            <span class="plc-cabin__user-dot" />
            {{ auth.displayLabel || '已登录' }}
            <span v-if="auth.profile?.planCode" class="plc-cabin__plan">{{
              auth.profile.planCode
            }}</span>
          </p>
          <div class="plc-cabin__exits">
            <button type="button" class="plc-cabin__exit" @click="router.push('/console')">
              控制台
            </button>
            <button type="button" class="plc-cabin__exit" @click="router.push('/')">首页</button>
          </div>
        </div>
      </aside>

      <section class="plc-cabin__stage">
        <header class="plc-cabin__stage-head">
          <div class="plc-cabin__stage-titles">
            <p class="plc-cabin__stage-eyebrow">体验舱 · LIVE</p>
            <h2 class="plc-cabin__stage-title">{{ title }}</h2>
          </div>
          <div class="plc-cabin__stage-actions">
            <slot name="actions" />
          </div>
        </header>
        <div class="plc-cabin__viewport">
          <slot />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()

const auth = useAuthStore()
const router = useRouter()

const nav = [
  { code: '01', label: '看板', to: '/console/fieldpulse' },
  { code: '02', label: '设备台账', to: '/console/fieldpulse/devices' },
  { code: '03', label: '实时监控', to: '/console/fieldpulse/monitor' },
  { code: '04', label: '报警中心', to: '/console/fieldpulse/alarms' },
  { code: '05', label: '历史曲线', to: '/console/fieldpulse/trends' },
  { code: '06', label: '组态设计', to: '/console/fieldpulse/scada' },
  { code: '06b', label: '运行显示', to: '/console/fieldpulse/scada-view' },
  { code: '07', label: 'Agent 舰队', to: '/console/fieldpulse/agents' },
  { code: '08', label: '工作协同', to: '/console/fieldpulse/collab' },
]

onMounted(() => auth.hydrate())
</script>

<style scoped lang="scss">
.plc-cabin {
  --plc-cyan: #22d3ee;
  --plc-cyan-soft: rgba(34, 211, 238, 0.35);
  --plc-ink: #020617;
  position: fixed;
  inset: 0;
  z-index: 40;
  color: #e2e8f0;
  overflow: hidden;
  background: radial-gradient(120% 80% at 50% -10%, #0a1a22 0%, #020617 55%, #020617 100%);
}

.plc-cabin__atmosphere {
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.plc-cabin__grid {
  position: absolute;
  inset: 0;
  opacity: 0.11;
  background-image:
    linear-gradient(rgba(34, 211, 238, 0.22) 1px, transparent 1px),
    linear-gradient(90deg, rgba(56, 189, 248, 0.1) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(ellipse at 40% 20%, #000 20%, transparent 75%);
}

.plc-cabin__glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);

  &--tl {
    top: -12%;
    left: -8%;
    width: 42%;
    height: 36%;
    background: rgba(34, 211, 238, 0.14);
  }

  &--br {
    right: -10%;
    bottom: -18%;
    width: 48%;
    height: 42%;
    background: rgba(14, 116, 144, 0.16);
  }
}

.plc-cabin__scan {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(34, 211, 238, 0.03) 48%,
    transparent 52%,
    transparent 100%
  );
  background-size: 100% 220%;
  animation: plc-scan 9s linear infinite;
  opacity: 0.55;
}

@keyframes plc-scan {
  0% {
    background-position: 0 -40%;
  }
  100% {
    background-position: 0 140%;
  }
}

.plc-cabin__frame {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 15.5rem minmax(0, 1fr);
  width: min(96rem, calc(100% - 1.5rem));
  height: min(96dvh, calc(100% - 1.5rem));
  margin: 0.75rem auto;
  border: 1px solid rgba(34, 211, 238, 0.35);
  border-radius: clamp(0.65rem, 1.6vw, 1.05rem);
  background: linear-gradient(168deg, rgba(6, 20, 28, 0.98), rgba(2, 6, 23, 0.995));
  box-shadow:
    0 28px 80px rgba(0, 0, 0, 0.6),
    0 0 72px rgba(34, 211, 238, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  overflow: hidden;

  /* 组态设计/运行：铺满视口，避免左右留白 + 双层滚动 */
  &:has(.scada-page),
  &:has(.scada-view) {
    width: calc(100% - 1rem);
    height: calc(100dvh - 1rem);
    max-width: none;
    margin: 0.5rem auto;
  }
}

.plc-cabin__rail {
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(4, 16, 24, 0.92), rgba(2, 8, 16, 0.98));
  padding: 1.15rem 0.85rem 0.9rem;
}

.plc-cabin__brand {
  padding: 0 0.35rem 1rem;
  margin-bottom: 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.plc-cabin__brand-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  margin-bottom: 0.55rem;
}

.plc-cabin__code {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  color: rgba(34, 211, 238, 0.9);
}

.plc-cabin__badge {
  border-radius: 0.25rem;
  border: 1px solid rgba(34, 211, 238, 0.3);
  background: rgba(34, 211, 238, 0.1);
  padding: 0.12rem 0.4rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: rgba(165, 243, 252, 0.92);
}

.plc-cabin__product {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
  color: #ecfeff;
}

.plc-cabin__tagline {
  margin: 0.4rem 0 0;
  font-size: 0.7rem;
  line-height: 1.45;
  color: #64748b;
}

.plc-cabin__nav {
  display: flex;
  flex-direction: column;
  gap: 0.28rem;
  flex: 1;
  overflow: auto;
  padding-right: 0.15rem;
}

.plc-cabin__nav-item {
  position: relative;
  display: grid;
  grid-template-columns: 1.6rem 1fr auto;
  align-items: center;
  gap: 0.45rem;
  padding: 0.62rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  color: #94a3b8;
  text-decoration: none;
  font-size: 0.84rem;
  transition:
    background 0.18s,
    color 0.18s,
    border-color 0.18s,
    box-shadow 0.18s;

  &:hover {
    background: rgba(34, 211, 238, 0.07);
    color: #e2e8f0;
  }

  &.is-active {
    background: linear-gradient(90deg, rgba(34, 211, 238, 0.16), rgba(34, 211, 238, 0.05));
    border-color: rgba(34, 211, 238, 0.32);
    color: #ecfeff;
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.08);

    .plc-cabin__nav-pulse {
      opacity: 1;
      transform: scale(1);
    }
  }
}

.plc-cabin__nav-code {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: rgba(34, 211, 238, 0.85);
}

.plc-cabin__nav-label {
  letter-spacing: 0.02em;
}

.plc-cabin__nav-pulse {
  width: 0.35rem;
  height: 0.35rem;
  border-radius: 50%;
  background: var(--plc-cyan);
  box-shadow: 0 0 10px var(--plc-cyan);
  opacity: 0;
  transform: scale(0.4);
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.plc-cabin__rail-foot {
  margin-top: 0.75rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.plc-cabin__user {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.65rem;
  padding: 0 0.2rem;
  font-size: 0.72rem;
  color: #94a3b8;
}

.plc-cabin__user-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.7);
}

.plc-cabin__plan {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: rgba(34, 211, 238, 0.85);
}

.plc-cabin__exits {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
}

.plc-cabin__exit {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.4rem;
  background: rgba(255, 255, 255, 0.02);
  padding: 0.48rem 0.4rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: #64748b;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    background 0.15s;

  &:hover {
    color: #a5f3fc;
    border-color: rgba(34, 211, 238, 0.35);
    background: rgba(34, 211, 238, 0.06);
  }
}

.plc-cabin__stage {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background:
    radial-gradient(ellipse at 80% 0%, rgba(34, 211, 238, 0.06), transparent 45%),
    linear-gradient(180deg, rgba(4, 12, 20, 0.2), transparent 28%);
}

.plc-cabin__stage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-shrink: 0;
  padding: 1rem 1.35rem 0.9rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.plc-cabin__stage-eyebrow {
  margin: 0 0 0.35rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  color: rgba(34, 211, 238, 0.75);
}

.plc-cabin__stage-title {
  margin: 0;
  font-size: clamp(1.15rem, 2.2vw, 1.45rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f8fafc;
}

.plc-cabin__stage-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
}

.plc-cabin__viewport {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 1.1rem 1.35rem 1.5rem;

  /* 组态设计/运行：占满剩余高度，避免双层滚动 */
  &:has(.scada-page),
  &:has(.scada-view) {
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0.45rem 0.75rem 0.55rem;
  }

  &:has(.scada-page) > .scada-page,
  &:has(.scada-view) > .scada-view {
    flex: 1;
    min-height: 0;
  }
}

.plc-cabin__stage:has(.scada-page) .plc-cabin__stage-head,
.plc-cabin__stage:has(.scada-view) .plc-cabin__stage-head {
  padding: 0.55rem 0.9rem 0.45rem;
}

.plc-cabin__stage:has(.scada-page) .plc-cabin__stage-title,
.plc-cabin__stage:has(.scada-view) .plc-cabin__stage-title {
  font-size: 1.1rem;
}

/* 统一子页按钮 / 错误态（沉浸舱内） */
.plc-cabin__stage-actions :deep(.plc-btn),
.plc-cabin__viewport :deep(.plc-btn) {
  border-radius: 0.45rem;
  border: 1px solid rgba(34, 211, 238, 0.42);
  background: linear-gradient(180deg, rgba(34, 211, 238, 0.2), rgba(34, 211, 238, 0.08));
  padding: 0.48rem 0.85rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: #ecfeff;
  cursor: pointer;
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.08);
  transition:
    border-color 0.15s,
    background 0.15s,
    box-shadow 0.15s;

  &:hover {
    border-color: rgba(34, 211, 238, 0.65);
    box-shadow: 0 0 24px rgba(34, 211, 238, 0.16);
  }
}

.plc-cabin__stage-actions :deep(.plc-btn--ghost),
.plc-cabin__viewport :deep(.plc-btn--ghost) {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.12);
  color: #94a3b8;
  box-shadow: none;

  &:hover {
    color: #a5f3fc;
    border-color: rgba(34, 211, 238, 0.35);
  }
}

.plc-cabin__viewport :deep(.plc-err) {
  margin: 0 0 0.85rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.08);
  padding: 0.55rem 0.75rem;
  font-size: 0.84rem;
  color: #fde68a;
}

@media (max-width: 960px) {
  .plc-cabin__frame {
    grid-template-columns: 1fr;
    width: calc(100% - 0.75rem);
    height: calc(100% - 0.75rem);
    margin: 0.375rem;
  }

  .plc-cabin__rail {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    max-height: none;
  }

  .plc-cabin__nav {
    flex-direction: row;
    flex-wrap: wrap;
    max-height: none;
  }

  .plc-cabin__nav-item {
    grid-template-columns: auto auto;
  }

  .plc-cabin__nav-pulse {
    display: none;
  }
}
</style>
