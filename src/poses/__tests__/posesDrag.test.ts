import { describe, expect, it } from 'vitest'
import {
  TWIST_DECIDE_DEG,
  createTwistTracker,
  dragTargetForPointer,
  draggedRootPosition,
  twistPointerDown,
  twistPointerMove,
  twistPointerUp,
  wrapAngleDeltaDeg,
  type PosesDragState,
} from '../posesDrag'

function drag(overrides: Partial<PosesDragState> = {}): PosesDragState {
  return {
    figureId: 'f1',
    jointName: 'wrist.L',
    anchor: [0, 1, 0],
    startPosition: [0, 0, 0],
    planeNormal: null,
    axis: null,
    ...overrides,
  }
}

describe('dragTargetForPointer (item 58)', () => {
  it('com eixo (seta do gizmo), o alvo é o ponto da RETA do eixo mais próximo do raio', () => {
    // Raio olhando de frente (+Z para -Z), apontando para x=2 na altura da âncora.
    const target = dragTargetForPointer(drag({ axis: 'x' }), 'front', [2, 1, 5], [0, 0, -1])!
    expect(target[0]).toBeCloseTo(2, 6)
    expect(target[1]).toBeCloseTo(1, 6)
    expect(target[2]).toBeCloseTo(0, 6)
  })

  it('com normal de plano (vista Livre), projeta no plano preso à âncora', () => {
    // Plano paralelo à tela com a câmera olhando -Z: normal [0,0,-1], âncora z=0.
    const target = dragTargetForPointer(
      drag({ planeNormal: [0, 0, -1] }),
      'free',
      [1, 2, 5],
      [0, 0, -1],
    )!
    expect(target).toEqual([1, 2, 0])
  })

  it('sem eixo nem normal, cai no plano da vista travada (frente: z da âncora fixo)', () => {
    const target = dragTargetForPointer(drag(), 'front', [1.5, 0.5, 5], [0, 0, -1])!
    expect(target[2]).toBeCloseTo(0, 6)
    expect(target[0]).toBeCloseTo(1.5, 6)
    expect(target[1]).toBeCloseTo(0.5, 6)
  })
})

describe('draggedRootPosition (item 58)', () => {
  it('soma à colocação inicial o delta entre o alvo e a âncora', () => {
    const state = drag({ anchor: [0, 1, 0], startPosition: [2, 0, -1] })
    expect(draggedRootPosition(state, [0.5, 1.25, -0.5])).toEqual([2.5, 0.25, -1.5])
  })
})

describe('wrapAngleDeltaDeg', () => {
  it('traz o delta para (-180, 180] — cruzar o ±180 não vira uma volta inteira', () => {
    expect(wrapAngleDeltaDeg(200)).toBe(-160)
    expect(wrapAngleDeltaDeg(-200)).toBe(160)
    expect(wrapAngleDeltaDeg(10)).toBe(10)
  })
})

describe('gesto de torção (item 58) — dois dedos girando', () => {
  it('não torce antes de acumular o limiar; ao vencê-lo, entrega o acumulado de uma vez', () => {
    const twist = createTwistTracker()
    twistPointerDown(twist, 1, { x: 0, y: 0 })
    twistPointerDown(twist, 2, { x: 100, y: 0 })

    // 5° de giro: ainda é câmera (pinça/pan), não torção.
    let delta = twistPointerMove(twist, 2, {
      x: 100 * Math.cos((5 * Math.PI) / 180),
      y: 100 * Math.sin((5 * Math.PI) / 180),
    })
    expect(delta).toBeNull()

    // Mais 7°: o acumulado (12°) vence o limiar e sai INTEIRO.
    delta = twistPointerMove(twist, 2, {
      x: 100 * Math.cos((12 * Math.PI) / 180),
      y: 100 * Math.sin((12 * Math.PI) / 180),
    })
    expect(delta).not.toBeNull()
    expect(delta!).toBeCloseTo(12, 6)
    expect(delta!).toBeGreaterThanOrEqual(TWIST_DECIDE_DEG)

    // Ativo: os deltas seguintes saem direto.
    delta = twistPointerMove(twist, 2, {
      x: 100 * Math.cos((20 * Math.PI) / 180),
      y: 100 * Math.sin((20 * Math.PI) / 180),
    })
    expect(delta!).toBeCloseTo(8, 6)
  })

  it('com menos de dois ponteiros não há gesto; soltar um dedo desarma', () => {
    const twist = createTwistTracker()
    twistPointerDown(twist, 1, { x: 0, y: 0 })
    expect(twistPointerMove(twist, 1, { x: 10, y: 10 })).toBeNull()

    twistPointerDown(twist, 2, { x: 100, y: 0 })
    twistPointerMove(twist, 2, { x: 100 * Math.cos(0.5), y: 100 * Math.sin(0.5) })
    expect(twist.active).toBe(true)

    expect(twistPointerUp(twist, 2)).toBe(false)
    expect(twist.active).toBe(false)
    expect(twist.accumulated).toBe(0)
  })

  it('ponteiro que não é do gesto não torce nada', () => {
    const twist = createTwistTracker()
    twistPointerDown(twist, 1, { x: 0, y: 0 })
    twistPointerDown(twist, 2, { x: 100, y: 0 })
    expect(twistPointerMove(twist, 99, { x: 5, y: 5 })).toBeNull()
  })
})
