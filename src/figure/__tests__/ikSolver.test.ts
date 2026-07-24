import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Figure } from '../../store/figuresStore'
import { buildJointFrames } from '../jointFrames'
import { IK_CHAINS, getLimbEndEffector, solveIKChain } from '../ikSolver'
import { getJoint } from '../skeleton'

const restingFigure: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [0, 0, 0],
  rotation: { x: 0, y: 0, z: 0 },
  pose: {},
}

function worldPositionOf(figure: Figure, jointName: string): THREE.Vector3 {
  const { joints } = buildJointFrames(figure)
  const position = new THREE.Vector3()
  joints.get(jointName)!.getWorldPosition(position)
  return position
}

describe('solveIKChain — braço (ombro+cotovelo → pulso)', () => {
  it('mal se move quando o alvo já está onde o pulso está agora', () => {
    const wristPos = worldPositionOf(restingFigure, 'wrist.L')
    const result = solveIKChain(restingFigure, IK_CHAINS['wrist.L'], wristPos.toArray())

    expect(result.reached).toBe(true)
    expect(result.remainingDistanceM).toBeLessThan(0.01)
  })

  it('converge para um alvo alcançável dentro da cadeia', () => {
    const shoulderPos = worldPositionOf(restingFigure, 'shoulder.L')
    // Alvo a ~0,29 m do ombro (dentro do alcance máximo de ~0,58 m). A torção
    // livre da junta-base não é otimizada (ver docblock de `ikSolver.ts`) —
    // alvos deslocados para +X em vez de -X a partir do ombro esquerdo podem
    // exigir uma torção que bate no limite recém-corrigido de `shoulder.x`
    // (ver DECISOES.md #13); -X converge sem tocar nenhum limite.
    const target: [number, number, number] = [shoulderPos.x - 0.1, shoulderPos.y - 0.25, shoulderPos.z + 0.1]

    const result = solveIKChain(restingFigure, IK_CHAINS['wrist.L'], target)

    expect(result.reached).toBe(true)
    expect(result.remainingDistanceM).toBeLessThan(0.01)

    const posed: Figure = { ...restingFigure, pose: { ...restingFigure.pose, ...result.rotations } }
    const achieved = worldPositionOf(posed, 'wrist.L')
    expect(achieved.distanceTo(new THREE.Vector3(...target))).toBeLessThan(0.01)
  })

  it('faz a melhor aproximação (sem violar limites) quando o alvo está fora de alcance', () => {
    const target: [number, number, number] = [100, 0, 0] // muito além do braço
    const result = solveIKChain(restingFigure, IK_CHAINS['wrist.L'], target)

    expect(result.reached).toBe(false)
    expect(result.remainingDistanceM).toBeGreaterThan(1)

    // Mesmo sem alcançar, as rotações resultantes devem respeitar os limites do skeleton.ts.
    const shoulderLimits = getJoint('shoulder.L').limits
    const elbowLimits = getJoint('elbow.L').limits
    const shoulder = result.rotations['shoulder.L']
    const elbow = result.rotations['elbow.L']
    expect(shoulder.x).toBeGreaterThanOrEqual(shoulderLimits.x!.min)
    expect(shoulder.x).toBeLessThanOrEqual(shoulderLimits.x!.max)
    expect(elbow.x).toBeGreaterThanOrEqual(elbowLimits.x!.min)
    expect(elbow.x).toBeLessThanOrEqual(elbowLimits.x!.max)
  })

  it('nunca produz NaN, mesmo com um alvo degenerado (na origem exata da junta)', () => {
    const shoulderPos = worldPositionOf(restingFigure, 'shoulder.L')
    const result = solveIKChain(restingFigure, IK_CHAINS['wrist.L'], shoulderPos.toArray())

    for (const rotation of Object.values(result.rotations)) {
      expect(Number.isNaN(rotation.x)).toBe(false)
      expect(Number.isNaN(rotation.y)).toBe(false)
      expect(Number.isNaN(rotation.z)).toBe(false)
    }
    expect(Number.isNaN(result.remainingDistanceM)).toBe(false)
  })
})

describe('solveIKChain — perna (quadril+joelho → tornozelo)', () => {
  it('converge para um alvo alcançável', () => {
    const anklePos = worldPositionOf(restingFigure, 'ankle.L')
    const target: [number, number, number] = [anklePos.x + 0.1, anklePos.y + 0.15, anklePos.z + 0.1]

    const result = solveIKChain(restingFigure, IK_CHAINS['ankle.L'], target)

    expect(result.reached).toBe(true)
    const kneeLimits = getJoint('knee.L').limits
    expect(result.rotations['knee.L'].x).toBeGreaterThanOrEqual(kneeLimits.x!.min)
    expect(result.rotations['knee.L'].x).toBeLessThanOrEqual(kneeLimits.x!.max)
  })
})

describe('getLimbEndEffector', () => {
  it('mapeia a junta-base, a intermediária e o efetuador de cada membro para a mesma chave', () => {
    expect(getLimbEndEffector('shoulder.L')).toBe('wrist.L')
    expect(getLimbEndEffector('elbow.L')).toBe('wrist.L')
    expect(getLimbEndEffector('wrist.L')).toBe('wrist.L')
    expect(getLimbEndEffector('hip.R')).toBe('ankle.R')
    expect(getLimbEndEffector('knee.R')).toBe('ankle.R')
    expect(getLimbEndEffector('ankle.R')).toBe('ankle.R')
  })

  it('retorna null para juntas fora de qualquer cadeia de IK', () => {
    expect(getLimbEndEffector('root')).toBeNull()
    expect(getLimbEndEffector('spine')).toBeNull()
    expect(getLimbEndEffector('fingers.L')).toBeNull()
  })
})

describe('solveIKChain — todas as 4 cadeias suportadas resolvem sem lançar erro', () => {
  it.each(Object.keys(IK_CHAINS))('%s', (endEffector) => {
    const pos = worldPositionOf(restingFigure, endEffector)
    const target: [number, number, number] = [pos.x + 0.05, pos.y, pos.z + 0.05]
    expect(() => solveIKChain(restingFigure, IK_CHAINS[endEffector], target)).not.toThrow()
  })
})
