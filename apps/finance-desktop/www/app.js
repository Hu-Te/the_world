import { DEFAULT_ROUTE, NAV_GROUPS, findModule } from './modules.js'
import { renderLedgerPage } from './ledger.js'

const LS_CLOUD = 'finance-desktop.cloudOrigin'
const LS_TOKEN = 'finance-desktop.accessToken'
const LS_PROFILE = 'finance-desktop.profile'
const LOCAL_ORIGIN = location.protocol.startsWith('http')
  ? `${location.protocol}//${location.host}`
  : 'http://127.0.0.1:18765'

const viewLogin = document.getElementById('viewLogin')
const viewApp = document.getElementById('viewApp')
const cloudOriginEl = document.getElementById('cloudOrigin')
const usernameEl = document.getElementById('username')
const passwordEl = document.getElementById('password')
const loginMsg = document.getElementById('loginMsg')
const btnLogin = document.getElementById('btnLogin')
const btnLogout = document.getElementById('btnLogout')
const cloudStatus = document.getElementById('cloudStatus')
const localStatus = document.getElementById('localStatus')
const appCloudStatus = document.getElementById('appCloudStatus')
const appLocalStatus = document.getElementById('appLocalStatus')
const sideNav = document.getElementById('sideNav')
const pageBody = document.getElementById('pageBody')
const pageTitle = document.getElementById('pageTitle')
const pageLead = document.getElementById('pageLead')
const pageKicker = document.getElementById('pageKicker')
const railUser = document.getElementById('railUser')
const railTenant = document.getElementById('railTenant')

let profile = null
let localReady = false

cloudOriginEl.value = localStorage.getItem(LS_CLOUD) || 'https://hute.top'
buildSideNav()
boot()

function setStat(el, text, tone) {
  if (!el) return
  el.textContent = text
  const box = el.closest('.hud__cell')
  if (!box) return
  box.classList.remove('is-ok', 'is-warn', 'is-err')
  if (tone) box.classList.add(tone)
}

function showMsg(el, text, ok) {
  el.hidden = false
  el.textContent = text
  el.classList.toggle('is-ok', !!ok)
  el.classList.toggle('is-err', !ok)
}

