import type { Axis } from '../figure/skeleton'
import {
  closestPointOnAxisToRay,
  projectPointerOnPlane,
  projectPointerOnViewPlane,
  type Vec3,
} from './posesViews'
import type { PosesViewKey } from './posesViews'

/**
 * A MATEMÁTICA do arrasto e do gesto de torção do módulo de poses (item 58).
 *
 * O `PosesViewport` concentrava arrasto planar, arrasto por eixo, gesto de
 * torção e o gizmo num componente só — a parte geométrica ficava fora do
 * alcance de unit test (a ressalva registrada no próprio arquivo). Este módulo
 * extrai o que é função pura: resolver o ALVO do arrasto a partir do raio do
 * toque, a translação da raiz e a máquina de estados do gesto de dois dedos.
 * O componente fica só com a cola (eventos, refs, stores) — e o arrasto REAL
 * continua coberto pelo smoke de Playwright (item 57).
 */

/** O arrasto em curso — quem o cria é o pointerdown na junta ou na seta do gizmo. */
export interface PosesDragState {
  figureId: string
  jointName: string
  /** Posição de mundo da junta no INÍCIO do arrasto — o plano de projeção fica preso a ela. */
  anchor: Vec3
  /** Colocação do boneco no início — o arrasto da raiz soma o delta a partir daqui. */
  startPosition: readonly [number, number, number]
  /**
   * Vista Livre: normal do plano paralelo à tela (a direção da câmera no
   * momento do toque). `null` nas vistas travadas — lá o plano vem do eixo.
   */
  planeNormal: Vec3 | null
  /** Arrasto por SETA do gizmo (vista Livre): o eixo do mundo que restringe o alvo. */
  axis: Axis | null
}

const AXIS_DIRS: Record<Axis, Vec3> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }

/**
 * O alvo do arrasto para o raio do toque — as três formas do mesmo gesto, na
 * ordem de especificidade: por seta do gizmo (reta do eixo), no plano da tela
 * (vista Livre) ou no plano da vista travada.
 */
export function dragTargetForPointer(
  drag: PosesDragState,
  viewKey: PosesViewKey,
  rayOrigin: Vec3,
  rayDir: Vec3,
): Vec3 | null {
  if (drag.axis) return closestPointOnAxisToRay(drag.anchor, AXIS_DIRS[drag.axis], rayOrigin, rayDir)
  if (drag.planeNormal) return projectPointerOnPlane(drag.anchor, drag.planeNormal, rayOrigin, rayDir)
  return projectPointerOnViewPlane(viewKey, drag.anchor, rayOrigin, rayDir)
}

/** Colocação da raiz durante o arrasto: a inicial mais o delta alvo−âncora. */
export function draggedRootPosition(
  drag: PosesDragState,
  target: Vec3,
): [number, number, number] {
  return [
    drag.startPosition[0] + (target[0] - drag.anchor[0]),
    drag.startPosition[1] + (target[1] - drag.anchor[1]),
    drag.startPosition[2] + (target[2] - drag.anchor[2]),
  ]
}

// ---------------------------------------------------------------------------
// Gesto de torção — dois dedos girando torcem a junta no próprio eixo
// ---------------------------------------------------------------------------

/** Giro acumulado (graus) a partir do qual o gesto vira torção, e não câmera. */
export const TWIST_DECIDE_DEG = 10

export interface TwistPointer {
  x: number
  y: number
}

/** Ângulo (graus) da reta entre dois ponteiros — a base do gesto de torção. */
export function pointerAngleDeg(a: TwistPointer, b: TwistPointer): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

/** Delta de ângulo trazido para (-180, 180] — cruzar o ±180 não é uma volta inteira. */
export function wrapAngleDeltaDeg(delta: number): number {
  if (delta > 180) return delta - 360
  if (delta <= -180) return delta + 360
  return delta
}

/**
 * Estado do gesto de dois dedos. O gesto só "vence" a câmera depois de
 * acumular `TWIST_DECIDE_DEG` de giro — pinça (zoom) e arrasto de dois dedos
 * (pan) continuam com o OrbitControls até lá; ao vencer, o acumulado sai
 * inteiro de uma vez, para o começo do giro não se perder.
 */
export interface TwistTracker {
  pointers: Map<number, TwistPointer>
  lastAngle: number
  accumulated: number
  active: boolean
}

export function createTwistTracker(): TwistTracker {
  return { pointers: new Map(), lastAngle: 0, accumulated: 0, active: false }
}

/** Registra um dedo; ao chegar o segundo, arma o gesto a partir do ângulo atual. */
export function twistPointerDown(twist: TwistTracker, pointerId: number, point: TwistPointer): void {
  twist.pointers.set(pointerId, point)
  if (twist.pointers.size === 2) {
    const [a, b] = [...twist.pointers.values()]
    twist.lastAngle = pointerAngleDeg(a, b)
    twist.accumulated = 0
    twist.active = false
  }
}

/**
 * Atualiza um dedo e devolve o delta (graus) a torcer — `null` enquanto o
 * gesto não decidiu (menos de dois dedos, ponteiro alheio, ou giro acumulado
 * ainda abaixo do limiar).
 */
export function twistPointerMove(
  twist: TwistTracker,
  pointerId: number,
  point: TwistPointer,
): number | null {
  if (!twist.pointers.has(pointerId)) return null
  twist.pointers.set(pointerId, point)
  if (twist.pointers.size !== 2) return null

  const [a, b] = [...twist.pointers.values()]
  const angle = pointerAngleDeg(a, b)
  const delta = wrapAngleDeltaDeg(angle - twist.lastAngle)
  twist.lastAngle = angle

  if (twist.active) return delta

  twist.accumulated += delta
  if (Math.abs(twist.accumulated) < TWIST_DECIDE_DEG) return null
  twist.active = true
  return twist.accumulated
}

/** Solta um dedo; com menos de dois o gesto desarma. Devolve se continua ativo. */
export function twistPointerUp(twist: TwistTracker, pointerId: number): boolean {
  twist.pointers.delete(pointerId)
  if (twist.pointers.size < 2) {
    twist.active = false
    twist.accumulated = 0
  }
  return twist.active
}
