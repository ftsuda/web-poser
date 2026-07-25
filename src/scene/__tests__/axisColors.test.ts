import { describe, expect, it } from 'vitest'
import { AXIS_COLORS } from '../axisColors'

describe('AXIS_COLORS (fase 9, item 9)', () => {
  it('usa exatamente as cores do gizmo do TransformControls', () => {
    // Valores lidos do código-fonte de `three-stdlib/controls/TransformControls`
    // (`matRed.color.set(16711680)`, `matGreen` 65280, `matBlue` 255) — se a
    // biblioteca mudar a convenção, este teste é o alarme.
    expect(parseInt(AXIS_COLORS.x.slice(1), 16)).toBe(0xff0000)
    expect(parseInt(AXIS_COLORS.y.slice(1), 16)).toBe(0x00ff00)
    expect(parseInt(AXIS_COLORS.z.slice(1), 16)).toBe(0x0000ff)
  })

  it('cobre os três eixos com cores distintas', () => {
    expect(new Set(Object.values(AXIS_COLORS)).size).toBe(3)
  })
})
