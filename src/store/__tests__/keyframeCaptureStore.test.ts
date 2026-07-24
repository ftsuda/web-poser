import { beforeEach, describe, expect, it } from 'vitest'
import { KEYFRAME_RESOLUTION_PRESETS } from '../../keyframe/constants'
import { useKeyframeCaptureStore } from '../keyframeCaptureStore'

describe('keyframeCaptureStore', () => {
  beforeEach(() => {
    useKeyframeCaptureStore.setState(useKeyframeCaptureStore.getInitialState())
  })

  it('starts with the Full HD preset, overlays hidden, no directory and no pending capture', () => {
    const state = useKeyframeCaptureStore.getState()
    expect(state.presetKey).toBe('fullHD')
    expect(state.width).toBe(1920)
    expect(state.height).toBe(1080)
    expect(state.hideOverlaysOnCapture).toBe(true)
    expect(state.directoryHandle).toBeNull()
    expect(state.pendingCapture).toBe(false)
    expect(state.lastCapturedFilename).toBeNull()
  })

  it('selectPreset switches width/height to the chosen preset', () => {
    useKeyframeCaptureStore.getState().selectPreset('square')
    const state = useKeyframeCaptureStore.getState()
    expect(state.presetKey).toBe('square')
    expect(state.width).toBe(1080)
    expect(state.height).toBe(1080)
  })

  it('selecting "custom" keeps the current width/height, now user-editable', () => {
    useKeyframeCaptureStore.getState().selectPreset('fourK')
    useKeyframeCaptureStore.getState().selectPreset('custom')
    const state = useKeyframeCaptureStore.getState()
    expect(state.presetKey).toBe('custom')
    expect(state.width).toBe(3840)
    expect(state.height).toBe(2160)
  })

  it('setWidth/setHeight only apply while a custom preset is selected, clamped to the documented range', () => {
    const { selectPreset, setWidth, setHeight } = useKeyframeCaptureStore.getState()
    selectPreset('custom')
    setWidth(50) // abaixo do mínimo
    setHeight(5000) // acima do teto de 4K
    expect(useKeyframeCaptureStore.getState().width).toBe(64)
    expect(useKeyframeCaptureStore.getState().height).toBe(3840)
  })

  it('setWidth/setHeight are ignored while a fixed preset is selected', () => {
    useKeyframeCaptureStore.getState().setWidth(999)
    expect(useKeyframeCaptureStore.getState().width).toBe(1920)
  })

  it('toggleHideOverlays flips the flag', () => {
    useKeyframeCaptureStore.getState().toggleHideOverlays()
    expect(useKeyframeCaptureStore.getState().hideOverlaysOnCapture).toBe(false)
  })

  it('setDirectoryHandle stores an arbitrary handle-like object', () => {
    const handle = { name: 'keyframes' } as unknown as FileSystemDirectoryHandle
    useKeyframeCaptureStore.getState().setDirectoryHandle(handle)
    expect(useKeyframeCaptureStore.getState().directoryHandle).toBe(handle)
  })

  it('requestCapture sets pendingCapture, clearPendingCapture resets it', () => {
    useKeyframeCaptureStore.getState().requestCapture()
    expect(useKeyframeCaptureStore.getState().pendingCapture).toBe(true)

    useKeyframeCaptureStore.getState().clearPendingCapture()
    expect(useKeyframeCaptureStore.getState().pendingCapture).toBe(false)
  })

  it('setLastCapturedFilename records feedback for the UI', () => {
    useKeyframeCaptureStore.getState().setLastCapturedFilename('Cena-1_kf001.png')
    expect(useKeyframeCaptureStore.getState().lastCapturedFilename).toBe('Cena-1_kf001.png')
  })

  it('exposes exactly the resolution presets declared in keyframe/constants.ts', () => {
    expect(KEYFRAME_RESOLUTION_PRESETS.map((p) => p.key)).toEqual(['fullHD', 'square', 'fourK'])
  })
})
