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
