import * as THREE from 'three'

export type QiBurstUpdater = (delta: number) => boolean

/** 接入节点时的能量粒子爆发 */
export function createQiBurstUpdater(
  scene: THREE.Scene,
  x: number,
  y: number,
  z: number,
): QiBurstUpdater {
  let life = 0
  const maxLife = 1.2
  const count = 48
  const positions = new Float32Array(count * 3)
  const velocities: THREE.Vector3[] = []

  for (let i = 0; i < count; i++) {
    positions[i * 3] = x
    positions[i * 3 + 1] = y + 1.5
    positions[i * 3 + 2] = z
    velocities.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 3,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 3,
      ),
    )
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

  const material = new THREE.PointsMaterial({
    color: 0x88ffee,
    size: 0.35,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  const points = new THREE.Points(geometry, material)
  scene.add(points)

  return (delta: number) => {
    life += delta
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute

    for (let i = 0; i < count; i++) {
      const v = velocities[i]!
      v.y -= delta * 2.5
      attr.setXYZ(
        i,
        attr.getX(i) + v.x * delta,
        attr.getY(i) + v.y * delta,
        attr.getZ(i) + v.z * delta,
      )
    }
    attr.needsUpdate = true
    material.opacity = Math.max(0, 1 - life / maxLife)

    if (life >= maxLife) {
      scene.remove(points)
      geometry.dispose()
      material.dispose()
      return false
    }
    return true
  }
}
