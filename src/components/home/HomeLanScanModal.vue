<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useVirtualList } from '@/composables/useVirtualList'
import { lockPageScroll, unlockPageScroll } from '@/utils/scrollLock'
import {
  buildCsv,
  buildScanStats,
  enrichDevices,
  filterDevices,
  sortDevices,
  type EnrichedDevice,
  type ScanDeviceRecord,
  type SortDir,
  type SortKey,
} from '@/utils/lanScanDevice'
import {
  countMacKnown,
  formatScanModeLabel,
  formatVisitorScanLabel,
  mergeScanResults,
  type ScanSourceMode,
} from '@/utils/lanScanMerge'
import {
  guessLocalSubnetPrefix,
  isBrowserScanLimited,
  LocalNetworkScanError,
  normalizeSubnetPrefix,
  sanitizeSubnetInput,
  scanLocalNetwork,
} from '@/utils/localNetworkScan'
import {
  fetchArpEnrichment,
  fetchServerLanDevices,
  isBackendOnUserLan,
  resolveApiProxyUsable,
  resetProxyAvailabilityCache,
} from '@/utils/networkScanApi'
import { parseArpTableText } from '@/utils/parseArpTableText'
import { resetLocalArpHelperCache } from '@/utils/localArpHelper'
import { requestLocalNetworkViaImage } from '@/utils/localNetworkAccess'
import { probeDeviceMacFromAlive, probeRouterPages } from '@/utils/routerGatewayProbe'
import { enrichVisitorScan } from '@/utils/visitorScanEnrich'

const emit = defineEmits<{
  close: []
}>()

const ROW_HEIGHT = 46
const BATCH_FLUSH_EVERY = 12

type Phase = 'idle' | 'loading' | 'ready' | 'error'
type ScanStrategy = 'hybrid' | 'browser' | 'server'

const phase = ref<Phase>('idle')
const scanStrategy = ref<ScanStrategy>('hybrid')
const rawDevices = shallowRef<EnrichedDevice[]>([])
const scanMeta = shallowRef<{
  subnet: string
  durationMs: number
  mode: ScanSourceMode
  modeLabel: string
} | null>(null)
const errorMessage = ref('')
const loadingHint = ref('正在扫描局域网设备…')
const loadingElapsed = ref(0)
const loadingProgress = ref(0)
const subnetInput = ref(guessLocalSubnetPrefix())
const searchInput = ref('')
const searchQuery = ref('')
const sortKey = ref<SortKey>('ipAddress')
const sortDir = ref<SortDir>('asc')
const copiedToken = ref('')
const listRef = ref<HTMLElement | null>(null)
const sandboxLimited = isBrowserScanLimited()
const proxyAvailable = ref<boolean | null>(null)
const localHelperReady = ref(false)
const showArpImport = ref(false)
const arpPasteText = ref('')
const arpImportError = ref('')
const routerUsername = ref('admin')
const routerPassword = ref('')
const lanAccessState = ref<'unknown' | 'pending' | 'granted' | 'denied'>('unknown')
const isPublicVisitor = computed(() => !isBackendOnUserLan())
let proxyCheckTimer = 0

const proxyHint = computed(() => {
  const subnet = sanitizeSubnetInput(subnetInput.value) || '192.168.1'
  if (!isBackendOnUserLan()) {
    return `公网访问：由您本机浏览器直连探测 ${subnet}.0/24（云服务器无法访问您家里的局域网）`
  }
  if (proxyAvailable.value === true) {
    return `局域网后端：将通过服务端动态代理扫描 ${subnet}.0/24`
  }
  if (proxyAvailable.value === false) {
    return '服务端代理不可用，将使用浏览器直连探测'
  }
  return '正在检测扫描方式…'
})

const macHelpHint = computed(() => {
  if (isBackendOnUserLan()) {
    return '同一局域网后端可读取 ARP 表补全 MAC；请优先使用「混合」或「服务端」模式。'
  }
  return '访客模式：扫描前若浏览器弹出「访问本地网络」务必点允许，否则只能发现网关。填写路由器密码可尝试补全 MAC（部分品牌受 CORS 限制仍可能失败）。'
})

let searchTimer = 0
let copyTimer = 0
let progressTimer = 0
let scanAbort: AbortController | null = null
let flushRaf = 0
const liveRecords: ScanDeviceRecord[] = []

const stats = computed(() => buildScanStats(rawDevices.value))

const filteredDevices = computed(() => {
  const filtered = filterDevices(rawDevices.value, searchQuery.value)
  return sortDevices(filtered, sortKey.value, sortDir.value)
})

const { slice: virtualSlice, scrollToTop, measure: measureList } = useVirtualList(
  filteredDevices,
  listRef,
  {
    rowHeight: ROW_HEIGHT,
    overscan: 8,
  },
)

const gridTemplate =
  '36px minmax(120px, 1.1fr) minmax(100px, 1.2fr) minmax(140px, 1.4fr) minmax(90px, 1fr) 88px'

const columns: { key: SortKey; label: string }[] = [
  { key: 'ipAddress', label: 'IP 地址' },
  { key: 'hostName', label: '主机名' },
  { key: 'macAddress', label: 'MAC 地址' },
  { key: 'vendor', label: '厂商' },
  { key: 'pingTimeMs', label: '响应' },
]

function scheduleFlush() {
  if (flushRaf) return
  flushRaf = requestAnimationFrame(() => {
    flushRaf = 0
    rawDevices.value = enrichDevices([...liveRecords])
  })
}

