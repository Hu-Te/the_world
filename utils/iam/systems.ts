/**
 * 系统管理平台门户登记（与 utils/tools/catalog 工具舱目录分离）。
 * moduleCode 对齐后端 sys_module / 套餐解锁；href 只指向 /console/*，禁止回链 /tools。
 */
export type PortalSystem = {
  moduleCode: string
  code: string
  name: string
  desc: string
  href: string
  accent: string
}

/** 登录后可选的平台子系统（建设中占位；勿与首页工具舱混用）。 */
export const PORTAL_SYSTEMS: PortalSystem[] = [
  {
    moduleCode: 'FIELDPULSE',
    code: '01',
    name: 'PLC 数据管控中心',
    desc: '工脉监听 · 多 PLC 实时测控（平台侧）',
    href: '/console/fieldpulse',
    accent: '#6ec8e8',
  },
  {
    moduleCode: 'FINANCE',
    code: '03',
    name: '财务审计',
    desc: '勾稽 · 企税 · 语料 · 账龄（平台侧）',
    href: '/console/finance',
    accent: '#6ec4b8',
  },
  {
    moduleCode: 'PACK3D',
    code: '05',
    name: '包装设计',
    desc: '软包装 3D 打样（平台侧）',
    href: '/console/pack3d',
    accent: '#7eb0c8',
  },
  // ACCOUNT 不进二级选择；超管访问 /admin/users
]

export function systemsForModules(unlocked: Iterable<string> | undefined, isSuperAdmin: boolean): PortalSystem[] {
  if (isSuperAdmin) {
    return [...PORTAL_SYSTEMS]
  }
  const set = new Set(
    [...(unlocked ?? [])].map((m) => m.trim().toUpperCase()).filter(Boolean),
  )
  return PORTAL_SYSTEMS.filter((s) => s.moduleCode !== 'ACCOUNT' && set.has(s.moduleCode))
}

/** 登录后优先拉服务端目录，失败则回退本地 PORTAL_SYSTEMS。 */
export async function fetchPortalSystems(token: string): Promise<PortalSystem[] | null> {
  const config = useRuntimeConfig()
  const base = String(config.public.apiOrigin || '').replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/api/sys/modules`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
    const json = (await res.json().catch(() => null)) as {
      code: number
      data?: { systems?: PortalSystem[] }
    } | null
    if (!res.ok || !json || json.code !== 0 || !Array.isArray(json.data?.systems)) {
      return null
    }
    return json.data.systems
  } catch {
    return null
  }
}
