<template>
  <div class="draw-page">
    <header class="topbar">
      <RouterLink class="back" to="/">← 返回</RouterLink>
      <h1>你画我猜</h1>
      <div v-if="phase !== 'idle'" class="scoreboard">
        <span>画者 {{ drawerScore }}</span>
        <span>猜者 {{ guesserScore }}</span>
        <span>第 {{ round }} / {{ maxRounds }} 轮</span>
        <span v-if="roomCode" class="room-tag">房间 {{ roomCode }}</span>
      </div>
    </header>

    <!-- 开始 -->
    <section v-if="phase === 'idle'" class="panel idle-panel">
      <p class="lead">画者在一台设备「创建房间」，猜者在另一台「加入房间」，即可实时同步画板。</p>
      <p v-if="playMode === 'solo'" class="solo-warn">
        同屏模式仅适合<strong>同一台设备</strong>切换角色，两个浏览器标签页之间<strong>不会同步</strong>。
      </p>
      <ul class="rules">
        <li>双人联机：A 创建房间 → B 加入房间（输入 6 位房间号）</li>
        <li>每轮 {{ ROUND_SECONDS }} 秒，猜对猜者 +10 / 画者 +5</li>
        <li>同屏模式：一人画完再切「猜者」猜词</li>
      </ul>

      <div class="mode-tabs">
        <button type="button" :class="{ active: playMode === 'host' }" @click="playMode = 'host'">
          创建房间（画者）
        </button>
        <button type="button" :class="{ active: playMode === 'guest' }" @click="playMode = 'guest'">
          加入房间（猜者）
        </button>
        <button type="button" :class="{ active: playMode === 'solo' }" @click="playMode = 'solo'">
          同屏模式
        </button>
      </div>

      <label v-if="playMode === 'guest'" class="room-input">
        房间号
        <input v-model="joinCode" type="text" maxlength="6" placeholder="6 位数字" inputmode="numeric" />
      </label>

      <label class="round-picker">
        轮数
        <select v-model.number="maxRounds">
          <option :value="5">5 轮</option>
          <option :value="8">8 轮</option>
          <option :value="10">10 轮</option>
        </select>
      </label>

      <p v-if="connectError" class="error-text">{{ connectError }}</p>

      <button class="btn-primary" type="button" :disabled="connecting" @click="startGame">
        {{ connecting ? '连接中…' : playMode === 'host' ? '创建并开始' : playMode === 'guest' ? '加入房间' : '开始游戏' }}
      </button>
    </section>

    <!-- 进行中 -->
    <section v-else-if="phase === 'playing'" class="game-layout">
      <aside class="side-panel">
        <div v-if="playMode === 'solo'" class="role-switch">
          <button
            type="button"
            :class="{ active: role === 'drawer' }"
            @click="role = 'drawer'"
          >
            我是画者
          </button>
          <button
            type="button"
            :class="{ active: role === 'guesser' }"
            @click="role = 'guesser'"
          >
            我是猜者
          </button>
        </div>

        <p v-else class="role-badge">
          {{ role === 'drawer' ? '画者（本局作画）' : '猜者（观看并猜测）' }}
        </p>

        <p v-if="playMode === 'host' && roomCode" class="room-share">
          邀请猜者加入：<strong>{{ roomCode }}</strong>
          <button type="button" class="copy-link" @click="copyInviteLink">复制邀请链接</button>
        </p>

        <p v-if="playMode !== 'solo'" class="sync-status" :class="syncStatusClass">
          {{ syncStatusText }}
        </p>

        <div class="word-card">
          <p class="word-label">{{ role === 'drawer' ? '请画' : '请猜' }}</p>
          <p class="word-text">{{ role === 'drawer' ? currentWord : '???' }}</p>
        </div>

        <p class="timer" :class="{ urgent: timeLeft <= 10 }">{{ timeLeft }}s</p>

        <div v-if="role === 'drawer'" class="tools">
          <div class="colors">
            <button
              v-for="c in colors"
              :key="c"
              type="button"
              class="color-dot"
              :class="{ active: strokeColor === c && !eraser }"
              :style="{ background: c }"
              @click="pickColor(c)"
            />
          </div>
          <div class="tool-row">
            <button type="button" :class="{ active: eraser }" @click="eraser = true">橡皮</button>
            <button type="button" @click="undoStroke">撤销</button>
            <button type="button" @click="clearCanvas">清空</button>
          </div>
          <label class="size-slider">
            粗细 {{ lineWidth }}
            <input v-model.number="lineWidth" type="range" min="2" max="16" step="1" />
          </label>
          <button v-if="playMode !== 'guest'" class="btn-ghost" type="button" @click="skipRound">
            跳过此题
          </button>
        </div>

        <form v-else class="guess-form" @submit.prevent="submitGuess">
          <input
            v-model="guessInput"
            type="text"
            placeholder="输入你的猜测…"
            autocomplete="off"
          />
          <button class="btn-primary" type="submit">提交</button>
        </form>

        <p v-if="feedback" class="feedback">{{ feedback }}</p>
      </aside>

      <div class="canvas-wrap">
        <DrawCanvas
          ref="canvasRef"
          v-model:strokes="strokes"
          :preview-stroke="remoteActiveStroke"
          :color="strokeColor"
          :line-width="lineWidth"
          :eraser="eraser"
          :readonly="role !== 'drawer'"
          @progress="onDrawProgress"
        />
        <p v-if="role === 'guesser'" class="canvas-hint">观看画者作品，在左侧输入猜测</p>
        <p v-else-if="playMode === 'solo'" class="canvas-hint">画完后可切换「猜者」在同一屏幕猜词</p>
      </div>
    </section>

    <!-- 单轮结束 -->
    <section v-else-if="phase === 'roundEnd'" class="panel result-panel">
      <p class="result-title">{{ lastResult?.guessed ? '猜对了！' : lastResult?.skipped ? '已跳过' : '时间到' }}</p>
      <p class="result-word">答案：{{ lastResult?.word }}</p>
      <p class="result-score">画者 {{ drawerScore }} · 猜者 {{ guesserScore }}</p>
      <button v-if="playMode !== 'guest'" class="btn-primary" type="button" @click="nextRound">
        {{ round >= maxRounds ? '查看结算' : '下一轮' }}
      </button>
      <p v-else class="wait-host">等待画者开始下一轮…</p>
    </section>

    <!-- 总结 -->
    <section v-else class="panel result-panel">
      <p class="result-title">游戏结束</p>
      <p class="result-score">画者 {{ drawerScore }} · 猜者 {{ guesserScore }}</p>
      <p class="final-winner">
        {{ drawerScore === guesserScore ? '平局！' : drawerScore > guesserScore ? '画者胜' : '猜者胜' }}
      </p>
      <button v-if="playMode !== 'guest'" class="btn-primary" type="button" @click="startGame">
        再来一局
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import DrawCanvas from '@/components/draw/DrawCanvas.vue'
import {
  pickRandomWord,
  isGuessCorrect,
  ROUND_SECONDS,
} from '@/draw/words'
import { createDrawSync } from '@/draw/sync'
import type { DrawSyncHandle, DrawSyncStatus } from '@/draw/sync'
import type {
  DrawPhase,
  DrawRole,
  DrawRoundResult,
  DrawStroke,
  DrawSyncMessage,
  DrawSyncState,
} from '@/draw/types'

