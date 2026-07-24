export type ResolutionPresetKey = 'fullHD' | 'square' | 'fourK' | 'custom'

export interface ResolutionPreset {
  key: Exclude<ResolutionPresetKey, 'custom'>
  width: number
  height: number
}

/** Presets de resolução citados no plano, mais 4K como teto (ver "Riscos e mitigações"). */
export const KEYFRAME_RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  { key: 'fullHD', width: 1920, height: 1080 },
  { key: 'square', width: 1080, height: 1080 },
  { key: 'fourK', width: 3840, height: 2160 },
]

/** Teto de resolução (GPUs fracas) — ver PLANO.md > "Riscos e mitigações". */
export const MAX_KEYFRAME_DIMENSION = 3840
export const MIN_KEYFRAME_DIMENSION = 64

export const DEFAULT_RESOLUTION_PRESET: ResolutionPresetKey = 'fullHD'
