import { defineStore } from 'pinia'
import { useScadaDocStore } from '~/stores/scadaDoc'

/**
 * IAM 会话（Pinia）。
 * - accessToken：用户 JWT，经 sysFetch / apiFetch 的 Authorization: Bearer 携带
 * - 严禁把 APP_API_TOKEN / NUXT_PUBLIC_API_TOKEN 写入本 store 或 public runtimeConfig
 */

const TOKEN_KEY = 'iam.accessToken'
const PROFILE_KEY = 'iam.profile'

export type UserProfile = {
  userId: number
  tenantId: number
  username: string
  displayName: string
  planCode: string
  roles: string[]
  permissions: string[]
  unlockedModules: string[]
  validUntil?: string
}

export type LoginResult = {
  accessToken: string
  tokenType: string
  expiresInSeconds: number
  profile: UserProfile
}

export class SessionExpiredError extends Error {
  constructor(message = '令牌无效或已过期') {
    super(message)
    this.name = 'SessionExpiredError'
  }
}

function apiBase(): string {
  const config = useRuntimeConfig()
  return String(config.public.apiOrigin || '').replace(/\/$/, '')
}

function isAuthFailure(res: Response, json: { code?: number; message?: string } | null): boolean {
  if (res.status === 401) return true
  if (json?.code === 401) return true
  const msg = json?.message || ''
  // 勿匹配笼统「已过期」（额度过期是 403 业务错误，不应清会话踢首页）
  return /令牌无效|令牌已失效|令牌无效或已过期|未登录或令牌无效|会话不存在或已注销|^未登录$|请先登录/.test(
    msg,
  )
}

let redirectingHome = false

/** 清本地会话；管控页回登录并带回跳，其它页回首页。 */
export async function expireSessionAndGoHome(_message?: string): Promise<void> {
  if (!import.meta.client) return
  const auth = useAuthStore()
  auth.clearLocalSession()

  if (redirectingHome) return
  const path = useRoute().path
  if (path === '/' || path === '/login') return

  redirectingHome = true
  try {
    if (path.startsWith('/console') || path.startsWith('/admin')) {
      await navigateTo({ path: '/login', query: { redirect: path } })
    } else {
      await navigateTo('/')
    }
  } finally {
    window.setTimeout(() => {
      redirectingHome = false
    }, 800)
  }
}

/** 系统域 API：只带用户 JWT，不带工具 APP_API_Token（域隔离）。 */
async function sysFetch<T>(
  path: string,
  init: RequestInit = {},
  token?: string | null,
  opts?: { skipExpireRedirect?: boolean },
): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { ...init, headers })
  const json = (await res.json().catch(() => null)) as {
    code: number
    message: string
    data: T
  } | null

  const isLogin = path.includes('/api/auth/login')
  if (
    token &&
    !opts?.skipExpireRedirect &&
    !isLogin &&
    isAuthFailure(res, json)
  ) {
    await expireSessionAndGoHome(json?.message)
    throw new SessionExpiredError(json?.message || '令牌无效或已过期')
  }

  if (!res.ok || !json || json.code !== 0) {
    throw new Error(json?.message || `请求失败 (${res.status})`)
  }
  return json.data
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    accessToken: '' as string,
    profile: null as UserProfile | null,
    hydrated: false,
  }),
  getters: {
    isLoggedIn: (s) => Boolean(s.accessToken && s.profile),
    unlockedModules: (s) => new Set(s.profile?.unlockedModules ?? []),
    displayLabel: (s) => s.profile?.displayName || s.profile?.username || '',
    isSuperAdmin: (s) => (s.profile?.roles ?? []).includes('SUPER_ADMIN'),
  },
  actions: {
    hydrate() {
      if (!import.meta.client || this.hydrated) return
      this.accessToken = localStorage.getItem(TOKEN_KEY) || ''
      const raw = localStorage.getItem(PROFILE_KEY)
      if (raw) {
        try {
          this.profile = JSON.parse(raw) as UserProfile
        } catch {
          this.profile = null
        }
      }
      this.hydrated = true
    },
    persist() {
      if (!import.meta.client) return
      if (this.accessToken) localStorage.setItem(TOKEN_KEY, this.accessToken)
      else localStorage.removeItem(TOKEN_KEY)
      if (this.profile) localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile))
      else localStorage.removeItem(PROFILE_KEY)
    },
    clearLocalSession() {
      this.accessToken = ''
      this.profile = null
      this.persist()
      if (import.meta.client) {
        try {
          useScadaDocStore().clearMemory()
        } catch {
          /* Pinia 未就绪时忽略 */
        }
      }
    },
    async login(username: string, password: string) {
      const data = await sysFetch<LoginResult>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      this.accessToken = data.accessToken
      this.profile = data.profile
      this.persist()
      return data
    },
    async refreshMe() {
      if (!this.accessToken) return null
      const profile = await sysFetch<UserProfile>('/api/auth/me', { method: 'GET' }, this.accessToken)
      this.profile = profile
      this.persist()
      return profile
    },
    async logout() {
      try {
        if (this.accessToken) {
          await sysFetch<null>(
            '/api/auth/logout',
            { method: 'POST' },
            this.accessToken,
            { skipExpireRedirect: true },
          )
        }
      } catch {
        /* 忽略登出网络错误 */
      }
      this.clearLocalSession()
    },
    hasModule(moduleCode: string) {
      if (!moduleCode) return false
      const roles = this.profile?.roles ?? []
      if (roles.includes('SUPER_ADMIN')) return true
      return this.unlockedModules.has(moduleCode.toUpperCase())
    },
    /** 管理端带 JWT 的 fetch；令牌失效会清会话并回首页 */
    async adminFetch<T>(path: string, init: RequestInit = {}) {
      if (!this.accessToken) throw new Error('未登录')
      return sysFetch<T>(path, init, this.accessToken)
    },
  },
})