const colors = ['#e8f4ff', '#66ccff', '#ff6b9d', '#ffe066', '#7bed9f', '#ffffff']

const playMode = ref<'solo' | 'host' | 'guest'>('host')
const joinCode = ref('')
const roomCode = ref<string | null>(null)
const connecting = ref(false)
const connectError = ref('')

const phase = ref<DrawPhase>('idle')
const role = ref<DrawRole>('drawer')
const maxRounds = ref(8)
const round = ref(1)
const drawerScore = ref(0)
const guesserScore = ref(0)
const currentWord = ref('')
const timeLeft = ref(ROUND_SECONDS)
const guessInput = ref('')
const feedback = ref('')
const lastResult = ref<DrawRoundResult | null>(null)
const strokes = ref<DrawStroke[]>([])
const activeStroke = ref<DrawStroke | null>(null)
const remoteActiveStroke = ref<DrawStroke | null>(null)
const syncStatus = ref<DrawSyncStatus>({
  connected: false,
  guestOnline: false,
  hostOnline: false,
})

const strokeColor = ref(colors[0])
const lineWidth = ref(5)
const eraser = ref(false)

const canvasRef = ref<InstanceType<typeof DrawCanvas>>()
const usedWords = new Set<string>()
let timerId = 0
let sync: DrawSyncHandle | null = null
let broadcastTimer = 0

const syncStatusText = computed(() => {
  if (playMode.value === 'solo') return ''
  if (playMode.value === 'host') {
    if (!syncStatus.value.connected) return '同步服务未连接，请确认已部署 draw-sync'
    return syncStatus.value.guestOnline ? '猜者已连接，绘画实时同步中' : '等待猜者加入房间…'
  }
  if (!syncStatus.value.connected) return '无法连接房间，请确认房间号与网络'
  return syncStatus.value.hostOnline ? '已连接，正在同步画板' : '等待画者开始…'
})

