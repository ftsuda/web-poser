import { create } from 'zustand'
import { POSE_MARK_SEQUENCE, type PoseMark, type PoseMarkKey } from '../pose-import/markedPose'
import { clampPhotoView, type PhotoView } from '../scene/referencePhotoView'

/**
 * A foto de referência (item 7) e a máquina de marcação de pose sobre ela
 * (PLANO.md > "Pose por marcação manual").
 *
 * **Estado de FERRAMENTA, só sessão** (decisão do usuário): fora do undo,
 * fora do arquivo, fora até do `localStorage` — recarregar a página perde a
 * foto, e é assim que deve ser (a foto pode pesar megabytes; o que persiste é
 * o RESULTADO, a pose aplicada no boneco). Um store só, compartilhado pelas
 * duas cascas: a foto sobrevive à troca desktop ↔ módulo de poses (#92).
 *
 * A URL é um object URL do arquivo local escolhido — revogada ao trocar ou
 * limpar, senão cada foto carregada seguraria a anterior na memória.
 */

interface ReferenceImageState {
  /** Object URL da referência; `null` = sem referência (o overlay não renderiza nada). */
  imageUrl: string | null
  imageName: string | null
  /** Foto ou vídeo — o MESMO papel vegetal; o vídeo só ganha os controles de frame. */
  kind: 'image' | 'video'
  /** Largura/altura natural da referência — medida pela camada no load; 1 até lá. */
  aspect: number
  /** Opacidade do "papel vegetal" — a foto fica POR CIMA da cena, semitransparente. */
  opacity: number
  imageVisible: boolean

  /** Zoom da foto sobre o ajuste "contain" (1 = enquadramento natural). */
  photoZoom: number
  /** Deslocamento da foto, em frações do retângulo base (ver `referencePhotoView`). */
  photoOffsetX: number
  photoOffsetY: number
  /** Modo "ajustar foto": arrasto move, pinça/roda ampliam — exclusivo com `marking`. */
  adjusting: boolean

  /** Passo do frame (1/fps): seletor do painel, ajustado pela medição automática. */
  videoFps: number
  /** O usuário escolheu o fps à mão — a medição automática não sobrescreve. */
  videoFpsManual: boolean
  /** Espelho da reprodução: o overlay escreve (eventos do `<video>`), os controles leem. */
  videoTime: number
  videoDuration: number
  videoPlaying: boolean

  /** Modo de marcação ligado: o overlay captura os toques e a órbita não os vê. */
  marking: boolean
  marks: Partial<Record<PoseMarkKey, PoseMark>>
  /** Pontos OPCIONAIS que o usuário pulou — saem da fila sem ganhar marca. */
  skippedKeys: PoseMarkKey[]
  /**
   * O CURSOR da marcação (#115.1): a junta corrente, a que o toque na foto
   * marca e a que o painel nomeia junto com a profundidade dela. Não anda
   * sozinho — quem anda é o usuário, por "Anterior"/"Próximo" (ou tocando um
   * marcador já posto). `null` fora do modo de marcação.
   */
  selectedMarkKey: PoseMarkKey | null

  setImage: (url: string, name: string, kind?: 'image' | 'video') => void
  clearImage: () => void
  setAspect: (aspect: number) => void
  setOpacity: (opacity: number) => void
  toggleImageVisible: () => void

  /** Escolha MANUAL do fps (seletor) — passa a valer sobre a medição. */
  setVideoFps: (fps: number) => void
  /** Medição automática (`requestVideoFrameCallback`) — só vale sem escolha manual. */
  measureVideoFps: (fps: number) => void
  syncVideoPlayback: (playback: { time: number; duration: number; playing: boolean }) => void

  /** Vista inteira (gestos: pinça compõe zoom + deslocamento numa mudança só). */
  setPhotoView: (view: PhotoView) => void
  /** Só o zoom (slider do painel) — o deslocamento fica, regrampeado se preciso. */
  setPhotoZoom: (zoom: number) => void
  resetPhotoView: () => void
  startAdjusting: () => void
  stopAdjusting: () => void

