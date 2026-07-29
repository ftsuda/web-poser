import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Figure } from '../../store/figuresStore'
import { buildJointFrames } from '../jointFrames'
import { IK_CHAINS, getLimbEndEffector, getSwivelAngle, solveIKChain } from '../ikSolver'
import { resolvePosePreset } from '../posePresets'
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
    // Alvo a ~0,29 m do ombro (dentro do alcance máximo de ~0,52 m). A torção
    // livre da junta-base não é otimizada (ver docblock de `ikSolver.ts`) —
    // alvos deslocados para +X em vez de -X a partir do ombro esquerdo podem
    // exigir uma torção que bate no limite recém-corrigido de `shoulder.x`
    // (ver DECISOES.md #13); -X converge sem tocar nenhum limite.
    const target: [number, number, number] = [shoulderPos.x - 0.1, shoulderPos.y - 0.25, shoulderPos.z + 0.1]

    const result = solveIKChain(restingFigure, IK_CHAINS['wrist.L'], target)

    expect(result.reached).toBe(true)
    expect(result.remainingDistanceM).toBeLessThan(0.01)
    // elbow.x só existe no lado negativo desde a correção de DECISOES.md #14
    // (antes só permitia hiperestender) — o solver precisa aplicar o sinal
    // certo para a junta intermediária dobrar de verdade, não travar em 0.
    expect(result.rotations['elbow.L'].x).toBeLessThan(0)

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
    expect(getLimbEndEffector('fingersBase.L')).toBeNull()
  })
})

describe('solveIKChain — todas as 4 cadeias suportadas resolvem sem lançar erro', () => {
  it.each(Object.keys(IK_CHAINS))('%s', (endEffector) => {
    const pos = worldPositionOf(restingFigure, endEffector)
    const target: [number, number, number] = [pos.x + 0.05, pos.y, pos.z + 0.05]
    expect(() => solveIKChain(restingFigure, IK_CHAINS[endEffector], target)).not.toThrow()
  })
})

/**
 * Giro do cotovelo/joelho (DECISOES.md #44). Com as duas pontas do membro
 * paradas — ombro no lugar, mão no alvo — sobra exatamente UM grau de
 * liberdade: a volta do cotovelo em torno do eixo ombro→mão. O solver sempre
 * decidiu esse ângulo sozinho (herdando o da pose atual); agora ele pode vir
 * de fora.
 */
