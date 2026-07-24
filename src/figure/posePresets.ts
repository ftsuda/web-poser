import { JOINT_NAMES, ROOT_JOINT_NAME, clampJointRotation, type JointRotation } from './skeleton'

/**
 * Poses predefinidas (em pé, sentado, andando, correndo) como ponto de
 * partida para posar um boneco — ver PLANO.md > "Interação de pose", item
 * 4. Cada preset é parcial (só lista os eixos/juntas que se afastam da pose
 * neutra); `resolvePosePreset` completa com zero e grampeia pelos limites de
 * `skeleton.ts`, gerando uma pose completa pronta para substituir
 * `figure.pose`. Convenção de sinal de `hip.x`/`shoulder.x` (**negativo**
 * flexiona para a frente, positivo estende para trás) confirmada
 * numericamente montando a cinemática direta e medindo a posição resultante
 * da junta no mundo — não por dedução (ver DECISOES.md #13, que também
 * documenta a correção dos limites de `skeleton.ts` para o lado "frente"
 * ter o alcance anatômico maior).
 */

export type PosePresetKey = 'standing' | 'sitting' | 'walking' | 'running'

export const POSE_PRESET_KEYS: readonly PosePresetKey[] = ['standing', 'sitting', 'walking', 'running']

type PartialPose = Partial<Record<string, Partial<JointRotation>>>

const POSE_PRESETS: Record<PosePresetKey, PartialPose> = {
  // Pose neutra do próprio skeleton.ts já é uma postura em pé relaxada.
  standing: {},

  sitting: {
    'hip.L': { x: -90 },
    'hip.R': { x: -90 },
    'knee.L': { x: 95 },
    'knee.R': { x: 95 },
    'ankle.L': { x: -5 },
    'ankle.R': { x: -5 },
  },

  walking: {
    'hip.L': { x: -25 },
    'knee.L': { x: 20 },
    'ankle.R': { x: 5 },
    'hip.R': { x: 20 },
    'knee.R': { x: 10 },
    'shoulder.L': { x: 20 },
    'elbow.L': { x: 10 },
    'shoulder.R': { x: -20 },
    'elbow.R': { x: 15 },
  },

  running: {
    'hip.L': { x: -50 },
    'knee.L': { x: 80 },
    'ankle.L': { x: -10 },
    'hip.R': { x: 25 },
    'knee.R': { x: 40 },
    'ankle.R': { x: 10 },
    'shoulder.L': { x: 40 },
    'elbow.L': { x: 60 },
    'shoulder.R': { x: -45 },
    'elbow.R': { x: 90 },
  },
}

const POSABLE_JOINT_NAMES: readonly string[] = JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)

/** Monta a pose completa (todas as juntas, exceto o root) de um preset, grampeada pelos limites de cada junta. */
export function resolvePosePreset(key: PosePresetKey): Record<string, JointRotation> {
  const preset = POSE_PRESETS[key]
  const pose: Record<string, JointRotation> = {}

  for (const jointName of POSABLE_JOINT_NAMES) {
    pose[jointName] = clampJointRotation(jointName, preset[jointName] ?? {})
  }

  return pose
}
