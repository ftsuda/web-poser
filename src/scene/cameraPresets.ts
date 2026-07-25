/**
 * Lógica pura dos presets ortográficos de câmera (ver PLANO.md > "Ambiente e
 * câmera"). Não depende de R3F/three — as coordenadas resultantes são
 * aplicadas à câmera de verdade por `CameraRig.tsx`, que é a única camada
 * que efetivamente move um `THREE.Camera` (não coberta por teste automatizado,
 * pelo mesmo motivo que o arraste do gizmo em `SelectionGizmo.tsx`).
 */

export type Vector3Tuple = [number, number, number]

export type OrthoPresetName = 'front' | 'back' | 'left' | 'right' | 'top' | 'threeQuarter'

export const ORTHO_PRESET_NAMES: readonly OrthoPresetName[] = [
  'front',
  'back',
  'left',
  'right',
  'top',
  'threeQuarter',
]

export interface PresetView {
  position: Vector3Tuple
  up: Vector3Tuple
}

const SQRT_THIRD = 1 / Math.sqrt(3)

/**
 * Direção (a partir do alvo) de onde a câmera enxerga a cena em cada preset,
 * já normalizada. Convenção +Z = frente do boneco (mesma de `skeleton.ts`/`Figure.tsx`).
 */
const PRESET_DIRECTIONS: Record<OrthoPresetName, Vector3Tuple> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  right: [1, 0, 0],
  left: [-1, 0, 0],
  top: [0, 1, 0],
  threeQuarter: [SQRT_THIRD, SQRT_THIRD, SQRT_THIRD],
}

/**
 * Vetor "para cima" da câmera em cada preset. A visão de topo olha reto para
 * baixo — up=[0,1,0] seria colinear à direção de visão (degenerado) — então
 * usa -Z como referência de "topo da tela", convenção também usada pelo Blender.
 */
const PRESET_UP: Record<OrthoPresetName, Vector3Tuple> = {
  front: [0, 1, 0],
  back: [0, 1, 0],
  right: [0, 1, 0],
  left: [0, 1, 0],
  top: [0, 0, -1],
  threeQuarter: [0, 1, 0],
}

export function computePresetView(
  preset: OrthoPresetName,
  target: Vector3Tuple,
  distance: number,
): PresetView {
  const [dx, dy, dz] = PRESET_DIRECTIONS[preset]
  const [tx, ty, tz] = target
  return {
    position: [tx + dx * distance, ty + dy * distance, tz + dz * distance],
    up: PRESET_UP[preset],
  }
}

/**
 * Folga em volta do boneco ao enquadrar (tecla `F`): 15% além do raio da
 * esfera que o envolve, para o boneco não encostar nas bordas da tela.
 */
const FRAME_MARGIN = 1.15

/**
 * Distância da câmera ao alvo que faz uma esfera de raio `boundingRadius`
 * caber inteira na tela, considerando o FOV **vertical** e a proporção da
 * janela. Numa janela mais larga que alta o limite é a altura; numa mais
 * estreita, a largura — daí a divisão por `aspect` no FOV horizontal.
 * Puro e testável; quem move a câmera é o `CameraRig`.
 */
export function computeFrameDistance(
  boundingRadius: number,
  fovDeg: number,
  aspect: number,
): number {
  const radius = Math.max(boundingRadius, 0.01) * FRAME_MARGIN
  const fovRad = (fovDeg * Math.PI) / 180
  const distanceForHeight = radius / Math.tan(fovRad / 2)
  // FOV horizontal derivado do vertical pela proporção da janela.
  const horizontalFovRad = 2 * Math.atan(Math.tan(fovRad / 2) * aspect)
  const distanceForWidth = radius / Math.tan(horizontalFovRad / 2)
  return Math.max(distanceForHeight, distanceForWidth)
}

/**
 * Zoom de uma câmera ortográfica que enquadra a cena de forma equivalente a
 * uma câmera em perspectiva com o FOV dado, à mesma distância do alvo —
 * evita o "salto" de enquadramento ao trocar de projeção.
 */
export function computeOrthographicZoom(
  distance: number,
  fovDeg: number,
  viewportHeight: number,
): number {
  const fovRad = (fovDeg * Math.PI) / 180
  const visibleHeight = 2 * distance * Math.tan(fovRad / 2)
  return viewportHeight / visibleHeight
}
