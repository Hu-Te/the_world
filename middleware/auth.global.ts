/**
 * 全局 IAM 门禁：
 * - `/tools/*` 工具舱：不登记 → 匿名放行
 * - `/console/*` 系统管理平台：须登录；子系统另验 unlockedModules
 * - `/admin/*`：须登录 + ACCOUNT
 * - SSR / generate：跳过（无 localStorage）
 *
 * Token 仅存 Pinia + localStorage（用户 JWT）；禁止使用 NUXT_PUBLIC_API_TOKEN。
 */
import { moduleRequiredForPath, requiresLogin } from '~/utils/iam/gatedRoutes'

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return

  const auth = useAuthStore()
  auth.hydrate()

  const path = to.path

  if (path === '/login') {
    if (auth.isLoggedIn) {
      const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : ''
      if (redirect.startsWith('/')) return navigateTo(redirect)
      return navigateTo('/console')
    }
    return
  }

  if (path === '/403' || path === '/upgrade' || path === '/') {
    return
  }

  if (!requiresLogin(path)) {
    return
  }

  if (!auth.isLoggedIn) {
    return navigateTo({ path: '/login', query: { redirect: path } })
  }

  const needModule = moduleRequiredForPath(path)
  if (needModule && !auth.hasModule(needModule)) {
    return navigateTo('/upgrade')
  }
})
