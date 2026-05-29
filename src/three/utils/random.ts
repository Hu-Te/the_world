/** 由种子生成确定性伪随机，便于可复现布局 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0xffffffff
  }
}

export function range(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min)
}
