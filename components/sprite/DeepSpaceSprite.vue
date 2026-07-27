<template>
  <Teleport to="body">
    <div class="dss" :class="[`dss--${mode}`, open && 'is-open', streaming && 'is-streaming']">
      <button
        type="button"
        class="dss__fab"
        :aria-expanded="open"
        :title="mode === 'platform' ? '深空精灵 · 系统' : '深空精灵 · 访客'"
        @click="toggleOpen"
        @pointerenter="onFabHover(true)"
        @pointerleave="onFabHover(false)">
        <span ref="stageRef" class="dss__stage" aria-hidden="true" />
        <span class="dss__fab-label">深空精灵</span>
      </button>

      <Transition name="dss-pop">
        <div v-if="open" class="dss__panel" role="dialog" aria-label="深空精灵">
          <span class="dss__corner dss__corner--tl" aria-hidden="true" />
          <span class="dss__corner dss__corner--tr" aria-hidden="true" />
          <span class="dss__corner dss__corner--bl" aria-hidden="true" />
          <span class="dss__corner dss__corner--br" aria-hidden="true" />
          <div class="dss__scan" aria-hidden="true" />

          <header class="dss__head">
            <div class="dss__brand">
              <span class="dss__mark" aria-hidden="true" />
              <div>
                <p class="dss__eyebrow">
                  {{
                    mode === 'platform'
                      ? `测控 · ${userLabel || 'LIVE'}`
                      : '访客 · GUIDE'
                  }}
                </p>
                <h3 class="dss__title">深空精灵</h3>
              </div>
            </div>
            <div class="dss__head-actions">
              <button
                v-if="mode === 'platform'"
                type="button"
                class="dss__icon-btn"
                :disabled="busy || clearing"
                title="清除聊天记录"
                aria-label="清除聊天记录"
                @click="clearHistory">
                清除
              </button>
              <button type="button" class="dss__x" aria-label="关闭" @click="open = false" />
            </div>
          </header>

          <div v-if="mode === 'platform'" class="dss__meta">
            <div class="dss__chips">
              <span v-if="!modules.length" class="dss__chip dss__chip--warn">暂无系统模块</span>
              <span v-for="m in modules" :key="m" class="dss__chip">{{ moduleLabel(m) }}</span>
            </div>
            <p
              v-if="historyHint"
              class="dss__save-hint"
              :class="historySaveState === 'fail' && 'is-fail'">
              {{ historyHint }}
            </p>
          </div>
          <p v-else class="dss__hint">访客模式：解答工具操作步骤。登录后可分析本系统数据，并保存对话。</p>

          <div ref="logRef" class="dss__log">
            <div
              v-for="(m, i) in messages"
              :key="i"
              class="dss__msg"
              :class="[
                `is-${m.role}`,
                streaming && i === messages.length - 1 && m.role === 'assistant' && 'is-stream',
              ]">
              <span class="dss__msg-role">{{ m.role === 'user' ? userBubbleLabel : '精灵' }}</span>
              <p>
                {{ m.content }}<span
                  v-if="streaming && i === messages.length - 1 && m.role === 'assistant'"
                  class="dss__caret"
                  aria-hidden="true" />
              </p>
            </div>
            <div v-if="busy && !streaming" class="dss__msg is-assistant is-busy">
              <span class="dss__pulse" />
              深度演算中…
            </div>
          </div>

          <p v-if="error" class="dss__err">{{ error }}</p>
          <p v-if="lastTools.length" class="dss__tools">探针 · {{ lastTools.join(' · ') }}</p>

          <form class="dss__form" @submit.prevent="send">
            <textarea
              v-model="draft"
              class="dss__input"
              rows="3"
              :placeholder="placeholder"
              :disabled="busy"
              @keydown.enter.exact.prevent="send" />
            <div class="dss__actions">
              <label v-if="mode === 'platform'" class="dss__web">
                <input v-model="enableWeb" type="checkbox" />
                联网线索
              </label>
              <button
                v-if="showLoginCta"
                type="button"
                class="dss__btn dss__btn--accent"
                @click="openLogin = true">
                登录系统
              </button>
              <button type="submit" class="dss__btn" :disabled="busy || !draft.trim()">发射</button>
            </div>
          </form>
        </div>
      </Transition>

      <IamLoginModal
        v-if="mode === 'tools'"
        v-model:open="openLogin"
        @success="onLoginOk"
        @close="openLogin = false" />
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import {
  appendSpriteHistory,
  clearSpriteHistory,
  loadSpriteHistory,
  streamConsoleSprite,
  streamToolsSprite,
  type SpriteChatMessage,
} from '~/utils/sprite/api'
import { SpriteCharacterScene } from '~/utils/sprite/SpriteCharacterScene'