const syncStatusClass = computed(() => {
  if (playMode.value === 'solo') return ''
  if (!syncStatus.value.connected) return 'bad'
  if (playMode.value === 'host' && !syncStatus.value.guestOnline) return 'wait'
  return 'ok'
})

const inviteLink = computed(() => {
  if (!roomCode.value) return ''
  const url = new URL(window.location.href)
  url.searchParams.set('join', roomCode.value)
  return url.toString()
})

function copyInviteLink() {
  if (!inviteLink.value) return
  void navigator.clipboard.writeText(inviteLink.value).then(() => {
    feedback.value = '邀请链接已复制，发给猜者打开即可'
  })
}

onMounted(() => {
  const join = new URLSearchParams(window.location.search).get('join')
  if (join && /^\d{6}$/.test(join)) {
    playMode.value = 'guest'
    joinCode.value = join
  }
})

function pickColor(c: string) {
  strokeColor.value = c
  eraser.value = false
}

function clearTimer() {
  window.clearInterval(timerId)
  timerId = 0
}

function buildSyncState(): DrawSyncState {
  return {
    strokes: strokes.value,
    activeStroke: activeStroke.value,
    phase: phase.value,
    round: round.value,
    maxRounds: maxRounds.value,
    drawerScore: drawerScore.value,
    guesserScore: guesserScore.value,
    timeLeft: timeLeft.value,
    word: phase.value === 'roundEnd' ? currentWord.value : undefined,
    lastResult: lastResult.value,
  }
}

function scheduleBroadcast() {
  if (playMode.value === 'solo' || !sync || playMode.value !== 'host') return
  if (broadcastTimer) return
  broadcastTimer = window.setTimeout(() => {
    broadcastTimer = 0
    sync?.send({ type: 'full', state: buildSyncState() })
  }, 60)
}

function broadcastFull() {
  if (playMode.value === 'solo' || !sync) return
  sync.send({ type: 'full', state: buildSyncState() })
}

function applyRemoteState(state: DrawSyncState) {
  strokes.value = state.strokes
  remoteActiveStroke.value = state.activeStroke ?? null
  phase.value = state.phase
  round.value = state.round
  maxRounds.value = state.maxRounds
  drawerScore.value = state.drawerScore
  guesserScore.value = state.guesserScore
  timeLeft.value = state.timeLeft
  lastResult.value = state.lastResult ?? null

  if (playMode.value === 'guest' && state.phase === 'roundEnd' && state.word) {
    currentWord.value = state.word
  }
}

function handleSyncMessage(msg: DrawSyncMessage) {
  if (playMode.value === 'solo') return

  if (msg.type === 'full') {
    applyRemoteState(msg.state)
    return
  }

  if (msg.type === 'guess' && playMode.value === 'host') {
    if (isGuessCorrect(msg.text, currentWord.value)) {
      feedback.value = '猜者猜对了！'
      endRound(true, false)
    }
  }
}

function startTimer() {
  clearTimer()
  if (playMode.value === 'guest') return

  timeLeft.value = ROUND_SECONDS
  timerId = window.setInterval(() => {
    timeLeft.value -= 1
    broadcastFull()
    if (timeLeft.value <= 0) {
      endRound(false, false)
    }
  }, 1000)
}

function onDrawProgress(stroke: DrawStroke | null) {
  if (role.value !== 'drawer' || playMode.value !== 'host') return
  activeStroke.value = stroke
  scheduleBroadcast()
}

function startRound() {
  feedback.value = ''
  guessInput.value = ''
  currentWord.value = pickRandomWord(usedWords)
  usedWords.add(currentWord.value)
  phase.value = 'playing'
  strokes.value = []
  activeStroke.value = null
  remoteActiveStroke.value = null

  nextTick(() => {
    canvasRef.value?.resetCanvas()
    canvasRef.value?.resize()
    startTimer()
    broadcastFull()
  })
}

