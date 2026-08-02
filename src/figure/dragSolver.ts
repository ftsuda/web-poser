import * as THREE from 'three'
import {
  JOINT_NAMES,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getJointChain,
  getJointSubtree,
  type JointRotation,
} from './skeleton'
import { buildJointFrames } from './jointFrames'
import { rootAxisLockToken } from './jointLocks'
import type { Figure } from '../store/figuresStore'

/**
 * Solver do gizmo de translação de junta (arrasto de corpo inteiro): puxar
 * uma junta qualquer recruta a cadeia de ANCESTRAIS dela — da mais próxima em
 * direção à raiz — para levá-la até o alvo, respeitando os limites
 * articulares de cada uma. A raiz nunca TRANSLADA (a colocação no chão não é
 * pose), mas desde o item 63 ela GIRA como último elo recrutável: alvo que a
 * cadeia não alcança faz o corpo virar/inclinar atrás dele em torno do pivô
 * do quadril. A subárvore ABAIXO da junta arrastada segue rígida (as rotações
 * locais dela não mudam) — puxar o cotovelo leva antebraço e mão junto, como
 * num manequim físico.
 *
 * Algoritmo: CCD (cyclic coordinate descent) com RECRUTAMENTO PROGRESSIVO —
 * primeiro resolve só com a junta mais próxima; se o alvo continuar fora de
 * alcance depois das varreduras, expande o conjunto uma junta por vez em
 * direção à raiz. É a prioridade pedida pelo usuário de forma literal: o
 * ombro absorve tudo o que os limites dele permitem ANTES de a clavícula e o
 * tronco entrarem no jogo (um CCD ingênuo sobre a cadeia inteira deixava o
 * resíduo de cada varredura vazar para o tronco mesmo em alvos que o braço
 * alcançava sozinho — medido nos testes deste módulo).
 *
 * Relação com o DECISOES.md #12 (CCD abandonado na fase 7): aquele CCD
 * resolvia um alvo DISTANTE numa chamada única e travava em mínimo local
 * contra a borda de um limite. Aqui o regime é outro — o solver roda a cada
 * evento de arrasto do mouse, sempre partindo da pose atual para um alvo a
 * milímetros dela, então cada chamada só precisa dar um passo pequeno (as
 * varreduras extras, `MAX_SWEEPS`, só refinam). Quando o alvo é inalcançável,
 * "parar na borda" não é defeito: é exatamente o comportamento de travar que
 * a funcionalidade pede — o gizmo é reposicionado na posição efetivamente
 * alcançada (`achievedWorldPosition`) e para de seguir o mouse.
 *
 * Como todo consumidor de pose do app, o resultado é Euler XYZ em graus por
 * junta, já grampeado — entra no `figuresStore` pelo caminho normal
 * (`setJointRotations`) e nenhum formato novo de persistência é criado.
 */

const EPSILON = 1e-6

/** Distância (m) para considerar o alvo alcançado — para as varreduras e define `reached`. */
const REACH_TOLERANCE_M = 0.001

/**
 * Resíduo mínimo (m) para RECRUTAR mais uma junta da cadeia. Maior que a
 * tolerância de alcance de propósito: o CCD não explora a torção da junta
 * próxima perfeitamente e pode estacionar a 2-3 mm do alvo mesmo quando o
 * membro sozinho alcançaria — expandir por causa desse resíduo numérico
 * balançaria o tronco a cada evento de arrasto. Abaixo de 5 mm, o gizmo
 * simplesmente fica esse tanto atrás do mouse (imperceptível); acima, é
 * saturação de verdade e a junta seguinte entra.
 */
const RECRUIT_THRESHOLD_M = 0.005

/**
 * Varreduras CCD por subconjunto recrutado. Poucas já acertam o caso comum
 * (delta pequeno de um evento de mouse); as extras recuperam alvos maiores
 * (arrasto rápido, campo numérico) sem custo perceptível — a cadeia mais
 * longa tem ~5 juntas móveis.
 */
const MAX_SWEEPS = 8

/**
 * Juntas da mão (tudo abaixo do punho, exclusive): fora do arrasto por decisão
 * do usuário — arrastar a ponta de um dedo recrutando o tronco seria mais
 * surpresa que utilidade; dedos continuam com sliders/presets de mão.
 */
