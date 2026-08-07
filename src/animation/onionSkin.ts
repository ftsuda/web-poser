import { anchorKeyframeIndex, type Animation, type AnimationKeyframe } from './animation'
import type { Figure } from '../store/figuresStore'

/**
 * Papel-cebola (PLANO.md > propostas, item 31): ver o keyframe **anterior** e o
 * **seguinte** em fantasma enquanto se ajusta o atual. É a ferramenta clássica
 * de animação — sem ela, a única forma de saber quanto um braço andou entre
 * dois retratos é ficar alternando "Ir para" e guardar a diferença de cabeça.
 *
 * Este módulo é só a LEITURA: dado o instante da linha do tempo, quais
 * keyframes são os vizinhos. Quem desenha é `OnionSkin.tsx`; quem liga e
 * desliga é o `animationStore`. Separado assim, a regra de "quem é vizinho de
 * quem" fica testável sem WebGL — que é onde ela é fácil de errar.
 */

export type OnionSkinRole = 'previous' | 'next'

/**
 * Quais vizinhos desenhar (pedido do usuário): os dois juntos, só o de trás ou
 * só o da frente.
 *
 * Ver um lado de cada vez não é enfeite: com os dois fantasmas em volta, uma
 * pose parada no meio do movimento fica cercada de corpo por todos os lados e
 * some no meio deles. Isolando o anterior, lê-se de onde a pose VEIO (o que se
 * quer ao ajustar a chegada); isolando o seguinte, para onde ela VAI.
 *
 * Os papéis são os mesmos e as cores também — o modo só escolhe quem aparece,
 * então o fantasma quente continua sendo o passado nos três casos.
 */
export type OnionSkinMode = 'both' | 'previous' | 'next'

/** Na ordem em que aparecem no combo do painel. */
export const ONION_SKIN_MODES: readonly OnionSkinMode[] = ['both', 'previous', 'next']

export interface OnionSkinFrame {
  role: OnionSkinRole
  /** Índice do keyframe na animação — usado como chave estável no React. */
  index: number
  /** O keyframe em si, por referência: o fantasma é uma leitura, não uma cópia. */
  keyframe: AnimationKeyframe
  /**
   * Os bonecos a desenhar: os do keyframe, menos os desmarcados no painel
   * (pedido do usuário, 2026-08-06). Numa cena de várias pessoas, o fantasma de
   * todo mundo em volta lava a tela e esconde o movimento que se está lendo.
   */
  figures: Figure[]
}

/**
 * Uma cor por papel, porque um fantasma sem cor própria não diz de que lado do
 * tempo ele vem. Quente para o que já passou, frio para o que vem a seguir — a
 * convenção dos programas de animação 2D.
 */
export const ONION_SKIN_COLORS: Record<OnionSkinRole, string> = {
  previous: '#e0654a',
  next: '#4a9ee0',
}

/**
 * Translúcido o bastante para o boneco de trabalho continuar sendo o que se lê
 * primeiro. Dois fantasmas sobrepostos ainda somam menos que o sólido.
 */
export const ONION_SKIN_OPACITY = 0.3

/**
 * Os fantasmas a desenhar para o instante dado: o keyframe anterior ao âncora e
 * o seguinte, conforme o `mode` e quando existem.
 *
 * Nas pontas sai só um — no primeiro keyframe não há passado, no último não há
 * futuro —, e num modo de um lado só, na ponta daquele lado não sai nenhum: o
 * papel-cebola simplesmente não aparece, em vez de mostrar o outro vizinho
 * "para não ficar vazio", que é justamente o que quem escolheu um lado não
 * quer ver.
 *
 * Com menos de dois keyframes não há vizinho nenhum (em vez de desenhar o
 * próprio keyframe por cima dele mesmo, que só faria sujeira).
 */
export function onionSkinFrames(
  animation: Animation | null,
  timeMs: number,
  mode: OnionSkinMode = 'both',
  hiddenFigureIds: readonly string[] = [],
): OnionSkinFrame[] {
  if (!animation || animation.keyframes.length < 2) return []

  const anchor = anchorKeyframeIndex(animation, timeMs)
  if (anchor < 0) return []

  // A escolha de bonecos NÃO mexe em quem é vizinho de quem: ela só decide
  // quem, dentro do fantasma, aparece. Um fantasma que não desenharia ninguém
  // some da lista — fantasma vazio não é fantasma.
  const hidden = new Set(hiddenFigureIds)
  const shown = (keyframe: AnimationKeyframe) =>
    keyframe.figures.filter((figure) => !hidden.has(figure.id))

  const frames: OnionSkinFrame[] = []
  const previous = animation.keyframes[anchor - 1]
  if (previous && mode !== 'next') {
    const figures = shown(previous)
    if (figures.length > 0) frames.push({ role: 'previous', index: anchor - 1, keyframe: previous, figures })
  }

  const next = animation.keyframes[anchor + 1]
  if (next && mode !== 'previous') {
    const figures = shown(next)
    if (figures.length > 0) frames.push({ role: 'next', index: anchor + 1, keyframe: next, figures })
  }

  return frames
}
