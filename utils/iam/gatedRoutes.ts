/**
 * 系统管理平台（进阶版）路由门禁。
 *
 * 模块划分（勿混用）：
 * - `/tools/*`  首页工具舱 · 基础版 · 匿名可用 · 禁止写入本表
 * - `/console/*` 系统管理平台 · 进阶版 · 登录 + 套餐模块
 * - `/admin/*`   账号治理（ACCOUNT）· 属平台侧，仅超管业务
 *
 * 严禁配置 NUXT_PUBLIC_API_TOKEN（部署 Token 仅 Java / 现场 Agent）。
 */

export type GatedRouteRule = {
  moduleCode: string
  pathPrefixes: string[]
}

/** 需特定模块授权的前缀（平台子系统 + 账号治理） */
export const GATED_ROUTE_RULES: GatedRouteRule[] = [
  {
    moduleCode: 'ACCOUNT',
    pathPrefixes: ['/admin'],
  },
  {
    moduleCode: 'FIELDPULSE',
    pathPrefixes: ['/console/fieldpulse'],
  },
  {
    moduleCode: 'FINANCE',
    pathPrefixes: ['/console/finance'],
  },
  {
    moduleCode: 'PACK3D',
    pathPrefixes: ['/console/pack3d'],
  },
]

/** 平台根路径：任意已登录用户可进目录；子系统另查模块。 */
export function isConsolePlatformPath(path: string): boolean {
  const normalized = normalizePath(path)
  return normalized === '/console' || normalized.startsWith('/console/')
}

/**
 * @returns 需要的模块码；null 表示不要求特定模块（仍可能要求登录，见 {@link requiresLogin}）
 */
export function moduleRequiredForPath(path: string): string | null {
  const normalized = normalizePath(path)

  for (const rule of GATED_ROUTE_RULES) {
    for (const prefix of rule.pathPrefixes) {
      if (normalized === prefix || normalized.startsWith(prefix + '/')) {
        return rule.moduleCode
      }
    }
  }

  return null
}

/** 是否必须登录（平台根、子系统、账号治理）。工具舱永不命中。 */
export function requiresLogin(path: string): boolean {
  return isConsolePlatformPath(path) || moduleRequiredForPath(path) != null
}

function normalizePath(path: string): string {
  return (path.split('?')[0] || path).replace(/\/$/, '') || '/'
}
