import { ref, onScopeDispose } from 'vue'
import type { GameSnapshot } from './types'

const defaultSnapshot: GameSnapshot = {
  tier: '待接入',
  energy: 0,
  maxEnergy: 100,
  questProgress: 0,
  questTarget: 3,
  visitedCount: 0,
  message: '',
  hint: '',
  canInteract: false,
  interactLabel: '',
  playerX: 0,
  playerZ: 0,
  cameraYaw: 0,
  nodes: [],
  avatarState: 'loading',
}

export function bindGameState(getHandle: () => import('./types').GameHandle | null) {
  const state = ref<GameSnapshot>({ ...defaultSnapshot })
  let unsubscribe: (() => void) | null = null

  const attach = () => {
    unsubscribe?.()
    const handle = getHandle()
    if (!handle) return
    unsubscribe = handle.subscribe((snapshot) => {
      state.value = snapshot
    })
  }

  onScopeDispose(() => unsubscribe?.())

  return { state, attach }
}
