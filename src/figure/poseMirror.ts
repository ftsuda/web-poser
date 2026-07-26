import { JOINT_NAMES, clampJointRotation, getJointSubtree, type JointRotation } from './skeleton'

/**
 * Simetria esquerda/direita da pose (pedido do usuário, ver DECISOES.md #30):
 * copiar um lado espelhado para o outro e inverter os dois lados.
 *
 * A regra do espelho sagital é `(x, y, z) → (x, -y, -z)` na junta pareada, e
 * ela é **exata** — não uma aproximação. Dois motivos, ambos já documentados
 * no `skeleton.ts`:
 * - Rotação é pseudovetor: sob a reflexão `M = diag(-1, 1, 1)`, a componente
 *   ao longo de X se preserva e as perpendiculares invertem. Para Euler XYZ
 *   isso fecha exatamente, porque `M·Rx(a)Ry(b)Rz(c)·M = Rx(a)Ry(-b)Rz(-c)`
 *   (M comuta com Rx e conjuga Ry/Rz na rotação inversa).
 * - As juntas pareadas do esqueleto são espelhadas só em POSIÇÃO (offset X
 *   negado), sem espelhar a rotação — é exatamente o que faz o mesmo valor
 *   numérico produzir o movimento anatômico oposto em Y/Z (DECISOES.md #14).
 *
 * Verificado numericamente (não deduzido): montando a cinemática direta com
 * uma pose arbitrária de um lado e o espelho do outro, cada junta pareada cai
 * na posição de mundo do par com X negado, com erro 0,000 m — ver
 * `__tests__/poseMirror.test.ts`. Copiar sem negar Y/Z erra até 0,95 m.
 *
 * Para a regra valer sem perdas, os LIMITES dos dois lados precisam ser
 * espelho um do outro nos eixos Y/Z. Todos são — o `clavicle.R.z` era a única
 * exceção e foi corrigido no #30; a trava de regressão está em
 * `skeleton.test.ts`.
 *
 * ESCOPO (decidido com o usuário): a operação mexe apenas nas juntas pareadas
 * (`.L`/`.R`) — braços, mãos, pernas e pés. Tronco, pescoço, cabeça e a
 * rotação/posição do boneco não são tocados: a operação faz só o que o nome
 * diz.
 *
 * Esse escopo ainda pode ser RESTRINGIDO a uma junta e seus descendentes
 * (`scopeJoint`, ver `getMirrorScope` e DECISOES.md #34): com o ombro direito
 * selecionado, espelhar/inverter valem do ombro à ponta dos dedos e as pernas
 * ficam intactas. Sem `scopeJoint` o comportamento é o de antes — o boneco
 * inteiro.
 */

export type Side = 'L' | 'R'

export const SIDES: readonly Side[] = ['L', 'R']

/** Lado da junta, ou `null` se ela for central (tronco/pescoço/cabeça/root). */
export function getJointSide(jointName: string): Side | null {
  if (jointName.endsWith('.L')) return 'L'
  if (jointName.endsWith('.R')) return 'R'
  return null
}

/** Nome da junta correspondente do outro lado, ou `null` se a junta for central. */
export function getMirroredJointName(jointName: string): string | null {
  const side = getJointSide(jointName)
  if (!side) return null
  return `${jointName.slice(0, -1)}${side === 'L' ? 'R' : 'L'}`
}

/** Juntas pareadas do lado indicado, na ordem do `skeleton.ts`. */
export function getSideJointNames(side: Side): string[] {
  return JOINT_NAMES.filter((name) => getJointSide(name) === side)
}

const PAIRED_JOINT_NAMES: readonly string[] = JOINT_NAMES.filter(
  (name) => getJointSide(name) !== null,
)

/**
 * Juntas pareadas que uma operação de simetria pode tocar, partindo da junta
 * selecionada (pedido do usuário, ver DECISOES.md #34): ela e seus
 * descendentes, **dos dois lados** — o par de destino é tão afetado quanto a
 * origem. Sem junta (ou na raiz) é o boneco inteiro, que era o comportamento
 * único até então.
 *
 * O escopo não depende do LADO da junta selecionada, só de onde ela fica na
 * cadeia: selecionar `shoulder.L` ou `shoulder.R` delimita o mesmo par de
 * braços, e quem escolhe a direção da cópia é o botão.
 *
 * É vazio nas juntas sem par nenhum embaixo (pescoço, cabeça) — aí não há
 * simetria a oferecer.
 */
export function getMirrorScope(scopeJoint?: string | null): readonly string[] {
  if (!scopeJoint) return PAIRED_JOINT_NAMES

  const subtree = new Set(getJointSubtree(scopeJoint))
  return PAIRED_JOINT_NAMES.filter(
    (name) => subtree.has(name) || subtree.has(getMirroredJointName(name) as string),
  )
}

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }

/**
 * Nega um ângulo sem produzir `-0`: um zero negado continua sendo o mesmo
 * ângulo, mas `-0` vazaria para dentro das poses salvas e faria comparações de
 * igualdade estrutural (testes, `equality` do undo) enxergarem diferença onde
 * não há.
 */
export function negateAngle(degrees: number): number {
  return degrees === 0 ? 0 : -degrees
}

/** Reflexão sagital de uma rotação: X preservado, Y e Z negados (ver docblock). */
export function mirrorRotation(rotation: JointRotation): JointRotation {
  return { x: rotation.x, y: negateAngle(rotation.y), z: negateAngle(rotation.z) }
}

/**
 * Copia o lado `from` espelhado para o outro lado, mantendo tudo o mais como
 * está. O resultado passa por `clampJointRotation` na junta de DESTINO — com
 * os limites espelhados do esqueleto isso nunca corta nada, mas um
 * `joint-limits.json` do workspace (DECISOES.md #29) pode ter apertado um dos
 * lados, e nesse caso é o limite em vigor que manda.
 */
export function mirrorPoseSide(
  pose: Record<string, JointRotation>,
  from: Side,
  scopeJoint?: string | null,
): Record<string, JointRotation> {
  const next = { ...pose }
  const scope = new Set(getMirrorScope(scopeJoint))

  for (const sourceName of getSideJointNames(from)) {
    const targetName = getMirroredJointName(sourceName)
    if (!targetName || !scope.has(sourceName)) continue
    next[targetName] = clampJointRotation(
      targetName,
      mirrorRotation(pose[sourceName] ?? ZERO_ROTATION),
    )
  }

  return next
}

/**
 * Troca as poses dos dois lados, cada uma espelhada ao mudar de lado —
 * "inverter esquerda e direita". Aplicar duas vezes devolve a pose original
 * (involução), o que a torna segura de usar como toggle.
 */
export function swapPoseSides(
  pose: Record<string, JointRotation>,
  scopeJoint?: string | null,
): Record<string, JointRotation> {
  const next = { ...pose }
  const scope = new Set(getMirrorScope(scopeJoint))

  for (const sourceName of getSideJointNames('L')) {
    const targetName = getMirroredJointName(sourceName)
    if (!targetName || !scope.has(sourceName)) continue
    next[targetName] = clampJointRotation(targetName, mirrorRotation(pose[sourceName] ?? ZERO_ROTATION))
    next[sourceName] = clampJointRotation(sourceName, mirrorRotation(pose[targetName] ?? ZERO_ROTATION))
  }

  return next
}
