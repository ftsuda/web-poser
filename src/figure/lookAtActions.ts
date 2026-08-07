import * as THREE from 'three'
import { buildJointFrames } from './jointFrames'
import { solveLookAt } from './lookAt'
import { effectiveLockedJoints, useFiguresStore } from '../store/figuresStore'

/**
 * Liga o solver de "olhar para" (`lookAt.ts`, puro) ao `figuresStore` — mesmo
 * papel do `dragActions.ts` para o arrasto de junta (PLANO.md item 32).
 *
 * O alvo pode ser um ponto do mundo, a câmera de cena ou outro boneco. É ação
 * ÚNICA, não modo ao vivo: um clique, um passo de undo. Seguir a câmera
 * continuamente brigaria com o histórico (cada órbita empilharia um passo) e
 * com a ideia de que a colocação é decisão do usuário.
 */
export type LookAtTarget =
  | { kind: 'sceneCamera' }
  | { kind: 'figure'; figureId: string }
  | { kind: 'point'; position: readonly [number, number, number] }

/** Para onde o boneco olha quando o alvo é outro boneco: a cabeça dele. */
function figureHeadPosition(figureId: string): [number, number, number] | null {
  const figure = useFiguresStore.getState().figures.find((candidate) => candidate.id === figureId)
  if (!figure) return null
  const { joints } = buildJointFrames(figure)
  const head = joints.get('head')
  if (!head) return null
  const world = head.getWorldPosition(new THREE.Vector3())
  return [world.x, world.y, world.z]
}

export function resolveLookAtTarget(target: LookAtTarget): [number, number, number] | null {
  if (target.kind === 'point') return [...target.position] as [number, number, number]
  if (target.kind === 'figure') return figureHeadPosition(target.figureId)
  // A câmera de CENA, e não a órbita do viewport: é ela que vai tirar a foto, e
  // é para a lente que a pessoa da referência tem de olhar.
  const [x, y, z] = useFiguresStore.getState().sceneCamera.position
  return [x, y, z]
}

/** `true` quando a pose mudou; `false` quando não havia o que mirar. */
export function applyLookAt(figureId: string, target: LookAtTarget): boolean {
  const state = useFiguresStore.getState()
  const figure = state.figures.find((candidate) => candidate.id === figureId)
  if (!figure) return false

  // Mirar em si mesmo não faz sentido e daria uma direção degenerada.
  if (target.kind === 'figure' && target.figureId === figureId) return false

  const point = resolveLookAtTarget(target)
  if (!point) return false

  // Travas e âncoras chegam pelo mesmo conjunto efetivo do arrasto (#42, 62).
  const pose = solveLookAt(figure, point, effectiveLockedJoints(state, figureId))
  if (!pose || Object.keys(pose).length === 0) return false

  // Pescoço e cabeça numa escrita só: um passo de undo por clique.
  state.setJointRotations(figureId, pose)
  return true
}