function readProfile() {
  const raw = localStorage.getItem(LS_PROFILE)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function cloudBase() {
  return String(cloudOriginEl.value || '')
    .trim()
    .replace(/\/$/, '')
}

function tauriInvoke() {
  return window.__TAURI__?.core?.invoke || null
}

async function rawRequest(url, init = {}) {
  const method = (init.method || 'GET').toUpperCase()
  const headers = {
    Accept: 'application/json',
    ...(init.headers || {}),
  }
  const body = init.body == null ? null : String(init.body)
  const invoke = tauriInvoke()
  if (invoke) {
    const payload = await invoke('http_request', { url, method, headers, body })
    return {
      ok: payload.status >= 200 && payload.status < 300,
      status: payload.status,
      async json() {
        try {
          return JSON.parse(payload.body || '{}')
        } catch {
          return {}
        }
      },
    }
  }
  return fetch(url, { ...init, headers })
}

async function apiJson(origin, path, init = {}) {
  const base = String(origin || '').replace(/\/$/, '')
  const res = await rawRequest(`${base}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.headers || {}),
    },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.code !== 0) {
    throw new Error(json.message || `HTTP ${res.status}`)
  }
  return json.data
}

function b64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64(buf) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

async function encryptPassword(origin, plain) {
  if (!plain) throw new Error('密码不能为空')
  if (!crypto?.subtle) throw new Error('当前环境不支持 WebCrypto')
  const payload = await apiJson(origin, '/api/auth/public-key')
  if (payload.alg && payload.alg !== 'RSA-OAEP-256') {
    throw new Error(`不支持的口令加密算法: ${payload.alg}`)
  }
  const spki = b64ToBytes(payload.publicKey)
  const key = await crypto.subtle.importKey(
    'spki',
    spki.buffer,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )
  const cipher = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(plain),
  )
  return bytesToB64(cipher)
}

async function probeLocal() {
  setStat(localStatus, '检测中…', 'is-warn')
  setStat(appLocalStatus, '检测中…', 'is-warn')
  try {
    const data = await apiJson(LOCAL_ORIGIN, '/api/desktop/finance/health')
    localReady = true
    if (data?.tenantId > 0) {
      setStat(localStatus, '已就绪', 'is-ok')
      setStat(appLocalStatus, '已就绪', 'is-ok')
    } else {
      setStat(localStatus, '等待登录', 'is-warn')
      setStat(appLocalStatus, '等待绑定', 'is-warn')
    }
    return data
  } catch {
    localReady = false
    setStat(localStatus, '启动中…', 'is-warn')
    setStat(appLocalStatus, '启动中…', 'is-warn')
    return null
  }
}

async function activateLocal(tenantId) {
  setStat(localStatus, '绑定本机…', 'is-warn')
  setStat(appLocalStatus, '绑定本机…', 'is-warn')
  const result = await apiJson(LOCAL_ORIGIN, '/api/desktop/finance/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantId }),
  })
  if (result?.restarting) {
    setStat(localStatus, '切换数据目录…', 'is-warn')
    setStat(appLocalStatus, '切换数据目录…', 'is-warn')
    await waitLocalReady(tenantId, 90000)
  } else {
    localReady = true
    setStat(localStatus, '已就绪', 'is-ok')
    setStat(appLocalStatus, '已就绪', 'is-ok')
  }
}

async function waitLocalReady(tenantId, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 1200))
    try {
      const data = await apiJson(LOCAL_ORIGIN, '/api/desktop/finance/health')
      if (Number(data?.tenantId) === Number(tenantId)) {
        localReady = true
        setStat(localStatus, '已就绪', 'is-ok')
        setStat(appLocalStatus, '已就绪', 'is-ok')
        return
      }
    } catch {
      /* restarting */
    }
  }
  throw new Error('本机服务就绪超时，请确认「财务审计桌面服务」窗口仍在运行')
}

function buildSideNav() {
  sideNav.innerHTML = ''
  for (const group of NAV_GROUPS) {
    const g = document.createElement('div')
    g.className = 'rail__group'
    const label = document.createElement('p')
    label.className = 'rail__group-label'
    label.textContent = group.label
    g.appendChild(label)
    for (const item of group.items) {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'rail__item'
      btn.dataset.route = item.id
      btn.innerHTML = `<em>${item.kicker.slice(0, 4)}</em><span>${item.title}</span>`
      if (item.phase && item.phase !== 'P0' && item.phase !== 'P1') {
        const badge = document.createElement('i')
        badge.textContent = item.phase
        btn.appendChild(badge)
      }
      btn.addEventListener('click', () => navigate(item.id))
      g.appendChild(btn)
    }
    sideNav.appendChild(g)
  }
}

function currentRoute() {
  const hash = (location.hash || '').replace(/^#\/?/, '')
  return hash || DEFAULT_ROUTE
}

function navigate(route) {
  const id = findModule(route) ? route : DEFAULT_ROUTE
  if (location.hash !== `#/${id}`) {
    location.hash = `#/${id}`
  } else {
    renderRoute(id)
  }
}

async function localApi(path, init = {}) {
  return apiJson(LOCAL_ORIGIN, path, init)
}

async function renderRoute(route) {
  const found = findModule(route) || findModule(DEFAULT_ROUTE)
  const mod = found.module
  pageKicker.textContent = mod.kicker
  pageTitle.textContent = mod.title
  pageLead.textContent = mod.lead

  sideNav.querySelectorAll('.rail__item').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.route === mod.id)
  })

  if (mod.id === 'home') {
    pageBody.innerHTML = renderHome()
  } else if (mod.id === 'session') {
    pageBody.innerHTML = renderSession()
  } else if (mod.id === 'books' || mod.id === 'coa' || mod.id === 'vouchers') {
    pageBody.innerHTML = `<p class="hint">加载中…</p>`
    try {
      await renderLedgerPage(mod.id, pageBody, {
        localApi,
        esc,
        onBookChange() {},
      })
    } catch (e) {
      pageBody.innerHTML = `<p class="toast is-err">${esc(e instanceof Error ? e.message : String(e))}</p>`
    }
  } else {
    pageBody.innerHTML = renderPlaceholder(mod)
  }
}

