import { create } from 'zustand'
import {
  DEFAULT_RESOLUTION_PRESET,
  KEYFRAME_RESOLUTION_PRESETS,
  MAX_KEYFRAME_DIMENSION,
  MIN_KEYFRAME_DIMENSION,
  type ResolutionPresetKey,
} from '../keyframe/constants'

function clampDimension(value: number): number {
  return Math.min(MAX_KEYFRAME_DIMENSION, Math.max(MIN_KEYFRAME_DIMENSION, Math.round(value)))
}

function resolutionFor(key: ResolutionPresetKey, fallback: { width: number; height: number }) {
  const preset = KEYFRAME_RESOLUTION_PRESETS.find((p) => p.key === key)
  return preset ? { width: preset.width, height: preset.height } : fallback
}

export interface KeyframeCaptureState {
  presetKey: ResolutionPresetKey
  width: number
  height: number
  hideOverlaysOnCapture: boolean
  /** Pasta de destino escolhida via File System Access API — só dura a sessão (ver PLANO.md). */
  directoryHandle: FileSystemDirectoryHandle | null
  /** Sinaliza para o `KeyframeCapture` (dentro do `<Canvas>`) que uma captura foi pedida. */
  pendingCapture: boolean
  lastCapturedFilename: string | null
  selectPreset: (key: ResolutionPresetKey) => void
  setWidth: (width: number) => void
  setHeight: (height: number) => void
  toggleHideOverlays: () => void
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void
  requestCapture: () => void
  clearPendingCapture: () => void
  setLastCapturedFilename: (name: string | null) => void
}

const initialResolution = resolutionFor(DEFAULT_RESOLUTION_PRESET, { width: 1920, height: 1080 })

/**
 * Configurações de captura de keyframe (resolução, ocultar overlays, pasta
 * de destino) e o gatilho de captura. Fora do histórico de undo — é
 * configuração de ferramenta/sessão, não edição de conteúdo da cena (ver
 * PLANO.md > "Interação de pose", item 5, e DECISOES.md #8).
 */
export const useKeyframeCaptureStore = create<KeyframeCaptureState>((set, get) => ({
  presetKey: DEFAULT_RESOLUTION_PRESET,
  width: initialResolution.width,
  height: initialResolution.height,
  hideOverlaysOnCapture: true,
  directoryHandle: null,
  pendingCapture: false,
  lastCapturedFilename: null,

  selectPreset: (key) => {
    const { width, height } = get()
    set({ presetKey: key, ...resolutionFor(key, { width, height }) })
  },

  setWidth: (width) => {
    if (get().presetKey !== 'custom') return
    set({ width: clampDimension(width) })
  },

  setHeight: (height) => {
    if (get().presetKey !== 'custom') return
    set({ height: clampDimension(height) })
  },

  toggleHideOverlays: () => set((state) => ({ hideOverlaysOnCapture: !state.hideOverlaysOnCapture })),

  setDirectoryHandle: (handle) => set({ directoryHandle: handle }),

  requestCapture: () => set({ pendingCapture: true }),

  clearPendingCapture: () => set({ pendingCapture: false }),

  setLastCapturedFilename: (name) => set({ lastCapturedFilename: name }),
}))
