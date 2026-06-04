export interface NodePoi {
  id: number
  name: string
  x: number
  z: number
}

export interface NodeQuestItem {
  id: number
  name: string
  visited: boolean
}

export interface GameSnapshot {
  tier: string
  energy: number
  maxEnergy: number
  questProgress: number
  questTarget: number
  visitedCount: number
  message: string
  hint: string
  canInteract: boolean
  interactLabel: string
  playerX: number
  playerZ: number
  cameraYaw: number
  nodes: NodeQuestItem[]
}

export interface GameHandle {
  dispose: () => void
  getSnapshot: () => GameSnapshot
  subscribe: (listener: (snapshot: GameSnapshot) => void) => () => void
}
