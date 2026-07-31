import { create } from 'zustand'
import type { OrthoPresetName } from '../scene/cameraPresets'
import {
  generateMoveEnd,
  type CameraViewState,
  type MoveGeneratorKey,
} from '../scene/cameraMove'
import { clampFocalLength, focalLengthToFov, fovToFocalLength } from '../scene/lens'
import {
  MAX_ROLL_DEG,
  type AngleKey,
  type CameraHeightKey,
  type OrientationKey,
  type ShotKey,
} from '../scene/shotFraming'
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
  /** Enquadra o boneco na tela (tecla `F`) — o rig mede a caixa real do boneco na cena. */
  | { type: 'frameFigure'; figureId: string }
  /** Aplica o tamanho de plano + ângulo atuais ao boneco selecionado (DECISOES.md #46). */
  | { type: 'applyShot' }
  /** Vista por cima do ombro: exige dois bonecos na cena. */
  | { type: 'applyOverTheShoulder' }
  /** Vista subjetiva: a câmera nos olhos do boneco selecionado (#50). */
  | { type: 'applyPov' }
  /** Enquadra o boneco selecionado com o vizinho mais próximo. */
  | { type: 'applyTwoShot' }
  /** Meia-volta no azimute, mantendo plano e ângulo — o contracampo. */
  | { type: 'applyReverseAngle' }
  /** Reaplica só o topo da tela, com a inclinação holandesa atual. */
  | { type: 'applyRoll' }
  /** Lê a câmera de cena e guarda como ponta A ou B do movimento. */
  | { type: 'captureMovePoint'; point: MovePoint }
  /** Põe a câmera no ponto do movimento indicado pelo slider. */
  | { type: 'applyMove' }
  /** Leva a câmera de cena para onde a vista de trabalho está olhando (fase 11). */
  | { type: 'placeCameraAtView' }

export type MovePoint = 'a' | 'b'

/**
 * O que o viewport mostra (fase 11): a bancada de trabalho (`edit`, navegação
 * livre por órbita/pan/zoom) ou o quadro da câmera de cena (`camera`, vista
 * travada — é o "olhar pela câmera" do Blender). O badge do viewport anuncia o
 * modo em vigor.
 */
export type CameraViewMode = 'edit' | 'camera'

/**
 * Um enquadramento inteiro, do jeito que o painel o monta: tamanho do plano,
 * de que altura se olha, de que lado e onde o sujeito fica no quadro. Vem tudo
 * junto porque a UI é de escolher e confirmar (DECISOES.md #51) — aplicar peça
 * por peça faria a câmera pular a cada troca antes de o usuário terminar.
 */
export interface FramingChoice {
  shot: ShotKey
  angle: AngleKey
  /** Quando presente, manda no `angle` — as duas dizem de que altura se olha. */
  cameraHeight: CameraHeightKey | null
  orientation: OrientationKey | null
  thirds: boolean
  leadRoom: boolean
}

