import * as THREE from 'three'
import { ROOT_JOINT_NAME, getHeightScale, getJoint, getJointChildren, type JointRotation } from './skeleton'
import type { Figure } from '../store/figuresStore'

/**
 * Constrói uma árvore de `THREE.Group`s (sem geometria/mesh) refletindo a
 * pose atual de um boneco — a mesma transformação local por junta que
 * `Figure.tsx` usa para renderizar, mas puramente como grafo de transformos,
 * reaproveitável por qualquer código que precise da posição/orientação de
 * uma junta no mundo sem montar o `<Canvas>`: exportação glTF
 * (`figureObject3D.ts`) e o solver de IK (`ikSolver.ts`, fase 7).
 */

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }

export function degToRadTriple(rotation: JointRotation): [number, number, number] {
  return [
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z),
  ]
}

function buildFrameNode(jointName: string, figure: Figure, frames: Map<string, THREE.Group>): THREE.Group {
  const joint = getJoint(jointName)
  const isRoot = jointName === ROOT_JOINT_NAME
  const rotation = isRoot ? figure.rotation : (figure.pose[jointName] ?? ZERO_ROTATION)

  const group = new THREE.Group()
  group.name = jointName
  group.position.set(...joint.position)
  group.rotation.set(...degToRadTriple(rotation))
  frames.set(jointName, group)

  for (const child of getJointChildren(jointName)) {
    group.add(buildFrameNode(child.name, figure, frames))
  }

  return group
}

export interface JointFrames {
  /** Grupo externo — carrega `figure.position`/altura (escala), como o `figure-${id}` de `Figure.tsx`. */
  outer: THREE.Group
  /** Uma entrada por junta (nome do `skeleton.ts`), já no lugar certo da hierarquia. */
  joints: Map<string, THREE.Group>
}

/** Constrói o grafo de transformos e já chama `updateMatrixWorld` — pronto para ler posição/orientação de qualquer junta no mundo. */
export function buildJointFrames(figure: Figure): JointFrames {
  const outer = new THREE.Group()
  outer.position.set(...figure.position)
  outer.scale.setScalar(getHeightScale(figure.height))

  const joints = new Map<string, THREE.Group>()
  outer.add(buildFrameNode(ROOT_JOINT_NAME, figure, joints))
  outer.updateMatrixWorld(true)

  return { outer, joints }
}
