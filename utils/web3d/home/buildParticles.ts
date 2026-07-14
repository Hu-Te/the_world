import * as THREE from 'three'
import { CYAN } from './theme'

/** 近景微粒 + 中景漂浮星尘 */
export function buildParticles(count: number): THREE.Points {
  const near = Math.floor(count * 0.55)
  const far = count - near
  const total = near + far
  const pos = new Float32Array(total * 3)
  const col = new Float32Array(total * 3)
  const c = new THREE.Color(CYAN)
  const c2 = new THREE.Color(0xc4a46a)

  for (let i = 0; i < near; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 1.6 + Math.random() * 4.2
    pos[i * 3] = Math.cos(a) * r
    pos[i * 3 + 1] = 0.15 + Math.random() * 2.8
    pos[i * 3 + 2] = Math.sin(a) * r
    const t = Math.random() < 0.2 ? c2 : c
    col[i * 3] = t.r
    col[i * 3 + 1] = t.g
    col[i * 3 + 2] = t.b
  }
  for (let i = 0; i < far; i++) {
    const idx = near + i
    const a = Math.random() * Math.PI * 2
    const r = 5.5 + Math.random() * 6
    pos[idx * 3] = Math.cos(a) * r
    pos[idx * 3 + 1] = 0.4 + Math.random() * 4.5
    pos[idx * 3 + 2] = Math.sin(a) * r
    col[idx * 3] = 0.75
    col[idx * 3 + 1] = 0.85
    col[idx * 3 + 2] = 0.95
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.028,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    }),
  )
}
