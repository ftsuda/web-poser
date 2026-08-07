import * as THREE from 'three'
import { buildJointFrames } from '../figure/jointFrames'
import type { Figure } from '../store/figuresStore'
import type { CameraViewState } from './cameraMove'
import type { Vector3Tuple } from './cameraPresets'

/**
 * Apontar a câmera de cena para o boneco (pedido do usuário, 2026-08-06): girar
 * NO LUGAR até a lente olhar para o assunto.
 *
 * É o complemento barato do bloco de enquadramento do painel de Câmera, que
 * escolhe plano e ângulo e por isso RECOLOCA a câmera inteira. Aqui o ponto de
 * vista já foi escolhido — o que falta é virar a lente para o lado certo.
 *
 * Lógica pura, sem canvas: a câmera de cena vive no store (`figuresStore.
 * sceneCamera`) e o alvo é um ponto dele, então apontar é uma conta, não um
 * comando para o `CameraRig`. Quem grava é o painel.
 */

/**
 * A junta que a câmera mira: a **base do tórax** (decisão do usuário). É o
 * centro de massa visível do boneco — a cabeça deixaria o corpo na metade de
 * baixo do quadro, e a raiz (pelve) o deixaria na de cima.
 */
export const AIM_JOINT_NAME = 'chest'

/** Onde está o meio do corpo deste boneco, em coordenadas de mundo. */
export function figureAimPoint(figure: Figure): Vector3Tuple | null {
  const { joints } = buildJointFrames(figure)
  const chest = joints.get(AIM_JOINT_NAME)
  if (!chest) return null
  const world = chest.getWorldPosition(new THREE.Vector3())
  return [world.x, world.y, world.z]
}

/**
 * O meio do grupo: a média dos pontos de mira dos bonecos **visíveis**
 * (decisão do usuário). Contar quem está oculto puxaria a câmera para um lado
 * sem nada na tela. Devolve `null` quando não há ninguém visível para mirar.
 */
export function figuresAimPoint(figures: readonly Figure[]): Vector3Tuple | null {
  const points = figures
    .filter((figure) => figure.visible)
    .map(figureAimPoint)
    .filter((point): point is Vector3Tuple => point !== null)
  if (points.length === 0) return null

  const soma = points.reduce(
    (acc, [x, y, z]) => [acc[0] + x, acc[1] + y, acc[2] + z] as Vector3Tuple,
    [0, 0, 0] as Vector3Tuple,
  )
  return [soma[0] / points.length, soma[1] / points.length, soma[2] / points.length]
}

/**
 * A câmera girada no lugar para olhar o ponto: a **posição não muda** e o alvo
 * passa a ser o próprio ponto — com isso a distância do estado vira a distância
 * real até o assunto, que é o que os planos e o modo visão-câmera leem depois.
 *
 * **O topo da tela é preservado**, inclusive inclinado: a inclinação lateral é
 * escolha de quem enquadrou (o ângulo holandês do painel), e apontar não é
 * motivo para desfazê-la.
 *
 * Devolve a vista INTACTA (o mesmo objeto) quando não há como mirar: alvo em
 * cima da própria câmera, ou exatamente sobre o eixo do topo — aí a direção de
 * visão e o topo seriam paralelos, e a rolagem resultante seria arbitrária.
 */
export function withSceneCameraAimedAt(view: CameraViewState, point: Vector3Tuple): CameraViewState {
  const direction = new THREE.Vector3(...point).sub(new THREE.Vector3(...view.position))
  if (direction.lengthSq() < 1e-12) return view

  const up = new THREE.Vector3(...view.up)
  if (direction.clone().normalize().cross(up.clone().normalize()).lengthSq() < 1e-12) return view

  return { ...view, target: [...point] as Vector3Tuple }
}
