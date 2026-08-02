import { beforeEach, describe, expect, it } from 'vitest'
import { useFiguresStore } from '../figuresStore'

/**
 * A âncora de junta (item 62) no store: o conjunto congelado derivado
 * (ancestrais da junta ancorada) soma-se às travas do #42 em toda escrita de
 * pose, e a COLOCAÇÃO do boneco congela junto — posição e rotação da raiz.
 */

function figure(id: string) {
  return useFiguresStore.getState().figures.find((candidate) => candidate.id === id)!
}

beforeEach(() => {
  useFiguresStore.setState(useFiguresStore.getInitialState())
  useFiguresStore.temporal.getState().clear()
})

describe('toggleJointPin / clearJointPins', () => {
  it('ancora e solta pela ação do store; raiz é ignorada', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    expect(useFiguresStore.getState().jointPins[id]).toEqual(['elbow.L'])

    useFiguresStore.getState().toggleJointPin(id, 'root')
    expect(useFiguresStore.getState().jointPins[id]).toEqual(['elbow.L'])

    useFiguresStore.getState().clearJointPins(id)
    expect(useFiguresStore.getState().jointPins[id]).toBeUndefined()
  })

  it('ancorar fica FORA do histórico de undo, como a trava (#42)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 40 })
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().jointPins[id]).toEqual(['elbow.L'])
  })
})

describe('escrita de pose com âncora', () => {
  it('ancestral da junta ancorada não muda por slider/teclado; a própria junta e as de baixo continuam livres', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    const shoulderBefore = figure(id).pose['shoulder.L']

    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -40 })
    expect(figure(id).pose['shoulder.L']).toEqual(shoulderBefore)

    useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -60 })
    expect(figure(id).pose['elbow.L'].x).toBe(-60)

    useFiguresStore.getState().setJointRotation(id, 'wrist.L', { x: 30 })
    expect(figure(id).pose['wrist.L'].x).toBe(30)
  })

  it('setJointRotations pula as congeladas e escreve as livres', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    const spineBefore = figure(id).pose['spine']

    useFiguresStore.getState().setJointRotations(id, {
      spine: { z: 20 },
      'elbow.L': { x: -45 },
    })
    expect(figure(id).pose['spine']).toEqual(spineBefore)
    expect(figure(id).pose['elbow.L'].x).toBe(-45)
  })

  it('aplicar pose preserva a cadeia congelada E a colocação', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -50 })
    useFiguresStore.getState().setRootRotation(id, { y: 45 })
    useFiguresStore.getState().setPosition(id, [1, 0, 2])
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')

    useFiguresStore.getState().applyPosePreset(id, 'standing')

    expect(figure(id).pose['shoulder.L'].x).toBe(-50)
    expect(figure(id).rotation.y).toBe(45)
    expect(figure(id).position).toEqual([1, 0, 2])
  })

  it('sorteio e espelho preservam a cadeia congelada', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -50, y: 10, z: 5 })
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    const shoulderBefore = figure(id).pose['shoulder.L']

    useFiguresStore.getState().applyRandomPose(id)
    expect(figure(id).pose['shoulder.L']).toEqual(shoulderBefore)

    useFiguresStore.getState().mirrorWholeFigure(id)
    expect(figure(id).pose['shoulder.L']).toEqual(shoulderBefore)
  })

  it('reset da junta congelada é recusado; reset de grupo pula as congeladas', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -50 })
    useFiguresStore.getState().setJointRotation(id, 'wrist.L', { x: 30 })
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')

    useFiguresStore.getState().resetJointRotation(id, 'shoulder.L')
    expect(figure(id).pose['shoulder.L'].x).toBe(-50)

    useFiguresStore.getState().resetJointGroup(id, 'armLeft')
    expect(figure(id).pose['shoulder.L'].x).toBe(-50)
    // O punho (abaixo da âncora) volta ao neutro normalmente.
    expect(figure(id).pose['wrist.L'].x).not.toBe(30)
  })
})

describe('colocação congelada', () => {
  it('setPosition, setRootRotation, assentar e reset da raiz viram no-op com âncora', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setRootRotation(id, { y: 30 })
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 90 })
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    const before = figure(id)

    useFiguresStore.getState().setPosition(id, [3, 0, 3])
    useFiguresStore.getState().setRootRotation(id, { y: 120 })
    useFiguresStore.getState().seatFigureOnGround(id)
    useFiguresStore.getState().resetJointRotation(id, 'root')

    expect(figure(id).position).toEqual(before.position)
    expect(figure(id).rotation).toEqual(before.rotation)
  })

  it('âncora em hip congela SÓ a colocação — a pose inteira continua editável', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointPin(id, 'hip.L')

    useFiguresStore.getState().setPosition(id, [3, 0, 3])
    expect(figure(id).position).toEqual([0, 0, 0])

    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -40 })
    expect(figure(id).pose['shoulder.L'].x).toBe(-40)
  })

  it('importar pose de arquivo com âncora: junta congelada e colocação ficam como estavam', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setRootRotation(id, { y: 15 })
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    const before = figure(id)

    useFiguresStore.getState().applyImportedFigurePose(id, {
      height: 1.7,
      positionY: 0.4,
      rotation: { x: 0, y: 90, z: 0 },
      pose: { 'shoulder.L': { x: -70, y: 0, z: 0 }, 'wrist.L': { x: 25, y: 0, z: 0 } },
    })

    expect(figure(id).rotation).toEqual(before.rotation)
    expect(figure(id).position).toEqual(before.position)
    expect(figure(id).pose['shoulder.L']).toEqual(before.pose['shoulder.L'])
    expect(figure(id).pose['wrist.L'].x).toBe(25)
  })
})

describe('ciclo de vida', () => {
  it('duplicar leva as âncoras; remover o boneco as descarta', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')

    const copy = useFiguresStore.getState().duplicateFigure(id) as string
    expect(useFiguresStore.getState().jointPins[copy]).toEqual(['elbow.L'])

    useFiguresStore.getState().removeFigure(id)
    expect(useFiguresStore.getState().jointPins[id]).toBeUndefined()
    expect(useFiguresStore.getState().jointPins[copy]).toEqual(['elbow.L'])
  })

  it('resetWorkspace limpa as âncoras', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')
    useFiguresStore.getState().resetWorkspace()
    expect(useFiguresStore.getState().jointPins).toEqual({})
  })
})

describe('rotação da raiz no arrasto (item 63) — escrita combinada', () => {
  it('setJointRotations grava juntas + rotação da raiz num passo de undo só', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const before = useFiguresStore.temporal.getState().pastStates.length

    useFiguresStore.getState().setJointRotations(
      id,
      { 'shoulder.L': { x: -30 } },
      { x: 0, y: 40, z: 0 },
    )

    expect(figure(id).pose['shoulder.L'].x).toBe(-30)
    expect(figure(id).rotation.y).toBe(40)
    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(before + 1)
  })

  it('com âncora, a parte da raiz é descartada e as juntas livres entram', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointPin(id, 'elbow.L')

    useFiguresStore.getState().setJointRotations(
      id,
      { 'elbow.L': { x: -45 } },
      { x: 0, y: 40, z: 0 },
    )

    expect(figure(id).pose['elbow.L'].x).toBe(-45)
    expect(figure(id).rotation.y).toBe(0)
  })
})
