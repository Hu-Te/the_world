/**
 * P1 核算台面：账套 · 科目 · 凭证
 * 依赖宿主注入的 localApi(path, init) → data
 */

const LS_BOOK = 'finance-desktop.activeBookId'

export function getActiveBookId() {
  const v = localStorage.getItem(LS_BOOK)
  return v ? Number(v) : null
}

export function setActiveBookId(id) {
  if (id == null) localStorage.removeItem(LS_BOOK)
  else localStorage.setItem(LS_BOOK, String(id))
}

export async function renderLedgerPage(route, root, ctx) {
  const { localApi, esc, onBookChange } = ctx
  if (route === 'books') return renderBooks(root, { localApi, esc, onBookChange })
  if (route === 'coa') return renderCoa(root, { localApi, esc, onBookChange })
  if (route === 'vouchers') return renderVouchers(root, { localApi, esc, onBookChange })
  root.innerHTML = `<p class="hint">未知模块</p>`
}

async function loadBooks(localApi) {
  return (await localApi('/api/desktop/finance/books')) || []
}

function bookPickerHtml(books, activeId, esc) {
  const opts = books
    .map(
      (b) =>
        `<option value="${esc(String(b.id))}" ${Number(b.id) === Number(activeId) ? 'selected' : ''}>${esc(b.code)} · ${esc(b.name)}</option>`,
    )
    .join('')
  return `
    <label class="field field--inline">
      <span>当前账套</span>
      <select id="activeBook">${opts || '<option value="">暂无账套</option>'}</select>
    </label>`
}

async function renderBooks(root, { localApi, esc, onBookChange }) {
  let books = []
  let err = ''
  try {
    books = await loadBooks(localApi)
  } catch (e) {
    err = e instanceof Error ? e.message : String(e)
  }
  const year = new Date().getFullYear()
  root.innerHTML = `
    <div class="grid2">
      <section class="panel">
        <header class="panel__head"><div><p class="panel__kicker">BOOKS</p><h2>账套列表</h2></div></header>
        <div class="panel__body">
          ${err ? `<p class="toast is-err">${esc(err)}</p>` : ''}
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>编码</th><th>名称</th><th>年度</th><th>币种</th><th>状态</th><th></th></tr></thead>
              <tbody>
                ${
                  books.length
                    ? books
                        .map(
                          (b) => `<tr>
                    <td><code>${esc(b.code)}</code></td>
                    <td>${esc(b.name)}</td>
                    <td>${esc(String(b.fiscalYear))}</td>
                    <td>${esc(b.functionalCurrency)}</td>
                    <td>${esc(b.status)}</td>
                    <td><button type="button" class="btn btn--mini" data-use-book="${esc(String(b.id))}">选用</button></td>
                  </tr>`,
                        )
                        .join('')
                    : '<tr><td colspan="6" class="muted">尚无账套，请先创建</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section class="panel">
        <header class="panel__head"><div><p class="panel__kicker">CREATE</p><h2>新建账套</h2></div></header>
        <div class="panel__body">
          <label class="field"><span>编码</span><input id="bookCode" placeholder="MAIN" /></label>
          <label class="field"><span>名称</span><input id="bookName" placeholder="主账套" /></label>
          <div class="field-row">
            <label class="field"><span>本位币</span><input id="bookCcy" value="CNY" /></label>
            <label class="field"><span>会计年度</span><input id="bookYear" type="number" value="${year}" /></label>
          </div>
          <button type="button" class="btn btn--fill" id="btnCreateBook">创建并生成 12 期</button>
          <p id="bookMsg" class="toast" hidden></p>
          <p class="hint">创建后自动生成该年度 1–12 月 OPEN 期间。</p>
        </div>
      </section>
    </div>
    <section class="panel" style="margin-top:0.9rem" id="periodPanel" hidden>
      <header class="panel__head"><div><p class="panel__kicker">PERIODS</p><h2>期间</h2></div></header>
      <div class="panel__body" id="periodBody"></div>
    </section>`

  root.querySelector('#btnCreateBook')?.addEventListener('click', async () => {
    const msg = root.querySelector('#bookMsg')
    try {
      const created = await localApi('/api/desktop/finance/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: root.querySelector('#bookCode').value.trim(),
          name: root.querySelector('#bookName').value.trim(),
          functionalCurrency: root.querySelector('#bookCcy').value.trim() || 'CNY',
          fiscalYear: Number(root.querySelector('#bookYear').value) || year,
        }),
      })
      setActiveBookId(created.id)
      onBookChange?.(created.id)
      showToast(msg, '账套已创建', true)
      await renderBooks(root, { localApi, esc, onBookChange })
      await showPeriods(root, localApi, esc, created.id)
    } catch (e) {
      showToast(msg, e instanceof Error ? e.message : String(e), false)
    }
  })

  root.querySelectorAll('[data-use-book]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-use-book'))
      setActiveBookId(id)
      onBookChange?.(id)
      await showPeriods(root, localApi, esc, id)
    })
  })

  const active = getActiveBookId()
  if (active && books.some((b) => Number(b.id) === active)) {
    await showPeriods(root, localApi, esc, active)
  }
}

