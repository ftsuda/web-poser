import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Figure } from '../../store/figuresStore'
import { buildJointFrames } from '../jointFrames'
import { getJoint } from '../skeleton'

/**
 * Trava numérica das convenções de sinal auditadas em `DECISOES.md` #14 —
 * mesmo método usado no #13: monta a árvore cinemática, aplica uma rotação
 * isolada numa junta, mede a posição resultante do filho no mundo. Evita que
 * uma mudança futura em `skeleton.ts` inverta um eixo sem querer.
 */

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

function worldPos(figure: Figure, jointName: string): THREE.Vector3 {
  const { joints } = buildJointFrames(figure)
  const v = new THREE.Vector3()
  joints.get(jointName)!.getWorldPosition(v)
  return v
}

function posedFigure(pose: Figure['pose']): Figure {
  return { ...restingFigure, pose }
}

describe('convenção de sinal — tronco (filho "acima": X positivo flexiona para a frente)', () => {
  it('spine.x positivo inclina o chest para frente (+Z)', () => {
    const rest = worldPos(restingFigure, 'chest')
    const posed = worldPos(posedFigure({ spine: { x: 20, y: 0, z: 0 } }), 'chest')
    expect(posed.z).toBeGreaterThan(rest.z)
  })

  it('chest.x positivo inclina o neck para frente (+Z)', () => {
    const rest = worldPos(restingFigure, 'neck')
    const posed = worldPos(posedFigure({ chest: { x: 20, y: 0, z: 0 } }), 'neck')
    expect(posed.z).toBeGreaterThan(rest.z)
  })
})

describe('convenção de sinal — membros (filho "abaixo": X negativo flexiona para a frente)', () => {
  it('elbow.x negativo dobra o pulso para frente (+Z), igual ao ombro', () => {
    const rest = worldPos(restingFigure, 'wrist.L')
    const posed = worldPos(posedFigure({ 'elbow.L': { x: -30, y: 0, z: 0 } }), 'wrist.L')
    expect(posed.z).toBeGreaterThan(rest.z)
  })

  it('ankle.x positivo (flexão plantar, maior amplitude) abaixa a ponta do pé', () => {
    const rest = worldPos(restingFigure, 'ball.L')
    const posed = worldPos(posedFigure({ 'ankle.L': { x: 30, y: 0, z: 0 } }), 'ball.L')
    expect(posed.y).toBeLessThan(rest.y)
  })

  it('ankle.x negativo (dorsiflexão, menor amplitude) levanta a ponta do pé', () => {
    const rest = worldPos(restingFigure, 'ball.L')
    const posed = worldPos(posedFigure({ 'ankle.L': { x: -15, y: 0, z: 0 } }), 'ball.L')
    expect(posed.y).toBeGreaterThan(rest.y)
  })
})

describe('faixas maiores do lado anatômico de maior amplitude (após #13/#14)', () => {
  it.each([['spine'], ['chest']] as const)('%s.x tem a amplitude de flexão (positiva) maior que a de extensão', (joint) => {
    const limit = getJoint(joint).limits.x!
    expect(limit.max).toBeGreaterThan(Math.abs(limit.min))
  })

  it('ankle.x tem a amplitude de flexão plantar (positiva) maior que a de dorsiflexão', () => {
    const limit = getJoint('ankle.L').limits.x!
    expect(limit.max).toBeGreaterThan(Math.abs(limit.min))
  })

  it('elbow.x só permite flexão (negativa) — sem hiperextensão', () => {
    const limit = getJoint('elbow.L').limits.x!
    expect(limit.min).toBeLessThan(0)
    expect(limit.max).toBe(0)
  })
})

describe('mão alinhada aos eixos locais do punho (DECISOES.md #25): eixos de dobra anatômicos', () => {
  it('fingersBase.x positivo curva os dedos EXATAMENTE para a palma (-Z em repouso), sem componente diagonal', () => {
    const rest = worldPos(restingFigure, 'fingersTip.L')
    const posed = worldPos(posedFigure({ 'fingersBase.L': { x: 60, y: 0, z: 0 } }), 'fingersTip.L')
    expect(posed.z).toBeLessThan(rest.z)
    // Sem desvio lateral — era o defeito da modelagem diagonal antiga (mão
    // 45° fora dos eixos: a dobra ia meio para a palma, meio para trás).
    expect(posed.x).toBeCloseTo(rest.x, 5)
  })

  it('wrist.x positivo flexiona a mão para a palma (-Z em repouso), também sem desvio lateral', () => {
    const rest = worldPos(restingFigure, 'fingersTip.L')
    const posed = worldPos(posedFigure({ 'wrist.L': { x: 30, y: 0, z: 0 } }), 'fingersTip.L')
    expect(posed.z).toBeLessThan(rest.z)
    expect(posed.x).toBeCloseTo(rest.x, 5)
  })

  it('thumb1.z positivo (L) aduz o polegar em direção aos dedos, sem sair do plano da palma', () => {
    const rest = worldPos(restingFigure, 'thumb2.L')
    const posed = worldPos(posedFigure({ 'thumb1.L': { x: 0, y: 0, z: 40 } }), 'thumb2.L')
    expect(posed.x).toBeGreaterThan(rest.x)
    expect(posed.y).toBeLessThan(rest.y)
    expect(posed.z).toBeCloseTo(rest.z, 5)
  })
})

describe('eixos Y/Z de juntas pareadas L/R têm sentido anatômico oposto para o mesmo sinal (documentado, não corrigido)', () => {
  it('shoulder.z positivo abduz (afasta do corpo) o braço esquerdo mas aduz (aproxima do corpo) o direito', () => {
    const restL = worldPos(restingFigure, 'elbow.L')
    const posedL = worldPos(posedFigure({ 'shoulder.L': { x: 0, y: 0, z: 30 } }), 'elbow.L')
    const restR = worldPos(restingFigure, 'elbow.R')
    const posedR = worldPos(posedFigure({ 'shoulder.R': { x: 0, y: 0, z: 30 } }), 'elbow.R')

    // Esquerdo (repouso em +X): afastar do corpo é ir para +X (abdução).
    expect(posedL.x).toBeGreaterThan(restL.x)
    // Direito (repouso em -X): o MESMO sinal (+z) também move para +X — ou
    // seja, para o direito isso é aproximar do corpo (adução), não abduzir.
    expect(posedR.x).toBeGreaterThan(restR.x)
  })
})
