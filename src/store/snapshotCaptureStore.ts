import { create } from 'zustand'
import {
  DEFAULT_OUTPUT_ASPECT,
  DEFAULT_SNAPSHOT_QUALITY,
  MAX_SNAPSHOT_DIMENSION,
  MIN_SNAPSHOT_DIMENSION,
  outputResolutionFor,
  type OutputAspectChoice,
  type OutputQualityKey,
} from '../snapshot/constants'

function clampDimension(value: number): number {
  return Math.min(MAX_SNAPSHOT_DIMENSION, Math.max(MIN_SNAPSHOT_DIMENSION, Math.round(value)))
}

export interface SnapshotCaptureState {
  /** Proporção do PNG (fase 11.4) — as mesmas três da máscara, ou personalizada. */
  aspectKey: OutputAspectChoice
  /** 1080p ou 720p — ignorada (e desabilitada na UI) na proporção personalizada. */
  qualityKey: OutputQualityKey
  width: number
  height: number
  hideOverlaysOnCapture: boolean
  /** Pasta de destino escolhida via File System Access API — só dura a sessão (ver PLANO.md). */
  directoryHandle: FileSystemDirectoryHandle | null
  /** Sinaliza para o `SnapshotCapture` (dentro do `<Canvas>`) que uma captura foi pedida. */
  pendingCapture: boolean
  lastCapturedFilename: string | null
  selectAspect: (key: OutputAspectChoice) => void
  selectQuality: (key: OutputQualityKey) => void
  setWidth: (width: number) => void
  setHeight: (height: number) => void
  toggleHideOverlays: () => void
  setDirectoryHandle: (handle: FileSystemDirectoryHandle | null) => void
  requestCapture: () => void
  clearPendingCapture: () => void
  setLastCapturedFilename: (name: string | null) => void
}

const initialResolution = outputResolutionFor(DEFAULT_OUTPUT_ASPECT, DEFAULT_SNAPSHOT_QUALITY)

/**
 * Configurações de captura de instantâneo (proporção × qualidade, ocultar
 * overlays, pasta de destino) e o gatilho de captura. Fora do histórico de
 * undo — é configuração de ferramenta/sessão, não edição de conteúdo da cena
 * (ver PLANO.md > "Interação de pose", item 5, e DECISOES.md #8).
 */
export const useSnapshotCaptureStore = create<SnapshotCaptureState>((set, get) => ({
  aspectKey: DEFAULT_OUTPUT_ASPECT,
  qualityKey: DEFAULT_SNAPSHOT_QUALITY,
  width: initialResolution.width,
  height: initialResolution.height,
  hideOverlaysOnCapture: true,
  directoryHandle: null,
  pendingCapture: false,
  lastCapturedFilename: null,

  // Trocar para a personalizada PRESERVA a resolução em vigor — é o ponto de
  // partida do ajuste fino, não um reset.
  selectAspect: (key) => {
    const { qualityKey } = get()
    set({ aspectKey: key, ...(key === 'custom' ? {} : outputResolutionFor(key, qualityKey)) })
  },

  selectQuality: (key) => {
    const { aspectKey } = get()
    set({ qualityKey: key, ...(aspectKey === 'custom' ? {} : outputResolutionFor(aspectKey, key)) })
  },

  setWidth: (width) => {
    if (get().aspectKey !== 'custom') return
    set({ width: clampDimension(width) })
  },

  setHeight: (height) => {
    if (get().aspectKey !== 'custom') return
    set({ height: clampDimension(height) })
  },

  toggleHideOverlays: () => set((state) => ({ hideOverlaysOnCapture: !state.hideOverlaysOnCapture })),

  setDirectoryHandle: (handle) => set({ directoryHandle: handle }),

  requestCapture: () => set({ pendingCapture: true }),

  clearPendingCapture: () => set({ pendingCapture: false }),

  setLastCapturedFilename: (name) => set({ lastCapturedFilename: name }),
}))
