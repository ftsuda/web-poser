import * as THREE from 'three'
import { buildJointFrames } from '../figure/jointFrames'
import {
  JOINT_NAMES,
  ROOT_JOINT_NAME,
  getJointAxes,
  type Axis,
  type JointRotation,
} from '../figure/skeleton'
import type { Figure } from '../store/figuresStore'
import type { Vec3 } from './posesViews'

/**
 * Os FRAMES dos anéis gimbal da junta selecionada (item 60): para cada DOF,
 * a orientação de mundo do frame em que aquele eixo de rotação realmente
 * vive. A pose local é um Euler XYZ intrínseco (`group.rotation.set` em
 * `jointFrames.ts`), então os frames encadeiam: o anel X fica no frame do
 * PAI, o anel Y carrega a rotação X já aplicada, e o anel Z carrega X e Y —
 * um anel fixo nos eixos locais mentiria em junta já rodada.
 *
 * A raiz é a exceção deliberada: três anéis nos EIXOS DO MUNDO — girá-la é
 * colocação (para onde o boneco encara), e a leitura útil é contra o mundo.
 *
 * Matemática pura sobre `buildJointFrames` — quem desenha é `JointAxisRings`.
 */

export interface JointAxisFrame {
  axis: Axis
  /** Quaternion de MUNDO do frame do anel, como `[x, y, z, w]`. */
  quaternion: [number, number, number, number]
}

export interface JointAxisFramesResult {
  /** Posição de mundo da junta — o centro dos anéis. */
  origin: Vec3
  /** Um frame por DOF da junta, na ordem x, y, z. */
  frames: JointAxisFrame[]
}

const ZERO_ROTATION: JointRotation = { x: 0, y: 0, z: 0 }
const WORLD_AXES: readonly Axis[] = ['x', 'y', 'z']

function toTuple(quaternion: THREE.Quaternion): [number, number, number, number] {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
}

function axisQuaternion(axis: Vec3, degrees: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(...axis),
    THREE.MathUtils.degToRad(degrees),
  )
}

export function jointAxisFrames(figure: Figure, jointName: string): JointAxisFramesResult | null {
  const isRoot = jointName === ROOT_JOINT_NAME
  if (!isRoot && !JOINT_NAMES.includes(jointName)) return null

  const { joints } = buildJointFrames(figure)
  const group = joints.get(jointName)
  if (!group) return null
  const world = group.getWorldPosition(new THREE.Vector3())
  const origin: Vec3 = [world.x, world.y, world.z]

  if (isRoot) {
    return {
      origin,
      frames: WORLD_AXES.map((axis) => ({ axis, quaternion: [0, 0, 0, 1] })),
    }
  }

  // O grupo da junta sempre tem pai (a raiz pendura no grupo externo), e a
  // escala uniforme do externo não afeta a decomposição do quaternion.
  const parentQuaternion = group.parent!.getWorldQuaternion(new THREE.Quaternion())
  const rotation = figure.pose[jointName] ?? ZERO_ROTATION
  const afterX = parentQuaternion.clone().multiply(axisQuaternion([1, 0, 0], rotation.x))
  const afterXY = afterX.clone().multiply(axisQuaternion([0, 1, 0], rotation.y))

  const frameByAxis: Record<Axis, THREE.Quaternion> = {
    x: parentQuaternion,
    y: afterX,
    z: afterXY,
  }

  return {
    origin,
    frames: getJointAxes(jointName).map((axis) => ({
      axis,
      quaternion: toTuple(frameByAxis[axis]),
    })),
  }
}
