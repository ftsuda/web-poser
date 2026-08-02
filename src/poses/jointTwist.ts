import { JOINT_NAMES, ROOT_JOINT_NAME, getJointAxes, type Axis } from '../figure/skeleton'

/**
 * TORÇÃO da junta selecionada — o giro no próprio eixo, que o arrasto planar
 * das vistas travadas não alcança (PLANO.md, item 44: "não é enfeite").
 *
 * O esqueleto modela todo osso ao longo do eixo Y local (membros para -Y,
 * tronco para +Y), então "girar em torno do próprio osso" é SEMPRE o DOF `y`
 * da junta: pronação do antebraço (`elbow.*.y`), giro do ombro
 * (`shoulder.*.y`), torção do tronco (`spine.y`)… Juntas sem DOF em `y`
 * (dobradiças como o joelho) não têm torção — o controle nem aparece.
 *
 * A raiz gira livre: torcê-la é a colocação (para onde o boneco encara), sem
 * limite articular — quem aplica é `setRootRotation`, não o clamp de pose.
 */
export function twistAxisForJoint(jointName: string): Axis | null {
  if (jointName === ROOT_JOINT_NAME) return 'y'
  if (!JOINT_NAMES.includes(jointName)) return null
  return getJointAxes(jointName).includes('y') ? 'y' : null
}
