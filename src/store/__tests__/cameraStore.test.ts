import { beforeEach, describe, expect, it } from 'vitest'
import { CAMERA_DEFAULTS } from '../../scene/constants'
import { useCameraStore } from '../cameraStore'
import { useFiguresStore } from '../figuresStore'

describe('cameraStore', () => {
  beforeEach(() => {
    useCameraStore.setState(useCameraStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('starts in perspective with the default FOV and no bookmarks pending', () => {
    const state = useCameraStore.getState()
    expect(state.projection).toBe('perspective')
    expect(state.fov).toBe(CAMERA_DEFAULTS.fov)
    expect(state.pendingCommand).toBeNull()
  })

  it('updates the FOV directly, without a pending command (reactive prop, not an imperative move)', () => {
    useCameraStore.getState().setFov(70)
    expect(useCameraStore.getState().fov).toBe(70)
    expect(useCameraStore.getState().pendingCommand).toBeNull()
  })

  it('applying a preset switches to orthographic projection and queues a "preset" command', () => {
    useCameraStore.getState().applyPreset('front')
    const state = useCameraStore.getState()
    expect(state.projection).toBe('orthographic')
    expect(state.pendingCommand).toEqual({ type: 'preset', preset: 'front' })
  })

  it('requesting perspective switches projection back and queues a "toPerspective" command', () => {
    useCameraStore.getState().applyPreset('top')
    useCameraStore.getState().requestPerspective()
    const state = useCameraStore.getState()
    expect(state.projection).toBe('perspective')
    expect(state.pendingCommand).toEqual({ type: 'toPerspective' })
  })

  it('applying a bookmark switches to its saved projection and queues an "applyBookmark" command', () => {
    const id = useFiguresStore.getState().addCameraBookmark({
      name: 'Plano geral',
      position: [3, 2, 4],
      target: [0, 1, 0],
      projection: 'orthographic',
      fov: 50,
      zoom: 80,
    })

    useCameraStore.getState().applyBookmark(id)
    const state = useCameraStore.getState()
    expect(state.projection).toBe('orthographic')
    expect(state.pendingCommand).toEqual({ type: 'applyBookmark', id })
  })

  it('applying an unknown bookmark id leaves projection untouched but still queues the command (CameraRig no-ops)', () => {
    useCameraStore.getState().applyBookmark('does-not-exist')
    const state = useCameraStore.getState()
    expect(state.projection).toBe('perspective')
    expect(state.pendingCommand).toEqual({ type: 'applyBookmark', id: 'does-not-exist' })
  })

  it('requesting to save a bookmark queues a "requestSaveBookmark" command without touching projection', () => {
    useCameraStore.getState().requestSaveBookmark('Plano geral')
    const state = useCameraStore.getState()
    expect(state.projection).toBe('perspective')
    expect(state.pendingCommand).toEqual({ type: 'requestSaveBookmark', name: 'Plano geral' })
  })

  it('clears the pending command once handled', () => {
    useCameraStore.getState().applyPreset('front')
    useCameraStore.getState().clearPendingCommand()
    expect(useCameraStore.getState().pendingCommand).toBeNull()
  })
})
