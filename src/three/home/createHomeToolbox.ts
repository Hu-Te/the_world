import * as THREE from 'three'

export interface HomeToolboxHandle {
  group: THREE.Group
  getPickMeshes: () => THREE.Object3D[]
  update: (elapsed: number, delta: number, pointerX?: number, pointerY?: number) => void
  setHovered: (hovered: boolean) => void
  setExpanded: (expanded: boolean) => void
}

function applySolidMeshFlags(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    obj.castShadow = false
    obj.receiveShadow = false
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const mat of mats) {
      mat.transparent = false
      mat.opacity = 1
      mat.depthWrite = true
      if ('blending' in mat) mat.blending = THREE.NormalBlending
    }
  })
}

/** 首页右下角 — 简洁工具箱（保持上一版造型） */
export function createHomeToolbox(envMap?: THREE.Texture | null): HomeToolboxHandle {
  const group = new THREE.Group()
  group.name = 'HomeToolbox'
  group.scale.setScalar(1.36)

  const rig = new THREE.Group()
  group.add(rig)

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a4e5c,
    emissive: 0x0a141c,
    emissiveIntensity: 0.04,
    metalness: 0.35,
    roughness: 0.58,
    clearcoat: 0.35,
    clearcoatRoughness: 0.4,
    envMap: envMap ?? undefined,
    envMapIntensity: 0.55,
  })

  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x222e38,
    emissive: 0x080e14,
    emissiveIntensity: 0.06,
    metalness: 0.2,
    roughness: 0.72,
  })

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x5a7888,
    emissive: 0x142028,
    emissiveIntensity: 0.08,
    metalness: 0.72,
    roughness: 0.38,
    envMap: envMap ?? undefined,
    envMapIntensity: 0.6,
  })

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.9, 0.04, 32),
    new THREE.MeshStandardMaterial({
      color: 0x1e2830,
      emissive: 0x0a1018,
      emissiveIntensity: 0.06,
      metalness: 0.5,
      roughness: 0.62,
      envMap: envMap ?? undefined,
      envMapIntensity: 0.45,
    }),
  )
  pad.position.y = 0.02

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.52, 0.62), shellMat)
  body.position.y = 0.3

  const bodyTopLip = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.025, 0.64), shellMat)
  bodyTopLip.position.set(0, 0.56, 0)

  const innerCavity = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.38, 0.5), innerMat)
  innerCavity.position.set(0, 0.34, -0.02)

  const trayFloor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.03, 0.46), innerMat)
  trayFloor.position.set(0, 0.16, 0)

  const lidPivot = new THREE.Group()
  lidPivot.position.set(0, 0.56, -0.33)
  rig.add(lidPivot)

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.1, 0.64), shellMat)
  lid.position.set(0, 0.05, 0.33)

  const lidFrontBevel = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.018, 0.04), shellMat)
  lidFrontBevel.position.set(0, 0.08, 0.33)

  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.2, 6, 12), metalMat)
  handle.rotation.x = Math.PI / 2
  handle.position.set(0, 0.14, 0.34)

  const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.035), metalMat)
  clasp.position.set(0, 0.02, 0.335)

  lidPivot.add(lid, lidFrontBevel, handle, clasp)

  const cornerGeo = new THREE.SphereGeometry(0.055, 10, 10)
  const cornerMeshes: THREE.Mesh[] = []
  for (const [x, y, z] of [
    [-0.48, 0.08, 0.29],
    [0.48, 0.08, 0.29],
    [-0.48, 0.08, -0.29],
    [0.48, 0.08, -0.29],
  ] as [number, number, number][]) {
    const c = new THREE.Mesh(cornerGeo, shellMat)
    c.position.set(x, y, z)
    rig.add(c)
    cornerMeshes.push(c)
  }

  const hitPad = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 1.15, 0.95),
    new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 }),
  )
  hitPad.position.y = 0.42

  rig.add(pad, body, bodyTopLip, innerCavity, trayFloor, hitPad)
  applySolidMeshFlags(rig)

  const pickMeshes: THREE.Object3D[] = []
  const markPick = (mesh: THREE.Object3D) => {
    mesh.userData.homeToolbox = true
    pickMeshes.push(mesh)
  }
  for (const part of [
    pad,
    body,
    bodyTopLip,
    innerCavity,
    trayFloor,
    lid,
    lidFrontBevel,
    handle,
    clasp,
    hitPad,
    ...cornerMeshes,
  ]) {
    markPick(part)
  }

  let hovered = false
  let expanded = false
  let openT = 0

  const update = (elapsed: number, delta: number, pointerX = 0, _pointerY = 0) => {
    const openTarget = expanded ? 1 : 0
    openT += (openTarget - openT) * Math.min(1, delta * 8.5)
    lidPivot.rotation.x = -openT * 1.08

    innerCavity.visible = openT > 0.06
    trayFloor.visible = openT > 0.06
    clasp.visible = openT < 0.35

    rig.position.y = expanded ? 0 : Math.sin(elapsed * 1.2) * 0.015
    if (expanded) {
      rig.rotation.set(0, 0, 0)
    } else {
      rig.rotation.y = pointerX * 0.018
      rig.rotation.z = Math.sin(elapsed * 0.8) * 0.006
    }

    const hoverBoost = hovered ? 0.05 : 0
    shellMat.emissiveIntensity = 0.04 + hoverBoost
    metalMat.emissiveIntensity = 0.08 + hoverBoost * 0.06
  }

  const setHovered = (value: boolean) => {
    hovered = value
  }

  const setExpanded = (value: boolean) => {
    expanded = value
    if (value) openT = Math.max(openT, 0.18)
  }

  return { group, getPickMeshes: () => pickMeshes, update, setHovered, setExpanded }
}
