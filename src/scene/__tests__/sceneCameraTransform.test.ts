import { describe, expect, it } from 'vitest'
import type { CameraViewState } from '../cameraMove'
import {
  sceneCameraEulerDeg,
  withSceneCameraEulerDeg,
  withSceneCameraPosition,
} from '../sceneCameraTransform'

/**
 * Conversões dos controles numéricos da câmera de cena (fase 11.1). O
 * contrato: extração e reconstrução são inversas (o slider não pode "andar
 * sozinho" a cada render), girar preserva posição e distância, e transladar
 * preserva a direção de visão.
 */
describe('sceneCameraTransform — rotação (Euler YXZ, graus)', () => {
  const olhandoParaFrente: CameraViewState = {
    position: [0, 1.5, 5],
    target: [0, 1.5, 0],
    up: [0, 1, 0],
    focalMm: 35,
  }

  it('câmera olhando -Z, em pé, extrai rotação zero', () => {
    const euler = sceneCameraEulerDeg(olhandoParaFrente)
    expect(euler.x).toBeCloseTo(0, 6)
    expect(euler.y).toBeCloseTo(0, 6)
    expect(euler.z).toBeCloseTo(0, 6)
  })

  it('olhar para -X é guinada de +90°; olhar para baixo é inclinação negativa', () => {
    const paraEsquerda = sceneCameraEulerDeg({ ...olhandoParaFrente, position: [5, 1.5, 0], target: [0, 1.5, 0] })
    expect(paraEsquerda.y).toBeCloseTo(90, 6)

    const paraBaixo = sceneCameraEulerDeg({ ...olhandoParaFrente, position: [0, 6.5, 5], target: [0, 1.5, 0] })
    expect(paraBaixo.x).toBeCloseTo(-45, 6)
  })

  it('extração e reconstrução são inversas (round-trip estável)', () => {
    const eulerDeg = { x: -30, y: 120, z: 15 }
    const girada = withSceneCameraEulerDeg(olhandoParaFrente, eulerDeg)
    const extraida = sceneCameraEulerDeg(girada)
    expect(extraida.x).toBeCloseTo(eulerDeg.x, 4)
    expect(extraida.y).toBeCloseTo(eulerDeg.y, 4)
    expect(extraida.z).toBeCloseTo(eulerDeg.z, 4)
  })

  it('girar não move a posição nem muda a distância ao alvo', () => {
    const girada = withSceneCameraEulerDeg(olhandoParaFrente, { x: -20, y: 45, z: 0 })
    expect(girada.position).toEqual(olhandoParaFrente.position)

    const distancia = Math.hypot(
      girada.target[0] - girada.position[0],
      girada.target[1] - girada.position[1],
      girada.target[2] - girada.position[2],
    )
    expect(distancia).toBeCloseTo(5, 6)
    expect(girada.focalMm).toBe(35)
  })

  it('a rolagem (Z) inclina o topo da tela sem mudar a direção de visão', () => {
    const rolada = withSceneCameraEulerDeg(olhandoParaFrente, { x: 0, y: 0, z: 30 })
    expect(rolada.target[0]).toBeCloseTo(0, 6)
    expect(rolada.target[2]).toBeCloseTo(0, 6)
    // Topo inclinado 30° em torno da visão (-Z): up = (-sin30, cos30, 0).
    expect(rolada.up[0]).toBeCloseTo(-0.5, 6)
    expect(rolada.up[1]).toBeCloseTo(Math.sqrt(3) / 2, 6)
  })

  it('câmera degenerada (posição no alvo) não explode: gira em torno de distância 1', () => {
    const degenerada: CameraViewState = { ...olhandoParaFrente, target: [0, 1.5, 5] }
    const girada = withSceneCameraEulerDeg(degenerada, { x: 0, y: 0, z: 0 })
    expect(girada.target[2]).toBeCloseTo(4, 6)
  })
})

describe('sceneCameraTransform — posição', () => {
  it('transladar leva o alvo junto: a direção de visão não muda', () => {
    const antes: CameraViewState = {
      position: [1, 2, 3],
      target: [0, 1, 0],
      up: [0, 1, 0],
      focalMm: 50,
    }
    const depois = withSceneCameraPosition(antes, [4, 2, -1])
    expect(depois.position).toEqual([4, 2, -1])
    expect(depois.target).toEqual([3, 1, -4])
    expect(depois.up).toEqual(antes.up)
    expect(depois.focalMm).toBe(50)
  })
})
