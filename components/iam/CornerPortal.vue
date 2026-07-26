<template>
  <Teleport to="body">
    <div class="iam-login-fixed">
      <button type="button" class="iam-login-fixed__btn" @click="onClick">
        {{ label }}
      </button>
      <button
        v-if="loggedIn"
        type="button"
        class="iam-login-fixed__out"
        @click.stop="onLogout">
        退出
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/** 右上角高亮「登录」——Teleport 到 body，避免被 layout overflow / 3D 层盖住。 */
const emit = defineEmits<{ open: [] }>()

const auth = useAuthStore()
const loggedIn = computed(() => auth.isLoggedIn)
const label = computed(() => (auth.isLoggedIn ? '进入系统' : '登录'))

onMounted(() => {
  try {
    auth.hydrate()
  } catch {
    /* ignore */
  }
})

function onClick() {
  emit('open')
}

async function onLogout() {
  await auth.logout()
}
</script>

<style scoped lang="scss">
.iam-login-fixed {
  position: fixed;
  top: 1rem;
  right: 1.1rem;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  pointer-events: auto;
  padding-top: env(safe-area-inset-top, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}

.iam-login-fixed__btn {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  color: #67e8f9;
  background: transparent;
  border: none;
  padding: 0.35rem 0.15rem;
  cursor: pointer;
  text-shadow:
    0 0 8px rgba(103, 232, 249, 0.95),
    0 0 20px rgba(34, 211, 238, 0.75),
    0 0 36px rgba(34, 211, 238, 0.45);
  animation: iam-pulse 2.2s ease-in-out infinite;

  &:hover {
    color: #ecfeff;
    text-shadow:
      0 0 10px rgba(236, 254, 255, 1),
      0 0 24px rgba(103, 232, 249, 0.9),
      0 0 48px rgba(34, 211, 238, 0.6);
  }
}

.iam-login-fixed__out {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.14em;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.25rem 0;

  &:hover {
    color: #e2e8f0;
  }
}

@keyframes iam-pulse {
  0%,
  100% {
    opacity: 1;
    filter: brightness(1);
  }
  50% {
    opacity: 0.82;
    filter: brightness(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .iam-login-fixed__btn {
    animation: none;
  }
}
</style>
