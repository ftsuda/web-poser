import { describe, expect, it } from 'vitest'
import {
  clampJointRotation,
  getDefaultJointLimits,
  getJoint,
  getJointAxes,
  getJointChildren,
  getJointLimitOverrides,
  resetJointLimitOverrides,
  sanitizeJointLimitOverrides,
  setJointLimitOverrides,
} from '../skeleton'

/**
 * Limites customizáveis por workspace (DECISOES.md #29): a camada de overrides
 * só troca min/max — nunca a lista de eixos, nunca os valores do código.
 */
describe('sanitizeJointLimitOverrides', () => {
  it('aceita min/max de um eixo que já é DOF da junta', () => {
    expect(sanitizeJointLimitOverrides({ 'knee.L': { x: { min: 0, max: 90 } } })).toEqual({
      'knee.L': { x: { min: 0, max: 90 } },
    })
  })

  it('completa o lado ausente com o padrão do código', () => {
    const sanitized = sanitizeJointLimitOverrides({ 'knee.L': { x: { max: 90 } } })
    expect(sanitized['knee.L'].x).toEqual({ min: getDefaultJointLimits('knee.L').x!.min, max: 90 })
  })

  it('descarta eixos que não são DOF da junta (não cria grau de liberdade novo)', () => {
    expect(sanitizeJointLimitOverrides({ 'knee.L': { z: { min: -10, max: 10 } } })).toEqual({})
  })

  it('descarta juntas desconhecidas e a root (que gira livre)', () => {
    const sanitized = sanitizeJointLimitOverrides({
      cotovelo: { x: { min: 0, max: 10 } },
      root: { x: { min: 0, max: 10 } },
    })
    expect(sanitized).toEqual({})
  })

  it('descarta faixa invertida (min > max) e valores não numéricos', () => {
    const sanitized = sanitizeJointLimitOverrides({
      'knee.L': { x: { min: 100, max: 0 } },
      'elbow.L': { x: { min: 'muito', max: null } },
    })
    expect(sanitized).toEqual({})
  })

  it('limita a faixa a ±360° mesmo se o arquivo pedir mais', () => {
    const sanitized = sanitizeJointLimitOverrides({ 'neck': { y: { min: -9999, max: 9999 } } })
    expect(sanitized.neck.y).toEqual({ min: -360, max: 360 })
  })

  it('ignora o que for igual ao padrão — override é só a diferença real', () => {
    const defaults = getDefaultJointLimits('knee.L').x!
    expect(sanitizeJointLimitOverrides({ 'knee.L': { x: { ...defaults } } })).toEqual({})
  })

  it('sobrevive a lixo (null, número, string) sem lançar', () => {
    expect(sanitizeJointLimitOverrides(null)).toEqual({})
    expect(sanitizeJointLimitOverrides(42)).toEqual({})
    expect(sanitizeJointLimitOverrides({ 'knee.L': 'x' })).toEqual({})
  })
})

describe('setJointLimitOverrides / resetJointLimitOverrides', () => {
  it('faz o clamp passar a usar a faixa customizada, e o reset volta ao código', () => {
    const defaultMax = getDefaultJointLimits('knee.L').x!.max
    expect(clampJointRotation('knee.L', { x: defaultMax }).x).toBe(defaultMax)

    setJointLimitOverrides({ 'knee.L': { x: { min: 0, max: 45 } } })
    expect(clampJointRotation('knee.L', { x: defaultMax }).x).toBe(45)

    resetJointLimitOverrides()
    expect(clampJointRotation('knee.L', { x: defaultMax }).x).toBe(defaultMax)
  })

  it('reflete a customização em getJoint (fonte das faixas dos sliders) sem mexer no padrão', () => {
    setJointLimitOverrides({ 'knee.L': { x: { min: 0, max: 45 } } })

    expect(getJoint('knee.L').limits.x).toEqual({ min: 0, max: 45 })
    expect(getDefaultJointLimits('knee.L').x).toEqual({ min: 0, max: 150 })
    expect(getJoint('knee.L').position).toEqual([0, -0.415, 0])
  })

  it('propaga para getJointChildren (mesma definição efetiva)', () => {
    setJointLimitOverrides({ 'knee.L': { x: { min: 0, max: 45 } } })

    const knee = getJointChildren('hip.L').find((joint) => joint.name === 'knee.L')
    expect(knee?.limits.x).toEqual({ min: 0, max: 45 })
  })

  it('não muda os graus de liberdade da junta', () => {
    const before = getJointAxes('shoulder.L')
    setJointLimitOverrides({
      'shoulder.L': { x: { min: -10, max: 10 }, y: { min: -1000, max: 1000 } },
    })
    expect(getJointAxes('shoulder.L')).toEqual(before)
  })

  it('devolve e expõe os overrides efetivamente aplicados', () => {
    const applied = setJointLimitOverrides({
      'knee.L': { x: { min: 0, max: 45 } },
      inexistente: { x: { min: 0, max: 1 } },
    })

    expect(applied).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
    expect(getJointLimitOverrides()).toEqual(applied)
  })

  it('trocar de workspace substitui os overrides (não acumula)', () => {
    setJointLimitOverrides({ 'knee.L': { x: { min: 0, max: 45 } } })
    setJointLimitOverrides({ 'elbow.L': { x: { min: -90, max: 0 } } })

    expect(getJointLimitOverrides()).toEqual({ 'elbow.L': { x: { min: -90, max: 0 } } })
    expect(getJoint('knee.L').limits.x).toEqual(getDefaultJointLimits('knee.L').x)
  })
})
