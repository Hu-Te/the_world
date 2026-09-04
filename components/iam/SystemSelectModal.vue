<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="iam-sys"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iam-sys-title"
      @click.self="emit('close')">
      <div class="iam-sys__panel" :data-count="available.length">
        <div class="iam-sys__glow" aria-hidden="true" />
        <div class="iam-sys__grid-lines" aria-hidden="true" />

        <header class="iam-sys__head">
          <p class="iam-sys__eyebrow">进阶版 · 系统管理平台</p>
          <h2 id="iam-sys-title" class="iam-sys__title">选择子系统</h2>
          <div class="iam-sys__meta">
            <span class="iam-sys__who">{{ auth.displayLabel || '已登录' }}</span>
            <span v-if="auth.profile?.planCode" class="iam-sys__plan">{{ auth.profile.planCode }}</span>
            <span class="iam-sys__dot" aria-hidden="true" />
            <span class="iam-sys__hint">与首页工具舱分离 · 仅已解锁模块</span>
          </div>
          <button type="button" class="iam-sys__x" aria-label="关闭" @click="emit('close')">✕</button>
        </header>

        <ul v-if="available.length" class="iam-sys__grid" role="list">
          <li
            v-for="(sys, index) in available"
            :key="sys.moduleCode"
            class="iam-sys__item"
            :style="{ '--accent': sys.accent, '--i': index }">
            <button type="button" class="iam-sys__card" @click="enter(sys)">
              <span class="iam-sys__rail" aria-hidden="true" />
              <span class="iam-sys__top">
                <span class="iam-sys__code">{{ sys.code }}</span>
                <span class="iam-sys__tag">{{ tagFor(sys) }}</span>
              </span>
              <span class="iam-sys__glyph" aria-hidden="true">{{ glyphFor(sys) }}</span>
              <span class="iam-sys__name">{{ sys.name }}</span>
              <span class="iam-sys__desc">{{ sys.desc }}</span>
              <span class="iam-sys__go">
                进入
                <span aria-hidden="true">→</span>
              </span>
            </button>
          </li>
        </ul>
        <p v-else class="iam-sys__empty">当前账号暂无平台子系统，请联系管理员分配套餐。</p>

        <footer class="iam-sys__foot">
          <button type="button" class="iam-sys__ghost" @click="openPwd = true">修改密码</button>
          <button type="button" class="iam-sys__ghost" @click="goConsole">打开控制台</button>
          <button type="button" class="iam-sys__ghost" @click="emit('close')">稍后</button>
        </footer>
      </div>
    </div>
    <IamChangePasswordModal
      v-model:open="openPwd"
      @success="onPwdSuccess"
      @close="openPwd = false" />
  </Teleport>
</template>

<script setup lang="ts">
import { fetchPortalSystems, systemsForModules, type PortalSystem } from '~/utils/iam/systems'

const IamChangePasswordModal = defineAsyncComponent(
  () => import('~/components/iam/ChangePasswordModal.vue'),
)

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ close: [] }>()

const auth = useAuthStore()
const router = useRouter()
const openPwd = ref(false)

const remoteSystems = ref<PortalSystem[] | null>(null)

const available = computed(() => {
  if (remoteSystems.value?.length) return remoteSystems.value
  return systemsForModules(
    auth.profile?.unlockedModules,
    (auth.profile?.roles ?? []).includes('SUPER_ADMIN'),
  )
})

watch(
  () => [open.value, auth.accessToken] as const,
  async ([isOpen, token]) => {
    if (!isOpen || !token) return
    const list = await fetchPortalSystems(token)
    if (list) remoteSystems.value = list
  },
  { immediate: true },
)

function tagFor(sys: PortalSystem): string {
  const code = sys.moduleCode.toUpperCase()
  if (code === 'FINANCE') return '离线 App'
  if (code === 'FIELDPULSE') return '平台侧'
  if (code === 'PACK3D') return '平台侧'
  return '子系统'
}

function glyphFor(sys: PortalSystem): string {
  const code = sys.moduleCode.toUpperCase()
  if (code === 'FINANCE') return '◇'
  if (code === 'FIELDPULSE') return '⬡'
  if (code === 'PACK3D') return '▣'
  return '○'
}

function enter(sys: PortalSystem) {
  open.value = false
  emit('close')
  router.push(sys.href)
}

function goConsole() {
  open.value = false
  emit('close')
  router.push('/console')
}

async function onPwdSuccess() {
  open.value = false
  emit('close')
  await auth.logout()
  await router.push('/login')
}
</script>

<style scoped lang="scss">
.iam-sys {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(2, 6, 23, 0.82);
  backdrop-filter: blur(14px);
  animation: iam-sys-fade 0.22s ease-out;
}

.iam-sys__panel {
  position: relative;
  width: 100%;
  max-width: 44rem;
  overflow: hidden;
  border-radius: 1.15rem;
  border: 1px solid rgba(110, 200, 232, 0.26);
  padding: 1.55rem 1.45rem 1.2rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 28%),
    linear-gradient(165deg, rgba(12, 26, 42, 0.98), rgba(3, 8, 18, 0.995));
  box-shadow:
    0 32px 90px rgba(0, 0, 0, 0.58),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset,
    0 0 64px rgba(34, 211, 238, 0.07);
  animation: iam-sys-rise 0.28s cubic-bezier(0.22, 1, 0.36, 1);

  &[data-count='3'] {
    max-width: 52rem;
  }
}

