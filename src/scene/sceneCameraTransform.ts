import * as THREE from 'three'
import type { CameraViewState } from './cameraMove'
import type { Vector3Tuple } from './cameraPresets'

/**
 * Conversões entre o estado da câmera de cena (posição/alvo/topo) e os
 * controles NUMÉRICOS do painel (fase 11.1): posição em metros e rotação em
 * graus, no mesmo formato dos controles de colocação do boneco. Lógica pura —
 * quem grava o resultado no store é o `CameraPanel`, e o gizmo/`CameraRig`
 * seguem o store como sempre.
 *
 * A rotação usa a ordem `YXZ` (guinada → inclinação → rolagem), a natural
 * para câmeras: Y é "para onde se vira", X é "quanto se olha para cima/baixo"
 * e Z é a inclinação lateral (o mesmo ângulo holandês do painel, visto pelo
 * outro vocabulário). O X fica em [-90°, 90°] — além disso a câmera estaria
 * de cabeça para baixo, e a extração deixaria de bater com o slider.
 */

/** Ordem de Euler dos controles — ver o comentário do módulo. */
export const SCENE_CAMERA_EULER_ORDER = 'YXZ' as const

export interface EulerDeg {
  x: number
  y: number
  z: number
}

const FORWARD = new THREE.Vector3(0, 0, -1)
const UP = new THREE.Vector3(0, 1, 0)

function orientationOf(view: CameraViewState): THREE.Matrix4 {
  return new THREE.Matrix4().lookAt(
    new THREE.Vector3(...view.position),
    new THREE.Vector3(...view.target),
    new THREE.Vector3(...view.up),
  )
}

/** A rotação da câmera em graus (YXZ), extraída de posição/alvo/topo. */
export function sceneCameraEulerDeg(view: CameraViewState): EulerDeg {
  const euler = new THREE.Euler().setFromRotationMatrix(orientationOf(view), SCENE_CAMERA_EULER_ORDER)
  return {
    x: THREE.MathUtils.radToDeg(euler.x),
    y: THREE.MathUtils.radToDeg(euler.y),
    z: THREE.MathUtils.radToDeg(euler.z),
  }
}

/**
 * O estado da câmera com a rotação dada, girando NO LUGAR: a posição não se
 * move, e o alvo é levado pela nova direção de visão à MESMA distância — a
 * distância é o que os planos e o modo visão usam, então girar não pode
 * alterá-la. É exatamente o que o modo E do gizmo faz, pelo caminho numérico.
 */
export function withSceneCameraEulerDeg(view: CameraViewState, eulerDeg: EulerDeg): CameraViewState {
  const position = new THREE.Vector3(...view.position)
  const distance = new THREE.Vector3(...view.target).distanceTo(position) || 1

  const quaternion = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(eulerDeg.x),
      THREE.MathUtils.degToRad(eulerDeg.y),
      THREE.MathUtils.degToRad(eulerDeg.z),
      SCENE_CAMERA_EULER_ORDER,
    ),
  )
  const target = position.clone().addScaledVector(FORWARD.clone().applyQuaternion(quaternion), distance)
  const up = UP.clone().applyQuaternion(quaternion)

  return {
    position: [...view.position] as Vector3Tuple,
    target: [target.x, target.y, target.z],
    up: [up.x, up.y, up.z],
    focalMm: view.focalMm,
  }
}

/**
 * O estado da câmera na posição dada, transladando posição E alvo juntos — a
 * direção de visão não muda, como no modo W do gizmo.
 */
export function withSceneCameraPosition(view: CameraViewState, position: Vector3Tuple): CameraViewState {
  const dx = position[0] - view.position[0]
  const dy = position[1] - view.position[1]
  const dz = position[2] - view.position[2]
  return {
    ...view,
    position: [...position] as Vector3Tuple,
    target: [view.target[0] + dx, view.target[1] + dy, view.target[2] + dz],
  }
}
