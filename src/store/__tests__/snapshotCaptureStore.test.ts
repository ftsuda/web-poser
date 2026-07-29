import { beforeEach, describe, expect, it } from 'vitest'
import { SNAPSHOT_RESOLUTION_PRESETS } from '../../snapshot/constants'
import { useSnapshotCaptureStore } from '../snapshotCaptureStore'

describe('snapshotCaptureStore', () => {
  beforeEach(() => {
    useSnapshotCaptureStore.setState(useSnapshotCaptureStore.getInitialState())
  })

  it('starts with the Full HD preset, overlays hidden, no directory and no pending capture', () => {
    const state = useSnapshotCaptureStore.getState()
    expect(state.presetKey).toBe('fullHD')
    expect(state.width).toBe(1920)
    expect(state.height).toBe(1080)
    expect(state.hideOverlaysOnCapture).toBe(true)
    expect(state.directoryHandle).toBeNull()
    expect(state.pendingCapture).toBe(false)
    expect(state.lastCapturedFilename).toBeNull()
  })

  it('selectPreset switches width/height to the chosen preset', () => {
    useSnapshotCaptureStore.getState().selectPreset('square')
    const state = useSnapshotCaptureStore.getState()
    expect(state.presetKey).toBe('square')
    expect(state.width).toBe(1080)
    expect(state.height).toBe(1080)
  })

  it('selecting "custom" keeps the current width/height, now user-editable', () => {
    useSnapshotCaptureStore.getState().selectPreset('fourK')
    useSnapshotCaptureStore.getState().selectPreset('custom')
    const state = useSnapshotCaptureStore.getState()
    expect(state.presetKey).toBe('custom')
    expect(state.width).toBe(3840)
    expect(state.height).toBe(2160)
  })

  it('setWidth/setHeight only apply while a custom preset is selected, clamped to the documented range', () => {
    const { selectPreset, setWidth, setHeight } = useSnapshotCaptureStore.getState()
    selectPreset('custom')
    setWidth(50) // abaixo do mínimo
    setHeight(5000) // acima do teto de 4K
    expect(useSnapshotCaptureStore.getState().width).toBe(64)
    expect(useSnapshotCaptureStore.getState().height).toBe(3840)
  })

  it('setWidth/setHeight are ignored while a fixed preset is selected', () => {
    useSnapshotCaptureStore.getState().setWidth(999)
    expect(useSnapshotCaptureStore.getState().width).toBe(1920)
  })

  it('toggleHideOverlays flips the flag', () => {
    useSnapshotCaptureStore.getState().toggleHideOverlays()
    expect(useSnapshotCaptureStore.getState().hideOverlaysOnCapture).toBe(false)
  })

  it('setDirectoryHandle stores an arbitrary handle-like object', () => {
    const handle = { name: 'keyframes' } as unknown as FileSystemDirectoryHandle
    useSnapshotCaptureStore.getState().setDirectoryHandle(handle)
    expect(useSnapshotCaptureStore.getState().directoryHandle).toBe(handle)
  })

  it('requestCapture sets pendingCapture, clearPendingCapture resets it', () => {
    useSnapshotCaptureStore.getState().requestCapture()
    expect(useSnapshotCaptureStore.getState().pendingCapture).toBe(true)

    useSnapshotCaptureStore.getState().clearPendingCapture()
    expect(useSnapshotCaptureStore.getState().pendingCapture).toBe(false)
  })

  it('setLastCapturedFilename records feedback for the UI', () => {
    useSnapshotCaptureStore.getState().setLastCapturedFilename('Cena-1_kf001.png')
    expect(useSnapshotCaptureStore.getState().lastCapturedFilename).toBe('Cena-1_kf001.png')
  })

  it('exposes exactly the resolution presets declared in snapshot/constants.ts', () => {
    expect(SNAPSHOT_RESOLUTION_PRESETS.map((p) => p.key)).toEqual(['hd720', 'fullHD', 'square', 'fourK'])
  })

  it('o instantâneo continua nascendo em Full HD — quem passou a 720p foi o vídeo', () => {
    expect(useSnapshotCaptureStore.getState().presetKey).toBe('fullHD')
    expect(useSnapshotCaptureStore.getState().width).toBe(1920)
  })
})
