import * as THREE from 'three'

/**
 * 递归释放 Object3D。
 * mesh.userData.sharedResource = true 时跳过 geometry（由共享池统一释放），
 * 仍会尝试释放「非共享」材质；共享材质应在外部 kit 中统一 dispose。
 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) && !(obj instanceof THREE.Points) && !(obj instanceof THREE.LineSegments) && !(obj instanceof THREE.Sprite)) {
      return
    }

    const shared = Boolean(obj.userData.sharedResource)

    const meshLike = obj as THREE.Mesh
    if (meshLike.geometry && !shared) {
      meshLike.geometry.dispose()
    }

    const materials = Array.isArray(meshLike.material)
      ? meshLike.material
      : meshLike.material
        ? [meshLike.material]
        : []

    for (const mat of materials) {
      if (!mat) continue
      if (shared) continue
      for (const key of Object.keys(mat) as (keyof THREE.Material)[]) {
        const value = mat[key]
        if (value instanceof THREE.Texture) value.dispose()
      }
      mat.dispose()
    }
  })

  while (root.children.length > 0) {
    root.remove(root.children[0]!)
  }
}
