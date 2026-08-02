import { describe, expect, it } from 'vitest'
import { twistAxisForJoint } from '../jointTwist'

describe('twistAxisForJoint', () => {
  it('juntas com DOF em y têm torção: é o eixo ao longo do osso na convenção do skeleton', () => {
    expect(twistAxisForJoint('shoulder.L')).toBe('y')
    expect(twistAxisForJoint('elbow.R')).toBe('y')
    expect(twistAxisForJoint('hip.L')).toBe('y')
    expect(twistAxisForJoint('spine')).toBe('y')
    expect(twistAxisForJoint('neck')).toBe('y')
    expect(twistAxisForJoint('head')).toBe('y')
  })

  it('dobradiças e juntas sem DOF em y não têm torção', () => {
    expect(twistAxisForJoint('knee.L')).toBeNull()
    expect(twistAxisForJoint('ankle.R')).toBeNull()
    expect(twistAxisForJoint('wrist.L')).toBeNull()
    expect(twistAxisForJoint('upperChest')).toBeNull()
    expect(twistAxisForJoint('fingersBase.R')).toBeNull()
  })

  it('a raiz gira livre no próprio eixo: é a colocação (para onde o boneco encara)', () => {
    expect(twistAxisForJoint('root')).toBe('y')
  })

  it('nome desconhecido devolve null em vez de estourar', () => {
    expect(twistAxisForJoint('banana')).toBeNull()
  })
})