async function showPeriods(root, localApi, esc, bookId) {
  const panel = root.querySelector('#periodPanel')
  const body = root.querySelector('#periodBody')
  if (!panel || !body) return
  panel.hidden = false
  try {
    const periods = await localApi(`/api/desktop/finance/books/${bookId}/periods`)
    body.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>期间</th><th>状态</th><th></th></tr></thead>
          <tbody>
            ${(periods || [])
              .map(
                (p) => `<tr>
              <td>${esc(p.label)}</td>
              <td>${esc(p.status)}</td>
              <td>${
                p.status === 'OPEN'
                  ? `<button type="button" class="btn btn--mini" data-close-period="${esc(String(p.id))}">关账</button>`
                  : '—'
              }</td>
            </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    body.querySelectorAll('[data-close-period]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pid = Number(btn.getAttribute('data-close-period'))
        if (!confirm('确认关账？关账后该期不可再录/改凭证。')) return
        await localApi(`/api/desktop/finance/periods/${pid}/close`, { method: 'POST' })
        await showPeriods(root, localApi, esc, bookId)
      })
    })
  } catch (e) {
    body.innerHTML = `<p class="toast is-err">${esc(e instanceof Error ? e.message : String(e))}</p>`
  }
}

async function renderCoa(root, { localApi, esc, onBookChange }) {
  let books = []
  try {
    books = await loadBooks(localApi)
  } catch (e) {
    root.innerHTML = `<p class="toast is-err">${esc(e instanceof Error ? e.message : String(e))}</p>`
    return
  }
  if (!books.length) {
    root.innerHTML = `<section class="panel"><div class="panel__body"><p class="hint">请先在「账套与期间」创建账套。</p></div></section>`
    return
  }
  let active = getActiveBookId()
  if (!active || !books.some((b) => Number(b.id) === active)) {
    active = books[0].id
    setActiveBookId(active)
  }

  let accounts = []
  let err = ''
  try {
    accounts = await localApi(`/api/desktop/finance/accounts?bookId=${active}`)
  } catch (e) {
    err = e instanceof Error ? e.message : String(e)
  }

  root.innerHTML = `
    <section class="panel">
      <header class="panel__head">
        <div><p class="panel__kicker">COA</p><h2>科目体系</h2></div>
        ${bookPickerHtml(books, active, esc)}
      </header>
      <div class="panel__body">
        ${err ? `<p class="toast is-err">${esc(err)}</p>` : ''}
        <div class="toolbar">
          <button type="button" class="btn btn--mini" id="btnSeed">导入精简科目表</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>编码</th><th>名称</th><th>类型</th><th>方向</th><th>启用</th><th></th></tr></thead>
            <tbody>
              ${
                (accounts || []).length
                  ? accounts
                      .map(
                        (a) => `<tr>
                  <td><code>${esc(a.code)}</code></td>
                  <td>${esc(a.name)}</td>
                  <td>${esc(a.accountType)}</td>
                  <td>${esc(a.balanceDir)}</td>
                  <td>${a.enabled ? '是' : '否'}</td>
                  <td><button type="button" class="btn btn--mini" data-toggle-acc="${esc(String(a.id))}" data-en="${a.enabled ? '0' : '1'}">${a.enabled ? '禁用' : '启用'}</button></td>
                </tr>`,
                      )
                      .join('')
                  : '<tr><td colspan="6" class="muted">暂无科目</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <section class="panel" style="margin-top:0.9rem">
      <header class="panel__head"><div><p class="panel__kicker">ADD</p><h2>新增科目</h2></div></header>
      <div class="panel__body">
        <div class="field-row">
          <label class="field"><span>编码</span><input id="accCode" placeholder="1001" /></label>
          <label class="field"><span>名称</span><input id="accName" placeholder="库存现金" /></label>
        </div>
        <div class="field-row">
          <label class="field"><span>类型</span>
            <select id="accType">
              <option value="ASSET">ASSET 资产</option>
              <option value="LIABILITY">LIABILITY 负债</option>
              <option value="EQUITY">EQUITY 权益</option>
              <option value="REVENUE">REVENUE 收入</option>
              <option value="EXPENSE">EXPENSE 费用</option>
            </select>
          </label>
          <label class="field"><span>方向（可空=按类型默认）</span>
            <select id="accDir">
              <option value="">自动</option>
              <option value="DEBIT">DEBIT</option>
              <option value="CREDIT">CREDIT</option>
            </select>
          </label>
        </div>
        <button type="button" class="btn btn--fill" id="btnAddAcc">保存科目</button>
        <p id="accMsg" class="toast" hidden></p>
      </div>
    </section>`

  root.querySelector('#activeBook')?.addEventListener('change', async (e) => {
    const id = Number(e.target.value)
    setActiveBookId(id)
    onBookChange?.(id)
    await renderCoa(root, { localApi, esc, onBookChange })
  })

  root.querySelector('#btnSeed')?.addEventListener('click', async () => {
    const msg = root.querySelector('#accMsg')
    try {
      await localApi(`/api/desktop/finance/accounts/seed-default?bookId=${getActiveBookId()}`, {
        method: 'POST',
      })
      showToast(msg, '已导入精简科目表', true)
      await renderCoa(root, { localApi, esc, onBookChange })
    } catch (e) {
      showToast(msg, e instanceof Error ? e.message : String(e), false)
    }
  })

  root.querySelector('#btnAddAcc')?.addEventListener('click', async () => {
    const msg = root.querySelector('#accMsg')
    try {
      const dir = root.querySelector('#accDir').value
      await localApi(`/api/desktop/finance/accounts?bookId=${getActiveBookId()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: root.querySelector('#accCode').value.trim(),
          name: root.querySelector('#accName').value.trim(),
          accountType: root.querySelector('#accType').value,
          balanceDir: dir || null,
        }),
      })
      showToast(msg, '科目已保存', true)
      await renderCoa(root, { localApi, esc, onBookChange })
    } catch (e) {
      showToast(msg, e instanceof Error ? e.message : String(e), false)
    }
  })

  root.querySelectorAll('[data-toggle-acc]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-toggle-acc'))
      const enabled = btn.getAttribute('data-en') === '1'
      await localApi(`/api/desktop/finance/accounts/${id}/enabled?enabled=${enabled}`, {
        method: 'POST',
      })
      await renderCoa(root, { localApi, esc, onBookChange })
    })
  })
}

