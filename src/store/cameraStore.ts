import { create } from 'zustand'
import type { OrthoPresetName } from '../scene/cameraPresets'
import { CAMERA_DEFAULTS } from '../scene/constants'
import { useFiguresStore, type CameraBookmark, type CameraProjection } from './figuresStore'

/**
 * Comando imperativo a ser executado uma única vez por `CameraRig.tsx` (a
 * única camada com acesso direto ao `THREE.Camera` ativo). O store só guarda
 * a intenção — quem move a câmera de fato é o rig, dentro do `<Canvas>`.
 */
export type CameraCommand =
  | { type: 'preset'; preset: OrthoPresetName }
  | { type: 'toPerspective' }
  | { type: 'applyBookmark'; id: string }
  | { type: 'requestSaveBookmark'; name: string }

export interface CameraState {
  fov: number
  projection: CameraProjection
  pendingCommand: CameraCommand | null
  setFov: (fov: number) => void
  applyPreset: (preset: OrthoPresetName) => void
  requestPerspective: () => void
  applyBookmark: (id: string) => void
  requestSaveBookmark: (name: string) => void
  clearPendingCommand: () => void
}

/**
 * Estado de navegação da câmera — FOV, projeção ativa e o comando pendente
 * do gizmo/painel para o `CameraRig`. Fica **fora** do histórico de undo
 * (como órbita/pan/zoom, ver PLANO.md); bookmarks salvos são conteúdo e
 * vivem em `figuresStore.ts`, que tem undo/redo (zundo).
 */
export const useCameraStore = create<CameraState>((set) => ({
  fov: CAMERA_DEFAULTS.fov,
  projection: 'perspective',
  pendingCommand: null,

  setFov: (fov) => set({ fov }),

  applyPreset: (preset) =>
    set({ projection: 'orthographic', pendingCommand: { type: 'preset', preset } }),

  requestPerspective: () =>
    set({ projection: 'perspective', pendingCommand: { type: 'toPerspective' } }),

  applyBookmark: (id) => {
    const bookmark = useFiguresStore.getState().cameraBookmarks.find((b) => b.id === id)
    set({
      ...(bookmark ? { projection: bookmark.projection } : {}),
      pendingCommand: { type: 'applyBookmark', id },
    })
  },

  requestSaveBookmark: (name) => set({ pendingCommand: { type: 'requestSaveBookmark', name } }),

  clearPendingCommand: () => set({ pendingCommand: null }),
}))

export type { CameraBookmark, CameraProjection }
