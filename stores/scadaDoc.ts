import { defineStore } from 'pinia'
import {
  loadScadaDocument,
  peekScadaDocumentFromDisk,
  pickRicherScadaDoc,
  saveScadaDocument,
  scadaStorageKey,
  type SaveScadaOptions,
  type ScadaDocument,
} from '~/utils/console/scadaTypes'

export type ScadaOwner = { tenantId: number; ownerUserId: number }

function cloneDoc(doc: ScadaDocument): ScadaDocument {
  return {
    ...doc,
    version: 2,
    nodes: doc.nodes.map((n) => ({
      ...n,
      style: n.style ? { ...n.style } : {},
    })),
  }
}

/**
 * 组态画面缓存：Pinia 内存 + localStorage。
 *
 * 闭环约定：
 * - 编辑 → remember（内存）
 * - 保存 / 离页 / 关页 → save/flush（内存 + localStorage）
 * - 进入 → load：内存与磁盘取更完整的一份
 * - 空稿不得覆盖磁盘非空稿
 * - 切账号 / 登出 → clearMemory，避免串租户
 */
export const useScadaDocStore = defineStore('scadaDoc', {
  state: () => ({
    cacheKey: '' as string,
    doc: null as ScadaDocument | null,
    /** 最近一次成功写入 localStorage 的 updatedAt */
    diskUpdatedAt: '' as string,
  }),
  actions: {
    remember(doc: ScadaDocument, owner: ScadaOwner) {
      if (owner.tenantId <= 0 || owner.ownerUserId <= 0) return
      // 空稿不污染内存里已有非空画面（例如异步竞态）
      if (
        (!doc.nodes || doc.nodes.length === 0) &&
        this.cacheKey === scadaStorageKey(owner.tenantId, owner.ownerUserId) &&
        this.doc &&
        this.doc.nodes.length > 0
      ) {
        return
      }
      this.cacheKey = scadaStorageKey(owner.tenantId, owner.ownerUserId)
      this.doc = cloneDoc({
        ...doc,
        tenantId: owner.tenantId,
        ownerUserId: owner.ownerUserId,
      })
    },

    load(owner: ScadaOwner): ScadaDocument {
      const key = scadaStorageKey(owner.tenantId, owner.ownerUserId)
      const fromDisk = loadScadaDocument(owner)
      let chosen = fromDisk
      if (this.cacheKey === key && this.doc && Array.isArray(this.doc.nodes)) {
        chosen = pickRicherScadaDoc(this.doc, fromDisk)
      }
      this.cacheKey = key
      this.doc = cloneDoc(chosen)
      this.diskUpdatedAt = fromDisk.updatedAt || this.diskUpdatedAt
      return cloneDoc(chosen)
    },

    save(doc: ScadaDocument, owner: ScadaOwner, opts?: SaveScadaOptions) {
      const stamped = saveScadaDocument(doc, owner, opts)
      if (stamped) {
        this.remember(stamped, owner)
        this.diskUpdatedAt = stamped.updatedAt
      } else {
        // 空稿被拒写：尝试把磁盘非空稿拉回内存，便于界面回显
        const disk = peekScadaDocumentFromDisk(owner)
        if (disk && disk.nodes.length > 0) {
          this.cacheKey = scadaStorageKey(owner.tenantId, owner.ownerUserId)
          this.doc = cloneDoc(disk)
          this.diskUpdatedAt = disk.updatedAt || ''
        }
      }
      return stamped
    },

    /** 离页兜底：当前稿落盘；空稿不会覆盖磁盘非空 */
    flush(doc: ScadaDocument, owner: ScadaOwner) {
      if (owner.tenantId <= 0 || owner.ownerUserId <= 0) return null
      return this.save(doc, owner)
    },

    clearMemory() {
      this.cacheKey = ''
      this.doc = null
      this.diskUpdatedAt = ''
    },
  },
})
