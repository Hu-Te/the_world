import { NETWORK_SCAN_API } from '@/config/api'
import { appApiFetch } from '@/utils/apiAuth'
import type { ScanDeviceRecord } from '@/utils/lanScanDevice'
import type { RouterPageCapture } from '@/utils/routerGatewayProbe'

export interface VisitorEnrichResult {
  devices: ScanDeviceRecord[]
  macResolved: number
  enrichSource: string
}

export async function enrichVisitorScan(
  subnet: string,
  devices: ScanDeviceRecord[],
  routerPages: RouterPageCapture[],
  signal?: AbortSignal,
): Promise<VisitorEnrichResult | null> {
  const url = `${NETWORK_SCAN_API}/visitor-scan/enrich`

  try {
    const response = await appApiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subnet,
        devices: devices.map((device) => ({
          ipAddress: device.ipAddress,
          hostName: device.hostName,
          pingTimeMs: device.pingTimeMs,
        })),
        routerPages,
      }),
      signal,
    })
    if (!response.ok) return null

    const data = (await response.json()) as {
      devices: {
        ipAddress: string
        hostName: string
        macAddress: string
        vendor: string
        pingTimeMs: number
      }[]
      macResolved: number
      enrichSource: string
    }

    if (!Array.isArray(data.devices)) return null

    return {
      macResolved: data.macResolved ?? 0,
      enrichSource: data.enrichSource ?? 'browser-probe',
      devices: data.devices.map((entry) => ({
        ipAddress: entry.ipAddress,
        hostName: entry.hostName,
        macAddress: entry.macAddress,
        vendor: entry.vendor,
        pingTimeMs: entry.pingTimeMs,
      })),
    }
  } catch {
    return null
  }
}