function beginLoading() {
  stopProgress()
  phase.value = 'loading'
  errorMessage.value = ''
  rawDevices.value = []
  liveRecords.length = 0
  scanMeta.value = null
  const subnetLabel = `${sanitizeSubnetInput(subnetInput.value)}.0/24`
  loadingHint.value = isPublicVisitor.value
    ? `访客扫描：浏览器探测 ${subnetLabel}…`
    : scanStrategy.value === 'hybrid'
      ? proxyAvailable.value
        ? `混合扫描：动态代理 ${subnetLabel} + 服务端 ARP…`
        : '混合扫描：浏览器探测 + 服务端 ICMP/ARP…'
      : scanStrategy.value === 'server'
        ? '服务端 ICMP / ARP 扫描中…'
        : proxyAvailable.value
          ? `动态代理扫描 ${subnetLabel}…`
          : '浏览器探测局域网主机…'
  loadingElapsed.value = 0
  loadingProgress.value = 0

  const startedAt = Date.now()
  progressTimer = window.setInterval(() => {
    loadingElapsed.value = Math.floor((Date.now() - startedAt) / 1000)
  }, 500)
}

function stopProgress() {
  window.clearInterval(progressTimer)
  progressTimer = 0
}

function endLoading(success: boolean) {
  stopProgress()
  if (success) loadingProgress.value = 100
}

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'ipAddress' ? 'asc' : 'asc'
  }
  scrollToTop()
}

async function refreshProxyStatus() {
  resetProxyAvailabilityCache()
  resetLocalArpHelperCache()
  proxyAvailable.value = await resolveApiProxyUsable()
  localHelperReady.value = false
}

function applyArpImport() {
  arpImportError.value = ''
  const subnet = scanMeta.value?.subnet ?? sanitizeSubnetInput(subnetInput.value)
  const parsed = parseArpTableText(arpPasteText.value, subnet)
  if (parsed.length === 0) {
    arpImportError.value = '未能解析 MAC，请确认粘贴了完整的 arp -a 输出。'
    return
  }

  const base = rawDevices.value.map((d) => ({
    ipAddress: d.ipAddress,
    hostName: d.hostName,
    macAddress: d.macAddress,
    vendor: d.vendor,
    pingTimeMs: d.pingTimeMs,
  }))
  const { devices } = mergeScanResults(base, parsed)
  rawDevices.value = enrichDevices(devices)
  if (scanMeta.value && countMacKnown(devices) > 0) {
    const label = scanMeta.value.modeLabel.replace(' · 已补全 MAC', '')
    scanMeta.value = { ...scanMeta.value, modeLabel: `${label} · 已补全 MAC` }
  }
  showArpImport.value = false
  arpPasteText.value = ''
  void nextTick(() => {
    measureList()
  })
}

async function copyArpCommand() {
  try {
    await navigator.clipboard.writeText('arp -a')
    copiedToken.value = 'arp-cmd'
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => {
      copiedToken.value = ''
    }, 2000)
  } catch {
    arpImportError.value = '复制失败，请手动在终端输入：arp -a'
  }
}

async function requestLanAccess(): Promise<boolean> {
  lanAccessState.value = 'pending'
  const subnet = sanitizeSubnetInput(subnetInput.value) || '192.168.1'
  const ok = await requestLocalNetworkViaImage(`${subnet}.1`)
  lanAccessState.value = ok ? 'granted' : 'denied'
  return ok
}

async function runBrowserScan(
  subnet: string,
  signal: AbortSignal,
  forceBrowser = false,
): Promise<ScanDeviceRecord[]> {
  const useApiProxy = !forceBrowser && proxyAvailable.value === true
  return scanLocalNetwork(
    subnet,
    signal,
    {
    onProgress: (scanned, total) => {
      const ratio = scanStrategy.value === 'hybrid' ? 0.65 : 1
      loadingProgress.value = Math.min(99, Math.round((scanned / total) * 100 * ratio))
      if (scanned % BATCH_FLUSH_EVERY === 0) {
        loadingHint.value =
          scanStrategy.value === 'hybrid'
            ? `浏览器已探测 ${scanned} / ${total}，服务端并行扫描中…`
            : `已探测 ${scanned} / ${total} 个地址…`
      }
    },
    onDeviceFound: (device) => {
      liveRecords.push(device)
      scheduleFlush()
    },
  },
    { useApiProxy, imageOnlyProbe: forceBrowser },
  )
}

