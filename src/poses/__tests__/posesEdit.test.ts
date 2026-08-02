import { describe, expect, it } from 'vitest'
import type { Figure } from '../../store/figuresStore'
import {
  NUDGE_STEP_M,
  editTowardTarget,
  isNudgeableJoint,
  jointWorldPosition,
  nudgeJoint,
} from '../posesEdit'

function makeFigure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: {},
    ...overrides,
  }
}

describe('jointWorldPosition', () => {
  it('a raiz fica na altura do quadril, deslocada pela colocação do boneco', () => {
    const world = jointWorldPosition(makeFigure({ position: [1, 0, 2] }), 'root')
    expect(world).not.toBeNull()
    expect(world![0]).toBeCloseTo(1, 6)
    expect(world![1]).toBeCloseTo(0.9, 6)
    expect(world![2]).toBeCloseTo(2, 6)
  })

  it('nome desconhecido devolve null', () => {
    expect(jointWorldPosition(makeFigure(), 'banana')).toBeNull()
  })
})

describe('editTowardTarget', () => {
  it('raiz: translada a colocação pelo delta, sem tocar na pose', () => {
    const figure = makeFigure({ position: [1, 0, 2] })
    const edit = editTowardTarget(figure, 'root', [1, 0.9, 2], [1.5, 0.9, 2], [])
    expect(edit).toEqual({ kind: 'position', position: [1.5, 0, 2] })
  })

  it('junta arrastável: devolve rotações resolvidas pelo solver', () => {
    const figure = makeFigure()
    const anchor = jointWorldPosition(figure, 'wrist.L')!
    const target: [number, number, number] = [anchor[0], anchor[1] + 0.05, anchor[2]]
    const edit = editTowardTarget(figure, 'wrist.L', anchor, target, [])
    expect(edit).not.toBeNull()
    expect(edit!.kind).toBe('rotations')
    if (edit!.kind === 'rotations') {
      expect(Object.keys(edit!.rotations).length).toBeGreaterThan(0)
    }
  })

  it('junta fora do arrasto (mão, presa à raiz) devolve null', () => {
    const figure = makeFigure()
    expect(editTowardTarget(figure, 'fingersBase.L', [0, 1, 0], [0, 1.1, 0], [])).toBeNull()
    expect(editTowardTarget(figure, 'spine', [0, 1, 0], [0, 1.1, 0], [])).toBeNull()
  })
})

describe('nudgeJoint — as setas são o arrasto em passos', () => {
  it('raiz na vista de frente: "direita" empurra +X exatamente um passo', () => {
    const edit = nudgeJoint('front', makeFigure(), 'root', 'right', [])
    expect(edit).toEqual({ kind: 'position', position: [NUDGE_STEP_M, 0, 0] })
  })

  it('raiz na vista de trás: "direita" empurra -X — a base da vista faz o espelho', () => {
    const edit = nudgeJoint('back', makeFigure(), 'root', 'right', [])
    expect(edit).toEqual({ kind: 'position', position: [-NUDGE_STEP_M, 0, 0] })
  })

  it('na vista de cima a raiz anda no plano do chão, nunca em Y', () => {
    const edit = nudgeJoint('top', makeFigure(), 'root', 'up', [])
    expect(edit).toEqual({ kind: 'position', position: [0, 0, -NUDGE_STEP_M] })
  })

  it('junta arrastável muda a pose; junta travada na cadeia é respeitada pelo solver', () => {
    const figure = makeFigure()
    const free = nudgeJoint('front', figure, 'wrist.L', 'up', [])
    expect(free?.kind).toBe('rotations')
    // Com o cotovelo travado, ele não aparece entre as rotações resolvidas.
    const locked = nudgeJoint('front', figure, 'wrist.L', 'up', ['elbow.L'])
    if (locked?.kind === 'rotations') {
      expect(Object.keys(locked.rotations)).not.toContain('elbow.L')
    } else {
      throw new Error('esperava rotações')
    }
  })
})

describe('isNudgeableJoint', () => {
  it('raiz e juntas arrastáveis sim; mão e juntas presas à raiz, não', () => {
    expect(isNudgeableJoint('root')).toBe(true)
    expect(isNudgeableJoint('wrist.L')).toBe(true)
    expect(isNudgeableJoint('spine')).toBe(false)
    expect(isNudgeableJoint('fingersTip.R')).toBe(false)
  })
})
