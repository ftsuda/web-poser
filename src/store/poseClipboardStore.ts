import { create } from 'zustand'
import { captureFigurePose, type SavedPose } from '../figure/poseLibrary'
import type { Figure } from './figuresStore'

/**
 * Área de transferência de poses (pedido do usuário): copiar a pose de um
 * boneco para replicar em outro — inclusive **em outra cena**, que é o que a
 * separa de "Copiar pose para" do painel de Propriedades (aquele exige os dois
 * bonecos vivos ao mesmo tempo).
 *
 * **Só em memória, por decisão do usuário.** Por isso é um store à parte, e não
 * um campo do `figuresStore`: aqui não há undo, não há autosave e não há
 * arquivo. Fechar a aba esvazia. É o mesmo lugar de `keyframeThumbnailStore` —
 * apoio de trabalho, não conteúdo.
 *
 * E é justamente por viver fora do `figuresStore` que ela **sobrevive a trocar
 * de cena**: carregar outra cena substitui figuras, animações e biblioteca de
 * poses, e não toca aqui. Sem isso o recurso não teria razão de existir.
 *
 * O que cada entrada guarda é uma `SavedPose` — a MESMA captura da biblioteca
 * de poses (#42): juntas mais assentamento, com a altura do quadril desfeita da
 * escala do boneco de origem. Reusar isso é o que faz colar num boneco de
 * 1,50 m e num de 1,90 m assentar igual, sem uma segunda regra para manter.
 */
export interface PoseClipboardState {
  /** Mais recente por último, como uma pilha lida de cima para baixo. */
  entries: SavedPose[]
  nextSeq: number
  /** Copia a pose do boneco; devolve o id gerado. */
  copyPose: (figure: Figure) => string
  removePose: (id: string) => void
  clear: () => void
}

/**
 * Nome livre na lista: dois bonecos chamados "Boneco 1" copiados em sequência
 * virariam duas linhas idênticas, e aí só o acaso diz qual é qual. O sufixo
 * resolve sem obrigar ninguém a digitar nada.
 */
export function uniqueClipboardName(entries: readonly SavedPose[], desired: string): string {
  const base = desired.trim() || 'Pose'
  const taken = new Set(entries.map((entry) => entry.name))
  if (!taken.has(base)) return base

  let suffix = 2
  while (taken.has(`${base} (${suffix})`)) suffix += 1
  return `${base} (${suffix})`
}

export const usePoseClipboardStore = create<PoseClipboardState>((set, get) => ({
  entries: [],
  nextSeq: 1,

  copyPose: (figure) => {
    const { entries, nextSeq } = get()
    const id = `clip-pose-${nextSeq}`
    const captured = captureFigurePose(figure, id, uniqueClipboardName(entries, figure.name))

    set({ entries: [...entries, captured], nextSeq: nextSeq + 1 })
    return id
  },

  removePose: (id) => set((state) => ({ entries: state.entries.filter((entry) => entry.id !== id) })),

  clear: () => set({ entries: [] }),
}))
