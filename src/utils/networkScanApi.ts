import { NETWORK_SCAN_API } from '@/config/api'
import { appApiFetch } from '@/utils/apiAuth'
import { fetchArpFromLocalHelper } from '@/utils/localArpHelper'
import type { ScanDeviceRecord } from '@/utils/lanScanDevice'

export interface ServerScanResult {
  devices: ScanDeviceRecord[]
  subnet: string
  durationMs: number
}

export interface ProbeProxyResult {
  ipAddress: string
  alive: boolean
  pingTimeMs: number
}

function toDeviceRecord(raw: {
  ipAddress: string
  hostName: string
  macAddress: string
  vendor: string
  pingTimeMs: number
}): ScanDeviceRecord {
  return {
    ipAddress: raw.ipAddress,
    hostName: raw.hostName,
    macAddress: raw.macAddress,
    vendor: raw.vendor,
    pingTimeMs: raw.pingTimeMs,
  }
}

let proxyAvailabilityCache: boolean | null = null

function isPrivateIpv4Host(host: string): boolean {
  const normalized = host.trim().toLowerCase()
  if (normalized === 'localhost') return true

  const parts = normalized.split('.')
  if (parts.length !== 4 || !parts.every((p) => /^\d+$/.test(p))) {
    return false
  }

  const octets = parts.map(Number)
  if (octets[0] === 10) return true
  if (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) return true
  if (octets[0] === 192 && octets[1] === 168) return true
  return octets[0] === 127
}

/** Backend on same LAN as the user (local dev / LAN IP). Public cloud cannot scan home subnets. */
export function isBackendOnUserLan(): boolean {
  const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.trim()
  if (apiOrigin) {
    try {
      const url = new URL(apiOrigin.includes('://') ? apiOrigin : `http://${apiOrigin}`)
      return isPrivateIpv4Host(url.hostname)
    } catch {
      return false
    }
  }
  return isPrivateIpv4Host(window.location.hostname)
}

export function resetProxyAvailabilityCache() {
  proxyAvailabilityCache = null
}

async function probeApiProxyReachable(signal?: AbortSignal): Promise<boolean> {
  if (proxyAvailabilityCache !== null) return proxyAvailabilityCache

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), 2000)
  const linked =
    signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal

  try {
    const response = await appApiFetch(
      `${NETWORK_SCAN_API}/probe?ip=10.0.0.1&timeout=200`,
      { signal: linked, method: 'GET' },
    )
    proxyAvailabilityCache = response.ok
    return proxyAvailabilityCache
  } catch {
    proxyAvailabilityCache = false
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

export async function resolveApiProxyUsable(signal?: AbortSignal): Promise<boolean> {
  if (!isBackendOnUserLan()) return false
  return probeApiProxyReachable(signal)
}

export async function probeHostViaApiProxy(
  ip: string,
  signal?: AbortSignal,
  timeoutMs = 800,
): Promise<ProbeProxyResult | null> {
  const url = `${NETWORK_SCAN_API}/probe?ip=${encodeURIComponent(ip)}&timeout=${timeoutMs}`

  try {
    const response = await appApiFetch(url, { signal })
    if (!response.ok) return null
    const data = (await response.json()) as ProbeProxyResult
    return data
  } catch {
    return null
  }
}

async function fetchArpFromApi(
  baseUrl: string,
  subnet: string,
  signal?: AbortSignal,
): Promise<ScanDeviceRecord[] | null> {
  const prefix = subnet.trim()
  const url = `${baseUrl}/arp?subnet=${encodeURIComponent(prefix)}`

  try {
    const response = await appApiFetch(url, { signal })
    if (!response.ok) return null
    const data = (await response.json()) as {
      ipAddress: string
      macAddress: string
      vendor: string
    }[]
    if (!Array.isArray(data)) return null
    return data.map((entry) => ({
      ipAddress: entry.ipAddress,
      hostName: entry.ipAddress,
      macAddress: entry.macAddress,
      vendor: entry.vendor,
      pingTimeMs: 0,
    }))
  } catch {
    return null
  }
}

/**
 * LAN backend reads OS ARP table. Public cloud cannot see visitor LAN.
 * Optional local Java on 127.0.0.1 only when VITE_LOCAL_SCANNER_URL is configured.
 */
export async function fetchArpEnrichment(
  subnet: string,
  signal?: AbortSignal,
  options?: { allowLocalHelper?: boolean },
): Promise<ScanDeviceRecord[] | null> {
  if (isBackendOnUserLan()) {
    return fetchArpFromApi(NETWORK_SCAN_API, subnet, signal)
  }
  if (!options?.allowLocalHelper) {
    return null
  }
  const envUrl = (import.meta.env.VITE_LOCAL_SCANNER_URL as string | undefined)?.trim()
  if (!envUrl) {
    return null
  }
  return fetchArpFromLocalHelper(subnet, signal)
}

export async function fetchServerLanDevices(
  subnet: string,
  timeoutMs = 1000,
  signal?: AbortSignal,
): Promise<ServerScanResult | null> {
  const prefix = subnet.trim()
  const url = `${NETWORK_SCAN_API}/deep-scan?subnet=${encodeURIComponent(prefix)}&timeout=${timeoutMs}`
  const startedAt = performance.now()

  let response: Response
  try {
    response = await appApiFetch(url, { signal })
  } catch {
    return null
  }

  if (!response.ok) return null

  const data = (await response.json()) as ScanDeviceRecord[]
  return {
    devices: Array.isArray(data) ? data.map(toDeviceRecord) : [],
    subnet: prefix,
    durationMs: Math.round(performance.now() - startedAt),
  }
}
