import { beforeEach, describe, expect, it } from 'vitest'
import { useIKStore } from '../ikStore'

describe('ikStore', () => {
  beforeEach(() => {
    useIKStore.setState(useIKStore.getInitialState())
  })

  it('starts with no limb enabled', () => {
    expect(useIKStore.getState().isLimbEnabled('figure-1', 'wrist.L')).toBe(false)
  })

  it('enableLimb turns IK on for that figure+limb and seeds the target at the given position', () => {
    useIKStore.getState().enableLimb('figure-1', 'wrist.L', [0.4, 0.8, 0.2])

    const state = useIKStore.getState()
    expect(state.isLimbEnabled('figure-1', 'wrist.L')).toBe(true)
    expect(state.getTarget('figure-1', 'wrist.L')).toEqual([0.4, 0.8, 0.2])
  })

  it('does not affect other figures or other limbs of the same figure', () => {
    useIKStore.getState().enableLimb('figure-1', 'wrist.L', [0, 0, 0])

    const state = useIKStore.getState()
    expect(state.isLimbEnabled('figure-2', 'wrist.L')).toBe(false)
    expect(state.isLimbEnabled('figure-1', 'wrist.R')).toBe(false)
    expect(state.isLimbEnabled('figure-1', 'ankle.L')).toBe(false)
  })

  it('disableLimb turns IK back off', () => {
    useIKStore.getState().enableLimb('figure-1', 'wrist.L', [0, 0, 0])
    useIKStore.getState().disableLimb('figure-1', 'wrist.L')
    expect(useIKStore.getState().isLimbEnabled('figure-1', 'wrist.L')).toBe(false)
  })

  it('setTarget updates the stored target position for that figure+limb', () => {
    useIKStore.getState().enableLimb('figure-1', 'wrist.L', [0, 0, 0])
    useIKStore.getState().setTarget('figure-1', 'wrist.L', [1, 2, 3])
    expect(useIKStore.getState().getTarget('figure-1', 'wrist.L')).toEqual([1, 2, 3])
  })

  it('setReached/getReached tracks whether the last solve reached the target', () => {
    useIKStore.getState().enableLimb('figure-1', 'wrist.L', [0, 0, 0])
    expect(useIKStore.getState().getReached('figure-1', 'wrist.L')).toBe(true) // default otimista até o primeiro solve
    useIKStore.getState().setReached('figure-1', 'wrist.L', false)
    expect(useIKStore.getState().getReached('figure-1', 'wrist.L')).toBe(false)
  })

  it('removeFigure clears every limb/target/reached entry belonging to that figure', () => {
    useIKStore.getState().enableLimb('figure-1', 'wrist.L', [0, 0, 0])
    useIKStore.getState().enableLimb('figure-1', 'ankle.R', [1, 1, 1])
    useIKStore.getState().enableLimb('figure-2', 'wrist.L', [2, 2, 2])

    useIKStore.getState().removeFigure('figure-1')

    const state = useIKStore.getState()
    expect(state.isLimbEnabled('figure-1', 'wrist.L')).toBe(false)
    expect(state.isLimbEnabled('figure-1', 'ankle.R')).toBe(false)
    expect(state.isLimbEnabled('figure-2', 'wrist.L')).toBe(true) // outro boneco intocado
  })
})
