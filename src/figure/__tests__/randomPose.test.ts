import { afterEach, describe, expect, it } from 'vitest'
import { isHandJoint } from '../handPresets'
import { RANDOM_POSE_JOINT_NAMES, resolveRandomPose } from '../randomPose'
import {
  JOINT_NAMES,
  ROOT_JOINT_NAME,
  getJoint,
  resetJointLimitOverrides,
  setJointLimitOverrides,
} from '../skeleton'

/** Gerador determinístico: percorre a lista em ciclo, para o teste não depender do acaso. */
function sequence(values: readonly number[]): () => number {
  let index = 0
  return () => {
    const value = values[index % values.length]
    index += 1
    return value
  }
}

afterEach(() => {
  resetJointLimitOverrides()
})

describe('resolveRandomPose', () => {
  it('sorteia todas as juntas do corpo — e nenhuma junta da mão nem a raiz', () => {
    expect(RANDOM_POSE_JOINT_NAMES).not.toContain(ROOT_JOINT_NAME)
    expect(RANDOM_POSE_JOINT_NAMES.filter(isHandJoint)).toEqual([])
    // O que sobra é exatamente "tudo o que é posável menos as mãos".
    expect(RANDOM_POSE_JOINT_NAMES).toEqual(
      JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME && !isHandJoint(name)),
    )
  })

  it('devolve a pose completa, com a raiz de fora (como os presets)', () => {
    const pose = resolveRandomPose(sequence([0.3]))
    expect(Object.keys(pose).sort()).toEqual(JOINT_NAMES.filter((n) => n !== ROOT_JOINT_NAME).sort())
  })

  /**
   * A trava principal: qualquer sorteio, em qualquer eixo, cai DENTRO do limite
   * da junta — é o que o usuário pediu ("dentro dos limites"). Percorre 200
   * poses para cobrir toda a faixa do gerador, não só um valor de sorte.
   */
  it('nunca sai dos limites de nenhuma junta, em 200 sorteios', () => {
    for (let draw = 0; draw < 200; draw += 1) {
      const pose = resolveRandomPose()
      for (const [jointName, rotation] of Object.entries(pose)) {
        const limits = getJoint(jointName).limits
        for (const axis of ['x', 'y', 'z'] as const) {
          const limit = limits[axis]
          if (!limit) {
            // Eixo que não é grau de liberdade da junta continua travado em zero.
            expect({ [`${jointName}.${axis}`]: rotation[axis] }).toEqual({ [`${jointName}.${axis}`]: 0 })
            continue
          }
          expect(rotation[axis]).toBeGreaterThanOrEqual(limit.min)
          expect(rotation[axis]).toBeLessThanOrEqual(limit.max)
        }
      }
    }
  })

  it('mapeia o sorteio linearmente na faixa: 0 é o mínimo, 1 o máximo e 0,5 o meio', () => {
    const min = resolveRandomPose(sequence([0]))
    const max = resolveRandomPose(sequence([1]))
    const mid = resolveRandomPose(sequence([0.5]))

    for (const jointName of RANDOM_POSE_JOINT_NAMES) {
      const limits = getJoint(jointName).limits
      for (const axis of ['x', 'y', 'z'] as const) {
        const limit = limits[axis]
        if (!limit) continue
        expect({ [`${jointName}.${axis}`]: min[jointName][axis] }).toEqual({ [`${jointName}.${axis}`]: limit.min })
        expect({ [`${jointName}.${axis}`]: max[jointName][axis] }).toEqual({ [`${jointName}.${axis}`]: limit.max })
        // Meio da faixa, a menos do arredondamento para inteiro.
        expect(Math.abs(mid[jointName][axis] - (limit.min + limit.max) / 2)).toBeLessThanOrEqual(0.5)
      }
    }
  })

  it('as mãos ficam abertas (neutras), como o usuário pediu — o sorteio é do corpo', () => {
    const pose = resolveRandomPose(sequence([0.9, 0.1, 0.7]))
    for (const jointName of JOINT_NAMES.filter(isHandJoint)) {
      expect({ [jointName]: pose[jointName] }).toEqual({ [jointName]: { x: 0, y: 0, z: 0 } })
    }
  })

  it('obedece aos limites customizados do workspace (DECISOES.md #29)', () => {
    setJointLimitOverrides({ 'knee.L': { x: { min: 40, max: 45 } } })
    for (let draw = 0; draw < 50; draw += 1) {
      const value = resolveRandomPose()['knee.L'].x
      expect(value).toBeGreaterThanOrEqual(40)
      expect(value).toBeLessThanOrEqual(45)
    }
  })

  it('dá valores inteiros, como os sliders do painel', () => {
    const pose = resolveRandomPose()
    for (const jointName of RANDOM_POSE_JOINT_NAMES) {
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(Number.isInteger(pose[jointName][axis])).toBe(true)
      }
    }
  })

  it('dois sorteios seguidos dão poses diferentes (senão o botão não faria nada)', () => {
    expect(resolveRandomPose()).not.toEqual(resolveRandomPose())
  })
})
