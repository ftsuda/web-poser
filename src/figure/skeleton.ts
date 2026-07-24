/**
 * Fonte única do esqueleto do boneco: hierarquia de 27 juntas, offsets locais
 * (em metros, para a altura de referência) e limites articulares por eixo.
 * Usado pelo FK, pelo IK (fase 7) e pela validação ao carregar cenas.
 *
 * Convenção de eixos por junta: Euler XYZ; um eixo sem entrada em `limits`
 * não é um grau de liberdade daquela junta (fica travado em 0).
 */

export type Axis = 'x' | 'y' | 'z'

export interface AxisLimit {
  min: number
  max: number
}

export type JointLimits = Partial<Record<Axis, AxisLimit>>

export interface JointDefinition {
  name: string
  parent: string | null
  /** Offset local em relação ao pai, em metros, na altura de referência (1,70 m). */
  position: readonly [number, number, number]
  /** Limites de rotação por eixo, em graus. Ausente = eixo travado (não é DOF da junta). */
  limits: JointLimits
}

export const REFERENCE_HEIGHT_M = 1.7
export const MIN_HEIGHT_M = 1.5
export const MAX_HEIGHT_M = 1.9

export const ROOT_JOINT_NAME = 'root'

const FREE_JOINTS = new Set<string>([ROOT_JOINT_NAME])

export const JOINTS: readonly JointDefinition[] = [
  // Tronco e cabeça
  { name: 'root', parent: null, position: [0, 0.9, 0], limits: {} },
  {
    name: 'spine',
    parent: 'root',
    position: [0, 0.14, 0],
    limits: { x: { min: -45, max: 30 }, y: { min: -30, max: 30 }, z: { min: -25, max: 25 } },
  },
  {
    name: 'chest',
    parent: 'spine',
    position: [0, 0.26, 0],
    limits: { x: { min: -25, max: 20 }, y: { min: -20, max: 20 }, z: { min: -15, max: 15 } },
  },
  {
    name: 'neck',
    parent: 'chest',
    position: [0, 0.24, 0],
    limits: { x: { min: -40, max: 50 }, y: { min: -60, max: 60 }, z: { min: -30, max: 30 } },
  },
  {
    name: 'head',
    parent: 'neck',
    position: [0, 0.16, 0],
    limits: { x: { min: -20, max: 20 }, y: { min: -30, max: 30 }, z: { min: -15, max: 15 } },
  },

  // Braço e mão esquerdos
  {
    name: 'clavicle.L',
    parent: 'chest',
    position: [0.1, 0.05, 0],
    limits: { y: { min: -15, max: 15 }, z: { min: 0, max: 20 } },
  },
  {
    name: 'shoulder.L',
    parent: 'clavicle.L',
    position: [0.14, -0.02, 0],
    limits: { x: { min: -180, max: 90 }, y: { min: -90, max: 90 }, z: { min: -20, max: 180 } },
  },
  {
    name: 'elbow.L',
    parent: 'shoulder.L',
    position: [0, -0.32, 0],
    limits: { x: { min: 0, max: 150 }, y: { min: -80, max: 80 } },
  },
  {
    name: 'wrist.L',
    parent: 'elbow.L',
    position: [0, -0.26, 0],
    limits: { x: { min: -60, max: 60 }, z: { min: -20, max: 30 } },
  },
  {
    name: 'thumb1.L',
    parent: 'wrist.L',
    position: [-0.03, -0.03, 0.03],
    limits: { x: { min: -20, max: 50 }, z: { min: 0, max: 40 } },
  },
  {
    name: 'thumb2.L',
    parent: 'thumb1.L',
    position: [-0.02, -0.02, 0.02],
    limits: { x: { min: 0, max: 80 } },
  },
  {
    name: 'fingers.L',
    parent: 'wrist.L',
    position: [0, -0.1, 0.01],
    limits: { x: { min: 0, max: 90 } },
  },

  // Braço e mão direitos (espelhado em X)
  {
    name: 'clavicle.R',
    parent: 'chest',
    position: [-0.1, 0.05, 0],
    limits: { y: { min: -15, max: 15 }, z: { min: 0, max: 20 } },
  },
  {
    name: 'shoulder.R',
    parent: 'clavicle.R',
    position: [-0.14, -0.02, 0],
    limits: { x: { min: -180, max: 90 }, y: { min: -90, max: 90 }, z: { min: -180, max: 20 } },
  },
  {
    name: 'elbow.R',
    parent: 'shoulder.R',
    position: [0, -0.32, 0],
    limits: { x: { min: 0, max: 150 }, y: { min: -80, max: 80 } },
  },
  {
    name: 'wrist.R',
    parent: 'elbow.R',
    position: [0, -0.26, 0],
    limits: { x: { min: -60, max: 60 }, z: { min: -30, max: 20 } },
  },
  {
    name: 'thumb1.R',
    parent: 'wrist.R',
    position: [0.03, -0.03, 0.03],
    limits: { x: { min: -20, max: 50 }, z: { min: -40, max: 0 } },
  },
  {
    name: 'thumb2.R',
    parent: 'thumb1.R',
    position: [0.02, -0.02, 0.02],
    limits: { x: { min: 0, max: 80 } },
  },
  {
    name: 'fingers.R',
    parent: 'wrist.R',
    position: [0, -0.1, 0.01],
    limits: { x: { min: 0, max: 90 } },
  },

  // Perna e pé esquerdos
  {
    name: 'hip.L',
    parent: 'root',
    position: [0.09, -0.03, 0],
    limits: { x: { min: -120, max: 30 }, y: { min: -40, max: 40 }, z: { min: -45, max: 45 } },
  },
  {
    name: 'knee.L',
    parent: 'hip.L',
    position: [0, -0.4, 0],
    limits: { x: { min: 0, max: 150 } },
  },
  {
    name: 'ankle.L',
    parent: 'knee.L',
    position: [0, -0.4, 0],
    limits: { x: { min: -50, max: 20 }, z: { min: -30, max: 30 } },
  },
  {
    name: 'ball.L',
    parent: 'ankle.L',
    position: [0, -0.06, 0.12],
    limits: { x: { min: -30, max: 60 } },
  },

  // Perna e pé direitos (espelhado em X)
  {
    name: 'hip.R',
    parent: 'root',
    position: [-0.09, -0.03, 0],
    limits: { x: { min: -120, max: 30 }, y: { min: -40, max: 40 }, z: { min: -45, max: 45 } },
  },
  {
    name: 'knee.R',
    parent: 'hip.R',
    position: [0, -0.4, 0],
    limits: { x: { min: 0, max: 150 } },
  },
  {
    name: 'ankle.R',
    parent: 'knee.R',
    position: [0, -0.4, 0],
    limits: { x: { min: -50, max: 20 }, z: { min: -30, max: 30 } },
  },
  {
    name: 'ball.R',
    parent: 'ankle.R',
    position: [0, -0.06, 0.12],
    limits: { x: { min: -30, max: 60 } },
  },
]

