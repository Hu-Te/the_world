import { probeHostViaApiProxy, resolveApiProxyUsable } from '@/utils/networkScanApi'
import { ensureLocalNetworkAccess } from '@/utils/localNetworkAccess'

export interface LocalScanDevice {
  ipAddress: string
  hostName: string
  macAddress: string
  vendor: string
  pingTimeMs: number
}

export class LocalNetworkScanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocalNetworkScanError'
  }
}

export interface LocalScanCallbacks {
  onProgress?: (scanned: number, total: number) => void
  onDeviceFound?: (device: LocalScanDevice) => void
}

export interface LocalScanOptions {
  useApiProxy?: boolean
  skipLanPermission?: boolean
  /** Visitor mode: image-only probes avoid fetch/XHR that Chrome blocks with PNA. */
  imageOnlyProbe?: boolean
}

const SUBNET_PATTERN = /^(?:\d{1,3}\.){2}\d{1,3}$/
const DEFAULT_SUBNET = '192.168.1'
const HOST_MIN = 1
const HOST_MAX = 254
const BATCH_SIZE = 10
const PROBE_TIMEOUT_MS = 800

export function guessLocalSubnetPrefix(): string {
  return DEFAULT_SUBNET
}

export function sanitizeSubnetInput(raw: string): string {
  let value = raw.trim()
  value = value.replace(/\.0\/24$/i, '').replace(/\/24$/i, '')
  const parts = value.split('.')
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    return parts.slice(0, 3).join('.')
  }
  return value
}

export function normalizeSubnetPrefix(raw: string): string {
  const trimmed = sanitizeSubnetInput(raw)
  if (!SUBNET_PATTERN.test(trimmed)) {
    throw new LocalNetworkScanError('Invalid subnet prefix. Use format like 192.168.1')
  }
  for (const octet of trimmed.split('.')) {
    const value = Number(octet)
    if (value < 0 || value > 255) {
      throw new LocalNetworkScanError(`Subnet octet out of range: ${octet}`)
    }
  }
  return trimmed
}

function linkAbortSignals(primary: AbortSignal, secondary: AbortSignal): AbortSignal {
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([primary, secondary])
  }
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (primary.aborted || secondary.aborted) {
    controller.abort()
    return controller.signal
  }
  primary.addEventListener('abort', abort, { once: true })
  secondary.addEventListener('abort', abort, { once: true })
  return controller.signal
}

function probeViaImage(url: string, signal: AbortSignal): Promise<number | null> {
  return new Promise((resolve) => {
    const started = performance.now()
    const img = new Image()
    let settled = false

    const finish = (alive: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(alive ? Math.round(performance.now() - started) : null)
    }

    const timer = window.setTimeout(() => finish(false), PROBE_TIMEOUT_MS)
    signal.addEventListener('abort', () => finish(false), { once: true })

    img.onload = () => finish(true)
    img.onerror = () => finish(true)
    img.src = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`
  })
}

async function probeViaFetch(url: string, signal: AbortSignal): Promise<number | null> {
  const started = performance.now()
  const timeoutController = new AbortController()
  const timer = window.setTimeout(() => timeoutController.abort(), PROBE_TIMEOUT_MS)
  const linked = linkAbortSignals(signal, timeoutController.signal)

  try {
    await fetch(url, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: linked,
    })
    return Math.round(performance.now() - started)
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

async function probeViaBrowser(
  ip: string,
  signal: AbortSignal,
  imageOnly: boolean,
): Promise<LocalScanDevice | null> {
  const faviconLatency = await probeViaImage(`http://${ip}/favicon.ico`, signal)
  if (faviconLatency !== null) {
    return buildDevice(ip, faviconLatency)
  }

  const rootImgLatency = await probeViaImage(`http://${ip}/`, signal)
  if (rootImgLatency !== null) {
    return buildDevice(ip, rootImgLatency)
  }

  if (!imageOnly) {
    const fetchLatency = await probeViaFetch(`http://${ip}/`, signal)
    if (fetchLatency !== null) {
      return buildDevice(ip, fetchLatency)
    }
  }

  return null
}

async function probeViaProxy(ip: string, signal: AbortSignal): Promise<LocalScanDevice | null> {
  const result = await probeHostViaApiProxy(ip, signal, PROBE_TIMEOUT_MS)
  if (!result?.alive) return null
  return buildDevice(ip, result.pingTimeMs)
}

function buildDevice(ip: string, pingTimeMs: number): LocalScanDevice {
  return {
    ipAddress: ip,
    hostName: ip,
    macAddress: 'Unavailable',
    vendor: 'Unavailable',
    pingTimeMs,
  }
}

async function probeHost(
  ip: string,
  signal: AbortSignal,
  useApiProxy: boolean,
  imageOnly: boolean,
): Promise<LocalScanDevice | null> {
  if (useApiProxy) {
    return probeViaProxy(ip, signal)
  }
  return probeViaBrowser(ip, signal, imageOnly)
}

/**
 * LAN sweep with optional per-host API proxy (dynamic subnet from user input).
 */
export async function scanLocalNetwork(
  subnetPrefix: string,
  signal?: AbortSignal,
  callbacks: LocalScanCallbacks = {},
  options: LocalScanOptions = {},
): Promise<LocalScanDevice[]> {
  const prefix = normalizeSubnetPrefix(subnetPrefix)
  const abortSignal = signal ?? new AbortController().signal
  const useApiProxy = options.useApiProxy ?? (await resolveApiProxyUsable(abortSignal))
  const imageOnly = options.imageOnlyProbe ?? false

  if (!useApiProxy && !options.skipLanPermission) {
    await ensureLocalNetworkAccess(`${prefix}.1`, abortSignal)
  }

  const discovered: LocalScanDevice[] = []
  const total = HOST_MAX - HOST_MIN + 1
  let scanned = 0

  for (let batchStart = HOST_MIN; batchStart <= HOST_MAX; batchStart += BATCH_SIZE) {
    if (abortSignal.aborted) break

    const batchEnd = Math.min(HOST_MAX, batchStart + BATCH_SIZE - 1)
    const tasks: Promise<LocalScanDevice | null>[] = []

    for (let host = batchStart; host <= batchEnd; host++) {
      const ip = `${prefix}.${host}`
      tasks.push(probeHost(ip, abortSignal, useApiProxy, imageOnly))
    }

    const batchResults = await Promise.all(tasks)
    for (const device of batchResults) {
      scanned++
      callbacks.onProgress?.(scanned, total)
      if (!device) continue
      discovered.push(device)
      callbacks.onDeviceFound?.(device)
    }
  }

  discovered.sort((a, b) => {
    const pa = a.ipAddress.split('.').map(Number)
    const pb = b.ipAddress.split('.').map(Number)
    for (let i = 0; i < 4; i++) {
      if (pa[i] !== pb[i]) return pa[i]! - pb[i]!
    }
    return 0
  })

  return discovered
}

export function isBrowserScanLimited(): boolean {
  return window.isSecureContext && window.location.protocol === 'https:'
}