async function runScan() {
  scanAbort?.abort()
  scanAbort = new AbortController()
  const signal = scanAbort.signal
  beginLoading()
  const startedAt = performance.now()

  try {
    const subnet = normalizeSubnetPrefix(subnetInput.value)

    if (isPublicVisitor.value) {
      loadingHint.value = '正在请求访问本地网络权限（若弹窗请点允许）…'
      if (lanAccessState.value !== 'granted') {
        await requestLanAccess()
      }
      const browserDevices = await runBrowserScan(subnet, signal, true)
      loadingProgress.value = 82
      loadingHint.value = '正在补全 MAC 信息…'
      const routerAuth = routerPassword.value.trim()
        ? { username: routerUsername.value.trim() || 'admin', password: routerPassword.value }
        : undefined

      const [routerPages, deviceMacDevices] = await Promise.all([
        probeRouterPages(subnet, routerAuth, signal),
        probeDeviceMacFromAlive(browserDevices, subnet, signal),
      ])

      let mergedDevices = mergeScanResults(browserDevices, deviceMacDevices).devices

      loadingProgress.value = 92
      loadingHint.value = '服务端正在解析 MAC 与厂商信息…'
      const enriched = await enrichVisitorScan(subnet, mergedDevices, routerPages, signal)
      const devices = enriched?.devices ?? mergedDevices
      const macResolved = enriched?.macResolved ?? countMacKnown(devices)

      rawDevices.value = enrichDevices(devices)
      scanMeta.value = {
        subnet,
        durationMs: Math.round(performance.now() - startedAt),
        mode: 'browser',
        modeLabel: formatVisitorScanLabel(devices.length, macResolved, routerPages.length),
      }
    } else {
      const useBrowser = scanStrategy.value !== 'server'
      const useServer = scanStrategy.value !== 'browser'

      const browserPromise = useBrowser
        ? runBrowserScan(subnet, signal).catch(() => [] as ScanDeviceRecord[])
        : Promise.resolve([] as ScanDeviceRecord[])

      const serverPromise = useServer
        ? fetchServerLanDevices(subnet, 1000, signal).then((result) => {
            if (result && scanStrategy.value === 'hybrid') {
              loadingProgress.value = Math.max(loadingProgress.value, 75)
              loadingHint.value = '合并浏览器与服务端扫描结果…'
            }
            return result
          })
        : Promise.resolve(null)

      const [browserDevices, serverResult] = await Promise.all([browserPromise, serverPromise])

      if (scanStrategy.value === 'server' && !serverResult) {
        throw new LocalNetworkScanError('Server scan unavailable')
      }

      let { devices, summary } = mergeScanResults(browserDevices, serverResult?.devices ?? [])

      let arpEnriched = false
      const arpEntries = await fetchArpEnrichment(subnet, signal, { allowLocalHelper: false })
      if (arpEntries?.length) {
        const merged = mergeScanResults(devices, arpEntries)
        devices = merged.devices
        summary = merged.summary
        arpEnriched = countMacKnown(devices) > 0
        loadingHint.value = '已合并 ARP 表 MAC 地址…'
      }

      rawDevices.value = enrichDevices(devices)
      scanMeta.value = {
        subnet,
        durationMs: Math.round(performance.now() - startedAt),
        mode: summary.mode,
        modeLabel: formatScanModeLabel(summary, arpEnriched),
      }
    }
    phase.value = 'ready'
    endLoading(true)
    await nextTick()
    measureList()
    scrollToTop()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    errorMessage.value = mapScanError(e)
    phase.value = 'error'
    endLoading(false)
  }
}

function backToInput() {
  errorMessage.value = ''
  phase.value = 'idle'
}

function mapScanError(e: unknown): string {
  if (e instanceof LocalNetworkScanError) {
    if (e.message.includes('Invalid subnet prefix')) {
      return '网段格式无效，请输入如 192.168.1'
    }
    if (e.message.includes('out of range')) {
      return '网段中存在超出范围的数字'
    }
    if (e.message.includes('Server scan unavailable')) {
      return '服务端扫描不可用（生产环境默认关闭），请改用「混合」或「浏览器」模式'
    }
    return e.message
  }
  return '扫描失败，请稍后重试'
}

async function copyValue(token: string, value: string) {
  if (!value || value === '不可用' || value === '—') return
  try {
    await navigator.clipboard.writeText(value)
    copiedToken.value = token
    window.clearTimeout(copyTimer)
    copyTimer = window.setTimeout(() => {
      copiedToken.value = ''
    }, 1400)
  } catch {
    // Clipboard may be blocked; ignore silently.
  }
}

function exportCsv() {
  const blob = new Blob(['\uFEFF' + buildCsv(filteredDevices.value)], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `lan-scan-${scanMeta.value?.subnet ?? 'subnet'}-${Date.now()}.csv`
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function statusLabel(device: EnrichedDevice): string {
  return device.status === 'online' ? '在线' : 'ARP'
}

function pingBarWidth(device: EnrichedDevice): string {
  if (device.pingTimeMs <= 0) return '0%'
  return `${Math.min(100, Math.round((device.pingTimeMs / 200) * 100))}%`
}

watch(searchInput, (value) => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    searchQuery.value = value
    scrollToTop()
  }, 160)
})

watch(subnetInput, () => {
  window.clearTimeout(proxyCheckTimer)
  proxyCheckTimer = window.setTimeout(() => {
    void refreshProxyStatus()
  }, 350)
})

onMounted(() => {
  lockPageScroll()
  void refreshProxyStatus()
})

onUnmounted(() => {
  scanAbort?.abort()
  if (flushRaf) cancelAnimationFrame(flushRaf)
  endLoading(false)
  unlockPageScroll()
  window.clearTimeout(searchTimer)
  window.clearTimeout(proxyCheckTimer)
  window.clearTimeout(copyTimer)
})
</script>

