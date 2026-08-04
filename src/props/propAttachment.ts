import * as THREE from 'three'
import { buildJointFrames, degToRadTriple } from '../figure/jointFrames'
import type { Figure } from '../store/figuresStore'
import type { PropAttachment, Vec3 } from './sceneProp'
import type { JointRotation } from '../figure/skeleton'

/**
 * A conta da amarração (PLANO.md > "Objetos pré-modelados e amarração a
 * juntas", metade 1): colocação em mundo de um objeto amarrado, derivada do
 * frame da junta — e a volta, que é o que o gizmo usa para transformar um
 * arrasto no mundo em offset relativo à junta.
 *
 * Duas escolhas conscientes, decididas com o usuário:
 *
 * - O OFFSET passa pela escala de altura do boneco (o `matrixWorld` da junta a
 *   carrega): a espada continua na mão de um boneco de 1,90 m. O TAMANHO do
 *   objeto, não — tamanho é metro por eixo, nunca escala (decisão nº 1 de
 *   `sceneProp.ts`), e é por isso que a rotação sai por `getWorldQuaternion`
 *   (que descarta a escala) e não por decomposição à mão.
 * - Derivação PURA, sem procurar grupos `joint-*` na cena: funciona igual no
 *   desktop, no módulo de poses e na exportação, e é testável sem GPU — o
 *   mesmo motivo do `dragSolver` e do `jointAxisFrames`.
 */

/** Colocação em mundo: o que a `<mesh>` do objeto recebe. */
export interface PropPlacement {
  position: Vec3
  rotation: JointRotation
}

function eulerToDegrees(quaternion: THREE.Quaternion): JointRotation {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
  return {
    x: THREE.MathUtils.radToDeg(euler.x),
    y: THREE.MathUtils.radToDeg(euler.y),
    z: THREE.MathUtils.radToDeg(euler.z),
  }
}

function offsetQuaternion(rotation: JointRotation): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...degToRadTriple(rotation), 'XYZ'))
}

/** Colocação em mundo do objeto amarrado; `null` se a junta não existir. */
export function attachedPropPlacement(figure: Figure, attachment: PropAttachment): PropPlacement | null {
  const { joints } = buildJointFrames(figure)
  const joint = joints.get(attachment.jointName)
  if (!joint) return null

  const position = new THREE.Vector3(...attachment.position).applyMatrix4(joint.matrixWorld)
  const rotation = joint
    .getWorldQuaternion(new THREE.Quaternion())
    .multiply(offsetQuaternion(attachment.rotation))

  return {
    position: [position.x, position.y, position.z],
    rotation: eulerToDegrees(rotation),
  }
}

/**
 * A volta: dada uma colocação desejada NO MUNDO (o que o gizmo produziu, ou o
 * lugar onde o objeto está no instante de amarrar), o offset relativo à junta
 * que a reproduz. `attachedPropPlacement(figure, { …, ...offset })` devolve a
 * mesma colocação — invariante travada por teste.
 */
export function placementToAttachmentOffset(
  figure: Figure,
  jointName: string,
  placement: PropPlacement,
): { position: Vec3; rotation: JointRotation } | null {
  const { joints } = buildJointFrames(figure)
  const joint = joints.get(jointName)
  if (!joint) return null

  const toLocal = joint.matrixWorld.clone().invert()
  const position = new THREE.Vector3(...placement.position).applyMatrix4(toLocal)

  const jointWorld = joint.getWorldQuaternion(new THREE.Quaternion())
  const rotation = jointWorld.invert().multiply(offsetQuaternion(placement.rotation))

  return {
    position: [position.x, position.y, position.z],
    rotation: eulerToDegrees(rotation),
  }
}
