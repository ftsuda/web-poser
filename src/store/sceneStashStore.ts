import { create } from 'zustand'
import type { CameraViewState } from '../scene/cameraMove'
import type { Figure } from './figuresStore'

/**
 * A guarda temporária da bancada (pedido do usuário, 2026-08-06). Clicar "Ir
 * para" num keyframe substitui a cena de trabalho pelo retrato dele — e até
 * aqui a única forma de recuperar o que se estava montando era o Ctrl+Z, que
 * ninguém lembra de dar no meio de um ajuste de câmera.
 *
 * Esta é a CAIXA, e só ela: um slot, em memória, sem saber quem a enche nem o
 * que se faz com o que sai. Quem lê a bancada e quem a aplica de volta está no
 * `animation/sceneStashActions.ts` — a mesma divisão de `poseClipboardStore` e
 * do resto do projeto entre o estado e a ação que o move.
 *
 * **Estado de FERRAMENTA** (decisão do usuário): fora do undo e fora do
 * arquivo, como o papel-cebola, o `visitedKeyframeId` e as travas de junta.
 * Recarregar a página esvazia a guarda — ela é uma rede de segurança para um
 * gesto de segundos, não conteúdo da cena.
 */
export interface StashedScene {
  /** Os bonecos inteiros: pose, colocação, altura, cor, visibilidade. */
  figures: Figure[]
  /** E a câmera de cena — o "Ir para" troca as duas coisas, então a guarda leva as duas. */
  camera: CameraViewState
  /**
   * Este retrato é um keyframe carregado e INTOCADO? Viaja com a guarda porque
   * a troca devolve a bancada exatamente ao estado em que ela saiu: recuperar
   * duas vezes põe de volta um retrato que continua intocado, e o "Ir para"
   * seguinte não pode guardá-lo por cima da cena original.
   */
  pristine: boolean
}

export interface SceneStashState {
  /** O retrato guardado, ou `null` quando não há nada a recuperar. */
  stash: StashedScene | null
  /**
   * A referência do array de bonecos que o último "Ir para" pôs na bancada.
   * Enquanto ela for a mesma, ninguém mexeu na cena — toda ação do store faz
   * atualização imutável, então igualdade referencial basta (é a mesma premissa
   * do `undoEquality`). `null` = a bancada é trabalho do usuário, e guardá-la
   * vale a pena.
   */
  pristineFigures: readonly Figure[] | null
  /** Guarda a bancada, sobrescrevendo o que houver: um slot só (decisão do usuário). */
  stashScene: (scene: StashedScene) => void
  /**
   * Troca: guarda `scene` e devolve o que estava guardado — é o que faz o botão
   * de recuperar ALTERNAR entre a cena que se estava montando e o keyframe que
   * se foi ver. Devolve `null` (e não guarda nada) com a guarda vazia: sem
   * retrato a devolver não há troca, e a bancada não pode virar coisa nenhuma.
   */
  swapScene: (scene: StashedScene) => StashedScene | null
  /** Marca a bancada como retrato intocado de um keyframe — ou como trabalho (`null`). */
  markPristine: (figures: readonly Figure[] | null) => void
  clearStash: () => void
}

export const useSceneStashStore = create<SceneStashState>((set, get) => ({
  stash: null,
  pristineFigures: null,

  stashScene: (scene) => set({ stash: scene }),

  swapScene: (scene) => {
    const { stash } = get()
    if (!stash) return null
    set({ stash: scene })
    return stash
  },

  markPristine: (figures) => set({ pristineFigures: figures }),

  clearStash: () => set({ stash: null, pristineFigures: null }),
}))
