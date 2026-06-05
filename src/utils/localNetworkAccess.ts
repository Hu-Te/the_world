/** Trigger Chrome Private Network Access via Image (less strict than fetch/XHR). */
export function requestLocalNetworkViaImage(gatewayIp: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    let settled = false

    const finish = (ok: boolean) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      img.onload = null
      img.onerror = null
      resolve(ok)
    }

    const timer = window.setTimeout(() => finish(false), 4000)
    img.onload = () => finish(true)
    img.onerror = () => finish(true)
    img.src = `http://${gatewayIp}/favicon.ico?lan_access=${Date.now()}`
  })
}

export async function ensureLocalNetworkAccess(
  gatewayIp: string,
  signal?: AbortSignal,
): Promise<boolean> {
  if (signal?.aborted) return false
  return requestLocalNetworkViaImage(gatewayIp)
}
