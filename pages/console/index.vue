<template>
  <div class="console-shell">
    <header class="console-shell__head">
      <div>
        <p class="console-shell__eyebrow">进阶版 · 系统管理平台</p>
        <h1 class="console-shell__title">控制台</h1>
        <p class="console-shell__lead">
          与首页工具舱分离：此处按套餐解锁平台子系统；基础工具仍在
          <NuxtLink to="/">首页 /tools</NuxtLink>
          匿名使用。
        </p>
      </div>
      <div class="console-shell__actions">
        <button
          v-if="auth.isSuperAdmin"
          type="button"
          class="console-shell__ghost"
          @click="router.push('/admin/users')">
          账号治理
        </button>
        <button type="button" class="console-shell__ghost" @click="router.push('/')">返回首页</button>
      </div>
    </header>

    <ul v-if="available.length" class="console-shell__grid" role="list">
      <li v-for="sys in available" :key="sys.moduleCode">
        <button type="button" class="console-shell__card" @click="router.push(sys.href)">
          <span class="console-shell__code" :style="{ color: sys.accent }">{{ sys.code }}</span>
          <span class="console-shell__name">{{ sys.name }}</span>
          <span class="console-shell__desc">{{ sys.desc }}</span>
          <span class="console-shell__go">进入 →</span>
        </button>
      </li>
    </ul>
    <p v-else class="console-shell__empty">当前账号暂无平台子系统，请联系管理员分配套餐。</p>
</div>
</template>

<script setup lang="ts">
import { fetchPortalSystems, systemsForModules, type PortalSystem } from '~/utils/iam/systems'

definePageMeta({ layout: false })

const auth = useAuthStore()
const router = useRouter()
const remote = ref<PortalSystem[] | null>(null)

const available = computed(() => {
  if (remote.value?.length) return remote.value
  return systemsForModules(
    auth.profile?.unlockedModules,
    (auth.profile?.roles ?? []).includes('SUPER_ADMIN'),
  )
})

onMounted(async () => {
  auth.hydrate()
  if (!auth.accessToken) return
  const list = await fetchPortalSystems(auth.accessToken)
  if (list) remote.value = list
})
</script>

<style scoped lang="scss">
.console-shell {
  min-height: 100vh;
  padding: 2.5rem 1.5rem 3rem;
  background: radial-gradient(ellipse at 20% 0%, rgba(110, 200, 232, 0.08), transparent 45%), #030812;
  color: #e2e8f0;
}

.console-shell__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.25rem;
  max-width: 56rem;
  margin: 0 auto 2rem;
}

.console-shell__eyebrow {
  margin: 0 0 0.45rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: rgba(110, 200, 232, 0.85);
}

.console-shell__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f8fafc;
}

.console-shell__lead {
  margin: 0.6rem 0 0;
  max-width: 36rem;
  font-size: 0.9rem;
  line-height: 1.55;
  color: #94a3b8;

  a {
    color: #67e8f9;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}

.console-shell__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.console-shell__ghost {
  border-radius: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  padding: 0.55rem 0.9rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: #94a3b8;
  cursor: pointer;

  &:hover {
    border-color: rgba(110, 200, 232, 0.4);
    color: #a5f3fc;
  }
}

.console-shell__grid {
  list-style: none;
  margin: 0 auto;
  padding: 0;
  max-width: 56rem;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 1rem;
}

.console-shell__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
  width: 100%;
  min-height: 9.5rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(110, 200, 232, 0.22);
  background: linear-gradient(165deg, rgba(10, 22, 36, 0.95), rgba(3, 8, 18, 0.98));
  padding: 1.15rem 1.1rem;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  &:hover {
    border-color: rgba(110, 200, 232, 0.5);
    box-shadow: 0 0 28px rgba(110, 200, 232, 0.1);
  }
}

.console-shell__code {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
}

.console-shell__name {
  font-size: 1.05rem;
  font-weight: 600;
  color: #f1f5f9;
}

.console-shell__desc {
  flex: 1;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #64748b;
}

.console-shell__go {
  margin-top: 0.35rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: #67e8f9;
}

.console-shell__empty {
  max-width: 56rem;
  margin: 0 auto;
  color: #94a3b8;
  font-size: 0.9rem;
}
</style>
