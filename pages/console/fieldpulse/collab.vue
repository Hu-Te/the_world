<template>
  <PlcCenterShell title="工作协同">
    <template #actions>
      <button type="button" class="plc-btn plc-btn--ghost" @click="reloadList">刷新</button>
      <button type="button" class="plc-btn" @click="showCreate = !showCreate">
        {{ showCreate ? '收起' : '新建空间' }}
      </button>
    </template>

    <div class="collab">
      <p class="collab__lead">
        邀请同事进入空间，默认同写<strong>协作纪要</strong>。PLC 数据需所有者额外挂载；删除空间或停止设备会话后共享结束。操作疑问请询问右下角「深空精灵」。
      </p>

      <p v-if="error" class="collab__toast collab__toast--err">{{ error }}</p>
      <p v-if="okMsg" class="collab__toast collab__toast--ok">{{ okMsg }}</p>

      <div class="collab__toolbar">
        <form class="collab__join" @submit.prevent="onJoin">
          <span class="collab__toolbar-label">兑钥加入</span>
          <input
            v-model="joinKey"
            class="collab__input collab__input--grow"
            placeholder="粘贴邀请密钥"
            required />
          <button type="submit" class="plc-btn">加入</button>
        </form>
      </div>

      <form v-if="showCreate" class="collab__create" @submit.prevent="onCreate">
        <input v-model="createName" class="collab__input" placeholder="空间名称" required maxlength="128" />
        <input v-model="createNote" class="collab__input collab__input--grow" placeholder="备注（可选）" maxlength="512" />
        <button type="submit" class="plc-btn">创建</button>
      </form>

      <div class="collab__workspace">
        <aside class="collab__rail">
          <p class="collab__rail-title">空间</p>
          <ul class="collab__space-list">
            <li
              v-for="s in spaces"
              :key="String(s.id)"
              class="collab__space"
              :class="{ 'is-active': String(selectedId) === String(s.id) }"
              @click="openSpace(s.id)">
              <div class="collab__space-body">
                <p class="collab__space-name">{{ s.name }}</p>
                <span class="collab__badge" :data-role="s.myRole">{{ roleLabel(s.myRole) }}</span>
              </div>
              <button
                v-if="s.myRole === 'OWNER'"
                type="button"
                class="collab__icon-btn"
                title="删除"
                @click.stop="onDeleteSpace(s)">
                删
              </button>
              <button
                v-else
                type="button"
                class="collab__icon-btn"
                title="退出"
                @click.stop="onLeaveSpace(s.id)">
                退
              </button>
            </li>
            <li v-if="!spaces.length" class="collab__empty">暂无空间</li>
          </ul>
        </aside>

        <main v-if="detail" class="collab__stage">
          <header class="collab__stage-head">
            <div>
              <h3 class="collab__stage-title">{{ detail.space.name }}</h3>
              <p class="collab__stage-sub">
                <span class="collab__badge" :data-role="detail.space.myRole">{{
                  roleLabel(detail.space.myRole)
                }}</span>
                <span v-if="detail.space.ownerDisplayName" class="collab__dim">
                  所有者 {{ detail.space.ownerDisplayName }}
                </span>
              </p>
            </div>
            <button
              v-if="detail.space.myRole === 'OWNER'"
              type="button"
              class="plc-btn plc-btn--ghost"
              @click="onDeleteSpace(detail.space)">
              删除空间
            </button>
            <button v-else type="button" class="plc-btn plc-btn--ghost" @click="onLeave">退出</button>
          </header>

          <section class="collab__block collab__block--board">
            <div class="collab__block-head">
              <h4 class="collab__block-title">协作纪要</h4>
              <div class="collab__block-actions">
                <span class="collab__dim">v{{ detail.board.revision }}</span>
                <button
                  v-if="canEditBoard"
                  type="button"
                  class="plc-btn"
                  :disabled="savingBoard"
                  @click="onSaveBoard">
                  {{ savingBoard ? '保存中…' : '保存' }}
                </button>
              </div>
            </div>
            <textarea
              v-model="boardNotes"
              class="collab__board"
              rows="8"
              :readonly="!canEditBoard"
              placeholder="协作纪要、待办、交接说明…" />
          </section>

          <div class="collab__grid">
            <section class="collab__block">
              <h4 class="collab__block-title">成员 · {{ detail.members.length }}</h4>
              <ul class="collab__people">
                <li v-for="m in detail.members" :key="String(m.userId)" class="collab__person">
                  <span class="collab__avatar" aria-hidden="true">{{ avatarChar(memberLabel(m)) }}</span>
                  <div class="collab__person-meta">
                    <p class="collab__person-name">{{ memberLabel(m) }}</p>
                    <span class="collab__badge" :data-role="m.role">{{ roleLabel(m.role) }}</span>
                  </div>
                  <button
                    v-if="detail.space.myRole === 'OWNER' && m.role !== 'OWNER'"
                    type="button"
                    class="collab__icon-btn"
                    @click="onKick(m.userId)">
                    移除
                  </button>
                </li>
              </ul>
            </section>

            <section v-if="detail.space.myRole === 'OWNER'" class="collab__block">
              <h4 class="collab__block-title">邀请密钥</h4>
              <form class="collab__inline" @submit.prevent="onInvite">
                <select v-model="inviteRole" class="collab__input">
                  <option value="EDITOR">编辑（可写）</option>
                  <option value="VIEWER">只读</option>
                </select>
                <input
                  v-model.number="inviteTtl"
                  type="number"
                  min="1"
                  max="720"
                  class="collab__input collab__input--sm"
                  title="有效小时" />
                <span class="collab__dim">小时</span>
                <button type="submit" class="plc-btn">生成</button>
              </form>
              <div v-if="lastJoinKey" class="collab__keybox">
                <p class="collab__keybox-label">新密钥（仅此一次）</p>
                <code class="collab__keybox-code">{{ lastJoinKey }}</code>
                <button type="button" class="plc-btn plc-btn--ghost" @click="copyKey">复制</button>
              </div>
              <ul class="collab__invites">
                <li
                  v-for="inv in activeInvites"
                  :key="String(inv.id)"
                  class="collab__invite">
                  <div>
                    <p class="collab__invite-title">{{ roleLabel(inv.role) }} · 有效</p>
                    <p class="collab__dim">
                      至 {{ formatTime(inv.expiresAt) }} · 已用 {{ inv.usedCount }}/{{
                        inv.maxUses || '∞'
                      }}
                    </p>
                  </div>
                  <button type="button" class="collab__icon-btn" @click="onRevoke(inv.id)">吊销</button>
                </li>
                <li v-if="!activeInvites.length" class="collab__empty">暂无有效邀请</li>
              </ul>
              <details v-if="expiredInvites.length" class="collab__expired">
                <summary>已失效 {{ expiredInvites.length }} 条</summary>
                <ul class="collab__invites">
                  <li v-for="inv in expiredInvites" :key="String(inv.id)" class="collab__invite is-dead">
                    <p class="collab__dim">
                      {{ roleLabel(inv.role) }} · 至 {{ formatTime(inv.expiresAt) }}
                    </p>
                  </li>
                </ul>
              </details>
            </section>
          </div>

          <section class="collab__block">
            <div class="collab__block-head">
              <h4 class="collab__block-title">共享数据</h4>
              <span class="collab__dim">可同时挂多台设备 + 组态</span>
            </div>
            <form
              v-if="detail.space.myRole === 'OWNER'"
              class="collab__grant"
              @submit.prevent="onGrant">
              <div class="collab__grant-row">
                <span class="collab__grant-label">权限</span>
                <select v-model="grantPerm" class="collab__input">
                  <option value="READ">只读</option>
                  <option value="WRITE">可写</option>
                </select>
                <button type="submit" class="plc-btn" :disabled="granting || !canSubmitGrant">
                  {{ granting ? '挂载中…' : '挂载所选' }}
                </button>
              </div>

              <div class="collab__grant-section">
                <p class="collab__grant-label">设备（可多选）</p>
                <ul v-if="mountableDevices.length" class="collab__check-list">
                  <li v-for="d in mountableDevices" :key="String(d.id)">
                    <label class="collab__check">
                      <input v-model="grantDeviceIds" type="checkbox" :value="String(d.id)" />
                      <span>{{ d.name }}</span>
                    </label>
                  </li>
                </ul>
                <p v-else class="collab__dim">
                  {{ devices.length ? '本系统设备均已挂载' : '暂无设备台账' }}
                </p>
              </div>

              <div class="collab__grant-section">
                <p class="collab__grant-label">组态</p>
                <label v-if="grantScadaId && !scadaAlreadyMounted" class="collab__check">
                  <input v-model="grantIncludeScada" type="checkbox" />
                  <span>挂载当前组态画面</span>
                </label>
                <p v-else-if="scadaAlreadyMounted" class="collab__dim">组态已挂载</p>
                <p v-else class="collab__dim">请先在「组态设计」保存画面后再挂载</p>
              </div>
            </form>
            <ul class="collab__resources">
              <li v-for="r in detail.resources" :key="String(r.id)" class="collab__resource">
                <div>
                  <p class="collab__resource-name">
                    <span class="collab__tag">{{ resourceTypeLabel(r.resourceType) }}</span>
                    {{ r.resourceLabel || '未命名' }}
                  </p>
                  <p class="collab__dim">{{ permLabel(r.permission) }}</p>
                </div>
                <div class="collab__resource-actions">
                  <NuxtLink
                    v-if="r.resourceType === 'DEVICE'"
                    class="plc-btn plc-btn--ghost"
                    to="/console/fieldpulse/devices">
                    台账
                  </NuxtLink>
                  <NuxtLink
                    v-else-if="r.resourceType === 'SCADA'"
                    class="plc-btn plc-btn--ghost"
                    :to="`/console/fieldpulse/scada?sharedId=${r.resourceId}`">
                    组态
                  </NuxtLink>
                  <button
                    v-if="detail.space.myRole === 'OWNER'"
                    type="button"
                    class="collab__icon-btn"
                    @click="onRevokeResource(r.id)">
                    取消
                  </button>
                </div>
              </li>
              <li v-if="!detail.resources.length" class="collab__empty">暂无挂载</li>
            </ul>
          </section>
        </main>

        <main v-else class="collab__stage collab__stage--empty">
          <p>从左侧选择空间，或兑钥加入 / 新建。操作步骤可问深空精灵。</p>
        </main>
      </div>
    </div>
  </PlcCenterShell>
