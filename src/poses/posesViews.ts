import type { Axis } from '../figure/skeleton'

/**
 * As seis vistas do módulo de poses (item 44): cinco ortográficas de edição,
 * cada uma travando um eixo do mundo, mais a livre, de navegação sem edição.
 * Só uma vista existe por vez — a ativa é a que está na tela.
 *
 * Toda a matemática de tela (arrasto, setas do painel) é derivada da BASE DA
 * CÂMERA da vista, e não de eixos escritos à mão: é o que faz as vistas
 * "trás" e "lado direito" — em que arrastar para a direita na tela move o
 * mundo no sentido oposto — saírem certas de graça, em vez de virarem casos
 * especiais (PLANO.md, item 44).
 */

export type PosesViewKey = 'front' | 'back' | 'left' | 'right' | 'top' | 'free'

/** Ordem do seletor (pedido do usuário, 2026-07-31): um giro em volta do boneco, depois cima e livre. */
export const POSES_VIEW_KEYS: readonly PosesViewKey[] = [
  'right',
  'front',
  'left',
  'back',
  'top',
  'free',
]

export type Vec3 = readonly [number, number, number]

export interface PosesViewDefinition {
  key: PosesViewKey
  /** Direção do ALVO para a câmera (unitária) — a câmera fica em `alvo + dir × distância`. */
  cameraDir: Vec3
  /** Topo da tela. */
  up: Vec3
  /** Eixo do mundo que o arrasto NÃO muda nesta vista; `null` na livre. */
  lockedAxis: Axis | null
  /** Se a vista edita pose (as ortográficas) ou só navega (a livre). */
  editable: boolean
  /** Projeção ortográfica (edição) ou perspectiva (livre). */
  ortho: boolean
}

/**
 * Convenção de "frente" do app: o boneco encara +Z (a mesma de `ball.*` e do
 * polegar no `skeleton.ts`), e o lado ESQUERDO dele é +X (`shoulder.L`).
 * A vista "lado esquerdo" é, portanto, a câmera em +X olhando o perfil
 * esquerdo. Na vista de cima o topo da tela é -Z: o boneco em T-pose aparece
 * "de pé" na tela, com a frente dele para baixo.
 */
export const POSES_VIEWS: Record<PosesViewKey, PosesViewDefinition> = {
  front: { key: 'front', cameraDir: [0, 0, 1], up: [0, 1, 0], lockedAxis: 'z', editable: true, ortho: true },
  back: { key: 'back', cameraDir: [0, 0, -1], up: [0, 1, 0], lockedAxis: 'z', editable: true, ortho: true },
  left: { key: 'left', cameraDir: [1, 0, 0], up: [0, 1, 0], lockedAxis: 'x', editable: true, ortho: true },
  right: { key: 'right', cameraDir: [-1, 0, 0], up: [0, 1, 0], lockedAxis: 'x', editable: true, ortho: true },
  top: { key: 'top', cameraDir: [0, 1, 0], up: [0, 0, -1], lockedAxis: 'y', editable: true, ortho: true },
  // A diagonal padrão da bancada (`CAMERA_DEFAULTS.position` normalizada).
  free: { key: 'free', cameraDir: [0.557, 0.371, 0.743], up: [0, 1, 0], lockedAxis: null, editable: false, ortho: false },
}

