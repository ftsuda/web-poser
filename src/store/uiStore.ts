import { create } from 'zustand'
import {
  loadUIPreferences,
  saveUIPreferences,
  type CollapsedPanels,
  type PanelKey,
  type UIPreferences,
} from '../persistence/uiPreferences'
import type { FrameMaskSource, FrameRect } from '../scene/frameMask'

/**
 * Situação do autosave contínuo em `localStorage` (fase 9, item 2). O
 * autosave sempre foi silencioso; o indicador da Toolbar lê estes campos
 * para dizer se o trabalho está gravado. `error` existe porque a gravação
 * pode falhar de verdade (cota de `localStorage` estourada, modo privado) —
 * um indicador que sempre diz "salvo" seria pior que nenhum.
 */
export type AutosaveStatus = 'idle' | 'pending' | 'saved' | 'error'

/**
 * Qual gizmo a junta selecionada mostra — modo único, global, na convenção
 * W/E dos softwares 3D. Nasceu na fase 9 (item 13) valendo só para o `root`
 * (mover/girar a colocação); com o gizmo de translação de junta o mesmo modo
 * passou a valer para TODAS as juntas: `translate` numa junta arrastável é o
 * arrasto de cadeia (`dragSolver.ts`), `rotate` é o gizmo de rotação FK de
 * sempre. Juntas sem arrasto (mão/dedos, `spine`/`hip.*`) mostram rotação nos
 * dois modos. É modo de ferramenta, não conteúdo: fica fora do histórico de
 * undo, como a câmera.
 */
export type GizmoMode = 'translate' | 'rotate'

/** Estado de UI global sem relação com conteúdo da cena — visibilidade do painel de ajuda (`?`) e situação do autosave. Fora do histórico de undo, como `cameraStore`. */
export interface UIState {
  helpVisible: boolean
  toggleHelp: () => void
  closeHelp: () => void

  /**
   * Há um diálogo MODAL aberto (fase 12, a importação de animação)? Enquanto
   * houver, os atalhos globais ficam suspensos — do contrário um `W` digitado
   * sobre o diálogo trocaria o gizmo da cena por baixo dele, exatamente como o
   * painel de ajuda já evita (`useKeyboardShortcuts`).
   */
  modalOpen: boolean
  setModalOpen: (open: boolean) => void

  autosaveStatus: AutosaveStatus
  /** Epoch (ms) da última gravação bem-sucedida; `null` enquanto nada foi gravado nesta sessão. */
  lastSavedAt: number | null
  markAutosavePending: () => void
  markAutosaveSaved: (at: number) => void
  markAutosaveFailed: () => void

  gizmoMode: GizmoMode
  setGizmoMode: (mode: GizmoMode) => void

  /** Painéis laterais recolhidos (fase 9, item 8) — gravado em `localStorage` a cada troca. */
  collapsedPanels: CollapsedPanels
  togglePanel: (panel: PanelKey) => void

  /** Régua vertical do viewport (fase 9, item 11) — preferência de tela, persistida junto dos painéis. */
  rulerVisible: boolean
  toggleRuler: () => void

  /** De qual saída a máscara de enquadramento mostra a proporção (`frameMask.ts`). */
  frameMaskSource: FrameMaskSource
  setFrameMaskSource: (source: FrameMaskSource) => void
  /**
   * O retângulo que a máscara está desenhando, em pixels de tela. Estado
   * derivado e efêmero, como `autosaveStatus`: quem o calcula é o
   * `FrameMaskCamera`, dentro do `<Canvas>` (é lá que se sabe o tamanho real da
   * tela de desenho),
   * e quem o pinta é o `FrameMaskOverlay`, que é DOM e vive fora dela. `null`
   * com a máscara desligada.
   */
  frameMaskRect: FrameRect | null
  setFrameMaskRect: (rect: FrameRect | null) => void

  /** Aplicar uma pose em dupla também posa o outro boneco (DECISOES.md #41)? Preferência de ferramenta, persistida. */
  pairPoseEnabled: boolean
  togglePairPose: () => void
}

/**
 * Lido uma única vez na criação do store (como o `restoredWorkspace` do
 * `figuresStore`), para que `getInitialState()` nos testes volte sempre ao
 * mesmo ponto de partida.
 */
const INITIAL_UI_PREFERENCES = loadUIPreferences()

export const useUIStore = create<UIState>()((set) => ({
  helpVisible: false,
  toggleHelp: () => set((state) => ({ helpVisible: !state.helpVisible })),
  closeHelp: () => set({ helpVisible: false }),

  modalOpen: false,
  setModalOpen: (open) => set({ modalOpen: open }),

  autosaveStatus: 'idle',
  lastSavedAt: null,
  markAutosavePending: () => set({ autosaveStatus: 'pending' }),
  markAutosaveSaved: (at) => set({ autosaveStatus: 'saved', lastSavedAt: at }),
  // Preserva `lastSavedAt`: saber quando foi a última gravação que deu certo
  // é justamente o que interessa quando a atual falha.
  markAutosaveFailed: () => set({ autosaveStatus: 'error' }),

  gizmoMode: 'translate',
  setGizmoMode: (mode) => set({ gizmoMode: mode }),

  collapsedPanels: INITIAL_UI_PREFERENCES.collapsedPanels,
  // Gravam direto, sem o debounce do autosave do workspace: recolher um painel
  // (ou ligar a régua, ou trocar a máscara) é raro e a gravação é de um objeto
  // minúsculo.
  togglePanel: (panel) => {
    set((state) => persist(state, { collapsedPanels: { ...state.collapsedPanels, [panel]: !state.collapsedPanels[panel] } }))
  },

  rulerVisible: INITIAL_UI_PREFERENCES.rulerVisible,
  toggleRuler: () => set((state) => persist(state, { rulerVisible: !state.rulerVisible })),

  frameMaskSource: INITIAL_UI_PREFERENCES.frameMaskSource,
  // Desligar larga o retângulo junto: sem isso a máscara continuaria pintada
  // até alguém recalculá-la.
  setFrameMaskSource: (source) =>
    set((state) => ({
      ...persist(state, { frameMaskSource: source }),
      ...(source === 'off' ? { frameMaskRect: null } : {}),
    })),

  frameMaskRect: null,
  setFrameMaskRect: (rect) => set({ frameMaskRect: rect }),

  pairPoseEnabled: INITIAL_UI_PREFERENCES.pairPoseEnabled,
  togglePairPose: () => set((state) => persist(state, { pairPoseEnabled: !state.pairPoseEnabled })),
}))

/**
 * Aplica a mudança E grava as preferências inteiras — o arquivo é um bloco só,
 * então cada alteração precisa levar junto o que já estava lá. Devolve a
 * mudança para o `set` que a chamou.
 */
function persist<T extends Partial<UIPreferences>>(state: UIState, change: T): T {
  saveUIPreferences({
    collapsedPanels: state.collapsedPanels,
    rulerVisible: state.rulerVisible,
    frameMaskSource: state.frameMaskSource,
    pairPoseEnabled: state.pairPoseEnabled,
    ...change,
  })
  return change
}
