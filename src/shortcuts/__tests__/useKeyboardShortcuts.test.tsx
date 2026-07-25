import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, renderHook } from '@testing-library/react'
import { JOINT_NAMES } from '../../figure/skeleton'
import { useCameraStore } from '../../store/cameraStore'
import { useFiguresStore } from '../../store/figuresStore'
import { useIKStore } from '../../store/ikStore'
import { useKeyframeCaptureStore } from '../../store/keyframeCaptureStore'
import { useUIStore } from '../../store/uiStore'
import { useKeyboardShortcuts } from '../useKeyboardShortcuts'

function press(init: Partial<KeyboardEventInit> & { key: string }, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useCameraStore.setState(useCameraStore.getInitialState())
    useKeyframeCaptureStore.setState(useKeyframeCaptureStore.getInitialState())
    useIKStore.setState(useIKStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
    renderHook(() => useKeyboardShortcuts())
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('undoes and redoes via Ctrl+Z / Ctrl+Shift+Z', () => {
    useFiguresStore.getState().addFigure()
    expect(useFiguresStore.getState().figures).toHaveLength(1)

    press({ key: 'z', ctrlKey: true })
    expect(useFiguresStore.getState().figures).toHaveLength(0)

    press({ key: 'z', ctrlKey: true, shiftKey: true })
    expect(useFiguresStore.getState().figures).toHaveLength(1)
  })

  it('selects a figure by its position with digits 1-5', () => {
    const { addFigure } = useFiguresStore.getState()
    const first = addFigure() as string
    addFigure()

    press({ key: '1' })
    expect(useFiguresStore.getState().selectedFigureId).toBe(first)
  })

  it('ignores a digit beyond the number of figures', () => {
    useFiguresStore.getState().addFigure()

    press({ key: '3' })
    expect(useFiguresStore.getState().selectedFigureId).toBeNull()
  })

  it('duplicates the selected figure with Ctrl+D', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)

    press({ key: 'd', ctrlKey: true })
    expect(useFiguresStore.getState().figures).toHaveLength(2)
  })

  it('does nothing on Ctrl+D when no figure is selected', () => {
    press({ key: 'd', ctrlKey: true })
    expect(useFiguresStore.getState().figures).toHaveLength(0)
  })

  it('removes the selected figure with Delete', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)

    press({ key: 'Delete' })
    expect(useFiguresStore.getState().figures).toHaveLength(0)
  })

  it('toggles visibility of the selected figure with H', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)

    press({ key: 'h' })
    expect(useFiguresStore.getState().figures[0].visible).toBe(false)
  })

  it('toggles IK mode for the selected limb with R', () => {
    const { addFigure, selectFigure, selectJoint } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    selectJoint('elbow.L')

    press({ key: 'r' })
    expect(useIKStore.getState().isLimbEnabled(id, 'wrist.L')).toBe(true)

    press({ key: 'r' })
    expect(useIKStore.getState().isLimbEnabled(id, 'wrist.L')).toBe(false)
  })

  it('does nothing with R when the selected joint is not part of a limb', () => {
    const { addFigure, selectFigure, selectJoint } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    selectJoint('spine')

    press({ key: 'r' })
    expect(useIKStore.getState().isLimbEnabled(id, 'wrist.L')).toBe(false)
  })

  it('toggles the shortcuts help panel with ?', () => {
    press({ key: '?', shiftKey: true })
    expect(useUIStore.getState().helpVisible).toBe(true)

    press({ key: '?', shiftKey: true })
    expect(useUIStore.getState().helpVisible).toBe(false)
  })

  it('while the help panel is open, only ?/Escape are handled — other shortcuts are suspended', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    useUIStore.getState().toggleHelp()

    press({ key: 'h' })
    expect(useFiguresStore.getState().figures[0].visible).toBe(true) // não mudou

    press({ key: 'Escape' })
    expect(useUIStore.getState().helpVisible).toBe(false)
    expect(useFiguresStore.getState().selectedFigureId).toBe(id) // Escape fechou a ajuda, não limpou a seleção
  })

  it('clears the selection with Escape', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)

    press({ key: 'Escape' })
    expect(useFiguresStore.getState().selectedFigureId).toBeNull()
  })

  it('cycles joints forward/backward with Tab / Shift+Tab', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    expect(useFiguresStore.getState().selectedJointName).toBe('root')

    press({ key: 'Tab' })
    expect(useFiguresStore.getState().selectedJointName).toBe(JOINT_NAMES[1])

    press({ key: 'Tab', shiftKey: true })
    expect(useFiguresStore.getState().selectedJointName).toBe(JOINT_NAMES[0])
  })

  it('moves the root on the ground plane with arrows when root is selected', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    const start = useFiguresStore.getState().figures[0].position

    press({ key: 'ArrowRight' })
    const afterRight = useFiguresStore.getState().figures[0].position
    expect(afterRight[0]).toBeGreaterThan(start[0])

    press({ key: 'ArrowUp' })
    const afterUp = useFiguresStore.getState().figures[0].position
    expect(afterUp[2]).not.toBe(afterRight[2])
  })

  it('adjusts the active axis rotation with left/right arrows when a joint is selected', () => {
    const { addFigure, selectFigure, selectJoint } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    selectJoint('elbow.L')

    // elbow.x só existe no lado negativo (flexão, ver DECISOES.md #14) —
    // ArrowLeft é quem se move dentro da faixa válida.
    press({ key: 'ArrowLeft' })
    const figure = useFiguresStore.getState().figures[0]
    expect(figure.pose['elbow.L'].x).toBeLessThan(0)
  })

  it('cycles the active axis with up/down arrows on a multi-axis joint', () => {
    const { addFigure, selectFigure, selectJoint } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    selectJoint('shoulder.L')
    expect(useFiguresStore.getState().activeAxis).toBe('x')

    press({ key: 'ArrowDown' })
    expect(useFiguresStore.getState().activeAxis).toBe('y')
  })

  it('uses a larger step with Shift and a finer step with Ctrl', () => {
    const { addFigure, selectFigure, selectJoint } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)
    selectJoint('elbow.L')

    // elbow.x só existe no lado negativo (flexão, ver DECISOES.md #14) —
    // ArrowLeft é quem se move dentro da faixa válida.
    press({ key: 'ArrowLeft', ctrlKey: true })
    const fine = useFiguresStore.getState().figures[0].pose['elbow.L'].x

    useFiguresStore.getState().selectJoint('elbow.L')
    press({ key: 'ArrowLeft', shiftKey: true })
    const large = useFiguresStore.getState().figures[0].pose['elbow.L'].x

    expect(Math.abs(large) - Math.abs(fine)).toBeGreaterThan(Math.abs(fine))
  })

  it('does nothing for shortcuts when no figure is selected', () => {
    press({ key: 'Tab' })
    press({ key: 'ArrowRight' })
    press({ key: 'h' })
    press({ key: 'Delete' })
    expect(useFiguresStore.getState().figures).toEqual([])
  })

  it('applies the front orthographic preset with Numpad1', () => {
    press({ key: '1', code: 'Numpad1' })
    const state = useCameraStore.getState()
    expect(state.projection).toBe('orthographic')
    expect(state.pendingCommand).toEqual({ type: 'preset', preset: 'front' })
  })

  it('applies the back preset with Ctrl+Numpad1', () => {
    press({ key: '1', code: 'Numpad1', ctrlKey: true })
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'preset', preset: 'back' })
  })

  it('applies a camera bookmark by index with Shift+1..5, ignoring the shortcut if the slot is empty', () => {
    press({ key: '1', code: 'Digit1', shiftKey: true })
    expect(useCameraStore.getState().pendingCommand).toBeNull()

    const id = useFiguresStore.getState().addCameraBookmark({
      name: 'Plano geral',
      position: [3, 2, 4],
      target: [0, 1, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })

    press({ key: '1', code: 'Digit1', shiftKey: true })
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyBookmark', id })
  })

  it('requests a keyframe capture with Space', () => {
    press({ key: ' ', code: 'Space' })
    expect(useKeyframeCaptureStore.getState().pendingCapture).toBe(true)
  })

  it('ignores shortcuts while typing in a text field', () => {
    const { addFigure, selectFigure } = useFiguresStore.getState()
    const id = addFigure() as string
    selectFigure(id)

    const { container } = render(<input type="text" />)
    const input = container.querySelector('input') as HTMLInputElement

    press({ key: 'h' }, input)
    expect(useFiguresStore.getState().figures[0].visible).toBe(true)
  })
})
