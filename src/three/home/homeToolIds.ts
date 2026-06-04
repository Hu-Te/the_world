export type HomeToolId =
  | 'zip-compress'
  | 'zip-extract'
  | 'file-preview'
  | 'timestamp'
  | 'uuid'
  | 'color'
  | 'copy-link'
  | 'goto-game'
  | 'goto-world'
  | 'goto-draw'

export const HOME_TOOL_LABELS: Record<HomeToolId, string> = {
  'zip-compress': '压缩打包',
  'zip-extract': '解压 ZIP',
  'file-preview': '文件预览',
  timestamp: '时间戳',
  uuid: 'UUID',
  color: '随机色',
  'copy-link': '复制链接',
  'goto-game': '交互模拟',
  'goto-world': '沉浸世界',
  'goto-draw': '你画我猜',
}

export const HOME_ACTIVE_TOOLS: HomeToolId[] = ['zip-extract', 'file-preview']
