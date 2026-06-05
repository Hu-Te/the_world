import type { ScanDeviceRecord } from '@/utils/lanScanDevice'

const DEFAULT_PORT = 8787
const PROBE_TIMEOUT_MS = 1500

let cachedBase: string | null | undefined

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false
  if (parts[0] === 10) return true
  if (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  return parts[0] === 127
}

/** Discover the user's LAN IPv4 via WebRTC ICE (no media). */
export async function discoverLocalIpv4(timeoutMs = 2500): Promise<string | null> {
  if (typeof RTCPeerConnection === 'undefined') return null

  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    let settled = false

    const finish = (value: string | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      pc.close()
      resolve(value)
    }

    const timer = window.setTimeout(() => finish(null), timeoutMs)

    pc.createDataChannel('probe')
    pc.onicecandidate = (event) => {
      const candidate = event.candidate?.candidate
      if (!candidate) return
      const match = /(\d{1,3}(?:\.\d{1,3}){3})/.exec(candidate)
      if (match && isPrivateIpv4(match[1]!)) finish(match[1]!)
    }

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finish(null))
  })
}

function buildCandidateBases(localIp: string | null): string[] {
  const envUrl = (import.meta.env.VITE_LOCAL_SCANNER_URL as string | undefined)?.replace(/\/$/, '')
  const bases = new Set<string>()
  if (envUrl) bases.add(envUrl)
  bases.add(`http://127.0.0.1:${DEFAULT_PORT}`)
  bases.add(`http://localhost:${DEFAULT_PORT}`)
  if (localIp) bases.add(`http://${localIp}:${DEFAULT_PORT}`)
  return [...bases]
}

async function probeArpEndpoint(base: string, signal?: AbortSignal): Promise<boolean> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  const linked =
    signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal

  try {
    const response = await fetch(`${base}/api/v1/network/arp?subnet=192.168.1`, {
      signal: linked,
      method: 'GET',
    })
    return response.ok
  } catch {
    return false
  } finally {
    window.clearTimeout(timer)
  }
}

/** Try localhost / LAN Java backend for ARP when the page is served from a public host. */
export async function resolveLocalArpHelper(signal?: AbortSignal): Promise<string | null> {
  if (cachedBase !== undefined) return cachedBase

  const localIp = await discoverLocalIpv4()
  for (const base of buildCandidateBases(localIp)) {
    if (await probeArpEndpoint(base, signal)) {
      cachedBase = base
      return base
    }
  }

  cachedBase = null
  return null
}

export function resetLocalArpHelperCache() {
  cachedBase = undefined
}

export async function fetchArpFromLocalHelper(
  subnet: string,
  signal?: AbortSignal,
): Promise<ScanDeviceRecord[] | null> {
  const base = await resolveLocalArpHelper(signal)
  if (!base) return null

  const prefix = subnet.trim()
  const url = `${base}/api/v1/network/arp?subnet=${encodeURIComponent(prefix)}`

  try {
    const response = await fetch(url, { signal })
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
