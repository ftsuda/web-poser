import { describe, expect, it } from 'vitest'
import { captureFigurePose, sanitizeSavedPoses } from '../poseLibrary'
import { resolvePosePreset, resolvePosePresetPlacement } from '../posePresets'
import { getHeightScale, getJoint } from '../skeleton'
import type { Figure } from '../../store/figuresStore'

function figure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [1, 0, -2],
    rotation: { x: 0, y: 0, z: 0 },
    pose: resolvePosePreset('tpose'),
    ...overrides,
  }
}

describe('captureFigurePose', () => {
  it('guarda as juntas da pose, sem o root', () => {
    const saved = captureFigurePose(figure(), 'pose-1', 'Minha pose')

    expect(saved.id).toBe('pose-1')
    expect(saved.name).toBe('Minha pose')
    expect(saved.pose['shoulder.L'].z).toBe(90)
    expect(saved.pose.root).toBeUndefined()
  })

  it('não leva onde o boneco está no chão nem para onde ele encara, numa pose em pé', () => {
    const saved = captureFigurePose(
      figure({ position: [3, 0, -4], rotation: { x: 0, y: 137, z: 0 } }),
      'pose-1',
      'Em pé',
    )

    // X/Z são encenação e nem sequer existem numa pose salva; o giro em Y é
    // encenação também, e por isso `preservesHeading` manda preservá-lo.
    expect(saved.rotation).toEqual({ x: 0, y: 0, z: 0 })
    expect(saved.preservesHeading).toBe(true)
    expect(saved.groundOffsetM).toBe(0)
  })

  /**
   * O que a decisão do usuário ("pose + assentamento") compra: uma pose
   * deitada salva volta deitada, e não em pé atravessando o chão.
   */
  it('guarda a inclinação e a altura do quadril de uma pose deitada', () => {
    const placement = resolvePosePresetPlacement('lyingSpreadSupine')
    const saved = captureFigurePose(
      figure({
        pose: resolvePosePreset('lyingSpreadSupine'),
        rotation: placement.rotation,
        position: [0, placement.groundOffsetM, 0],
      }),
      'pose-1',
      'Deitado',
    )

    expect(saved.rotation).toEqual({ x: -90, y: 0, z: 0 })
    expect(saved.preservesHeading).toBe(false)
    expect(saved.groundOffsetM).toBeCloseTo(placement.groundOffsetM, 6)
  })

  it('desfaz a escala do boneco: a mesma pose dá o mesmo número em qualquer altura', () => {
    const placement = resolvePosePresetPlacement('sitting')
    const baixo = captureFigurePose(
      figure({ height: 1.5, position: [0, placement.groundOffsetM * getHeightScale(1.5), 0] }),
      'pose-1',
      'Sentado',
    )
    const alto = captureFigurePose(
      figure({ height: 1.9, position: [0, placement.groundOffsetM * getHeightScale(1.9), 0] }),
      'pose-2',
      'Sentado',
    )

    expect(baixo.groundOffsetM).toBeCloseTo(placement.groundOffsetM, 6)
    expect(alto.groundOffsetM).toBeCloseTo(placement.groundOffsetM, 6)
  })
})

describe('sanitizeSavedPoses', () => {
  const valid = {
    id: 'pose-1',
    name: 'Guarda',
    pose: { 'shoulder.L': [10, 90, 20], 'elbow.L': { x: -30, y: 90, z: 0 } },
    rotation: [0, 0, 0],
    groundOffsetM: 0,
    preservesHeading: true,
  }

  it('aceita a junta em tupla e em objeto — o arquivo da pasta e o autosave usam formas diferentes', () => {
    const [pose] = sanitizeSavedPoses([valid])
    expect(pose.pose['shoulder.L']).toEqual({ x: 10, y: 90, z: 20 })
    expect(pose.pose['elbow.L']).toEqual({ x: -30, y: 90, z: 0 })
  })

  it('grampeia cada junta nos limites em vigor, como as poses das cenas', () => {
    const limite = getJoint('elbow.L').limits.x!
    const [pose] = sanitizeSavedPoses([{ ...valid, pose: { 'elbow.L': [limite.min - 500, 90, 0] } }])
    expect(pose.pose['elbow.L'].x).toBe(limite.min)
  })

  it('descarta juntas desconhecidas, o root e poses sem junta nenhuma', () => {
    const poses = sanitizeSavedPoses([
      { ...valid, pose: { 'shoulder.L': [0, 90, 0], root: [10, 10, 10], asaEsquerda: [1, 2, 3] } },
      { ...valid, id: 'pose-2', pose: { asaEsquerda: [1, 2, 3] } },
      { ...valid, id: 'pose-3', pose: 'não é objeto' },
      'nem é objeto',
    ])

    expect(poses).toHaveLength(1)
    expect(Object.keys(poses[0].pose)).toEqual(['shoulder.L'])
  })

  /** A rotação é a fonte da verdade: num arquivo editado à mão os dois campos podem se contradizer. */
  it('recalcula preservesHeading a partir da rotação, ignorando o que o arquivo disser', () => {
    const [deitado] = sanitizeSavedPoses([{ ...valid, rotation: [-90, 0, 0], preservesHeading: true }])
    expect(deitado.preservesHeading).toBe(false)

    const [emPe] = sanitizeSavedPoses([{ ...valid, rotation: [0, 45, 0], preservesHeading: false }])
    expect(emPe.preservesHeading).toBe(true)
  })

  it('preenche id e nome ausentes e não deixa dois ids iguais', () => {
    const poses = sanitizeSavedPoses([
      { pose: { 'shoulder.L': [0, 90, 0] } },
      { id: 'pose-1', pose: { 'shoulder.R': [0, -90, 0] } },
    ])

    expect(poses[0].id).toBe('pose-1')
    expect(poses[0].name).toBe('pose-1')
    expect(poses[1].id).not.toBe(poses[0].id)
  })

  it('devolve lista vazia para qualquer entrada que não seja uma lista', () => {
    expect(sanitizeSavedPoses(null)).toEqual([])
    expect(sanitizeSavedPoses({ poses: [] })).toEqual([])
    expect(sanitizeSavedPoses(undefined)).toEqual([])
  })

  it('cai para valores padrão em rotação e altura inválidas, sem descartar a pose', () => {
    const [pose] = sanitizeSavedPoses([{ ...valid, rotation: 'nada', groundOffsetM: 'baixo' }])
    expect(pose.rotation).toEqual({ x: 0, y: 0, z: 0 })
    expect(pose.groundOffsetM).toBe(0)
  })
})