async function renderVouchers(root, { localApi, esc, onBookChange }) {
  let books = []
  try {
    books = await loadBooks(localApi)
  } catch (e) {
    root.innerHTML = `<p class="toast is-err">${esc(e instanceof Error ? e.message : String(e))}</p>`
    return
  }
  if (!books.length) {
    root.innerHTML = `<section class="panel"><div class="panel__body"><p class="hint">请先创建账套与科目。</p></div></section>`
    return
  }
  let active = getActiveBookId()
  if (!active || !books.some((b) => Number(b.id) === active)) {
    active = books[0].id
    setActiveBookId(active)
  }

  let periods = []
  let accounts = []
  let vouchers = []
  let err = ''
  try {
    ;[periods, accounts, vouchers] = await Promise.all([
      localApi(`/api/desktop/finance/books/${active}/periods`),
      localApi(`/api/desktop/finance/accounts?bookId=${active}`),
      localApi(`/api/desktop/finance/vouchers?bookId=${active}`),
    ])
  } catch (e) {
    err = e instanceof Error ? e.message : String(e)
  }

  const openPeriods = (periods || []).filter((p) => p.status === 'OPEN')
  const enabledAcc = (accounts || []).filter((a) => a.enabled)
  const today = new Date().toISOString().slice(0, 10)

  root.innerHTML = `
    <section class="panel">
      <header class="panel__head">
        <div><p class="panel__kicker">VOUCHERS</p><h2>凭证列表</h2></div>
        ${bookPickerHtml(books, active, esc)}
      </header>
      <div class="panel__body">
        ${err ? `<p class="toast is-err">${esc(err)}</p>` : ''}
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>凭证号</th><th>日期</th><th>摘要</th><th>借方</th><th>贷方</th><th>状态</th><th></th></tr></thead>
            <tbody>
              ${
                (vouchers || []).length
                  ? vouchers
                      .map(
                        (v) => `<tr>
                  <td><code>${esc(v.voucherNo)}</code></td>
                  <td>${esc(v.voucherDate)}</td>
                  <td>${esc(v.summary || '')}</td>
                  <td>${esc(String(v.debitTotal))}</td>
                  <td>${esc(String(v.creditTotal))}</td>
                  <td>${esc(v.status)}</td>
                  <td class="actions">
                    ${
                      v.status === 'DRAFT'
                        ? `<button type="button" class="btn btn--mini" data-post="${esc(String(v.id))}">过账</button>`
                        : ''
                    }
                    ${
                      v.status === 'POSTED'
                        ? `<button type="button" class="btn btn--mini" data-void="${esc(String(v.id))}">作废</button>`
                        : ''
                    }
                  </td>
                </tr>`,
                      )
                      .join('')
                  : '<tr><td colspan="7" class="muted">暂无凭证</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
    <section class="panel" style="margin-top:0.9rem">
      <header class="panel__head"><div><p class="panel__kicker">DRAFT</p><h2>录入凭证</h2></div></header>
      <div class="panel__body">
        <div class="field-row">
          <label class="field"><span>期间</span>
            <select id="vPeriod">
              ${
                openPeriods.length
                  ? openPeriods
                      .map((p) => `<option value="${esc(String(p.id))}">${esc(p.label)}</option>`)
                      .join('')
                  : '<option value="">无可用 OPEN 期间</option>'
              }
            </select>
          </label>
          <label class="field"><span>日期</span><input id="vDate" type="date" value="${today}" /></label>
        </div>
        <label class="field"><span>摘要</span><input id="vSummary" placeholder="业务摘要" /></label>
        <div class="table-wrap">
          <table class="data" id="vLines">
            <thead><tr><th>科目</th><th>摘要</th><th>借方</th><th>贷方</th><th></th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="toolbar">
          <button type="button" class="btn btn--mini" id="btnAddLine">加行</button>
          <button type="button" class="btn btn--fill" id="btnSaveVoucher">保存草稿</button>
        </div>
        <p id="vMsg" class="toast" hidden></p>
        <p class="hint">借贷须平衡；保存后可在列表过账。P1 过账仅锁定凭证，明细账查询属 P2。</p>
      </div>
    </section>`

  const accOptions = enabledAcc
    .map((a) => `<option value="${esc(String(a.id))}">${esc(a.code)} ${esc(a.name)}</option>`)
    .join('')

  function addLine() {
    const tb = root.querySelector('#vLines tbody')
    const tr = document.createElement('tr')
    tr.innerHTML = `
      <td><select class="v-acc">${accOptions}</select></td>
      <td><input class="v-sum" placeholder="分录摘要" /></td>
      <td><input class="v-dr" type="number" step="0.01" min="0" value="" /></td>
      <td><input class="v-cr" type="number" step="0.01" min="0" value="" /></td>
      <td><button type="button" class="btn btn--mini v-del">删</button></td>`
    tr.querySelector('.v-del').addEventListener('click', () => tr.remove())
    tb.appendChild(tr)
  }

  addLine()
  addLine()

  root.querySelector('#btnAddLine')?.addEventListener('click', addLine)

  root.querySelector('#activeBook')?.addEventListener('change', async (e) => {
    const id = Number(e.target.value)
    setActiveBookId(id)
    onBookChange?.(id)
    await renderVouchers(root, { localApi, esc, onBookChange })
  })

  root.querySelector('#btnSaveVoucher')?.addEventListener('click', async () => {
    const msg = root.querySelector('#vMsg')
    const lines = [...root.querySelectorAll('#vLines tbody tr')].map((tr) => {
      const debit = tr.querySelector('.v-dr').value
      const credit = tr.querySelector('.v-cr').value
      return {
        accountId: Number(tr.querySelector('.v-acc').value),
        summary: tr.querySelector('.v-sum').value.trim(),
        debitAmount: debit === '' ? 0 : Number(debit),
        creditAmount: credit === '' ? 0 : Number(credit),
      }
    })
    try {
      await localApi(`/api/desktop/finance/vouchers?bookId=${getActiveBookId()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periodId: Number(root.querySelector('#vPeriod').value),
          voucherDate: root.querySelector('#vDate').value,
          summary: root.querySelector('#vSummary').value.trim(),
          lines,
        }),
      })
      showToast(msg, '草稿已保存', true)
      await renderVouchers(root, { localApi, esc, onBookChange })
    } catch (e) {
      showToast(msg, e instanceof Error ? e.message : String(e), false)
    }
  })

  root.querySelectorAll('[data-post]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-post'))
      try {
        await localApi(`/api/desktop/finance/vouchers/${id}/post`, { method: 'POST' })
        await renderVouchers(root, { localApi, esc, onBookChange })
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e))
      }
    })
  })

  root.querySelectorAll('[data-void]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.getAttribute('data-void'))
      if (!confirm('确认作废该已过账凭证？')) return
      try {
        await localApi(`/api/desktop/finance/vouchers/${id}/void`, { method: 'POST' })
        await renderVouchers(root, { localApi, esc, onBookChange })
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e))
      }
    })
  })
}

function showToast(el, text, ok) {
  if (!el) return
  el.hidden = false
  el.textContent = text
  el.classList.toggle('is-ok', !!ok)
  el.classList.toggle('is-err', !ok)
}
