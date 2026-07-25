import { GRID_SPACING_M } from './constants'

/**
 * Alinhamento com as linhas da grade do chão (fase 9, item 10). É só
 * INDICADOR: nada aqui move ou "gruda" a posição — o plano pede o destaque
 * visual, não snapping automático.
 */

export { GRID_SPACING_M }

/**
 * Folga para considerar uma coordenada "sobre a linha". Precisa ser
 * perceptível ao arrastar com o mouse (chegar ao valor exato é praticamente
 * impossível) sem acender o indicador longe da linha: 2 cm é ~2% do
 * espaçamento de 1 m.
 */
export const GRID_ALIGNMENT_TOLERANCE_M = 0.02

/** A linha da grade mais próxima de `value` (múltiplo de `GRID_SPACING_M`). */
export function nearestGridLine(value: number): number {
  return Math.round(value / GRID_SPACING_M) * GRID_SPACING_M
}

/** `true` quando `value` está a menos de `tolerance` de uma linha da grade. */
export function isOnGridLine(value: number, tolerance = GRID_ALIGNMENT_TOLERANCE_M): boolean {
  return Math.abs(value - nearestGridLine(value)) <= tolerance
}

export interface GridAlignment {
  /** Sobre uma linha perpendicular a X (ou seja, com X num múltiplo do espaçamento). */
  x: boolean
  z: boolean
}

/** Alinhamento de uma posição no plano do chão — só X/Z importam (a grade é horizontal). */
export function gridAlignmentOf(
  position: readonly [number, number, number],
  tolerance = GRID_ALIGNMENT_TOLERANCE_M,
): GridAlignment {
  return {
    x: isOnGridLine(position[0], tolerance),
    z: isOnGridLine(position[2], tolerance),
  }
}
