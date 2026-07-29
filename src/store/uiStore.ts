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
 * Qual gizmo o `root` do boneco mostra: a translação de colocação (padrão,
 * comportamento das fases 3-8) ou a rotação de colocação, que gira em torno
 * do próprio pivô do quadril — fase 9, item 13, com o ponto de pivô
 * confirmado com o usuário. É modo de ferramenta, não conteúdo: fica fora do
 * histórico de undo, como o modo de IK (`ikStore`).
 */
export type RootGizmoMode = 'translate' | 'rotate'

/** Estado de UI global sem relação com conteúdo da cena — visibilidade do painel de ajuda (`?`) e situação do autosave. Fora do histórico de undo, como `cameraStore`/`ikStore`. */
export interface UIState {
  helpVisible: boolean
  toggleHelp: () => void
  closeHelp: () => void

  autosaveStatus: AutosaveStatus
  /** Epoch (ms) da última gravação bem-sucedida; `null` enquanto nada foi gravado nesta sessão. */
  lastSavedAt: number | null
  markAutosavePending: () => void
  markAutosaveSaved: (at: number) => void
  markAutosaveFailed: () => void

  rootGizmoMode: RootGizmoMode
  setRootGizmoMode: (mode: RootGizmoMode) => void

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

  autosaveStatus: 'idle',
  lastSavedAt: null,
  markAutosavePending: () => set({ autosaveStatus: 'pending' }),
  markAutosaveSaved: (at) => set({ autosaveStatus: 'saved', lastSavedAt: at }),
  // Preserva `lastSavedAt`: saber quando foi a última gravação que deu certo
  // é justamente o que interessa quando a atual falha.
  markAutosaveFailed: () => set({ autosaveStatus: 'error' }),

  rootGizmoMode: 'translate',
  setRootGizmoMode: (mode) => set({ rootGizmoMode: mode }),

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
