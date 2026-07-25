import { describe, expect, it } from 'vitest'
import {
  JOINTS,
  getDefaultJointLimits,
  setJointLimitOverrides,
} from '../../figure/skeleton'
import { JOINT_LIMITS_VERSION, buildJointLimitsFile, parseJointLimitsFile } from '../jointLimitsFile'

describe('buildJointLimitsFile — dump dos limites em vigor', () => {
  it('copia os valores padrão de todas as juntas com pelo menos um DOF', () => {
    const file = buildJointLimitsFile()

    const expectedNames = JOINTS.filter((joint) => Object.keys(joint.limits).length > 0).map((joint) => joint.name)
    expect(Object.keys(file.joints)).toEqual(expectedNames)
    expect(file.joints['knee.L']).toEqual(getDefaultJointLimits('knee.L'))
    expect(file.version).toBe(JOINT_LIMITS_VERSION)
  })

  it('não inclui a root (gira livre, não tem limite para customizar)', () => {
    expect(buildJointLimitsFile().joints.root).toBeUndefined()
  })

  it('traz explicação embutida — o arquivo existe para ser editado à mão', () => {
    expect(buildJointLimitsFile().leiame.length).toBeGreaterThan(0)
  })

  it('grava os limites customizados quando há um workspace com customização', () => {
    setJointLimitOverrides({ 'knee.L': { x: { min: 0, max: 45 } } })

    const file = buildJointLimitsFile()
    expect(file.joints['knee.L'].x).toEqual({ min: 0, max: 45 })
    expect(file.joints['knee.R']).toEqual(getDefaultJointLimits('knee.R'))
  })
})

describe('parseJointLimitsFile', () => {
  it('faz round-trip: um arquivo recém-gerado não é customização nenhuma', () => {
    expect(parseJointLimitsFile(buildJointLimitsFile())).toEqual({})
  })

  it('devolve só a diferença em relação ao padrão', () => {
    const file = buildJointLimitsFile()
    file.joints['knee.L'] = { x: { min: 0, max: 45 } }

    expect(parseJointLimitsFile(file)).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
  })

  it('aceita também o mapa de juntas colado direto, sem o envelope', () => {
    expect(parseJointLimitsFile({ 'knee.L': { x: { min: 0, max: 45 } } })).toEqual({
      'knee.L': { x: { min: 0, max: 45 } },
    })
  })

  it('ignora entradas inválidas em vez de rejeitar o arquivo inteiro', () => {
    const parsed = parseJointLimitsFile({
      joints: {
        'knee.L': { x: { min: 0, max: 45 } },
        'knee.R': { x: { min: 150, max: 0 } },
        cotovelo: { x: { min: 0, max: 45 } },
      },
    })

    expect(parsed).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
  })

  it('sobrevive a um arquivo vazio ou corrompido', () => {
    expect(parseJointLimitsFile({})).toEqual({})
    expect(parseJointLimitsFile('nada disso')).toEqual({})
  })
})