async function startGame() {
  connectError.value = ''
  connecting.value = true

  try {
    sync?.dispose()
    sync = null
    roomCode.value = null

    if (playMode.value === 'guest') {
      const code = joinCode.value.trim()
      if (!/^\d{6}$/.test(code)) {
        connectError.value = '请输入 6 位房间号'
        return
      }
      sync = await createDrawSync('guest', code, handleSyncMessage, (status) => {
        syncStatus.value = status
      })
      roomCode.value = code
      role.value = 'guesser'
      phase.value = 'playing'
    } else if (playMode.value === 'host') {
      sync = await createDrawSync('host', null, handleSyncMessage, (status) => {
        syncStatus.value = status
      })
      roomCode.value = sync.roomCode
      role.value = 'drawer'
      clearTimer()
      usedWords.clear()
      round.value = 1
      drawerScore.value = 0
      guesserScore.value = 0
      lastResult.value = null
      startRound()
    } else {
      sync = await createDrawSync('solo', null, handleSyncMessage)
      role.value = 'drawer'
      clearTimer()
      usedWords.clear()
      round.value = 1
      drawerScore.value = 0
      guesserScore.value = 0
      lastResult.value = null
      startRound()
    }
  } catch {
    connectError.value =
      playMode.value === 'guest'
        ? '无法加入房间，请确认房间号正确且画者已开房'
        : '连接失败，请检查网络后重试'
  } finally {
    connecting.value = false
  }
}

function endRound(guessed: boolean, skipped: boolean) {
  clearTimer()
  lastResult.value = { word: currentWord.value, guessed, skipped }
  if (guessed) {
    drawerScore.value += 5
    guesserScore.value += 10
  }
  phase.value = 'roundEnd'
  broadcastFull()
}

function submitGuess() {
  if (!guessInput.value.trim()) return

  if (playMode.value === 'guest') {
    sync?.send({ type: 'guess', text: guessInput.value })
    feedback.value = '已提交，等待画者确认…'
    guessInput.value = ''
    return
  }

  const correct = isGuessCorrect(guessInput.value, currentWord.value)

  if (correct) {
    feedback.value = '正确！'
    endRound(true, false)
  } else {
    feedback.value = '不对，再试试'
    guessInput.value = ''
  }
}

function skipRound() {
  endRound(false, true)
}

function nextRound() {
  if (round.value >= maxRounds.value) {
    phase.value = 'finished'
    broadcastFull()
    return
  }
  round.value += 1
  startRound()
}

function undoStroke() {
  if (strokes.value.length === 0) return
  strokes.value = strokes.value.slice(0, -1)
  broadcastFull()
}

function clearCanvas() {
  strokes.value = []
  activeStroke.value = null
  broadcastFull()
}

watch(strokes, () => {
  scheduleBroadcast()
}, { deep: true })

watch(
  () => syncStatus.value.guestOnline,
  (online, wasOnline) => {
    if (online && !wasOnline && playMode.value === 'host') {
      broadcastFull()
    }
  },
)

onUnmounted(() => {
  clearTimer()
  if (broadcastTimer) window.clearTimeout(broadcastTimer)
  sync?.dispose()
})
</script>

<style scoped>
.draw-page {
  min-height: 100vh;
  background: #060a12;
  color: #dce8f0;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(6, 10, 18, 0.9);
  backdrop-filter: blur(10px);
}

.topbar h1 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  flex: 1;
}

.back {
  color: rgba(220, 232, 240, 0.7);
  text-decoration: none;
  font-size: 0.8125rem;
}

.scoreboard {
  display: flex;
  gap: 1rem;
  font-size: 0.75rem;
  color: rgba(220, 232, 240, 0.55);
  flex-wrap: wrap;
}

.room-tag {
  color: #66ccff;
}

.panel {
  margin: auto;
  max-width: 420px;
  padding: 2rem 1.5rem;
  text-align: center;
}

.lead {
  line-height: 1.7;
  color: rgba(220, 232, 240, 0.65);
}

.solo-warn {
  margin: 0 0 1rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  background: rgba(255, 107, 157, 0.08);
  border: 1px solid rgba(255, 107, 157, 0.25);
  color: rgba(255, 180, 200, 0.9);
  font-size: 0.8125rem;
  line-height: 1.6;
  text-align: left;
}

.rules {
  text-align: left;
  margin: 1.25rem 0;
  padding-left: 1.25rem;
  line-height: 1.8;
  color: rgba(220, 232, 240, 0.55);
  font-size: 0.875rem;
}

.mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.45rem;
  margin-bottom: 1rem;
}

.mode-tabs button:last-child {
  grid-column: 1 / -1;
}

.mode-tabs button {
  padding: 0.5rem 0.35rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(220, 232, 240, 0.6);
  font-size: 0.75rem;
  cursor: pointer;
}

.mode-tabs button.active {
  border-color: rgba(102, 204, 255, 0.45);
  background: rgba(102, 204, 255, 0.12);
  color: #b8e4ff;
}

.room-input {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  text-align: left;
}

.room-input input {
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-size: 1.125rem;
  letter-spacing: 0.2em;
  text-align: center;
}

