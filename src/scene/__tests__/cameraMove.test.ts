import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  MOVE_GENERATOR_KEYS,
  MOVE_TERMS,
  generateMoveEnd,
  interpolateCameraView,
  type CameraViewState,
} from '../cameraMove'

const A: CameraViewState = {
  position: [0, 1.5, 4],
  target: [0, 1.5, 0],
  up: [0, 1, 0],
  focalMm: 50,
}

const vec = (t: readonly [number, number, number]) => new THREE.Vector3(...t)
const distanceOf = (view: CameraViewState) => vec(view.position).distanceTo(vec(view.target))

describe('interpolateCameraView', () => {
  it('as pontas são exatamente A e B', () => {
    const B = generateMoveEnd(A, 'zoomIn')
    expect(interpolateCameraView(A, B, 0)).toBe(A)
    expect(interpolateCameraView(A, B, 1)).toBe(B)
    expect(interpolateCameraView(A, B, -0.5)).toBe(A)
    expect(interpolateCameraView(A, B, 2)).toBe(B)
  })

  /**
   * Interpolar a POSIÇÃO em linha reta faria a câmera cortar caminho por
   * dentro do arco numa órbita, mergulhando na direção do alvo. A interpolação
   * é feita nas coordenadas do próprio controle: alvo, direção e distância.
   */
  it('numa órbita, a câmera percorre o arco — não a corda', () => {
    const B = generateMoveEnd(A, 'orbit')
    const meio = interpolateCameraView(A, B, 0.5)

    const distanciaA = distanceOf(A)
    expect(distanceOf(meio)).toBeCloseTo(distanciaA, 6)

    // A corda passaria bem mais perto do alvo do que o arco.
    const corda = vec(A.position).lerp(vec(B.position), 0.5)
    expect(corda.distanceTo(vec(A.target))).toBeLessThan(distanciaA * 0.95)
  })

  it('o alvo caminha em linha reta entre os dois pontos', () => {
    const B: CameraViewState = { ...A, target: [2, 0.5, -1], position: [2, 0.5, 3] }
    const meio = interpolateCameraView(A, B, 0.5)
    expect(meio.target).toEqual([1, 1, -0.5])
  })

  /** Distância e lente andam em progressão geométrica: é assim que zoom parece linear. */
  it('a distância no meio é a média geométrica, não a aritmética', () => {
    const B = generateMoveEnd(A, 'zoomIn')
    const meio = interpolateCameraView(A, B, 0.5)
    const esperado = Math.sqrt(distanceOf(A) * distanceOf(B))
    expect(distanceOf(meio)).toBeCloseTo(esperado, 6)
    expect(esperado).toBeLessThan((distanceOf(A) + distanceOf(B)) / 2)
  })

  it('a lente também interpola — é o que permite montar um dolly zoom', () => {
    const B: CameraViewState = { ...generateMoveEnd(A, 'zoomIn'), focalMm: 200 }
    const meio = interpolateCameraView(A, B, 0.5)
    expect(meio.focalMm).toBeCloseTo(Math.sqrt(50 * 200), 6)
    expect(meio.focalMm).toBeCloseTo(100, 6)
  })

  it('mantém o `up` unitário e perpendicular à visão ao interpolar uma inclinação', () => {
    const B: CameraViewState = { ...A, up: [Math.sin(Math.PI / 6), Math.cos(Math.PI / 6), 0] }
    const meio = interpolateCameraView(A, B, 0.5)
    const up = vec(meio.up)
    expect(up.length()).toBeCloseTo(1, 6)
    const visao = vec(meio.target).sub(vec(meio.position)).normalize()
    expect(Math.abs(up.dot(visao))).toBeLessThan(1e-6)
  })

  /** Meia-volta: as direções ficam opostas e não há eixo de giro implícito. */
  it('numa meia-volta, gira na horizontal em vez de escolher um eixo qualquer', () => {
    const B: CameraViewState = { ...A, position: [0, 1.5, -4] }
    const meio = interpolateCameraView(A, B, 0.5)
    expect(distanceOf(meio)).toBeCloseTo(4, 6)
    // Passa pelo lado, na mesma altura — não por cima nem por baixo.
    expect(meio.position[1]).toBeCloseTo(1.5, 6)
    expect(Math.abs(meio.position[0])).toBeCloseTo(4, 6)
  })
})