.iam-sys__glow {
  pointer-events: none;
  position: absolute;
  top: -40%;
  right: 0;
  width: 55%;
  height: 55%;
  background: radial-gradient(ellipse, rgba(110, 200, 232, 0.14), transparent 68%);
}

.iam-sys__grid-lines {
  pointer-events: none;
  position: absolute;
  inset: 0;
  opacity: 0.35;
  background-image:
    linear-gradient(rgba(110, 200, 232, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(110, 200, 232, 0.04) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.45), transparent 72%);
}

.iam-sys__head {
  position: relative;
  z-index: 1;
  margin-bottom: 1.35rem;
  padding-right: 2.2rem;
}

.iam-sys__eyebrow {
  margin: 0 0 0.4rem;
  font-family: ui-monospace, 'IBM Plex Mono', 'SF Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(110, 200, 232, 0.85);
}

.iam-sys__title {
  margin: 0;
  font-size: clamp(1.35rem, 2.4vw, 1.6rem);
  font-weight: 650;
  letter-spacing: -0.03em;
  color: #f8fafc;
  text-shadow: 0 0 40px rgba(110, 200, 232, 0.18);
}

.iam-sys__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.55rem;
  margin-top: 0.7rem;
}

.iam-sys__who {
  font-size: 0.84rem;
  font-weight: 500;
  color: #e2e8f0;
}

.iam-sys__plan {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(110, 200, 232, 0.35);
  background: linear-gradient(180deg, rgba(110, 200, 232, 0.18), rgba(110, 200, 232, 0.08));
  padding: 0.12rem 0.55rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: #a5f3fc;
  box-shadow: 0 0 16px rgba(34, 211, 238, 0.12);
}

.iam-sys__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #475569;

  @media (max-width: 420px) {
    display: none;
  }
}

.iam-sys__hint {
  font-size: 0.78rem;
  color: #64748b;
}

.iam-sys__x {
  position: absolute;
  top: -0.2rem;
  right: 0;
  width: 2.1rem;
  height: 2.1rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;

  &:hover {
    color: #a5f3fc;
    background: rgba(255, 255, 255, 0.04);
    border-color: rgba(110, 200, 232, 0.2);
  }
}

.iam-sys__grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
}

.iam-sys__panel[data-count='3'] .iam-sys__grid {
  @media (min-width: 900px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.iam-sys__panel[data-count='1'] .iam-sys__grid {
  grid-template-columns: 1fr;
  max-width: 28rem;
}

.iam-sys__item {
  animation: iam-sys-card 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  animation-delay: calc(var(--i, 0) * 55ms + 40ms);
}

.iam-sys__card {
  --accent: #6ec8e8;
  position: relative;
  display: flex;
  width: 100%;
  min-height: 10.5rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  overflow: hidden;
  border-radius: 0.85rem;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 42%),
    rgba(0, 0, 0, 0.38);
  padding: 1rem 1rem 0.95rem 1.1rem;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover,
  &:focus-visible {
    border-color: color-mix(in srgb, var(--accent) 55%, rgba(255, 255, 255, 0.15));
    background:
      linear-gradient(145deg, color-mix(in srgb, var(--accent) 16%, transparent), transparent 48%),
      rgba(6, 24, 36, 0.78);
    box-shadow:
      0 12px 36px rgba(0, 0, 0, 0.35),
      0 0 32px color-mix(in srgb, var(--accent) 22%, transparent);
    transform: translateY(-2px);
    outline: none;

    .iam-sys__go {
      color: var(--accent);
      opacity: 1;
      transform: translateX(0);
    }

    .iam-sys__glyph {
      opacity: 0.55;
      transform: scale(1.05);
    }

    .iam-sys__rail {
      opacity: 1;
    }
  }
}

.iam-sys__rail {
  position: absolute;
  left: 0;
  top: 0.7rem;
  bottom: 0.7rem;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 20%, transparent));
  opacity: 0.55;
  transition: opacity 0.18s;
}

.iam-sys__top {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.iam-sys__code {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.16em;
  color: var(--accent);
  text-shadow: 0 0 12px color-mix(in srgb, var(--accent) 35%, transparent);
}

.iam-sys__tag {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  padding: 0.12rem 0.45rem;
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  color: #94a3b8;
}

.iam-sys__glyph {
  position: absolute;
  right: 0.75rem;
  top: 2.35rem;
  font-size: 2.4rem;
  line-height: 1;
  color: var(--accent);
  opacity: 0.22;
  transition: opacity 0.18s, transform 0.18s;
  pointer-events: none;
}

.iam-sys__name {
  margin-top: 0.35rem;
  max-width: 88%;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f1f5f9;
}

.iam-sys__desc {
  flex: 1;
  max-width: 95%;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #94a3b8;
}

.iam-sys__go {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.55rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  color: #64748b;
  opacity: 0.85;
  transform: translateX(-2px);
  transition: opacity 0.15s, transform 0.15s, color 0.15s;
}

.iam-sys__empty {
  margin: 0;
  padding: 2.5rem 1rem;
  text-align: center;
  font-size: 0.88rem;
  color: #94a3b8;
}

.iam-sys__foot {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.35rem 1.1rem;
  margin-top: 1.2rem;
  padding-top: 0.95rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.iam-sys__ghost {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: none;
  transition: color 0.15s;

  &:hover {
    color: #a5f3fc;
  }
}

@keyframes iam-sys-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes iam-sys-rise {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes iam-sys-card {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .iam-sys,
  .iam-sys__panel,
  .iam-sys__item {
    animation: none;
  }

  .iam-sys__card:hover,
  .iam-sys__card:focus-visible {
    transform: none;
  }
}
</style>
