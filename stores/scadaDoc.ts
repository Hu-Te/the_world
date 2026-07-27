import { defineStore } from 'pinia'
import {
  fetchScadaDocument,
  saveScadaDocumentRemote,
  type ScadaDocumentRemote,
} from '~/utils/console/fieldpulseApi'
import { broadcastScadaSaved, subscribeScadaPeerSaved } from '~/utils/console/scadaPeer'
import {
  createEmptyScadaDoc,
  isValidScadaOwner,
  normalizeNode,
  normalizeScadaOwnerId,
  type ScadaDocument,
  type ScadaNodeData,
  type ScadaOwnerRef,
} from '~/utils/console/scadaTypes'

export type ScadaOwner = ScadaOwnerRef

function cloneDoc(doc: ScadaDocument): ScadaDocument {
  return {
    ...doc,
    version: 2,
    revision: Number(doc.revision) || 0,
    tenantId: normalizeScadaOwnerId(doc.tenantId),
    ownerUserId: normalizeScadaOwnerId(doc.ownerUserId),
    nodes: doc.nodes.map((n) => ({
      ...n,
      style: n.style ? { ...n.style } : {},
    })),
  }
}

function fromRemote(remote: ScadaDocumentRemote, owner: ScadaOwner): ScadaDocument {
  return {
    version: 2,
    name: remote.name || '产线概览',
    width: remote.width || 1280,
    height: remote.height || 720,
    nodes: Array.isArray(remote.nodes)
      ? remote.nodes.map((n) => normalizeNode(n as ScadaNodeData))
      : [],
    updatedAt: remote.updatedAt || '',
    revision: Number(remote.revision) || 0,
    tenantId: normalizeScadaOwnerId(owner.tenantId),
    ownerUserId: normalizeScadaOwnerId(owner.ownerUserId),
  }
}

/** 组态：内存草稿 + 数据库 GET/PUT（无 localStorage）。 */
export const useScadaDocStore = defineStore('scadaDoc', {
  state: () => ({
    doc: null as ScadaDocument | null,
    loading: false,
    saving: false,
    /** 协同挂载的组态 id；空=本人组态 */
    sharedDocumentId: null as string | number | null,
    sharedPermission: null as string | null,
  }),
  getters: {
    canWriteShared(state): boolean {
      if (state.sharedDocumentId == null) return true
      return state.sharedPermission === 'WRITE'
    },
  },
  actions: {
    setSharedContext(sharedId: string | number | null | undefined, permission?: string | null) {
      this.sharedDocumentId =
        sharedId != null && String(sharedId).trim() !== '' ? sharedId : null
      this.sharedPermission = permission ?? null
    },

    clearMemory() {
      this.doc = null
      this.loading = false
      this.saving = false
      this.sharedDocumentId = null
      this.sharedPermission = null
    },

    async load(owner: ScadaOwner): Promise<ScadaDocument> {
      if (!isValidScadaOwner(owner)) {
        const empty = createEmptyScadaDoc('产线概览', owner)
        this.doc = empty
        return cloneDoc(empty)
      }
      this.loading = true
      try {
        const remote = await fetchScadaDocument(this.sharedDocumentId ?? undefined)
        if (remote.shared) {
          this.sharedPermission = remote.sharedPermission || 'READ'
          if (remote.id != null) this.sharedDocumentId = remote.id
        }
        const doc = fromRemote(remote, owner)
        this.doc = cloneDoc(doc)
        return cloneDoc(doc)
      } finally {
        this.loading = false
      }
    },

    async save(doc: ScadaDocument, owner: ScadaOwner): Promise<ScadaDocument> {
      if (!isValidScadaOwner(owner)) {
        throw new Error('请先登录后再保存组态')
      }
      if (this.sharedDocumentId != null && this.sharedPermission !== 'WRITE') {
        throw new Error('当前协同授权为只读，无法保存')
      }
      this.saving = true
      try {
        const saved = fromRemote(
          await saveScadaDocumentRemote(
            {
              name: doc.name,
              width: doc.width,
              height: doc.height,
              nodes: doc.nodes,
              revision: Number(doc.revision) || 0,
            },
            this.sharedDocumentId ?? undefined,
          ),
          owner,
        )
        this.doc = cloneDoc(saved)
        broadcastScadaSaved(owner, saved.revision)
        return cloneDoc(saved)
      } finally {
        this.saving = false
      }
    },

    subscribePeerReload(owner: ScadaOwner, onPeerSave: () => void): () => void {
      return subscribeScadaPeerSaved(owner, onPeerSave)
    },
  },
})
