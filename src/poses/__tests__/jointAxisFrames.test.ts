import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import type { Figure } from '../../store/figuresStore'
import { jointWorldPosition } from '../posesEdit'
import { jointAxisFrames } from '../jointAxisFrames'

function makeFigure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: {},
    ...overrides,
  }
}

function frameQuat(
  result: NonNullable<ReturnType<typeof jointAxisFrames>>,
  axis: 'x' | 'y' | 'z',
): THREE.Quaternion {
  const frame = result.frames.find((candidate) => candidate.axis === axis)
  expect(frame).toBeDefined()
  return new THREE.Quaternion(...frame!.quaternion)
}

/** Mesma rotação = |produto escalar| 1 (q e -q representam o mesmo giro). */
function expectSameRotation(actual: THREE.Quaternion, expected: THREE.Quaternion) {
  expect(Math.abs(actual.dot(expected))).toBeCloseTo(1, 6)
}

function quatX(deg: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(deg),
  )
}

function quatY(deg: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(deg),
  )
}

function quatZ(deg: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(deg),
  )
}

describe('jointAxisFrames', () => {
  it('nome desconhecido devolve null', () => {
    expect(jointAxisFrames(makeFigure(), 'banana')).toBeNull()
  })

  it('a origem é a posição de mundo da junta — a mesma de jointWorldPosition', () => {
    const figure = makeFigure({ position: [1, 0, 2], pose: { 'shoulder.L': { x: 40, y: 0, z: 0 } } })
    const result = jointAxisFrames(figure, 'elbow.L')
    expect(result).not.toBeNull()
    const world = jointWorldPosition(figure, 'elbow.L')!
    expect(result!.origin[0]).toBeCloseTo(world[0], 6)
    expect(result!.origin[1]).toBeCloseTo(world[1], 6)
    expect(result!.origin[2]).toBeCloseTo(world[2], 6)
  })

  it('só os DOFs da junta viram anel: o joelho (dobradiça) tem um único frame, em X', () => {
    const result = jointAxisFrames(makeFigure(), 'knee.L')
    expect(result).not.toBeNull()
    expect(result!.frames.map((frame) => frame.axis)).toEqual(['x'])
  })

  it('a raiz mostra os três anéis nos EIXOS DO MUNDO, mesmo com o boneco girado', () => {
    const result = jointAxisFrames(makeFigure({ rotation: { x: 30, y: 45, z: 0 } }), 'root')
    expect(result).not.toBeNull()
    expect(result!.frames.map((frame) => frame.axis)).toEqual(['x', 'y', 'z'])
    for (const axis of ['x', 'y', 'z'] as const) {
      expectSameRotation(frameQuat(result!, axis), new THREE.Quaternion())
    }
  })

  it('com tudo em zero, os frames coincidem com o mundo (pais sem rotação)', () => {
    const result = jointAxisFrames(makeFigure(), 'shoulder.L')
    expect(result).not.toBeNull()
    for (const frame of result!.frames) {
      expectSameRotation(new THREE.Quaternion(...frame.quaternion), new THREE.Quaternion())
    }
  })

  it('fidelidade ao Euler XYZ: X fica no frame do pai; Y carrega a rotação X; Z carrega X e Y', () => {
    const figure = makeFigure({ pose: { 'shoulder.L': { x: 90, y: 45, z: 0 } } })
    const result = jointAxisFrames(figure, 'shoulder.L')!

    // O anel X ignora a rotação da própria junta — vive no frame do pai.
    expectSameRotation(frameQuat(result, 'x'), new THREE.Quaternion())
    // O anel Y gira junto com a rotação X já aplicada.
    expectSameRotation(frameQuat(result, 'y'), quatX(90))
    // O anel Z vem depois de X e Y — senão mentiria em junta já rodada.
    expectSameRotation(frameQuat(result, 'z'), quatX(90).multiply(quatY(45)))
  })

  it('a rotação do PAI entra no frame: girar o ombro em Z gira os anéis do cotovelo', () => {
    const figure = makeFigure({ pose: { 'shoulder.L': { x: 0, y: 0, z: 90 } } })
    const result = jointAxisFrames(figure, 'elbow.L')!
    expectSameRotation(frameQuat(result, 'x'), quatZ(90))
  })
})
