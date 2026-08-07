import { describe, expect, it } from 'vitest'
import { resolvePosePreset } from '../../figure/posePresets'
import type { Figure } from '../../store/figuresStore'
import { GESTURE_SPAN_RATIO, buildGestureLines } from '../gestureLines'

/**
 * As linhas de gesto (PLANO.md item 9): a linha de ação (cabeça → pelve → pé
 * de apoio) e as duas transversais de ombro e quadril, que juntas dizem o
 * contraposto. Vocabulário direto de quem desenha figura humana.
 *
 * O cálculo é puro — só `buildJointFrames` e vetores —, então roda no projeto
 * `unidade` sem montar Canvas nenhum.
 */
function makeFigure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'figure-1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: resolvePosePreset('standing'),
    ...overrides,
  }
}

describe('buildGestureLines', () => {
  it('a linha de ação desce da cabeça à pelve e daí ao pé de APOIO', () => {
    const lines = buildGestureLines(makeFigure())!

    expect(lines.action).toHaveLength(3)
    const [head, pelvis, foot] = lines.action
    // De cima para baixo, e terminando no chão.
    expect(head[1]).toBeGreaterThan(pelvis[1])
    expect(pelvis[1]).toBeGreaterThan(foot[1])
    expect(foot[1]).toBeLessThan(0.2)
  })

  it('o pé de apoio é o MAIS BAIXO — é nele que o peso cai', () => {
    // Perna direita dobrada: o tornozelo direito sobe, e o apoio passa a ser o
    // esquerdo. Quem desenha lê a linha de ação até o pé que sustenta.
    const raised = makeFigure({
      pose: {
        ...resolvePosePreset('standing'),
        'hip.R': { x: -35, y: 0, z: 0 },
        'knee.R': { x: 80, y: 0, z: 0 },
      },
    })
    const lines = buildGestureLines(raised)!
    expect(lines.action[2][0]).toBeGreaterThan(0)

    // Espelhado, o apoio troca de lado.
    const mirrored = makeFigure({
      pose: {
        ...resolvePosePreset('standing'),
        'hip.L': { x: -35, y: 0, z: 0 },
        'knee.L': { x: 80, y: 0, z: 0 },
      },
    })
    expect(buildGestureLines(mirrored)!.action[2][0]).toBeLessThan(0)
  })

  it('em pé, ombros e quadris ficam nivelados; inclinar o tronco desnivela SÓ os ombros', () => {
    const reto = buildGestureLines(makeFigure())!
    expect(reto.shoulders[0][1]).toBeCloseTo(reto.shoulders[1][1], 6)
    expect(reto.hips[0][1]).toBeCloseTo(reto.hips[1][1], 6)

    // O contraposto que o item quer mostrar: o tronco rola, os ombros
    // acompanham e a pelve fica onde estava.
    const inclinado = buildGestureLines(
      makeFigure({
        pose: { ...resolvePosePreset('standing'), spine: { x: 0, y: 0, z: 18 } },
      }),
    )!
    expect(Math.abs(inclinado.shoulders[0][1] - inclinado.shoulders[1][1])).toBeGreaterThan(0.05)
    expect(inclinado.hips[0][1]).toBeCloseTo(inclinado.hips[1][1], 6)
  })

  it('as duas transversais têm o MESMO comprimento, proporcional à altura', () => {
    // As juntas dos quadris distam só 18 cm — do tamanho real, a linha do
    // quadril mal apareceria ao lado da dos ombros, e comparar as duas
    // inclinações é justamente o ponto. As duas são estendidas ao mesmo vão.
    const figure = makeFigure({ height: 1.8 })
    const lines = buildGestureLines(figure)!
    const span = (pair: readonly [readonly number[], readonly number[]]) =>
      Math.hypot(pair[0][0] - pair[1][0], pair[0][1] - pair[1][1], pair[0][2] - pair[1][2])

    expect(span(lines.shoulders)).toBeCloseTo(1.8 * GESTURE_SPAN_RATIO, 6)
    expect(span(lines.hips)).toBeCloseTo(1.8 * GESTURE_SPAN_RATIO, 6)
  })

  it('as transversais ficam CENTRADAS nas juntas, e a colocação do boneco entra na conta', () => {
    const figure = makeFigure({ position: [2, 0, -1] })
    const lines = buildGestureLines(figure)!

    const meio = (pair: readonly [readonly number[], readonly number[]]) =>
      [0, 1, 2].map((axis) => (pair[0][axis] + pair[1][axis]) / 2)

    expect(meio(lines.shoulders)[0]).toBeCloseTo(2, 6)
    expect(meio(lines.hips)[0]).toBeCloseTo(2, 6)
    expect(meio(lines.hips)[2]).toBeCloseTo(-1, 6)
  })

  it('sem boneco, não há linha', () => {
    expect(buildGestureLines(null)).toBeNull()
  })
})