const HAND_JOINTS = new Set<string>(
  ['wrist.L', 'wrist.R'].flatMap((wrist) => getJointSubtree(wrist).slice(1)),
)

/**
 * Se a junta pode receber o gizmo de translação. Exclui:
 * - a raiz (o gizmo de translação dela já existe e é outra coisa: colocação);
 * - as juntas da mão (decisão do usuário, ver `HAND_JOINTS`);
 * - juntas cujo único ancestral é a raiz (`spine`, `hip.*`): mantidas fora
 *   mesmo com a raiz girando (item 63, decisão do usuário) — arrastá-las só
 *   giraria o boneco em torno de si, e o giro de corpo já sai arrastando
 *   qualquer outra junta.
 * Nome desconhecido devolve `false` (o chamador vem da seleção da UI, mas não
 * custa não estourar).
 */
export function isDraggableJoint(jointName: string): boolean {
  if (!JOINT_NAMES.includes(jointName)) return false
  if (jointName === ROOT_JOINT_NAME || HAND_JOINTS.has(jointName)) return false
  return getJointChain(jointName).length >= 3
}

export interface JointDragResult {
  /** Rotações locais (graus) resultantes, já grampeadas — só as juntas que participaram (ancestrais móveis não travados). */
  rotations: Record<string, JointRotation>
  /**
   * Rotação de COLOCAÇÃO resultante (item 63), quando a raiz foi recrutada
   * como último elo — `null` quando a cadeia deu conta sozinha. Fica fora de
   * `rotations` de propósito: colocação não é pose, e o consumidor grava as
   * duas no mesmo passo via `setJointRotations(id, rotations, rootRotation)`.
   */
  rootRotation: JointRotation | null
  /** Onde a junta arrastada efetivamente ficou, no mundo — é para cá que o gizmo volta ("trava" quando o alvo é inalcançável). */
  achievedWorldPosition: [number, number, number]
  /** `true` se a junta chegou a `REACH_TOLERANCE_M` do alvo. */
  reached: boolean
}

/**
 * Resolve o arrasto de `jointName` até `targetWorldPosition` (metros, mundo).
 * Junta travada (cadeado, DECISOES.md #42) fica RÍGIDA mas não interrompe a
 * cadeia: o recrutamento continua nas juntas acima dela — decisão do usuário,
 * divergindo de propósito do IK analítico de 2 ossos da fase 7, que recusava a
 * cadeia inteira (aquele solver não sabia trabalhar com um elo preso; este,
 * iterativo, simplesmente pula o elo).
 */
