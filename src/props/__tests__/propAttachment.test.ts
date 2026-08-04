import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildJointFrames } from '../../figure/jointFrames'
import type { Figure } from '../../store/figuresStore'
import { sanitizePropAttachment, type PropAttachment } from '../sceneProp'
import { attachedPropPlacement, placementToAttachmentOffset } from '../propAttachment'

/**
 * Amarração de objeto a junta (PLANO.md > "Objetos pré-modelados e amarração
 * a juntas", metade 1): a colocação em mundo de um objeto amarrado é DERIVADA
 * do frame da junta a cada quadro — o keyframe continua registrando só
 * bonecos + câmera, e a espada acompanha a mão porque quem anda é a mão.
 */

function makeFigure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'figure-1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0.2, 0, -0.1],
    rotation: { x: 0, y: 0, z: 0 },
    pose: {},
    ...overrides,
  }
}

function makeAttachment(overrides: Partial<PropAttachment> = {}): PropAttachment {
  return {
    figureId: 'figure-1',
    jointName: 'wrist.R',
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    ...overrides,
  }
}

describe('sanitizePropAttachment', () => {
  const figureIds = new Set(['figure-1', 'figure-2'])

  it('aceita uma amarração válida e preserva os campos', () => {
    const result = sanitizePropAttachment(
      { figureId: 'figure-2', jointName: 'wrist.L', position: [0, -0.05, 0.01], rotation: { x: 10, y: 0, z: -20 } },
      figureIds,
    )
    expect(result).toEqual({
      figureId: 'figure-2',
      jointName: 'wrist.L',
      position: [0, -0.05, 0.01],
      rotation: { x: 10, y: 0, z: -20 },
    })
  })

  it('poda junta desconhecida e boneco que não existe', () => {
    expect(sanitizePropAttachment(makeAttachment({ jointName: 'tail' }), figureIds)).toBeNull()
    expect(sanitizePropAttachment(makeAttachment({ figureId: 'figure-9' }), figureIds)).toBeNull()
  })

  it('não é objeto → null; offset ilegível vira zero; rotação é lida com tolerância', () => {
    expect(sanitizePropAttachment(null, figureIds)).toBeNull()
    expect(sanitizePropAttachment('wrist.R', figureIds)).toBeNull()

    const result = sanitizePropAttachment(
      { figureId: 'figure-1', jointName: 'wrist.R', position: 'perto da mão', rotation: { y: 45 } },
      figureIds,
    )
    expect(result).toEqual({
      figureId: 'figure-1',
      jointName: 'wrist.R',
      position: [0, 0, 0],
      rotation: { x: 0, y: 45, z: 0 },
    })
  })

  it('grampeia um offset absurdo vindo de arquivo editado à mão', () => {
    const result = sanitizePropAttachment(makeAttachment({ position: [999, -999, 0] }), figureIds)
    expect(result?.position[0]).toBeLessThanOrEqual(20)
    expect(result?.position[1]).toBeGreaterThanOrEqual(-20)
  })
})