.error-text {
  color: #ff6b9d;
  font-size: 0.8125rem;
  margin: 0 0 0.75rem;
}

.round-picker {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  font-size: 0.875rem;
}

.round-picker select {
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
}

.btn-primary {
  padding: 0.75rem 1.75rem;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, #2a5060, #3a3868);
  color: #eef4f8;
  font-size: 0.9375rem;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-ghost {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: transparent;
  color: rgba(220, 232, 240, 0.65);
  cursor: pointer;
}

.game-layout {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(240px, 280px) 1fr;
  gap: 1rem;
  padding: 1rem;
  min-height: 0;
  height: calc(100vh - 56px);
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 14, 24, 0.75);
}

.role-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.role-switch button {
  padding: 0.45rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(220, 232, 240, 0.6);
  font-size: 0.8125rem;
  cursor: pointer;
}

.role-switch button.active {
  border-color: rgba(102, 204, 255, 0.45);
  background: rgba(102, 204, 255, 0.12);
  color: #b8e4ff;
}

.role-badge {
  margin: 0;
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  background: rgba(102, 204, 255, 0.1);
  color: #b8e4ff;
  font-size: 0.8125rem;
  text-align: center;
}

.room-share {
  margin: 0;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px dashed rgba(102, 204, 255, 0.35);
  font-size: 0.8125rem;
  color: rgba(220, 232, 240, 0.65);
  text-align: center;
}

.room-share strong {
  display: block;
  margin-top: 0.25rem;
  font-size: 1.35rem;
  letter-spacing: 0.15em;
  color: #66ccff;
}

.copy-link {
  display: block;
  width: 100%;
  margin-top: 0.55rem;
  padding: 0.4rem;
  border-radius: 6px;
  border: 1px solid rgba(102, 204, 255, 0.35);
  background: rgba(102, 204, 255, 0.08);
  color: #b8e4ff;
  font-size: 0.75rem;
  cursor: pointer;
}

.sync-status {
  margin: 0;
  padding: 0.45rem 0.65rem;
  border-radius: 8px;
  font-size: 0.75rem;
  text-align: center;
}

.sync-status.ok {
  background: rgba(123, 237, 159, 0.1);
  color: #7bed9f;
}

.sync-status.wait {
  background: rgba(255, 224, 102, 0.08);
  color: #ffe066;
}

.sync-status.bad {
  background: rgba(255, 107, 157, 0.1);
  color: #ff6b9d;
}

.word-card {
  padding: 0.85rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  text-align: center;
}

.word-label {
  margin: 0 0 0.35rem;
  font-size: 0.6875rem;
  letter-spacing: 0.12em;
  color: rgba(220, 232, 240, 0.45);
}

.word-text {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #8ab4c4;
}

.timer {
  margin: 0;
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  color: #66ccff;
}

.timer.urgent {
  color: #ff6b9d;
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.color-dot {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
}

.color-dot.active {
  border-color: #fff;
}

.tool-row {
  display: flex;
  gap: 0.45rem;
}

.tool-row button {
  flex: 1;
  padding: 0.4rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(220, 232, 240, 0.7);
  font-size: 0.75rem;
  cursor: pointer;
}

.tool-row button.active {
  border-color: rgba(102, 204, 255, 0.4);
  color: #b8e4ff;
}

.size-slider {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: rgba(220, 232, 240, 0.5);
}

.guess-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.guess-form input {
  padding: 0.65rem 0.85rem;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font-size: 0.9375rem;
}

.feedback {
  margin: 0;
  font-size: 0.8125rem;
  color: #7bed9f;
  text-align: center;
}

.canvas-wrap {
  position: relative;
  min-height: 360px;
  height: 100%;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #0a1018;
  overflow: hidden;
}

.canvas-hint {
  position: absolute;
  bottom: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  font-size: 0.75rem;
  color: rgba(220, 232, 240, 0.35);
  pointer-events: none;
}

.result-panel .result-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.result-word {
  font-size: 1.25rem;
  color: #8ab4c4;
  margin: 0 0 0.75rem;
}

.result-score {
  color: rgba(220, 232, 240, 0.55);
  margin: 0 0 1.25rem;
}

.final-winner {
  font-size: 1.125rem;
  margin: 0 0 1.25rem;
  color: #66ccff;
}

.wait-host {
  color: rgba(220, 232, 240, 0.45);
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .game-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
    height: auto;
    min-height: calc(100vh - 56px);
  }

  .canvas-wrap {
    min-height: 50vh;
  }

  .scoreboard {
    display: none;
  }
}
</style>