function renderHome() {
  const p = profile || {}
  const path = p.tenantId ? `~/.hute/finance/${p.tenantId}/` : '~/.hute/finance/{tenantId}/'
  return `
    <div class="grid2">
      <section class="panel">
        <header class="panel__head">
          <div>
            <p class="panel__kicker">SESSION</p>
            <h2>当前会话</h2>
          </div>
        </header>
        <div class="panel__body">
          <dl class="kv">
            <div><dt>用户</dt><dd>${esc(p.displayName || '—')}</dd></div>
            <div><dt>tenantId</dt><dd><code>${esc(String(p.tenantId || '—'))}</code></dd></div>
            <div><dt>套餐</dt><dd>${esc(p.planCode || '—')}</dd></div>
            <div><dt>模块</dt><dd>${esc((p.unlockedModules || []).join(', ') || '—')}</dd></div>
            <div><dt>本机目录</dt><dd><code>${esc(path)}</code></dd></div>
            <div><dt>本机服务</dt><dd>${localReady ? '已就绪' : '未就绪'}</dd></div>
          </dl>
        </div>
      </section>
      <section class="panel">
        <header class="panel__head">
          <div>
            <p class="panel__kicker">ROADMAP</p>
            <h2>建设节奏</h2>
          </div>
        </header>
        <div class="panel__body">
          <ol class="roadmap">
            <li><strong>P0</strong> 壳、登录、本机就绪、可跳转菜单 ✅</li>
            <li><strong>P1</strong> 账套 · 科目 · 凭证 — 核算最小闭环 ✅</li>
            <li><strong>P2</strong> 账簿 · 结账 · 外币汇兑</li>
            <li><strong>P3</strong> 报表 · 审计底稿 · 导入导出</li>
          </ol>
          <p class="hint">从左侧进入「账套与期间 → 科目体系 → 凭证中心」走通闭环。过账后的明细账属 P2。</p>
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top:0.9rem">
      <header class="panel__head">
        <div>
          <p class="panel__kicker">ARCHITECTURE</p>
          <h2>模块边界</h2>
        </div>
      </header>
      <div class="panel__body">
        <div class="arch">
          <article>
            <h3>云端</h3>
            <p>IAM 登录、套餐门禁、安装包分发。不写业务账。</p>
          </article>
          <article>
            <h3>本机 Sidecar</h3>
            <p>H2 账库、凭证与结账服务、静态壳托管。数据仅本地。</p>
          </article>
          <article>
            <h3>桌面壳</h3>
            <p>菜单导航与人机交互；业务 API 一律走 /api/desktop/finance/**。</p>
          </article>
        </div>
      </div>
    </section>
  `
}

function renderSession() {
  const p = profile || {}
  return `
    <section class="panel">
      <header class="panel__head">
        <div>
          <p class="panel__kicker">SYSTEM</p>
          <h2>会话与本机</h2>
        </div>
      </header>
      <div class="panel__body">
        <dl class="kv">
          <div><dt>显示名</dt><dd>${esc(p.displayName || '—')}</dd></div>
          <div><dt>userId</dt><dd><code>${esc(String(p.userId || '—'))}</code></dd></div>
          <div><dt>tenantId</dt><dd><code>${esc(String(p.tenantId || '—'))}</code></dd></div>
          <div><dt>本机 API</dt><dd><code>${esc(LOCAL_ORIGIN)}</code></dd></div>
        </dl>
        <div class="card__actions" style="margin-top:1rem">
          <button type="button" class="btn btn--fill" id="btnRefreshLocal">刷新本机状态</button>
        </div>
      </div>
    </section>
  `
}

