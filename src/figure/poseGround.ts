import * as THREE from 'three'
import { buildJointFrames } from './jointFrames'
import { resolvePosePreset } from './posePresets'
import { JOINT_NAMES, REFERENCE_HEIGHT_M, getJoint, ROOT_JOINT_NAME, type JointRotation } from './skeleton'

/**
 * Assentamento de uma pose no chão — a conta que até aqui era refeita à mão a
 * cada pose nova. O comentário do preset `fighting` guarda o registro do custo:
 * "`hipHeightM` e os ângulos da perna de trás saíram de uma busca numérica que
 * planta as DUAS pontas de pé no chão ao mesmo tempo (com o quadril em 0,90 o
 * pé de trás flutuava 7 cm)".
 *
 * **A referência de "encostado no chão" não é y=0.** A junta mais baixa do
 * boneco em pé — a ponta do pé — fica cerca de 1 cm acima do chão, porque a
 * junta é o centro de uma esfera e a geometria do pé desce abaixo dela.
 * Assentar "com a junta mais baixa em zero" enterraria toda pose em pé nesse
 * centímetro. Por isso a folga é MEDIDA da pose neutra em vez de fixada, e
 * `seatOnGround` da pose em pé dá exatamente zero.
 *
 * **O que ele é e o que não é.** É a mesma medida dos testes de colocação dos
 * presets (posição de junta no mundo), então acerta em cheio as poses cujo
 * contato é o pé, e é um ponto de partida — não um veredito — nas poses
 * apoiadas em superfícies de raio diferente (costas, quadril, antebraço). O
 * teste `poseGround.test.ts` mede a divergência contra os presets afinados à
 * mão, para que ela seja um número conhecido.
 *
 * Diferença para a correção de chão do `poseBlend` (#43): aquela só LEVANTA,
 * de propósito (o problema de uma mistura é atravessar o chão, não flutuar).
 * Esta levanta e baixa — flutuar é justamente o erro mais comum de quem monta
 * uma pose à mão.
 */

const ORIGEM: [number, number, number] = [0, 0, 0]

function figuraDeMedida(
  pose: Record<string, JointRotation>,
  rotation: JointRotation,
  heightM: number,
) {
  return {
    id: 'medida',
    name: 'medida',
    color: '#000000',
    visible: true,
    height: heightM,
    position: ORIGEM,
    rotation,
    pose,
  }
}

/**
 * Menor `y` de junta, no mundo, com o boneco na origem. É a mesma medida que
 * os testes dos presets usam para dizer que uma pose atravessa o chão.
 */
export function lowestJointY(
  pose: Record<string, JointRotation>,
  rotation: JointRotation,
  heightM: number = REFERENCE_HEIGHT_M,
): number {
  const { joints } = buildJointFrames(figuraDeMedida(pose, rotation, heightM))
  const mundo = new THREE.Vector3()
  let menor = Infinity
  for (const name of JOINT_NAMES) {
    joints.get(name)!.getWorldPosition(mundo)
    if (mundo.y < menor) menor = mundo.y
  }
  return menor
}

/** A folga que a pose em pé já tem entre a junta mais baixa e o chão (≈1 cm em 1,70 m). */
export function neutralGroundClearanceM(heightM: number = REFERENCE_HEIGHT_M): number {
  return lowestJointY(resolvePosePreset('standing'), { x: 0, y: 0, z: 0 }, heightM)
}

/**
 * Deslocamento vertical que assenta a pose — o `groundOffsetM` de um preset, e
 * o que se soma a `figure.position[1]`. Positivo levanta, negativo baixa.
 */
export function seatOnGround(
  pose: Record<string, JointRotation>,
  rotation: JointRotation,
  heightM: number = REFERENCE_HEIGHT_M,
): number {
  return neutralGroundClearanceM(heightM) - lowestJointY(pose, rotation, heightM)
}

/** Altura do quadril acima do chão com a pose assentada — o `hipHeightM` de um preset. */
export function seatedHipHeightM(
  pose: Record<string, JointRotation>,
  rotation: JointRotation,
): number {
  return getJoint(ROOT_JOINT_NAME).position[1] + seatOnGround(pose, rotation)
}
