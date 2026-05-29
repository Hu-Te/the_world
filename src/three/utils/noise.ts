/** 简易 Value Noise，用于地形起伏与随机分布 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function noise2d(x: number, y: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi

  const a = hash(xi, yi)
  const b = hash(xi + 1, yi)
  const c = hash(xi, yi + 1)
  const d = hash(xi + 1, yi + 1)

  const u = fade(xf)
  const v = fade(yf)

  return lerp(lerp(a, b, u), lerp(c, d, u), v)
}

/** 多层叠加，输出约 0~1 */
export function fbm2d(x: number, y: number, octaves = 4): number {
  let value = 0
  let amplitude = 0.5
  let frequency = 1
  let max = 0

  for (let i = 0; i < octaves; i++) {
    value += noise2d(x * frequency, y * frequency) * amplitude
    max += amplitude
    amplitude *= 0.5
    frequency *= 2
  }

  return value / max
}
