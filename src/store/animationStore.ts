import { create } from 'zustand'
import type { AnimationClipKey } from '../animation/animationClips'
import type { AnimationSample } from '../animation/animationSampler'
import type { OnionSkinMode } from '../animation/onionSkin'
import { DEFAULT_FPS, clampFps, type Fps } from '../animation/frameTimeline'
import {
  DEFAULT_OUTPUT_ASPECT,
  DEFAULT_VIDEO_QUALITY,
  outputResolutionFor,
  type OutputAspectKey,
  type OutputQualityKey,
} from '../snapshot/constants'

/**
 * Estado de FERRAMENTA do animador: qual animação está aberta, onde a linha do
 * tempo está, se está tocando, e a configuração e o andamento da exportação.
 *
 * O conteúdo — as animações e seus keyframes — vive no `figuresStore`, com
 * undo e autosave, como a biblioteca de poses (DECISOES.md #52). A divisão é a
 * mesma de sempre no projeto: conteúdo entra no histórico, navegação e
 * configuração de ferramenta não (ver PLANO.md > "Interação de pose", item 5).
 */

/** Comando executado uma única vez pelo `AnimationPlayer`, dentro do `<Canvas>`. */
export type AnimationCommand =
  /** Lê a câmera viva e captura um keyframe novo com a cena inteira. */
  | { type: 'captureKeyframe' }
  /**
   * Lê a câmera viva e acrescenta um trecho predefinido ao final da linha do
   * tempo. `figureAIds` é lista porque um trecho individual pode ser aplicado a
   * vários bonecos de uma vez (item 37); `label` é o rótulo do grupo que os
   * keyframes recebem (item 38).
   */
  | {
      type: 'appendClip'
      clipKey: AnimationClipKey
      figureAIds: string[]
      figureBId?: string
      label?: string
    }
  /**
   * Acrescenta um TRECHO SALVO pelo usuário (item 39) ao final da linha do
   * tempo. `casts` é a lista de elencos — um boneco por papel do trecho.
   */
  | { type: 'appendSavedClip'; clipId: string; casts: string[][]; label?: string }
  /** Regrava um keyframe existente com o estado atual. */
  | { type: 'updateKeyframe'; keyframeId: string }
  /** Põe a cena e a câmera no estado daquele keyframe, para poder ajustá-lo. */
  | { type: 'goToKeyframe'; keyframeId: string }
  /** Mostra o instante em que a linha do tempo parou, sem tocar na cena de trabalho. */
  | { type: 'seek' }
  /** Gera a miniatura de cada keyframe da animação de trabalho (item 30). */
  | { type: 'renderThumbnails' }
  /** Renderiza a animação quadro a quadro e grava o MP4. */
  | { type: 'exportVideo' }

export type ExportPhase = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

export interface AnimationUIState {
  /** Onde a linha do tempo está, em ms. */
  timeMs: number
  playing: boolean
  /**
   * Laço da reprodução NA TELA (item 27): chegar ao fim recomeça em vez de
   * parar. O vídeo exportado continua com uma passada só — o laço serve para
   * acertar um ciclo sem clicar em "Tocar" a cada volta.
   */
  repeat: boolean
  /**
   * Papel-cebola (item 31): desenha o keyframe anterior e o seguinte em
   * fantasma, para ajustar o atual sabendo de onde ele vem e para onde vai.
   *
   * Estado de FERRAMENTA, como `repeat`: fora do undo e fora do arquivo — é uma
   * ajuda de tela, não conteúdo da cena. E fica desligado por padrão, porque
   * dois bonecos translúcidos a mais atrapalham quem só está posando.
   */
  onionSkin: boolean
  /**
   * Quais vizinhos o papel-cebola mostra (pedido do usuário): os dois, só o
   * anterior ou só o seguinte.
   *
   * Fica SEPARADO do `onionSkin` de propósito. Ligar/desligar é o gesto
   * repetido — a caixa que já existia —, e a escolha de lado é uma preferência
   * que se faz uma vez e se mantém: juntar tudo num só campo de quatro valores
   * faria desligar e religar perder o lado escolhido.
   */
  onionSkinMode: OnionSkinMode
  /**
   * Qual keyframe está NA BANCADA (item 40): o último carregado na cena de
   * trabalho pelo "Ir para". O painel destaca o card dele e a régua marca o
   * instante — é a informação que falta na hora de clicar "Regravar" no card
   * certo.
   *
   * Não é derivado do instante de propósito. "Ir para" carrega o retrato do
   * keyframe na cena EDITÁVEL; arrastar a régua ou usar ⏮/⏭ só mexe na
   * pré-visualização. Derivar do `timeMs` faria a marca andar enquanto a cena
   * que se edita continuava sendo outra — exatamente o engano que este destaque
   * existe para evitar.
   *
   * Estado de FERRAMENTA, como `onionSkin`: fora do undo e fora do arquivo.
   */
  visitedKeyframeId: string | null
  fps: Fps
  /** Proporção do MP4 (fase 11.4) — as mesmas três da máscara; o vídeo não tem personalizada. */
  aspectKey: OutputAspectKey
  qualityKey: OutputQualityKey
  width: number
  height: number
  /**
   * A cena amostrada, quando o animador está no comando. O `Viewport`
   * renderiza isto no lugar dos bonecos do store — a cena de trabalho não é
   * tocada, então parar a reprodução devolve tudo intacto.
   */
  preview: AnimationSample | null
  pendingCommand: AnimationCommand | null
  exportPhase: ExportPhase
  exportedFrames: number
  exportTotalFrames: number
  exportErrorKey: string | null
  lastExportFilename: string | null
  cancelRequested: boolean

