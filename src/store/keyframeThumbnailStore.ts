import { create } from 'zustand'

/**
 * Miniaturas dos keyframes da animação (item 30): um retrato pequeno por
 * keyframe, para os cards do painel dizerem qual é qual — "Keyframe 3 — 1.5s"
 * não diz nada com oito keyframes na lista.
 *
 * **Cache em memória, fora do conteúdo** (decisão registrada no próprio item):
 * uma dataURL dentro do `Animation` incharia o `animations.json` e entraria no
 * undo a cada captura. Aqui elas vivem como as outras coisas de ferramenta
 * (`cameraStore`, `animationStore`): fora do histórico, fora do arquivo, e
 * refeitas quando o keyframe é regravado.
 *
 * A chave é o id do keyframe. Ids são únicos DENTRO de uma animação, então
 * trocar a animação de trabalho (item 36) limpa o cache — senão o keyframe `k1`
 * de uma animação mostraria a miniatura do `k1` da outra.
 */
export interface KeyframeThumbnailState {
  /** `keyframeId -> dataURL`; ausente quando ainda não foi gerada. */
  thumbnails: Record<string, string>
  setThumbnail: (keyframeId: string, dataUrl: string) => void
  clearThumbnail: (keyframeId: string) => void
  clearThumbnails: () => void
}

export const useKeyframeThumbnailStore = create<KeyframeThumbnailState>((set) => ({
  thumbnails: {},

  setThumbnail: (keyframeId, dataUrl) =>
    set((state) => ({ thumbnails: { ...state.thumbnails, [keyframeId]: dataUrl } })),

  clearThumbnail: (keyframeId) =>
    set((state) => {
      if (!(keyframeId in state.thumbnails)) return {}
      const rest = { ...state.thumbnails }
      delete rest[keyframeId]
      return { thumbnails: rest }
    }),

  clearThumbnails: () => set({ thumbnails: {} }),
}))