<template>
  <Teleport to="body">
    <div class="lan-scan-root" role="dialog" aria-modal="true" aria-label="内网扫描">
      <div class="lan-scan-backdrop" aria-hidden="true" />

      <article class="lan-scan-panel">
        <header class="lan-scan-head">
          <div class="lan-scan-meta">
            <h2 class="lan-scan-title">内网扫描</h2>
            <p v-if="phase === 'ready' && scanMeta" class="lan-scan-sub">
              网段 <strong>{{ scanMeta.subnet }}.0/24</strong>
              · 用时 <strong>{{ (scanMeta.durationMs / 1000).toFixed(1) }}s</strong>
              · {{ scanMeta.modeLabel }}
              <span v-if="searchQuery.trim()">
                · 筛选 <strong>{{ filteredDevices.length }}</strong> / {{ stats.total }}
              </span>
            </p>
            <p v-else-if="phase === 'loading'" class="lan-scan-sub">
              正在从浏览器扫描 {{ subnetInput }}.0/24 …
            </p>
            <p v-else-if="phase === 'idle'" class="lan-scan-sub">
              默认网段 192.168.1，可修改后扫描。
            </p>
            <p v-if="phase === 'idle' || phase === 'error'" class="lan-scan-sub lan-scan-sub--proxy">
              {{ proxyHint }}
            </p>
            <p v-else-if="phase === 'error'" class="lan-scan-sub lan-scan-sub--error">{{ errorMessage }}</p>
            <p v-if="sandboxLimited" class="lan-scan-sub lan-scan-sub--warn">
              HTTPS 混合内容可能限制探测，建议在局域网内使用 HTTP 访问以获得更好效果。
            </p>
          </div>
          <button type="button" class="lan-scan-close" aria-label="关闭" @click="emit('close')">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </header>

        <p
          v-if="phase === 'ready' || phase === 'idle'"
          class="lan-scan-mac-hint"
        >
          {{ macHelpHint }}
        </p>

        <div v-if="phase === 'ready'" class="lan-scan-stats">
          <div class="lan-scan-stat">
            <span class="lan-scan-stat-value">{{ stats.total }}</span>
            <span class="lan-scan-stat-label">设备总数</span>
          </div>
          <div class="lan-scan-stat lan-scan-stat--online">
            <span class="lan-scan-stat-value">{{ stats.online }}</span>
            <span class="lan-scan-stat-label">有响应</span>
          </div>
          <div class="lan-scan-stat lan-scan-stat--arp">
            <span class="lan-scan-stat-value">{{ stats.macKnown > 0 ? stats.macKnown : stats.arpOnly }}</span>
            <span class="lan-scan-stat-label">{{ stats.macKnown > 0 ? 'MAC 已识别' : 'ARP（不可用）' }}</span>
          </div>
          <div class="lan-scan-stat lan-scan-stat--ping">
            <span class="lan-scan-stat-value">{{ stats.avgPing > 0 ? `${stats.avgPing} ms` : '—' }}</span>
            <span class="lan-scan-stat-label">平均响应</span>
          </div>
        </div>

        <div
          v-if="phase === 'ready' || phase === 'idle' || phase === 'error'"
          class="lan-scan-toolbar"
        >
          <label v-if="phase === 'ready'" class="lan-scan-search">
            <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" fill="none" stroke-width="1.6" />
              <path d="M13 13l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
            <input
              v-model="searchInput"
              type="search"
              placeholder="搜索 IP、主机名…"
              autocomplete="off"
              spellcheck="false"
            />
          </label>

          <div
            v-if="!isPublicVisitor"
            class="lan-scan-mode"
            role="group"
            aria-label="扫描模式"
          >
            <button
              type="button"
              class="lan-scan-mode-btn"
              :class="{ 'lan-scan-mode-btn--active': scanStrategy === 'hybrid' }"
              :disabled="phase === 'loading'"
              @click="scanStrategy = 'hybrid'"
            >
              混合
            </button>
            <button
              type="button"
              class="lan-scan-mode-btn"
              :class="{ 'lan-scan-mode-btn--active': scanStrategy === 'browser' }"
              :disabled="phase === 'loading'"
              @click="scanStrategy = 'browser'"
            >
              浏览器
            </button>
            <button
              type="button"
              class="lan-scan-mode-btn"
              :class="{ 'lan-scan-mode-btn--active': scanStrategy === 'server' }"
              :disabled="phase === 'loading'"
              @click="scanStrategy = 'server'"
            >
              服务端
            </button>
          </div>

          <label v-if="isPublicVisitor" class="lan-scan-router-auth">
            <span>路由账号</span>
            <input
              v-model="routerUsername"
              type="text"
              spellcheck="false"
              autocomplete="username"
              placeholder="admin"
              aria-label="路由器管理账号"
            />
          </label>
          <label v-if="isPublicVisitor" class="lan-scan-router-auth lan-scan-router-auth--pass">
            <span>路由密码</span>
            <input
              v-model="routerPassword"
              type="password"
              spellcheck="false"
              autocomplete="current-password"
              placeholder="可选，提高 MAC 识别"
              aria-label="路由器管理密码"
            />
          </label>

          <label class="lan-scan-subnet">
            <span>网段</span>
            <input
              v-model="subnetInput"
              type="text"
              spellcheck="false"
              placeholder="192.168.1"
              aria-label="网段前缀"
            />
            <span class="lan-scan-subnet-suffix">.0/24</span>
          </label>

          <button
            v-if="isPublicVisitor && phase !== 'loading'"
            type="button"
            class="lan-scan-btn lan-scan-btn--ghost"
            :disabled="lanAccessState === 'pending'"
            @click="requestLanAccess"
          >
            {{
              lanAccessState === 'pending'
                ? '授权中…'
                : lanAccessState === 'granted'
                  ? '已授权本地网络'
                  : '授权本地网络'
            }}
          </button>
          <button type="button" class="lan-scan-btn" @click="runScan">
            {{ phase === 'idle' ? '开始扫描' : '重新扫描' }}
          </button>
          <button
            v-if="phase === 'error'"
            type="button"
            class="lan-scan-btn lan-scan-btn--ghost"
            @click="backToInput"
          >
            返回修改
          </button>
          <button
            v-if="phase === 'ready'"
            type="button"
            class="lan-scan-btn lan-scan-btn--ghost"
            @click="showArpImport = !showArpImport"
          >
            {{ showArpImport ? '收起导入' : '导入 ARP' }}
          </button>
          <button
            type="button"
            class="lan-scan-btn lan-scan-btn--ghost"
            :disabled="filteredDevices.length === 0"
            @click="exportCsv"
          >
            导出 CSV
          </button>
        </div>

        <div v-if="phase === 'ready' && showArpImport" class="lan-scan-arp-import">
          <p class="lan-scan-arp-import-title">从本机 ARP 表导入 MAC（公网访问推荐）</p>
          <ol class="lan-scan-arp-import-steps">
            <li>在本机打开终端，执行 <code>arp -a</code>（可先扫描一遍以填充 ARP 缓存）</li>
            <li>复制全部输出，粘贴到下方文本框</li>
            <li>点击「合并 MAC」写入当前列表</li>
          </ol>
          <div class="lan-scan-arp-import-actions">
            <button type="button" class="lan-scan-btn lan-scan-btn--ghost" @click="copyArpCommand">
              {{ copiedToken === 'arp-cmd' ? '已复制' : '复制 arp -a' }}
            </button>
            <button
              type="button"
              class="lan-scan-btn"
              :disabled="!arpPasteText.trim()"
              @click="applyArpImport"
            >
              合并 MAC
            </button>
          </div>
          <textarea
            v-model="arpPasteText"
            class="lan-scan-arp-textarea"
            rows="6"
            spellcheck="false"
            placeholder="粘贴 arp -a 输出，例如：&#10;? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0"
          />
          <p v-if="arpImportError" class="lan-scan-arp-import-error">{{ arpImportError }}</p>
        </div>

        <div class="lan-scan-body">
          <div v-if="phase === 'loading'" class="lan-scan-loading" role="status" aria-live="polite">
            <div class="lan-scan-radar" aria-hidden="true">
              <div class="lan-scan-radar-ring" />
              <div class="lan-scan-radar-sweep" />
              <div class="lan-scan-radar-core" />
            </div>
            <p class="lan-scan-loading-title">{{ loadingHint }}</p>
            <div class="lan-scan-progress-track" aria-hidden="true">
              <div class="lan-scan-progress-bar" :style="{ width: `${loadingProgress}%` }" />
            </div>
            <p class="lan-scan-loading-meta">
              {{ loadingElapsed >= 1 ? `已等待 ${loadingElapsed} 秒` : '正在批量探测 1–254 号主机' }}
              <span v-if="loadingProgress > 0"> · {{ loadingProgress }}%</span>
            </p>
            <p class="lan-scan-loading-note">
              {{
                isPublicVisitor
                  ? '若 Chrome 弹出「允许访问本地网络」请点击允许，否则只能扫到网关 192.168.1.1。'
                  : '浏览器无法直接读 MAC；扫描后可「导入 ARP」或连接本机 Java（8787）自动补全。'
              }}
            </p>
          </div>

          <div v-else-if="phase === 'error'" class="lan-scan-error">
            <p>{{ errorMessage }}</p>
            <p class="lan-scan-error-hint">请在上方修改网段前缀（如 192.168.1），然后点击「重新扫描」。</p>
            <div class="lan-scan-error-actions">
              <button type="button" class="lan-scan-btn lan-scan-btn--ghost" @click="backToInput">
                返回修改
              </button>
              <button type="button" class="lan-scan-btn" @click="runScan">重新扫描</button>
            </div>
          </div>

          <div v-else-if="phase === 'idle'" class="lan-scan-idle">
            <p v-if="isPublicVisitor">
              访客模式：在您本机浏览器完成局域网探测，云端负责解析 MAC 与厂商。
            </p>
            <p v-else>浏览器端扫描，MAC / 厂商信息因隐私沙箱不可用。</p>
            <p class="lan-scan-idle-hint">
              {{
                isPublicVisitor
                  ? '首次扫描时若浏览器询问「访问本地网络」，请点击允许；可选填写路由器管理密码。'
                  : '推荐「混合」模式：浏览器探测 + 服务端 ICMP/ARP（本地开发时后端需开启）。'
              }}
            </p>
          </div>

          <template v-else-if="phase === 'ready'">
            <div class="lan-scan-grid-head" :style="{ gridTemplateColumns: gridTemplate }">
              <span class="lan-scan-col-status" aria-hidden="true" />
              <button
                v-for="col in columns"
                :key="col.key"
                type="button"
                class="lan-scan-sort-btn"
                :class="{ 'lan-scan-sort-btn--active': sortKey === col.key }"
                @click="toggleSort(col.key)"
              >
                {{ col.label }}
                <span v-if="sortKey === col.key" class="lan-scan-sort-arrow" aria-hidden="true">
                  {{ sortDir === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </div>

            <div ref="listRef" class="lan-scan-virtual-list">
              <div
                v-if="filteredDevices.length === 0"
                class="lan-scan-empty"
              >
                {{ searchQuery.trim() ? '没有匹配的设备' : '未发现响应设备' }}
              </div>

              <div
                v-else
                class="lan-scan-virtual-spacer"
                :style="{ height: `${virtualSlice.totalHeight}px` }"
              >
                <div
                  class="lan-scan-virtual-window"
                  :style="{ transform: `translateY(${virtualSlice.offsetY}px)` }"
                >
                  <div
                    v-for="{ item, index } in virtualSlice.items"
                    :key="item.ipAddress"
                    class="lan-scan-row"
                    :class="{ 'lan-scan-row--alt': index % 2 === 1 }"
                    :style="{ height: `${ROW_HEIGHT}px`, gridTemplateColumns: gridTemplate }"
                  >
                    <span
                      class="lan-scan-status-dot"
                      :class="`lan-scan-status-dot--${item.status}`"
                      :title="statusLabel(item)"
                    />

                    <button
                      type="button"
                      class="lan-scan-cell lan-scan-cell--ip"
                      :title="`复制 ${item.ipAddress}`"
                      @click="copyValue(`ip-${item.ipAddress}`, item.ipAddress)"
                    >
                      {{ item.ipAddress }}
                      <span v-if="copiedToken === `ip-${item.ipAddress}`" class="lan-scan-copied">已复制</span>
                    </button>

                    <span class="lan-scan-cell" :title="item.hostName">{{ item.hostName }}</span>

                    <button
                      type="button"
                      class="lan-scan-cell lan-scan-cell--mono"
                      :title="item.displayMac !== '不可用' ? `复制 ${item.displayMac}` : '浏览器无法获取 MAC'"
                      @click="copyValue(`mac-${item.ipAddress}`, item.displayMac)"
                    >
                      {{ item.displayMac }}
                      <span v-if="copiedToken === `mac-${item.ipAddress}`" class="lan-scan-copied">已复制</span>
                    </button>

                    <span class="lan-scan-cell" :title="item.displayVendor">{{ item.displayVendor }}</span>

                    <div class="lan-scan-ping-cell">
                      <span
                        class="lan-scan-ping-badge"
                        :class="`lan-scan-ping-badge--${item.pingTier}`"
                      >
                        {{ item.status === 'arp' ? 'ARP' : item.displayPing }}
                      </span>
                      <span
                        v-if="item.pingTimeMs > 0"
                        class="lan-scan-ping-bar"
                        :class="`lan-scan-ping-bar--${item.pingTier}`"
                        :style="{ width: pingBarWidth(item) }"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </article>
    </div>
  </Teleport>
</template>

<style scoped>
.lan-scan-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(0.75rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right))
    max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
}

