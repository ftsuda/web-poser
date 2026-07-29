import { describe, expect, it } from 'vitest'
import { DEFAULT_FPS, FPS_OPTIONS, clampFps, frameTimeline } from '../frameTimeline'

describe('frameTimeline', () => {
  it('inclui o quadro final: 1 s a 30 fps são 31 quadros, do instante 0 ao 1,0', () => {
    const quadros = frameTimeline(1000, 30)
    expect(quadros).toHaveLength(31)
    expect(quadros[0].timeMs).toBe(0)
    expect(quadros[30].timeMs).toBeCloseTo(1000, 6)
  })

  it('cada quadro dura exatamente 1/fps e os instantes são múltiplos disso', () => {
    const quadros = frameTimeline(2000, 25)
    expect(quadros).toHaveLength(51)
    for (const quadro of quadros) {
      expect(quadro.durationS).toBeCloseTo(1 / 25, 12)
      expect(quadro.timeS).toBeCloseTo(quadro.index / 25, 12)
    }
  })

  it('duração que não é múltiplo do fps arredonda para o quadro mais próximo', () => {
    // 1050 ms a 30 fps = 31,5 quadros → 32 intervalos + o quadro final.
    expect(frameTimeline(1050, 30)).toHaveLength(33)
    // 1010 ms a 30 fps = 30,3 quadros → 30 intervalos.
    expect(frameTimeline(1010, 30)).toHaveLength(31)
  })

  it('animação de duração zero ainda rende um quadro — a imagem parada', () => {
    expect(frameTimeline(0, 30)).toHaveLength(1)
    expect(frameTimeline(0, 30)[0].timeMs).toBe(0)
  })

  it('duração negativa não gera lista vazia nem laço infinito', () => {
    expect(frameTimeline(-100, 30)).toHaveLength(1)
  })
})

describe('clampFps', () => {
  it('aceita só as taxas oferecidas, caindo no padrão para qualquer outra coisa', () => {
    for (const fps of FPS_OPTIONS) expect(clampFps(fps)).toBe(fps)
    expect(clampFps(17)).toBe(DEFAULT_FPS)
    expect(clampFps(Number.NaN)).toBe(DEFAULT_FPS)
    // 60 é o padrão pedido pelo usuário; as outras taxas seguem disponíveis.
    expect(DEFAULT_FPS).toBe(60)
    expect(FPS_OPTIONS).toContain(24)
  })
})