const props = withDefaults(
  defineProps<{ track?: 'auto' | 'tools' | 'platform' }>(),
  { track: 'auto' },
)

const route = useRoute()
const auth = useAuthStore()

const open = ref(false)
const openLogin = ref(false)
const draft = ref('')
const busy = ref(false)
const streaming = ref(false)
const clearing = ref(false)
const historyReady = ref(false)
/** ok | fail | '' — 保存状态提示 */
const historySaveState = ref<'ok' | 'fail' | ''>('')
const error = ref('')
const enableWeb = ref(false)
const showLoginCta = ref(false)
const lastTools = ref<string[]>([])
const logRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const messages = ref<SpriteChatMessage[]>([])
let abortCtrl: AbortController | null = null
let scene: SpriteCharacterScene | null = null
let loadToken = 0

const mode = computed<'tools' | 'platform'>(() => {
  if (props.track === 'tools' || props.track === 'platform') return props.track
  return auth.isLoggedIn ? 'platform' : 'tools'
})

const modules = computed(() =>
  mode.value !== 'platform'
    ? ([] as string[])
    : [...auth.unlockedModules].filter((m) => m && m !== 'ACCOUNT').sort(),
)

const userLabel = computed(() => auth.displayLabel || '')

const userBubbleLabel = computed(() => (mode.value === 'platform' ? '系统用户' : '我'))

const historyHint = computed(() => {
  if (mode.value !== 'platform') return ''
  if (!historyReady.value) return '对话同步中…'
  if (historySaveState.value === 'fail') return '最近一轮未保存，请稍后重试'
  return '对话自动保存 · 可清除'
})

const MAX_CONTENT = 4000
const WELCOME_MARKERS = [
  '已接入系统精灵',
  '你好，我是深空精灵',
] as const

function clipContent(text: string) {
  return text.length > MAX_CONTENT ? text.slice(0, MAX_CONTENT) : text
}

function isWelcomeMessage(m: SpriteChatMessage) {
  if (m.role !== 'assistant') return false
  return WELCOME_MARKERS.some((p) => m.content.startsWith(p))
}

/** 发给 LLM：去掉欢迎语，并截断单条长度 */
function buildLlmHistory(all: SpriteChatMessage[]) {
  return all
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => !isWelcomeMessage(m))
    .map((m) => ({ role: m.role, content: clipContent(m.content) }))
    .slice(0, -1)
    .slice(-12)
}

const placeholder = computed(() =>
  mode.value === 'platform'
    ? '例如：未确认报警有几条？该如何保养？'
    : '例如：软包装 3D 怎么上传分析？',
)

const MODULE_LABELS: Record<string, string> = {
  FIELDPULSE: '工脉',
  FINANCE: '财务',
  PACK3D: '包装',
}

function moduleLabel(code: string) {
  return MODULE_LABELS[code] || code
}

function welcome(m: 'tools' | 'platform') {
  return m === 'platform'
    ? '已接入系统精灵。可在权限内协助操作步骤，只读分析本系统数据；需要时可勾选联网线索。对话会自动保存，可随时清除。'
    : '你好，我是深空精灵。问我首页工具怎么用即可；登录后可协助分析本系统数据。'
}

