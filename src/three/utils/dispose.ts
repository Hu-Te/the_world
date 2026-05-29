import * as THREE from 'three'

/** 递归释放 Object3D 下的几何体与材质 */
export function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      obj.geometry?.dispose()

      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const material of materials) {
        material?.dispose()
      }
    }
  })
}
