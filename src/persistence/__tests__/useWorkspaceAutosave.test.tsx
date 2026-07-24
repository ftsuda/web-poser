import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useFiguresStore } from '../../store/figuresStore'
import { loadWorkspaceFromLocalStorage } from '../autosave'
import { useWorkspaceAutosave } from '../useWorkspaceAutosave'

function Harness() {
  useWorkspaceAutosave()
  return null
}

describe('useWorkspaceAutosave', () => {
  beforeEach(() => {
    localStorage.clear()
    useFiguresStore.setState(useFiguresStore.getInitialState())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the workspace to localStorage shortly after a store change, debounced', () => {
    render(<Harness />)

    act(() => {
      useFiguresStore.getState().addFigure('Boneco A')
    })
    expect(loadWorkspaceFromLocalStorage()).toBeNull() // ainda não passou o debounce

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    const restored = loadWorkspaceFromLocalStorage()
    expect(restored?.workingScene.figures).toHaveLength(1)
    expect(restored?.workingScene.figures[0].name).toBe('Boneco A')
  })

  it('coalesces rapid successive changes into a single save', () => {
    render(<Harness />)

    act(() => {
      useFiguresStore.getState().addFigure('A')
      vi.advanceTimersByTime(200)
      useFiguresStore.getState().addFigure('B')
      vi.advanceTimersByTime(200)
      useFiguresStore.getState().addFigure('C')
    })
    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(loadWorkspaceFromLocalStorage()?.workingScene.figures).toHaveLength(3)
  })
})
