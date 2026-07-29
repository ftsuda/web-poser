import {
  JOINT_NAMES,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getJointSubtree,
  type JointRotation,
} from './skeleton'

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
 * ESCOPO (decidido com o usuário): as operações de LADO (`mirrorPoseSide`,
 * `swapPoseSides`) mexem apenas nas juntas pareadas (`.L`/`.R`) — braços, mãos,
 * pernas e pés. Tronco, pescoço, cabeça e a rotação/posição do boneco não são
 * tocados: a operação faz só o que o nome diz.
 *
 * O espelho COMPLETO (`mirrorPoseFull`, pedido posterior do usuário) é a
 * exceção deliberada: ele soma a essas a reflexão das juntas SEM par, que é o
 * que falta para o boneco ficar exatamente espelhado. Continua sem tocar na
 * colocação do boneco — ver o docblock da função.
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
 * Juntas SEM par: tronco (`spine`, `chest`, `upperChest`), pescoço e cabeça. A
 * raiz fica de fora de propósito — ela não é pose, é a COLOCAÇÃO do boneco
 * (inclinação e para onde ele encara), e quem a carrega é `figure.rotation`, e
 * não `figure.pose` (ver `Figure.tsx` e `poseLibrary.ts`).
 */
export const CENTRAL_JOINT_NAMES: readonly string[] = JOINT_NAMES.filter(
  (name) => getJointSide(name) === null && name !== ROOT_JOINT_NAME,
)

/**
 * Espelho COMPLETO do boneco (pedido do usuário): os membros trocam de lado,
 * como em `swapPoseSides`, **e** as juntas sem par têm a rotação refletida.
 *
 * É a mesma reflexão sagital `(x, y, z) → (x, -y, -z)` do resto do módulo — só
 * que numa junta central ela não tem para onde trocar, e por isso se aplica
 * sobre ela mesma. Sem esse passo, uma cabeça virada para a direita e um tronco
 * torcido ficavam para o mesmo lado enquanto os braços trocavam: o boneco saía
 * meio espelhado, que é exatamente a queixa que originou este pedido.
 *
 * Continua uma INVOLUÇÃO — aplicar duas vezes devolve a pose original —, então
 * serve de alternar. E, como em todo o módulo, o resultado passa pelos limites
 * da junta de destino: com os limites espelhados do esqueleto isso não corta
 * nada, mas um `joint-limits.json` do workspace pode ter apertado um lado.
 *
 * **Fica de fora a colocação do boneco** (`position` e `rotation`): espelhar o
 * heading giraria o boneco na cena e espelhar X o mudaria de lugar — isso é
 * refletir a CENA em torno do plano do mundo, não o boneco em torno do plano
 * dele. Aqui o boneco continua onde está e encarando para onde encarava; o que
 * vira do avesso é o corpo.
 */
export function mirrorPoseFull(pose: Record<string, JointRotation>): Record<string, JointRotation> {
  const next = swapPoseSides(pose)

  for (const name of CENTRAL_JOINT_NAMES) {
    next[name] = clampJointRotation(name, mirrorRotation(pose[name] ?? ZERO_ROTATION))
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
