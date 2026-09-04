<template>
  <div class="fin-auth-cb">
    <p class="fin-auth-cb__eyebrow">FINANCE DESKTOP · AUTH</p>
    <h1 class="fin-auth-cb__title">桌面授权回调</h1>

    <p v-if="loading" class="fin-auth-cb__msg">正在签发离线授权…</p>
    <p v-else-if="error" class="fin-auth-cb__err">{{ error }}</p>
    <template v-else>
      <p class="fin-auth-cb__ok">{{ hint }}</p>
      <p v-if="fallbackLink" class="fin-auth-cb__fallback">
        若未自动唤起桌面应用，请复制链接到桌面端：
        <code>{{ fallbackLink }}</code>
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { issueFinanceOfflineToken } from '~/utils/finance-desktop/distributionApi'

definePageMeta({ layout: false })

const auth = useAuthStore()
const loading = ref(true)
const error = ref('')
const hint = ref('')
const fallbackLink = ref('')

const CALLBACK_PATH = '/console/finance/desktop/auth-callback'
const TOKEN_KEY = 'iam.accessToken'

function clearSensitiveUi() {
  fallbackLink.value = ''
  hint.value = ''
  error.value = ''
}

async function kickToLogin(reason?: string) {
  clearSensitiveUi()
  loading.value = false
  if (reason) {
    error.value = reason
  }
  await navigateTo({ path: '/login', query: { redirect: CALLBACK_PATH } })
}

async function ensureSessionOrKick(): Promise<boolean> {
  auth.hydrate()
  if (!auth.isLoggedIn) {
    await kickToLogin()
    return false
  }
  if (!auth.isSuperAdmin && !auth.hasModule('FINANCE')) {
    clearSensitiveUi()
    error.value = '当前账号未开通 FINANCE 模块，无法授权桌面端'
    loading.value = false
    return false
  }
  return true
}

async function issueOnce() {
  if (!(await ensureSessionOrKick())) return

  loading.value = true
  error.value = ''
  try {
    const { deepLinkUrl } = await issueFinanceOfflineToken()
    // 签发过程中若已退出，丢弃结果，勿把密钥留在页面上
    auth.hydrate()
    if (!auth.isLoggedIn) {
      await kickToLogin('会话已退出，离线密钥未展示')
      return
    }
    hint.value = '已签发离线密钥，正在唤起桌面应用（时长由桌面端按账号额度解析）…'
    fallbackLink.value = deepLinkUrl
    window.location.href = deepLinkUrl
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function onStorage(ev: StorageEvent) {
  if (ev.key !== TOKEN_KEY && ev.key !== null) return
  // 其它标签页 logout 会清 localStorage；本页须立刻丢掉 Deep Link 并回登录
  if (!ev.newValue) {
    void kickToLogin('账号已在其它页面退出，请重新登录后再授权桌面端')
  }
}

function onVisibility() {
  if (document.visibilityState !== 'visible') return
  auth.hydrate()
  if (!auth.isLoggedIn && (fallbackLink.value || loading.value)) {
    void kickToLogin('会话已退出，请重新登录后再授权桌面端')
  }
}

onMounted(() => {
  window.addEventListener('storage', onStorage)
  document.addEventListener('visibilitychange', onVisibility)
  void issueOnce()
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorage)
  document.removeEventListener('visibilitychange', onVisibility)
  clearSensitiveUi()
})

watch(
  () => auth.isLoggedIn,
  (ok) => {
    if (!ok && (fallbackLink.value || loading.value || !error.value)) {
      void kickToLogin('会话已退出，请重新登录后再授权桌面端')
    }
  },
)
</script>

<style scoped lang="scss">
.fin-auth-cb {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  justify-content: center;
  min-height: 70vh;
  padding: 1.5rem;
  color: #e8eef4;
  background: #061018;
}

.fin-auth-cb__eyebrow {
  margin: 0;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.65rem;
  letter-spacing: 0.2em;
  color: rgba(159, 216, 204, 0.85);
}

.fin-auth-cb__title {
  margin: 0;
  font-size: 1.25rem;
  color: #ecfeff;
}

.fin-auth-cb__msg,
.fin-auth-cb__ok {
  margin: 0;
  font-size: 0.9rem;
  color: #a8c0d0;
}

.fin-auth-cb__err {
  margin: 0;
  max-width: 28rem;
  font-size: 0.9rem;
  color: #fca5a5;
  text-align: center;
}

.fin-auth-cb__fallback {
  margin: 0;
  max-width: 36rem;
  font-size: 0.75rem;
  color: #7a93a8;
  text-align: center;
  word-break: break-all;

  code {
    display: block;
    margin-top: 0.5rem;
    padding: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.35rem;
    background: rgba(0, 0, 0, 0.35);
    color: #9fd8cc;
    font-size: 0.68rem;
  }
}
</style>
