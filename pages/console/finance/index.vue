<template>
  <div class="fin">
    <div class="fin__bg" aria-hidden="true" />

    <header class="fin__nav">
      <button type="button" class="fin__nav-link" @click="router.push('/console')">← 控制台</button>
      <button type="button" class="fin__nav-link" @click="router.push('/')">首页</button>
    </header>

    <main class="fin__main">
      <section class="fin__hero">
        <h1 class="fin__title">财务离线桌面</h1>
        <p class="fin__lead">账做在你自己电脑上，网站只负责登录和下载安装包。</p>
        <ul class="fin__points" aria-label="要点">
          <li>账本数据只保存在本机，不上云</li>
          <li>用现在这个账号就能打开，不用另注册</li>
          <li>装好就能用，不用再配环境</li>
        </ul>
      </section>

      <p v-if="pageError" class="fin__err">{{ pageError }}</p>

      <section class="fin__panel">
        <h2 class="fin__h2">1. 下载安装</h2>
        <p class="fin__hint">选你电脑的系统下载，装好后回来点下面的「打开软件」。</p>

        <div v-if="busy && dlProgress" class="fin__progress-row">
          <div class="fin__progress">{{ dlProgress }}</div>
        </div>
        <p v-if="dlOk" class="fin__ok">{{ dlOk }}</p>
        <p v-if="dlError" class="fin__err">{{ dlError }}</p>

        <div class="fin__downloads">
          <button
            type="button"
            class="fin__dl fin__dl--primary"
            :disabled="busy || !manifest?.macosArtifact"
            @click="onDownload('macos')">
            <span class="fin__dl-os">苹果电脑</span>
            <span class="fin__dl-name">{{ busyPlatform === 'macos' ? '下载中…' : '下载安装包' }}</span>
          </button>
          <button
            type="button"
            class="fin__dl"
            :disabled="busy || !manifest?.windowsArtifact"
            @click="onDownload('windows')">
            <span class="fin__dl-os">Windows</span>
            <span class="fin__dl-name">{{ busyPlatform === 'windows' ? '下载中…' : '下载安装包' }}</span>
          </button>
        </div>

        <ol class="fin__steps">
          <li>
            <strong>Windows</strong>
            ：解压后双击打开软件。若系统拦截，选「仍要运行」。
          </li>
          <li>
            <strong>苹果电脑</strong>
            ：打开安装包，把软件拖到「应用程序」。若提示打不开，右键点软件再选「打开」。
          </li>
        </ol>
      </section>

      <section class="fin__panel fin__panel--focus">
        <h2 class="fin__h2">2. 打开软件</h2>
        <p class="fin__hint">先装好软件，再点这里。有网点一次就行，之后可离线用。</p>
        <FinDesktopActions v-if="canIssueOffline" />
        <p v-else class="fin__err">当前账号还不能用财务桌面，请联系管理员开通。</p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  issueFinanceDesktopDownloadTicket,
  fetchFinanceDesktopManifest,
  startFinanceDesktopNativeDownload,
  type FinanceDesktopManifest,
  type FinanceDesktopPlatform,
} from '~/utils/finance-desktop/distributionApi'
import FinDesktopActions from '~/components/console/finance/FinDesktopActions.vue'

definePageMeta({ layout: false })

const auth = useAuthStore()
const router = useRouter()

const canIssueOffline = computed(() => {
  if (auth.isSuperAdmin) return true
  const mods = auth.profile?.unlockedModules ?? []
  return mods.map((m) => String(m).toUpperCase()).includes('FINANCE')
})

const pageError = ref('')
const manifest = ref<FinanceDesktopManifest | null>(null)
const busy = ref(false)
const busyPlatform = ref<FinanceDesktopPlatform | null>(null)
const dlProgress = ref('')
const dlOk = ref('')
const dlError = ref('')

async function loadManifest() {
  try {
    manifest.value = await fetchFinanceDesktopManifest()
  } catch (e) {
    dlError.value = e instanceof Error ? e.message : '暂时无法获取安装包，请稍后重试'
  }
}

async function onDownload(platform: FinanceDesktopPlatform) {
  busy.value = true
  busyPlatform.value = platform
  dlError.value = ''
  dlOk.value = ''
  dlProgress.value = '正在准备下载…'
  try {
    const ticket = await issueFinanceDesktopDownloadTicket(platform)
    startFinanceDesktopNativeDownload(ticket)
    dlOk.value = `已交给浏览器下载 ${ticket.filename}，请在下载栏查看进度`
    dlProgress.value = ''
  } catch (e) {
    dlError.value = e instanceof Error ? e.message : String(e)
    dlProgress.value = ''
  } finally {
    busy.value = false
    busyPlatform.value = null
  }
}