export const JOINT_NAMES: readonly string[] = JOINTS.map((joint) => joint.name)

const JOINTS_BY_NAME = new Map(JOINTS.map((joint) => [joint.name, joint]))

export function getJoint(name: string): JointDefinition {
  const joint = JOINTS_BY_NAME.get(name)
  if (!joint) {
    throw new Error(`Junta desconhecida: "${name}"`)
  }
  return joint
}

export function getJointChildren(name: string): JointDefinition[] {
  return JOINTS.filter((joint) => joint.parent === name)
}

export function getJointChain(name: string): string[] {
  const chain: string[] = []
  let current: JointDefinition | undefined = getJoint(name)
  while (current) {
    chain.unshift(current.name)
    current = current.parent ? getJoint(current.parent) : undefined
  }
  return chain
}

const AXIS_ORDER: readonly Axis[] = ['x', 'y', 'z']

/** Graus de liberdade de uma junta, na ordem x,y,z — usado pelos sliders e pelo eixo ativo dos atalhos de teclado. */
export function getJointAxes(name: string): Axis[] {
  const joint = getJoint(name)
  return AXIS_ORDER.filter((axis) => joint.limits[axis])
}

export interface JointRotation {
  x: number
  y: number
  z: number
}

function clampValue(value: number, limit: AxisLimit): number {
  return Math.min(limit.max, Math.max(limit.min, value))
}

export function clampJointRotation(
  jointName: string,
  rotation: Partial<JointRotation>,
): JointRotation {
  if (FREE_JOINTS.has(jointName)) {
    return { x: rotation.x ?? 0, y: rotation.y ?? 0, z: rotation.z ?? 0 }
  }

  const joint = getJoint(jointName)
  const axes: Axis[] = ['x', 'y', 'z']
  const result = { x: 0, y: 0, z: 0 } as JointRotation

  for (const axis of axes) {
    const limit = joint.limits[axis]
    if (!limit) {
      result[axis] = 0
      continue
    }
    result[axis] = clampValue(rotation[axis] ?? 0, limit)
  }

  return result
}

export function getHeightScale(heightM: number): number {
  return heightM / REFERENCE_HEIGHT_M
}