  startMarking: () => void
  stopMarking: () => void
  /** Marca (ou corrige) o ponto CORRENTE nas coordenadas dadas (normalizadas da foto). */
  placeMark: (x: number, y: number) => void
  moveMark: (key: PoseMarkKey, x: number, y: number) => void
  removeMark: (key: PoseMarkKey) => void
  /** Anda com o cursor na sequência guiada, parando nas pontas. */
  moveMarkCursor: (direction: 1 | -1) => void
  /** Pula o ponto corrente — só se for opcional — e passa ao seguinte. */
  skipMarkAtCursor: () => void
  selectMark: (key: PoseMarkKey | null) => void
  setMarkDepth: (key: PoseMarkKey, depth: 'front' | 'back' | null) => void
  clearMarks: () => void
}

/** O próximo ponto da sequência guiada ainda sem marca e não pulado; `null` = tudo marcado. */
export function nextMarkStep(state: {
  marks: Partial<Record<PoseMarkKey, PoseMark>>
  skippedKeys: readonly PoseMarkKey[]
}): { key: PoseMarkKey; optional: boolean } | null {
  return (
    POSE_MARK_SEQUENCE.find(
      (step) => !state.marks[step.key] && !state.skippedKeys.includes(step.key),
    ) ?? null
  )
}

