import type { ScanDeviceRecord } from '@/utils/lanScanDevice'

/** macOS / BSD: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 */
const BSD_PATTERN =
  /\((\d{1,3}(?:\.\d{1,3}){3})\)\s+at\s+([0-9a-f:]+)/gi

/** Linux: 192.168.1.1 ether aa:bb:cc:dd:ee:ff */
const LINUX_PATTERN =
  /(\d{1,3}(?:\.\d{1,3}){3})\s+\w+\s+([0-9a-f:]+)/gi

/** Windows: 192.168.1.1    aa-bb-cc-dd-ee-ff    dynamic */
const WINDOWS_PATTERN =
  /(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-f]{2}(?:-[0-9a-f]{2}){5})/gi

function normalizeMac(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed || trimmed === 'incomplete') return null
  const colonized = trimmed.replace(/-/g, ':')
  if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(colonized)) return null
  return colonized
}

function collectMatches(
  text: string,
  pattern: RegExp,
  table: Map<string, string>,
  subnetPrefix: string | null,
) {
  pattern.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    const ip = match[1]!
    if (subnetPrefix && !ip.startsWith(`${subnetPrefix}.`)) continue
    const mac = normalizeMac(match[2]!)
    if (mac) table.set(ip, mac)
  }
}

/** Parse pasted `arp -a` output (macOS / Linux / Windows). */
export function parseArpTableText(text: string, subnetPrefix?: string): ScanDeviceRecord[] {
  const prefix = subnetPrefix?.trim() || null
  const table = new Map<string, string>()

  collectMatches(text, BSD_PATTERN, table, prefix)
  collectMatches(text, LINUX_PATTERN, table, prefix)
  collectMatches(text, WINDOWS_PATTERN, table, prefix)

  return [...table.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([ipAddress, macAddress]) => ({
      ipAddress,
      hostName: ipAddress,
      macAddress,
      vendor: 'Unknown',
      pingTimeMs: 0,
    }))
}
