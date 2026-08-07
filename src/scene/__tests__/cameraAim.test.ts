import { describe, expect, it } from 'vitest'
import { AIM_JOINT_NAME, figureAimPoint, figuresAimPoint, withSceneCameraAimedAt } from '../cameraAim'
import { resolvePosePreset } from '../../figure/posePresets'
import type { CameraViewState } from '../cameraMove'
import type { Figure } from '../../store/figuresStore'

function figure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'f1',
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

const view: CameraViewState = {
  position: [0, 1.5, 5],
  target: [0, 1.5, 0],
  up: [0, 1, 0],
  focalMm: 50,
}

/**
 * Apontar a câmera de cena para o boneco (pedido do usuário, 2026-08-06): só a
 * rotação, e para o MEIO DO CORPO — a base do tórax.
 */
describe('figureAimPoint', () => {
  it('mira a base do tórax, não os pés nem a cabeça', () => {
    const [, y] = figureAimPoint(figure())!

    // Um boneco de 1,70 m em pé tem o peito bem acima da metade e bem abaixo
    // do topo: é o alvo de um plano, não uma das pontas.
    expect(y).toBeGreaterThan(1)
    expect(y).toBeLessThan(1.6)
  })

  it('acompanha a colocação do boneco no chão', () => {
    const parado = figureAimPoint(figure())!
    const andou = figureAimPoint(figure({ position: [2, 0, -3] }))!

    expect(andou[0]).toBeCloseTo(parado[0] + 2)
    expect(andou[2]).toBeCloseTo(parado[2] - 3)
  })

  it('acompanha a altura do boneco', () => {
    const alto = figureAimPoint(figure({ height: 1.9 }))!
    const baixo = figureAimPoint(figure({ height: 1.5 }))!

    expect(alto[1]).toBeGreaterThan(baixo[1])
  })

  it('a junta mirada é a base do tórax', () => {
    expect(AIM_JOINT_NAME).toBe('chest')
  })
})

describe('figuresAimPoint', () => {
  it('devolve a média dos bonecos', () => {
    const media = figuresAimPoint([figure({ id: 'a' }), figure({ id: 'b', position: [4, 0, 0] })])!
    const sozinho = figureAimPoint(figure())!

    expect(media[0]).toBeCloseTo(sozinho[0] + 2)
    expect(media[1]).toBeCloseTo(sozinho[1])
  })

  /** Apontar para o meio de um grupo contando quem não aparece puxaria a câmera para o vazio. */
  it('ignora os bonecos ocultos', () => {
    const media = figuresAimPoint([
      figure({ id: 'a' }),
      figure({ id: 'b', position: [4, 0, 0], visible: false }),
    ])!

    expect(media[0]).toBeCloseTo(figureAimPoint(figure())![0])
  })

  it('sem nenhum boneco visível, não há para onde apontar', () => {
    expect(figuresAimPoint([])).toBeNull()
    expect(figuresAimPoint([figure({ visible: false })])).toBeNull()
  })
})

describe('withSceneCameraAimedAt', () => {
  it('gira NO LUGAR: a posição não muda e o alvo vira o ponto', () => {
    const aimed = withSceneCameraAimedAt(view, [2, 1, -1])

    expect(aimed.position).toEqual(view.position)
    expect(aimed.target).toEqual([2, 1, -1])
    expect(aimed.focalMm).toBe(50)
  })

  /** A inclinação lateral é escolha de quem enquadrou: apontar não a desfaz. */
  it('preserva o topo da tela, inclusive inclinado', () => {
    const inclinada: CameraViewState = { ...view, up: [0.3, 0.95, 0] }

    expect(withSceneCameraAimedAt(inclinada, [0, 1, 0]).up).toEqual([0.3, 0.95, 0])
  })

  /** Sem direção não há para onde olhar, e o alvo em cima do eixo do topo é ambíguo. */
  it('devolve a vista intacta quando não há como mirar', () => {
    expect(withSceneCameraAimedAt(view, [...view.position])).toBe(view)
    expect(withSceneCameraAimedAt(view, [0, 5, 5])).toBe(view)
  })
})