function resetWelcome() {
  abortCtrl?.abort()
  abortCtrl = null
  busy.value = false
  streaming.value = false
  messages.value = [{ role: 'assistant', content: welcome(mode.value) }]
  lastTools.value = []
  showLoginCta.value = false
  error.value = ''
  historySaveState.value = ''
}

async function hydrateHistory() {
  const token = ++loadToken
  if (mode.value !== 'platform' || !auth.isLoggedIn) {
    historyReady.value = true
    resetWelcome()
    return
  }
  historyReady.value = false
  resetWelcome()
  try {
    const data = await loadSpriteHistory()
    if (token !== loadToken) return
    const rows = (data?.messages || []).filter(
      (m) => (m.role === 'user' || m.role === 'assistant') && m.content?.trim(),
    )
    if (rows.length) {
      messages.value = rows
    }
  } catch {
    // 历史接口不可用时降级欢迎语，避免把「服务器内部错误」顶到对话区
    if (token !== loadToken) return
  } finally {
    if (token === loadToken) historyReady.value = true
    await nextTick()
    scrollBottom()
  }
}

watch(mode, (m) => {
  scene?.setPalette(m)
  void hydrateHistory()
})

function toggleOpen() {
  open.value = !open.value
  if (open.value) {
    nextTick(() => scrollBottom())
  }
}

function onFabHover(on: boolean) {
  scene?.setHover(on)
}

function scrollBottom() {
  const el = logRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function persistTurn(userText: string, assistantText: string) {
  if (mode.value !== 'platform' || !auth.isLoggedIn) return
  const payload: SpriteChatMessage[] = [
    { role: 'user', content: clipContent(userText) },
    { role: 'assistant', content: clipContent(assistantText) },
  ]
  try {
    await appendSpriteHistory(payload)
    historySaveState.value = 'ok'
  } catch {
    historySaveState.value = 'fail'
  }
}

async function clearHistory() {
  if (mode.value !== 'platform' || clearing.value || busy.value) return
  if (!confirm('清除当前聊天记录？记录将软删除，界面恢复欢迎语。')) return
  clearing.value = true
  error.value = ''
  try {
    await clearSpriteHistory()
    resetWelcome()
    historyReady.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    clearing.value = false
    await nextTick()
    scrollBottom()
  }
}

async function send() {
  const text = draft.value.trim()
  if (!text || busy.value) return

  error.value = ''
  showLoginCta.value = false
  messages.value.push({ role: 'user', content: text })
  draft.value = ''
  busy.value = true
  streaming.value = false
  messages.value.push({ role: 'assistant', content: '' })
  const idx = messages.value.length - 1
  await nextTick()
  scrollBottom()

  abortCtrl?.abort()
  abortCtrl = new AbortController()
  const history = buildLlmHistory(messages.value)

  let gotDelta = false
  let streamError = ''
  const handlers = {
    onMeta: (meta: { refused?: boolean; cta?: string | null; toolsUsed?: string[] }) => {
      lastTools.value = meta.toolsUsed || []
      if (meta.cta === 'LOGIN' || meta.refused) showLoginCta.value = true
    },
    onDelta: (piece: string) => {
      if (!gotDelta) {
        gotDelta = true
        streaming.value = true
      }
      const cur = messages.value[idx]
      if (cur) cur.content += piece
      scrollBottom()
    },
    onDone: () => {},
    onError: (msg: string) => {
      streamError = msg
    },
  }

  try {
    if (mode.value === 'platform') {
      await streamConsoleSprite(
        { messages: history, pagePath: route.path, enableWeb: enableWeb.value },
        handlers,
        abortCtrl.signal,
      )
    } else {
      await streamToolsSprite(
        { messages: history, pagePath: route.path },
        handlers,
        abortCtrl.signal,
      )
    }
    const cur = messages.value[idx]
    if (streamError) {
      error.value = streamError
      if (cur && !cur.content) messages.value.splice(idx, 1)
    } else if (cur && !cur.content.trim()) {
      cur.content = '（无回复）'
    } else if (cur?.content?.trim()) {
      await persistTurn(text, cur.content.trim())
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') {
      if (messages.value[idx] && !messages.value[idx].content.trim()) {
        messages.value.splice(idx, 1)
      } else if (messages.value[idx]) {
        messages.value.splice(idx, 1)
        if (messages.value.length && messages.value[messages.value.length - 1]?.role === 'user') {
          const lastUser = messages.value[messages.value.length - 1]
          if (lastUser?.content === text) messages.value.pop()
        }
      }
      return
    }
    error.value = e instanceof Error ? e.message : String(e)
    if (messages.value[idx] && !messages.value[idx].content) messages.value.splice(idx, 1)
  } finally {
    busy.value = false
    streaming.value = false
    abortCtrl = null
    await nextTick()
    scrollBottom()
  }
}

async function onLoginOk() {
  openLogin.value = false
  showLoginCta.value = false
  auth.hydrate()
  await hydrateHistory()
}

onMounted(async () => {
  auth.hydrate()
  await hydrateHistory()
  await nextTick()
  if (stageRef.value) {
    scene = new SpriteCharacterScene(stageRef.value)
    scene.setPalette(mode.value)
  }
})

onBeforeUnmount(() => {
  abortCtrl?.abort()
  scene?.dispose()
  scene = null
})
</script>

<style scoped lang="scss">
.dss {
  --cyan: #5eead4;
  --ice: #a5f3fc;
  --panel: rgba(3, 10, 18, 0.96);
  --stroke: rgba(94, 234, 212, 0.32);
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 240;
  font-family: 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif;
}

.dss__fab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: #ecfeff;
  cursor: pointer;
  transition: transform 0.25s ease;

  &:hover {
    transform: translateY(-3px);
  }
}