export function solveJointDrag(
  figure: Figure,
  jointName: string,
  targetWorldPosition: readonly [number, number, number],
  lockedJoints: readonly string[] = [],
): JointDragResult {
  const { outer, joints } = buildJointFrames(figure)
  const dragged = joints.get(jointName)
  if (!dragged) {
    throw new Error(`Junta desconhecida para arrasto: "${jointName}"`)
  }

  // Ancestrais móveis, do mais próximo ao mais distante: a cadeia vem
  // raiz-primeiro, sem interesse na própria junta (girá-la não muda a posição
  // dela). A raiz entra como ÚLTIMO elo recrutável (item 63): quando toda a
  // cadeia satura, o corpo GIRA atrás do alvo em torno do pivô do quadril —
  // sem limite (colocação não passa por limite articular) — mas nunca
  // translada. `root` no conjunto travado (a âncora do item 62 congela a
  // colocação) a exclui; os TOKENS de eixo do item 64 (`root.x`…`root.z`)
  // restringem o giro aos eixos destravados, e os três juntos equivalem à
  // exclusão inteira.
  const lockedRootAxes = (['x', 'y', 'z'] as const).filter((axis) =>
    lockedJoints.includes(rootAxisLockToken(axis)),
  )
  const movable = getJointChain(jointName)
    .slice(1, -1)
    .reverse()
    .filter((name) => !lockedJoints.includes(name))
  if (!lockedJoints.includes(ROOT_JOINT_NAME) && lockedRootAxes.length < 3) {
    movable.push(ROOT_JOINT_NAME)
  }

  // O valor de PARTIDA da colocação: é a ele que um eixo travado volta a cada
  // passo — o mesmo regime do clamp de limites das juntas (o passo seguinte
  // da varredura compensa o que a trava comeu).
  const initialRootRotation: JointRotation = { ...figure.rotation }

  const target = new THREE.Vector3(...targetWorldPosition)
  const rotations: Record<string, JointRotation> = {}
  let rootRotation: JointRotation | null = null

  const jointPos = new THREE.Vector3()
  const effectorPos = new THREE.Vector3()
  const worldQuat = new THREE.Quaternion()
  const parentQuat = new THREE.Quaternion()

  const remainingDistance = () => dragged.getWorldPosition(effectorPos).distanceTo(target)

  // Recrutamento progressivo: o subconjunto começa só com a junta mais
  // próxima e ganha uma junta (em direção à raiz) sempre que as varreduras
  // esgotam sem chegar ao alvo — os limites da junta próxima "saturaram" e o
  // resíduo sobe a cadeia, exatamente o comportamento pedido.
  for (
    let recruited = 1;
    recruited <= movable.length &&
    remainingDistance() > (recruited === 1 ? REACH_TOLERANCE_M : RECRUIT_THRESHOLD_M);
    recruited += 1
  ) {
    const subset = movable.slice(0, recruited)

    for (let sweep = 0; sweep < MAX_SWEEPS && remainingDistance() > REACH_TOLERANCE_M; sweep += 1) {
      for (const name of subset) {
        const group = joints.get(name)
        if (!group?.parent) continue

        group.getWorldPosition(jointPos)
        dragged.getWorldPosition(effectorPos)
        const toEffector = effectorPos.clone().sub(jointPos)
        const toTarget = target.clone().sub(jointPos)
        // Junta em cima do efetuador ou do alvo: qualquer rotação é ambígua — pula.
        if (toEffector.lengthSq() < EPSILON || toTarget.lengthSq() < EPSILON) continue

        // Passo CCD clássico: a menor rotação (no mundo) que leva a direção
        // junta→efetuador para a direção junta→alvo, convertida para o espaço
        // local e grampeada em Euler. O clamp por eixo depois de uma rotação
        // 3D não é a rotação válida "mais próxima" — mesma limitação já
        // aceita pelo solver da fase 7 —, e é o passo seguinte da varredura
        // (ou a próxima varredura) que compensa o que o clamp comeu.
        const delta = new THREE.Quaternion().setFromUnitVectors(
          toEffector.normalize(),
          toTarget.normalize(),
        )
        group.getWorldQuaternion(worldQuat)
        group.parent.getWorldQuaternion(parentQuat)
        const localQuat = parentQuat.invert().multiply(delta).multiply(worldQuat)
        const euler = new THREE.Euler().setFromQuaternion(localQuat, 'XYZ')
        // Para a raiz o clamp é identidade (limites vazios): o passo é o MESMO
        // das juntas, e só o destino do resultado muda — colocação, não pose.
        const clamped = clampJointRotation(name, {
          x: THREE.MathUtils.radToDeg(euler.x),
          y: THREE.MathUtils.radToDeg(euler.y),
          z: THREE.MathUtils.radToDeg(euler.z),
        })

        if (name === ROOT_JOINT_NAME) {
          // Trava por eixo (item 64): o eixo travado volta ao valor de partida
          // — a raiz só gira nas direções destravadas.
          for (const axis of lockedRootAxes) clamped[axis] = initialRootRotation[axis]
          rootRotation = clamped
        } else {
          rotations[name] = clamped
        }
        group.rotation.set(
          THREE.MathUtils.degToRad(clamped.x),
          THREE.MathUtils.degToRad(clamped.y),
          THREE.MathUtils.degToRad(clamped.z),
        )
        outer.updateMatrixWorld(true)
      }
    }
  }

  dragged.getWorldPosition(effectorPos)
  return {
    rotations,
    rootRotation,
    achievedWorldPosition: [effectorPos.x, effectorPos.y, effectorPos.z],
    reached: effectorPos.distanceTo(target) <= REACH_TOLERANCE_M,
  }
}
