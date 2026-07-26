<template>
  <div class="page-login">
    <div class="page-login__card">
      <p class="page-login__eyebrow">SYSTEM · IAM</p>
      <h1 class="page-login__title">账号登录</h1>
      <p class="page-login__lead">进入系统管理平台。首页工具舱仍可匿名使用。</p>

      <label class="page-login__field">
        <span>用户名</span>
        <input v-model="username" autocomplete="username" type="text" />
      </label>
      <label class="page-login__field">
        <span>密码</span>
        <input
          v-model="password"
          autocomplete="current-password"
          type="password"
          @keyup.enter="onSubmit" />
      </label>

      <p v-if="error" class="page-login__error" role="alert">{{ error }}</p>

      <button type="button" class="page-login__submit" :disabled="loading" @click="onSubmit">
        {{ loading ? '登录中…' : '登录' }}
      </button>
      <NuxtLink to="/" class="page-login__back">返回首页</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'tool' })

const auth = useAuthStore()
const route = useRoute()
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

onMounted(() => auth.hydrate())

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect) {
      await navigateTo(redirect)
    } else {
      await navigateTo('/console')
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.page-login {
  @apply flex min-h-[70vh] items-center justify-center px-4;
}

.page-login__card {
  @apply w-full max-w-md rounded-xl border border-cyan-500/25 bg-ink-950/90 p-6 shadow-xl;
}

.page-login__eyebrow {
  @apply mb-2 font-mono text-[0.65rem] tracking-[0.2em] text-cyan-300/80;
}

.page-login__title {
  @apply text-xl font-semibold text-slate-100;
}

.page-login__lead {
  @apply mb-5 mt-1 text-sm text-slate-400;
}

.page-login__field {
  @apply mb-3 flex flex-col gap-1.5 text-xs text-slate-400;

  input {
    @apply rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/50;
  }
}

.page-login__error {
  @apply mb-3 text-sm text-amber-300;
}

.page-login__submit {
  @apply w-full rounded border border-cyan-400/40 bg-cyan-500/15 py-2.5 text-sm text-cyan-100 transition hover:bg-cyan-500/25 disabled:opacity-50;
}

.page-login__back {
  @apply mt-4 block text-center font-mono text-[0.7rem] tracking-wider text-slate-500 hover:text-cyan-300;
}
</style>
