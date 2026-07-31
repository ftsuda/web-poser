import { describe, expect, it } from 'vitest'
import { readRotation, sanitizeFigure, sanitizePose, toRotation, toVec3 } from '../figureFormat'
import { DEFAULT_FIGURE_COLOR } from '../../store/figuresStore'

/**
 * O leitor único de boneco (DECISOES.md #86). O que estes testes protegem, além
 * do óbvio, é o CONTRATO DE COMPATIBILIDADE: `joints:[x,y,z]` era como a cena e
 * o autosave gravavam antes, e continua sendo lido para sempre — sem isso, um
 * workspace salvo antes da unificação abriria com todos os bonecos em T-pose.
 */

describe('toRotation — leitura estrita das duas codificações', () => {
  it('lê o objeto e a tupla, e dá o mesmo resultado para os dois', () => {
    expect(toRotation({ x: 10, y: -20, z: 30 })).toEqual({ x: 10, y: -20, z: 30 })
    expect(toRotation([10, -20, 30])).toEqual({ x: 10, y: -20, z: 30 })
  })

  it('recusa o que não dá para ler, em vez de inventar zero', () => {
    for (const bogus of [null, undefined, 42, 'x', [], [1, 2], [1, 2, 3, 4], [1, 2, 'z'], { x: 1, y: 2 }, { x: 1, y: 2, z: 'c' }]) {
      expect(toRotation(bogus)).toBeNull()
    }
  })

  it('recusa números não finitos — NaN numa junta viraria uma pose impossível de desenhar', () => {
    expect(toRotation([Number.NaN, 0, 0])).toBeNull()
    expect(toRotation({ x: 0, y: Number.POSITIVE_INFINITY, z: 0 })).toBeNull()
  })
})

describe('readRotation — leitura tolerante, para BONECO', () => {
  it('cai para zero no que não dá para ler, sem falhar', () => {
    expect(readRotation(null)).toEqual({ x: 0, y: 0, z: 0 })
    expect(readRotation('nada')).toEqual({ x: 0, y: 0, z: 0 })
    expect(readRotation([1, 2])).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('salva os eixos legíveis de um objeto meio quebrado, em vez de perder a junta inteira', () => {
    expect(readRotation({ x: 10, y: 'dez', z: 30 })).toEqual({ x: 10, y: 0, z: 30 })
  })
})

describe('toVec3', () => {
  it('exige três números finitos e devolve o fallback quando não tem', () => {
    expect(toVec3([1, 2, 3], [9, 9, 9])).toEqual([1, 2, 3])
    expect(toVec3([1, 2], [9, 9, 9])).toEqual([9, 9, 9])
    expect(toVec3([1, Number.NaN, 3], [9, 9, 9])).toEqual([9, 9, 9])
    expect(toVec3('nada', [9, 9, 9])).toEqual([9, 9, 9])
  })
})

describe('sanitizePose', () => {
  it('grampeia pelos limites em vigor e descarta junta desconhecida', () => {
    const pose = sanitizePose({ 'elbow.L': { x: -999, y: 0, z: 0 }, naoExiste: { x: 1, y: 2, z: 3 } })
    expect(pose['elbow.L']).toEqual({ x: -150, y: 0, z: 0 })
    expect(pose.naoExiste).toBeUndefined()
  })

  it('aceita a junta em tupla — é como a cena gravava antes do #86', () => {
    expect(sanitizePose({ 'shoulder.L': [30, 0, 10] })['shoulder.L']).toEqual({ x: 30, y: 0, z: 10 })
  })
})

describe('sanitizeFigure', () => {
  const completo = {
    id: 'figure-7',
    name: 'Herói',
    color: '#7F3AC1',
    visible: false,
    height: 1.85,
    position: [1.2, 0, -0.6],
    rotation: { x: 0, y: 45, z: 0 },
    pose: { 'shoulder.L': { x: 30, y: 0, z: 10 } },
  }

  it('lê o boneco inteiro', () => {
    expect(sanitizeFigure(completo, 0)).toEqual({
      id: 'figure-7',
      name: 'Herói',
      color: '#7f3ac1',
      visible: false,
      height: 1.85,
      position: [1.2, 0, -0.6],
      rotation: { x: 0, y: 45, z: 0 },
      pose: { 'shoulder.L': { x: 30, y: 0, z: 10 } },
    })
  })

  /**
   * O contrato que faz um workspace antigo continuar abrindo: `joints` com
   * tuplas, e a rotação do boneco também em tupla.
   */
  it('lê a codificação antiga (`joints` em tuplas) e chega ao mesmo boneco', () => {
    const antigo = {
      ...completo,
      rotation: [0, 45, 0],
      pose: undefined,
      joints: { 'shoulder.L': [30, 0, 10] },
    }
    expect(sanitizeFigure(antigo, 0)).toEqual(sanitizeFigure(completo, 0))
  })

  it('quando o arquivo traz as duas, `pose` manda — é o campo que se grava hoje', () => {
    const ambos = { ...completo, joints: { 'shoulder.L': [1, 1, 1] } }
    expect(sanitizeFigure(ambos, 0).pose['shoulder.L']).toEqual({ x: 30, y: 0, z: 10 })
  })

  it('preenche tudo com padrões quando não recebe objeto nenhum', () => {
    const vazio = sanitizeFigure(null, 2)
    expect(vazio).toEqual({
      id: 'figure-3',
      name: 'Figure 3',
      color: DEFAULT_FIGURE_COLOR,
      visible: true,
      height: 1.7,
      position: [0, 0, 0],
      rotation: { x: 0, y: 0, z: 0 },
      pose: {},
    })
  })

  it('grampeia a altura e recusa colocação com NaN', () => {
    expect(sanitizeFigure({ height: 99 }, 0).height).toBe(1.9)
    expect(sanitizeFigure({ height: 0.1 }, 0).height).toBe(1.5)
    expect(sanitizeFigure({ position: [1, Number.NaN, 3] }, 0).position).toEqual([0, 0, 0])
  })
})
