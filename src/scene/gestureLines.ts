import * as THREE from 'three'
import { buildJointFrames } from '../figure/jointFrames'
import type { Figure } from '../store/figuresStore'

/**
 * As linhas de gesto (PLANO.md item 9, `DECISOES.md` #122): o vocabulário do
 * desenho gestual desenhado por cima do boneco.
 *
 * - **Linha de ação** — cabeça → pelve → pé de apoio. É a primeira coisa que se
 *   traça ao desenhar uma figura, e a que diz se a pose tem gesto ou está
 *   parada. Curva, não reta: a quebra na pelve é o que ela existe para mostrar.
 * - **Linhas de ombro e quadril** — as duas transversais cuja inclinação
 *   RELATIVA é o contraposto. Sozinha, cada uma diz pouco; o par diz tudo.
 *
 * Módulo puro (só `buildJointFrames` e vetores): roda no projeto `unidade` da
 * suíte, sem Canvas. Quem desenha é o `GestureLines.tsx`.
 */

/**
 * Vão das transversais, como fração da altura do boneco. As juntas dos quadris
 * distam só 18 cm num boneco de 1,70 m — do tamanho real, a linha do quadril
 * apareceria como um toco ao lado da dos ombros, e comparar as duas inclinações
 * é justamente o ponto. As duas são estendidas ao MESMO vão, centradas.
 */
export const GESTURE_SPAN_RATIO = 0.22

export type GesturePoint = readonly [number, number, number]
export type GestureSegment = readonly [GesturePoint, GesturePoint]

export interface GestureLines {
  /** Cabeça, pelve e pé de apoio — os três pontos de controle da curva. */
  action: readonly [GesturePoint, GesturePoint, GesturePoint]
  shoulders: GestureSegment
  hips: GestureSegment
}

function toTriple(vector: THREE.Vector3): GesturePoint {
  return [vector.x, vector.y, vector.z]
}

/** Segmento centrado no meio das duas juntas, esticado até o vão pedido. */
function spanned(a: THREE.Vector3, b: THREE.Vector3, span: number): GestureSegment {
  const middle = a.clone().add(b).multiplyScalar(0.5)
  const direction = b.clone().sub(a)
  // Juntas coincidentes (pose degenerada): fica o eixo X, para a linha existir.
  if (direction.lengthSq() < 1e-12) direction.set(1, 0, 0)
  direction.normalize().multiplyScalar(span / 2)
  return [toTriple(middle.clone().sub(direction)), toTriple(middle.clone().add(direction))]
}

export function buildGestureLines(figure: Figure | null): GestureLines | null {
  if (!figure) return null
  const { joints } = buildJointFrames(figure)

  const at = (name: string): THREE.Vector3 | null => {
    const group = joints.get(name)
    return group ? group.getWorldPosition(new THREE.Vector3()) : null
  }

  const head = at('head')
  const lShoulder = at('shoulder.L')
  const rShoulder = at('shoulder.R')
  const lHip = at('hip.L')
  const rHip = at('hip.R')
  const lAnkle = at('ankle.L')
  const rAnkle = at('ankle.R')
  if (!head || !lShoulder || !rShoulder || !lHip || !rHip || !lAnkle || !rAnkle) return null

  const pelvis = lHip.clone().add(rHip).multiplyScalar(0.5)
  // O pé de APOIO é o mais baixo: é nele que o peso cai, e é até ele que a
  // linha de ação desce. Numa pose simétrica dá empate, e qualquer um dos dois
  // serve — a linha sai igual.
  const support = lAnkle.y <= rAnkle.y ? lAnkle : rAnkle

  const span = figure.height * GESTURE_SPAN_RATIO
  return {
    action: [toTriple(head), toTriple(pelvis), toTriple(support)],
    shoulders: spanned(rShoulder, lShoulder, span),
    hips: spanned(rHip, lHip, span),
  }
}
