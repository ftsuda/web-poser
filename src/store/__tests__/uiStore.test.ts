import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '../uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('starts with the help panel hidden', () => {
    expect(useUIStore.getState().helpVisible).toBe(false)
  })

  it('toggleHelp flips visibility on/off', () => {
    useUIStore.getState().toggleHelp()
    expect(useUIStore.getState().helpVisible).toBe(true)
    useUIStore.getState().toggleHelp()
    expect(useUIStore.getState().helpVisible).toBe(false)
  })

  it('closeHelp always leaves it hidden, even if already hidden', () => {
    useUIStore.getState().closeHelp()
    expect(useUIStore.getState().helpVisible).toBe(false)
    useUIStore.getState().toggleHelp()
    useUIStore.getState().closeHelp()
    expect(useUIStore.getState().helpVisible).toBe(false)
  })
})
