<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="iam-login"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="panel === 'login' ? 'iam-login-title' : 'iam-contact-title'"
      @click.self="emit('close')">
      <div class="iam-login__panel">
        <div class="iam-login__glow" aria-hidden="true" />

        <!-- 登录 -->
        <template v-if="panel === 'login'">
          <header class="iam-login__head">
            <p class="iam-login__eyebrow">系统 · IAM</p>
            <h2 id="iam-login-title" class="iam-login__title">账号登录</h2>
            <p class="iam-login__lead">进入系统管理平台。首页工具舱仍可匿名使用。</p>
            <button type="button" class="iam-login__x" aria-label="关闭" @click="emit('close')">
              ✕
            </button>
          </header>

          <form class="iam-login__form" @submit.prevent="submit">
            <label class="iam-login__field">
              <span>用户名</span>
              <input
                ref="userInput"
                v-model="username"
                type="text"
                name="username"
                autocomplete="username"
                placeholder="输入账号"
                spellcheck="false" />
            </label>

            <label class="iam-login__field">
              <span>密码</span>
              <div class="iam-login__pw">
                <input
                  ref="pwInput"
                  v-model="password"
                  :type="showPw ? 'text' : 'password'"
                  name="password"
                  autocomplete="current-password"
                  placeholder="输入密码" />
                <button
                  type="button"
                  class="iam-login__eye"
                  tabindex="-1"
                  @click="showPw = !showPw">
                  {{ showPw ? '隐藏' : '显示' }}
                </button>
              </div>
            </label>

            <p v-if="error" class="iam-login__error" role="alert">{{ error }}</p>

            <button type="submit" class="iam-login__submit" :disabled="loading || !canSubmit">
              <span>{{ loading ? '登录中…' : '登录进入管理平台' }}</span>
            </button>
          </form>

          <footer class="iam-login__footer">
            <span class="iam-login__footer-mute">账号需管理员开通</span>
            <button type="button" class="iam-login__link" @click="panel = 'contact'">
              微信扫码申请
              <span class="iam-login__link-arrow" aria-hidden="true">→</span>
            </button>
          </footer>
        </template>

        <!-- 联系管理员 · 微信二维码 -->
        <template v-else>
          <header class="iam-login__head">
            <p class="iam-login__eyebrow">开通 · 微信</p>
            <h2 id="iam-contact-title" class="iam-login__title">联系管理员</h2>
            <p class="iam-login__lead">扫码添加微信，说明需开通的账号与服务模块。</p>
            <button type="button" class="iam-login__x" aria-label="关闭" @click="emit('close')">
              ✕
            </button>
          </header>

          <div class="iam-login__qr-wrap">
            <img
              v-show="!qrBroken"
              class="iam-login__qr"
              :src="qrSrc"
              width="220"
              height="220"
              alt="管理员微信二维码"
              @load="qrBroken = false"
              @error="onQrError" />
            <p v-if="qrBroken" class="iam-login__qr-hint">
              二维码加载失败。请确认已放置
              <code>public/iam/wechat-admin-qr.png</code>
              后刷新页面。
            </p>
            <p v-else-if="wechatId" class="iam-login__wxid">
              微信号 <code>{{ wechatId }}</code>
            </p>
            <p class="iam-login__qr-lead">微信扫一扫 · 申请开通账号</p>
          </div>

          <button type="button" class="iam-login__ghost" @click="panel = 'login'">返回登录</button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ close: []; success: [] }>()

const config = useRuntimeConfig()
const auth = useAuthStore()

const panel = ref<'login' | 'contact'>('login')
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPw = ref(false)
const qrBroken = ref(false)
/** 当前尝试的二维码地址（支持 png → svg 回退） */
const qrSrc = ref('/iam/wechat-admin-qr.png')
const userInput = ref<HTMLInputElement | null>(null)
const pwInput = ref<HTMLInputElement | null>(null)

const canSubmit = computed(() => username.value.trim().length > 0 && password.value.length > 0)

const configuredQrUrl = computed(() => {
  const raw = String(config.public.adminWechatQr || '/iam/wechat-admin-qr.png').trim()
  return raw.startsWith('http') || raw.startsWith('/') ? raw : `/${raw}`
})

const wechatId = computed(() => String(config.public.adminWechatId || '').trim())

const QR_FALLBACKS = ['/iam/wechat-admin-qr.png', '/iam/wechat-admin-qr.svg'] as const

function resetQrSrc() {
  qrBroken.value = false
  qrSrc.value = configuredQrUrl.value
}

function onQrError() {
  const cur = qrSrc.value.split('?')[0]
  const next = QR_FALLBACKS.find((p) => p !== cur)
  if (next && cur !== next) {
    qrSrc.value = `${next}?t=${Date.now()}`
    return
  }
  qrBroken.value = true
}

watch(open, (v) => {
  if (v) {
    panel.value = 'login'
    error.value = ''
    password.value = ''
    showPw.value = false
    resetQrSrc()
    nextTick(() => userInput.value?.focus())
  }
})

watch(panel, (p) => {
  if (p === 'contact') resetQrSrc()
})