  /**
   * Volta a ferramenta ao começo: linha do tempo em zero, parada e sem
   * pré-visualização. É o que se faz ao ABRIR uma animação da biblioteca — o
   * que estava na tela era o retrato de outra linha do tempo.
   */
  resetTimeline: () => void
  setTimeMs: (timeMs: number) => void
  /** Arrastar a linha do tempo: anda até o instante E mostra o que há lá. */
  requestSeek: (timeMs: number) => void
  play: () => void
  pause: () => void
  setRepeat: (repeat: boolean) => void
  setOnionSkin: (onionSkin: boolean) => void
  setOnionSkinMode: (mode: OnionSkinMode) => void
  setFps: (fps: number) => void
  selectAspect: (key: OutputAspectKey) => void
  selectQuality: (key: OutputQualityKey) => void
  setPreview: (preview: AnimationSample | null) => void
  requestCaptureKeyframe: () => void
  requestAppendClip: (
    clipKey: AnimationClipKey,
    figureAIds: string[],
    figureBId?: string,
    label?: string,
  ) => void
  requestAppendSavedClip: (clipId: string, casts: string[][], label?: string) => void
  requestUpdateKeyframe: (keyframeId: string) => void
  /**
   * Leva a cena de trabalho para o retrato do keyframe E o playhead para o
   * instante dele. O instante vem de fora porque quem chama já o tem em mãos
   * (`keyframeStartTimesMs`), e assim a loja não precisa da animação.
   */
  requestGoToKeyframe: (keyframeId: string, timeMs: number) => void
  requestThumbnails: () => void
  requestExport: () => void
  clearPendingCommand: () => void
  startExport: (totalFrames: number) => void
  reportExportProgress: (rendered: number) => void
  finishExport: (filename: string) => void
  failExport: (errorKey: string) => void
  cancelExport: () => void
}

const initialResolution = outputResolutionFor(DEFAULT_OUTPUT_ASPECT, DEFAULT_VIDEO_QUALITY)

