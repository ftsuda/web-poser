import { describe, expect, it } from 'vitest'
import {
  clearFigurePins,
  copyFigurePins,
  frozenJointsByPins,
  getPinnedJoints,
  isJointPinned,
  isPlacementPinned,
  pruneJointPins,
  sanitizeJointPins,
  toggleJointPin,
  type JointPinMap,
} from '../jointPins'

describe('toggleJointPin', () => {
  it('ancora e solta uma junta, e boneco sem âncora sai do mapa', () => {
    let pins: JointPinMap = {}
    pins = toggleJointPin(pins, 'f1', 'elbow.L')
    expect(getPinnedJoints(pins, 'f1')).toEqual(['elbow.L'])
    expect(isJointPinned(pins, 'f1', 'elbow.L')).toBe(true)

    pins = toggleJointPin(pins, 'f1', 'elbow.L')
    expect(pins).toEqual({})
    expect(isJointPinned(pins, 'f1', 'elbow.L')).toBe(false)
  })

  it('aceita várias âncoras no mesmo boneco', () => {
    let pins: JointPinMap = {}
    pins = toggleJointPin(pins, 'f1', 'elbow.L')
    pins = toggleJointPin(pins, 'f1', 'elbow.R')
    expect(getPinnedJoints(pins, 'f1')).toEqual(['elbow.L', 'elbow.R'])
  })

  it('ignora a raiz e nomes desconhecidos, como a trava', () => {
    const pins: JointPinMap = {}
    expect(toggleJointPin(pins, 'f1', 'root')).toBe(pins)
    expect(toggleJointPin(pins, 'f1', 'asaEsquerda')).toBe(pins)
  })
})

describe('frozenJointsByPins', () => {
  it('congela TODOS os ancestrais da junta ancorada — sem a própria junta e sem a raiz', () => {
    const pins = toggleJointPin({}, 'f1', 'elbow.L')
    const frozen = frozenJointsByPins(pins, 'f1')
    expect(frozen).toEqual(['spine', 'chest', 'upperChest', 'clavicle.L', 'shoulder.L'])
    expect(frozen).not.toContain('elbow.L')
    expect(frozen).not.toContain('root')
  })

  it('várias âncoras somam por UNIÃO, sem repetir o tronco compartilhado', () => {
    let pins = toggleJointPin({}, 'f1', 'elbow.L')
    pins = toggleJointPin(pins, 'f1', 'elbow.R')
    const frozen = frozenJointsByPins(pins, 'f1')
    expect(frozen.filter((name) => name === 'spine')).toHaveLength(1)
    expect(frozen).toContain('shoulder.L')
    expect(frozen).toContain('shoulder.R')
  })

  it('âncora em junta presa à raiz (hip) não congela junta nenhuma — só a colocação', () => {
    const pins = toggleJointPin({}, 'f1', 'hip.L')
    expect(frozenJointsByPins(pins, 'f1')).toEqual([])
    expect(isPlacementPinned(pins, 'f1')).toBe(true)
  })

  it('boneco sem âncora: nada congelado, colocação livre', () => {
    expect(frozenJointsByPins({}, 'f1')).toEqual([])
    expect(isPlacementPinned({}, 'f1')).toBe(false)
  })
})

describe('ciclo de vida do mapa', () => {
  it('clearFigurePins remove só o boneco pedido', () => {
    let pins = toggleJointPin({}, 'f1', 'elbow.L')
    pins = toggleJointPin(pins, 'f2', 'knee.R')
    pins = clearFigurePins(pins, 'f1')
    expect(pins).toEqual({ f2: ['knee.R'] })
  })

  it('copyFigurePins leva as âncoras para a cópia do boneco', () => {
    const pins = toggleJointPin({}, 'f1', 'elbow.L')
    expect(copyFigurePins(pins, 'f1', 'f2')).toEqual({ f1: ['elbow.L'], f2: ['elbow.L'] })
  })

  it('pruneJointPins descarta âncoras de bonecos que não existem mais', () => {
    let pins = toggleJointPin({}, 'f1', 'elbow.L')
    pins = toggleJointPin(pins, 'f2', 'knee.R')
    expect(pruneJointPins(pins, ['f2'])).toEqual({ f2: ['knee.R'] })
  })

  it('sanitizeJointPins descarta lixo do autosave: raiz, nome desconhecido, repetição e não-lista', () => {
    const raw = {
      f1: ['elbow.L', 'elbow.L', 'root', 'asaEsquerda'],
      f2: 'nem lista',
      f3: [],
    }
    expect(sanitizeJointPins(raw)).toEqual({ f1: ['elbow.L'] })
    expect(sanitizeJointPins(null)).toEqual({})
    expect(sanitizeJointPins([1, 2])).toEqual({})
  })
})
