import { beforeEach, describe, expect, it } from 'vitest'
import { rootAxisLockToken } from '../../figure/jointLocks'
import { resolvePosePresetPlacement } from '../../figure/posePresets'
import { useFiguresStore } from '../figuresStore'

/**
 * Trava por eixo da rotação da raiz (item 64): os tokens `root.x`/`root.y`/
 * `root.z` entram pelo MESMO `toggleJointLock` do #42 e valem para TUDO —
 * slider/teclado/torção (`setRootRotation`), o arrasto (`setJointRotations`
 * com a parte da raiz), o reset e as poses aplicadas, que preservam os eixos
 * travados da colocação.
 */

function figure(id: string) {
  return useFiguresStore.getState().figures.find((candidate) => candidate.id === id)!
}

beforeEach(() => {
  useFiguresStore.setState(useFiguresStore.getInitialState())
  useFiguresStore.temporal.getState().clear()
})

describe('trava por eixo da raiz (item 64)', () => {
  it('trava pelo token, fora do histórico de undo, e a root crua segue recusada', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointLock(id, rootAxisLockToken('y'))
    expect(useFiguresStore.getState().jointLocks[id]).toEqual(['root.y'])

    useFiguresStore.getState().toggleJointLock(id, 'root')
    expect(useFiguresStore.getState().jointLocks[id]).toEqual(['root.y'])

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().jointLocks[id]).toEqual(['root.y'])
  })

  it('setRootRotation ignora o eixo travado e aplica os demais', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointLock(id, rootAxisLockToken('x'))

    useFiguresStore.getState().setRootRotation(id, { x: 30, y: 40 })
    expect(figure(id).rotation.x).toBe(0)
    expect(figure(id).rotation.y).toBe(40)
  })

  it('setRootRotation só no eixo travado não empilha passo de undo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointLock(id, rootAxisLockToken('x'))
    const before = useFiguresStore.temporal.getState().pastStates.length

    useFiguresStore.getState().setRootRotation(id, { x: 30 })
    expect(figure(id).rotation.x).toBe(0)
    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(before)
  })

  it('o reset da raiz zera só os eixos destravados', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().setRootRotation(id, { x: 10, y: 20, z: 30 })
    useFiguresStore.getState().toggleJointLock(id, rootAxisLockToken('x'))

    useFiguresStore.getState().resetJointRotation(id, 'root')
    expect(figure(id).rotation).toEqual({ x: 10, y: 0, z: 0 })
  })

  it('pose aplicada preserva o eixo travado da colocação', () => {
    const id = useFiguresStore.getState().addFigure() as string
    // O preset deitado impõe colocação com X fora de zero — é o que a trava segura.
    expect(resolvePosePresetPlacement('lyingHandsBehindHead').rotation.x).not.toBe(0)
    useFiguresStore.getState().toggleJointLock(id, rootAxisLockToken('x'))

    useFiguresStore.getState().applyPosePreset(id, 'lyingHandsBehindHead')
    expect(figure(id).rotation.x).toBe(0)
  })

  it('a parte da raiz do arrasto (setJointRotations) respeita o eixo travado', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointLock(id, rootAxisLockToken('x'))

    useFiguresStore.getState().setJointRotations(id, {}, { x: 20, y: 30, z: 0 })
    expect(figure(id).rotation.x).toBe(0)
    expect(figure(id).rotation.y).toBe(30)
  })

  it('o gesto de torção da raiz (via setRootRotation em Y) é recusado com root.y travado', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointLock(id, rootAxisLockToken('y'))

    useFiguresStore.getState().setRootRotation(id, { y: 55 })
    expect(figure(id).rotation.y).toBe(0)
  })
})
