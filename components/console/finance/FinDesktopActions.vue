<template>
  <div class="fin-desktop-actions">
    <div class="fin-desktop-actions__row">
      <button type="button" class="fin-act" :disabled="busy" @click="openDesktop">
        打开软件
      </button>
      <button
        type="button"
        class="fin-act fin-act--ghost"
        :disabled="busy"
        @click="copyDeepLink">
        复制打开链接
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
    hint.value = '已尝试打开。如果没反应，请先确认软件已安装，或点「复制打开链接」再粘贴到浏览器地址栏。'
  } catch (e) {
    hint.value = formatIssueError(e)
  }
}

function formatIssueError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  if (msg.includes('FINANCE') || msg.includes('未开通') || msg.includes('未解锁')) {
    return '当前账号还不能用财务桌面，请联系管理员开通。'
  }
  return msg
}

async function copyDeepLink() {
  if (lastDeepLink.value === '') {
    try {
      await issueToken()
    } catch (e) {
      hint.value = formatIssueError(e)
      return
    }
  }
  try {
    await navigator.clipboard.writeText(lastDeepLink.value)
    hint.value = '打开链接已复制，可粘贴到浏览器地址栏。'
  } catch {
    hint.value = '复制失败，请再试一次。'
  }
}
</script>

<style scoped lang="scss">
.fin-desktop-actions {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.9rem;
  min-width: 0;
}

.fin-desktop-actions__row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;

  @media (min-width: 480px) {
    grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  }
}

.fin-act {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid rgba(159, 216, 204, 0.4);
  border-radius: 0.45rem;
  background: rgba(46, 160, 140, 0.28);
  color: #dff7f0;
  font-size: 0.95rem;
  font-weight: 560;
  padding: 0.75rem 1rem;
  cursor: pointer;
  text-align: center;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: rgba(46, 160, 140, 0.4);
  }

  &--ghost {
    background: transparent;
    border-color: rgba(122, 147, 168, 0.35);
    color: #a8c0d0;
    font-weight: 500;
  }
}

.fin-desktop-actions__hint {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.45;
  color: #7a93a8;
  overflow-wrap: anywhere;
}
</style>
