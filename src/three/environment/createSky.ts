import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import type { WorldModule } from '../types'

export function createSky(): WorldModule {
  const group = new THREE.Group()
  group.name = 'Sky'

  const skyGeo = new THREE.SphereGeometry(520, 48, 32)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(Palette.skyZenith) },
      horizonColor: { value: new THREE.Color(Palette.skyHorizon) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y * 0.5 + 0.5;
        vec3 sky = mix(horizonColor, topColor, pow(h, 0.75));
        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  })
  group.add(new THREE.Mesh(skyGeo, skyMat))

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(12, 32, 32),
    new THREE.MeshBasicMaterial({ color: Palette.sun }),
  )
  sun.position.set(160, 180, -120)
  group.add(sun)

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(22, 32, 32),
    new THREE.MeshBasicMaterial({
      color: Palette.sun,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  )
  sunGlow.position.copy(sun.position)
  group.add(sunGlow)

  return {
    group,
    dispose: () => disposeObject3D(group),
  }
}
