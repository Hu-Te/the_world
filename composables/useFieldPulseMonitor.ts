/**
 * 平台监控会话编排（与工脉 Cabin 共享 API 语义，避免复制神组件）。
 */
import {
  listDevices,
  startDeviceSession,
  stopDeviceSession,
  type PlcDevice,
} from '~/utils/console/fieldpulseApi'

export function useFieldPulseMonitor() {
  const devices = ref<PlcDevice[]>([])
  const error = ref('')
  const loading = ref(false)

  async function refresh() {
    loading.value = true
    error.value = ''
    try {
      devices.value = await listDevices()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  }

  async function start(id: string) {
    await startDeviceSession(id)
    await refresh()
  }

  async function stop(id: string) {
    await stopDeviceSession(id)
    await refresh()
  }

  return { devices, error, loading, refresh, start, stop }
}
