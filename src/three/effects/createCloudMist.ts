import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import { createSeededRandom, range } from '../utils/random'
import type { WorldModule } from '../types'

function createCloudCluster(rand: () => number): THREE.Group {
  const cluster = new THREE.Group()
  const puffCount = Math.floor(range(rand, 5, 9))

  for (let i = 0; i < puffCount; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(range(rand, 6, 14), 16, 12),
      new THREE.MeshStandardMaterial({
        color: Palette.cloud,
        transparent: true,
        opacity: range(rand, 0.35, 0.55),
        roughness: 1,
        metalness: 0,
        depthWrite: false,
      }),
    )
    puff.position.set(
      range(rand, -10, 10),
      range(rand, -1.5, 2),
      range(rand, -8, 8),
    )
    puff.scale.set(
      range(rand, 0.9, 1.5),
      range(rand, 0.45, 0.75),
      range(rand, 0.8, 1.3),
    )
    cluster.add(puff)
  }

  return cluster
}

export function createCloudMist(): WorldModule {
  const group = new THREE.Group()
  group.name = 'Clouds'

  const rand = createSeededRandom(88)
  const clouds: THREE.Group[] = []

  for (let i = 0; i < 16; i++) {
    const cluster = createCloudCluster(rand)
    const angle = range(rand, 0, Math.PI * 2)
    const dist = range(rand, 80, 280)

    cluster.position.set(
      Math.cos(angle) * dist,
      range(rand, 55, 100),
      Math.sin(angle) * dist,
    )
    cluster.scale.setScalar(range(rand, 1.5, 2.8))

    cluster.userData.driftX = range(rand, -0.015, 0.015)
    cluster.userData.driftZ = range(rand, -0.015, 0.015)
    cluster.userData.baseY = cluster.position.y

    clouds.push(cluster)
    group.add(cluster)
  }

  return {
    group,
    update: (elapsed) => {
      clouds.forEach((cloud, index) => {
        cloud.position.x += cloud.userData.driftX as number
        cloud.position.z += cloud.userData.driftZ as number
        cloud.position.y =
          (cloud.userData.baseY as number) + Math.sin(elapsed * 0.08 + index) * 0.4
      })
    },
    dispose: () => disposeObject3D(group),
  }
}
