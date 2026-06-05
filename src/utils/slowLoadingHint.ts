export interface SlowHintStep {
  afterMs: number
  text: string
}

/** 按时间推进提示文案，返回清理函数 */
export function startSlowLoadingHints(
  steps: SlowHintStep[],
  onUpdate: (text: string, elapsedSec: number) => void,
): () => void {
  const startedAt = Date.now()
  const timers: number[] = []

  const tick = () => {
    const elapsed = Date.now() - startedAt
    let text = steps[0]?.text ?? '正在处理，请稍候…'
    for (const step of steps) {
      if (elapsed >= step.afterMs) text = step.text
    }
    onUpdate(text, Math.floor(elapsed / 1000))
  }

  tick()
  for (const step of steps) {
    if (step.afterMs > 0) {
      timers.push(window.setTimeout(tick, step.afterMs))
    }
  }
  timers.push(window.setInterval(tick, 5000))

  return () => {
    for (const id of timers) {
      window.clearTimeout(id)
      window.clearInterval(id)
    }
  }
}

export const CAD_UPLOAD_HINTS: SlowHintStep[] = [
  { afterMs: 0, text: '正在上传图纸至云端，请稍候…' },
  { afterMs: 8000, text: '上传中，大文件可能需要 1～3 分钟，请勿关闭页面' },
  { afterMs: 30000, text: '云端正在转码切片，复杂图纸会稍慢一些' },
  { afterMs: 90000, text: '仍在处理中，工业大图纸最多可能需要 5～10 分钟' },
  { afterMs: 180000, text: '已接近服务端超时，若失败可另存为 DXF 后重试' },
]

export const CAD_RENDER_HINTS: SlowHintStep[] = [
  { afterMs: 0, text: '正在加载 WebGL 地图切片…' },
  { afterMs: 5000, text: '首次打开需拉取矢量瓦片，请稍候' },
  { afterMs: 20000, text: '瓦片加载较慢，可缩放或稍等片刻' },
  { afterMs: 60000, text: '网络较慢时切片可能分批显示，属正常现象' },
]