.dss__stage {
  display: block;
  width: 7.6rem;
  height: 8.8rem;
  pointer-events: none;
}

.dss__fab-label {
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  color: #e2e8f0;
  text-shadow:
    0 0 14px rgba(94, 234, 212, 0.55),
    0 2px 8px rgba(0, 0, 0, 0.65);
}

.dss__panel {
  position: absolute;
  right: 0;
  bottom: 10rem;
  width: min(36rem, calc(100vw - 1.2rem));
  height: min(78dvh, 42rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: 0.35rem;
  color: #e2e8f0;
  background:
    radial-gradient(90% 60% at 50% 0%, rgba(34, 120, 150, 0.16), transparent 55%),
    radial-gradient(70% 50% at 100% 100%, rgba(45, 212, 191, 0.06), transparent 50%),
    linear-gradient(180deg, rgba(8, 20, 34, 0.98), var(--panel));
  box-shadow:
    0 0 0 1px var(--stroke),
    0 0 28px rgba(45, 212, 191, 0.12),
    0 28px 70px rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(18px);
}

.dss__corner {
  position: absolute;
  width: 0.85rem;
  height: 0.85rem;
  pointer-events: none;
  z-index: 2;
  border-color: rgba(94, 234, 212, 0.7);
  border-style: solid;
  border-width: 0;
  &--tl {
    top: 0.35rem;
    left: 0.35rem;
    border-top-width: 1.5px;
    border-left-width: 1.5px;
  }
  &--tr {
    top: 0.35rem;
    right: 0.35rem;
    border-top-width: 1.5px;
    border-right-width: 1.5px;
  }
  &--bl {
    bottom: 0.35rem;
    left: 0.35rem;
    border-bottom-width: 1.5px;
    border-left-width: 1.5px;
  }
  &--br {
    bottom: 0.35rem;
    right: 0.35rem;
    border-bottom-width: 1.5px;
    border-right-width: 1.5px;
  }
}

.dss__scan {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.22;
  background:
    linear-gradient(rgba(94, 234, 212, 0.04) 1px, transparent 1px) 0 0 / 100% 28px,
    linear-gradient(90deg, rgba(94, 234, 212, 0.03) 1px, transparent 1px) 0 0 / 28px 100%;
  mask-image: linear-gradient(180deg, #000 0%, transparent 88%);
}

.dss__head,
.dss__meta,
.dss__hint,
.dss__log,
.dss__err,
.dss__tools,
.dss__form {
  position: relative;
  z-index: 1;
}

.dss__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  padding: 1rem 1.05rem 0.7rem;
  border-bottom: 1px solid rgba(94, 234, 212, 0.1);
}
.dss__brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}
.dss__mark {
  width: 0.72rem;
  height: 0.72rem;
  flex-shrink: 0;
  border-radius: 50%;
  background: radial-gradient(circle, #ecfeff, var(--cyan));
  box-shadow: 0 0 14px var(--cyan);
  animation: dss-breathe 1.6s ease-in-out infinite;
}
.dss__eyebrow {
  margin: 0;
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(165, 243, 252, 0.78);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 14rem;
}
.dss__title {
  margin: 0.12rem 0 0;
  font-size: 1.08rem;
  font-weight: 650;
  letter-spacing: 0.12em;
  color: #f8fafc;
  text-shadow: 0 0 18px rgba(94, 234, 212, 0.2);
}
.dss__head-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}
.dss__icon-btn {
  height: 1.7rem;
  padding: 0 0.7rem;
  border-radius: 0.2rem;
  border: 1px solid rgba(94, 234, 212, 0.28);
  background: rgba(8, 30, 42, 0.65);
  color: #99f6e4;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  cursor: pointer;
  box-shadow: 0 0 12px rgba(45, 212, 191, 0.08);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, color 0.15s ease;
  &:hover:not(:disabled) {
    border-color: rgba(94, 234, 212, 0.55);
    color: #ecfeff;
    box-shadow: 0 0 16px rgba(45, 212, 191, 0.22);
  }
  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
.dss__x {
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 0.2rem;
  border: 1px solid rgba(94, 234, 212, 0.2);
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  position: relative;
  &::before,
  &::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0.65rem;
    height: 1.5px;
    background: #94a3b8;
  }
  &::before {
    transform: translate(-50%, -50%) rotate(45deg);
  }
  &::after {
    transform: translate(-50%, -50%) rotate(-45deg);
  }
  &:hover {
    border-color: rgba(94, 234, 212, 0.45);
  }
}

