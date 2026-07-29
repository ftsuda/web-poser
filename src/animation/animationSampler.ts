import { blendPoses } from '../figure/poseBlend'
import { interpolateCameraView, type CameraViewState } from '../scene/cameraMove'
import type { Figure } from '../store/figuresStore'
import { clampAnimationSpeed, keyframeStartTimesMs, type Animation, type AnimationKeyframe } from './animation'

/**
 * O estado da cena num instante qualquer da animação (PLANO.md > "Mini
 * animador" > "Interpolação"). Função pura, sem WebGL: é o que permite testar
 * o coração do animador sem GPU.
 *
 * **Não há mecanismo novo de interpolação aqui.** A câmera sai do
 * `interpolateCameraView` (#46) sem uma linha de alteração, e a pose sai do
 * cálculo por eixo do `blendPoses` (#43) — só que com a correção de chão
 * DESLIGADA (DECISOES.md #52): na animação, atravessar o chão é problema de
 * quem monta os keyframes, e levantar o boneco no meio da transição criaria um
 * movimento vertical que ninguém pediu.
 *
 * O que é novo é só o que a mistura de poses nunca precisou: **X e Z**. A
 * mistura acontece parada no lugar, então `BlendablePose` só carrega
 * `positionY`; um boneco que atravessa a cena precisa da posição inteira.
 */
export interface AnimationSample {
  figures: Figure[]
  camera: CameraViewState
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/**
 * Um boneco no meio do caminho entre duas pontas. O que **não** interpola —
 * nome, cor, visibilidade e altura — vale em degrau, com o valor da partida:
 * cor e visibilidade são identidade, não movimento, e altura é característica
 * da personagem. É assim que um boneco entra e sai de cena entre dois
 * keyframes.
 */
function blendFigure(from: Figure, to: Figure, t: number): Figure {
  const blended = blendPoses(
    { pose: from.pose, rotation: from.rotation, positionY: from.position[1] },
    { pose: to.pose, rotation: to.rotation, positionY: to.position[1] },
    t,
    from.height,
    { groundCorrection: false },
  )

  return {
    ...from,
    position: [
      lerp(from.position[0], to.position[0], t),
      blended.positionY,
      lerp(from.position[2], to.position[2], t),
    ],
    rotation: blended.rotation,
    pose: blended.pose,
  }
}

function sampleOf(keyframe: AnimationKeyframe): AnimationSample {
  return { figures: keyframe.figures, camera: keyframe.camera }
}

/**
 * Estado da cena em `timeMs`. Devolve `null` só quando não há keyframe nenhum.
 *
 * Nas pontas devolve o keyframe **idêntico** (os próprios objetos, sem cópia
 * nem ruído de ponto flutuante) — mesmo contrato do `blendPoses` e do
 * `interpolateCameraView`, e o que garante que parar a reprodução no início
 * mostre exatamente o que foi capturado.
 */
/**
 * A câmera que um keyframe deve guardar ao CORTAR um trecho em `t` — quase o
 * `interpolateCameraView`, e a diferença é o que faz o corte não mudar nada.
 *
 * Posição, alvo e lente já reproduzem o trecho exatamente: distância e lente
 * andam em progressão geométrica e a direção anda por arco, e as duas
 * parametrizações têm propriedade de semigrupo — cortar no meio e reinterpolar
 * cada metade dá o mesmo caminho.
 *
 * **O topo da tela é a exceção.** Ele é interpolado em linha reta e só então
 * reendireitado contra a direção de visão; guardar o resultado JÁ reendireitado
 * faria cada metade partir de um lugar diferente do da reta original, e a
 * inclinação lateral da câmera passaria a divergir no meio do trecho (medido:
 * até 1,5° num par comum e 3,3° com ângulo holandês entre as pontas). Guardar o
 * valor da reta, antes de reendireitar, devolve a exatidão — e não muda nada do
 * que se vê, porque os dois vetores geram o MESMO plano com a direção de visão,
 * e é o plano que define a orientação da câmera (o `lookAt` reendireita
 * sozinho).
 */
export function splitCameraView(from: CameraViewState, to: CameraViewState, t: number): CameraViewState {
  const view = interpolateCameraView(from, to, t)
  if (!(t > 0) || t >= 1) return view

  return {
    ...view,
    up: [
      lerp(from.up[0], to.up[0], t),
      lerp(from.up[1], to.up[1], t),
      lerp(from.up[2], to.up[2], t),
    ],
  }
}

/**
 * A cena no instante `outputTimeMs` **do vídeo** — o mesmo amostrador, com o
 * relógio do arquivo convertido para o relógio da linha do tempo.
 *
 * Um vídeo a 0,5 exibe em 4 s uma linha do tempo de 2 s, então o quadro dos
 * 4 s mostra o instante 2000 da animação: tempo de saída × velocidade. Só o
 * relógio muda — nenhum keyframe se move, e a interpolação é a mesma.
 */
export function sampleAnimationOutput(animation: Animation, outputTimeMs: number): AnimationSample | null {
  return sampleAnimation(animation, outputTimeMs * clampAnimationSpeed(animation.speed))
}

export function sampleAnimation(animation: Animation, timeMs: number): AnimationSample | null {
  const { keyframes } = animation
  if (keyframes.length === 0) return null
  if (keyframes.length === 1 || !(timeMs > 0)) return sampleOf(keyframes[0])

  const starts = keyframeStartTimesMs(animation)
  const last = keyframes.length - 1
  if (timeMs >= starts[last]) return sampleOf(keyframes[last])

  let index = 0
  while (index < last && starts[index + 1] <= timeMs) index += 1

  const from = keyframes[index]
  const to = keyframes[index + 1]
  const span = starts[index + 1] - starts[index]
  // A duração é grampeada a >= 1 ms na entrada, mas o amostrador não pode
  // depender disso para não dividir por zero.
  const t = span > 0 ? (timeMs - starts[index]) / span : 1

  return {
    // O conjunto de bonecos do trecho é o do keyframe de PARTIDA; quem não
    // está na chegada fica parado onde estava, e quem só aparece na chegada
    // entra em cena ali, sem transição.
    figures: from.figures.map((figure) => {
      const target = to.figures.find((candidate) => candidate.id === figure.id)
      return target ? blendFigure(figure, target, t) : figure
    }),
    camera: interpolateCameraView(from.camera, to.camera, t),
  }
}
