import { beforeEach, describe, expect, it } from 'vitest'
import { OUTPUT_ASPECT_KEYS, OUTPUT_QUALITY_KEYS, outputResolutionFor } from '../../snapshot/constants'
import { useSnapshotCaptureStore } from '../snapshotCaptureStore'

describe('snapshotCaptureStore', () => {
  beforeEach(() => {
    useSnapshotCaptureStore.setState(useSnapshotCaptureStore.getInitialState())
  })

  it('starts at 16:9 in 1080p, overlays hidden, no directory and no pending capture', () => {
    const state = useSnapshotCaptureStore.getState()
    expect(state.aspectKey).toBe('wide')
    expect(state.qualityKey).toBe('1080p')
    expect(state.width).toBe(1920)
    expect(state.height).toBe(1080)
    expect(state.hideOverlaysOnCapture).toBe(true)
    expect(state.directoryHandle).toBeNull()
    expect(state.pendingCapture).toBe(false)
    expect(state.lastCapturedFilename).toBeNull()
  })

  it('selectAspect keeps the quality and switches width/height', () => {
    useSnapshotCaptureStore.getState().selectAspect('vertical')
    let state = useSnapshotCaptureStore.getState()
    expect(state.aspectKey).toBe('vertical')
    expect(state.width).toBe(1080)
    expect(state.height).toBe(1920)

    useSnapshotCaptureStore.getState().selectAspect('square')
    state = useSnapshotCaptureStore.getState()
    expect(state.width).toBe(1080)
    expect(state.height).toBe(1080)
  })

  it('selectQuality keeps the aspect: every ratio records in 1080p AND 720p (fase 11.4)', () => {
    useSnapshotCaptureStore.getState().selectAspect('vertical')
    useSnapshotCaptureStore.getState().selectQuality('720p')
    const state = useSnapshotCaptureStore.getState()
    expect(state.aspectKey).toBe('vertical')
    expect(state.qualityKey).toBe('720p')
    expect(state.width).toBe(720)
    expect(state.height).toBe(1280)
  })

  it('selecting "custom" keeps the current width/height, now user-editable', () => {
    useSnapshotCaptureStore.getState().selectAspect('square')
    useSnapshotCaptureStore.getState().selectAspect('custom')
    const state = useSnapshotCaptureStore.getState()
    expect(state.aspectKey).toBe('custom')
    expect(state.width).toBe(1080)
    expect(state.height).toBe(1080)
  })

  it('setWidth/setHeight only apply on the custom aspect, clamped to the documented range', () => {
    const { selectAspect, setWidth, setHeight } = useSnapshotCaptureStore.getState()
    selectAspect('custom')
    setWidth(50) // abaixo do mínimo
    setHeight(5000) // acima do teto
    expect(useSnapshotCaptureStore.getState().width).toBe(64)
    expect(useSnapshotCaptureStore.getState().height).toBe(3840)
  })

  it('setWidth/setHeight are ignored while a fixed aspect is selected', () => {
    useSnapshotCaptureStore.getState().setWidth(999)
    expect(useSnapshotCaptureStore.getState().width).toBe(1920)
  })

  it('leaving custom recomputes the resolution from aspect × quality', () => {
    const { selectAspect, setWidth } = useSnapshotCaptureStore.getState()
    selectAspect('custom')
    setWidth(999)
    useSnapshotCaptureStore.getState().selectAspect('wide')
    expect(useSnapshotCaptureStore.getState().width).toBe(1920)
    expect(useSnapshotCaptureStore.getState().height).toBe(1080)
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
})

/**
 * A tabela proporção × qualidade (fase 11.4): três proporções — as mesmas da
 * máscara — e todas gravando em 1080p e 720p. A qualidade nomeia o lado MENOR,
 * como nos players; o 4K saiu por decisão do usuário.
 */
describe('outputResolutionFor', () => {
  it('cobre as seis combinações, com o lado menor dando o nome à qualidade', () => {
    expect(outputResolutionFor('wide', '1080p')).toEqual({ width: 1920, height: 1080 })
    expect(outputResolutionFor('wide', '720p')).toEqual({ width: 1280, height: 720 })
    expect(outputResolutionFor('vertical', '1080p')).toEqual({ width: 1080, height: 1920 })
    expect(outputResolutionFor('vertical', '720p')).toEqual({ width: 720, height: 1280 })
    expect(outputResolutionFor('square', '1080p')).toEqual({ width: 1080, height: 1080 })
    expect(outputResolutionFor('square', '720p')).toEqual({ width: 720, height: 720 })
  })

  it('as chaves declaradas são exatamente três proporções e duas qualidades', () => {
    expect([...OUTPUT_ASPECT_KEYS]).toEqual(['wide', 'vertical', 'square'])
    expect([...OUTPUT_QUALITY_KEYS]).toEqual(['1080p', '720p'])
  })
})
