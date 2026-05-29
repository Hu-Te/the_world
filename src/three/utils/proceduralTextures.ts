import * as THREE from 'three'

/** 程序化生成草地颜色贴图 */
export function createGrassColorMap(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#3a7a38'
  ctx.fillRect(0, 0, size, size)

  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const hue = 95 + Math.random() * 35
    const light = 28 + Math.random() * 22
    ctx.fillStyle = `hsla(${hue}, 45%, ${light}%, 0.35)`
    ctx.fillRect(x, y, 1 + Math.random() * 2, 2 + Math.random() * 4)
  }

  for (let i = 0; i < 800; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    ctx.fillStyle = `hsla(${40 + Math.random() * 20}, 30%, ${20 + Math.random() * 15}%, 0.2)`
    ctx.beginPath()
    ctx.arc(x, y, 2 + Math.random() * 4, 0, Math.PI * 2)
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(24, 24)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** 程序化法线贴图：增强地表颗粒感 */
export function createGrassNormalMap(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const n = Math.sin(x * 0.4) * Math.cos(y * 0.35) * 0.15
      data[i] = 128 + n * 80
      data[i + 1] = 128 + n * 60
      data[i + 2] = 255
      data[i + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(24, 24)
  return texture
}

/** 岩石法线贴图 */
export function createRockNormalMap(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(size, size)
  const data = imageData.data

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const n =
        Math.sin(x * 0.15 + y * 0.1) * 0.3 +
        Math.sin(x * 0.5) * Math.cos(y * 0.45) * 0.2
      data[i] = 128 + n * 90
      data[i + 1] = 128 + n * 70
      data[i + 2] = 255
      data[i + 3] = 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(8, 8)
  return texture
}

/** 屋顶瓦片纹理 */
export function createRoofTileMap(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#7a2e2e'
  ctx.fillRect(0, 0, size, size)

  const rows = 16
  const cols = 16
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const w = size / cols
      const h = size / rows
      const x = col * w + (row % 2) * (w * 0.5)
      const y = row * h
      const shade = 30 + Math.random() * 15
      ctx.fillStyle = `hsl(0, 55%, ${shade}%)`
      ctx.beginPath()
      ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.42, 0, Math.PI, true)
      ctx.fill()
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(4, 4)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

let sharedGrassColor: THREE.CanvasTexture | null = null
let sharedGrassNormal: THREE.CanvasTexture | null = null
let sharedRockNormal: THREE.CanvasTexture | null = null
let sharedRoofTile: THREE.CanvasTexture | null = null

export function getSharedGrassColorMap(): THREE.CanvasTexture {
  sharedGrassColor ??= createGrassColorMap()
  return sharedGrassColor
}

export function getSharedGrassNormalMap(): THREE.CanvasTexture {
  sharedGrassNormal ??= createGrassNormalMap()
  return sharedGrassNormal
}

export function getSharedRockNormalMap(): THREE.CanvasTexture {
  sharedRockNormal ??= createRockNormalMap()
  return sharedRockNormal
}

export function getSharedRoofTileMap(): THREE.CanvasTexture {
  sharedRoofTile ??= createRoofTileMap()
  return sharedRoofTile
}
