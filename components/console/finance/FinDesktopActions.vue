<template>
  <div class="fin-desktop-actions">
    <div class="fin-desktop-actions__row">
      <button type="button" class="fin-act" :disabled="busy" @click="openDesktop">
        生成密钥并打开桌面端
      </button>
      <button
        type="button"
        class="fin-act fin-act--ghost"
        :disabled="busy || lastDeepLink === ''"
        @click="copyDeepLink">
        复制 Deep Link
      </button>
    </div>
    <p v-if="hint" class="fin-desktop-actions__hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { issueFinanceOfflineToken } from '~/utils/finance-desktop/distributionApi'

const busy = ref(false)
const hint = ref('')
const lastDeepLink = ref('')

async function issueToken() {
  busy.value = true
  hint.value = ''
  try {
    const result = await issueFinanceOfflineToken()
    lastDeepLink.value = result.deepLinkUrl
    return result
  } finally {
    busy.value = false
  }
}

async function openDesktop() {
  try {
    await issueToken()
    window.location.href = lastDeepLink.value
    hint.value = '已签发离线密钥；时长由桌面端按账号额度解析。若未唤起，请复制 Deep Link'
  } catch (e) {
    hint.value = formatIssueError(e)
  }
}

function formatIssueError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('FINANCE') || msg.includes('未开通') || msg.includes('未解锁')) {
    return '未开通 FINANCE 模块（仅用于离线桌面）。请管理员在账号管理中解锁后再试。'
  }
  return msg
}

async function copyDeepLink() {
  if (lastDeepLink.value === '') {
    try {
      await issueToken()
    } catch (e) {
      hint.value = e instanceof Error ? e.message : String(e)
      return
    }
  }
  try {
    await navigator.clipboard.writeText(lastDeepLink.value)
    hint.value = 'Deep Link 已复制到剪贴板'
  } catch {
    hint.value = '复制失败，请手动复制 Deep Link'
  }
}
</script>

<style scoped lang="scss">
.fin-desktop-actions {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 1rem;
}

.fin-desktop-actions__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.fin-act {
  border: 1px solid rgba(159, 216, 204, 0.35);
  border-radius: 0.4rem;
  background: rgba(46, 160, 140, 0.22);
  color: #9fd8cc;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.78rem;
  padding: 0.55rem 0.9rem;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: rgba(46, 160, 140, 0.35);
  }

  &--ghost {
    background: transparent;
    border-color: rgba(122, 147, 168, 0.35);
    color: #a8c0d0;
  }
}

.fin-desktop-actions__hint {
  margin: 0;
  font-size: 0.72rem;
  color: #7a93a8;
}
</style>
