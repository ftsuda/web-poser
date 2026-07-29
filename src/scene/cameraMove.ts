import * as THREE from 'three'
import { clampFocalLength } from './lens'
import type { Vector3Tuple } from './cameraPresets'

/**
 * Movimento de câmera entre DOIS pontos, com um slider (pedido do usuário;
 * ver DECISOES.md #46). É o mesmo desenho da mistura de poses (#43): as duas
 * pontas são estados completos e o slider anda entre elas — 0% é exatamente A
 * e 100% exatamente B, sem "quase".
 *
 * **Cada ponta guarda a câmera inteira** — posição, alvo, inclinação e lente.
 * Por isso os quatro botões (aproximar, afastar, girar, transladar) são só
 * ATALHOS que geram B a partir de A: quem quiser um *dolly zoom* marca A
 * perto com grande angular e B longe com teleobjetiva, e o slider faz o
 * resto, porque a lente interpola junto.
 *
 * **A interpolação é feita nas coordenadas do controle**, não na posição
 * bruta: alvo em linha reta, direção por arco e distância/lente em progressão
 * geométrica. Interpolar a posição direto faria a câmera cortar caminho por
 * dentro de uma órbita (mergulhando na direção do alvo), e faria um zoom
 * parecer rápido no começo e lento no fim.
 */

export interface CameraViewState {
  position: Vector3Tuple
  target: Vector3Tuple
  /** Topo da tela — carrega a inclinação holandesa, quando houver. */
  up: Vector3Tuple
  focalMm: number
}

export type MoveGeneratorKey = 'zoomIn' | 'zoomOut' | 'orbit' | 'truck' | 'dollyZoom' | 'crane'

export const MOVE_GENERATOR_KEYS: readonly MoveGeneratorKey[] = [
  'zoomIn',
  'zoomOut',
  'orbit',
  'truck',
  'dollyZoom',
  'crane',
]

/**
 * Termo em inglês de cada atalho — os quatro verbos do pedido do usuário mais
 * os dois movimentos compostos. Fora do i18n pelo mesmo motivo dos planos e
 * ângulos: é vocabulário de prompt, e a tradução vira legenda (DECISOES.md #47).
 */
export const MOVE_TERMS: Record<MoveGeneratorKey, string> = {
  zoomIn: 'Zoom In',
  zoomOut: 'Zoom Out',
  orbit: 'Rotate',
  truck: 'Translate',
  dollyZoom: 'Dolly Zoom',
  crane: 'Crane',
}

/** Quanto cada atalho mexe: metade/dobro da distância, um quarto de volta, meia distância para o lado. */
const ZOOM_FACTOR = 0.5
const ORBIT_DEG = 90
const TRUCK_FRACTION = 0.5

/** Quanto a lente se alonga no dolly zoom, e até que altura a grua sobe. */
const DOLLY_ZOOM_FACTOR = 4
const CRANE_ELEVATION_DEG = 40
const CRANE_ORBIT_DEG = 45

const tuple = (v: THREE.Vector3): Vector3Tuple => [v.x, v.y, v.z]
const vec = (t: Vector3Tuple) => new THREE.Vector3(...t)

