<template>
  <div class="fin">
    <div class="fin__bg" aria-hidden="true" />

    <header class="fin__nav">
      <button type="button" class="fin__nav-link" @click="router.push('/console')">← 控制台</button>
      <button type="button" class="fin__nav-link" @click="router.push('/')">首页</button>
    </header>

    <main class="fin__main">
      <section class="fin__hero">
        <p class="fin__eyebrow">FINANCE · Offline only</p>
        <h1 class="fin__title">财务离线桌面</h1>
        <p class="fin__lead">
          FINANCE 模块只服务离线 App：云端只做登录与密钥签发，核算数据只留在你的电脑里。
        </p>
      </section>

      <section class="fin__pros" aria-label="产品优点">
        <article class="fin__pro">
          <h2>数据不出本机</h2>
          <p>
            业务库落在
            <code>~/.hute/finance/{tenantId}/</code>
            ，不写云 MySQL，和工具舱、工脉互不串库。
          </p>
        </article>
        <article class="fin__pro">
          <h2>同账号、少折腾</h2>
          <p>开通 FINANCE 后用同一账号签发离线密钥；不做云端账套，也不另开一套账密。</p>
        </article>
        <article class="fin__pro">
          <h2>安装即用</h2>
          <p>
            Windows
            包内置运行时与本机服务，双击启动、浏览器登录即可；无需自备开发环境或手动健康检查。
          </p>
        </article>
        <article class="fin__pro">
          <h2>边界清晰</h2>
          <p>
            FINANCE ≠ 云端财务后台。云端只做密钥与安装包；正式核算只在本机 fin-app。
          </p>
        </article>
      </section>

      <p v-if="pageError" class="fin__err">{{ pageError }}</p>

      <section class="fin__auth" aria-label="离线授权">
        <article class="fin__card fin__card--auth">
          <h2 class="fin__h2">离线授权</h2>
          <p class="fin__card-lead">
            FINANCE 仅用于本机
            <code>fin-app</code>
            ：签发离线密钥（
            <code>fintools://</code>
            ），有网签一次后可纯离线。
          </p>
          <FinDesktopActions v-if="canIssueOffline" />
          <p v-else class="fin__err">
            当前账号未开通 FINANCE。请管理员在「账号管理」为该用户解锁 FINANCE 模块后再签发。
          </p>
        </article>
      </section>

      <section class="fin__grid">
        <article class="fin__card">
          <h2 class="fin__h2">下载</h2>
          <p class="fin__card-lead">
            macOS：
            <code>.dmg</code>
            （独立桌面 App）；Windows：
            <code>.zip</code>
            （独立应用窗口 + 内置运行时，安装即用，无需浏览器打开网页）。
          </p>

          <div v-if="busy && dlProgress" class="fin__progress-row">
            <div class="fin__progress">{{ dlProgress }}</div>
            <button type="button" class="fin__stop" @click="stopDownload">停止下载</button>
          </div>
          <p v-if="dlOk" class="fin__ok">{{ dlOk }}</p>
          <p v-if="dlError" class="fin__err">{{ dlError }}</p>

          <div class="fin__downloads">
            <button
              type="button"
              class="fin__dl fin__dl--primary"
              :disabled="busy || !manifest?.macosArtifact"
              @click="onDownload('macos')">
              <span class="fin__dl-os">macOS</span>
              <span class="fin__dl-name">
                {{ busyPlatform === 'macos' ? '下载中…' : '下载 .dmg' }}
              </span>
              <span class="fin__dl-file">{{ manifest?.macosArtifact || '暂未打包' }}</span>
            </button>
            <button
              type="button"
              class="fin__dl"
              :disabled="busy || !manifest?.windowsArtifact"
              @click="onDownload('windows')">
              <span class="fin__dl-os">Windows</span>
              <span class="fin__dl-name">
                {{ busyPlatform === 'windows' ? '下载中…' : '下载 .zip' }}
              </span>
              <span class="fin__dl-file">{{ manifest?.windowsArtifact || '暂未打包' }}</span>
            </button>
          </div>

          <button type="button" class="fin__text-btn" :disabled="busy" @click="onReadme">
            下载 README 说明
          </button>
        </article>

        <article class="fin__card">
          <h2 class="fin__h2">安装与使用</h2>
          <ol class="fin__steps">
            <li>下载对应平台安装包。</li>
            <li>
              <strong>Windows</strong>
              ：解压
              <code>.zip</code>
              后双击
              <code>FinanceDesktop.exe</code>
              后打开 Electron
              <code>fin-app</code>
              。在本页点「生成密钥并打开桌面端」完成授权；若未唤起可复制 Deep Link。下载若被拦截，选「保留 / 仍要运行」。
            </li>
            <li>
              <strong>macOS</strong>
              ：挂载
              <code>.dmg</code>
              ，把 App 拖到「应用程序」。若提示已损坏，执行
              <code>xattr -cr "/Applications/财务审计桌面.app"</code>
              后再打开。
            </li>
            <li>
              登录成功后本机数据自动落在用户目录下的
              <code>.hute/finance/{tenantId}/</code>
              。
            </li>
          </ol>
        </article>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  DownloadAbortedError,
  downloadFinanceDesktopPackage,
  fetchFinanceDesktopManifest,
  formatMb,
  saveFinanceDesktopBlob,
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
let downloadAbort: AbortController | null = null

