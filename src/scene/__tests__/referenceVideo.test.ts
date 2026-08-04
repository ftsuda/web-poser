import { describe, expect, it } from 'vitest'
import { FPS_CHOICES, fpsFromFrameDeltas, stepFrameTime } from '../referenceVideo'

/**
 * O vídeo de referência (PLANO.md > "Vídeo como referência"): a parte PURA do
 * andar de frame. O navegador não expõe "frame" — só `currentTime`; avançar
 * ou retroceder é `± 1/fps`, com o fps vindo do seletor ou da medição por
 * `requestVideoFrameCallback` (intervalos entre frames apresentados).
 */
describe('referenceVideo', () => {
  it('anda um frame para cada lado e GRAMPEIA nas pontas do vídeo', () => {
    expect(stepFrameTime(1, 10, 30, 1)).toBeCloseTo(1 + 1 / 30, 9)
    expect(stepFrameTime(1, 10, 30, -1)).toBeCloseTo(1 - 1 / 30, 9)
    expect(stepFrameTime(0.01, 10, 30, -1)).toBe(0)
    expect(stepFrameTime(9.99, 10, 30, 1)).toBe(10)
  })

  it('fps ou duração inválidos não movem o tempo', () => {
    expect(stepFrameTime(1, 10, 0, 1)).toBe(1)
    expect(stepFrameTime(1, 10, -30, 1)).toBe(1)
    expect(stepFrameTime(1, Number.NaN, 30, 1)).toBe(1)
  })

  it('mede o fps pela MEDIANA dos intervalos e encaixa na taxa comum mais próxima', () => {
    // 29,97 fps de verdade (NTSC): mediana ~0,03337 s → encaixa em 30.
    const ntsc = Array.from({ length: 10 }, () => 1 / 29.97)
    expect(fpsFromFrameDeltas(ntsc)).toBe(30)

    // 23,976 → 24; 25 exato → 25.
    expect(fpsFromFrameDeltas(Array.from({ length: 10 }, () => 1 / 23.976))).toBe(24)
    expect(fpsFromFrameDeltas(Array.from({ length: 10 }, () => 1 / 25))).toBe(25)
  })

  it('descarta saltos de seek e lixo; sem amostras suficientes, devolve null', () => {
    // Um seek no meio da medição gera um intervalo de segundos — não é frame.
    const withSeek = [...Array.from({ length: 8 }, () => 1 / 30), 2.5, 0, -0.1]
    expect(fpsFromFrameDeltas(withSeek)).toBe(30)

    expect(fpsFromFrameDeltas([1 / 30, 1 / 30])).toBeNull()
    expect(fpsFromFrameDeltas([2.5, 3, 4, 5, 6, 7])).toBeNull()
  })

  it('as taxas do seletor incluem as comuns de cinema, PAL, NTSC e telas rápidas', () => {
    expect(FPS_CHOICES).toContain(24)
    expect(FPS_CHOICES).toContain(25)
    expect(FPS_CHOICES).toContain(30)
    expect(FPS_CHOICES).toContain(60)
  })
})
