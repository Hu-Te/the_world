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
      particleCount: 40,
      backdropStarsNear: 90,
      backdropStarsFar: 60,
      domeTexSize: 512,
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
    floorTexSize: 640,
    particleCount: 56,
    backdropStarsNear: 120,
    backdropStarsFar: 90,
    domeTexSize: 896,
    useHubTransmission: false,
    useTransmission: false,
    useEnvMap: true,
    showWall: false,
    maxDpr: PIXEL_RATIO_CAP_DESKTOP,
  }
}
