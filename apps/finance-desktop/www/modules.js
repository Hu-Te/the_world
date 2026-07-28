/**
 * 财务审计桌面 — 功能模块地图（信息架构）
 *
 * 边界原则：
 * - 云端：仅 IAM / 套餐 / 安装包分发
 * - 本机：账套、凭证、账簿、结账、报表、审计底稿全部落 ~/.hute/finance/{tenantId}/
 * - 不做「云端总账」；跨机协作以导出包 / 只读镜像为后续议题
 *
 * 建设节奏建议：
 * P0 壳与导航 ✅
 * P1 账套·科目·凭证（核算最小闭环）✅
 * P2 账簿·结账·汇兑
 * P3 报表·审计底稿·导入导出
 */

export const NAV_GROUPS = [
  {
    id: 'overview',
    label: '总览',
    items: [{ id: 'home', title: '工作台', kicker: 'HOME', lead: '会话、本机数据与建设路线' }],
  },
  {
    id: 'ledger',
    label: '核算主链',
    items: [
      {
        id: 'books',
        title: '账套与期间',
        kicker: 'BOOKS',
        lead: '账套、会计年度、期间开关与本位币',
        phase: 'P1',
        bullets: [
          '多账套隔离（同一 tenant 下按 bookId）',
          '会计年度 / 期间 OPEN·CLOSED',
          '本位币与 12 期自动生成',
        ],
      },
      {
        id: 'coa',
        title: '科目体系',
        kicker: 'COA',
        lead: '科目表、余额方向与启用状态',
        phase: 'P1',
        bullets: [
          '科目编码 / 类型 / 余额方向',
          '精简企业科目表一键导入',
          '与凭证录入共用同一 COA',
        ],
      },
      {
        id: 'vouchers',
        title: '凭证中心',
        kicker: 'VOUCHERS',
        lead: '记账凭证录入、过账与作废',
        phase: 'P1',
        bullets: [
          '草稿 → 过账 → 作废',
          '借贷平衡与 OPEN 期间校验',
          '明细账查询属 P2',
        ],
      },
      {
        id: 'ledgers',
        title: '账簿查询',
        kicker: 'LEDGERS',
        lead: '总账、明细账、试算平衡',
        phase: 'P2',
        bullets: ['总分类账 / 明细账', '科目余额表与试算平衡', '按期间、科目、辅助项过滤'],
      },
    ],
  },
  {
    id: 'close',
    label: '结账与报告',
    items: [
      {
        id: 'period-close',
        title: '期末结账',
        kicker: 'CLOSE',
        lead: '期间检查清单与关账',
        phase: 'P2',
        bullets: ['未过账凭证阻断', '关账后凭证只读', '反结账需权限与审计痕迹'],
      },
      {
        id: 'fx',
        title: '外币汇兑',
        kicker: 'FX',
        lead: '外币货币性项目重估（由 Web 草稿迁入本机）',
        phase: 'P2',
        bullets: ['年末/期末汇率重估', '汇兑损益凭证生成', '与现有云端汇兑草稿能力对齐后下线云写库'],
      },
      {
        id: 'reports',
        title: '财务报表',
        kicker: 'REPORTS',
        lead: '资产负债表、利润表、现金流量表',
        phase: 'P3',
        bullets: ['报表项目与科目映射', '比较期与本位币列示', '导出 PDF / Excel'],
      },
    ],
  },
  {
    id: 'audit',
    label: '审计',
    items: [
      {
        id: 'workpapers',
        title: '审计底稿',
        kicker: 'AUDIT',
        lead: '底稿索引、勾稽说明与附件',
        phase: 'P3',
        bullets: ['底稿目录与交叉引用', '与凭证/账簿页签跳转', '附件仅存本机'],
      },
      {
        id: 'io',
        title: '导入导出',
        kicker: 'I/O',
        lead: '银行流水、科目余额、凭证批量进出',
        phase: 'P3',
        bullets: ['银行对账单导入（可衔接工具舱勾稽）', '期初余额导入', '账套备份 / 恢复包'],
      },
    ],
  },
  {
    id: 'system',
    label: '系统',
    items: [
      {
        id: 'session',
        title: '会话与本机',
        kicker: 'SYSTEM',
        lead: '账号会话、本机路径与运行时',
        phase: 'P0',
        bullets: ['云端身份只读展示', '本机数据目录与 Sidecar 状态', '退出登录'],
      },
    ],
  },
]

export function findModule(id) {
  for (const g of NAV_GROUPS) {
    const hit = g.items.find((i) => i.id === id)
    if (hit) return { group: g, module: hit }
  }
  return null
}

export const DEFAULT_ROUTE = 'home'