.lan-scan-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(3, 6, 12, 0.76);
  backdrop-filter: blur(4px);
  pointer-events: auto;
  cursor: default;
}

.lan-scan-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  width: min(1140px, 100%);
  height: min(88vh, 860px);
  border-radius: 18px;
  border: 1px solid rgba(136, 204, 238, 0.24);
  background: linear-gradient(165deg, rgba(8, 14, 24, 0.97) 0%, rgba(6, 12, 20, 0.94) 100%);
  box-shadow:
    0 28px 64px rgba(0, 0, 0, 0.55),
    inset 0 1px 0 rgba(136, 204, 238, 0.08);
  overflow: hidden;
  contain: layout style;
}

.lan-scan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.lan-scan-title {
  margin: 0;
  font-size: 1.08rem;
  font-weight: 600;
  color: #e8f2f8;
  letter-spacing: 0.02em;
}

.lan-scan-sub {
  margin: 0.3rem 0 0;
  font-size: 0.8rem;
  color: rgba(170, 200, 215, 0.7);
}

.lan-scan-sub strong {
  color: #6ec8e8;
  font-weight: 600;
}

.lan-scan-sub--error {
  color: rgba(240, 160, 140, 0.9);
}

.lan-scan-sub--warn {
  color: rgba(230, 190, 120, 0.85);
  margin-top: 0.25rem;
}