onMounted(async () => {
  auth.hydrate()
  if (!auth.accessToken) {
    await navigateTo('/?login=1')
    return
  }
  const mods = auth.profile?.unlockedModules ?? []
  if (!auth.isSuperAdmin && !mods.map((m) => m.toUpperCase()).includes('FINANCE')) {
    pageError.value = '当前账号还不能用财务桌面，请联系管理员开通。'
    return
  }
  await loadManifest()
})
</script>

<style scoped lang="scss">
.fin {
  --fin-pad-x: clamp(0.9rem, 3.2vw, 1.5rem);
  --fin-max: min(40rem, 100%);
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  height: 100%;
  max-height: 100dvh;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  color: #e8eef4;
  background: #061018;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.fin__bg {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 45% at 15% -5%, rgba(46, 160, 140, 0.16), transparent 55%),
    linear-gradient(180deg, #0a1820 0%, #061018 45%, #040c12 100%);
}

.fin__nav {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  max-width: var(--fin-max);
  margin: 0 auto;
  padding: calc(1rem + env(safe-area-inset-top, 0px)) var(--fin-pad-x) 0;
  box-sizing: border-box;
}

.fin__nav-link {
  border: none;
  background: transparent;
  color: #7a93a8;
  font-size: 0.82rem;
  cursor: pointer;
  padding: 0.35rem 0;

  &:hover {
    color: #9fd8cc;
  }
}

.fin__main {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: var(--fin-max);
  margin: 0 auto;
  padding: 1.25rem var(--fin-pad-x) 2.75rem;
  box-sizing: border-box;
  display: grid;
  gap: 1rem;
}

.fin__hero {
  margin-bottom: 0.25rem;
}

.fin__title {
  margin: 0;
  font-family: 'Source Serif 4', 'Songti SC', 'Noto Serif SC', Georgia, serif;
  font-size: clamp(1.65rem, 5vw, 2.15rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f4faf8;
  line-height: 1.2;
}

.fin__lead {
  margin: 0.55rem 0 0;
  font-size: clamp(0.95rem, 2.6vw, 1.05rem);
  line-height: 1.55;
  color: #b7c9d4;
}

.fin__points {
  margin: 0.9rem 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.4rem;

  li {
    position: relative;
    padding-left: 0.95rem;
    font-size: 0.9rem;
    line-height: 1.45;
    color: #8aa0ae;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 0.35rem;
      height: 0.35rem;
      border-radius: 50%;
      background: #6ec4b8;
    }
  }
}

.fin__panel {
  min-width: 0;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(10, 22, 30, 0.7);
  padding: clamp(1rem, 2.8vw, 1.25rem);
  box-sizing: border-box;

  &--focus {
    border-color: rgba(159, 216, 204, 0.28);
    background: linear-gradient(165deg, rgba(46, 160, 140, 0.12), rgba(8, 24, 32, 0.65));
  }
}

.fin__h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: #e8f0f4;
}

.fin__hint {
  margin: 0.4rem 0 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #8499a8;
}

.fin__downloads {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.95rem;

  @media (min-width: 520px) {
    grid-template-columns: 1fr 1fr;
  }
}

.fin__dl {
  display: grid;
  gap: 0.15rem;
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(4, 14, 18, 0.55);
  padding: 0.85rem 1rem;
  color: inherit;
  cursor: pointer;

  &:hover:not(:disabled) {
    border-color: rgba(110, 196, 184, 0.5);
    background: rgba(12, 36, 40, 0.65);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--primary {
    border-color: rgba(110, 196, 184, 0.4);
    background: rgba(46, 140, 120, 0.12);
  }
}

.fin__dl-os {
  font-size: 0.78rem;
  color: #6ec4b8;
}

.fin__dl-name {
  font-size: 0.98rem;
  font-weight: 560;
  color: #eef6f4;
}

.fin__steps {
  margin: 0.95rem 0 0;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.45rem;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #a8bcc8;

  strong {
    color: #cfe8e0;
  }
}

.fin__progress-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem 0.9rem;
  margin-top: 0.65rem;
}

.fin__progress,
.fin__ok {
  margin: 0;
  font-size: 0.82rem;
  color: #a8bcc8;
}

.fin__stop {
  border: 1px solid rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.35);
  padding: 0.3rem 0.65rem;
  color: #fecaca;
  font-size: 0.78rem;
  cursor: pointer;
}

.fin__ok {
  margin-top: 0.55rem;
  color: #86efac;
}

.fin__err {
  margin: 0.55rem 0 0;
  color: #fca5a5;
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}
</style>