/** Ponta B a partir de A, para cada atalho de movimento. */
export function generateMoveEnd(from: CameraViewState, kind: MoveGeneratorKey): CameraViewState {
  const target = vec(from.target)
  const offset = vec(from.position).sub(target)
  const distance = offset.length() || 1

  switch (kind) {
    case 'zoomIn':
    case 'zoomOut': {
      const factor = kind === 'zoomIn' ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
      return { ...from, position: tuple(target.clone().addScaledVector(offset.normalize(), distance * factor)) }
    }
    case 'orbit': {
      // Giro em torno do eixo vertical do MUNDO: é o que "girar em volta do
      // sujeito" quer dizer, e mantém a altura da câmera.
      const rotated = offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(ORBIT_DEG))
      return { ...from, position: tuple(target.clone().add(rotated)) }
    }
    case 'truck': {
      // Lateral da câmera: câmera e alvo andam juntos, então a direção de
      // visão não muda — o sujeito atravessa o quadro.
      const side = new THREE.Vector3(0, 1, 0).cross(offset).normalize()
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0) // câmera reto de cima
      const shift = side.multiplyScalar(distance * TRUCK_FRACTION)
      return {
        ...from,
        position: tuple(vec(from.position).add(shift)),
        target: tuple(target.add(shift)),
      }
    }
    case 'dollyZoom': {
      // O efeito Vertigo: o sujeito fica do MESMO tamanho e o fundo é que se
      // move. Como o `fov` sai de `2·atan(12/f)`, a altura enquadrada se
      // mantém quando a distância acompanha a distância focal na mesma
      // proporção — daí o fator ser o mesmo dos dois lados.
      const focalMm = clampFocalLength(from.focalMm * DOLLY_ZOOM_FACTOR)
      const factor = focalMm / from.focalMm
      return {
        ...from,
        position: tuple(target.clone().addScaledVector(offset.normalize(), distance * factor)),
        focalMm,
      }
    }
    case 'crane': {
      // Grua: sobe e contorna ao mesmo tempo, mantendo a distância. É o
      // movimento de abertura clássico — o chão sai do quadro e o sujeito
      // passa a ser visto de cima.
      const rotated = offset
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(CRANE_ORBIT_DEG))
      const flat = Math.hypot(rotated.x, rotated.z)
      const elevation = THREE.MathUtils.degToRad(CRANE_ELEVATION_DEG)
      const azimuth = flat < 1e-8 ? 0 : Math.atan2(rotated.x, rotated.z)
      const raised = new THREE.Vector3(
        Math.sin(azimuth) * Math.cos(elevation),
        Math.sin(elevation),
        Math.cos(azimuth) * Math.cos(elevation),
      ).multiplyScalar(distance)
      return { ...from, position: tuple(target.clone().add(raised)) }
    }
  }
}

/** Média geométrica ponderada — o passo constante de zoom. */
function geometricLerp(a: number, b: number, t: number): number {
  return Math.exp(Math.log(a) * (1 - t) + Math.log(b) * t)
}

/**
 * Direção intermediária pelo arco. Quando as duas são exatamente opostas
 * (meia-volta) não há eixo de giro implícito: aí o giro é feito em torno da
 * vertical do mundo, que é o caminho que qualquer um espera ao rodear um
 * boneco — e não um eixo arbitrário escolhido pelo quatérnio.
 */
function slerpDirection(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1)
  if (dot < -0.999999) {
    const axis = new THREE.Vector3(0, 1, 0)
    if (Math.abs(a.dot(axis)) > 0.999999) axis.set(1, 0, 0)
    return a.clone().applyAxisAngle(axis, Math.PI * t)
  }
  const quaternion = new THREE.Quaternion().setFromUnitVectors(a, b)
  return a.clone().applyQuaternion(new THREE.Quaternion().slerp(quaternion, t))
}

/** Estado da câmera a `t` (0..1) do caminho de `a` até `b`. */
export function interpolateCameraView(
  a: CameraViewState,
  b: CameraViewState,
  t: number,
): CameraViewState {
  const amount = Math.min(1, Math.max(0, t))
  if (amount === 0) return a
  if (amount === 1) return b

  const targetA = vec(a.target)
  const targetB = vec(b.target)
  const offsetA = vec(a.position).sub(targetA)
  const offsetB = vec(b.position).sub(targetB)
  const distanceA = offsetA.length() || 1e-6
  const distanceB = offsetB.length() || 1e-6

  const target = targetA.clone().lerp(targetB, amount)
  const direction = slerpDirection(offsetA.clone().normalize(), offsetB.clone().normalize(), amount)
  const distance = geometricLerp(distanceA, distanceB, amount)
  const position = target.clone().addScaledVector(direction, distance)

  // O topo da tela acompanha, mas tem de continuar perpendicular à visão:
  // a direção mudou de arco, então o `up` interpolado sai torto sem isto.
  const up = vec(a.up).lerp(vec(b.up), amount)
  const view = direction.clone().negate()
  up.addScaledVector(view, -up.dot(view))
  if (up.lengthSq() < 1e-8) up.set(0, 1, 0).addScaledVector(view, -new THREE.Vector3(0, 1, 0).dot(view))
  up.normalize()

  return {
    position: tuple(position),
    target: tuple(target),
    up: tuple(up),
    focalMm: clampFocalLength(geometricLerp(a.focalMm, b.focalMm, amount)),
  }
}
