import * as THREE from 'three'
import { buildJointFrames } from '../figure/jointFrames'
import { isDraggableJoint, solveJointDrag } from '../figure/dragSolver'
import { ROOT_JOINT_NAME, type JointRotation } from '../figure/skeleton'
import type { Figure } from '../store/figuresStore'
import { nudgeFromView, type NudgeDirection, type PosesViewKey, type Vec3 } from './posesViews'

/**
 * A EDIÇÃO do módulo de poses: arrasto e setas alimentam o mesmo caminho —
 * um alvo em coordenadas de mundo resolvido por `solveJointDrag` (juntas) ou
 * virando translação da colocação (raiz). Não existe segunda rotina de
 * edição: as setas são o arrasto em passos (PLANO.md, item 44), e a dimensão
 * travada da vista vale para as duas de graça.
 */

/** Passo das setas do painel, em metros — o ajuste que o dedo não acerta. */
export const NUDGE_STEP_M = 0.02

export interface PoseEditPosition {
  kind: 'position'
  position: [number, number, number]
}

export interface PoseEditRotations {
  kind: 'rotations'
  rotations: Record<string, JointRotation>
  /** Raiz recrutada como último elo (item 63) — vai para o MESMO `setJointRotations`, no mesmo passo de undo. */
  rootRotation: JointRotation | null
  /** `false` = o limite articular saturou antes do alvo (gancho da vibração). */
  reached: boolean
}

export type PoseEdit = PoseEditPosition | PoseEditRotations | null

/** Posição de MUNDO de uma junta do boneco, em metros — `null` para nome desconhecido. */
export function jointWorldPosition(figure: Figure, jointName: string): Vec3 | null {
  const { joints } = buildJointFrames(figure)
  const group = joints.get(jointName)
  if (!group) return null
  const world = group.getWorldPosition(new THREE.Vector3())
  return [world.x, world.y, world.z]
}

/**
 * O que a edição faz para levar `jointName` de `anchor` até `target`:
 * - raiz: translada a colocação pelo delta (a pose não muda);
 * - junta arrastável: `solveJointDrag`, respeitando travas e limites;
 * - o resto (mãos, juntas presas à raiz): nada — devolve `null`, e a UI
 *   desabilita as setas em vez de fingir que edita.
 */
export function editTowardTarget(
  figure: Figure,
  jointName: string,
  anchor: Vec3,
  target: Vec3,
  lockedJoints: readonly string[],
): PoseEdit {
  if (jointName === ROOT_JOINT_NAME) {
    return {
      kind: 'position',
      position: [
        figure.position[0] + (target[0] - anchor[0]),
        figure.position[1] + (target[1] - anchor[1]),
        figure.position[2] + (target[2] - anchor[2]),
      ],
    }
  }
  if (!isDraggableJoint(jointName)) return null
  const result = solveJointDrag(figure, jointName, target, lockedJoints)
  return {
    kind: 'rotations',
    rotations: result.rotations,
    rootRotation: result.rootRotation,
    reached: result.reached,
  }
}

/** Uma seta do painel: empurra a junta um passo no plano da vista ativa. */
export function nudgeJoint(
  viewKey: PosesViewKey,
  figure: Figure,
  jointName: string,
  direction: NudgeDirection,
  lockedJoints: readonly string[],
): PoseEdit {
  const anchor = jointWorldPosition(figure, jointName)
  if (!anchor) return null
  const target = nudgeFromView(viewKey, anchor, direction, NUDGE_STEP_M)
  return editTowardTarget(figure, jointName, anchor, target, lockedJoints)
}

/** Se a junta reage às setas/arrasto do módulo de poses (raiz translada; as demais, solver). */
export function isNudgeableJoint(jointName: string): boolean {
  return jointName === ROOT_JOINT_NAME || isDraggableJoint(jointName)
}
