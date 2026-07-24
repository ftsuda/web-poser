import { describe, expect, it } from 'vitest'
import { JOINT_NAMES, ROOT_JOINT_NAME, getJoint, getJointAxes } from '../skeleton'
import { POSE_PRESET_KEYS, resolvePosePreset } from '../posePresets'

describe('resolvePosePreset', () => {
  it('lists exactly the 4 presets required by the plan', () => {
    expect(POSE_PRESET_KEYS).toEqual(['standing', 'sitting', 'walking', 'running'])
  })

  it('standing is the neutral pose (every joint at 0)', () => {
    const pose = resolvePosePreset('standing')
    for (const jointName of JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)) {
      expect(pose[jointName]).toEqual({ x: 0, y: 0, z: 0 })
    }
  })

  it.each(POSE_PRESET_KEYS)('%s covers every posable joint and respects skeleton.ts limits on every axis', (key) => {
    const pose = resolvePosePreset(key)

    for (const jointName of JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)) {
      expect(pose[jointName]).toBeDefined()
      for (const axis of ['x', 'y', 'z'] as const) {
        const limit = getJoint(jointName).limits[axis]
        if (limit) {
          expect(pose[jointName][axis]).toBeGreaterThanOrEqual(limit.min)
          expect(pose[jointName][axis]).toBeLessThanOrEqual(limit.max)
        } else {
          // Eixo sem grau de liberdade: sempre travado em 0, mesmo que o preset tente algo diferente.
          expect(pose[jointName][axis]).toBe(0)
        }
      }
    }
  })

  it('sitting bends both hips forward (negative x, per skeleton.ts convention) and knees forward', () => {
    const pose = resolvePosePreset('sitting')
    expect(pose['hip.L'].x).toBeLessThan(0)
    expect(pose['hip.R'].x).toBeLessThan(0)
    expect(pose['knee.L'].x).toBeGreaterThan(0)
    expect(pose['knee.R'].x).toBeGreaterThan(0)
  })

  it('walking and running swing the arms opposite to the legs on each side (contralateral gait)', () => {
    for (const key of ['walking', 'running'] as const) {
      const pose = resolvePosePreset(key)
      // Perna esquerda para frente (hip.L > 0) deve vir com braço esquerdo para trás (shoulder.L < 0), e vice-versa do lado direito.
      expect(Math.sign(pose['hip.L'].x)).not.toBe(Math.sign(pose['shoulder.L'].x))
      expect(Math.sign(pose['hip.R'].x)).not.toBe(Math.sign(pose['shoulder.R'].x))
    }
  })

  it('running bends the knees more than walking, for a more dynamic pose', () => {
    const walking = resolvePosePreset('walking')
    const running = resolvePosePreset('running')
    expect(running['knee.L'].x).toBeGreaterThan(walking['knee.L'].x)
  })

  it('does not include the root joint (position/rotation are handled separately)', () => {
    const pose = resolvePosePreset('sitting')
    expect(pose[ROOT_JOINT_NAME]).toBeUndefined()
  })

  it('only sets values on axes that are actual degrees of freedom of each joint', () => {
    const pose = resolvePosePreset('sitting')
    for (const jointName of Object.keys(pose)) {
      const axes = getJointAxes(jointName)
      for (const axis of ['x', 'y', 'z'] as const) {
        if (!axes.includes(axis)) expect(pose[jointName][axis]).toBe(0)
      }
    }
  })
})
