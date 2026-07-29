/**
 * Agrupamento das juntas posáveis (tudo exceto `root`) para o combo box de
 * seleção de junta (pedido do usuário) — resolve o problema de chegar em
 * juntas que ficam encobertas por outras partes do corpo no viewport (ex.:
 * `fingersTip.*`, `upperChest`), sem precisar clicar exatamente nelas.
 */

import { getJointSide, type Side } from './poseMirror'

export type JointGroupKey = 'trunk' | 'head' | 'armRight' | 'armLeft' | 'legRight' | 'legLeft'

export interface JointGroup {
  key: JointGroupKey
  joints: readonly string[]
}

const TRUNK_JOINTS = ['spine', 'chest', 'upperChest'] as const
const HEAD_JOINTS = ['neck', 'head'] as const
const ARM_RIGHT_JOINTS = [
  'clavicle.R',
  'shoulder.R',
  'elbow.R',
  'wrist.R',
  'thumb1.R',
  'thumb2.R',
  'indexBase.R',
  'indexMid.R',
  'indexTip.R',
  'fingersBase.R',
  'fingersMid.R',
  'fingersTip.R',
] as const
const ARM_LEFT_JOINTS = ARM_RIGHT_JOINTS.map((name) => name.replace('.R', '.L'))
const LEG_RIGHT_JOINTS = ['hip.R', 'knee.R', 'ankle.R', 'ball.R'] as const
const LEG_LEFT_JOINTS = LEG_RIGHT_JOINTS.map((name) => name.replace('.R', '.L'))

/** Ordem de exibição: tronco, cabeça, braço direito/esquerdo, perna direita/esquerda (pedido do usuário). */
export const JOINT_GROUPS: readonly JointGroup[] = [
  { key: 'trunk', joints: TRUNK_JOINTS },
  { key: 'head', joints: HEAD_JOINTS },
  { key: 'armRight', joints: ARM_RIGHT_JOINTS },
  { key: 'armLeft', joints: ARM_LEFT_JOINTS },
  { key: 'legRight', joints: LEG_RIGHT_JOINTS },
  { key: 'legLeft', joints: LEG_LEFT_JOINTS },
]

const ARM_JOINTS_BY_SIDE: Record<Side, readonly string[]> = {
  R: ARM_RIGHT_JOINTS,
  L: ARM_LEFT_JOINTS,
}

/**
 * Lado do BRAÇO a que a junta pertence (da clavícula à ponta dos dedos), ou
 * `null` para qualquer outra. É o que decide se o painel oferece as poses de
 * mão daquele lado — selecionar `elbow.R` ou `fingersTip.R` mostra as poses da
 * mão direita, sem o usuário precisar escolher o lado num controle à parte
 * (ver DECISOES.md #30).
 */
export function getArmSide(jointName: string): Side | null {
  const side = getJointSide(jointName)
  if (!side) return null
  return ARM_JOINTS_BY_SIDE[side].includes(jointName) ? side : null
}
