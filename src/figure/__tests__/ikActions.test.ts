import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { useFiguresStore } from '../../store/figuresStore'
import { useIKStore } from '../../store/ikStore'
import { buildJointFrames } from '../jointFrames'
import { applyIKTarget, toggleLimbIK } from '../ikActions'

describe('ikActions', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useIKStore.setState(useIKStore.getInitialState())
  })

  describe('toggleLimbIK', () => {
    it('enables IK for a limb, seeding the target at the current wrist world position', () => {
      const id = useFiguresStore.getState().addFigure() as string
      const figure = useFiguresStore.getState().figures[0]
      const { joints } = buildJointFrames(figure)
      const expected = new THREE.Vector3()
      joints.get('wrist.L')!.getWorldPosition(expected)

      toggleLimbIK(id, 'wrist.L')

      expect(useIKStore.getState().isLimbEnabled(id, 'wrist.L')).toBe(true)
      const target = useIKStore.getState().getTarget(id, 'wrist.L')!
      expect(target[0]).toBeCloseTo(expected.x)
      expect(target[1]).toBeCloseTo(expected.y)
      expect(target[2]).toBeCloseTo(expected.z)
    })

    it('disables IK when called again for an already-enabled limb', () => {
      const id = useFiguresStore.getState().addFigure() as string
      toggleLimbIK(id, 'wrist.L')
      toggleLimbIK(id, 'wrist.L')
      expect(useIKStore.getState().isLimbEnabled(id, 'wrist.L')).toBe(false)
    })

    it('does nothing for an unknown figure id', () => {
      expect(() => toggleLimbIK('figure-inexistente', 'wrist.L')).not.toThrow()
      expect(useIKStore.getState().isLimbEnabled('figure-inexistente', 'wrist.L')).toBe(false)
    })
  })

  describe('applyIKTarget', () => {
    it('solves the chain and writes the resulting joint rotations into figuresStore, tracked by undo', () => {
      const id = useFiguresStore.getState().addFigure() as string
      const figure = useFiguresStore.getState().figures[0]
      const { joints } = buildJointFrames(figure)
      const shoulderPos = new THREE.Vector3()
      joints.get('shoulder.L')!.getWorldPosition(shoulderPos)
      const target: [number, number, number] = [shoulderPos.x + 0.3, shoulderPos.y - 0.4, shoulderPos.z + 0.2]

      applyIKTarget(id, 'wrist.L', target)

      const updated = useFiguresStore.getState().figures.find((f) => f.id === id)!
      expect(updated.pose['shoulder.L']).toBeDefined()
      expect(updated.pose['elbow.L']).toBeDefined()
      expect(useFiguresStore.temporal.getState().pastStates.length).toBeGreaterThan(0)
    })

    it('updates the ikStore target and reached flag', () => {
      const id = useFiguresStore.getState().addFigure() as string
      const figure = useFiguresStore.getState().figures[0]
      const { joints } = buildJointFrames(figure)
      const shoulderPos = new THREE.Vector3()
      joints.get('shoulder.L')!.getWorldPosition(shoulderPos)
      const farTarget: [number, number, number] = [shoulderPos.x + 100, shoulderPos.y, shoulderPos.z]

      applyIKTarget(id, 'wrist.L', farTarget)

      expect(useIKStore.getState().getTarget(id, 'wrist.L')).toEqual(farTarget)
      expect(useIKStore.getState().getReached(id, 'wrist.L')).toBe(false)
    })

    it('does nothing for an unknown limb key', () => {
      const id = useFiguresStore.getState().addFigure() as string
      expect(() => applyIKTarget(id, 'not-a-limb', [0, 0, 0])).not.toThrow()
    })
  })
})
