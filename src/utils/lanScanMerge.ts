import type { ScanDeviceRecord } from '@/utils/lanScanDevice'

const UNAVAILABLE = new Set(['Unknown', 'Unavailable', ''])

function isRealValue(value: string): boolean {
  return Boolean(value) && !UNAVAILABLE.has(value)
}

function pickRicherString(server: string, browser: string): string {
  if (isRealValue(server)) return server
  if (isRealValue(browser)) return browser
  return server || browser || 'Unavailable'
}

function pickLatency(server: number, browser: number): number {
  if (server > 0 && browser > 0) return Math.min(server, browser)
  return server > 0 ? server : browser
}

function pickHostname(server: ScanDeviceRecord, browser: ScanDeviceRecord): string {
  const serverName = server.hostName
  const browserName = browser.hostName
  if (serverName && serverName !== server.ipAddress) return serverName
  if (browserName && browserName !== browser.ipAddress) return browserName
  return server.ipAddress
}

export type ScanSourceMode = 'hybrid' | 'browser' | 'server'

export interface MergeSummary {
  mode: ScanSourceMode
  browserCount: number
  serverCount: number
  mergedCount: number
}

export function mergeScanResults(
  browser: ScanDeviceRecord[],
  server: ScanDeviceRecord[],
): { devices: ScanDeviceRecord[]; summary: MergeSummary } {
  const map = new Map<string, ScanDeviceRecord>()

  for (const device of browser) {
    map.set(device.ipAddress, { ...device })
  }

  for (const device of server) {
    const existing = map.get(device.ipAddress)
    if (!existing) {
      map.set(device.ipAddress, { ...device })
      continue
    }

    map.set(device.ipAddress, {
      ipAddress: device.ipAddress,
      hostName: pickHostname(device, existing),
      macAddress: pickRicherString(device.macAddress, existing.macAddress),
      vendor: pickRicherString(device.vendor, existing.vendor),
      pingTimeMs: pickLatency(device.pingTimeMs, existing.pingTimeMs),
    })
  }

  const devices = [...map.values()].sort((a, b) => {
    const pa = a.ipAddress.split('.').map(Number)
    const pb = b.ipAddress.split('.').map(Number)
    for (let i = 0; i < 4; i++) {
      if (pa[i] !== pb[i]) return pa[i]! - pb[i]!
    }
    return 0
  })

  let mode: ScanSourceMode = 'hybrid'
  if (browser.length === 0 && server.length > 0) mode = 'server'
  if (browser.length > 0 && server.length === 0) mode = 'browser'

  return {
    devices,
    summary: {
      mode,
      browserCount: browser.length,
      serverCount: server.length,
      mergedCount: devices.length,
    },
  }
}

export function formatScanModeLabel(summary: MergeSummary, arpEnriched = false): string {
  const arpNote = arpEnriched ? ' · 已补全 MAC' : ''
  if (summary.mode === 'hybrid') {
    return `混合扫描 · 浏览器 ${summary.browserCount} + 服务端 ${summary.serverCount} → ${summary.mergedCount} 台${arpNote}`
  }
  if (summary.mode === 'server') {
    return `服务端扫描 · ${summary.mergedCount} 台（含 ICMP / ARP）${arpNote}`
  }
  return `浏览器扫描 · ${summary.mergedCount} 台${arpNote}`
}

export function countMacKnown(devices: ScanDeviceRecord[]): number {
  return devices.filter((d) => isRealValue(d.macAddress)).length
}

export function formatVisitorScanLabel(
  deviceCount: number,
  macResolved: number,
  routerPageCount: number,
): string {
  const macNote = macResolved > 0 ? ` · 已识别 ${macResolved} 个 MAC` : ''
  const routerNote =
    routerPageCount > 0
      ? '浏览器探测 + 云端解析'
      : macResolved > 0
        ? '浏览器探测 + 本机助手'
        : '浏览器探测（请允许访问本地网络）'
  return `访客扫描 · ${routerNote} · ${deviceCount} 台${macNote}`
}
