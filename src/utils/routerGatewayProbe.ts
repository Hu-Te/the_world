import { discoverLocalIpv4 } from '@/utils/localArpHelper'
import { parseArpTableText } from '@/utils/parseArpTableText'
import type { ScanDeviceRecord } from '@/utils/lanScanDevice'

export interface RouterAuth {
  username: string
  password: string
}

export interface RouterPageCapture {
  url: string
  body: string
}

const ROUTER_PATHS = [
  '/userRpm/AssignedIpAddrList.htm',
  '/cgi-bin/luci/admin/dhcp/dhcp',
  '/api/devices',
  '/api/lanhosts',
]

const FETCH_TIMEOUT_MS = 1800

function buildGatewayCandidates(subnet: string, localIp: string | null): string[] {
  const candidates = new Set<string>([`${subnet}.1`])
  if (localIp) {
    const parts = localIp.split('.')
    if (parts.length === 4) {
      candidates.add(`${parts[0]}.${parts[1]}.${parts[2]}.1`)
    }
  }
  return [...candidates]
}

async function fetchRouterPage(
  url: string,
  auth?: RouterAuth,
  signal?: AbortSignal,
): Promise<string | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const linked =
    signal && typeof AbortSignal.any === 'function'
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal

  const headers: HeadersInit = {}
  if (auth?.username || auth?.password) {
    headers.Authorization = `Basic ${btoa(`${auth.username}:${auth.password}`)}`
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: linked,
    })
    if (!response.ok) return null
    const body = await response.text()
    return body.trim() ? body : null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

/**
 * Router pages are often blocked by CORS from a public site.
 * Only attempt when credentials are provided; run requests in parallel.
 */
export async function probeRouterPages(
  subnet: string,
  auth?: RouterAuth,
  signal?: AbortSignal,
): Promise<RouterPageCapture[]> {
  if (!auth?.password?.trim()) {
    return []
  }

  const localIp = await discoverLocalIpv4(1200)
  const gateways = buildGatewayCandidates(subnet, localIp)
  const tasks: Promise<RouterPageCapture | null>[] = []

  for (const gateway of gateways) {
    for (const path of ROUTER_PATHS) {
      const url = `http://${gateway}${path}`
      tasks.push(
        fetchRouterPage(url, auth, signal).then((body) => (body ? { url, body } : null)),
      )
    }
  }

  const settled = await Promise.all(tasks)
  return settled.filter((item): item is RouterPageCapture => item !== null)
}

const DEVICE_MAC_PATHS = [
  '/api/device/info',
  '/api/v1/device',
  '/status',
  '/info',
]

/** Try reading MAC from LAN devices that expose open CORS JSON APIs (rare). */
export async function probeDeviceMacFromAlive(
  devices: ScanDeviceRecord[],
  subnet: string,
  signal?: AbortSignal,
): Promise<ScanDeviceRecord[]> {
  const enriched = [...devices]

  await Promise.all(
    enriched.map(async (device, index) => {
      if (signal?.aborted) return
      if (device.macAddress && device.macAddress !== 'Unavailable') return

      for (const path of DEVICE_MAC_PATHS) {
        const url = `http://${device.ipAddress}${path}`
        try {
          const response = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            signal,
          })
          if (!response.ok) continue
          const text = await response.text()
          const parsed = parseArpTableText(text, subnet)
          const match = parsed.find((entry) => entry.ipAddress === device.ipAddress)
          if (match) {
            enriched[index] = {
              ...device,
              macAddress: match.macAddress,
              vendor: match.vendor,
            }
            break
          }
        } catch {
          // CORS or unreachable
        }
      }
    }),
  )

  return enriched
}