function revokeUrl(url: string | null): void {
  if (url && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url)
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Estado de vídeo no ponto de partida — vale para foto (inerte) e vídeo novo. */
const VIDEO_RESET = {
  videoFps: 30,
  videoFpsManual: false,
  videoTime: 0,
  videoDuration: 0,
  videoPlaying: false,
} as const

export const useReferenceImageStore = create<ReferenceImageState>()((set, get) => ({
  imageUrl: null,
  imageName: null,
  kind: 'image',
  aspect: 1,
  opacity: 0.5,
  imageVisible: true,
  photoZoom: 1,
  photoOffsetX: 0,
  photoOffsetY: 0,
  adjusting: false,
  ...VIDEO_RESET,
  marking: false,
  marks: {},
  skippedKeys: [],
  selectedMarkKey: null,

  setImage: (url, name, kind = 'image') => {
    revokeUrl(get().imageUrl)
    // Referência nova, marcação do zero: as marcas da anterior apontavam para
    // outra imagem — reaproveitá-las marcaria juntas em lugares aleatórios.
    // A vista e o estado de vídeo também zeram: eram DAQUELA referência.
    set({
      imageUrl: url,
      imageName: name,
      kind,
      aspect: 1,
      imageVisible: true,
      photoZoom: 1,
      photoOffsetX: 0,
      photoOffsetY: 0,
      adjusting: false,
      ...VIDEO_RESET,
      marking: false,
      marks: {},
      skippedKeys: [],
      selectedMarkKey: null,
    })
  },

  clearImage: () => {
    revokeUrl(get().imageUrl)
    set({
      imageUrl: null,
      imageName: null,
      kind: 'image',
      aspect: 1,
      photoZoom: 1,
      photoOffsetX: 0,
      photoOffsetY: 0,
      adjusting: false,
      ...VIDEO_RESET,
      marking: false,
      marks: {},
      skippedKeys: [],
      selectedMarkKey: null,
    })
  },

  setAspect: (aspect) => {
    if (!Number.isFinite(aspect) || aspect <= 0) return
    set({ aspect })
  },

  setOpacity: (opacity) => {
    if (!Number.isFinite(opacity)) return
    set({ opacity: Math.min(1, Math.max(0.05, opacity)) })
  },

  toggleImageVisible: () => set((state) => ({ imageVisible: !state.imageVisible })),

  setVideoFps: (fps) => {
    if (!Number.isFinite(fps) || fps <= 0) return
    set({ videoFps: Math.min(240, Math.max(1, fps)), videoFpsManual: true })
  },

  measureVideoFps: (fps) => {
    if (!Number.isFinite(fps) || fps <= 0 || get().videoFpsManual) return
    set({ videoFps: Math.min(240, Math.max(1, fps)) })
  },

  syncVideoPlayback: ({ time, duration, playing }) => {
    set({
      videoTime: Number.isFinite(time) ? time : 0,
      videoDuration: Number.isFinite(duration) ? duration : 0,
      videoPlaying: playing,
    })
  },

  setPhotoView: (view) => {
    const clamped = clampPhotoView(view)
    set({ photoZoom: clamped.zoom, photoOffsetX: clamped.offsetX, photoOffsetY: clamped.offsetY })
  },

  setPhotoZoom: (zoom) => {
    if (!Number.isFinite(zoom)) return
    const state = get()
    state.setPhotoView({ zoom, offsetX: state.photoOffsetX, offsetY: state.photoOffsetY })
  },

  resetPhotoView: () => set({ photoZoom: 1, photoOffsetX: 0, photoOffsetY: 0 }),

  startAdjusting: () => {
    if (!get().imageUrl) return
    // Exclusivo com a marcação: cada modo dá um sentido próprio aos toques.
    set({ adjusting: true, marking: false, selectedMarkKey: null })
  },

  stopAdjusting: () => set({ adjusting: false }),

  startMarking: () => {
    const state = get()
    if (!state.imageUrl) return
    // O cursor começa no primeiro ponto pendente (tudo marcado: no primeiro).
    set({
      marking: true,
      adjusting: false,
      selectedMarkKey: nextMarkStep(state)?.key ?? POSE_MARK_SEQUENCE[0].key,
    })
  },

  stopMarking: () => set({ marking: false, selectedMarkKey: null }),

  placeMark: (x, y) => {
    set((state) => {
      if (!state.imageUrl || !state.marking) return {}
      // O toque marca o ponto CORRENTE, e o cursor FICA nele (#115.1) — é o
      // que mantém o nome e a profundidade do painel na junta recém-marcada.
      // Sem cursor (marcação forçada por `setState`), vale a fila.
      const key = state.selectedMarkKey ?? nextMarkStep(state)?.key
      if (!key) return {}
      return {
        marks: { ...state.marks, [key]: { ...state.marks[key], x: clamp01(x), y: clamp01(y) } },
        // Marcar um ponto pulado o traz de volta: agora ele tem marca.
        skippedKeys: state.skippedKeys.filter((candidate) => candidate !== key),
        selectedMarkKey: key,
      }
    })
  },

  moveMarkCursor: (direction) => {
    set((state) => {
      const current = state.selectedMarkKey ?? nextMarkStep(state)?.key ?? POSE_MARK_SEQUENCE[0].key
      const index = POSE_MARK_SEQUENCE.findIndex((step) => step.key === current)
      const target = Math.min(POSE_MARK_SEQUENCE.length - 1, Math.max(0, index + direction))
      return { selectedMarkKey: POSE_MARK_SEQUENCE[target].key }
    })
  },

  moveMark: (key, x, y) => {
    set((state) => {
      const mark = state.marks[key]
      if (!mark) return {}
      return { marks: { ...state.marks, [key]: { ...mark, x: clamp01(x), y: clamp01(y) } } }
    })
  },

  removeMark: (key) => {
    set((state) => {
      if (!state.marks[key]) return {}
      const marks = { ...state.marks }
      delete marks[key]
      // O cursor fica onde está: apagar a marca é para remarcá-la ali mesmo.
      return {
        marks,
        skippedKeys: state.skippedKeys.filter((candidate) => candidate !== key),
      }
    })
  },

  skipMarkAtCursor: () => {
    set((state) => {
      const current = state.selectedMarkKey ?? nextMarkStep(state)?.key
      const step = POSE_MARK_SEQUENCE.find((candidate) => candidate.key === current)
      if (!step?.optional || state.marks[step.key]) return {}
      const index = POSE_MARK_SEQUENCE.indexOf(step)
      return {
        skippedKeys: state.skippedKeys.includes(step.key)
          ? state.skippedKeys
          : [...state.skippedKeys, step.key],
        selectedMarkKey: POSE_MARK_SEQUENCE[Math.min(POSE_MARK_SEQUENCE.length - 1, index + 1)].key,
      }
    })
  },

  selectMark: (key) => set({ selectedMarkKey: key }),

  setMarkDepth: (key, depth) => {
    set((state) => {
      const mark = state.marks[key]
      if (!mark) return {}
      const next: PoseMark = { x: mark.x, y: mark.y, ...(depth ? { depth } : {}) }
      return { marks: { ...state.marks, [key]: next } }
    })
  },

  clearMarks: () => set({ marks: {}, skippedKeys: [], selectedMarkKey: null }),
}))
