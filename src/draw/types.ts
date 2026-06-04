export type DrawPhase = 'idle' | 'playing' | 'roundEnd' | 'finished'
export type DrawRole = 'drawer' | 'guesser'

export interface DrawRoundResult {
  word: string
  guessed: boolean
  skipped: boolean
}

export interface DrawStroke {
  id: string
  points: number[]
  color: string
  lineWidth: number
  eraser: boolean
}

export interface DrawSyncState {
  strokes: DrawStroke[]
  activeStroke: DrawStroke | null
  phase: DrawPhase
  round: number
  maxRounds: number
  drawerScore: number
  guesserScore: number
  timeLeft: number
  word?: string
  lastResult?: DrawRoundResult | null
}

export type DrawSyncMessage =
  | { type: 'full'; state: DrawSyncState }
  | { type: 'guess'; text: string }
  | { type: 'role'; role: DrawRole }
