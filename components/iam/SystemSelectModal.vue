<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="iam-sys"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iam-sys-title"
      @click.self="emit('close')">
      <div class="iam-sys__panel">
        <div class="iam-sys__glow" aria-hidden="true" />

        <header class="iam-sys__head">
          <p class="iam-sys__eyebrow">进阶版 · 系统管理平台</p>
          <h2 id="iam-sys-title" class="iam-sys__title">选择子系统</h2>
          <p class="iam-sys__lead">
            <strong>{{ auth.displayLabel || '已登录' }}</strong>
            <span v-if="auth.profile?.planCode" class="iam-sys__plan">{{ auth.profile.planCode }}</span>
            <span class="iam-sys__hint">与首页工具舱分离 · 仅已解锁模块</span>
          </p>
          <button type="button" class="iam-sys__x" aria-label="关闭" @click="emit('close')">✕</button>
        </header>

        <ul v-if="available.length" class="iam-sys__grid" role="list">
          <li v-for="sys in available" :key="sys.moduleCode">
            <button type="button" class="iam-sys__card" @click="enter(sys.href)">
              <span class="iam-sys__code" :style="{ color: sys.accent }">{{ sys.code }}</span>
              <span class="iam-sys__name">{{ sys.name }}</span>
              <span class="iam-sys__desc">{{ sys.desc }}</span>
              <span class="iam-sys__go" aria-hidden="true">进入 →</span>
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

function enter(href: string) {
  open.value = false
  emit('close')
  router.push(href)
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
  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(12px);
}

.iam-sys__panel {
  position: relative;
  width: 100%;
  max-width: 40rem;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgba(110, 200, 232, 0.28);
  padding: 1.65rem 1.5rem 1.35rem;
  background: linear-gradient(165deg, rgba(10, 22, 36, 0.98), rgba(3, 8, 18, 0.99));
  box-shadow:
    0 28px 80px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 56px rgba(34, 211, 238, 0.08);
}

.iam-sys__glow {
  pointer-events: none;
  position: absolute;
  top: -35%;
  right: 10%;
  width: 50%;
  height: 50%;
  background: radial-gradient(ellipse, rgba(110, 200, 232, 0.12), transparent 70%);
}

.iam-sys__head {
  position: relative;
  margin-bottom: 1.25rem;
  padding-right: 2rem;
}

.iam-sys__eyebrow {
  margin: 0 0 0.45rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  color: rgba(110, 200, 232, 0.8);
}

.iam-sys__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f8fafc;
}

.iam-sys__lead {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.65rem;
  margin: 0.6rem 0 0;
  font-size: 0.84rem;
  color: #94a3b8;

  strong {
    font-weight: 500;
    color: #e2e8f0;
  }
}

.iam-sys__plan {
  display: inline-flex;
  border-radius: 0.3rem;
  border: 1px solid rgba(110, 200, 232, 0.3);
  background: rgba(110, 200, 232, 0.1);
  padding: 0.1rem 0.45rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: #a5f3fc;
}

.iam-sys__hint {
  color: #64748b;
}

.iam-sys__x {
  position: absolute;
  top: -0.15rem;
  right: 0;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: #64748b;
  cursor: pointer;

  &:hover {
    color: #a5f3fc;
    background: rgba(255, 255, 255, 0.04);
  }
}

.iam-sys__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;

  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
}

.iam-sys__card {
  position: relative;
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.32);
  padding: 1rem 1rem 0.9rem;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;

  &:hover {
    border-color: rgba(110, 200, 232, 0.45);
    background: rgba(8, 28, 40, 0.65);
    box-shadow: 0 0 28px rgba(34, 211, 238, 0.1);

    .iam-sys__go {
      opacity: 1;
      transform: translateX(0);
    }
  }
}

.iam-sys__code {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
}

.iam-sys__name {
  font-size: 0.95rem;
  font-weight: 560;
  color: #f1f5f9;
}

.iam-sys__desc {
  font-size: 0.78rem;
  line-height: 1.45;
  color: #94a3b8;
}

.iam-sys__go {
  margin-top: 0.35rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  color: #67e8f9;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.15s, transform 0.15s;
}

.iam-sys__empty {
  margin: 0;
  padding: 2.5rem 1rem;
  text-align: center;
  font-size: 0.88rem;
  color: #94a3b8;
}

.iam-sys__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.15rem;
  padding-top: 0.9rem;
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
</style>