async function submit() {
  if (!canSubmit.value || loading.value) return
  error.value = ''
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    open.value = false
    emit('success')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.iam-login {
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

.iam-login__panel {
  position: relative;
  width: 100%;
  max-width: 26rem;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgba(110, 200, 232, 0.28);
  padding: 1.65rem 1.5rem 1.5rem;
  background: linear-gradient(165deg, rgba(10, 22, 36, 0.98), rgba(3, 8, 18, 0.99));
  box-shadow:
    0 28px 72px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 56px rgba(110, 200, 232, 0.07);
}

.iam-login__glow {
  pointer-events: none;
  position: absolute;
  top: -40%;
  left: 20%;
  width: 60%;
  height: 55%;
  background: radial-gradient(ellipse, rgba(110, 200, 232, 0.14), transparent 70%);
}

.iam-login__head {
  position: relative;
  margin-bottom: 1.35rem;
  padding-right: 2rem;
}

.iam-login__eyebrow {
  margin: 0 0 0.45rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  color: rgba(110, 200, 232, 0.8);
}

.iam-login__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f8fafc;
}

.iam-login__lead {
  margin: 0.55rem 0 0;
  font-size: 0.84rem;
  line-height: 1.55;
  color: #94a3b8;
}

.iam-login__x {
  position: absolute;
  top: -0.15rem;
  right: 0;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: #64748b;
  font-size: 0.9rem;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;

  &:hover {
    color: #a5f3fc;
    background: rgba(255, 255, 255, 0.04);
  }
}

.iam-login__form {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
}

.iam-login__field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;

  > span {
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    color: #94a3b8;
  }

  input {
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.4);
    padding: 0.72rem 0.9rem;
    font-size: 0.92rem;
    color: #f1f5f9;
    outline: none;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;

    &::placeholder {
      color: #475569;
    }

    &:hover {
      border-color: rgba(255, 255, 255, 0.16);
    }

    &:focus {
      border-color: rgba(110, 200, 232, 0.55);
      box-shadow: 0 0 0 3px rgba(110, 200, 232, 0.12);
    }
  }
}

.iam-login__pw {
  position: relative;

  input {
    padding-right: 3.4rem;
  }
}

.iam-login__eye {
  position: absolute;
  top: 50%;
  right: 0.55rem;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  padding: 0.25rem 0.35rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: #64748b;
  cursor: pointer;

  &:hover {
    color: #a5f3fc;
  }
}

.iam-login__error {
  margin: 0;
  border-radius: 0.4rem;
  border: 1px solid rgba(251, 191, 36, 0.35);
  background: rgba(251, 191, 36, 0.08);
  padding: 0.55rem 0.75rem;
  font-size: 0.82rem;
  color: #fde68a;
}

.iam-login__submit {
  margin-top: 0.25rem;
  width: 100%;
  border-radius: 0.55rem;
  border: 1px solid rgba(110, 200, 232, 0.45);
  background: linear-gradient(180deg, rgba(110, 200, 232, 0.22), rgba(110, 200, 232, 0.1));
  padding: 0.8rem 1rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  color: #ecfeff;
  cursor: pointer;
  box-shadow: 0 0 24px rgba(110, 200, 232, 0.12);
  transition:
    background 0.15s,
    box-shadow 0.15s,
    border-color 0.15s;

  &:hover:not(:disabled) {
    border-color: rgba(110, 200, 232, 0.7);
    background: linear-gradient(180deg, rgba(110, 200, 232, 0.32), rgba(110, 200, 232, 0.16));
    box-shadow: 0 0 32px rgba(110, 200, 232, 0.2);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
    box-shadow: none;
  }
}

.iam-login__footer {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.55rem 0.85rem;
  margin: 1.25rem 0 0;
  padding-top: 1.05rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.iam-login__footer-mute {
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  color: #64748b;
}

.iam-login__link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: none;
  border-radius: 0.35rem;
  background: transparent;
  padding: 0.2rem 0.35rem;
  margin: -0.2rem -0.35rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: rgba(110, 200, 232, 0.92);
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;

  &:hover {
    color: #ecfeff;
    background: rgba(110, 200, 232, 0.08);
  }

  &:hover .iam-login__link-arrow {
    transform: translateX(2px);
  }
}

.iam-login__link-arrow {
  display: inline-block;
  transition: transform 0.15s ease;
}

.iam-login__qr-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  margin-bottom: 1rem;
}

.iam-login__qr {
  width: 13.75rem;
  height: 13.75rem;
  object-fit: contain;
  border-radius: 0.65rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #fff;
  padding: 0.45rem;
}

.iam-login__qr-lead {
  margin: 0;
  font-size: 0.82rem;
  color: #94a3b8;
}

.iam-login__qr-hint {
  margin: 0;
  max-width: 18rem;
  text-align: center;
  font-size: 0.75rem;
  line-height: 1.5;
  color: #fbbf24;

  code {
    font-size: 0.68rem;
    color: #fde68a;
  }
}

.iam-login__wxid {
  margin: 0;
  font-size: 0.78rem;
  color: #94a3b8;

  code {
    color: #e2e8f0;
  }
}

.iam-login__ghost {
  position: relative;
  width: 100%;
  border-radius: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  padding: 0.7rem 1rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  color: #94a3b8;
  cursor: pointer;

  &:hover {
    border-color: rgba(110, 200, 232, 0.35);
    color: #a5f3fc;
  }
}
</style>
