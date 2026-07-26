<template>
  <Teleport to="body">
    <div v-if="open" class="fp-modal" role="dialog" aria-modal="true" aria-labelledby="fp-agent-dl-title">
      <button type="button" class="fp-modal__backdrop" aria-label="关闭" @click="onClose" />
      <div class="fp-modal__panel">
        <header class="fp-modal__head">
          <h2 id="fp-agent-dl-title" class="fp-modal__title">下载现场 Agent</h2>
          <button type="button" class="fp-btn fp-btn--ghost fp-btn--sm" :disabled="busy" @click="onClose">关闭</button>
        </header>

        <p class="fp-tip">
          <strong>一般不必重下：</strong>网页界面改版不影响已安装的 Agent。
          仅当启动脚本报错、或服务端明确要求更新时，再下载覆盖即可。
        </p>

        <p class="fp-modal__lead">
          云网站访问不到厂内 PLC。请在<strong>能访问 PLC 的 Windows 电脑</strong>上运行工具包——
          <strong>无需安装 Java</strong>（zip 约含内置运行时，体积较大属正常）。
        </p>

        <ol class="fp-modal__steps">
          <li>点下方按钮下载，等进度走完；浏览器会保存 <code>fieldpulse-agent-windows.zip</code></li>
          <li><strong>解压</strong>到任意文件夹（勿在压缩包里直接双击）</li>
          <li>记事本打开 <code>agent.env</code>，只改 <code>APP_API_TOKEN=</code> 为与网站相同的 Token</li>
          <li>双击 <code>start-agent.bat</code>，看到 <code>connected OK</code> 后<strong>保持窗口打开</strong></li>
          <li>回到本页点「刷新代理」，下拉选中该 agent，再启动会话</li>
        </ol>

        <div class="fp-modal__cmd">
          <div class="fp-modal__cmd-row">
            <span class="fp-muted">agent.env 填写示例（可复制）</span>
          </div>
          <pre class="fp-modal__pre">{{ envSample }}</pre>
        </div>

        <div v-if="busy || progress" class="fp-progress" aria-live="polite">
          <div class="fp-progress__meta">
            <span>{{ progressLabel }}</span>
            <span v-if="progress?.percent != null" class="fp-mono">{{ progress.percent }}%</span>
          </div>
          <div class="fp-progress__track" role="progressbar" :aria-valuenow="progress?.percent ?? 0" aria-valuemin="0" aria-valuemax="100">
            <div
              class="fp-progress__bar"
              :class="{ 'fp-progress__bar--indeterminate': busy && progress?.percent == null }"
              :style="progressBarStyle" />
          </div>
          <p v-if="progress" class="fp-progress__bytes fp-muted">
            <template v-if="progress.total != null">
              {{ formatAgentDownloadBytes(progress.loaded) }} / {{ formatAgentDownloadBytes(progress.total) }}
            </template>
            <template v-else>
              已接收 {{ formatAgentDownloadBytes(progress.loaded) }}
            </template>
          </p>
        </div>

        <p v-if="error" class="fp-error">{{ error }}</p>
        <p v-if="okMsg" class="fp-ok">{{ okMsg }}</p>

        <div class="fp-modal__actions">
          <button type="button" class="fp-btn fp-btn--accent" :disabled="busy" @click="onDownloadWindows">
            {{ busy ? '下载中…' : '下载 Windows 工具包' }}
          </button>
          <button type="button" class="fp-btn fp-btn--ghost" :disabled="busy" @click="copyEnv">
            复制配置示例
          </button>
        </div>
        <p class="fp-modal__note fp-muted">
          常见问题：① 不要双击 .jar；② Token 填错会连不上云；③ 下拉为空 = Agent 未在线，检查 bat 窗口是否仍开着。
        </p>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  agentCloudWsUrl,
  downloadAgentPackage,
  formatAgentDownloadBytes,
  type AgentDownloadProgress,
} from '~/utils/fieldpulse/api'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const busy = ref(false)
const error = ref('')
const okMsg = ref('')
const progress = ref<AgentDownloadProgress | null>(null)

const cloudHost = computed(() => {
  try {
    const raw = agentCloudWsUrl().replace(/([?&])token=[^&]*/g, '')
    const u = new URL(raw.replace(/^ws/i, 'http'))
    return u.host
  } catch {
    return '你的域名'
  }
})

const envSample = computed(() => {
  return [
    `FIELDPULSE_CLOUD_WS=wss://${cloudHost.value}/ws/fieldpulse/agent`,
    'APP_API_TOKEN=与网站相同的Token',
    'FIELDPULSE_AGENT_ID=plant-a',
    'FIELDPULSE_AGENT_NAME=车间A',
  ].join('\n')
})

const progressLabel = computed(() => {
  const p = progress.value
  if (!busy.value && !p) return ''
  if (!p || p.phase === 'connecting') return '正在连接服务器…'
  if (p.phase === 'saving') return '下载完成，正在交给浏览器保存…'
  if (p.percent == null) return '正在下载（体积较大，请耐心等待）…'
  return '正在下载工具包…'
})

