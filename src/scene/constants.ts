import type { BackgroundTone } from '../store/figuresStore'

export const BACKGROUND_COLORS: Record<BackgroundTone, string> = {
  light: '#b3b3b3',
  medium: '#808080',
  dark: '#404040',
}

export const CAMERA_DEFAULTS = {
  position: [3, 2, 4] as [number, number, number],
  fov: 50,
  near: 0.1,
  far: 100,
}

export const GROUND_SIZE = 20
export const GRID_DIVISIONS = 20
