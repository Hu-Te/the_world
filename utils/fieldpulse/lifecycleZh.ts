/** 将后端/PLC4X 生命周期与接口错误转为中文展示 */

const EXACT: Record<string, string> = {
  'batch read ok': '批量读取成功',
  'ping ok': '连通探测成功',
  connected: '已连接',
  'read ok': '读取成功',
  'disconnect requested': '已停止会话',
  'server stopped': '监听服务已停止',
  'read failed': '读取失败',
  'S7 read failed': '读取失败',
  'ping failed': '连通探测失败',
  'batch read failed': '批量读取失败',
  'callback failed': '回调处理失败',
  unknown: '未知错误',
  'CRC mismatch': '帧尾 CRC 校验失败',
  'bind setup failed': '监听服务启动失败',
  'server channel closed': '监听通道已关闭',
  'all device channels down; waiting': '设备已断开，等待重新连入',
  'Connection is not possible.': '无法连接 PLC（请检查 IP/端口/机架/插槽，以及设备是否在线）',
  'Connection is not possible': '无法连接 PLC（请检查 IP/端口/机架/插槽，以及设备是否在线）',
  'ip is required': '请填写 PLC IP 地址',
  'tags is required': '请至少配置一个点位',
}

function stripFqcn(raw: string): string {
  const colon = raw.indexOf(':')
  if (colon > 0 && /Exception\s*$/.test(raw.slice(0, colon))) {
    return raw.slice(colon + 1).trim()
  }
  return raw.replace(/^[a-zA-Z0-9_.]+Exception:\s*/g, '').trim()
}

export function lifecycleReasonZh(reason: string | null | undefined): string {
  const raw = (reason || '').trim()
  if (!raw) return ''
  if (EXACT[raw]) return EXACT[raw]

  const stripped = stripFqcn(raw)
  if (EXACT[stripped]) return EXACT[stripped]

  let text = stripped
    .replace(/PlcConnectionException:\s*/gi, '')
    .replace(
      /Error acquiring lease for connection/gi,
      '无法获取 PLC 连接租约（设备不可达、忙或上次租约未释放）',
    )
    .replace(/Connection is not possible\.?/gi, '无法连接 PLC（请检查 IP/端口/机架/插槽，以及设备是否在线）')
    .replace(/Connection refused/gi, '连接被拒绝')
    .replace(/Connection timed out/gi, '连接超时')
    .replace(/connect timed out/gi, '连接超时')
    .replace(/No route to host/gi, '主机不可达')
    .replace(/Network is unreachable/gi, '网络不可达')
    .replace(/UnknownHostException/gi, '主机名无法解析')
    .replace(/Unknown host/gi, '主机名无法解析')
    .replace(/worker rejected:\s*/gi, '工作线程池繁忙：')
    .replace(/scheduler\/worker rejected:\s*/gi, '调度/工作池繁忙：')
    .replace(/bind failed:\s*/gi, '监听端口绑定失败：')
    .replace(/device channel up\s*/gi, '设备已连入 ')
    .replace(/listening on\s*/gi, '正在监听端口 ')
    .replace(/^error:\s*/i, '错误：')
    .replace(/;\s*retry in\s+(\d+)\s*ms/gi, '；$1 毫秒后重试')
    .replace(/;\s*rebind in\s+(\d+)\s*ms/gi, '；$1 毫秒后重新绑定')
    .trim()

  return EXACT[text] || text
}

export function lifecycleStateZh(state: string): string {
  switch (state) {
    case 'ONLINE':
      return '在线'
    case 'OFFLINE':
      return '离线'
    case 'RECONNECTING':
      return '重连中'
    default:
      return state
  }
}