describe('generateMoveEnd', () => {
  it('cobre os movimentos pedidos, com o termo em inglês de cada um (#47)', () => {
    expect(MOVE_GENERATOR_KEYS).toEqual([
      'zoomIn',
      'zoomOut',
      'orbit',
      'truck',
      'dollyZoom',
      'crane',
    ])
    expect(MOVE_GENERATOR_KEYS.map((key) => MOVE_TERMS[key])).toEqual([
      'Zoom In',
      'Zoom Out',
      'Rotate',
      'Translate',
      'Dolly Zoom',
      'Crane',
    ])
  })

  /**
   * O efeito Vertigo: o sujeito não muda de tamanho, o fundo é que se abre ou
   * se fecha. Montá-lo à mão exigia marcar A perto com grande angular e B longe
   * com teleobjetiva; este atalho faz a conta.
   */
  it('o dolly zoom afasta a câmera e alonga a lente na mesma proporção', () => {
    const B = generateMoveEnd(A, 'dollyZoom')
    expect(B.target).toEqual(A.target)
    expect(B.focalMm).toBeGreaterThan(A.focalMm)
    expect(distanceOf(B) / distanceOf(A)).toBeCloseTo(B.focalMm / A.focalMm, 6)

    // O tamanho do sujeito na tela é o mesmo nas duas pontas — e no meio.
    const alturaEnquadrada = (view: CameraViewState) =>
      (2 * distanceOf(view) * 12) / view.focalMm
    expect(alturaEnquadrada(B)).toBeCloseTo(alturaEnquadrada(A), 6)
    expect(alturaEnquadrada(interpolateCameraView(A, B, 0.5))).toBeCloseTo(alturaEnquadrada(A), 6)
  })

  it('a grua sobe e contorna ao mesmo tempo, mantendo a distância', () => {
    const B = generateMoveEnd(A, 'crane')
    expect(B.target).toEqual(A.target)
    expect(distanceOf(B)).toBeCloseTo(distanceOf(A), 6)
    // Mais alta que a origem, e girada — não é só um `orbit` nem só um subir.
    expect(B.position[1]).toBeGreaterThan(A.position[1])
    const giro = new THREE.Vector2(A.position[0] - A.target[0], A.position[2] - A.target[2]).angle()
    const giroB = new THREE.Vector2(B.position[0] - B.target[0], B.position[2] - B.target[2]).angle()
    expect(Math.abs(giroB - giro)).toBeGreaterThan(0.1)
  })

  it('aproximar e afastar mudam só a distância, mantendo alvo, direção e lente', () => {
    for (const [key, fator] of [
      ['zoomIn', 0.5],
      ['zoomOut', 2],
    ] as const) {
      const B = generateMoveEnd(A, key)
      expect(B.target).toEqual(A.target)
      expect(B.focalMm).toBe(A.focalMm)
      expect(distanceOf(B)).toBeCloseTo(distanceOf(A) * fator, 6)
      // Mesma direção: só a distância mudou.
      const dirA = vec(A.position).sub(vec(A.target)).normalize()
      const dirB = vec(B.position).sub(vec(B.target)).normalize()
      expect(dirA.dot(dirB)).toBeCloseTo(1, 6)
    }
  })

  it('girar dá um quarto de volta em torno do alvo, na mesma altura e distância', () => {
    const B = generateMoveEnd(A, 'orbit')
    expect(B.target).toEqual(A.target)
    expect(distanceOf(B)).toBeCloseTo(distanceOf(A), 6)
    expect(B.position[1]).toBeCloseTo(A.position[1], 6)
    const dirA = vec(A.position).sub(vec(A.target))
    const dirB = vec(B.position).sub(vec(B.target))
    expect(dirA.dot(dirB)).toBeCloseTo(0, 6) // 90°
  })

  it('transladar leva câmera E alvo para o lado, mantendo a direção de visão', () => {
    const B = generateMoveEnd(A, 'truck')
    expect(distanceOf(B)).toBeCloseTo(distanceOf(A), 6)
    const dirA = vec(A.position).sub(vec(A.target)).normalize()
    const dirB = vec(B.position).sub(vec(B.target)).normalize()
    expect(dirA.dot(dirB)).toBeCloseTo(1, 6)
    // O alvo se deslocou lateralmente (é o que diferencia de girar).
    expect(vec(B.target).distanceTo(vec(A.target))).toBeGreaterThan(0.5)
    expect(B.target[1]).toBeCloseTo(A.target[1], 6)
  })
})
