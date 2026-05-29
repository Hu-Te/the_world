import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import { createWaterMaterial } from '../utils/materials'
import type { WorldModule } from '../types'

export function createWaterfall(origin: THREE.Vector3, height: number): WorldModule {
  const group = new THREE.Group()
  group.name = 'Waterfall'
  group.position.copy(origin)

  const stream = new THREE.Mesh(
    new THREE.PlaneGeometry(3, height, 1, 24),
    createWaterMaterial(),
  )
  stream.position.y = -height / 2
  group.add(stream)

  const mist = new THREE.Mesh(
    new THREE.SphereGeometry(3.5, 16, 16),
    new THREE.MeshStandardMaterial({
      color: Palette.waterFoam,
      transparent: true,
      opacity: 0.35,
      roughness: 1,
      depthWrite: false,
    }),
  )
  mist.position.y = -height
  group.add(mist)

  const particleCount = 60
  const positions = new Float32Array(particleCount * 3)
  const speeds = new Float32Array(particleCount)

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 1.5
    positions[i * 3 + 1] = -Math.random() * height
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.4
    speeds[i] = 6 + Math.random() * 8
  }

  const particleGeo = new THREE.BufferGeometry()
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  particleGeo.userData.speeds = speeds

  const particles = new THREE.Points(
    particleGeo,
    new THREE.PointsMaterial({
      color: Palette.waterFoam,
      size: 0.25,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    }),
  )
  group.add(particles)

  return {
    group,
    update: (_elapsed, delta) => {
      const pos = particleGeo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < particleCount; i++) {
        let y = pos.getY(i) - (speeds[i] ?? 0) * delta
        if (y < -height) {
          y = 0
        }
        pos.setY(i, y)
      }
      pos.needsUpdate = true
      mist.scale.setScalar(1 + Math.sin(_elapsed * 1.5) * 0.05)
    },
    dispose: () => disposeObject3D(group),
  }
}