describe('attachedPropPlacement', () => {
  it('com offset zero, o objeto fica exatamente na junta (posição de mundo)', () => {
    const figure = makeFigure()
    const { joints } = buildJointFrames(figure)
    const expected = joints.get('wrist.R')!.getWorldPosition(new THREE.Vector3())

    const placement = attachedPropPlacement(figure, makeAttachment())
    expect(placement).not.toBeNull()
    expect(placement!.position[0]).toBeCloseTo(expected.x, 6)
    expect(placement!.position[1]).toBeCloseTo(expected.y, 6)
    expect(placement!.position[2]).toBeCloseTo(expected.z, 6)
  })

  it('com rotação de offset zero, o objeto herda a orientação de mundo da junta', () => {
    const figure = makeFigure({ pose: { 'shoulder.R': { x: 0, y: 0, z: -90 } } })
    const { joints } = buildJointFrames(figure)
    const expected = joints.get('wrist.R')!.getWorldQuaternion(new THREE.Quaternion())

    const placement = attachedPropPlacement(figure, makeAttachment())!
    const actual = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(placement.rotation.x),
        THREE.MathUtils.degToRad(placement.rotation.y),
        THREE.MathUtils.degToRad(placement.rotation.z),
        'XYZ',
      ),
    )
    // Quaternions iguais a menos de sinal (q e -q são a mesma rotação).
    expect(Math.abs(actual.dot(expected))).toBeCloseTo(1, 6)
  })

  it('a colocação acompanha a pose: levantar o braço move o objeto amarrado ao punho', () => {
    const attachment = makeAttachment()
    const neutral = attachedPropPlacement(makeFigure(), attachment)!
    const raised = attachedPropPlacement(
      makeFigure({ pose: { 'shoulder.R': { x: 0, y: 0, z: -90 } } }),
      attachment,
    )!

    const moved = Math.hypot(
      raised.position[0] - neutral.position[0],
      raised.position[1] - neutral.position[1],
      raised.position[2] - neutral.position[2],
    )
    expect(moved).toBeGreaterThan(0.3)
  })

  it('junta que não existe devolve null', () => {
    expect(attachedPropPlacement(makeFigure(), makeAttachment({ jointName: 'tail' }))).toBeNull()
  })
})

describe('placementToAttachmentOffset (ida-e-volta do gizmo)', () => {
  it('colocação de mundo → offset → colocação de mundo é identidade', () => {
    const figure = makeFigure({
      position: [0.5, 0.1, -0.3],
      rotation: { x: 0, y: 40, z: 0 },
      pose: { 'shoulder.R': { x: -30, y: 0, z: -45 }, 'elbow.R': { x: -60, y: -90, z: 0 } },
    })
    const world = { position: [0.3, 1.2, -0.2] as const, rotation: { x: 10, y: 20, z: 30 } }

    const offset = placementToAttachmentOffset(figure, 'wrist.R', world)
    expect(offset).not.toBeNull()

    const attachment = makeAttachment({ position: offset!.position, rotation: offset!.rotation })
    const roundTrip = attachedPropPlacement(figure, attachment)!

    expect(roundTrip.position[0]).toBeCloseTo(world.position[0], 5)
    expect(roundTrip.position[1]).toBeCloseTo(world.position[1], 5)
    expect(roundTrip.position[2]).toBeCloseTo(world.position[2], 5)

    const wanted = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(world.rotation.x),
        THREE.MathUtils.degToRad(world.rotation.y),
        THREE.MathUtils.degToRad(world.rotation.z),
        'XYZ',
      ),
    )
    const got = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(roundTrip.rotation.x),
        THREE.MathUtils.degToRad(roundTrip.rotation.y),
        THREE.MathUtils.degToRad(roundTrip.rotation.z),
        'XYZ',
      ),
    )
    expect(Math.abs(got.dot(wanted))).toBeCloseTo(1, 5)
  })

  it('a ida-e-volta vale também para boneco fora da altura de referência (escala)', () => {
    const figure = makeFigure({ height: 1.9 })
    const world = { position: [0.1, 1.0, 0.2] as const, rotation: { x: 0, y: 0, z: 0 } }

    const offset = placementToAttachmentOffset(figure, 'wrist.L', world)!
    const roundTrip = attachedPropPlacement(figure, makeAttachment({ jointName: 'wrist.L', ...offset }))!

    expect(roundTrip.position[0]).toBeCloseTo(world.position[0], 5)
    expect(roundTrip.position[1]).toBeCloseTo(world.position[1], 5)
    expect(roundTrip.position[2]).toBeCloseTo(world.position[2], 5)
  })

  it('junta que não existe devolve null', () => {
    expect(
      placementToAttachmentOffset(makeFigure(), 'tail', { position: [0, 0, 0], rotation: { x: 0, y: 0, z: 0 } }),
    ).toBeNull()
  })
})
