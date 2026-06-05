import * as THREE from 'three'

/** GLB 加载前/失败时的可见占位角色 */
export function createPlaceholderAvatar(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'PlaceholderAvatar'

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x5a9eb0,
    emissive: 0x1a3340,
    emissiveIntensity: 0.35,
    roughness: 0.62,
    metalness: 0.15,
  })
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x88ddff,
    emissive: 0x3399cc,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.4,
  })

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.95, 6, 12), bodyMat)
  torso.position.y = 1.05
  torso.castShadow = true

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 14), bodyMat)
  head.position.y = 1.82
  head.castShadow = true

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.12), accentMat)
  visor.position.set(0, 1.84, 0.14)

  group.add(torso, head, visor)
  return group
}
