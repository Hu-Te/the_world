import * as THREE from 'three'
import { Palette } from '../utils/colors'
import { disposeObject3D } from '../utils/dispose'
import type { WorldModule } from '../types'

export function createSky(): WorldModule {
  const group = new THREE.Group()
  group.name = 'Sky'

  const skyGeo = new THREE.SphereGeometry(520, 64, 32)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(Palette.skyZenith) },
      horizonColor: { value: new THREE.Color(Palette.skyHorizon) },
      sunColor: { value: new THREE.Color(Palette.sun) },
      sunDir: { value: new THREE.Vector3(0.55, 0.42, -0.35).normalize() },
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
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      varying vec3 vWorldPosition;
      void main() {
        vec3 dir = normalize(vWorldPosition);
        float h = dir.y * 0.5 + 0.5;
        vec3 sky = mix(horizonColor, topColor, pow(h, 0.9));

        float sunDot = max(dot(dir, sunDir), 0.0);
        float sunGlow = pow(sunDot, 128.0) * 0.9 + pow(sunDot, 16.0) * 0.15;
        sky += sunColor * sunGlow;

        gl_FragColor = vec4(sky, 1.0);
      }
    `,
  })
  group.add(new THREE.Mesh(skyGeo, skyMat))

  return {
    group,
    dispose: () => disposeObject3D(group),
  }
}
