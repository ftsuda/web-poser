import { describe, expect, it } from 'vitest'
import { GRID_DIVISIONS, GROUND_SIZE } from '../constants'
import {
  GRID_ALIGNMENT_TOLERANCE_M,
  GRID_SPACING_M,
  gridAlignmentOf,
  isOnGridLine,
  nearestGridLine,
} from '../gridAlignment'

describe('gridAlignment (fase 9, item 10)', () => {
  it('deriva o espaçamento da própria grade do chão', () => {
    expect(GRID_SPACING_M).toBe(GROUND_SIZE / GRID_DIVISIONS)
  })

  it('encontra a linha mais próxima, inclusive em valores negativos', () => {
    expect(nearestGridLine(2.4 * GRID_SPACING_M)).toBeCloseTo(2 * GRID_SPACING_M, 6)
    expect(nearestGridLine(-2.6 * GRID_SPACING_M)).toBeCloseTo(-3 * GRID_SPACING_M, 6)
    expect(nearestGridLine(0)).toBe(0)
  })

  it('acende dentro da tolerância e apaga fora dela', () => {
    expect(isOnGridLine(0)).toBe(true)
    expect(isOnGridLine(GRID_SPACING_M + GRID_ALIGNMENT_TOLERANCE_M * 0.9)).toBe(true)
    expect(isOnGridLine(GRID_SPACING_M - GRID_ALIGNMENT_TOLERANCE_M * 0.9)).toBe(true)
    expect(isOnGridLine(GRID_SPACING_M + GRID_ALIGNMENT_TOLERANCE_M * 2)).toBe(false)
    expect(isOnGridLine(GRID_SPACING_M / 2)).toBe(false)
  })

  it('avalia X e Z de forma independente e ignora a altura', () => {
    expect(gridAlignmentOf([GRID_SPACING_M, 0, GRID_SPACING_M / 2])).toEqual({ x: true, z: false })
    expect(gridAlignmentOf([GRID_SPACING_M / 2, 0, -GRID_SPACING_M])).toEqual({ x: false, z: true })

    // Levantar o boneco do chão não muda o alinhamento no plano.
    expect(gridAlignmentOf([0, 1.4, 0])).toEqual({ x: true, z: true })
  })
})