async function loadManifest() {
  try {
    manifest.value = await fetchFinanceDesktopManifest()
  } catch (e) {
    dlError.value = e instanceof Error ? e.message : '清单加载失败'
  }
}

function stopDownload() {
  downloadAbort?.abort()
  downloadAbort = null
  dlProgress.value = ''
  dlOk.value = ''
  dlError.value = '已停止下载'
  busy.value = false
  busyPlatform.value = null
}

async function onDownload(platform: FinanceDesktopPlatform) {
  downloadAbort?.abort()
  downloadAbort = new AbortController()
  const signal = downloadAbort.signal
  busy.value = true
  busyPlatform.value = platform
  dlError.value = ''
  dlOk.value = ''
  dlProgress.value = '连接中…'
  try {
    const { filename, bytes } = await downloadFinanceDesktopPackage(
      platform,
      (loaded, total) => {
        if (total != null && total > 0) {
          const pct = Math.min(100, Math.round((loaded / total) * 100))
          dlProgress.value = `已下载 ${formatMb(loaded)} / ${formatMb(total)}（${pct}%）`
        } else {
          dlProgress.value = `已下载 ${formatMb(loaded)}`
        }
      },
      signal,
    )
    if (signal.aborted) return
    saveFinanceDesktopBlob(filename, bytes)
    dlOk.value = `已开始保存 ${filename}（${formatMb(bytes.size)}）`
    dlProgress.value = ''
  } catch (e) {
    if (e instanceof DownloadAbortedError || signal.aborted) {
      dlError.value = '已停止下载'
      dlProgress.value = ''
      return
    }
    dlError.value = e instanceof Error ? e.message : String(e)
    dlProgress.value = ''
  } finally {
    if (downloadAbort?.signal === signal) {
      downloadAbort = null
    }
    busy.value = false
    busyPlatform.value = null
  }
}

async function onReadme() {
  busy.value = true
  dlError.value = ''
  dlOk.value = ''
  try {
    const config = useRuntimeConfig()
    const base = String(config.public.apiOrigin || '').replace(/\/$/, '')
    auth.hydrate()
    const res = await fetch(`${base}/api/console/finance/desktop/readme`, {
      headers: {
        Accept: 'text/plain',
        ...(auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {}),
      },
    })
    if (!res.ok) {
      let msg = `下载失败 (${res.status})`
      try {
        const j = (await res.json()) as { message?: string }
        if (j?.message) msg = j.message
      } catch {
        /* ignore */
      }
      throw new Error(msg)
    }
    saveFinanceDesktopBlob('finance-desktop-README.txt', await res.blob())
    dlOk.value = '已下载说明文件'
  } catch (e) {
    dlError.value = e instanceof Error ? e.message : String(e)
  } finally {
    busy.value = false
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
    pageError.value = '当前账号未开通 FINANCE（该模块仅用于离线桌面 App）'
    return
  }
  await loadManifest()
})
</script>

<style scoped lang="scss">
.fin {
  position: relative;
  min-height: 100vh;
  color: #e8eef4;
  background: #061018;
  overflow-x: hidden;
}