/** Avança (`+1`) ou volta (`-1`) na sequência de vistas, em ciclo. */
export function stepViewKey(current: PosesViewKey, delta: 1 | -1): PosesViewKey {
  const index = POSES_VIEW_KEYS.indexOf(current)
  const next = (index + delta + POSES_VIEW_KEYS.length) % POSES_VIEW_KEYS.length
  return POSES_VIEW_KEYS[next]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  // O `+ 0` normaliza -0 para 0 — as bases são comparadas literalmente nos testes.
  return [
    a[1] * b[2] - a[2] * b[1] + 0,
    a[2] * b[0] - a[0] * b[2] + 0,
    a[0] * b[1] - a[1] * b[0] + 0,
  ]
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

export interface ScreenBasis {
  /** Direção do mundo que aparece como "direita da tela" nesta vista. */
  right: Vec3
  /** Direção do mundo que aparece como "cima da tela". */
  up: Vec3
}

/** Base de tela da vista, derivada da base da câmera (forward × up), nunca escrita à mão. */
export function viewScreenBasis(key: PosesViewKey): ScreenBasis {
  const view = POSES_VIEWS[key]
  const forward = scale(view.cameraDir, -1)
  const right = cross(forward, view.up)
  const up = cross(right, forward)
  return { right, up }
}

const PARALLEL_EPSILON = 1e-9

/**
 * Projeta o raio do toque no plano de edição da vista: o plano que passa pela
 * junta (`anchor`) e é perpendicular ao eixo travado. A profundidade fica a
 * que já era — a coordenada travada do resultado é COPIADA da âncora, não
 * recalculada, para não acumular ruído de interseção.
 *
 * Devolve `null` na vista livre (não há edição) e com raio paralelo ao plano.
 */
export function projectPointerOnViewPlane(
  key: PosesViewKey,
  anchor: Vec3,
  rayOrigin: Vec3,
  rayDir: Vec3,
): Vec3 | null {
  const axis = POSES_VIEWS[key].lockedAxis
  if (!axis) return null
  const component = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  const denom = rayDir[component]
  if (Math.abs(denom) < PARALLEL_EPSILON) return null
  const t = (anchor[component] - rayOrigin[component]) / denom
  const point: [number, number, number] = [
    rayOrigin[0] + rayDir[0] * t,
    rayOrigin[1] + rayDir[1] * t,
    rayOrigin[2] + rayDir[2] * t,
  ]
  point[component] = anchor[component]
  return point
}

/**
 * Projeção em plano ARBITRÁRIO — a vista Livre com edição destravada
 * (DECISOES.md #93): o plano paralelo à tela que passa pela junta, cuja
 * normal é a direção da câmera viva no momento do toque. Com a normal de um
 * eixo do mundo, equivale a `projectPointerOnViewPlane` (coberto por teste).
 */
export function projectPointerOnPlane(
  anchor: Vec3,
  normal: Vec3,
  rayOrigin: Vec3,
  rayDir: Vec3,
): Vec3 | null {
  const denom = rayDir[0] * normal[0] + rayDir[1] * normal[1] + rayDir[2] * normal[2]
  if (Math.abs(denom) < PARALLEL_EPSILON) return null
  const t =
    ((anchor[0] - rayOrigin[0]) * normal[0] +
      (anchor[1] - rayOrigin[1]) * normal[1] +
      (anchor[2] - rayOrigin[2]) * normal[2]) /
    denom
  return [
    rayOrigin[0] + rayDir[0] * t,
    rayOrigin[1] + rayDir[1] * t,
    rayOrigin[2] + rayDir[2] * t,
  ]
}

/**
 * Arrasto POR EIXO — as setas do gizmo de translação da vista Livre: o alvo é
 * o ponto da reta (junta + t×eixo) mais próximo do raio do toque. `null`
 * quando o raio é paralelo ao eixo (não há ponto mais próximo único).
 */
export function closestPointOnAxisToRay(
  anchor: Vec3,
  axisDir: Vec3,
  rayOrigin: Vec3,
  rayDir: Vec3,
): Vec3 | null {
  const w: Vec3 = [anchor[0] - rayOrigin[0], anchor[1] - rayOrigin[1], anchor[2] - rayOrigin[2]]
  const a = axisDir[0] * axisDir[0] + axisDir[1] * axisDir[1] + axisDir[2] * axisDir[2]
  const b = axisDir[0] * rayDir[0] + axisDir[1] * rayDir[1] + axisDir[2] * rayDir[2]
  const c = rayDir[0] * rayDir[0] + rayDir[1] * rayDir[1] + rayDir[2] * rayDir[2]
  const d = axisDir[0] * w[0] + axisDir[1] * w[1] + axisDir[2] * w[2]
  const e = rayDir[0] * w[0] + rayDir[1] * w[1] + rayDir[2] * w[2]
  const denom = a * c - b * b
  if (Math.abs(denom) < PARALLEL_EPSILON) return null
  const t = (b * e - c * d) / denom
  return [anchor[0] + axisDir[0] * t, anchor[1] + axisDir[1] * t, anchor[2] + axisDir[2] * t]
}

export type NudgeDirection = 'up' | 'down' | 'left' | 'right'

/**
 * As setas do painel são o arrasto em passos (PLANO.md, item 44): empurram o
 * alvo no plano da vista ativa, na mesma base de tela do arrasto — a
 * dimensão travada vale para elas automaticamente.
 */
export function nudgeFromView(
  key: PosesViewKey,
  anchor: Vec3,
  direction: NudgeDirection,
  stepM: number,
): Vec3 {
  const basis = viewScreenBasis(key)
  const vector =
    direction === 'right'
      ? basis.right
      : direction === 'left'
        ? scale(basis.right, -1)
        : direction === 'up'
          ? basis.up
          : scale(basis.up, -1)
  return add(anchor, scale(vector, stepM))
}

export interface ViewCameraPose {
  position: Vec3
  up: Vec3
}

/** Onde a câmera de trabalho fica para olhar `target` desta vista, a `distance` metros. */
export function viewCameraPose(key: PosesViewKey, target: Vec3, distance: number): ViewCameraPose {
  const view = POSES_VIEWS[key]
  return { position: add(target, scale(view.cameraDir, distance)), up: view.up }
}
