import { sanitizeSavedPoses, type SavedPose } from '../figure/poseLibrary'
import type { JointRotation } from '../figure/skeleton'

/**
 * Schema do `poses.json` gravado junto com o workspace: a biblioteca de poses
 * do usuário (PLANO.md > "Ideias e melhorias" > A.1). Segue o mesmo padrão do
 * `joint-limits.json` (DECISOES.md #29): arquivo separado do manifesto,
 * apontado por ele, auto-explicativo e sanitizado na leitura.
 *
 * A biblioteca é do WORKSPACE, não de uma cena: é o que permite montar uma
 * pose numa cena e reaplicá-la em qualquer boneco de qualquer outra. Por isso
 * ela não entra no arquivo de cena nenhuma.
 */

export const POSES_FILENAME = 'poses.json'
export const POSES_VERSION = 1

/** Explicação embutida no próprio arquivo — JSON não aceita comentários. */
const README_LINES: readonly string[] = [
  'Biblioteca de poses do usuário. Cada pose guarda as juntas em GRAUS, como {"x":0,"y":0,"z":0} por junta — o mesmo formato do boneco no scene.json e no animations.json.',
  'A forma antiga [x, y, z] continua sendo aceita na leitura: um poses.json gravado antes ainda abre, e quem edita à mão pode usar qualquer uma das duas.',
  '"rotation" é a inclinação do boneco e "groundOffsetM" a altura do quadril em relação à pose em pé, em metros na altura de referência (1,70 m) — é o que faz uma pose deitada voltar deitada.',
  'Com "rotation" em [0,0,0] a pose é considerada em pé: aplicar preserva a direção que o boneco já encarava no chão.',
  'Onde o boneco está no chão (X/Z), a altura, a cor e o nome dele NÃO fazem parte da pose.',
  'Cuidado com pares L/R: nos eixos y e z o MESMO número produz o movimento oposto nos dois lados (ver DECISOES.md #14).',
  'Poses inválidas (sem juntas conhecidas) são ignoradas; juntas fora dos limites em vigor são ajustadas para dentro deles.',
]

export interface SavedPoseJson {
  id: string
  name: string
  rotation: JointRotation
  groundOffsetM: number
  pose: Record<string, JointRotation>
}

export interface PosesFile {
  version: number
  leiame: readonly string[]
  poses: SavedPoseJson[]
}

export function savedPoseToJson(pose: SavedPose): SavedPoseJson {
  const joints: Record<string, JointRotation> = {}
  for (const [jointName, rotation] of Object.entries(pose.pose)) {
    joints[jointName] = { ...rotation }
  }

  return {
    id: pose.id,
    name: pose.name,
    rotation: { ...pose.rotation },
    groundOffsetM: pose.groundOffsetM,
    // `preservesHeading` NÃO é gravado: é derivado da rotação, e um campo
    // redundante num arquivo editável à mão só serviria para contradizer o
    // outro (ver `sanitizeSavedPoses`).
    pose: joints,
  }
}

export function buildPosesFile(poses: readonly SavedPose[]): PosesFile {
  return { version: POSES_VERSION, leiame: README_LINES, poses: poses.map(savedPoseToJson) }
}

/**
 * Lê um `poses.json` (nunca confiável). Aceita tanto o arquivo completo quanto
 * a lista de poses crua — quem edita à mão às vezes cola só o array.
 */
export function parsePosesFile(json: unknown): SavedPose[] {
  if (Array.isArray(json)) return sanitizeSavedPoses(json)
  const source = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>
  return sanitizeSavedPoses(source.poses)
}