.lan-scan-sub--proxy {
  color: rgba(130, 200, 230, 0.78);
  margin-top: 0.2rem;
}

.lan-scan-mac-hint {
  margin: 0;
  padding: 0.45rem 1rem 0;
  font-size: 0.75rem;
  line-height: 1.5;
  color: rgba(150, 185, 205, 0.62);
}

.lan-scan-arp-import {
  margin: 0 1rem 0.5rem;
  padding: 0.75rem 0.9rem;
  border-radius: 10px;
  background: rgba(12, 28, 42, 0.55);
  border: 1px solid rgba(90, 150, 190, 0.22);
}

.lan-scan-arp-import-title {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: rgba(180, 215, 235, 0.9);
}

.lan-scan-arp-import-steps {
  margin: 0 0 0.55rem;
  padding-left: 1.2rem;
  font-size: 0.74rem;
  line-height: 1.55;
  color: rgba(150, 185, 205, 0.72);
}

.lan-scan-arp-import-steps code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  color: rgba(130, 200, 230, 0.9);
}

.lan-scan-arp-import-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.lan-scan-arp-textarea {
  width: 100%;
  box-sizing: border-box;
  resize: vertical;
  min-height: 5.5rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  border: 1px solid rgba(90, 150, 190, 0.28);
  background: rgba(6, 16, 26, 0.75);
  color: rgba(210, 230, 245, 0.92);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.72rem;
  line-height: 1.45;
}

.lan-scan-arp-import-error {
  margin: 0.4rem 0 0;
  font-size: 0.74rem;
  color: rgba(255, 140, 130, 0.9);
}

.lan-scan-router-auth {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.74rem;
  color: rgba(150, 185, 205, 0.75);
}