.fin__bg {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 45% at 15% -5%, rgba(46, 160, 140, 0.18), transparent 55%),
    radial-gradient(ellipse 50% 40% at 90% 10%, rgba(70, 120, 150, 0.12), transparent 50%),
    linear-gradient(180deg, #0a1820 0%, #061018 40%, #040c12 100%);
}

.fin__nav {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  max-width: 56rem;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 0;
}

.fin__nav-link {
  border: none;
  background: transparent;
  color: #7a93a8;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  cursor: pointer;

  &:hover {
    color: #9fd8cc;
  }
}

.fin__main {
  position: relative;
  z-index: 1;
  max-width: 56rem;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 3.5rem;
}

.fin__hero {
  margin-bottom: 1.5rem;
}

.fin__eyebrow {
  margin: 0;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  color: rgba(110, 196, 184, 0.92);
}

.fin__title {
  margin: 0.45rem 0 0;
  font-family: 'Source Serif 4', 'Songti SC', 'Noto Serif SC', Georgia, serif;
  font-size: clamp(1.85rem, 3.5vw, 2.4rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f4faf8;
}

.fin__lead {
  margin: 0.65rem 0 0;
  max-width: 36rem;
  font-size: 0.98rem;
  line-height: 1.55;
  color: #9aafbd;
}

.fin__pros {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
  margin: 0 0 1.35rem;

  @media (min-width: 720px) {
    grid-template-columns: 1fr 1fr;
  }
}

.fin__pro {
  padding: 0.95rem 1.05rem;
  border-left: 2px solid rgba(110, 196, 184, 0.5);
  background: rgba(8, 20, 26, 0.55);

  h2 {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 600;
    color: #e8f4f0;
  }

  p {
    margin: 0.4rem 0 0;
    font-size: 0.84rem;
    line-height: 1.5;
    color: #8aa0ae;
  }

  code {
    font-size: 0.8em;
    color: #c5e4dc;
  }
}

.fin__auth {
  margin-bottom: 1.25rem;
}

.fin__card--auth {
  border-color: rgba(159, 216, 204, 0.28);
  background: linear-gradient(165deg, rgba(46, 160, 140, 0.12), rgba(8, 24, 32, 0.65));
}

.fin__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: 860px) {
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}

.fin__card {
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(10, 22, 30, 0.72);
  padding: 1.25rem 1.3rem 1.35rem;
  backdrop-filter: blur(8px);
}

.fin__h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 600;
  color: #e8f0f4;
}

.fin__card-lead {
  margin: 0.55rem 0 0;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #8499a8;

  code {
    font-size: 0.85em;
    color: #c5e4dc;
  }
}

.fin__downloads {
  display: grid;
  gap: 0.65rem;
  margin-top: 1rem;
}

.fin__dl {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  column-gap: 0.85rem;
  row-gap: 0.15rem;
  width: 100%;
  text-align: left;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(4, 14, 18, 0.55);
  padding: 0.85rem 1rem;
  color: inherit;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;

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
  grid-row: 1 / 3;
  align-self: center;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  color: #6ec4b8;
}

.fin__dl-name {
  font-size: 0.95rem;
  font-weight: 560;
  color: #eef6f4;
}

.fin__dl-file {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.68rem;
  color: #7a93a8;
}

.fin__steps {
  margin: 0.9rem 0 0;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.55rem;
  font-size: 0.88rem;
  line-height: 1.5;
  color: #a8bcc8;

  strong {
    color: #cfe8e0;
  }

  code {
    font-size: 0.8em;
    color: #c5e4dc;
  }
}

.fin__text-btn {
  margin-top: 0.85rem;
  border: none;
  border-bottom: 1px solid rgba(110, 196, 184, 0.35);
  background: transparent;
  padding: 0 0 1px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: #9fd8cc;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.fin__progress-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1rem;
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
  padding: 0.35rem 0.75rem;
  color: #fecaca;
  font-size: 0.78rem;
  letter-spacing: 0.04em;
  cursor: pointer;

  &:hover {
    border-color: rgba(248, 113, 113, 0.7);
    color: #fff;
  }
}

.fin__ok {
  margin-top: 0.65rem;
  color: #86efac;
}

.fin__err {
  margin: 0.65rem 0 0;
  color: #fca5a5;
  font-size: 0.88rem;
}
</style>
