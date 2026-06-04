import type { HomeToolId } from './homeToolIds'
import { HOME_ACTIVE_TOOLS, HOME_TOOL_LABELS } from './homeToolIds'
import { isMobileViewport } from '@/utils/device'

const LABEL_STYLE_BASE =
  'position:fixed;pointer-events:none;z-index:15;display:none;transform:translate(-50%,0);' +
  'padding:0.28rem 0.55rem;border-radius:999px;' +
  'font-family:"PingFang SC","Microsoft YaHei",sans-serif;' +
  'color:rgba(220,232,240,0.88);background:rgba(8,16,28,0.86);' +
  'border:1px solid rgba(136,204,238,0.22);white-space:nowrap;' +
  'transition:color 0.15s,border-color 0.15s,background 0.15s;'

function labelStyle(): string {
  const mobile = isMobileViewport()
  const fontSize = mobile ? '12px' : '11px'
  const lineHeight = mobile ? '1.35' : '1.25'
  return `${LABEL_STYLE_BASE}font-size:${fontSize};line-height:${lineHeight};`
}

const LABEL_HOVER =
  'color:#eef4f8;background:rgba(12,24,36,0.94);border-color:rgba(160,220,240,0.45);'

export interface HomeToolLabelTarget {
  id: HomeToolId
  left: number
  top: number
  width: number
  height: number
}

export interface HomeToolLabelsHandle {
  update: (expanded: boolean, hoveredTool: HomeToolId | null, targets: HomeToolLabelTarget[]) => void
  dispose: () => void
}

/** 工具名称标签（纯展示，不拦截点击） */
export function createHomeToolLabels(): HomeToolLabelsHandle {
  document.querySelector('[data-home-tool-labels]')?.remove()

  const root = document.createElement('div')
  root.setAttribute('data-home-tool-labels', 'true')
  root.setAttribute('data-scroll-lock-inset', 'true')
  root.style.cssText =
    'position:fixed;inset:0;z-index:15;pointer-events:none;overflow:visible;'

  const labels = new Map<HomeToolId, HTMLSpanElement>()
  for (const id of HOME_ACTIVE_TOOLS) {
    const label = document.createElement('span')
    label.textContent = HOME_TOOL_LABELS[id]
    label.setAttribute('aria-hidden', 'true')
    labels.set(id, label)
    root.appendChild(label)
  }

  document.body.appendChild(root)

  const update = (
    expanded: boolean,
    hoveredTool: HomeToolId | null,
    targets: HomeToolLabelTarget[],
  ) => {
    for (const [id, label] of labels) {
      const target = targets.find((t) => t.id === id)
      if (expanded && target) {
        label.style.cssText = `${labelStyle()}${hoveredTool === id ? LABEL_HOVER : ''}`
        label.style.display = 'block'
        label.style.left = `${target.left + target.width / 2}px`
        label.style.top = `${target.top + target.height + (isMobileViewport() ? 8 : 5)}px`
      } else {
        label.style.display = 'none'
      }
    }
  }

  const dispose = () => root.remove()

  return { update, dispose }
}
