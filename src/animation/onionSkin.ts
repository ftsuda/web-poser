import { keyframeStartTimesMs, type Animation, type AnimationKeyframe } from './animation'

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

export interface OnionSkinFrame {
  role: OnionSkinRole
  /** Índice do keyframe na animação — usado como chave estável no React. */
  index: number
  /** O keyframe em si, por referência: o fantasma é uma leitura, não uma cópia. */
  keyframe: AnimationKeyframe
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
 * Índice do keyframe que o instante `timeMs` "ocupa" — o ÂNCORA, de quem os
 * fantasmas são vizinhos.
 *
 * Com o playhead exatamente sobre um keyframe (o caso normal: é o que "Ir para"
 * faz), o âncora é ele. Entre dois, é o de trás — o trecho em curso é o que
 * chega até o próximo, então quem está "sendo trabalhado" é o de onde se saiu.
 *
 * Devolve -1 sem keyframe nenhum.
 */
export function anchorKeyframeIndex(animation: Animation, timeMs: number): number {
  const startTimes = keyframeStartTimesMs(animation)
  if (startTimes.length === 0) return -1

  let anchor = 0
  for (let index = 0; index < startTimes.length; index += 1) {
    if (startTimes[index] <= timeMs) anchor = index
    else break
  }
  return anchor
}

/**
 * Os fantasmas a desenhar para o instante dado: o keyframe anterior ao âncora e
 * o seguinte, quando existem.
 *
 * Nas pontas sai só um — no primeiro keyframe não há passado, no último não há
 * futuro. Com menos de dois keyframes não há vizinho nenhum, e o papel-cebola
 * simplesmente não aparece (em vez de desenhar o próprio keyframe por cima
 * dele mesmo, que só faria sujeira).
 */
export function onionSkinFrames(animation: Animation | null, timeMs: number): OnionSkinFrame[] {
  if (!animation || animation.keyframes.length < 2) return []

  const anchor = anchorKeyframeIndex(animation, timeMs)
  if (anchor < 0) return []

  const frames: OnionSkinFrame[] = []
  const previous = animation.keyframes[anchor - 1]
  if (previous) frames.push({ role: 'previous', index: anchor - 1, keyframe: previous })

  const next = animation.keyframes[anchor + 1]
  if (next) frames.push({ role: 'next', index: anchor + 1, keyframe: next })

  return frames
}