.dss__hint,
.dss__meta {
  padding: 0.45rem 1.05rem 0.55rem;
  font-size: 0.68rem;
  color: #94a3b8;
  line-height: 1.45;
}
.dss__meta {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  border-bottom: 1px solid rgba(94, 234, 212, 0.08);
}
.dss__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.dss__save-hint {
  margin: 0;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: #64748b;
  &.is-fail {
    color: #fcd34d;
  }
}
.dss__chip {
  border-radius: 0.15rem;
  border: 1px solid rgba(165, 243, 252, 0.3);
  background: rgba(45, 212, 191, 0.08);
  color: #99f6e4;
  padding: 0.12rem 0.52rem;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
}
.dss__chip--warn {
  border-color: rgba(251, 191, 36, 0.4);
  background: rgba(245, 158, 11, 0.1);
  color: #fcd34d;
}

.dss__log {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0.8rem 1.05rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  scrollbar-width: thin;
  scrollbar-color: rgba(94, 234, 212, 0.35) transparent;
}

.dss__msg {
  max-width: 92%;
  padding: 0.55rem 0.8rem 0.65rem;
  border-radius: 0.25rem;
  font-size: 0.82rem;
  line-height: 1.55;
  p {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
  &.is-user {
    align-self: flex-end;
    background: linear-gradient(135deg, rgba(45, 212, 191, 0.22), rgba(14, 116, 144, 0.16));
    box-shadow:
      inset 0 0 0 1px rgba(94, 234, 212, 0.35),
      0 0 18px rgba(45, 212, 191, 0.08);
    color: #ecfeff;
  }
  &.is-assistant {
    align-self: flex-start;
    background: rgba(8, 24, 40, 0.72);
    box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.14);
  }
  &.is-stream {
    box-shadow:
      inset 0 0 0 1px rgba(94, 234, 212, 0.4),
      0 0 16px rgba(45, 212, 191, 0.1);
  }
  &.is-busy {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: #94a3b8;
    font-style: italic;
  }
}
.dss__msg-role {
  display: block;
  margin-bottom: 0.22rem;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}
