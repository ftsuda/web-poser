import { isHandJoint } from './handPresets'
import {
  JOINT_NAMES,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getJoint,
  type Axis,
  type JointRotation,
} from './skeleton'

/**
 * Pose aleatória (pedido do usuário, ver DECISOES.md #35): sorteia cada eixo
 * dentro da faixa da própria junta, o que garante uma pose sempre válida — não
 * há como o sorteio produzir um ângulo que o boneco não conseguiria fazer.
 *
 * ESCOPO (escolha do usuário): só as juntas do CORPO. As mãos ficam abertas
 * (neutras) e nem a posição nem a direção que o boneco encara mudam — o botão
 * sorteia a pose, não recoloca o boneco na cena.
 *
 * Os limites saem de `getJoint`, e não da tabela do código: assim um
 * `joint-limits.json` do workspace (DECISOES.md #29) aperta também o sorteio,
 * em vez de o botão furar a configuração do usuário.
 *
 * Os valores são inteiros, como os sliders do painel — meio grau de diferença
 * não muda nada na tela e só sujaria as poses salvas.
 *
 * O resultado NÃO é uma pose "plausível": ângulos independentes por junta
 * podem cruzar membros ou enfiar um pé no chão. É o que "qualquer pose dentro
 * dos limites" significa, e é o ponto do botão — servir de ponto de partida
 * inesperado para depois ajustar.
 */

const AXES: readonly Axis[] = ['x', 'y', 'z']

/** Juntas que o sorteio percorre: tudo o que é posável, menos as mãos e a raiz. */
export const RANDOM_POSE_JOINT_NAMES: readonly string[] = JOINT_NAMES.filter(
  (name) => name !== ROOT_JOINT_NAME && !isHandJoint(name),
)

/**
 * Monta uma pose completa (todas as juntas, menos a raiz) com os eixos do corpo
 * sorteados. `random` é injetável para os testes poderem fixar o sorteio.
 */
export function resolveRandomPose(random: () => number = Math.random): Record<string, JointRotation> {
  const pose: Record<string, JointRotation> = {}

  for (const jointName of JOINT_NAMES) {
    if (jointName === ROOT_JOINT_NAME) continue

    // Mão fora do sorteio: `clampJointRotation` sem eixo nenhum devolve o
    // neutro, que é exatamente a mão aberta (ver `handPresets.ts`).
    if (isHandJoint(jointName)) {
      pose[jointName] = clampJointRotation(jointName, {})
      continue
    }

    const { limits } = getJoint(jointName)
    const rotation: Partial<JointRotation> = {}
    for (const axis of AXES) {
      const limit = limits[axis]
      if (!limit) continue
      rotation[axis] = Math.round(limit.min + random() * (limit.max - limit.min))
    }
    pose[jointName] = clampJointRotation(jointName, rotation)
  }

  return pose
}
