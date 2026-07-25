import { describe, expect, it } from 'vitest'
import { JOINT_NAMES, ROOT_JOINT_NAME } from '../skeleton'
import { JOINT_GROUPS } from '../jointGroups'

describe('JOINT_GROUPS', () => {
  it('covers every posable joint (all of JOINT_NAMES except root) exactly once', () => {
    const grouped = JOINT_GROUPS.flatMap((group) => group.joints)
    const expected = JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)

    expect(new Set(grouped).size).toBe(grouped.length) // sem duplicatas
    expect([...grouped].sort()).toEqual([...expected].sort())
  })

  it('has 6 groups in the order tronco, cabeça, braço direito, braço esquerdo, perna direita, perna esquerda', () => {
    expect(JOINT_GROUPS.map((group) => group.key)).toEqual([
      'trunk',
      'head',
      'armRight',
      'armLeft',
      'legRight',
      'legLeft',
    ])
  })

  it('mirrors right/left arm and leg groups (same joints, only the .R/.L suffix differs)', () => {
    const armRight = JOINT_GROUPS.find((g) => g.key === 'armRight')!.joints
    const armLeft = JOINT_GROUPS.find((g) => g.key === 'armLeft')!.joints
    expect(armLeft.map((name) => name.replace('.L', '.R'))).toEqual([...armRight])

    const legRight = JOINT_GROUPS.find((g) => g.key === 'legRight')!.joints
    const legLeft = JOINT_GROUPS.find((g) => g.key === 'legLeft')!.joints
    expect(legLeft.map((name) => name.replace('.L', '.R'))).toEqual([...legRight])
  })
})