</template>

<script setup lang="ts">
import PlcCenterShell from '~/components/console/fieldpulse/PlcCenterShell.vue'
import {
  createCollabInvite,
  createCollabSpace,
  deleteCollabSpace,
  fetchCollabDetail,
  fetchScadaDocument,
  grantCollabResource,
  joinCollabSpace,
  leaveCollabSpace,
  listCollabInvites,
  listCollabSpaces,
  listDevices,
  putCollabBoard,
  removeCollabMember,
  revokeCollabInvite,
  revokeCollabResource,
  type CollabInvite,
  type CollabMember,
  type CollabSpace,
  type CollabSpaceDetail,
  type PlcDevice,
} from '~/utils/console/fieldpulseApi'

definePageMeta({ layout: false })

const spaces = ref<CollabSpace[]>([])
const selectedId = ref<string | number | null>(null)
const detail = ref<CollabSpaceDetail | null>(null)
const invites = ref<CollabInvite[]>([])
const devices = ref<PlcDevice[]>([])
const boardNotes = ref('')
const error = ref('')
const okMsg = ref('')
const showCreate = ref(false)
const createName = ref('')
const createNote = ref('')
const joinKey = ref('')
const inviteRole = ref('EDITOR')
const inviteTtl = ref(168)
const lastJoinKey = ref('')
const grantDeviceIds = ref<string[]>([])
const grantIncludeScada = ref(false)
const grantScadaId = ref('')
const grantPerm = ref('READ')
const granting = ref(false)
const savingBoard = ref(false)