.lan-scan-router-auth input {
  width: 6.5rem;
  padding: 0.28rem 0.45rem;
  border-radius: 6px;
  border: 1px solid rgba(90, 150, 190, 0.28);
  background: rgba(6, 16, 26, 0.75);
  color: rgba(210, 230, 245, 0.92);
  font-size: 0.74rem;
}

.lan-scan-router-auth--pass input {
  width: 9rem;
}

.lan-scan-close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(136, 204, 238, 0.22);
  border-radius: 10px;
  background: rgba(8, 16, 28, 0.65);
  color: rgba(200, 220, 232, 0.88);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.lan-scan-close:hover {
  border-color: rgba(136, 204, 238, 0.5);
  background: rgba(14, 26, 42, 0.9);
}

.lan-scan-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.55rem;
  padding: 0.65rem 1rem 0;
  flex-shrink: 0;
}

.lan-scan-stat {
  padding: 0.55rem 0.7rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(10, 18, 30, 0.72);
}

.lan-scan-stat-value {
  display: block;
  font-size: 1.05rem;
  font-weight: 600;
  color: #dce8f0;
  font-variant-numeric: tabular-nums;
}

.lan-scan-stat-label {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.7rem;
  color: rgba(150, 180, 200, 0.65);
}

.lan-scan-stat--online .lan-scan-stat-value {
  color: #7ed4a8;
}

.lan-scan-stat--arp .lan-scan-stat-value {
  color: #8ab4e8;
}

.lan-scan-stat--ping .lan-scan-stat-value {
  color: #9ad4e8;
}

.lan-scan-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  padding: 0.7rem 1rem 0.55rem;
  flex-shrink: 0;
}

.lan-scan-mode {
  display: flex;
  gap: 0.25rem;
  padding: 0.2rem;
  border-radius: 10px;
  border: 1px solid rgba(136, 204, 238, 0.16);
  background: rgba(6, 12, 22, 0.75);
}

.lan-scan-mode-btn {
  padding: 0.32rem 0.62rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(170, 200, 215, 0.72);
  font-size: 0.75rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.lan-scan-mode-btn:hover:not(:disabled) {
  color: #dce8f0;
  background: rgba(136, 204, 238, 0.08);
}

.lan-scan-mode-btn--active {
  color: #dce8f0;
  background: rgba(70, 140, 175, 0.38);
}

.lan-scan-mode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lan-scan-search {
  flex: 1 1 220px;
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 0.7rem;
  border-radius: 10px;
  border: 1px solid rgba(136, 204, 238, 0.18);
  background: rgba(6, 12, 22, 0.85);
  color: rgba(160, 190, 210, 0.75);
}

.lan-scan-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: #dce8f0;
  font-size: 0.8125rem;
  outline: none;
}

.lan-scan-search input::placeholder {
  color: rgba(140, 170, 190, 0.45);
}

.lan-scan-subnet {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: rgba(160, 190, 210, 0.7);
}

.lan-scan-subnet input {
  width: 7.5rem;
  padding: 0.38rem 0.55rem;
  border-radius: 8px;
  border: 1px solid rgba(136, 204, 238, 0.18);
  background: rgba(6, 12, 22, 0.85);
  color: #dce8f0;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  outline: none;
}

.lan-scan-subnet input:focus {
  border-color: rgba(110, 200, 232, 0.45);
}

.lan-scan-subnet-suffix {
  color: rgba(140, 170, 190, 0.55);
  font-variant-numeric: tabular-nums;
}

.lan-scan-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.lan-scan-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  text-align: center;
}

.lan-scan-radar {
  position: relative;
  width: 88px;
  height: 88px;
  margin-bottom: 1.25rem;
}

.lan-scan-radar-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid rgba(110, 200, 232, 0.25);
  background: radial-gradient(circle, rgba(60, 140, 180, 0.12) 0%, transparent 68%);
}

.lan-scan-radar-sweep {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 0deg, rgba(110, 200, 232, 0.45) 42deg, transparent 84deg);
  animation: lan-radar-spin 2.4s linear infinite;
}

.lan-scan-radar-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  margin: -4px 0 0 -4px;
  border-radius: 50%;
  background: #6ec8e8;
  box-shadow: 0 0 12px rgba(110, 200, 232, 0.8);
}

@keyframes lan-radar-spin {
  to {
    transform: rotate(360deg);
  }
}

.lan-scan-loading-title {
  margin: 0;
  color: rgba(228, 240, 248, 0.92);
  font-size: 0.9375rem;
}

.lan-scan-progress-track {
  width: min(320px, 80%);
  height: 4px;
  margin-top: 1rem;
  border-radius: 999px;
  background: rgba(136, 204, 238, 0.12);
  overflow: hidden;
}

.lan-scan-progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #4a98b8, #6ec8e8);
  transition: width 0.25s ease;
}

.lan-scan-loading-meta {
  margin: 0.7rem 0 0;
  color: rgba(170, 200, 215, 0.62);
  font-size: 0.75rem;
}

.lan-scan-loading-note {
  margin: 0.55rem 0 0;
  color: rgba(150, 180, 200, 0.55);
  font-size: 0.72rem;
}

.lan-scan-idle {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: rgba(180, 210, 225, 0.72);
  font-size: 0.875rem;
}

.lan-scan-idle-hint {
  color: rgba(140, 175, 195, 0.55);
  font-size: 0.8rem;
}

.lan-scan-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: rgba(220, 180, 170, 0.9);
  font-size: 0.9rem;
  text-align: center;
}

