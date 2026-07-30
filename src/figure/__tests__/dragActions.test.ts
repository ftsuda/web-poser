import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { useFiguresStore } from '../../store/figuresStore'
import { buildJointFrames } from '../jointFrames'
import { applyJointDrag } from '../dragActions'

function wristWorldPosition(figureId: string): THREE.Vector3 {
  const figure = useFiguresStore.getState().figures.find((f) => f.id === figureId)!
  const { joints } = buildJointFrames(figure)
  const position = new THREE.Vector3()
  joints.get('wrist.L')!.getWorldPosition(position)
  return position
}

describe('applyJointDrag', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('resolve a cadeia e grava a pose no figuresStore, rastreada pelo undo', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const start = wristWorldPosition(id)

    const achieved = applyJointDrag(id, 'wrist.L', [start.x + 0.05, start.y + 0.05, start.z])

    expect(achieved).not.toBeNull()
    const updated = useFiguresStore.getState().figures.find((f) => f.id === id)!
    expect(updated.pose['shoulder.L']).toBeDefined()
    expect(useFiguresStore.temporal.getState().pastStates.length).toBeGreaterThan(0)
    // A posição devolvida é a da pose GRAVADA — o gizmo volta exatamente para
    // onde o boneco de fato ficou.
    expect(wristWorldPosition(id).distanceTo(new THREE.Vector3(...(achieved as number[])))).toBeLessThan(1e-6)
  })

  it('uma chamada = UM passo de undo, mesmo escrevendo a cadeia inteira', () => {
    const id = useFiguresStore.getState().addFigure() as string
    const start = wristWorldPosition(id)
    const before = useFiguresStore.temporal.getState().pastStates.length

    applyJointDrag(id, 'wrist.L', [start.x + 0.05, start.y + 0.05, start.z])

    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(before + 1)
  })

  it('devolve null para boneco inexistente e para junta sem arrasto (raiz, mão, spine/hip)', () => {
    const id = useFiguresStore.getState().addFigure() as string
    expect(applyJointDrag('figure-inexistente', 'wrist.L', [0, 0, 0])).toBeNull()
    for (const name of ['root', 'thumb1.L', 'fingersTip.R', 'spine', 'hip.L']) {
      expect(applyJointDrag(id, name, [0, 0, 0]), name).toBeNull()
    }
  })

  it('junta travada não muda ao arrastar outra junta — fica rígida, sem interromper a cadeia', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().toggleJointLock(id, 'shoulder.L')
    const lockedBefore = useFiguresStore.getState().figures.find((f) => f.id === id)!.pose['shoulder.L']
    const start = wristWorldPosition(id)

    applyJointDrag(id, 'wrist.L', [start.x + 0.25, start.y + 0.25, start.z])

    const after = useFiguresStore.getState().figures.find((f) => f.id === id)!
    expect(after.pose['shoulder.L']).toEqual(lockedBefore)
    // O cotovelo (abaixo da trava) participou normalmente.
    expect(after.pose['elbow.L']).toBeDefined()
  })
})
