export interface ScanDeviceRecord {
  ipAddress: string
  hostName: string
  macAddress: string
  vendor: string
  pingTimeMs: number
}

export type DeviceStatus = 'online' | 'arp'
export type PingTier = 'excellent' | 'good' | 'fair' | 'slow' | 'arp' | 'unknown'

export interface EnrichedDevice {
  ipAddress: string
  hostName: string
  macAddress: string
  vendor: string
  pingTimeMs: number
  status: DeviceStatus
  pingTier: PingTier
  displayMac: string
  displayVendor: string
  displayPing: string
  ipSortKey: number
}

export type SortKey = 'ipAddress' | 'hostName' | 'macAddress' | 'vendor' | 'pingTimeMs'
export type SortDir = 'asc' | 'desc'

const IP_SORT_CACHE = new Map<string, number>()
const UNAVAILABLE_MARKERS = new Set(['Unknown', 'Unavailable', ''])

export function ipToSortKey(ip: string): number {
  const cached = IP_SORT_CACHE.get(ip)
  if (cached !== undefined) return cached

  const parts = ip.split('.')
  if (parts.length !== 4) return 0

  const value =
    Number(parts[0]) * 16_777_216 +
    Number(parts[1]) * 65_536 +
    Number(parts[2]) * 256 +
    Number(parts[3])

  IP_SORT_CACHE.set(ip, value)
  return value
}

export function resolvePingTier(pingMs: number, status: DeviceStatus): PingTier {
  if (status === 'arp') return 'arp'
  if (pingMs <= 0) return 'unknown'
  if (pingMs <= 10) return 'excellent'
  if (pingMs <= 50) return 'good'
  if (pingMs <= 200) return 'fair'
  return 'slow'
}

function formatUnavailable(value: string, sandboxLabel: string): string {
  if (value === 'Unavailable') return sandboxLabel
  if (!value || value === 'Unknown') return 'N/A'
  return value
}

export function enrichDevice(device: ScanDeviceRecord): EnrichedDevice {
  const hasMac = device.macAddress && !UNAVAILABLE_MARKERS.has(device.macAddress)
  const status: DeviceStatus = device.pingTimeMs > 0 ? 'online' : hasMac ? 'arp' : 'online'
  const pingTier = resolvePingTier(device.pingTimeMs, status)

  return {
    ...device,
    status,
    pingTier,
    displayMac: hasMac ? device.macAddress.toUpperCase() : formatUnavailable(device.macAddress, '不可用'),
    displayVendor: formatUnavailable(device.vendor, '不可用'),
    displayPing: device.pingTimeMs > 0 ? `${device.pingTimeMs} ms` : '—',
    ipSortKey: ipToSortKey(device.ipAddress),
  }
}

export function enrichDevices(devices: ScanDeviceRecord[]): EnrichedDevice[] {
  return devices.map(enrichDevice)
}

export function filterDevices(devices: EnrichedDevice[], query: string): EnrichedDevice[] {
  const q = query.trim().toLowerCase()
  if (!q) return devices

  return devices.filter((d) => {
    const haystack = `${d.ipAddress} ${d.hostName} ${d.displayMac} ${d.displayVendor}`.toLowerCase()
    return haystack.includes(q)
  })
}

function compareString(a: string, b: string, dir: SortDir): number {
  const result = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  return dir === 'asc' ? result : -result
}

export function sortDevices(
  devices: EnrichedDevice[],
  key: SortKey,
  dir: SortDir,
): EnrichedDevice[] {
  const sorted = [...devices]
  sorted.sort((a, b) => {
    if (key === 'ipAddress') {
      const diff = a.ipSortKey - b.ipSortKey
      return dir === 'asc' ? diff : -diff
    }
    if (key === 'pingTimeMs') {
      const aPing = a.pingTimeMs > 0 ? a.pingTimeMs : dir === 'asc' ? Number.MAX_SAFE_INTEGER : -1
      const bPing = b.pingTimeMs > 0 ? b.pingTimeMs : dir === 'asc' ? Number.MAX_SAFE_INTEGER : -1
      const diff = aPing - bPing
      return dir === 'asc' ? diff : -diff
    }
    if (key === 'macAddress') return compareString(a.displayMac, b.displayMac, dir)
    if (key === 'vendor') return compareString(a.displayVendor, b.displayVendor, dir)
    return compareString(a.hostName, b.hostName, dir)
  })
  return sorted
}

export function buildScanStats(devices: EnrichedDevice[]) {
  const online = devices.filter((d) => d.status === 'online').length
  const arpOnly = devices.filter((d) => d.status === 'arp').length
  const pingSamples = devices.filter((d) => d.pingTimeMs > 0).map((d) => d.pingTimeMs)
  const avgPing =
    pingSamples.length > 0
      ? Math.round(pingSamples.reduce((sum, ms) => sum + ms, 0) / pingSamples.length)
      : 0

  const macKnown = devices.filter(
    (d) => d.displayMac !== '不可用' && d.displayMac !== 'N/A',
  ).length

  return { total: devices.length, online, arpOnly, macKnown, avgPing }
}

export function buildCsv(devices: EnrichedDevice[]): string {
  const header = 'IP,Hostname,MAC,Vendor,Latency(ms),Status'
  const rows = devices.map((d) => {
    const status = d.status === 'online' ? 'Online' : 'ARP'
    const fields = [
      d.ipAddress,
      d.hostName,
      d.displayMac === '不可用' ? '' : d.displayMac,
      d.displayVendor === '不可用' ? '' : d.displayVendor,
      d.pingTimeMs > 0 ? String(d.pingTimeMs) : '',
      status,
    ]
    return fields.map((f) => `"${f.replace(/"/g, '""')}"`).join(',')
  })
  return [header, ...rows].join('\n')
}
