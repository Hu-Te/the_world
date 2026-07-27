<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="iam-pwd"
      role="dialog"
      aria-modal="true"
      aria-labelledby="iam-pwd-title"
      @click.self="emit('close')">
      <div class="iam-pwd__panel">
        <header class="iam-pwd__head">
          <p class="iam-pwd__eyebrow">IAM · 安全</p>
          <h2 id="iam-pwd-title" class="iam-pwd__title">修改密码</h2>
          <p class="iam-pwd__lead">改密后需重新登录 · 新密码至少 8 位</p>
          <button type="button" class="iam-pwd__x" aria-label="关闭" @click="emit('close')">✕</button>
        </header>
        <form class="iam-pwd__form" @submit.prevent="submit">
          <label class="iam-pwd__field">
            <span>原密码</span>
            <input v-model="oldPassword" type="password" autocomplete="current-password" />
          </label>
          <label class="iam-pwd__field">
            <span>新密码</span>
            <input v-model="newPassword" type="password" autocomplete="new-password" />
          </label>
          <label class="iam-pwd__field">
            <span>确认新密码</span>
            <input v-model="confirmPassword" type="password" autocomplete="new-password" />
          </label>
          <p v-if="error" class="iam-pwd__error" role="alert">{{ error }}</p>
          <button type="submit" class="iam-pwd__submit" :disabled="loading">
            {{ loading ? '提交中…' : '确认修改' }}
          </button>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ close: []; success: [] }>()

const auth = useAuthStore()
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')

watch(open, (v) => {
  if (v) {
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    error.value = ''
  }
})

async function submit() {
  error.value = ''
  if (newPassword.value.length < 8) {
    error.value = '新密码至少 8 位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次输入的新密码不一致'
    return
  }
  loading.value = true
  try {
    await auth.changePassword(oldPassword.value, newPassword.value)
    open.value = false
    emit('success')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '修改失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.iam-pwd {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(6px);
  padding: 1rem;
}

.iam-pwd__panel {
  position: relative;
  width: min(100%, 22rem);
  border-radius: 1rem;
  border: 1px solid rgba(103, 232, 249, 0.22);
  background: linear-gradient(165deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98));
  padding: 1.35rem 1.25rem 1.25rem;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.iam-pwd__head {
  position: relative;
  margin-bottom: 1rem;
}

.iam-pwd__eyebrow {
  margin: 0 0 0.35rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  color: rgba(103, 232, 249, 0.75);
}

.iam-pwd__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 650;
  color: #f1f5f9;
}

.iam-pwd__lead {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: #94a3b8;
}

.iam-pwd__x {
  position: absolute;
  top: -0.15rem;
  right: -0.15rem;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.25rem;

  &:hover {
    color: #e2e8f0;
  }
}

.iam-pwd__field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
  font-size: 0.72rem;
  color: #94a3b8;

  input {
    border-radius: 0.45rem;
    border: 1px solid rgba(148, 163, 184, 0.22);
    background: rgba(0, 0, 0, 0.35);
    padding: 0.55rem 0.7rem;
    color: #f1f5f9;
    font-size: 0.9rem;
    outline: none;

    &:focus {
      border-color: rgba(103, 232, 249, 0.45);
    }
  }
}

.iam-pwd__error {
  margin: 0 0 0.65rem;
  font-size: 0.8rem;
  color: #fcd34d;
}

.iam-pwd__submit {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid rgba(103, 232, 249, 0.35);
  background: rgba(34, 211, 238, 0.12);
  color: #ecfeff;
  padding: 0.65rem;
  font-size: 0.88rem;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: rgba(34, 211, 238, 0.2);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
}
</style>
