<template>
  <div class="iam-entry" :class="{ 'iam-entry--inline': inline }" @click.stop>
    <template v-if="auth.isLoggedIn">
      <button type="button" class="iam-entry__btn iam-entry__btn--primary" @click="openSystems = true">
        进入系统
      </button>
      <span class="iam-entry__name" :title="auth.displayLabel">{{ auth.displayLabel }}</span>
      <button type="button" class="iam-entry__btn" @click="onLogout">退出</button>
    </template>
    <template v-else>
      <button type="button" class="iam-entry__btn iam-entry__btn--primary" @click="openLogin = true">
        登录
      </button>
    </template>

    <IamLoginModal v-model:open="openLogin" @success="onLoginSuccess" @close="openLogin = false" />
    <IamSystemSelectModal v-model:open="openSystems" @close="openSystems = false" />
  </div>
</template>

<script setup lang="ts">
/**
 * 系统域登录入口（与 tools 工具舱分离）。
 * 首页使用 fixed，避免被 3D canvas / isolate 盖住。
 */
withDefaults(
  defineProps<{
    inline?: boolean
  }>(),
  { inline: false },
)

const auth = useAuthStore()
const openLogin = ref(false)
const openSystems = ref(false)

onMounted(() => auth.hydrate())

function onLoginSuccess() {
  openSystems.value = true
}

async function onLogout() {
  openSystems.value = false
  await auth.logout()
}
</script>

<style scoped lang="scss">
.iam-entry {
  /* 不用 @apply z-[…]，避免被 canvas 叠层吃掉；固定贴视口右上 */
  position: fixed;
  top: max(0.85rem, env(safe-area-inset-top, 0px));
  right: max(0.85rem, env(safe-area-inset-right, 0px));
  z-index: 80;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  pointer-events: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  &--inline {
    position: static;
    inset: auto;
    z-index: auto;
  }
}

.iam-entry__name {
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  color: #cbd5e1;
}

.iam-entry__btn {
  border-radius: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(2, 8, 16, 0.72);
  padding: 0.45rem 0.9rem;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #e2e8f0;
  backdrop-filter: blur(8px);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;

  &:hover {
    border-color: rgba(34, 211, 238, 0.55);
    color: #ecfeff;
  }

  &--primary {
    border-color: rgba(34, 211, 238, 0.65);
    background: rgba(8, 51, 68, 0.85);
    color: #a5f3fc;
    box-shadow:
      0 0 0 1px rgba(34, 211, 238, 0.15),
      0 0 28px rgba(34, 211, 238, 0.22);

    &:hover {
      background: rgba(14, 80, 100, 0.95);
      color: #ecfeff;
    }
  }
}
</style>
