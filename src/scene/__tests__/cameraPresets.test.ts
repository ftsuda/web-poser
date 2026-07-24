import { describe, expect, it } from 'vitest'
import { computeOrthographicZoom, computePresetView, ORTHO_PRESET_NAMES } from '../cameraPresets'

describe('computePresetView', () => {
  it('positions the camera in front of the target (+Z), upright, for the "front" preset', () => {
    const { position, up } = computePresetView('front', [0, 1, 0], 5)
    expect(position).toEqual([0, 1, 5])
    expect(up).toEqual([0, 1, 0])
  })

  it('positions the camera behind the target (-Z) for the "back" preset', () => {
    const { position } = computePresetView('back', [0, 1, 0], 5)
    expect(position).toEqual([0, 1, -5])
  })

  it('positions the camera on +X for the "right" preset', () => {
    const { position } = computePresetView('right', [0, 1, 0], 5)
    expect(position).toEqual([5, 1, 0])
  })

  it('positions the camera on -X for the "left" preset', () => {
    const { position } = computePresetView('left', [0, 1, 0], 5)
    expect(position).toEqual([-5, 1, 0])
  })

  it('positions the camera directly above the target for the "top" preset, with a non-degenerate up vector', () => {
    const { position, up } = computePresetView('top', [0, 1, 0], 5)
    expect(position).toEqual([0, 6, 0])
    // Olhar reto para baixo com up=[0,1,0] é degenerado (colinear ao eixo de visão);
    // a convenção de topo usa -Z como "para cima" na tela, como no Blender.
    expect(up).toEqual([0, 0, -1])
  })

  it('positions the camera on a diagonal front-right-top corner for the "threeQuarter" preset, at the same distance from target', () => {
    const target: [number, number, number] = [0, 1, 0]
    const { position, up } = computePresetView('threeQuarter', target, 6)
    const dx = position[0] - target[0]
    const dy = position[1] - target[1]
    const dz = position[2] - target[2]
    expect(Math.sqrt(dx * dx + dy * dy + dz * dz)).toBeCloseTo(6, 5)
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBeGreaterThan(0)
    expect(dz).toBeGreaterThan(0)
    expect(up).toEqual([0, 1, 0])
  })

  it('offsets from an arbitrary (non-origin) target, not just the world origin', () => {
    const { position } = computePresetView('front', [2, 0.5, -1], 3)
    expect(position).toEqual([2, 0.5, 2])
  })

  it('exposes all six preset names', () => {
    expect(ORTHO_PRESET_NAMES).toHaveLength(6)
    expect(new Set(ORTHO_PRESET_NAMES)).toEqual(
      new Set(['front', 'back', 'left', 'right', 'top', 'threeQuarter']),
    )
  })
})

describe('computeOrthographicZoom', () => {
  it('matches the framing an equivalent perspective camera would show at the same distance', () => {
    // Em 90° de FOV, a altura visível a uma distância d é 2*d (tan(45°) = 1).
    const zoom = computeOrthographicZoom(10, 90, 800)
    expect(zoom).toBeCloseTo(800 / 20, 5)
  })

  it('halves when the distance doubles (objects appear the same size as in perspective)', () => {
    const near = computeOrthographicZoom(5, 50, 800)
    const far = computeOrthographicZoom(10, 50, 800)
    expect(far).toBeCloseTo(near / 2, 5)
  })

  it('scales proportionally with viewport height', () => {
    const small = computeOrthographicZoom(5, 50, 400)
    const large = computeOrthographicZoom(5, 50, 800)
    expect(large).toBeCloseTo(small * 2, 5)
  })

  it('decreases as the field of view widens (wider FOV sees more of the scene)', () => {
    const narrow = computeOrthographicZoom(5, 30, 800)
    const wide = computeOrthographicZoom(5, 90, 800)
    expect(wide).toBeLessThan(narrow)
  })
})
