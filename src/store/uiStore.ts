import { create } from 'zustand'

/** Estado de UI global sem relação com conteúdo da cena — por ora, só a visibilidade do painel de ajuda de atalhos (`?`). Fora do histórico de undo, como `cameraStore`/`ikStore`. */
export interface UIState {
  helpVisible: boolean
  toggleHelp: () => void
  closeHelp: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  helpVisible: false,
  toggleHelp: () => set((state) => ({ helpVisible: !state.helpVisible })),
  closeHelp: () => set({ helpVisible: false }),
}))