.lan-scan-error-hint {
  margin: 0;
  color: rgba(170, 200, 215, 0.65);
  font-size: 0.8125rem;
  line-height: 1.55;
  max-width: 360px;
}

.lan-scan-error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
  margin-top: 0.35rem;
}

.lan-scan-grid-head {
  display: grid;
  align-items: center;
  gap: 0 0.5rem;
  padding: 0.45rem 0.85rem;
  border-bottom: 1px solid rgba(136, 204, 238, 0.12);
  background: rgba(8, 16, 28, 0.98);
  flex-shrink: 0;
}

.lan-scan-sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0;
  border: 0;
  background: transparent;
  color: rgba(155, 190, 210, 0.72);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: color 0.15s;
}

.lan-scan-sort-btn:hover,
.lan-scan-sort-btn--active {
  color: #8ec8e0;
}

.lan-scan-sort-arrow {
  font-size: 0.7rem;
  opacity: 0.85;
}

.lan-scan-virtual-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  contain: layout paint;
  padding: 0 0.35rem 0.5rem;
}

.lan-scan-virtual-spacer {
  position: relative;
  width: 100%;
}

.lan-scan-virtual-window {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
}

.lan-scan-row {
  display: grid;
  align-items: center;
  gap: 0 0.5rem;
  padding: 0 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  content-visibility: auto;
  contain-intrinsic-size: 46px;
}

.lan-scan-row--alt {
  background: rgba(255, 255, 255, 0.015);
}

.lan-scan-row:hover {
  background: rgba(110, 200, 232, 0.07);
}

.lan-scan-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  justify-self: center;
}

.lan-scan-status-dot--online {
  background: #5ecf98;
  box-shadow: 0 0 8px rgba(94, 207, 152, 0.55);
}

.lan-scan-status-dot--arp {
  background: #6a9fd8;
  box-shadow: 0 0 8px rgba(106, 159, 216, 0.45);
}

.lan-scan-cell {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
  color: rgba(220, 232, 240, 0.9);
  border: 0;
  background: transparent;
  text-align: left;
  padding: 0;
  cursor: default;
}

button.lan-scan-cell {
  cursor: pointer;
  position: relative;
}

button.lan-scan-cell:hover {
  color: #9ad4f0;
}

.lan-scan-cell--ip {
  color: #8ab4c4;
  font-variant-numeric: tabular-nums;
}

.lan-scan-cell--mono {
  font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  font-size: 0.76rem;
  color: rgba(195, 215, 228, 0.85);
}

.lan-scan-copied {
  position: absolute;
  top: -1.1rem;
  left: 0;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: rgba(60, 130, 160, 0.9);
  color: #fff;
  font-size: 0.65rem;
  white-space: nowrap;
  pointer-events: none;
}

.lan-scan-ping-cell {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}

.lan-scan-ping-badge {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.lan-scan-ping-badge--excellent {
  color: #6ee0a8;
}

.lan-scan-ping-badge--good {
  color: #8ed8b0;
}

.lan-scan-ping-badge--fair {
  color: #e8c878;
}

.lan-scan-ping-badge--slow {
  color: #e8a070;
}

.lan-scan-ping-badge--arp {
  color: #8ab4e8;
}

.lan-scan-ping-badge--unknown {
  color: rgba(180, 200, 210, 0.55);
}

.lan-scan-ping-bar {
  display: block;
  height: 2px;
  border-radius: 999px;
  max-width: 100%;
}

.lan-scan-ping-bar--excellent {
  background: linear-gradient(90deg, #3a9870, #6ee0a8);
}

.lan-scan-ping-bar--good {
  background: linear-gradient(90deg, #4a9878, #8ed8b0);
}

.lan-scan-ping-bar--fair {
  background: linear-gradient(90deg, #a08040, #e8c878);
}

.lan-scan-ping-bar--slow {
  background: linear-gradient(90deg, #a06040, #e8a070);
}

.lan-scan-empty {
  padding: 3rem 1rem;
  text-align: center;
  color: rgba(170, 195, 210, 0.55);
  font-size: 0.875rem;
}

.lan-scan-btn {
  padding: 0.42rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(136, 204, 238, 0.32);
  background: rgba(50, 110, 140, 0.38);
  color: #dce8f0;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  white-space: nowrap;
}

.lan-scan-btn:hover:not(:disabled) {
  background: rgba(70, 140, 175, 0.48);
  border-color: rgba(136, 204, 238, 0.5);
}

.lan-scan-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.lan-scan-btn--ghost {
  background: transparent;
  border-color: rgba(136, 204, 238, 0.2);
}

.lan-scan-btn--ghost:hover:not(:disabled) {
  background: rgba(136, 204, 238, 0.08);
}

@media (max-width: 800px) {
  .lan-scan-panel {
    height: min(92vh, 900px);
  }

  .lan-scan-stats {
    grid-template-columns: repeat(2, 1fr);
  }

  .lan-scan-grid-head,
  .lan-scan-row {
    grid-template-columns: 28px 1fr 1fr 88px !important;
  }

  .lan-scan-grid-head .lan-scan-sort-btn:nth-child(4),
  .lan-scan-grid-head .lan-scan-sort-btn:nth-child(5),
  .lan-scan-row .lan-scan-cell:nth-child(4),
  .lan-scan-row .lan-scan-cell:nth-child(5) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .lan-scan-radar-sweep {
    animation: none;
  }

  .lan-scan-progress-bar {
    transition: none;
  }
}
</style>
