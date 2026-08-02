import { JOINT_NAMES, ROOT_JOINT_NAME, getJointChain } from './skeleton'

/**
 * Âncora de junta (PLANO.md, item 62): fixar a POSIÇÃO de uma junta no mundo.
 * Num esqueleto FK a posição de uma junta depende só dos ancestrais dela e da
 * colocação da raiz — então a âncora não pede solver nenhum: ela DERIVA um
 * conjunto de juntas congeladas (a cadeia inteira de ancestrais) que se soma
 * às travas manuais do #42 em todo ponto que já as consulta, e congela a
 * colocação do boneco (posição E rotação da raiz). A rotação da própria junta
 * ancorada continua livre — cotovelo ancorado ainda dobra, movendo o punho
 * (decisão do usuário; rigidez total é âncora + cadeado na mesma junta).
 *
 * Várias âncoras por boneco valem por UNIÃO das cadeias. E, como a trava, a
 * âncora é estado de TRABALHO: sessão e autosave, fora do undo e fora do
 * arquivo de cena. A `root` não é ancorável — âncora em `spine`/`hip.*`, cuja
 * cadeia é só a raiz, congela apenas a colocação (útil por si).
 */
export type JointPinMap = Record<string, readonly string[]>

const NO_PINS: readonly string[] = []

export function getPinnedJoints(pins: JointPinMap, figureId: string): readonly string[] {
  return pins[figureId] ?? NO_PINS
}

export function isJointPinned(pins: JointPinMap, figureId: string, jointName: string): boolean {
  return getPinnedJoints(pins, figureId).includes(jointName)
}

/** Ancora/solta uma junta. Nomes desconhecidos e a `root` são ignorados (devolve o mesmo mapa). */
export function toggleJointPin(pins: JointPinMap, figureId: string, jointName: string): JointPinMap {
  if (jointName === ROOT_JOINT_NAME || !JOINT_NAMES.includes(jointName)) return pins

  const current = getPinnedJoints(pins, figureId)
  const next = current.includes(jointName)
    ? current.filter((name) => name !== jointName)
    : [...current, jointName]

  if (next.length === 0) return clearFigurePins(pins, figureId)
  return { ...pins, [figureId]: next }
}

export function clearFigurePins(pins: JointPinMap, figureId: string): JointPinMap {
  if (!(figureId in pins)) return pins
  const next = { ...pins }
  delete next[figureId]
  return next
}

/** Duplicar um boneco leva as âncoras junto, pela mesma razão das travas: é o mesmo trabalho protegido. */
export function copyFigurePins(pins: JointPinMap, fromId: string, toId: string): JointPinMap {
  const source = getPinnedJoints(pins, fromId)
  if (source.length === 0) return pins
  return { ...pins, [toId]: [...source] }
}

/** Mantém só as âncoras de bonecos que ainda existem — mesma razão do `pruneJointLocks`. */
export function pruneJointPins(pins: JointPinMap, figureIds: readonly string[]): JointPinMap {
  const alive = new Set(figureIds)
  const next: JointPinMap = {}
  for (const [figureId, joints] of Object.entries(pins)) {
    if (alive.has(figureId)) next[figureId] = joints
  }
  return next
}

/** Sanitiza o mapa vindo do autosave: só nomes de junta conhecidos, sem `root` e sem repetição. */
export function sanitizeJointPins(raw: unknown): JointPinMap {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}

  const pins: JointPinMap = {}
  for (const [figureId, joints] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(joints)) continue
    const valid = [
      ...new Set(
        joints.filter(
          (joint): joint is string =>
            typeof joint === 'string' && joint !== ROOT_JOINT_NAME && JOINT_NAMES.includes(joint),
        ),
      ),
    ]
    if (valid.length > 0) pins[figureId] = valid
  }
  return pins
}

/**
 * O conjunto DERIVADO da âncora: os ancestrais de cada junta ancorada (união),
 * sem a raiz — a colocação congelada é `isPlacementPinned`, guardada à parte
 * porque a raiz não faz parte da pose. É este conjunto que se soma às travas
 * manuais em todo consumidor do #42.
 */
export function frozenJointsByPins(pins: JointPinMap, figureId: string): readonly string[] {
  const pinned = getPinnedJoints(pins, figureId)
  if (pinned.length === 0) return NO_PINS

  const frozen = new Set<string>()
  for (const jointName of pinned) {
    // A cadeia vem raiz-primeiro e inclui a própria junta: fatiar as pontas
    // deixa só os ancestrais que são pose (a rotação da ancorada fica livre).
    for (const ancestor of getJointChain(jointName).slice(1, -1)) frozen.add(ancestor)
  }
  return [...frozen]
}

/** Qualquer âncora congela a colocação: mover ou girar a raiz moveria a junta fixada. */
export function isPlacementPinned(pins: JointPinMap, figureId: string): boolean {
  return getPinnedJoints(pins, figureId).length > 0
}