describe('giro do cotovelo/joelho (swivel)', () => {
  const posed = (pose: Record<string, { x: number; y: number; z: number }>): Figure => ({
    ...restingFigure,
    pose,
  })

  function comGiro(figure: Figure, limb: string, target: THREE.Vector3, swivelDeg: number) {
    const result = solveIKChain(figure, IK_CHAINS[limb], target.toArray(), { swivelDeg })
    return { result, figure: posed({ ...figure.pose, ...result.rotations }) }
  }

  /**
   * A propriedade que dispensa guardar o ângulo em qualquer lugar: medir o
   * giro da pose e resolver com ele de volta reproduz a MESMA pose. É isso que
   * permite o controle da UI ler da pose e escrever resolvendo, sem estado
   * intermediário para sair de sincronia.
   */
  it('medir o giro atual e reaplicá-lo reproduz a pose (ida e volta exata)', () => {
    for (const preset of ['fetal', 'handsOnHips', 'running'] as const) {
      for (const limb of ['wrist.L', 'wrist.R', 'ankle.L', 'ankle.R'] as const) {
        const figure = posed(resolvePosePreset(preset))
        const chain = IK_CHAINS[limb]
        const alvo = worldPositionOf(figure, chain.endEffector)
        const atual = getSwivelAngle(figure, chain)

        const { figure: reposed } = comGiro(figure, limb, alvo, atual)

        expect(worldPositionOf(reposed, chain.endEffector).distanceTo(alvo)).toBeLessThan(0.001)
        expect(getSwivelAngle(reposed, chain)).toBeCloseTo(atual, 1)
      }
    }
  })

  it('gira o cotovelo em torno do eixo ombro→mão sem tirar a mão do alvo', () => {
    const figure = posed(resolvePosePreset('handsOnHips'))
    const chain = IK_CHAINS['wrist.L']
    const ombro = worldPositionOf(figure, 'shoulder.L')
    const alvo = new THREE.Vector3(ombro.x + 0.15, ombro.y - 0.3, ombro.z + 0.25)

    const posicoes = [0, 30, 60].map((giro) => {
      const { figure: reposed } = comGiro(figure, 'wrist.L', alvo, giro)
      return {
        giro,
        cotovelo: worldPositionOf(reposed, 'elbow.L'),
        mao: worldPositionOf(reposed, chain.endEffector),
        medido: getSwivelAngle(reposed, chain),
      }
    })

    for (const { giro, mao, medido } of posicoes) {
      // A mão fica no alvo em todos eles — é essa a promessa do controle.
      expect(mao.distanceTo(alvo)).toBeLessThan(0.01)
      expect(medido).toBeCloseTo(giro, 0)
    }
    // E o cotovelo de fato passeia: posições distintas para giros distintos.
    expect(posicoes[0].cotovelo.distanceTo(posicoes[1].cotovelo)).toBeGreaterThan(0.05)
    expect(posicoes[1].cotovelo.distanceTo(posicoes[2].cotovelo)).toBeGreaterThan(0.05)
    // Todos à mesma distância do eixo: é uma circunferência, não um passeio livre.
    const eixo = alvo.clone().sub(ombro).normalize()
    const raios = posicoes.map(({ cotovelo }) => {
      const v = cotovelo.clone().sub(ombro)
      return v.addScaledVector(eixo, -v.dot(eixo)).length()
    })
    expect(Math.abs(raios[0] - raios[1])).toBeLessThan(0.005)
    expect(Math.abs(raios[1] - raios[2])).toBeLessThan(0.005)
  })

  /**
   * O que a medição mostrou e o que obriga `applyIKSwivel` a conferir o
   * resultado antes de aplicar: a volta inteira NÃO é alcançável. Os limites
   * do ombro/quadril liberam uma faixa contígua (85° a 220° de arco no braço,
   * 25° a 105° na perna), e fora dela a rotação da base é grampeada — o que
   * tira a mão do alvo em até 88 cm. Um cotovelo que não existe não é um
   * cotovelo torto: é uma mão que saiu do lugar.
   */
  it('fora da faixa alcançável, o efetuador escapa do alvo — e é por isso que o resultado é conferido', () => {
    const figure = posed(resolvePosePreset('handsOnHips'))
    const ombro = worldPositionOf(figure, 'shoulder.L')
    const alvo = new THREE.Vector3(ombro.x, ombro.y - 0.35, ombro.z + 0.2)

    const dentro = comGiro(figure, 'wrist.L', alvo, 30)
    expect(dentro.result.remainingDistanceM).toBeLessThan(0.01)

    const fora = comGiro(figure, 'wrist.L', alvo, 180)
    expect(fora.result.remainingDistanceM).toBeGreaterThan(0.1)
  })

  it('sem giro pedido, o solver mantém o comportamento antigo: herda o plano da pose atual', () => {
    const figure = posed(resolvePosePreset('handsOnHips'))
    const chain = IK_CHAINS['wrist.L']
    const alvo = worldPositionOf(figure, 'wrist.L')

    const semGiro = solveIKChain(figure, chain, alvo.toArray())
    const comAtual = solveIKChain(figure, chain, alvo.toArray(), { swivelDeg: getSwivelAngle(figure, chain) })

    for (const jointName of Object.keys(semGiro.rotations)) {
      expect(semGiro.rotations[jointName].x).toBeCloseTo(comAtual.rotations[jointName].x, 1)
      expect(semGiro.rotations[jointName].y).toBeCloseTo(comAtual.rotations[jointName].y, 1)
      expect(semGiro.rotations[jointName].z).toBeCloseTo(comAtual.rotations[jointName].z, 1)
    }
  })

  it('o giro acompanha o boneco: girar o boneco inteiro não muda o ângulo medido', () => {
    const emPe = posed(resolvePosePreset('handsOnHips'))
    const girado: Figure = { ...emPe, rotation: { x: 0, y: 130, z: 0 } }

    for (const limb of ['wrist.L', 'ankle.R'] as const) {
      expect(getSwivelAngle(girado, IK_CHAINS[limb])).toBeCloseTo(getSwivelAngle(emPe, IK_CHAINS[limb]), 1)
    }
  })

  it('membro esticado (cotovelo em cima do eixo): o giro não tem o que medir e devolve 0', () => {
    // Na pose de repouso o braço está reto — o cotovelo cai sobre o eixo
    // ombro→pulso e não há ângulo definido. Devolver 0 é melhor do que devolver
    // ruído de uma divisão degenerada.
    expect(getSwivelAngle(restingFigure, IK_CHAINS['wrist.L'])).toBe(0)
  })
})
