import { describe, expect, it } from 'vitest'
import {
  FULL_FRAME_SENSOR_HEIGHT_MM,
  LENS_PRESETS,
  MAX_FOCAL_MM,
  MIN_FOCAL_MM,
  clampFocalLength,
  focalLengthToFov,
  fovToFocalLength,
  LENS_FAMILY_TERMS,
  lensFamilyKey,
} from '../lens'

/**
 * Distância focal em milímetros (PLANO.md > "Ideias e melhorias" > item 11).
 * A conversão é ancorada na ALTURA do sensor full-frame (24 mm) porque o
 * `fov` do three.js é vertical — ver DECISOES.md #46.
 */
describe('focalLengthToFov', () => {
  it('usa a altura do sensor full-frame: 2·atan(12/f)', () => {
    expect(FULL_FRAME_SENSOR_HEIGHT_MM).toBe(24)
    for (const mm of [14, 24, 35, 50, 85, 100, 200]) {
      const expected = (2 * Math.atan(FULL_FRAME_SENSOR_HEIGHT_MM / 2 / mm) * 180) / Math.PI
      expect(focalLengthToFov(mm)).toBeCloseTo(expected, 10)
    }
  })

  it('bate com os valores conhecidos de uma câmera full-frame (FOV vertical)', () => {
    expect(focalLengthToFov(50)).toBeCloseTo(27.0, 1)
    expect(focalLengthToFov(24)).toBeCloseTo(53.1, 1)
    expect(focalLengthToFov(85)).toBeCloseTo(16.1, 1)
  })

  it('é o inverso exato de fovToFocalLength', () => {
    for (const mm of [10, 14, 35, 50, 135, 300]) {
      expect(fovToFocalLength(focalLengthToFov(mm))).toBeCloseTo(mm, 8)
    }
  })

  it('lente mais longa = ângulo menor (a compressão de perspectiva do item)', () => {
    expect(focalLengthToFov(200)).toBeLessThan(focalLengthToFov(50))
    expect(focalLengthToFov(50)).toBeLessThan(focalLengthToFov(14))
  })
})

describe('clampFocalLength', () => {
  it('mantém a faixa dentro do que a câmera aceita', () => {
    expect(clampFocalLength(0)).toBe(MIN_FOCAL_MM)
    expect(clampFocalLength(9999)).toBe(MAX_FOCAL_MM)
    expect(clampFocalLength(Number.NaN)).toBe(MIN_FOCAL_MM)
    expect(clampFocalLength(50)).toBe(50)
  })

  it('a faixa cobre da ultra grande angular à super teleobjetiva', () => {
    expect(MIN_FOCAL_MM).toBeLessThanOrEqual(14)
    expect(MAX_FOCAL_MM).toBeGreaterThanOrEqual(200)
  })
})

describe('LENS_PRESETS', () => {
  it('lista as lentes da tabela de referência, em ordem crescente', () => {
    expect(LENS_PRESETS).toEqual([14, 24, 35, 50, 85, 100, 200])
  })

  /** Famílias da tabela: cada faixa de milímetros tem um efeito próprio. */
  it('classifica cada lente na família que a tabela descreve', () => {
    expect(lensFamilyKey(14)).toBe('ultraWide')
    expect(lensFamilyKey(24)).toBe('ultraWide')
    expect(lensFamilyKey(35)).toBe('standard')
    expect(lensFamilyKey(50)).toBe('standard')
    expect(lensFamilyKey(85)).toBe('portrait')
    expect(lensFamilyKey(100)).toBe('portrait')
    expect(lensFamilyKey(200)).toBe('superTele')
    expect(lensFamilyKey(400)).toBe('superTele')
  })

  it('cada família tem o termo em inglês da tabela (#47)', () => {
    expect(LENS_FAMILY_TERMS).toEqual({
      ultraWide: 'Ultra Wide',
      standard: 'Standard Lens',
      portrait: 'Telephoto (Portrait)',
      superTele: 'Super Telephoto',
    })
  })
})
