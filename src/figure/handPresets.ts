import { mirrorRotation, type Side } from './poseMirror'
import { clampJointRotation, type JointRotation } from './skeleton'

/**
 * Poses predefinidas de MÃO (pedido do usuário, ver DECISOES.md #30), tratadas
 * separadamente das poses de corpo por dois motivos:
 * - são PARCIAIS: aplicam-se só às 5 juntas da mão de UM lado, preservando
 *   todo o resto da pose (inclusive a outra mão). As poses de corpo, ao
 *   contrário, substituem a pose inteira;
 * - cada mão é independente — "fechar a mão direita" não mexe na esquerda.
 *
 * O `wrist.*` NÃO entra: ele é o ângulo do punho (flexão/desvio), não a forma
 * da mão. Trocar a pose da mão preserva como o punho estava dobrado.
 *
 * Convenção de sinal dentro da mão (docblock de `skeleton.ts`, DECISOES.md
 * #25): `fingers*.x` positivo curva os dedos em direção à palma (-Z local);
 * `thumb1.x` positivo leva o polegar para o lado da palma e negativo para o
 * dorso; `thumb1.z` afasta/aproxima o polegar dos dedos (0 = máxima abertura);
 * `thumb2.y` dobra a ponta do polegar para a palma.
 *
 * Os valores são declarados UMA vez, na convenção do lado ESQUERDO, e o lado
 * direito sai por `mirrorRotation` (`x, -y, -z`) — as duas mãos são imagens
 * espelhadas exatas por construção, sem uma segunda tabela de números para
 * sair de sincronia (mesma regra e mesma justificativa de `poseMirror.ts`).
 */

export type HandPresetKey = 'open' | 'relaxed' | 'fist' | 'thumbsUp' | 'point' | 'pinch'

export const HAND_PRESET_KEYS: readonly HandPresetKey[] = [
  'open',
  'relaxed',
  'fist',
  'thumbsUp',
  'point',
  'pinch',
]

/** Juntas que formam a mão, sem o lado (o `wrist` fica de fora — ver docblock). */
export const HAND_JOINT_BASE_NAMES: readonly string[] = [
  'thumb1',
  'thumb2',
  'indexBase',
  'indexMid',
  'indexTip',
  'fingersBase',
  'fingersMid',
  'fingersTip',
]

type PartialHandPose = Partial<Record<string, Partial<JointRotation>>>

/** Valores na convenção do lado ESQUERDO; o lado direito é o espelho destes. */
const HAND_PRESETS_L: Record<HandPresetKey, PartialHandPose> = {
  // Mão totalmente aberta: é literalmente a pose neutra do esqueleto (dedos
  // retos ao longo de -Y, polegar na abertura máxima) — a mesma com que um
  // boneco novo nasce.
  open: {},

  // Mão relaxada: a curvatura de repouso de uma mão solta, aumentando das
  // juntas proximais para as distais, com o polegar levemente recolhido em
  // direção ao indicador.
  relaxed: {
    indexBase: { x: 25 },
    indexMid: { x: 35 },
    indexTip: { x: 25 },
    fingersBase: { x: 25 },
    fingersMid: { x: 35 },
    fingersTip: { x: 25 },
    thumb1: { x: 12, z: 12 },
    thumb2: { y: -25 },
  },

  // Punho fechado: dedos quase no limite de flexão e polegar dobrado POR CIMA
  // deles (x positivo = para o lado da palma, z aproximando dos dedos), como
  // um punho real — não enfiado por dentro.
  //
  // Adução do polegar de 35° para 75° (DECISOES.md #45): com 35° o "por cima"
  // do comentário era falso — a ponta parava em X = -6,4 cm, 2,4 cm FORA da
  // borda da mão (meia-largura 4,0 cm), fechando ao lado do punho. Valores
  // medidos: a ponta agora cai em (-0,032, -0,047, -0,052), 2,0 cm de folga
  // do eixo das falanges no plano YZ — exatamente apoiada sobre elas
  // (meia-espessura da lâmina 0,0095 + raio da ponta do polegar 0,0115).
  fist: {
    indexBase: { x: 85 },
    indexMid: { x: 105 },
    indexTip: { x: 80 },
    fingersBase: { x: 85 },
    fingersMid: { x: 105 },
    fingersTip: { x: 80 },
    thumb1: { x: 40, z: 75 },
    thumb2: { y: -65 },
  },

  // Thumbs-up: mesmo punho, porém com o polegar TOTALMENTE estendido — reto
  // (thumb2.y = 0) e na abertura máxima (z = 0), com um leve recuo para o
  // dorso (x negativo) para ele sair do plano dos dedos já enrolados em vez de
  // atravessá-los. Para onde o polegar aponta no MUNDO depende do braço: o
  // preset é o gesto da mão, não a orientação do antebraço.
  thumbsUp: {
    indexBase: { x: 88 },
    indexMid: { x: 108 },
    indexTip: { x: 85 },
    fingersBase: { x: 88 },
    fingersMid: { x: 108 },
    fingersTip: { x: 85 },
    thumb1: { x: -15, z: 0 },
    thumb2: { y: 0 },
  },

  // Apontar (DECISOES.md #45): o punho fechado com o INDICADOR estendido — o
  // gesto que o modelo não conseguia fazer enquanto os quatro dedos eram um
  // bloco só (as poses de apontar usavam mão-faca no lugar). O polegar repousa
  // sobre o bloco, exatamente como no punho fechado.
  point: {
    fingersBase: { x: 85 },
    fingersMid: { x: 105 },
    fingersTip: { x: 80 },
    thumb1: { x: 40, z: 75 },
    thumb2: { y: -65 },
  },

  // Pinça: ponta do polegar encostada na ponta do indicador (medido: 0,4 mm
  // entre as pontas), com os outros três recolhidos. Só existe porque a adução
  // do polegar passou a chegar a 80° no #45 — com os 40° anteriores a menor
  // distância possível entre as duas pontas era 2,61 cm.
  pinch: {
    indexBase: { x: 50 },
    indexMid: { x: 90 },
    indexTip: { x: 40 },
    fingersBase: { x: 35 },
    fingersMid: { x: 45 },
    fingersTip: { x: 30 },
    thumb1: { x: 40, z: 80 },
    thumb2: { y: -30 },
  },
}

/** Nomes das juntas da mão de um lado (`thumb1.L`, …) — nunca inclui o punho. */
export function getHandJointNames(side: Side): string[] {
  return HAND_JOINT_BASE_NAMES.map((base) => `${base}.${side}`)
}

/** `true` se a junta pertence à mão (polegar/dedos), ignorando o punho. */
export function isHandJoint(jointName: string): boolean {
  const [base] = jointName.split('.')
  return HAND_JOINT_BASE_NAMES.includes(base)
}

/**
 * Pose completa das 5 juntas da mão do lado indicado, já grampeada pelos
 * limites em vigor. Retorna só essas juntas — o chamador funde no restante da
 * pose, preservando punho, braço e a outra mão.
 */
export function resolveHandPreset(key: HandPresetKey, side: Side): Record<string, JointRotation> {
  const preset = HAND_PRESETS_L[key]
  const pose: Record<string, JointRotation> = {}

  for (const base of HAND_JOINT_BASE_NAMES) {
    const jointName = `${base}.${side}`
    const declared = preset[base] ?? {}
    const left: JointRotation = { x: declared.x ?? 0, y: declared.y ?? 0, z: declared.z ?? 0 }
    pose[jointName] = clampJointRotation(jointName, side === 'L' ? left : mirrorRotation(left))
  }

  return pose
}
