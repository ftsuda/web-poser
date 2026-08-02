import { isDraggableJoint, solveJointDrag } from './dragSolver'
import { effectiveLockedJoints, useFiguresStore } from '../store/figuresStore'

/**
 * Ação que conecta o solver de arrasto de junta (`dragSolver.ts`, puro) ao
 * `figuresStore` — chamada pelo gizmo de translação de junta
 * (`JointDragGizmo.tsx`) a cada evento de arrasto. Mesmo papel que
 * `ikActions.ts` tinha para o IK de 2 ossos da fase 7, que este arrasto
 * substituiu.
 *
 * Devolve a posição no mundo onde a junta efetivamente ficou (para o gizmo
 * "travar" nela quando o alvo passa dos limites), ou `null` quando não há o
 * que resolver (boneco inexistente ou junta sem arrasto).
 */
export function applyJointDrag(
  figureId: string,
  jointName: string,
  targetWorldPosition: readonly [number, number, number],
): [number, number, number] | null {
  const state = useFiguresStore.getState()
  const figure = state.figures.find((f) => f.id === figureId)
  if (!figure || !isDraggableJoint(jointName)) return null

  // O conjunto efetivo traz travas, congeladas por âncora e a `root` de
  // boneco ancorado (item 62) — o solver pula tudo isso sozinho.
  const locked = effectiveLockedJoints(state, figureId)
  const result = solveJointDrag(figure, jointName, targetWorldPosition, locked)

  // Uma edição só (e um passo de undo só) por evento de arrasto — a cadeia
  // inteira E a raiz recrutada (item 63) entram juntas em `setJointRotations`,
  // que reaplica trava e espelho ao vivo.
  if (Object.keys(result.rotations).length > 0 || result.rootRotation) {
    state.setJointRotations(figureId, result.rotations, result.rootRotation)
  }

  return result.achievedWorldPosition
}
