export type ResolutionPresetKey = 'hd720' | 'fullHD' | 'square' | 'fourK' | 'custom'

export interface ResolutionPreset {
  key: Exclude<ResolutionPresetKey, 'custom'>
  width: number
  height: number
}

/** Presets de resolução citados no plano, mais 4K como teto (ver "Riscos e mitigações") e 720p, pedido do usuário. */
export const SNAPSHOT_RESOLUTION_PRESETS: readonly ResolutionPreset[] = [
  { key: 'hd720', width: 1280, height: 720 },
  { key: 'fullHD', width: 1920, height: 1080 },
  { key: 'square', width: 1080, height: 1080 },
  { key: 'fourK', width: 3840, height: 2160 },
]

/** Teto de resolução (GPUs fracas) — ver PLANO.md > "Riscos e mitigações". */
export const MAX_SNAPSHOT_DIMENSION = 3840
export const MIN_SNAPSHOT_DIMENSION = 64

/**
 * Padrão do INSTANTÂNEO. Continua em Full HD: o PNG é referência para desenhar,
 * e ali resolução alta é o que se quer.
 */
export const DEFAULT_RESOLUTION_PRESET: ResolutionPresetKey = 'fullHD'

/**
 * Padrão do VÍDEO (pedido do usuário). Mais baixo que o do instantâneo de
 * propósito: a exportação renderiza um quadro de cada vez, então a resolução
 * multiplica direto o tempo de espera — e 720p já é entrega padrão de vídeo na
 * web. A lista de presets é a mesma dos dois, só o ponto de partida difere.
 */
export const DEFAULT_VIDEO_RESOLUTION_PRESET: ResolutionPresetKey = 'hd720'