export interface CameraState {
  fov: number
  /** Distância focal equivalente (full-frame) — o mesmo dado do `fov`, no vocabulário de quem fotografa. */
  focalMm: number
  projection: CameraProjection
  /** Tamanho de plano em vigor, ou `null` se a câmera está livre. */
  shot: ShotKey | null
  angle: AngleKey
  /** Altura fixa da câmera; quando escolhida, manda no `angle` (#50). */
  cameraHeight: CameraHeightKey | null
  /** Lado relativo ao boneco; quando escolhido, manda no lado de onde a câmera olhava. */
  orientation: OrientationKey | null
  /** Composição fora do centro. */
  thirds: boolean
  leadRoom: boolean
  /** Inclinação holandesa, em graus. */
  rollDeg: number
  moveA: CameraViewState | null
  moveB: CameraViewState | null
  moveT: number
  pendingCommand: CameraCommand | null
  /** Modo do viewport (fase 11): bancada de trabalho ou vista pela câmera de cena. */
  viewMode: CameraViewMode
  /** O gizmo da câmera de cena está selecionado (mover/girar com W/E)? Exclusivo com a seleção de boneco. */
  cameraSelected: boolean
  toggleViewMode: () => void
  setCameraSelected: (selected: boolean) => void
  /** Pede ao rig para levar a câmera de cena até a vista de trabalho atual. */
  requestPlaceCameraAtView: () => void
  setFov: (fov: number) => void
  setFocalLength: (focalMm: number) => void
  /**
   * Só sincroniza os números com uma câmera que já se moveu — sem reenquadrar.
   * É o que o animador usa: lá a lente vem do keyframe e já está aplicada na
   * câmera viva, e reenquadrar puxaria a câmera para fora da animação.
   */
  setFocalLengthQuietly: (focalMm: number) => void
  applyPreset: (preset: OrthoPresetName) => void
  requestPerspective: () => void
  applyBookmark: (id: string) => void
  requestSaveBookmark: (name: string) => void
  frameFigure: (figureId: string) => void
  applyShot: (shot: ShotKey) => void
  applyFraming: (framing: FramingChoice) => void
  applyOverTheShoulder: () => void
  applyPov: () => void
  applyTwoShot: () => void
  applyReverseAngle: () => void
  setRoll: (rollDeg: number) => void
  requestCaptureMovePoint: (point: MovePoint) => void
  setMovePoint: (point: MovePoint, view: CameraViewState) => void
  generateMove: (kind: MoveGeneratorKey) => void
  setMoveT: (t: number) => void
  clearMove: () => void
  canPlayMove: () => boolean
  clearPendingCommand: () => void
}

/**
 * Estado de navegação da câmera — lente, projeção, enquadramento, inclinação,
 * o movimento entre dois pontos e o comando pendente para o `CameraRig`. Fica
 * **fora** do histórico de undo (como órbita/pan/zoom, ver PLANO.md);
 * bookmarks salvos são conteúdo e vivem em `figuresStore.ts`, que tem
 * undo/redo (zundo).
 */