.dss__msg.is-user .dss__msg-role {
  text-align: right;
  color: rgba(165, 243, 252, 0.8);
}
.dss__msg.is-assistant .dss__msg-role {
  color: rgba(148, 163, 184, 0.9);
}

.dss__caret {
  display: inline-block;
  width: 0.4em;
  height: 1em;
  margin-left: 0.06em;
  vertical-align: -0.12em;
  background: var(--cyan);
  box-shadow: 0 0 8px var(--cyan);
  animation: dss-caret 0.85s steps(1) infinite;
}
.dss__pulse {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 10px var(--cyan);
  animation: dss-breathe 1.1s ease-in-out infinite;
}

.dss__err {
  margin: 0;
  padding: 0 1.05rem;
  color: #fcd34d;
  font-size: 0.72rem;
}
.dss__tools {
  margin: 0;
  padding: 0 1.05rem 0.2rem;
  color: #64748b;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
}

.dss__form {
  padding: 0.7rem 1rem 1rem;
  border-top: 1px solid rgba(94, 234, 212, 0.1);
  background: linear-gradient(180deg, rgba(2, 10, 18, 0.2), rgba(2, 10, 18, 0.55));
}
.dss__input {
  width: 100%;
  resize: none;
  border-radius: 0.25rem;
  border: 1px solid rgba(94, 234, 212, 0.2);
  background: rgba(0, 10, 20, 0.55);
  color: #e2e8f0;
  padding: 0.65rem 0.75rem;
  font-size: 0.82rem;
  line-height: 1.45;
  outline: none;
  &:focus {
    border-color: rgba(94, 234, 212, 0.55);
    box-shadow:
      0 0 0 1px rgba(45, 212, 191, 0.2),
      0 0 18px rgba(45, 212, 191, 0.12);
  }
}
.dss__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
  margin-top: 0.55rem;
}
.dss__web {
  margin-right: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  font-size: 0.7rem;
  color: #94a3b8;
  cursor: pointer;
}
.dss__btn {
  border-radius: 0.2rem;
  border: 1px solid rgba(94, 234, 212, 0.55);
  background: rgba(8, 40, 52, 0.75);
  color: #5eead4;
  padding: 0.42rem 1.05rem;
  font-size: 0.74rem;
  letter-spacing: 0.16em;
  cursor: pointer;
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.08),
    0 0 18px rgba(45, 212, 191, 0.22);
  transition: box-shadow 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  &:hover:not(:disabled) {
    color: #ecfeff;
    border-color: rgba(165, 243, 252, 0.75);
    box-shadow: 0 0 24px rgba(45, 212, 191, 0.35);
  }
  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }
  &--accent {
    border-color: rgba(94, 234, 212, 0.45);
    background: rgba(12, 48, 58, 0.85);
    color: #a5f3fc;
  }
}

.dss-pop-enter-active,
.dss-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.dss-pop-enter-from,
.dss-pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

@keyframes dss-breathe {
  0%,
  100% {
    opacity: 0.7;
    transform: scale(0.96);
  }
  50% {
    opacity: 1;
    transform: scale(1.04);
  }
}
@keyframes dss-caret {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}

@media (max-width: 480px) {
  .dss__panel {
    width: calc(100vw - 0.8rem);
    height: min(82dvh, 40rem);
    right: -0.2rem;
  }
}
</style>
