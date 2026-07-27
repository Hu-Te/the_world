import { normalizeScadaOwnerId, type ScadaOwnerRef } from '~/utils/console/scadaTypes'

const CHANNEL = 'fieldpulse-scada-doc'

type PeerMessage = {
  type: 'scada-saved'
  tenantId: string
  ownerUserId: string
  revision: number
}

function sameOwner(a: ScadaOwnerRef, b: Pick<PeerMessage, 'tenantId' | 'ownerUserId'>) {
  return (
    normalizeScadaOwnerId(a.tenantId) === normalizeScadaOwnerId(b.tenantId) &&
    normalizeScadaOwnerId(a.ownerUserId) === normalizeScadaOwnerId(b.ownerUserId)
  )
}

/** 通知同浏览器其他窗口：当前用户组态已保存 */
export function broadcastScadaSaved(owner: ScadaOwnerRef, revision: number) {
  if (!import.meta.client || typeof BroadcastChannel === 'undefined') return
  try {
    const bc = new BroadcastChannel(CHANNEL)
    const msg: PeerMessage = {
      type: 'scada-saved',
      tenantId: normalizeScadaOwnerId(owner.tenantId),
      ownerUserId: normalizeScadaOwnerId(owner.ownerUserId),
      revision,
    }
    bc.postMessage(msg)
    bc.close()
  } catch {
    /* ignore */
  }
}

/** 订阅同伴保存；返回取消订阅函数 */
export function subscribeScadaPeerSaved(owner: ScadaOwnerRef, onSaved: () => void): () => void {
  if (!import.meta.client || typeof BroadcastChannel === 'undefined') {
    return () => {}
  }
  const bc = new BroadcastChannel(CHANNEL)
  const onMessage = (ev: MessageEvent) => {
    const msg = ev.data as Partial<PeerMessage> | null
    if (!msg || msg.type !== 'scada-saved') return
    if (!sameOwner(owner, { tenantId: msg.tenantId || '', ownerUserId: msg.ownerUserId || '' })) {
      return
    }
    onSaved()
  }
  bc.addEventListener('message', onMessage)
  return () => {
    bc.removeEventListener('message', onMessage)
    bc.close()
  }
}