const canEditBoard = computed(
  () => detail.value?.space.myRole === 'OWNER' || detail.value?.space.myRole === 'EDITOR',
)

const activeInvites = computed(() => invites.value.filter((i) => !i.revoked))
const expiredInvites = computed(() => invites.value.filter((i) => i.revoked))

const mountedDeviceIds = computed(() => {
  const set = new Set<string>()
  for (const r of detail.value?.resources || []) {
    if (r.resourceType === 'DEVICE') set.add(String(r.resourceId))
  }
  return set
})

const scadaAlreadyMounted = computed(() => {
  if (!grantScadaId.value || !detail.value) return false
  return detail.value.resources.some(
    (r) => r.resourceType === 'SCADA' && String(r.resourceId) === grantScadaId.value,
  )
})

const mountableDevices = computed(() =>
  devices.value.filter((d) => !mountedDeviceIds.value.has(String(d.id))),
)

const canSubmitGrant = computed(
  () =>
    grantDeviceIds.value.length > 0 ||
    (grantIncludeScada.value && !!grantScadaId.value && !scadaAlreadyMounted.value),
)

function roleLabel(role: string) {
  switch (role) {
    case 'OWNER':
      return '所有者'
    case 'EDITOR':
      return '编辑'
    case 'VIEWER':
      return '只读'
    default:
      return role
  }
}

