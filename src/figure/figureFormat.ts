import {
  JOINT_NAMES,
  MAX_HEIGHT_M,
  MIN_HEIGHT_M,
  REFERENCE_HEIGHT_M,
  clampJointRotation,
  type JointRotation,
} from './skeleton'
import { withLegacyIndexFinger } from './poseCompat'
import { DEFAULT_FIGURE_COLOR, normalizeFigureColor, type Figure } from '../store/figuresStore'

/**
 * **A leitura de um boneco vindo de fora, num lugar só.** Todo arquivo e todo
 * `localStorage` deste app é entrada não confiável, e antes desta unificação
 * (DECISOES.md #86) havia QUATRO leitores independentes fazendo quase a mesma
 * coisa — `figureFromExtras` (cena), `sanitizeFigure` (animação e pose
 * avulsa), o bloco do `clipLibrary` e o do `poseLibrary` —, com três cópias
 * privadas de `asRecord`, `sanitizeRotation` e `sanitizeVec3`.
 *
 * Fica em `figure/` de propósito: o formato do boneco é do MODELO, ao lado do
 * `skeleton.ts` que define as juntas e do `poseCompat.ts` que migra as
 * antigas. Antes, `persistence/figurePoseFile.ts` importava a leitura de
 * `animation/animation.ts` — persistência perguntando ao animador qual é o
 * formato do boneco, que é a camada errada.
 *
 * ## As duas codificações de junta
 *
 * O projeto gravou por muito tempo a mesma rotação de dois jeitos: `[x,y,z]`
 * (cena e `poses.json`) e `{x,y,z}` (animação, trechos, pose avulsa). Desde o
 * #86 **tudo grava `{x,y,z}`**, mas a leitura aceita as duas para sempre — é o
 * que faz um workspace ou um autosave gravado antes continuar abrindo sem
 * conversor e sem subir a versão do formato, exatamente como já se fazia com
 * `keyframeCounter`/`snapshotCounter` e com `withLegacyIndexFinger`.
 *
 * ## Duas políticas de rotação, de propósito
 *
 * `toRotation` é ESTRITA e devolve `null` no que não dá para ler; `readRotation`
 * nunca falha e completa com zero. A diferença não é acidente: uma junta ilegível
 * numa POSE salva deve sumir (uma pose sem junta nenhuma é descartada como "não
 * é pose"), enquanto num BONECO ela vira ângulo zero — que é o mesmo que a junta
 * ausente já produz ao desenhar (`jointFrames` cai em `ZERO_ROTATION`).
 */

const AXES = ['x', 'y', 'z'] as const

export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * Rotação lida com rigor: aceita `[x,y,z]` e `{x,y,z}`, e devolve `null` para
 * qualquer outra coisa — inclusive para o objeto/tupla com um eixo faltando ou
 * não numérico. Use quando o dado ilegível deve ser DESCARTADO.
 */
export function toRotation(value: unknown): JointRotation | null {
  if (Array.isArray(value)) {
    if (value.length !== 3) return null
    const [x, y, z] = value.map(finiteNumber)
    return x === null || y === null || z === null ? null : { x, y, z }
  }

  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  const parsed = AXES.map((axis) => finiteNumber(source[axis]))
  return parsed.some((axis) => axis === null)
    ? null
    : { x: parsed[0] as number, y: parsed[1] as number, z: parsed[2] as number }
}

/**
 * Rotação lida com tolerância: as duas codificações, e o que não der para ler
 * vira zero — eixo a eixo, para que `{"x": 10, "y": "dez"}` conserve o x em vez
 * de perder a junta inteira. Nunca falha. Use na leitura de BONECO.
 */
export function readRotation(value: unknown): JointRotation {
  const strict = toRotation(value)
  if (strict) return strict

  // Tupla malformada não tem eixo nomeado a aproveitar; só o objeto sobrevive
  // parcialmente.
  if (Array.isArray(value) || typeof value !== 'object' || value === null) return { x: 0, y: 0, z: 0 }

  const source = value as Record<string, unknown>
  return { x: finiteNumber(source.x) ?? 0, y: finiteNumber(source.y) ?? 0, z: finiteNumber(source.z) ?? 0 }
}

/** Trinca de números finitos, ou o `fallback` — usada para colocação, alvo de câmera etc. */
export function toVec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) return fallback
  const [x, y, z] = value.map(finiteNumber)
  return x === null || y === null || z === null ? fallback : [x, y, z]
}

export function clampHeight(height: unknown): number {
  const value = finiteNumber(height)
  if (value === null) return REFERENCE_HEIGHT_M
  return Math.min(MAX_HEIGHT_M, Math.max(MIN_HEIGHT_M, value))
}

/**
 * Pose de um BONECO: juntas desconhecidas fora, ângulos grampeados pelos
 * limites em vigor, e o dedo indicador preenchido nas poses gravadas antes de
 * ele existir (DECISOES.md #45).
 *
 * A `root` passa: no boneco ela é ignorada ao desenhar (quem manda é
 * `figure.rotation`), mas descartá-la aqui apagaria silenciosamente um campo de
 * um arquivo editado à mão. Quem precisa dela fora é a POSE salva, que guarda a
 * inclinação do boneco num campo próprio — e por isso filtra a `root` no seu
 * próprio laço, em `poseLibrary.ts`.
 */
export function sanitizePose(value: unknown): Record<string, JointRotation> {
  const pose: Record<string, JointRotation> = {}
  for (const [jointName, rotation] of Object.entries(asRecord(value))) {
    if (!JOINT_NAMES.includes(jointName)) continue
    pose[jointName] = clampJointRotation(jointName, readRotation(rotation))
  }
  return withLegacyIndexFinger(pose)
}

/**
 * Lê UM boneco de dado não confiável — o objeto que aparece tanto em
 * `figures[]` de uma cena quanto em `keyframes[].figures[]` de uma animação
 * quanto no arquivo de pose avulsa. É o mesmo objeto nos três, e é por isso que
 * a pose montada no celular emenda como keyframe sem conversão nenhuma.
 *
 * `joints` é lido como sinônimo de `pose`: era o nome do campo nos arquivos de
 * cena e nos autosaves gravados antes do #86.
 */
export function sanitizeFigure(value: unknown, index: number): Figure {
  const source = asRecord(value)

  return {
    id: typeof source.id === 'string' ? source.id : `figure-${index + 1}`,
    name: typeof source.name === 'string' ? source.name : `Figure ${index + 1}`,
    // Cor livre desde DECISOES.md #39: qualquer `#rrggbb` serve, mas uma string
    // que não seja cor NÃO passa — ela iria direto para o material do three.js
    // e para o `style` do painel.
    color: normalizeFigureColor(source.color) ?? DEFAULT_FIGURE_COLOR,
    visible: typeof source.visible === 'boolean' ? source.visible : true,
    height: clampHeight(source.height),
    position: toVec3(source.position, [0, 0, 0]),
    rotation: readRotation(source.rotation),
    pose: sanitizePose(source.pose ?? source.joints),
  }
}