function renderPlaceholder(mod) {
  const bullets = (mod.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')
  return `
    <section class="panel">
      <header class="panel__head">
        <div>
          <p class="panel__kicker">${esc(mod.kicker)}</p>
          <h2>${esc(mod.title)}</h2>
        </div>
        <p class="panel__hint">${esc(mod.phase || '规划中')} · 功能建设中</p>
      </header>
      <div class="panel__body">
        <p class="hint">${esc(mod.lead)}</p>
        <ul class="bullets">${bullets}</ul>
        <p class="hint" style="margin-top:1rem">本页为可跳转占位。交付后将替换为真实业务台面，不改菜单 ID，便于平滑演进。</p>
      </div>
    </section>
  `
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function showApp(show) {
  viewLogin.hidden = show
  viewApp.hidden = !show
  document.getElementById('appShell').classList.toggle('desk--simple', !show)
}

function syncRail() {
  const p = profile || {}
  railUser.textContent = p.displayName || '未登录'
  railTenant.textContent = p.tenantId ? `tenant ${p.tenantId}` : 'tenant —'
  setStat(appCloudStatus, p.displayName || '未登录', p.displayName ? 'is-ok' : null)
}

async function boot() {
  profile = readProfile()
  await probeLocal()
  if (profile?.tenantId && localStorage.getItem(LS_TOKEN)) {
    setStat(cloudStatus, profile.displayName || '已登录', 'is-ok')
    setStat(appCloudStatus, profile.displayName || '已登录', 'is-ok')
    syncRail()
    showApp(true)
    await renderRoute(currentRoute())
  } else {
    showApp(false)
  }
}

window.addEventListener('hashchange', () => {
  if (!viewApp.hidden) void renderRoute(currentRoute())
})

pageBody.addEventListener('click', async (e) => {
  const t = e.target
  if (t && t.id === 'btnRefreshLocal') {
    await probeLocal()
    renderRoute('session')
  }
})

btnLogout?.addEventListener('click', () => {
  localStorage.removeItem(LS_TOKEN)
  localStorage.removeItem(LS_PROFILE)
  profile = null
  location.hash = ''
  showApp(false)
  setStat(cloudStatus, '未登录', null)
  setStat(appCloudStatus, '未登录', null)
})

btnLogin.addEventListener('click', async () => {
  btnLogin.disabled = true
  setStat(cloudStatus, '校验中…', 'is-warn')
  try {
    const origin = cloudBase()
    localStorage.setItem(LS_CLOUD, origin)
    const cipher = await encryptPassword(origin, passwordEl.value)
    const data = await apiJson(origin, '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameEl.value.trim(),
        password: cipher,
      }),
    })
    const token = data.accessToken
    const p = data.profile || {}
    const modules = [...(p.unlockedModules || [])].map((m) => String(m).toUpperCase())
    const roles = [...(p.roles || [])]
    const okFinance = roles.includes('SUPER_ADMIN') || modules.includes('FINANCE')
    if (!okFinance) throw new Error('当前账号未解锁 FINANCE 模块')
    if (!p.tenantId) throw new Error('登录成功但缺少 tenantId')

    localStorage.setItem(LS_TOKEN, token || '')
    profile = {
      tenantId: p.tenantId,
      userId: p.userId,
      displayName: p.displayName || p.username,
      planCode: p.planCode,
      unlockedModules: modules,
    }
    localStorage.setItem(LS_PROFILE, JSON.stringify(profile))
    setStat(cloudStatus, profile.displayName || '已登录', 'is-ok')
    await activateLocal(profile.tenantId)
    showMsg(loginMsg, '本机已就绪，正在进入工作台…', true)
    syncRail()
    showApp(true)
    navigate(DEFAULT_ROUTE)
  } catch (e) {
    setStat(cloudStatus, '登录失败', 'is-err')
    setStat(localStatus, '未就绪', 'is-err')
    showMsg(loginMsg, e instanceof Error ? e.message : String(e), false)
  } finally {
    btnLogin.disabled = false
  }
})
