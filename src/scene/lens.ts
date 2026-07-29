/**
 * Distância focal em MILÍMETROS como controle de câmera (PLANO.md > "Ideias e
 * melhorias" > item 11, pedido do usuário): ilustrador e fotógrafo pensam em
 * 24/35/50/85 mm, não em graus de campo de visão.
 *
 * **Por que a altura do sensor, e não a largura.** O `fov` de uma
 * `PerspectiveCamera` do three.js é VERTICAL, e a captura de instantâneo troca o
 * `aspect` da câmera para o da resolução escolhida (`SnapshotCapture.tsx`) —
 * 16:9, 1:1 ou o que o usuário pedir. Ancorando a conversão na altura do
 * sensor full-frame (24 mm dos 36×24), "50 mm" significa o MESMO
 * enquadramento vertical no viewport e em qualquer resolução de captura: o
 * que muda com a proporção é só quanto se vê para os lados — exatamente o que
 * um recorte quadrado faz numa foto full-frame. Se a conversão fosse pela
 * largura (o padrão do Blender), a mesma lente enquadraria diferente na tela
 * e no PNG. Ver DECISOES.md #46.
 */

/** Altura do sensor full-frame (35 mm), em milímetros — os 24 de "36×24". */
export const FULL_FRAME_SENSOR_HEIGHT_MM = 24

/**
 * Faixa aceita pelo controle. O piso é uma ultra grande angular extrema
 * (100,4° verticais) e o teto uma super teleobjetiva (4,6°) — além disso a
 * projeção fica degenerada sem servir a nenhum uso de referência.
 */
export const MIN_FOCAL_MM = 10
export const MAX_FOCAL_MM = 300

/** Distâncias focais da tabela de referência do usuário, em ordem crescente. */
export const LENS_PRESETS: readonly number[] = [14, 24, 35, 50, 85, 100, 200]

/**
 * Lente com que a cena começa (pedido do usuário). 35 mm é a grande angular
 * discreta do repórter: abre o suficiente para caber corpo inteiro e ambiente
 * sem a distorção de rosto das ultra grandes angulares. É daqui que sai o
 * `CAMERA_DEFAULTS.fov`, e portanto o campo de visão de toda câmera nova.
 */
export const DEFAULT_FOCAL_MM = 35

/** Famílias de lente da tabela — o que muda de uma faixa para a outra é o efeito, não só o ângulo. */
export type LensFamilyKey = 'ultraWide' | 'standard' | 'portrait' | 'superTele'

/**
 * Termo em INGLÊS de cada família, como na tabela de referência do usuário.
 * Não passa por i18n de propósito: é vocabulário de prompt — o mesmo texto
 * que se digita num gerador de imagem —, então tem de ser idêntico em
 * qualquer idioma da interface. A tradução vira legenda (DECISOES.md #47).
 */
export const LENS_FAMILY_TERMS: Record<LensFamilyKey, string> = {
  ultraWide: 'Ultra Wide',
  standard: 'Standard Lens',
  portrait: 'Telephoto (Portrait)',
  superTele: 'Super Telephoto',
}

/** Campo de visão VERTICAL, em graus, de uma lente de `focalMm` num sensor full-frame. */
export function focalLengthToFov(focalMm: number): number {
  const focal = clampFocalLength(focalMm)
  return (2 * Math.atan(FULL_FRAME_SENSOR_HEIGHT_MM / 2 / focal) * 180) / Math.PI
}

/** Inverso exato de `focalLengthToFov` — o painel guarda graus (é o que a câmera e os bookmarks usam) e mostra milímetros. */
export function fovToFocalLength(fovDeg: number): number {
  const half = (fovDeg * Math.PI) / 360
  return FULL_FRAME_SENSOR_HEIGHT_MM / 2 / Math.tan(half)
}

export function clampFocalLength(focalMm: number): number {
  if (!Number.isFinite(focalMm)) return MIN_FOCAL_MM
  return Math.min(MAX_FOCAL_MM, Math.max(MIN_FOCAL_MM, focalMm))
}

/**
 * Família da lente, pelos cortes da tabela: até 24 mm distorce as bordas; de
 * 35 a 50 é a visão humana; de 85 a 100 "achata" o rosto e é a lente de
 * retrato; de 200 em diante comprime forte, colando o fundo no sujeito.
 */
export function lensFamilyKey(focalMm: number): LensFamilyKey {
  if (focalMm <= 24) return 'ultraWide'
  if (focalMm <= 50) return 'standard'
  if (focalMm < 200) return 'portrait'
  return 'superTele'
}
