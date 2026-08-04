import * as THREE from 'three'
import { buildJointFrames } from './jointFrames'
import {
  REFERENCE_HEIGHT_M,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getHeightScale,
  type JointRotation,
} from './skeleton'
import type { Figure } from '../store/figuresStore'

/**
 * Mistura entre duas poses (PLANO.md > "Ideias e melhorias" > A.6): um valor
 * de 0 a 1 entre a pose que o boneco tem e uma pose alvo, para chegar a um
 * meio-termo — "andando, mas só metade do passo".
 *
 * **Não é animação:** o resultado é uma pose estática única, sem linha do
 * tempo nem quadros. A mistura é só a forma de chegar até ela, e o que fica
 * gravado é a pose final, como qualquer outra edição.
 *
 * ## Por que interpolação por EIXO, e não por quatérnio
 *
 * O plano previa o contrário ("provavelmente interpolar por quatérnio, não por
 * ângulo", com o risco de o Euler passar por orientações estranhas). A
 * medição numérica exigida ali mostrou que, NESTE modelo, o risco é o oposto —
 * ver DECISOES.md #43:
 *
 * - **Interpolar por eixo nunca sai dos limites articulares.** Cada eixo tem
 *   uma faixa `[min, max]`, e um valor entre dois valores válidos é válido
 *   (convexidade). Medido: a correção do clamp sobre o resultado é **0,000000°**
 *   em 6 pares de poses × 41 passos × todas as juntas.
 * - **O quatérnio sai, e feio.** A pose deste modelo não é uma orientação
 *   livre: é um conjunto de ângulos por eixo, cada um com faixa própria. O
 *   caminho mais curto entre duas orientações passa fora dessa caixa, e ao
 *   voltar para Euler cai numa representação equivalente porém fora da faixa
 *   (medido: `elbow.R` em +99° com limite `[-150, 0]`), que o clamp então
 *   puxa para o extremo — um braço que estica sozinho no meio da mistura.
 *   O maior salto entre passos consecutivos foi de **0,562 m** no quatérnio
 *   contra **0,033 m** por eixo.
 *
 * Ou seja: interpolar por eixo é ao mesmo tempo o método mais simples e o
 * único que respeita o contrato do modelo.
 */

/**
 * Uma pose pronta para misturar, já resolvida no MUNDO: a rotação do root com
 * o giro de encenação embutido e o deslocamento vertical em metros de verdade
 * (escala do boneco aplicada). Resolver antes de misturar é o que garante que
 * a mistura em 100% seja idêntica a aplicar a pose — e o que evita que o
 * resultado escorregue enquanto se arrasta o slider.
 */
export interface BlendablePose {
  pose: Record<string, JointRotation>
  rotation: JointRotation
  positionY: number
}

/** Assentamento de uma pose alvo — o formato comum aos presets de fábrica (`PosePresetPlacement`) e à biblioteca do usuário (`SavedPose`). */
export interface BlendSource {
  pose: Record<string, JointRotation>
  rotation: JointRotation
  groundOffsetM: number
  preservesHeading: boolean
}

/** O estado atual do boneco como ponta de partida da mistura (0%). */
export function figureBlendState(figure: Figure): BlendablePose {
  return { pose: figure.pose, rotation: figure.rotation, positionY: figure.position[1] }
}

/**
 * A ponta de chegada (100%): a pose alvo resolvida PARA ESTE boneco — mesma
 * regra de `applyPosePreset`/`applySavedPose`, para que 100% e "Aplicar pose"
 * deem exatamente o mesmo resultado (há teste travando isso).
 */
export function resolveBlendTarget(figure: Figure, target: BlendSource): BlendablePose {
  return {
    pose: target.pose,
    rotation: target.preservesHeading
      ? { x: target.rotation.x, y: figure.rotation.y, z: target.rotation.z }
      : target.rotation,
    positionY: target.groundOffsetM * getHeightScale(figure.height),
  }
}

export interface BlendOptions {
  /**
   * Correção de chão ligada (padrão) ou desligada. O animador da fase 10
   * desliga (DECISOES.md #52): lá, atravessar o chão é problema de quem monta
   * os keyframes, e levantar o boneco criaria um movimento vertical que
   * ninguém pôs na animação. Desligar também poupa reconstruir as 32 juntas a
   * cada quadro só para medir o afundamento.
   */
  groundCorrection?: boolean
}

/**
 * Mistura as duas pontas. `amount` é grampeado em [0, 1]; nas pontas devolve
 * o próprio objeto, para que arrastar até 0% volte EXATAMENTE à pose de
 * partida (e não a uma cópia com ruído de ponto flutuante).
 */
