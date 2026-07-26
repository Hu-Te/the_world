import {
  detectDeviceClass,
  PIXEL_RATIO_CAP_DESKTOP,
  PIXEL_RATIO_CAP_MOBILE,
  type DeviceClass,
} from '../performanceBudget'

/** 首页氛围场景质量档（控制分段 / 特效） */
export type HomeQuality = {
  device: DeviceClass
  circleSeg: number
  torusSeg: number
  floorTexSize: number
  particleCount: number
  backdropStarsNear: number
  backdropStarsFar: number
  domeTexSize: number
  /** 仅中心 hub 允许一份昂贵透射 */
  useHubTransmission: boolean
  /** 分类雕塑走假玻璃，不开 transmission */
  useTransmission: boolean
  useEnvMap: boolean
  showWall: boolean
  maxDpr: number
}

export function resolveHomeQuality(
  device: DeviceClass = detectDeviceClass(),
): HomeQuality {
  if (device === 'mobile') {
    return {
      device,
      circleSeg: 28,
      torusSeg: 24,
      floorTexSize: 384,
      particleCount: 36,
      backdropStarsNear: 64,
      backdropStarsFar: 40,
      domeTexSize: 384,
      useHubTransmission: false,
      useTransmission: false,
      useEnvMap: false,
      showWall: false,
      maxDpr: PIXEL_RATIO_CAP_MOBILE,
    }
  }
  return {
    device,
    circleSeg: 40,
    torusSeg: 32,
    floorTexSize: 512,
    particleCount: 48,
    backdropStarsNear: 90,
    backdropStarsFar: 60,
    domeTexSize: 512,
    useHubTransmission: false,
    useTransmission: false,
    // PMREM 首屏昂贵；关掉后首屏更快，材质略平
    useEnvMap: false,
    showWall: false,
    maxDpr: PIXEL_RATIO_CAP_DESKTOP,
  }
}
