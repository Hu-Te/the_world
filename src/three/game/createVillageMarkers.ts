import * as THREE from 'three'
import { sampleGroundHeight } from '../terrain/sampleGroundHeight'
import type { NodePoi } from '@/game/types'

export interface VillageMarkersHandle {
  group: THREE.Group
  update: (elapsed: number, nearbyId: number | null, visited: Set<number>) => void
  dispose: () => void
}

/** 节点信标：远处可见，靠近时高亮 */
export function createVillageMarkers(pois: NodePoi[]): VillageMarkersHandle {
  const group = new THREE.Group()
  group.name = 'VillageMarkers'

  const markers = pois.map((poi) => {
    const anchor = new THREE.Group()
    anchor.position.set(poi.x, sampleGroundHeight(poi.x, poi.z), poi.z)

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.18, 5.5, 8),
      new THREE.MeshStandardMaterial({
        color: 0x88ddff,
        emissive: 0x113344,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.38,
      }),
    )
    pillar.position.y = 2.75

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.04, 8, 32),
      new THREE.MeshBasicMaterial({
        color: 0xc9a962,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
      }),
    )
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.12

    const labelGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 12, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffe4a8,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
      }),
    )
    labelGlow.position.y = 5.8

    anchor.add(pillar, ring, labelGlow)
    group.add(anchor)

    return { poi, anchor, pillar, ring, labelGlow }
  })

  const update = (elapsed: number, nearbyId: number | null, visited: Set<number>) => {
    markers.forEach(({ poi, pillar, ring, labelGlow }) => {
      const done = visited.has(poi.id)
      const nearby = nearbyId === poi.id && !done
      const pulse = 0.5 + Math.sin(elapsed * 2.5 + poi.id) * 0.2

      pillar.scale.y = nearby ? 1.15 + Math.sin(elapsed * 6) * 0.08 : 1
      ;(pillar.material as THREE.MeshStandardMaterial).emissiveIntensity = done
        ? 0.15
        : nearby
          ? 0.75
          : 0.25
      ;(pillar.material as THREE.MeshStandardMaterial).color.setHex(
        done ? 0x556677 : nearby ? 0xaaffee : 0x88ddff,
      )

      ring.rotation.z = elapsed * (nearby ? 1.2 : 0.35)
      ;(ring.material as THREE.MeshBasicMaterial).opacity = done
        ? 0.15
        : nearby
          ? pulse
          : 0.3

      labelGlow.visible = nearby
      if (nearby) {
        labelGlow.position.y = 5.8 + Math.sin(elapsed * 4) * 0.15
        ;(labelGlow.material as THREE.MeshBasicMaterial).opacity = pulse
      }
    })
  }

  const dispose = () => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose())
        else obj.material.dispose()
      }
    })
  }

  return { group, update, dispose }
}
