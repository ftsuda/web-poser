/**
 * Resolução de saída como PROPORÇÃO × QUALIDADE (fase 11.4, pedido do
 * usuário): as três proporções são as MESMAS da máscara de enquadramento
 * (16:9, 9:16 e 1:1), e qualquer uma grava em 1080p ou 720p — antes só o 16:9
 * tinha 720p, e o 4K saiu por decisão do usuário ("não precisa"). O
 * instantâneo ainda aceita uma resolução personalizada; o vídeo não (nunca
 * aceitou).
 */

export const OUTPUT_ASPECT_KEYS = ['wide', 'vertical', 'square'] as const

export type OutputAspectKey = (typeof OUTPUT_ASPECT_KEYS)[number]

/** A proporção escolhida no painel do INSTANTÂNEO — as três fixas ou a personalizada. */
export type OutputAspectChoice = OutputAspectKey | 'custom'

export const OUTPUT_QUALITY_KEYS = ['1080p', '720p'] as const

export type OutputQualityKey = (typeof OUTPUT_QUALITY_KEYS)[number]

/**
 * A qualidade nomeia o LADO MENOR do quadro (a convenção "1080p"/"720p" dos
 * players): 16:9 dá 1920×1080, 9:16 dá 1080×1920 e 1:1 dá 1080×1080 — o mesmo
 * nível de detalhe nas três proporções.
 */
const QUALITY_SHORT_SIDE: Record<OutputQualityKey, number> = { '1080p': 1080, '720p': 720 }

export function outputResolutionFor(
  aspect: OutputAspectKey,
  quality: OutputQualityKey,
): { width: number; height: number } {
  const short = QUALITY_SHORT_SIDE[quality]
  const long = (short * 16) / 9
  switch (aspect) {
    case 'wide':
      return { width: long, height: short }
    case 'vertical':
      return { width: short, height: long }
    case 'square':
      return { width: short, height: short }
  }
}

/**
 * Chaves i18n dos rótulos de proporção e qualidade — compartilhadas pelos
 * painéis de Instantâneos e de Animação (mesmos rótulos, por construção).
 */
export const ASPECT_LABEL_KEYS: Record<OutputAspectKey, string> = {
  wide: 'panels.snapshots.aspectWide',
  vertical: 'panels.snapshots.aspectVertical',
  square: 'panels.snapshots.aspectSquare',
}

export const QUALITY_LABEL_KEYS: Record<OutputQualityKey, string> = {
  '1080p': 'panels.snapshots.quality1080',
  '720p': 'panels.snapshots.quality720',
}

/** Teto de resolução para a personalizada (GPUs fracas) — ver PLANO.md > "Riscos e mitigações". */
export const MAX_SNAPSHOT_DIMENSION = 3840
export const MIN_SNAPSHOT_DIMENSION = 64

export const DEFAULT_OUTPUT_ASPECT: OutputAspectKey = 'wide'

/** Padrão do INSTANTÂNEO: 16:9 em 1080p — o PNG é referência para desenhar, e ali resolução alta é o que se quer. */
export const DEFAULT_SNAPSHOT_QUALITY: OutputQualityKey = '1080p'

/**
 * Padrão do VÍDEO (pedido do usuário). Mais baixo que o do instantâneo de
 * propósito: a exportação renderiza um quadro de cada vez, então a resolução
 * multiplica direto o tempo de espera — e 720p já é entrega padrão de vídeo na
 * web.
 */
export const DEFAULT_VIDEO_QUALITY: OutputQualityKey = '720p'
