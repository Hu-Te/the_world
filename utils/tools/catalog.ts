/** 首页分类板块与工具目录 */

export type ToolItem = {
  id: string
  name: string
  desc: string
  badge: '可用' | '筹备中' | '内测'
  href?: string
}

export type ToolCategory = {
  id: string
  code: string
  name: string
  desc: string
  accent: string
  tools: ToolItem[]
}

export const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: 'industry',
    code: '01',
    name: '工业与机械制造',
    desc: 'XML 多语翻译 · 产线装配工艺辅助',
    accent: '#6ec8e8',
    tools: [
      {
        id: 'industry-xml-xlate',
        name: '多语言 XML 翻译舱',
        desc: 'Dom4j 无损解析 · 分片解析 · SSE 进度 · 虚拟表对照',
        badge: '可用',
        href: '/tools/xml-xlate',
      },
      {
        id: 'industry-tol',
        name: '公差配合速查',
        desc: '常用公差带与配合代号对照',
        badge: '筹备中',
      },
      {
        id: 'industry-bom',
        name: '装配 BOM 核对',
        desc: '物料齐套与版本差异标记',
        badge: '筹备中',
      },
      {
        id: 'industry-cut',
        name: '下料估算',
        desc: '板材 / 型材利用率粗算',
        badge: '筹备中',
      },
    ],
  },
  {
    id: 'engineering',
    code: '02',
    name: '工程与建筑空间',
    desc: '尺度、空间与结构辅助',
    accent: '#7eb8d4',
    tools: [
      {
        id: 'engineering-scale',
        name: '比例换算',
        desc: '图纸比例与真实尺寸互算',
        badge: '筹备中',
      },
      {
        id: 'engineering-area',
        name: '空间面积',
        desc: '房间轮廓面积与周长估算',
        badge: '筹备中',
      },
      {
        id: 'engineering-clear',
        name: '净空校对',
        desc: '层高、梁底与通行净空提示',
        badge: '筹备中',
      },
    ],
  },
  {
    id: 'finance',
    code: '03',
    name: '财务与企业数据',
    desc: '勾稽校对 · 企税倒推 · 语料熔炼 · 税收扫描 · 账龄 FIFO',
    accent: '#6ec4b8',
    tools: [
      {
        id: 'finance-recon',
        name: '银行存款勾稽',
        desc: '企业日记账 × 银行流水智能配对 · 含表格稽核',
        badge: '可用',
        href: '/tools/recon',
      },
      {
        id: 'finance-tax',
        name: '企税利润倒推',
        desc: '成本/收入分项 + 纳税调整，反推最低营收或最大成本',
        badge: '可用',
        href: '/tools/cit-profit',
      },
      {
        id: 'finance-lexicore',
        name: '全息语料熔炼舱',
        desc: '大白话报销 → AI 解构分录 → 规则平账 → 凭证导入包',
        badge: '可用',
        href: '/tools/lexicore',
      },
      {
        id: 'finance-taxscan',
        name: '税收红利扫描舱',
        desc: '科目余额表多维扫描 · 小微红线 / 招待费 / 研发加计筹划',
        badge: '可用',
        href: '/tools/tax-planner',
      },
      {
        id: 'finance-aging',
        name: '往来账龄扫描舱',
        desc: 'FIFO 冲销 · 分桶账龄 · 坏账计提 · 3D 数据岛',
        badge: '可用',
        href: '/tools/aging',
      },
    ],
  },
  {
    id: 'ithw',
    code: '04',
    name: 'IT 与硬件设施',
    desc: '网络、容量与机房辅助',
    accent: '#7a9ccc',
    tools: [
      {
        id: 'ithw-subnet',
        name: '子网计算',
        desc: 'CIDR、掩码与可用主机速算',
        badge: '筹备中',
      },
      {
        id: 'ithw-unit',
        name: '容量换算',
        desc: '存储 / 带宽单位互转',
        badge: '筹备中',
      },
      {
        id: 'ithw-rack',
        name: '机柜占位',
        desc: 'U 位占用与上架清单整理',
        badge: '筹备中',
      },
    ],
  },
  {
    id: 'commerce',
    code: '05',
    name: '电商与包装设计',
    desc: '视觉、尺寸与包装辅助',
    accent: '#7eb0c8',
    tools: [
      {
        id: 'commerce-size',
        name: '主图尺寸',
        desc: '常用电商主图与详情尺寸模板',
        badge: '筹备中',
      },
      {
        id: 'commerce-pack',
        name: '包装展开估算',
        desc: '盒型展开面积粗算',
        badge: '筹备中',
      },
      {
        id: 'commerce-color',
        name: '色值转换',
        desc: 'HEX / RGB / HSL 快速互转',
        badge: '筹备中',
      },
    ],
  },
]

export function getCategory(id: string): ToolCategory | undefined {
  return TOOL_CATEGORIES.find((c) => c.id === id)
}

export function accentToNumber(hex: string): number {
  const h = hex.replace('#', '')
  return Number.parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
}