const progressBarStyle = computed(() => {
  const pct = progress.value?.percent
  if (pct == null) return undefined
  return { width: `${pct}%` }
})

watch(
  () => props.open,
  (v) => {
    if (v && !busy.value) {
      error.value = ''
      okMsg.value = ''
      progress.value = null
    }
  },
)

function onClose() {
  if (busy.value) return
  emit('close')
}

async function onDownloadWindows() {
  error.value = ''
  okMsg.value = ''
  busy.value = true
  progress.value = { loaded: 0, total: null, percent: null, phase: 'connecting' }
  try {
    const { filename, bytes } = await downloadAgentPackage('windows', (p) => {
      progress.value = p
    })
    okMsg.value = `已保存 ${filename}（${formatAgentDownloadBytes(bytes)}）。请解压 → 改 agent.env → 双击 start-agent.bat`
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    progress.value = null
  } finally {
    busy.value = false
  }
}

async function copyEnv() {
  try {
    await navigator.clipboard.writeText(envSample.value)
    okMsg.value = '配置示例已复制，粘贴到解压目录里的 agent.env 即可'
    error.value = ''
  } catch {
    error.value = '复制失败，请手动选中上方示例复制'
  }
}
</script>

<style scoped lang="scss">
.fp-modal {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 1.25rem;
}
.fp-modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: color-mix(in srgb, #0b1220 55%, transparent);
  cursor: pointer;
}
.fp-modal__panel {
  position: relative;
  z-index: 1;
  width: min(560px, 100%);
  max-height: min(88vh, 720px);
  overflow: auto;
  padding: 1.25rem 1.35rem 1.4rem;
  border-radius: 14px;
  background: linear-gradient(165deg, #f7f3ea 0%, #efe6d4 48%, #e7dcc8 100%);
  border: 1px solid color-mix(in srgb, #5c4a32 18%, transparent);
  box-shadow: 0 24px 60px color-mix(in srgb, #1a1208 35%, transparent);
  color: #2a2118;
}
.fp-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.fp-modal__title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.fp-tip {
  margin: 0 0 0.75rem;
  padding: 0.55rem 0.7rem;
  border-radius: 8px;
  background: color-mix(in srgb, #2f5d50 12%, transparent);
  border: 1px solid color-mix(in srgb, #2f5d50 28%, transparent);
  font-size: 0.84rem;
  line-height: 1.5;
  color: #1f3d36;
}
.fp-modal__lead {
  margin: 0 0 0.85rem;
  line-height: 1.55;
  font-size: 0.92rem;
}
.fp-modal__steps {
  margin: 0 0 1rem;
  padding-left: 1.2rem;
  line-height: 1.6;
  font-size: 0.9rem;
}
.fp-modal__cmd {
  margin-bottom: 1rem;
  padding: 0.75rem 0.85rem;
  border-radius: 10px;
  background: color-mix(in srgb, #1e1810 6%, transparent);
}
.fp-modal__cmd-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 0.55rem;
  font-size: 0.82rem;
}
.fp-modal__pre {
  margin: 0;
  padding: 0.65rem 0.7rem;
  border-radius: 8px;
  background: #1e1810;
  color: #f3e9d8;
  font-size: 0.78rem;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.fp-progress {
  margin: 0 0 0.85rem;
  padding: 0.7rem 0.8rem;
  border-radius: 10px;
  background: color-mix(in srgb, #1e1810 5%, transparent);
  border: 1px solid color-mix(in srgb, #5c4a32 14%, transparent);
}
.fp-progress__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.45rem;
  font-size: 0.84rem;
}
.fp-progress__track {
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, #1e1810 12%, transparent);
}
.fp-progress__bar {
  height: 100%;
  width: 0%;
  border-radius: inherit;
  background: linear-gradient(90deg, #2f5d50, #4a8f7a);
  transition: width 0.15s ease-out;
}
.fp-progress__bar--indeterminate {
  width: 35%;
  animation: fp-progress-indeterminate 1.1s ease-in-out infinite;
}
@keyframes fp-progress-indeterminate {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(320%);
  }
}
.fp-progress__bytes {
  margin: 0.4rem 0 0;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}
.fp-mono {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.fp-modal__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}
.fp-modal__note {
  margin: 0.85rem 0 0;
  font-size: 0.8rem;
  line-height: 1.45;
}
.fp-muted {
  opacity: 0.7;
}
.fp-error {
  color: #9b2c2c;
  margin: 0 0 0.65rem;
  font-size: 0.88rem;
}
.fp-ok {
  color: #276749;
  margin: 0 0 0.65rem;
  font-size: 0.88rem;
}
.fp-btn {
  appearance: none;
  border: 1px solid color-mix(in srgb, #5c4a32 28%, transparent);
  background: #fff8ee;
  color: inherit;
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font: inherit;
  cursor: pointer;
}
.fp-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.fp-btn--ghost {
  background: transparent;
}
.fp-btn--accent {
  background: #2f5d50;
  border-color: #2f5d50;
  color: #f7f3ea;
}
.fp-btn--sm {
  padding: 0.28rem 0.55rem;
  font-size: 0.82rem;
}
</style>