export const useCameraStore = create<CameraState>((set, get) => ({
  fov: CAMERA_DEFAULTS.fov,
  focalMm: fovToFocalLength(CAMERA_DEFAULTS.fov),
  projection: 'perspective',
  shot: null,
  angle: 'eyeLevel',
  cameraHeight: null,
  orientation: null,
  thirds: false,
  leadRoom: false,
  rollDeg: 0,
  moveA: null,
  moveB: null,
  moveT: 0,
  pendingCommand: null,
  viewMode: 'edit',
  cameraSelected: false,

  toggleViewMode: () => set((state) => ({ viewMode: state.viewMode === 'edit' ? 'camera' : 'edit' })),

  setCameraSelected: (cameraSelected) => set({ cameraSelected }),

  requestPlaceCameraAtView: () => set({ pendingCommand: { type: 'placeCameraAtView' } }),

  setFov: (fov) => set({ fov, focalMm: fovToFocalLength(fov) }),

  /**
   * Trocar a lente com um plano ativo REENQUADRA: a câmera se afasta ou se
   * aproxima o quanto for preciso para o mesmo trecho do corpo continuar
   * ocupando a tela. É isto que torna os milímetros previsíveis — 24 mm e
   * 85 mm no mesmo primeiro plano mudam a distorção do rosto, não o recorte.
   */
  setFocalLength: (focalMm) => {
    const focal = clampFocalLength(focalMm)
    set({
      focalMm: focal,
      fov: focalLengthToFov(focal),
      ...(get().shot ? { pendingCommand: { type: 'applyShot' } as CameraCommand } : {}),
    })
  },

  setFocalLengthQuietly: (focalMm) => {
    const focal = clampFocalLength(focalMm)
    set({ focalMm: focal, fov: focalLengthToFov(focal) })
  },

  // As vistas ortográficas são ferramenta do VIEWPORT (fase 11): aplicá-las
  // volta ao modo edição — no modo visão-câmera não haveria onde vê-las, já que
  // a câmera de cena é sempre perspectiva. O `shot` fica: ele descreve a câmera
  // de cena, que uma vista de trabalho não toca.
  applyPreset: (preset) =>
    set({ projection: 'orthographic', viewMode: 'edit', pendingCommand: { type: 'preset', preset } }),

  requestPerspective: () =>
    set({ projection: 'perspective', viewMode: 'edit', pendingCommand: { type: 'toPerspective' } }),

  applyBookmark: (id) => {
    const bookmark = useFiguresStore.getState().cameraBookmarks.find((b) => b.id === id)
    // Bookmark ortográfico é vista de TRABALHO e vale para o viewport (modo
    // edição); bookmark perspectivo vale para a câmera de cena, em qualquer
    // modo (fase 11).
    set({
      ...(bookmark ? { projection: bookmark.projection, fov: bookmark.fov, focalMm: fovToFocalLength(bookmark.fov) } : {}),
      ...(bookmark?.projection === 'orthographic' ? { viewMode: 'edit' as CameraViewMode } : { shot: null }),
      pendingCommand: { type: 'applyBookmark', id },
    })
  },

  requestSaveBookmark: (name) => set({ pendingCommand: { type: 'requestSaveBookmark', name } }),

  // Enquadrar (tecla F) é navegação da bancada: aproxima a VISTA DE TRABALHO
  // do boneco, então só faz sentido no modo edição — e não toca no `shot`, que
  // é da câmera de cena.
  frameFigure: (figureId) => set({ viewMode: 'edit', pendingCommand: { type: 'frameFigure', figureId } }),

  applyShot: (shot) => set({ shot, pendingCommand: { type: 'applyShot' } }),

  /** Comprometer o enquadramento inteiro de uma vez: um comando, um movimento. */
  applyFraming: (framing) =>
    set({
      shot: framing.shot,
      angle: framing.angle,
      // Altura e ângulo ocupam a mesma casa; guardar as duas deixaria o painel
      // mostrando duas escolhas em vigor e só uma valendo.
      cameraHeight: framing.cameraHeight,
      orientation: framing.orientation,
      thirds: framing.thirds,
      leadRoom: framing.leadRoom,
      pendingCommand: { type: 'applyShot' },
    }),

  applyOverTheShoulder: () => set({ shot: null, pendingCommand: { type: 'applyOverTheShoulder' } }),

  /** A vista subjetiva substitui o plano: quem enquadra é a cabeça do boneco. */
  applyPov: () => set({ shot: null, pendingCommand: { type: 'applyPov' } }),

  applyTwoShot: () => set({ pendingCommand: { type: 'applyTwoShot' } }),

  applyReverseAngle: () => set({ pendingCommand: { type: 'applyReverseAngle' } }),

  setRoll: (rollDeg) =>
    set({
      rollDeg: Math.min(MAX_ROLL_DEG, Math.max(-MAX_ROLL_DEG, rollDeg)),
      pendingCommand: { type: 'applyRoll' },
    }),

  requestCaptureMovePoint: (point) => set({ pendingCommand: { type: 'captureMovePoint', point } }),

  setMovePoint: (point, view) =>
    set(point === 'a' ? { moveA: view, moveT: 0 } : { moveB: view, moveT: 0 }),

  /**
   * Atalhos que geram a ponta B a partir da A. Sem A marcado não há de onde
   * sair — o botão simplesmente não faz nada (o painel o mantém desabilitado).
   */
  generateMove: (kind) => {
    const { moveA } = get()
    if (!moveA) return
    set({ moveB: generateMoveEnd(moveA, kind), moveT: 0, pendingCommand: { type: 'applyMove' } })
  },

  setMoveT: (t) => {
    const amount = Math.min(1, Math.max(0, t))
    if (!get().canPlayMove()) {
      set({ moveT: amount })
      return
    }
    set({ moveT: amount, shot: null, pendingCommand: { type: 'applyMove' } })
  },

  clearMove: () => set({ moveA: null, moveB: null, moveT: 0 }),

  canPlayMove: () => get().moveA !== null && get().moveB !== null,

  clearPendingCommand: () => set({ pendingCommand: null }),
}))

export type { CameraBookmark, CameraProjection }