function permLabel(p: string) {
  return p === 'WRITE' ? '可写' : '只读'
}

function resourceTypeLabel(t: string) {
  switch (t) {
    case 'DEVICE':
      return '设备'
    case 'SCADA':
      return '组态'
    default:
      return t
  }
}

function memberLabel(m: CollabMember) {
  const name = (m.displayName || m.username || '').trim()
  return name || '成员'
}

function avatarChar(name: string) {
  return (name || '?').slice(0, 1)
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function parseNotes(json: string) {
  try {
    const o = JSON.parse(json || '{}') as { notes?: string }
    return typeof o.notes === 'string' ? o.notes : ''
  } catch {
    return json || ''
  }
}

function buildBoardJson(notes: string) {
  return JSON.stringify({ version: 1, notes })
}

async function reloadList() {
  error.value = ''
  try {
    spaces.value = await listCollabSpaces()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function openSpace(id: string | number) {
  error.value = ''
  okMsg.value = ''
  selectedId.value = id
  try {
    detail.value = await fetchCollabDetail(id)
    boardNotes.value = parseNotes(detail.value.board.contentJson)
    if (detail.value.space.myRole === 'OWNER') {
      invites.value = await listCollabInvites(id)
      devices.value = await listDevices()
      grantDeviceIds.value = []
      grantIncludeScada.value = false
      try {
        const scada = await fetchScadaDocument()
        if (scada?.persisted && scada.id != null) {
          grantScadaId.value = String(scada.id)
        } else {
          grantScadaId.value = ''
        }
      } catch {
        grantScadaId.value = ''
      }
    } else {
      invites.value = []
    }
  } catch (e) {
    detail.value = null
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onCreate() {
  error.value = ''
  try {
    const s = await createCollabSpace({ name: createName.value, note: createNote.value || undefined })
    showCreate.value = false
    createName.value = ''
    createNote.value = ''
    await reloadList()
    await openSpace(s.id)
    okMsg.value = '空间已创建'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onJoin() {
  error.value = ''
  okMsg.value = ''
  try {
    const r = await joinCollabSpace(joinKey.value.trim())
    joinKey.value = ''
    await reloadList()
    await openSpace(r.spaceId)
    okMsg.value = `已加入「${r.name}」`
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onSaveBoard() {
  if (!detail.value || !selectedId.value) return
  savingBoard.value = true
  error.value = ''
  try {
    const board = await putCollabBoard(selectedId.value, {
      contentJson: buildBoardJson(boardNotes.value),
      expectedRevision: Number(detail.value.board.revision),
    })
    detail.value = { ...detail.value, board }
    okMsg.value = '纪要已保存'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    savingBoard.value = false
  }
}

async function onInvite() {
  if (!selectedId.value) return
  error.value = ''
  try {
    const created = await createCollabInvite(selectedId.value, {
      role: inviteRole.value,
      ttlHours: inviteTtl.value,
    })
    lastJoinKey.value = created.joinKey
    invites.value = await listCollabInvites(selectedId.value)
    okMsg.value = '密钥已生成，请复制发给同事'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function copyKey() {
  if (!lastJoinKey.value) return
  try {
    await navigator.clipboard.writeText(lastJoinKey.value)
    okMsg.value = '已复制'
  } catch {
    okMsg.value = '请手动复制'
  }
}

async function onRevoke(inviteId: string | number) {
  error.value = ''
  try {
    await revokeCollabInvite(inviteId)
    if (selectedId.value) invites.value = await listCollabInvites(selectedId.value)
    okMsg.value = '已吊销'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onKick(userId: string | number) {
  if (!selectedId.value) return
  error.value = ''
  try {
    await removeCollabMember(selectedId.value, userId)
    await openSpace(selectedId.value)
    okMsg.value = '成员已移除'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onLeave() {
  if (!selectedId.value) return
  await onLeaveSpace(selectedId.value)
}

async function onLeaveSpace(spaceId: string | number) {
  error.value = ''
  try {
    await leaveCollabSpace(spaceId)
    if (String(selectedId.value) === String(spaceId)) {
      detail.value = null
      selectedId.value = null
    }
    await reloadList()
    okMsg.value = '已退出'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onDeleteSpace(space: { id: string | number; name: string }) {
  if (!confirm(`确认删除「${space.name}」？成员与挂载将立即失效。`)) return
  error.value = ''
  try {
    await deleteCollabSpace(space.id)
    if (String(selectedId.value) === String(space.id)) {
      detail.value = null
      selectedId.value = null
    }
    await reloadList()
    okMsg.value = '空间已删除'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function onGrant() {
  if (!selectedId.value || !canSubmitGrant.value) return
  error.value = ''
  granting.value = true
  const jobs: { resourceType: string; resourceId: string }[] = []
  for (const id of grantDeviceIds.value) {
    jobs.push({ resourceType: 'DEVICE', resourceId: id })
  }
  if (grantIncludeScada.value && grantScadaId.value && !scadaAlreadyMounted.value) {
    jobs.push({ resourceType: 'SCADA', resourceId: grantScadaId.value })
  }
  if (!jobs.length) {
    error.value = '请至少选择一台设备或勾选组态'
    granting.value = false
    return
  }
  let ok = 0
  const fails: string[] = []
  try {
    for (const job of jobs) {
      try {
        await grantCollabResource(selectedId.value, {
          resourceType: job.resourceType,
          resourceId: job.resourceId,
          permission: grantPerm.value,
        })
        ok++
      } catch (e) {
        fails.push(e instanceof Error ? e.message : String(e))
      }
    }
    await openSpace(selectedId.value)
    if (ok && !fails.length) {
      okMsg.value = `已挂载 ${ok} 项`
    } else if (ok && fails.length) {
      okMsg.value = `成功 ${ok} 项`
      error.value = fails[0] || '部分失败'
    } else {
      error.value = fails[0] || '挂载失败'
    }
  } finally {
    granting.value = false
  }
}

async function onRevokeResource(rowId: string | number) {
  if (!selectedId.value) return
  error.value = ''
  try {
    await revokeCollabResource(selectedId.value, rowId)
    await openSpace(selectedId.value)
    okMsg.value = '已取消挂载'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(async () => {
  await reloadList()
})
</script>

<style scoped lang="scss">
.collab {
  --c-line: rgba(148, 163, 184, 0.14);
  --c-panel: rgba(15, 23, 42, 0.55);
  --c-cyan: #22d3ee;
  --c-ink: #e2e8f0;
  --c-muted: #64748b;
  --c-soft: #94a3b8;
  color: var(--c-ink);
  font-size: 0.88rem;
}

.collab__lead {
  margin: 0 0 0.75rem;
  color: var(--c-soft);
  font-size: 0.82rem;
  line-height: 1.5;
  max-width: 52rem;
}

.collab__toast {
  margin: 0 0 0.65rem;
  font-size: 0.8rem;
  &--err {
    color: #fbbf24;
  }
  &--ok {
    color: #6ee7b7;
  }
}

.collab__toolbar,
.collab__create {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--c-line);
  border-radius: 0.45rem;
  background: var(--c-panel);
}

.collab__join {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
  width: 100%;
}

.collab__toolbar-label {
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.06em;
  color: var(--c-cyan);
  text-transform: uppercase;
}

.collab__input {
  border-radius: 0.35rem;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(2, 6, 23, 0.65);
  color: var(--c-ink);
  padding: 0.4rem 0.55rem;
  font-size: 0.82rem;
  &--grow {
    flex: 1;
    min-width: 10rem;
  }
  &--sm {
    width: 4.5rem;
  }
}

.collab__workspace {
  display: grid;
  grid-template-columns: minmax(11rem, 14rem) minmax(0, 1fr);
  gap: 0.85rem;
  align-items: start;
  min-height: 0;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
}

.collab__rail {
  border: 1px solid var(--c-line);
  border-radius: 0.5rem;
  background: var(--c-panel);
  padding: 0.55rem;
  position: sticky;
  top: 0;
}

.collab__rail-title {
  margin: 0 0 0.4rem;
  padding: 0 0.25rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  color: var(--c-muted);
  text-transform: uppercase;
}

.collab__space-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.25rem;
}

.collab__space {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.4rem;
  border-radius: 0.35rem;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease;
  &:hover {
    background: rgba(34, 211, 238, 0.06);
  }
  &.is-active {
    background: rgba(34, 211, 238, 0.1);
    border-color: rgba(34, 211, 238, 0.28);
  }
}

.collab__space-body {
  flex: 1;
  min-width: 0;
}

.collab__space-name {
  margin: 0 0 0.2rem;
  font-weight: 600;
  font-size: 0.84rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collab__stage {
  border: 1px solid var(--c-line);
  border-radius: 0.5rem;
  background: var(--c-panel);
  padding: 0.75rem 0.85rem 1rem;
  min-width: 0;
  &--empty {
    display: grid;
    place-items: center;
    min-height: 12rem;
    color: var(--c-muted);
    padding: 1.25rem;
    text-align: center;
  }
}

.collab__stage-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid var(--c-line);
}

.collab__stage-title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 650;
}

.collab__stage-sub {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.collab__block {
  margin-bottom: 0.85rem;
  &:last-child {
    margin-bottom: 0;
  }
  &--board .collab__board {
    min-height: 10rem;
  }
}

.collab__block-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.collab__block-title {
  margin: 0 0 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--c-soft);
}

.collab__block-actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.collab__board {
  width: 100%;
  resize: vertical;
  border-radius: 0.4rem;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(2, 6, 23, 0.55);
  color: var(--c-ink);
  padding: 0.65rem 0.75rem;
  font-size: 0.84rem;
  line-height: 1.5;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

.collab__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  margin-bottom: 0.85rem;
  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
}

.collab__people,
.collab__invites,
.collab__resources {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.collab__person,
.collab__invite,
.collab__resource {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  border-radius: 0.35rem;
  background: rgba(2, 6, 23, 0.35);
  border: 1px solid rgba(148, 163, 184, 0.1);
}

.collab__avatar {
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 0.35rem;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  background: rgba(34, 211, 238, 0.15);
  color: #a5f3fc;
  font-size: 0.75rem;
  font-weight: 700;
}

.collab__person-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}

.collab__person-name {
  margin: 0;
  font-weight: 600;
  font-size: 0.84rem;
}

.collab__invite {
  &.is-dead {
    opacity: 0.55;
  }
}

.collab__invite-title,
.collab__resource-name {
  margin: 0 0 0.15rem;
  font-weight: 600;
  font-size: 0.82rem;
}

.collab__resource {
  justify-content: space-between;
}

.collab__resource-actions {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
}

.collab__inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.collab__grant {
  margin-bottom: 0.65rem;
  padding: 0.55rem 0.6rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(148, 163, 184, 0.14);
  background: rgba(2, 6, 23, 0.35);
  display: grid;
  gap: 0.55rem;
}

.collab__grant-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.collab__grant-section {
  display: grid;
  gap: 0.35rem;
}

.collab__grant-label {
  margin: 0;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  color: var(--c-soft);
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
}

.collab__check-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
  gap: 0.3rem;
}

.collab__check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.4rem;
  border-radius: 0.3rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(15, 23, 42, 0.45);
  font-size: 0.8rem;
  cursor: pointer;
  input {
    accent-color: #22d3ee;
  }
}

.collab__keybox {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin: 0 0 0.55rem;
  padding: 0.5rem 0.55rem;
  border-radius: 0.35rem;
  border: 1px dashed rgba(34, 211, 238, 0.35);
  background: rgba(34, 211, 238, 0.06);
}

.collab__keybox-label {
  margin: 0;
  width: 100%;
  font-size: 0.7rem;
  color: #a5f3fc;
}

.collab__keybox-code {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  color: #ecfeff;
}

.collab__expired {
  margin-top: 0.4rem;
  color: var(--c-muted);
  font-size: 0.75rem;
  summary {
    cursor: pointer;
    user-select: none;
  }
}

.collab__badge {
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: var(--c-soft);
  &[data-role='OWNER'] {
    color: #fde68a;
    border-color: rgba(251, 191, 36, 0.35);
    background: rgba(251, 191, 36, 0.08);
  }
  &[data-role='EDITOR'] {
    color: #a5f3fc;
    border-color: rgba(34, 211, 238, 0.35);
    background: rgba(34, 211, 238, 0.08);
  }
  &[data-role='VIEWER'] {
    color: #cbd5e1;
  }
}

.collab__tag {
  display: inline-block;
  margin-right: 0.3rem;
  padding: 0.05rem 0.3rem;
  border-radius: 0.2rem;
  font-size: 0.65rem;
  color: #a5f3fc;
  background: rgba(34, 211, 238, 0.1);
  border: 1px solid rgba(34, 211, 238, 0.22);
}

.collab__dim {
  color: var(--c-muted);
  font-size: 0.72rem;
}

.collab__empty {
  padding: 0.5rem 0.35rem;
  color: var(--c-muted);
  font-size: 0.78rem;
}

.collab__icon-btn {
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: var(--c-soft);
  border-radius: 0.3rem;
  padding: 0.2rem 0.4rem;
  font-size: 0.65rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  cursor: pointer;
  &:hover {
    color: #fecaca;
    border-color: rgba(248, 113, 113, 0.35);
  }
}

.plc-btn {
  border-radius: 0.35rem;
  border: 1px solid rgba(110, 200, 232, 0.4);
  background: rgba(110, 200, 232, 0.12);
  padding: 0.35rem 0.65rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  color: #ecfeff;
  cursor: pointer;
  &--ghost {
    background: transparent;
    color: var(--c-soft);
    border-color: rgba(255, 255, 255, 0.12);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
