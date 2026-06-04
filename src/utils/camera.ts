/** 摄像头是否可用（HTTPS 或 localhost） */
export function isCameraContextAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext
}

export function getCameraErrorMessage(err: unknown): string {
  if (!isCameraContextAvailable()) {
    return [
      '当前为 HTTP 访问，浏览器不允许调用摄像头。',
      '请改用：https://本机IP:5173/world',
      '或在电脑上打开：http://localhost:5173/world',
    ].join('\n')
  }

  const name = err instanceof DOMException ? err.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '摄像头权限被拒绝，请在浏览器地址栏允许摄像头访问。'
  }
  if (name === 'NotFoundError') {
    return '未检测到摄像头设备。'
  }

  return '无法开启摄像头，请检查浏览器权限与 HTTPS 环境。'
}
