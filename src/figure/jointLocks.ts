import { JOINT_NAMES, ROOT_JOINT_NAME, type Axis } from './skeleton'

/**
 * Travamento de juntas (PLANO.md > "Ideias e melhorias" > A.5): marcar uma
 * junta já ajustada para que nada a desmanche sem querer.
 *
 * **Uma regra só, decidida com o usuário:** junta travada não muda por NADA
 * automático — slider, gizmo, teclado, IK, sorteio, espelhar/inverter e
 * aplicar pose (de fábrica ou da biblioteca). O valor está em não precisar
 * lembrar de exceções; em troca, o painel mostra quantas juntas estão
 * travadas, para o efeito nunca ficar inexplicável.
 *
 * **O lock é estado de TRABALHO, não conteúdo da cena** (decisão do usuário):
 * vive na sessão e no autosave do navegador, e não entra no arquivo da cena — que
 * continua contendo só a pose. Por isso também fica fora do histórico de undo:
 * travar não é uma edição do boneco.
 *
 * O mapa é por boneco (`id` → juntas travadas). A `root` crua nunca entra:
 * ela é a colocação do boneco na cena, não parte da pose. O que entra por ela
 * são os TOKENS DE EIXO do item 64 (`root.x`/`root.y`/`root.z`) — a trava por
 * eixo da rotação da raiz, no mesmo mapa para herdar persistência, cópia no
 * duplicar e poda sem um segundo mecanismo. Os tokens nunca colidem com nome
 * de junta e passam ilesos por `mergeLockedJoints` (não são chave de pose).
 */
export type JointLockMap = Record<string, readonly string[]>

const NO_LOCKS: readonly string[] = []

/** Ordem canônica dos eixos da raiz — a mesma dos sliders. */
const ROOT_AXES: readonly Axis[] = ['x', 'y', 'z']

/** O token de trava do eixo da raiz (item 64): `root.x`, `root.y` ou `root.z`. */
export function rootAxisLockToken(axis: Axis): string {
  return `${ROOT_JOINT_NAME}.${axis}`
}

function isRootAxisToken(name: string): boolean {
  return ROOT_AXES.some((axis) => name === rootAxisLockToken(axis))
}

/** Eixos da raiz travados no boneco, sempre na ordem x, y, z. */
export function getLockedRootAxes(locks: JointLockMap, figureId: string): readonly Axis[] {
  const locked = getLockedJoints(locks, figureId)
  return ROOT_AXES.filter((axis) => locked.includes(rootAxisLockToken(axis)))
}

export function isRootAxisLocked(locks: JointLockMap, figureId: string, axis: Axis): boolean {
  return getLockedJoints(locks, figureId).includes(rootAxisLockToken(axis))
}

export function getLockedJoints(locks: JointLockMap, figureId: string): readonly string[] {
  return locks[figureId] ?? NO_LOCKS
}

export function isJointLocked(locks: JointLockMap, figureId: string, jointName: string): boolean {
  return getLockedJoints(locks, figureId).includes(jointName)
}

/**
 * Trava/destrava uma junta — ou um EIXO da raiz, pelo token do item 64.
 * Nomes desconhecidos e a `root` crua são ignorados (devolve o mesmo mapa).
 */
export function toggleJointLock(locks: JointLockMap, figureId: string, jointName: string): JointLockMap {
  const lockable =
    isRootAxisToken(jointName) || (jointName !== ROOT_JOINT_NAME && JOINT_NAMES.includes(jointName))
  if (!lockable) return locks

  const current = getLockedJoints(locks, figureId)
  const next = current.includes(jointName)
    ? current.filter((name) => name !== jointName)
    : [...current, jointName]

  // Boneco sem trava nenhuma sai do mapa: assim "tem trava?" é só olhar a
  // chave, e o autosave não carrega listas vazias.
  if (next.length === 0) return clearFigureLocks(locks, figureId)
  return { ...locks, [figureId]: next }
}

export function clearFigureLocks(locks: JointLockMap, figureId: string): JointLockMap {
  if (!(figureId in locks)) return locks
  const next = { ...locks }
  delete next[figureId]
  return next
}

/** Duplicar um boneco leva as travas junto: é o mesmo boneco de trabalho, com a mesma pose. */
export function copyFigureLocks(locks: JointLockMap, fromId: string, toId: string): JointLockMap {
  const source = getLockedJoints(locks, fromId)
  if (source.length === 0) return locks
  return { ...locks, [toId]: [...source] }
}

/**
 * Mantém só as travas de bonecos que ainda existem — ids de boneco são
 * gerados por cena, então trocar de cena deixaria travas órfãs apontando para
 * ids que voltariam a ser usados.
 */
export function pruneJointLocks(locks: JointLockMap, figureIds: readonly string[]): JointLockMap {
  const alive = new Set(figureIds)
  const next: JointLockMap = {}
  for (const [figureId, joints] of Object.entries(locks)) {
    if (alive.has(figureId)) next[figureId] = joints
  }
  return next
}

/** Sanitiza o mapa vindo do autosave (nunca confiável): nomes de junta conhecidos e tokens de eixo da raiz, sem `root` crua e sem repetição. */
export function sanitizeJointLocks(raw: unknown): JointLockMap {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}

  const locks: JointLockMap = {}
  for (const [figureId, joints] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(joints)) continue
    const valid = [
      ...new Set(
        joints.filter(
          (joint): joint is string =>
            typeof joint === 'string' &&
            (isRootAxisToken(joint) ||
              (joint !== ROOT_JOINT_NAME && JOINT_NAMES.includes(joint))),
        ),
      ),
    ]
    if (valid.length > 0) locks[figureId] = valid
  }
  return locks
}

/**
 * Aplica uma pose nova preservando as juntas travadas — o ponto único por onde
 * passa toda escrita em massa (preset, biblioteca, sorteio, espelho, import).
 */
export function mergeLockedJoints<T>(
  current: Record<string, T>,
  next: Record<string, T>,
  locked: readonly string[],
): Record<string, T> {
  if (locked.length === 0) return next

  const merged = { ...next }
  for (const jointName of locked) {
    if (jointName in current) merged[jointName] = current[jointName]
  }
  return merged
}
