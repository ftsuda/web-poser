import { create } from 'zustand'
import { stepViewKey, type PosesViewKey } from '../poses/posesViews'

/**
 * Estado de FERRAMENTA do módulo de poses (item 44): qual vista está na tela,
 * qual aba do painel está aberta e se os bonecos que não estão em edição
 * ficam escondidos da bancada.
 *
 * Store próprio, fora do `uiStore` (fronteira decidida no plano: a casca de
 * toque não escreve no estado da casca completa) e fora do undo — trocar de
 * vista é navegação, não conteúdo, como a órbita da câmera no desktop. O
 * boneco e a junta selecionados NÃO moram aqui: são os mesmos
 * `selectedFigureId`/`selectedJointName` do `figuresStore`, porque só uma
 * casca vive por carregamento e as ações que respeitam seleção já leem de lá.
 */

export type PosesTabKey = 'joint' | 'symmetry' | 'figures' | 'keyframes' | 'file'

/** Ordem das abas (pedido do usuário, 2026-07-31): Boneco, Junta, Simetria, Keyframes, Arquivos. */
export const POSES_TAB_KEYS: readonly PosesTabKey[] = [
  'figures',
  'joint',
  'symmetry',
  'keyframes',
  'file',
]

export interface PosesShellState {
  viewKey: PosesViewKey
  activeTab: PosesTabKey
  /**
   * Mostrar só o boneco em edição (PLANO.md, item 44). É um FILTRO DE TELA do
   * módulo, não o `visible` do boneco: o keyframe grava `visible` como
   * conteúdo, e capturar com os outros "ocultos por conveniência" não pode
   * gravá-los invisíveis na animação.
   */
  showOnlyEditing: boolean
  /**
   * Keyframe cuja pose está na bancada — gravado pelo "ir para" e pela
   * captura (o novo keyframe é o corrente). É a âncora do papel-cebola e do
   * destaque na lista; mesma semântica do `visitedKeyframeId` do desktop
   * (item 40): "o que estou editando", não "onde o playhead está".
   */
  currentKeyframeId: string | null
  /**
   * Edição na vista LIVRE destravada (DECISOES.md #93). Nasce travada — a
   * vista continua sendo, por padrão, a de conferência "sem risco de mexer na
   * pose" (item 44); destravar mostra o palito e liga arrasto + gizmo.
   */
  freeEditEnabled: boolean
  /**
   * Comando "enquadrar boneco" (item 49): um contador consumido pelo viewport
   * — cada incremento recentra a vista no boneco em edição. Contador, e não
   * booleano, para dois toques seguidos dispararem duas vezes.
   */
  frameRequestSeq: number
  setViewKey: (key: PosesViewKey) => void
  stepView: (delta: 1 | -1) => void
  setActiveTab: (tab: PosesTabKey) => void
  toggleShowOnlyEditing: () => void
  setCurrentKeyframeId: (id: string | null) => void
  toggleFreeEdit: () => void
  requestFrameFigure: () => void
}

export const usePosesShellStore = create<PosesShellState>()((set) => ({
  viewKey: 'front',
  // A primeira aba da ordem: sem boneco não há o que posar.
  activeTab: 'figures',
  showOnlyEditing: false,
  currentKeyframeId: null,
  freeEditEnabled: false,
  frameRequestSeq: 0,
  setViewKey: (key) => set({ viewKey: key }),
  stepView: (delta) => set((state) => ({ viewKey: stepViewKey(state.viewKey, delta) })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleShowOnlyEditing: () => set((state) => ({ showOnlyEditing: !state.showOnlyEditing })),
  setCurrentKeyframeId: (id) => set({ currentKeyframeId: id }),
  toggleFreeEdit: () => set((state) => ({ freeEditEnabled: !state.freeEditEnabled })),
  requestFrameFigure: () => set((state) => ({ frameRequestSeq: state.frameRequestSeq + 1 })),
}))