export const useAnimationStore = create<AnimationUIState>((set, get) => ({
  timeMs: 0,
  playing: false,
  repeat: false,
  onionSkin: false,
  onionSkinMode: 'both',
  visitedKeyframeId: null,
  fps: DEFAULT_FPS,
  aspectKey: DEFAULT_OUTPUT_ASPECT,
  qualityKey: DEFAULT_VIDEO_QUALITY,
  width: initialResolution.width,
  height: initialResolution.height,
  preview: null,
  pendingCommand: null,
  exportPhase: 'idle',
  exportedFrames: 0,
  exportTotalFrames: 0,
  exportErrorKey: null,
  lastExportFilename: null,
  cancelRequested: false,

  // Ids de keyframe são únicos DENTRO de uma animação: abrir outra da
  // biblioteca deixaria a marca do `k1` antigo em cima do `k1` novo. Mesma
  // razão que limpa o cache de miniaturas.
  resetTimeline: () => set({ timeMs: 0, playing: false, preview: null, visitedKeyframeId: null }),

  setTimeMs: (timeMs) => set({ timeMs: Math.max(0, timeMs) }),

  requestSeek: (timeMs) =>
    set({ timeMs: Math.max(0, timeMs), playing: false, pendingCommand: { type: 'seek' } }),

  play: () => set({ playing: true }),

  pause: () => set({ playing: false }),

  setRepeat: (repeat) => set({ repeat }),

  setOnionSkin: (onionSkin) => set({ onionSkin }),

  setOnionSkinMode: (onionSkinMode) => set({ onionSkinMode }),

  setFps: (fps) => set({ fps: clampFps(fps) }),

  selectAspect: (key) => set({ aspectKey: key, ...outputResolutionFor(key, get().qualityKey) }),

  selectQuality: (key) => set({ qualityKey: key, ...outputResolutionFor(get().aspectKey, key) }),

  setPreview: (preview) => set({ preview }),

  // Capturar sempre larga a pré-visualização: o retrato é da CENA DE TRABALHO,
  // e com a animação na tela o usuário estaria vendo uma coisa e gravando
  // outra.
  // E larga o destaque do "Ir para" (item 40): o keyframe novo entra no FIM, e
  // a bancada deixa de ser o retrato daquele que estava marcado.
  requestCaptureKeyframe: () =>
    set({
      playing: false,
      preview: null,
      visitedKeyframeId: null,
      pendingCommand: { type: 'captureKeyframe' },
    }),

  // Mesma regra da captura: o trecho congela a câmera VIVA em todos os
  // keyframes, então a pré-visualização sai da frente para o usuário ver
  // exatamente o enquadramento que vai ficar gravado.
  requestAppendClip: (clipKey, figureAIds, figureBId, label) =>
    set({
      playing: false,
      preview: null,
      pendingCommand: { type: 'appendClip', clipKey, figureAIds, figureBId, label },
    }),

  requestAppendSavedClip: (clipId, casts, label) =>
    set({
      playing: false,
      preview: null,
      pendingCommand: { type: 'appendSavedClip', clipId, casts, label },
    }),

  requestUpdateKeyframe: (keyframeId) =>
    set({ playing: false, preview: null, pendingCommand: { type: 'updateKeyframe', keyframeId } }),

  // O playhead ANDA JUNTO. Sem isso a régua marcava 0,0s enquanto a cena
  // mostrava o keyframe 3 — e o papel-cebola (item 31), que se ancora no
  // instante, desenhava os vizinhos do keyframe errado: os fantasmas caíam em
  // cima do próprio boneco, só deixando a cena lavada.
  //
  // E é aqui — e só aqui — que nasce o destaque do item 40: `visitedKeyframeId`
  // marca o keyframe que passou a ser a cena de trabalho. "Regravar" NÃO o
  // limpa, porque regravar reescreve o keyframe em que se está e continua-se
  // nele.
  requestGoToKeyframe: (keyframeId, timeMs) =>
    set({
      playing: false,
      timeMs,
      visitedKeyframeId: keyframeId,
      pendingCommand: { type: 'goToKeyframe', keyframeId },
    }),

  // As miniaturas são renderizadas a partir do RETRATO de cada keyframe, então
  // a pré-visualização é usada e devolvida pelo próprio player.
  requestThumbnails: () => set({ playing: false, pendingCommand: { type: 'renderThumbnails' } }),

  requestExport: () =>
    set({
      playing: false,
      cancelRequested: false,
      exportPhase: 'running',
      exportedFrames: 0,
      exportTotalFrames: 0,
      exportErrorKey: null,
      pendingCommand: { type: 'exportVideo' },
    }),

  clearPendingCommand: () => set({ pendingCommand: null }),

  startExport: (totalFrames) => set({ exportPhase: 'running', exportedFrames: 0, exportTotalFrames: totalFrames }),

  reportExportProgress: (rendered) => set({ exportedFrames: rendered }),

  finishExport: (filename) => set({ exportPhase: 'done', lastExportFilename: filename, preview: null }),

  failExport: (errorKey) => set({ exportPhase: 'error', exportErrorKey: errorKey, preview: null }),

  // Marca a intenção; quem interrompe de fato é o laço, entre um quadro e o
  // seguinte — abortar no meio de um quadro deixaria o codificador aberto.
  cancelExport: () => set({ cancelRequested: true, exportPhase: 'cancelled' }),
}))
