<template>
  <div class="admin-users" :class="{ 'admin-users--ready': ready }">
    <AdminUsersHead @create="showCreate = true" />

    <div class="admin-users__meta">
      <div class="admin-chip admin-users__anim" style="--d: 80ms">
        <em>合计</em>
        <strong>{{ total }}</strong>
      </div>
      <div class="admin-chip admin-users__anim" style="--d: 140ms">
        <em>启用</em>
        <strong>{{ enabledCount }}</strong>
      </div>
      <div class="admin-chip admin-chip--plan admin-users__anim" style="--d: 200ms">
        <em>你的身份</em>
        <strong>{{ auth.isSuperAdmin ? 'SUPER_ADMIN' : auth.profile?.planCode || '—' }}</strong>
      </div>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      class="admin-users__alert"
      @close="error = ''" />

    <section class="admin-users__panel admin-users__anim" style="--d: 260ms">
      <div class="admin-users__panel-edge" aria-hidden="true" />
      <div class="admin-users__panel-head">
        <span class="admin-users__panel-title">账号清单</span>
        <button type="button" class="admin-users__refresh" :disabled="loading" @click="load">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>

      <!-- 等 Element Plus 注册完再挂表，避免生产分包竞态导致空白清单 -->
      <ClientOnly>
        <div v-if="!epReady" class="admin-users__ssr-fallback">
          <p class="admin-muted" style="padding: 1.25rem 0; display: inline">
            {{ epError || '表格组件加载中…' }}
          </p>
          <button
            v-if="epError"
            type="button"
            class="admin-users__refresh"
            style="margin-left: 12px"
            @click="retryEp">
            重试
          </button>
        </div>
        <template v-else>
          <el-table
            v-loading="loading"
            :data="rows"
            class="admin-users__table"
            empty-text="暂无用户"
            :row-class-name="rowClassName"
            :header-cell-style="headerCellStyle"
            :cell-style="cellStyle">
            <el-table-column label="账号" min-width="168">
              <template #default="scope">
                <div v-if="scope?.row" class="admin-user">
                  <strong>{{ scope.row.username }}</strong>
                  <em>{{ dash(scope.row.displayName) }}</em>
                  <code v-if="!scope.row.platformAdmin" class="admin-mono" :title="String(scope.row.id)">
                    {{ shortId(scope.row.id) }}
                  </code>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="套餐 / 额度" min-width="168">
              <template #default="scope">
                <div v-if="scope?.row" class="admin-quota">
                  <span class="admin-plan" :class="{ 'admin-plan--plat': scope.row.platformAdmin }">
                    {{ scope.row.platformAdmin ? 'PLATFORM' : dash(scope.row.planCode) }}
                  </span>
                  <span class="admin-quota__exp" :class="expiryClass(scope.row)">
                    {{ expiryLabel(scope.row) }}
                  </span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="服务" min-width="220">
              <template #default="scope">
                <template v-if="scope?.row">
                  <div v-if="scope.row.platformAdmin" class="admin-tags">
                    <span class="admin-tag admin-tag--plat">全站</span>
                  </div>
                  <div v-else class="admin-tags">
                    <span
                      v-for="m in displayModules(scope.row.modules)"
                      :key="m.code"
                      class="admin-tag"
                      :class="{ 'admin-tag--wip': m.wip }"
                      :title="m.title">
                      {{ m.short }}
                    </span>
                    <span v-if="!displayModules(scope.row.modules).length" class="admin-muted">未分配</span>
                  </div>
                </template>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="88">
              <template #default="scope">
                <span
                  v-if="scope?.row"
                  class="admin-status"
                  :class="scope.row.status === 1 ? 'admin-status--on' : 'admin-status--off'">
                  {{ scope.row.status === 1 ? '启用' : '停用' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right" align="right">
              <template #default="scope">
                <template v-if="scope?.row">
                  <span
                    v-if="scope.row.platformAdmin"
                    class="admin-lock"
                    title="唯一 · 不可续期/停用">
                    锁定
                  </span>
                  <div v-else class="admin-ops">
                    <button type="button" class="admin-link" @click="openQuota(scope.row)">续期</button>
                    <button type="button" class="admin-link" @click="toggleStatus(scope.row)">
                      {{ scope.row.status === 1 ? '停用' : '启用' }}
                    </button>
                    <button type="button" class="admin-link" @click="openResetPwd(scope.row)">重置</button>
                    <button type="button" class="admin-link" @click="forceLogout(scope.row)">下线</button>
                  </div>
                </template>
              </template>
            </el-table-column>
          </el-table>

          <div class="admin-users__pager">
            <el-pagination
              v-model:current-page="page1"
              background
              layout="total, prev, pager, next"
              :page-size="size"
              :total="total"
              @current-change="load" />
          </div>
        </template>
        <template #fallback>
          <p class="admin-muted" style="padding: 1.25rem 0">表格加载中…</p>
        </template>
      </ClientOnly>
    </section>

    <Teleport to="body">
      <div
        v-if="showCreate"
        class="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-create-title"
        @click.self="showCreate = false">
        <div class="admin-modal__panel admin-modal__panel--wide">
          <div class="admin-modal__glow" aria-hidden="true" />
          <header class="admin-modal__head">
            <p class="admin-modal__eyebrow">ACCOUNT · 新建</p>
            <h2 id="admin-create-title" class="admin-modal__title">创建用户</h2>
            <p class="admin-modal__lead">独立开户 · 按天额度 · 勾选可访问服务</p>
            <button
              type="button"
              class="admin-modal__x"
              aria-label="关闭"
              @click="showCreate = false">
              ✕
            </button>
          </header>
          <form class="admin-modal__form" @submit.prevent="createUser">
            <div class="admin-modal__grid">
              <label class="admin-modal__field">
                <span>
                  用户名
                  <i>*</i>
                </span>
                <input
                  v-model="form.username"
                  type="text"
                  autocomplete="off"
                  placeholder="登录账号" />
              </label>
              <label class="admin-modal__field">
                <span>
                  密码（≥8 位）
                  <i>*</i>
                </span>
                <input
                  v-model="form.password"
                  type="password"
                  autocomplete="new-password"
                  placeholder="初始密码" />
              </label>
              <label class="admin-modal__field">
                <span>显示名</span>
                <input v-model="form.displayName" type="text" placeholder="可选" />
              </label>
              <label class="admin-modal__field">
                <span>套餐</span>
                <select v-model="form.planCode" class="admin-modal__select">
                  <option value="FREE">Free · 默认 30 天</option>
                  <option value="PRO">Pro · 默认 365 天</option>
                  <option value="ENTERPRISE">Enterprise · 可设不限期</option>
                </select>
              </label>
              <label class="admin-modal__field">
                <span>邮箱</span>
                <input v-model="form.email" type="email" placeholder="可选" />
              </label>
              <label class="admin-modal__field">
                <span>手机</span>
                <input v-model="form.phone" type="tel" placeholder="可选" />
              </label>
              <label class="admin-modal__field admin-modal__field--span">
                <span>使用天数</span>
                <input
                  v-model.number="form.validDays"
                  type="number"
                  min="0"
                  placeholder="空=套餐默认；0=不限期" />
              </label>
            </div>
            <fieldset class="admin-modal__mods">
              <legend>服务权限</legend>
              <p class="admin-modal__hint">未勾选则回落套餐默认模块；账号中心仅超管可用。</p>
              <div class="admin-mod-grid">
                <label
                  v-for="m in SERVICE_OPTIONS"
                  :key="m.code"
                  class="admin-mod-card"
                  :class="{ 'admin-mod-card--on': form.modules.includes(m.code) }">
                  <input v-model="form.modules" type="checkbox" :value="m.code" />
                  <strong>{{ m.short }}</strong>
                  <em>{{ m.name }}</em>
                  <i v-if="m.wip">暂未开发</i>
                </label>
              </div>
            </fieldset>
            <div class="admin-modal__actions">
              <button type="button" class="admin-btn admin-btn--ghost" @click="showCreate = false">
                取消
              </button>
              <button type="submit" class="admin-btn admin-btn--primary" :disabled="saving">
                {{ saving ? '创建中…' : '创建' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showPlan"
        class="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-plan-title"
        @click.self="showPlan = false">
        <div class="admin-modal__panel admin-modal__panel--wide">
          <div class="admin-modal__glow" aria-hidden="true" />
          <header class="admin-modal__head">
            <p class="admin-modal__eyebrow">ACCOUNT · 额度</p>
            <h2 id="admin-plan-title" class="admin-modal__title">分配额度与服务</h2>
            <p class="admin-modal__lead">
              用户
              <strong>{{ quotaTarget?.username }}</strong>
            </p>
            <button
              type="button"
              class="admin-modal__x"
              aria-label="关闭"
              @click="showPlan = false">
              ✕
            </button>
          </header>
          <form class="admin-modal__form" @submit.prevent="assignQuota">
            <div class="admin-modal__grid">
              <label class="admin-modal__field">
                <span>套餐</span>
                <select v-model="planCode" class="admin-modal__select">
                  <option value="FREE">Free · 默认 30 天</option>
                  <option value="PRO">Pro · 默认 365 天</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </label>
              <label class="admin-modal__field">
                <span>使用天数</span>
                <input
                  v-model.number="quotaDays"
                  type="number"
                  min="0"
                  placeholder="空=套餐默认；0=不限期" />
              </label>
            </div>
            <fieldset class="admin-modal__mods">
              <legend>服务权限</legend>
              <div class="admin-mod-grid">
                <label
                  v-for="m in SERVICE_OPTIONS"
                  :key="m.code"
                  class="admin-mod-card"
                  :class="{ 'admin-mod-card--on': quotaModules.includes(m.code) }">
                  <input v-model="quotaModules" type="checkbox" :value="m.code" />
                  <strong>{{ m.short }}</strong>
                  <em>{{ m.name }}</em>
                  <i v-if="m.wip">暂未开发</i>
                </label>
              </div>
            </fieldset>
            <div class="admin-modal__actions">
              <button type="button" class="admin-btn admin-btn--ghost" @click="showPlan = false">
                取消
              </button>
              <button type="submit" class="admin-btn admin-btn--primary" :disabled="saving">
                {{ saving ? '保存中…' : '保存' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showResetPwd"
        class="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-reset-title"
        @click.self="showResetPwd = false">
        <div class="admin-modal__panel">
          <div class="admin-modal__glow" aria-hidden="true" />
          <header class="admin-modal__head">
            <p class="admin-modal__eyebrow">ACCOUNT · 重置</p>
            <h2 id="admin-reset-title" class="admin-modal__title">重置密码</h2>
            <p class="admin-modal__lead">
              用户
              <strong>{{ resetTarget?.username }}</strong>
              · 至少 8 位 · 将强制下线
            </p>
            <button
              type="button"
              class="admin-modal__x"
              aria-label="关闭"
              @click="showResetPwd = false">
              ✕
            </button>
          </header>
          <form class="admin-modal__form" @submit.prevent="submitResetPwd">
            <label class="admin-modal__field">
              <span>
                新密码
                <i>*</i>
              </span>
              <input
                v-model="resetPassword"
                type="password"
                autocomplete="new-password"
                placeholder="至少 8 位"
                minlength="8" />
            </label>
            <div class="admin-modal__actions">
              <button type="button" class="admin-btn admin-btn--ghost" @click="showResetPwd = false">
                取消
              </button>
              <button type="submit" class="admin-btn admin-btn--primary" :disabled="saving">
                {{ saving ? '重置中…' : '确认重置' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="showForceLogout"
        class="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-logout-title"
        @click.self="closeForceLogout">
        <div class="admin-modal__panel admin-modal__panel--confirm">
          <div class="admin-modal__glow" aria-hidden="true" />
          <header class="admin-modal__head">
            <p class="admin-modal__eyebrow">ACCOUNT · 会话</p>
            <h2 id="admin-logout-title" class="admin-modal__title">强制下线</h2>
            <p class="admin-modal__lead">
              确认强制下线账号
              <strong>{{ forceLogoutTarget?.username }}</strong>
              ？其当前设备需重新登录。
            </p>
            <button
              type="button"
              class="admin-modal__x"
              aria-label="关闭"
              @click="closeForceLogout">
              ✕
            </button>
          </header>
          <div class="admin-modal__form">
            <p class="admin-modal__warn">不会删除账号或改密，仅吊销现有登录会话。</p>
            <div class="admin-modal__actions">
              <button type="button" class="admin-btn admin-btn--ghost" :disabled="saving" @click="closeForceLogout">
                取消
              </button>
              <button
                type="button"
                class="admin-btn admin-btn--danger"
                :disabled="saving"
                @click="submitForceLogout">
                {{ saving ? '处理中…' : '确认下线' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import AdminUsersHead from '~/components/admin/AdminUsersHead.vue'
import { ElMessage } from 'element-plus'

definePageMeta({ layout: 'tool', ssr: false })

useHead({
  title: '用户管理',
})

type UserRow = {
  id: number
  tenantId: number
  username: string
  displayName: string
  emailMasked: string
  phoneMasked: string
  status: number
  planCode: string
  validUntil: string
  platformAdmin: boolean
  modules: string[]
}

const SERVICE_OPTIONS = [
  { code: 'FIELDPULSE', short: '01', name: 'PLC 管控', title: 'PLC 数据管控中心', wip: false },
  { code: 'FINANCE', short: '03', name: '财务审计', title: '财务审计桌面（框架）', wip: true },
  { code: 'PACK3D', short: '05', name: '包装设计', title: '软包装 3D', wip: true },
] as const

const MODULE_META: Record<string, { short: string; title: string; wip: boolean }> = {
  FIELDPULSE: { short: '01 PLC', title: 'PLC 数据管控中心', wip: false },
  FINANCE: { short: '03 财务', title: '财务审计桌面（框架·本机隔离）', wip: true },
  PACK3D: { short: '05 包装', title: '包装设计（暂未开发）', wip: true },
  ACCOUNT: { short: 'SYS', title: '账号中心', wip: false },
}

const auth = useAuthStore()
const ready = ref(false)
const epReady = ref(false)
const epError = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const rows = ref<UserRow[]>([])
const total = ref(0)
const page1 = ref(1)
const size = 20
const showCreate = ref(false)
const showPlan = ref(false)
const showResetPwd = ref(false)
const showForceLogout = ref(false)
const resetTarget = ref<UserRow | null>(null)
const forceLogoutTarget = ref<UserRow | null>(null)
const resetPassword = ref('')
const planCode = ref('FREE')
const quotaDays = ref<number | null>(null)
const quotaModules = ref<string[]>(['FIELDPULSE'])
const quotaTarget = ref<UserRow | null>(null)
const form = reactive({
  username: '',
  password: '',
  displayName: '',
  email: '',
  phone: '',
  planCode: 'FREE',
  validDays: null as number | null,
  modules: ['FIELDPULSE'] as string[],
})

const enabledCount = computed(() => rows.value.filter((r) => r.status === 1).length)

const headerCellStyle = {
  background: 'transparent',
  color: 'rgba(148, 163, 184, 0.95)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  fontWeight: '500',
  fontSize: '12px',
  letterSpacing: '0.08em',
}

const cellStyle = {
  background: 'transparent',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  color: '#e2e8f0',
  padding: '15px 0',
}

function dash(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  return s || '—'
}

function shortId(id: number | string): string {
  const s = String(id)
  if (s.length <= 10) return s
  return `${s.slice(0, 4)}…${s.slice(-4)}`
}

function isSelf(row: UserRow): boolean {
  return Number(row.id) === Number(auth.profile?.userId)
}

function rowClassName(args?: { rowIndex?: number } | null) {
  const rowIndex = args?.rowIndex ?? 0
  return `admin-row admin-row--${Math.min(rowIndex, 8)}`
}

async function ensureEp(): Promise<void> {
  epError.value = ''
  const ensure = useNuxtApp().$ensureAdminElementPlus as (() => Promise<void>) | undefined
  if (!ensure) {
    throw new Error('表格组件未注入，请刷新重试')
  }
  await ensure()
  epReady.value = true
}

async function retryEp() {
  try {
    await ensureEp()
  } catch (e) {
    epReady.value = false
    epError.value = e instanceof Error ? e.message : '表格组件加载失败，请刷新重试'
  }
}

onMounted(async () => {
  auth.hydrate()
  requestAnimationFrame(() => {
    ready.value = true
  })
  try {
    await ensureEp()
  } catch (e) {
    epReady.value = false
    epError.value = e instanceof Error ? e.message : '表格组件加载失败，请刷新重试'
  }
  await load()
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await auth.adminFetch<{ items: UserRow[]; total: number }>(
      `/api/admin/users?page=${page1.value - 1}&size=${size}`,
    )
    rows.value = data.items
    total.value = data.total
  } catch (e) {
    if (e instanceof Error && e.name === 'SessionExpiredError') return
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function formatValidUntil(v: string | null | undefined): string {
  if (!v || !String(v).trim()) return '不限期'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('zh-CN')
}

function expiryLabel(row: UserRow): string {
  if (row.platformAdmin) return '无需续期'
  if (!row.validUntil?.trim()) return '不限期'
  const d = new Date(row.validUntil)
  if (Number.isNaN(d.getTime())) return formatValidUntil(row.validUntil)
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000)
  if (days < 0) return `已过期 ${Math.abs(days)} 天`
  if (days === 0) return '今日到期'
  if (days <= 7) return `剩余 ${days} 天`
  return formatValidUntil(row.validUntil)
}

function expiryClass(row: UserRow): string {
  if (row.platformAdmin || !row.validUntil?.trim()) return 'admin-quota__exp--ok'
  const d = new Date(row.validUntil)
  if (Number.isNaN(d.getTime())) return ''
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000)
  if (days < 0) return 'admin-quota__exp--dead'
  if (days <= 7) return 'admin-quota__exp--warn'
  return 'admin-quota__exp--ok'
}

function displayModules(mods: string[] | null | undefined) {
  return (mods ?? [])
    .map((code) => {
      const meta = MODULE_META[code]
      if (!meta) return { code, short: code, title: code, wip: false }
      return { code, short: meta.short, title: meta.title, wip: meta.wip }
    })
    .filter((m) => m.code !== 'ACCOUNT')
}

function openQuota(row: UserRow) {
  if (row.platformAdmin) {
    ElMessage.warning('平台超管无需续期')
    return
  }
  quotaTarget.value = row
  planCode.value = row.planCode || 'FREE'
  quotaDays.value = null
  quotaModules.value = (row.modules || []).filter((m) => SERVICE_OPTIONS.some((o) => o.code === m))
  if (!quotaModules.value.length) quotaModules.value = ['FIELDPULSE']
  showPlan.value = true
}

async function createUser() {
  saving.value = true
  try {
    const { encryptPasswordForTransport } = await import('~/utils/iam/passwordCrypto')
    const passwordCipher = await encryptPasswordForTransport(form.password)
    const body: Record<string, unknown> = {
      username: form.username,
      password: passwordCipher,
      displayName: form.displayName,
      email: form.email,
      phone: form.phone,
      planCode: form.planCode,
      modules: [...form.modules],
    }
    if (form.validDays !== null && form.validDays !== undefined && String(form.validDays) !== '') {
      body.validDays = Number(form.validDays)
    }
    await auth.adminFetch('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    ElMessage.success('已创建')
    showCreate.value = false
    form.username = ''
    form.password = ''
    form.displayName = ''
    form.email = ''
    form.phone = ''
    form.planCode = 'FREE'
    form.validDays = null
    form.modules = ['FIELDPULSE']
    await load()
  } catch (e) {
    if (e instanceof Error && e.name === 'SessionExpiredError') return
    ElMessage.error(e instanceof Error ? e.message : '创建失败')
  } finally {
    saving.value = false
  }
}

async function assignQuota() {
  if (!quotaTarget.value) return
  saving.value = true
  try {
    const body: Record<string, unknown> = {
      userId: quotaTarget.value.id,
      planCode: planCode.value,
      modules: [...quotaModules.value],
    }
    if (
      quotaDays.value !== null &&
      quotaDays.value !== undefined &&
      String(quotaDays.value) !== ''
    ) {
      body.validDays = Number(quotaDays.value)
    }
    await auth.adminFetch('/api/admin/quota', {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    ElMessage.success('额度已更新')
    showPlan.value = false
    await load()
  } catch (e) {
    if (e instanceof Error && e.name === 'SessionExpiredError') return
    ElMessage.error(e instanceof Error ? e.message : '分配失败')
  } finally {
    saving.value = false
  }
}

async function toggleStatus(row: UserRow) {
  if (row.platformAdmin) {
    ElMessage.warning('平台超管不可操作')
    return
  }
  if (isSelf(row) && row.status === 1) {
    ElMessage.warning('不能停用当前登录账号')
    return
  }
  const next = row.status === 1 ? 0 : 1
  try {
    await auth.adminFetch(`/api/admin/users/${row.id}/status?status=${next}`, { method: 'PUT' })
    ElMessage.success('已更新')
    await load()
  } catch (e) {
    if (e instanceof Error && e.name === 'SessionExpiredError') return
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

function openResetPwd(row: UserRow) {
  if (row.platformAdmin) {
    ElMessage.warning('平台超管请使用自助改密')
    return
  }
  resetTarget.value = row
  resetPassword.value = ''
  showResetPwd.value = true
}

async function submitResetPwd() {
  if (!resetTarget.value) return
  if (!resetPassword.value || resetPassword.value.length < 8) {
    ElMessage.warning('新密码至少 8 位')
    return
  }
  saving.value = true
  try {
    const { encryptPasswordForTransport } = await import('~/utils/iam/passwordCrypto')
    const newPasswordCipher = await encryptPasswordForTransport(resetPassword.value)
    await auth.adminFetch(`/api/admin/users/${resetTarget.value.id}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword: newPasswordCipher }),
    })
    ElMessage.success('密码已重置，该账号已强制下线')
    showResetPwd.value = false
    resetPassword.value = ''
  } catch (e) {
    if (e instanceof Error && e.name === 'SessionExpiredError') return
    ElMessage.error(e instanceof Error ? e.message : '重置失败')
  } finally {
    saving.value = false
  }
}

async function forceLogout(row: UserRow) {
  if (row.platformAdmin) {
    ElMessage.warning('平台超管不可强制下线')
    return
  }
  forceLogoutTarget.value = row
  showForceLogout.value = true
}

function closeForceLogout() {
  if (saving.value) return
  showForceLogout.value = false
  forceLogoutTarget.value = null
}

async function submitForceLogout() {
  const row = forceLogoutTarget.value
  if (!row) return
  saving.value = true
  try {
    await auth.adminFetch(`/api/admin/users/${row.id}/force-logout`, { method: 'POST' })
    ElMessage.success('已强制下线')
    showForceLogout.value = false
    forceLogoutTarget.value = null
  } catch (e) {
    if (e instanceof Error && e.name === 'SessionExpiredError') return
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.admin-users {
  position: relative;
  display: flex;
  min-height: calc(100dvh - 8.5rem);
  flex-direction: column;
  color: #e2e8f0;
}

.admin-users__anim {
  opacity: 0;
  transform: translateY(14px);
  transition:
    opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: var(--d, 0ms);
}

.admin-users--ready .admin-users__anim {
  opacity: 1;
  transform: none;
}

.admin-users__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.admin-users__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  margin: 0 0 0.55rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  color: rgba(110, 200, 232, 0.8);
}

.admin-users__live {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 999px;
  background: #34d399;
  box-shadow: 0 0 10px rgba(52, 211, 153, 0.8);
  animation: admin-live 1.8s ease-in-out infinite;
}

.admin-users__title {
  margin: 0;
  font-size: clamp(1.55rem, 2.4vw, 1.9rem);
  font-weight: 650;
  letter-spacing: -0.03em;
  color: #fff;
  text-shadow: 0 0 40px rgba(110, 200, 232, 0.15);
}

.admin-users__lead {
  margin: 0.65rem 0 0;
  max-width: 36rem;
  font-size: 0.86rem;
  line-height: 1.65;
  color: #94a3b8;
}

.admin-users__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
}

.admin-users__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-bottom: 1.1rem;
}

.admin-chip {
  display: inline-flex;
  min-width: 6.5rem;
  flex-direction: column;
  gap: 0.2rem;
  border-radius: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.035);
  padding: 0.7rem 0.9rem;
  backdrop-filter: blur(8px);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  em {
    font-style: normal;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.6rem;
    letter-spacing: 0.14em;
    color: #64748b;
  }

  strong {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: #f1f5f9;
  }

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(110, 200, 232, 0.28);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
  }

  &--plan {
    border-color: rgba(110, 200, 232, 0.28);
    background: linear-gradient(145deg, rgba(110, 200, 232, 0.1), rgba(255, 255, 255, 0.02));

    strong {
      color: #a5f3fc;
    }
  }
}

.admin-users__alert {
  margin-bottom: 1rem;
}

.admin-users__panel {
  position: relative;
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgba(110, 200, 232, 0.16);
  background: linear-gradient(180deg, rgba(12, 24, 40, 0.72), rgba(3, 8, 18, 0.82));
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(14px);
}

.admin-users__panel-edge {
  pointer-events: none;
  position: absolute;
  top: 0;
  left: -20%;
  width: 40%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(110, 200, 232, 0.85), transparent);
  animation: admin-edge 4.5s ease-in-out infinite;
}

.admin-users__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0.85rem 1.1rem;
}

.admin-users__panel-title {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  color: #cbd5e1;
}

.admin-users__refresh {
  border: none;
  background: transparent;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  color: #64748b;
  cursor: pointer;

  &:hover:not(:disabled) {
    color: #67e8f9;
  }

  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }
}

.admin-users__table {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: rgba(110, 200, 232, 0.07);
  --el-table-text-color: #e2e8f0;
  --el-table-header-text-color: #94a3b8;
  --el-table-border-color: transparent;
  --el-fill-color-blank: transparent;
  width: 100%;
  flex: 1;

  :deep(.el-table__inner-wrapper::before),
  :deep(.el-table__border-left-patch),
  :deep(.el-table--border::after),
  :deep(.el-table--border::before) {
    display: none;
  }

  :deep(.el-table__header th),
  :deep(.el-table__body td) {
    padding-left: 1.1rem;
    padding-right: 1.1rem;
  }

  :deep(.el-table__empty-text) {
    color: #64748b;
  }

  :deep(.el-loading-mask) {
    background: rgba(2, 6, 23, 0.55);
  }

  :deep(.admin-row) {
    opacity: 0;
    animation: admin-row-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @for $i from 0 through 8 {
    :deep(.admin-row--#{$i}) {
      animation-delay: #{120 + $i * 45}ms;
    }
  }
}

.admin-mono {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: rgba(110, 200, 232, 0.88);
  white-space: nowrap;
}

.admin-muted {
  color: #94a3b8;
}

.admin-plan {
  display: inline-flex;
  border-radius: 0.35rem;
  border: 1px solid rgba(110, 200, 232, 0.28);
  background: rgba(110, 200, 232, 0.1);
  padding: 0.15rem 0.45rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: #6ec8e8;

  &--plat {
    border-color: rgba(167, 139, 250, 0.4);
    background: rgba(167, 139, 250, 0.12);
    color: #c4b5fd;
  }
}

.admin-user {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  line-height: 1.25;

  strong {
    font-size: 0.92rem;
    font-weight: 560;
    color: #f1f5f9;
  }

  em {
    font-style: normal;
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .admin-mono {
    margin-top: 0.1rem;
    opacity: 0.75;
  }
}

.admin-quota {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.35rem;
}

.admin-quota__exp {
  font-size: 0.75rem;
  color: #94a3b8;

  &--warn {
    color: #fbbf24;
  }

  &--dead {
    color: #f87171;
  }
}

.admin-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.admin-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 0.3rem;
  border: 1px solid rgba(110, 200, 232, 0.28);
  background: rgba(110, 200, 232, 0.08);
  padding: 0.12rem 0.4rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.04em;
  color: #a5f3fc;
  white-space: nowrap;

  &--wip {
    border-color: rgba(251, 191, 36, 0.35);
    background: rgba(251, 191, 36, 0.08);
    color: #fcd34d;
  }

  &--plat {
    border-color: rgba(167, 139, 250, 0.4);
    background: rgba(167, 139, 250, 0.12);
    color: #c4b5fd;
  }
}

.admin-ops {
  display: inline-flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.45rem 0.65rem;
}

.admin-lock {
  display: inline-flex;
  border-radius: 0.3rem;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(148, 163, 184, 0.08);
  padding: 0.15rem 0.45rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  color: #94a3b8;
}

.admin-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.1em;

  &::before {
    content: '';
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 999px;
  }

  &--on {
    color: rgba(110, 231, 183, 0.95);

    &::before {
      background: #34d399;
      box-shadow: 0 0 10px rgba(52, 211, 153, 0.75);
      animation: admin-live 1.8s ease-in-out infinite;
    }
  }

  &--off {
    color: #64748b;

    &::before {
      background: #64748b;
    }
  }
}

.admin-link {
  border: none;
  border-bottom: 1px solid rgba(110, 200, 232, 0.35);
  background: transparent;
  padding: 0 0 1px;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: rgba(110, 200, 232, 0.95);
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s,
    text-shadow 0.15s;

  &:hover {
    border-bottom-color: #6ec8e8;
    color: #ecfeff;
    text-shadow: 0 0 12px rgba(110, 200, 232, 0.55);
  }
}

.admin-users__ssr-fallback {
  display: flex;
  align-items: center;
  min-height: 12rem;
  padding: 0 1.1rem;
}

.admin-users__pager {
  display: flex;
  justify-content: flex-end;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0.85rem 1.1rem;

  :deep(.el-pagination) {
    --el-pagination-bg-color: transparent;
    --el-pagination-button-bg-color: rgba(255, 255, 255, 0.04);
    --el-pagination-hover-color: #67e8f9;
    --el-pagination-text-color: #94a3b8;
    --el-color-primary: #0891b2;
  }
}

.admin-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  padding: 0.55rem 0.95rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    color 0.15s ease;

  &:active:not(:disabled) {
    transform: scale(0.97);
  }

  &--primary {
    border-color: rgba(110, 200, 232, 0.45);
    background: linear-gradient(180deg, rgba(110, 200, 232, 0.24), rgba(110, 200, 232, 0.1));
    color: #ecfeff;
    box-shadow: 0 0 22px rgba(110, 200, 232, 0.14);

    &:hover:not(:disabled) {
      border-color: rgba(110, 200, 232, 0.7);
      background: linear-gradient(180deg, rgba(110, 200, 232, 0.34), rgba(110, 200, 232, 0.16));
      box-shadow: 0 0 30px rgba(110, 200, 232, 0.22);
    }
  }

  &--ghost {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.03);
    color: #cbd5e1;

    &:hover:not(:disabled) {
      border-color: rgba(255, 255, 255, 0.22);
      color: #fff;
      background: rgba(255, 255, 255, 0.06);
    }
  }

  &--danger {
    border-color: rgba(251, 113, 133, 0.45);
    background: linear-gradient(180deg, rgba(251, 113, 133, 0.28), rgba(225, 29, 72, 0.14));
    color: #ffe4e6;
    box-shadow: 0 0 22px rgba(244, 63, 94, 0.16);

    &:hover:not(:disabled) {
      border-color: rgba(251, 113, 133, 0.7);
      background: linear-gradient(180deg, rgba(251, 113, 133, 0.38), rgba(225, 29, 72, 0.2));
      box-shadow: 0 0 30px rgba(244, 63, 94, 0.24);
    }
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.admin-select {
  width: 100%;
}

.admin-modal {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(2, 6, 23, 0.78);
  backdrop-filter: blur(12px);
  animation: admin-modal-in 0.28s ease-out both;
}

.admin-modal__panel {
  position: relative;
  width: 100%;
  max-width: 26rem;
  max-height: min(92dvh, 44rem);
  overflow: auto;
  border-radius: 1rem;
  border: 1px solid rgba(110, 200, 232, 0.28);
  padding: 1.55rem 1.45rem 1.35rem;
  background: linear-gradient(165deg, rgba(10, 22, 36, 0.98), rgba(3, 8, 18, 0.99));
  box-shadow:
    0 28px 72px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 0 48px rgba(34, 211, 238, 0.07);

  &--sm {
    max-width: 22rem;
  }

  &--wide {
    max-width: 34rem;
  }

  &--confirm {
    max-width: 24rem;
    border-color: rgba(251, 113, 133, 0.28);
    box-shadow:
      0 28px 72px rgba(0, 0, 0, 0.55),
      0 0 0 1px rgba(255, 255, 255, 0.03) inset,
      0 0 48px rgba(244, 63, 94, 0.08);
  }
}

.admin-modal__glow {
  pointer-events: none;
  position: absolute;
  top: -40%;
  left: 18%;
  width: 64%;
  height: 50%;
  background: radial-gradient(ellipse, rgba(110, 200, 232, 0.14), transparent 70%);
}

.admin-modal__head {
  position: relative;
  margin-bottom: 1.2rem;
  padding-right: 2rem;
}

.admin-modal__eyebrow {
  margin: 0 0 0.4rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.2em;
  color: rgba(110, 200, 232, 0.8);
}

.admin-modal__title {
  margin: 0;
  font-size: 1.28rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #f8fafc;
}

.admin-modal__lead {
  margin: 0.45rem 0 0;
  font-size: 0.82rem;
  line-height: 1.5;
  color: #94a3b8;

  strong {
    color: #e2e8f0;
    font-weight: 600;
  }
}

.admin-modal__warn {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(251, 191, 36, 0.28);
  background: rgba(251, 191, 36, 0.08);
  font-size: 0.8rem;
  line-height: 1.45;
  color: #fde68a;
}

.admin-modal__x {
  position: absolute;
  top: -0.15rem;
  right: 0;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.4rem;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition:
    color 0.15s,
    background 0.15s;

  &:hover {
    color: #a5f3fc;
    background: rgba(255, 255, 255, 0.04);
  }
}

.admin-modal__form {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.admin-modal__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem 0.85rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.admin-modal__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  &--span {
    grid-column: 1 / -1;
  }

  > span {
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    color: #94a3b8;

    i {
      font-style: normal;
      color: #f87171;
    }
  }

  input,
  select {
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.4);
    padding: 0.7rem 0.85rem;
    font-size: 0.9rem;
    color: #f1f5f9;
    outline: none;
    transition:
      border-color 0.15s,
      box-shadow 0.15s;

    &::placeholder {
      color: #475569;
    }

    &:hover {
      border-color: rgba(255, 255, 255, 0.16);
    }

    &:focus {
      border-color: rgba(110, 200, 232, 0.55);
      box-shadow: 0 0 0 3px rgba(110, 200, 232, 0.12);
    }
  }
}

.admin-modal__mods {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.55rem;
  padding: 0.75rem 0.85rem 0.85rem;
  margin: 0;

  legend {
    padding: 0 0.35rem;
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.68rem;
    letter-spacing: 0.1em;
    color: #94a3b8;
  }
}

.admin-modal__hint {
  margin: 0 0 0.55rem;
  font-size: 0.75rem;
  color: #64748b;
}

.admin-mod-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
}

.admin-mod-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  border-radius: 0.55rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.28);
  padding: 0.7rem 0.65rem 0.65rem;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s,
    box-shadow 0.15s;

  input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  strong {
    font-family: ui-monospace, 'IBM Plex Mono', monospace;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    color: #67e8f9;
  }

  em {
    font-style: normal;
    font-size: 0.78rem;
    color: #cbd5e1;
  }

  i {
    font-style: normal;
    font-size: 0.65rem;
    color: #fbbf24;
  }

  &--on {
    border-color: rgba(110, 200, 232, 0.55);
    background: rgba(110, 200, 232, 0.12);
    box-shadow: 0 0 18px rgba(34, 211, 238, 0.1);
  }
}

.admin-modal__select {
  appearance: none;
  background-image:
    linear-gradient(45deg, transparent 50%, #67e8f9 50%),
    linear-gradient(135deg, #67e8f9 50%, transparent 50%);
  background-position:
    calc(100% - 16px) calc(50% - 2px),
    calc(100% - 11px) calc(50% - 2px);
  background-size:
    5px 5px,
    5px 5px;
  background-repeat: no-repeat;
  padding-right: 2rem;

  option {
    background: #0b1220;
    color: #e2e8f0;
  }
}

.admin-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.65rem;
  margin-top: 0.35rem;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

@keyframes admin-modal-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes admin-live {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.8);
  }
}

@keyframes admin-edge {
  0% {
    left: -30%;
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    left: 90%;
    opacity: 0;
  }
}

@keyframes admin-row-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-users__anim,
  .admin-users__live,
  .admin-users__panel-edge,
  .admin-status--on::before,
  .admin-chip {
    animation: none !important;
    transition: none !important;
    opacity: 1 !important;
    transform: none !important;
  }

  .admin-users__table :deep(.admin-row) {
    animation: none !important;
    opacity: 1 !important;
  }
}
</style>