export function blendPoses(
  base: BlendablePose,
  target: BlendablePose,
  amount: number,
  heightM: number = REFERENCE_HEIGHT_M,
  options: BlendOptions = {},
): BlendablePose {
  const t = Math.min(1, Math.max(0, amount))
  if (t === 0) return base
  if (t === 1) return target

  const pose: Record<string, JointRotation> = {}
  for (const jointName of new Set([...Object.keys(base.pose), ...Object.keys(target.pose)])) {
    if (jointName === ROOT_JOINT_NAME) continue
    const from = base.pose[jointName] ?? ZERO_ROTATION
    const to = target.pose[jointName] ?? ZERO_ROTATION
    // O clamp aqui é cinto de segurança, não correção: a medição mostra que
    // ele nunca tem o que fazer sobre uma interpolação por eixo entre duas
    // poses válidas. Ele existe para o caso de uma das pontas já chegar fora
    // da faixa (limites customizados trocados no meio do caminho).
    pose[jointName] = clampJointRotation(jointName, {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      z: lerp(from.z, to.z, t),
    })
  }

  // A chegada, reescrita no MESMO ramo do Euler da partida quando isso a
  // aproxima (#116) — senão o giro se espalha por X e Z e o boneco tomba.
  const targetRotation = alignRootRotation(base.rotation, target.rotation)

  const mixed: BlendablePose = {
    pose,
    rotation: {
      // A rotação do root NÃO tem limites (é a colocação do boneco na cena, e
      // dá a volta completa): aqui o caminho mais curto importa — de 170° para
      // -170° são 20°, não 340°.
      x: lerpAngle(base.rotation.x, targetRotation.x, t),
      y: lerpAngle(base.rotation.y, targetRotation.y, t),
      z: lerpAngle(base.rotation.z, targetRotation.z, t),
    },
    positionY: lerp(base.positionY, target.positionY, t),
  }

  // Correção de chão. A altura do quadril interpola em linha reta, mas a
  // geometria das pernas não: no meio do caminho de "em pé" para "ajoelhado" o
  // boneco afunda até 17 cm no chão, embora as duas pontas estejam assentadas.
  // Sobe-se apenas o afundamento EXTRA — o que a mistura criou, descontado o
  // que as pontas já tinham —, e é isso que mantém 0% e 100% intactos mesmo
  // quando o usuário deixou o boneco enterrado de propósito. Nunca baixa: o
  // problema é atravessar o chão, não flutuar.
  if (options.groundCorrection !== false) {
    const extra =
      groundDeficit(mixed, heightM) - lerp(groundDeficit(base, heightM), groundDeficit(target, heightM), t)
    if (extra > 0) mixed.positionY += extra
  }

  return mixed
}

/** Quanto a junta mais baixa está ABAIXO do chão (0 quando nada atravessa). */
function groundDeficit(state: BlendablePose, heightM: number): number {
  const { joints } = buildJointFrames({
    id: 'blend',
    name: 'blend',
    color: '#000000',
    visible: true,
    height: heightM,
    position: [0, state.positionY, 0],
    rotation: state.rotation,
    pose: state.pose,
  })

  let lowest = Infinity
  const world = new THREE.Vector3()
  for (const group of joints.values()) {
    group.getWorldPosition(world)
    if (world.y < lowest) lowest = world.y
  }

  return lowest < 0 ? -lowest : 0
}

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }

function lerp(from: number, to: number, t: number): number {
  const value = from + (to - from) * t
  return value === 0 ? 0 : value
}

/** Interpolação pelo menor arco, com o resultado dentro de (-180, 180]. */
function lerpAngle(from: number, to: number, t: number): number {
  const delta = ((to - from + 540) % 360) - 180
  const value = from + delta * t
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180
  return wrapped === -180 ? 180 : wrapped === 0 ? 0 : wrapped
}

/** O ângulo dentro de (-180, 180] — mesma convenção do `lerpAngle`. */
function wrapAngle(value: number): number {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180
  return wrapped === -180 ? 180 : wrapped === 0 ? 0 : wrapped
}

/** Distância angular pelo menor arco (sempre >= 0). */
function angleDistance(from: number, to: number): number {
  return Math.abs(((to - from + 540) % 360) - 180)
}

/**
 * A rotação de CHEGADA reescrita no mesmo "jeito de guardar" da PARTIDA
 * (DECISOES.md #116).
 *
 * Toda orientação tem DOIS Euler XYZ que a descrevem: `(x, y, z)` e
 * `(x+180, 180−y, z+180)`. Os sliders do painel escrevem eixo a eixo e ficam no
 * primeiro; o gizmo escreve QUATERNION e deixa o three decompor, o que devolve
 * sempre o ramo de `|y| <= 90` — um boneco de costas vira `(180, 0, 180)` em vez
 * de `(0, 180, 0)`. São a mesma pose e o app desenha igual, mas a interpolação
 * é EIXO A EIXO: misturar um keyframe feito no gizmo com outro feito no slider
 * fazia X e Z correrem 180° no meio do trecho — o boneco deitava e voltava.
 *
 * Escolher o ramo mais próximo da partida resolve sem tocar na interpolação:
 * quando as duas pontas já falam a mesma língua (o caso comum, tudo por
 * slider), a alternativa está mais longe e nada muda.
 */
export function alignRootRotation(from: JointRotation, to: JointRotation): JointRotation {
  const alternate: JointRotation = {
    x: wrapAngle(to.x + 180),
    y: wrapAngle(180 - to.y),
    z: wrapAngle(to.z + 180),
  }
  const direct =
    angleDistance(from.x, to.x) + angleDistance(from.y, to.y) + angleDistance(from.z, to.z)
  const other =
    angleDistance(from.x, alternate.x) +
    angleDistance(from.y, alternate.y) +
    angleDistance(from.z, alternate.z)
  return other < direct ? alternate : to
}
