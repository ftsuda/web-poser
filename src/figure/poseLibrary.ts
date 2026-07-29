import { JOINT_NAMES, ROOT_JOINT_NAME, clampJointRotation, getHeightScale, type JointRotation } from './skeleton'
import { withLegacyIndexFinger } from './poseCompat'
import type { Figure } from '../store/figuresStore'

/**
 * Biblioteca de poses do usuário (PLANO.md > "Ideias e melhorias" > A.1): uma
 * pose montada à mão vira item nomeado, reaplicável em qualquer boneco de
 * qualquer cena. Este módulo é a parte PURA — o que uma pose salva guarda e
 * como ela é capturada de um boneco; o store aplica (`applySavedPose`) e a
 * persistência grava (`posesFile.ts` na pasta, autosave no navegador).
 *
 * **O que é guardado, e por quê.** Além das juntas, uma pose salva guarda o
 * ASSENTAMENTO: a inclinação do boneco e a altura do quadril, exatamente os
 * dois campos que `PosePresetPlacement` já carrega nas poses de fábrica
 * (DECISOES.md #30). Sem eles, salvar uma pose deitada e reaplicá-la traria o
 * boneco de volta em pé e atravessando o chão — decisão do usuário, que
 * escolheu "pose + assentamento" para que as poses do usuário sejam tão
 * capazes quanto as de fábrica.
 *
 * **O que NUNCA é guardado:** onde o boneco está no chão (X/Z), a altura dele,
 * a cor e o nome. Isso é identidade/encenação de cada boneco, não a pose — a
 * mesma regra que `applyPosePreset` já segue.
 */
export interface SavedPose {
  id: string
  name: string
  /** Rotação de cada junta não-root, em graus. */
  pose: Record<string, JointRotation>
  /** Inclinação do boneco (rotação do root), em graus — `{0,0,0}` nas poses em pé. */
  rotation: JointRotation
  /**
   * Deslocamento vertical do quadril em relação à pose em pé, em metros NA
   * ALTURA DE REFERÊNCIA (1,70 m) — mesma unidade de
   * `PosePresetPlacement.groundOffsetM`, para que aplicar em bonecos de
   * alturas diferentes escale igual.
   */
  groundOffsetM: number
  /**
   * `true` quando a pose não inclina o boneco: aí o giro em Y (para onde ele
   * encara no chão) é encenação do usuário e é preservado ao aplicar. Nas
   * poses inclinadas a rotação é imposta inteira — misturar a inclinação com
   * um giro prévio deixaria o boneco rolado sobre o próprio eixo.
   */
  preservesHeading: boolean
}

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }

/**
 * Captura a pose de um boneco. `preservesHeading` é DERIVADO da rotação: um
 * boneco sem inclinação (X e Z zerados) está em pé, e aí o giro em Y dele não
 * faz parte da pose — é para onde ele estava encarando na cena.
 */
export function captureFigurePose(figure: Figure, id: string, name: string): SavedPose {
  const upright = figure.rotation.x === 0 && figure.rotation.z === 0

  const pose: Record<string, JointRotation> = {}
  for (const [jointName, rotation] of Object.entries(figure.pose)) {
    if (jointName === ROOT_JOINT_NAME) continue
    pose[jointName] = { ...rotation }
  }

  return {
    id,
    name,
    pose,
    rotation: upright ? { ...ZERO_ROTATION } : { ...figure.rotation },
    // Desfaz a escala do boneco: a mesma pose salva de um boneco de 1,50 m e
    // de um de 1,90 m tem de dar o mesmo número aqui.
    groundOffsetM: figure.position[1] / getHeightScale(figure.height),
    preservesHeading: upright,
  }
}

/**
 * Sanitiza uma lista de poses vinda de fora (arquivo da pasta ou autosave —
 * nunca confiável): descarta o que não for pose reconhecível e grampeia cada
 * junta nos limites em vigor, do mesmo jeito que `figureFromExtras` faz com as
 * poses das cenas. Uma pose sem junta nenhuma é descartada: não é pose.
 */
export function sanitizeSavedPoses(raw: unknown, fallbackPrefix = 'pose'): SavedPose[] {
  if (!Array.isArray(raw)) return []

  const poses: SavedPose[] = []
  const usedIds = new Set<string>()

  raw.forEach((entry, index) => {
    const source = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>

    const pose: Record<string, JointRotation> = {}
    const joints = source.pose
    if (typeof joints === 'object' && joints !== null) {
      for (const [jointName, rotation] of Object.entries(joints as Record<string, unknown>)) {
        if (jointName === ROOT_JOINT_NAME || !JOINT_NAMES.includes(jointName)) continue
        const parsed = toRotation(rotation)
        if (parsed) pose[jointName] = clampJointRotation(jointName, parsed)
      }
    }
    if (Object.keys(pose).length === 0) return
    // Mesma migração das cenas (DECISOES.md #45): pose salva antes do dedo
    // indicador separado recebe o indicador copiado do bloco.
    const migrated = withLegacyIndexFinger(pose)

    let id = typeof source.id === 'string' && source.id.trim() !== '' ? source.id : `${fallbackPrefix}-${index + 1}`
    while (usedIds.has(id)) id = `${id}-2`
    usedIds.add(id)

    const rotation = toRotation(source.rotation) ?? { ...ZERO_ROTATION }
    const upright = rotation.x === 0 && rotation.z === 0

    poses.push({
      id,
      name: typeof source.name === 'string' && source.name.trim() !== '' ? source.name : id,
      pose: migrated,
      rotation,
      groundOffsetM: typeof source.groundOffsetM === 'number' && Number.isFinite(source.groundOffsetM)
        ? source.groundOffsetM
        : 0,
      // `preservesHeading` é redundante com a rotação, e num arquivo editado à
      // mão os dois podem se contradizer: a rotação é a fonte da verdade.
      preservesHeading: upright,
    })
  })

  return poses
}

/** Aceita tanto `{x,y,z}` quanto a tupla `[x,y,z]` — a mesma pose pode chegar do JSON da pasta ou do autosave. */
function toRotation(value: unknown): JointRotation | null {
  if (Array.isArray(value)) {
    if (value.length !== 3 || value.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null
    const [x, y, z] = value as [number, number, number]
    return { x, y, z }
  }
  if (typeof value !== 'object' || value === null) return null
  const source = value as Record<string, unknown>
  const axes = ['x', 'y', 'z'] as const
  if (axes.some((axis) => typeof source[axis] !== 'number' || !Number.isFinite(source[axis] as number))) return null
  return { x: source.x as number, y: source.y as number, z: source.z as number }
}
