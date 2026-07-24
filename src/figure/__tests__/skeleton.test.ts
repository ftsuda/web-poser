import { describe, expect, it } from 'vitest'
import {
  JOINTS,
  JOINT_NAMES,
  MAX_HEIGHT_M,
  MIN_HEIGHT_M,
  REFERENCE_HEIGHT_M,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getHeightScale,
  getJoint,
  getJointAxes,
  getJointChain,
  getJointChildren,
} from '../skeleton'

const EXPECTED_JOINT_NAMES = [
  'root',
  'spine',
  'chest',
  'neck',
  'head',
  'clavicle.L',
  'clavicle.R',
  'shoulder.L',
  'shoulder.R',
  'elbow.L',
  'elbow.R',
  'wrist.L',
  'wrist.R',
  'thumb1.L',
  'thumb1.R',
  'thumb2.L',
  'thumb2.R',
  'fingers.L',
  'fingers.R',
  'hip.L',
  'hip.R',
  'knee.L',
  'knee.R',
  'ankle.L',
  'ankle.R',
  'ball.L',
  'ball.R',
]

describe('skeleton definition', () => {
  it('has exactly 27 joints', () => {
    expect(JOINTS).toHaveLength(27)
  })

  it('has no duplicate joint names', () => {
    const names = JOINTS.map((joint) => joint.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('matches the expected joint name set exactly', () => {
    expect([...JOINT_NAMES].sort()).toEqual([...EXPECTED_JOINT_NAMES].sort())
  })

  it('has exactly one root joint with no parent', () => {
    const roots = JOINTS.filter((joint) => joint.parent === null)
    expect(roots).toHaveLength(1)
    expect(roots[0].name).toBe(ROOT_JOINT_NAME)
  })

  it('every non-root joint references an existing parent', () => {
    const names = new Set(JOINT_NAMES)
    for (const joint of JOINTS) {
      if (joint.name === ROOT_JOINT_NAME) continue
      expect(joint.parent).not.toBeNull()
      expect(names.has(joint.parent as string)).toBe(true)
    }
  })

  it('reference height is 1.70m with a 1.50-1.90m adjustable range', () => {
    expect(REFERENCE_HEIGHT_M).toBe(1.7)
    expect(MIN_HEIGHT_M).toBe(1.5)
    expect(MAX_HEIGHT_M).toBe(1.9)
  })
})

describe('getJoint', () => {
  it('returns the joint definition by name', () => {
    expect(getJoint('elbow.L').name).toBe('elbow.L')
  })

  it('throws for an unknown joint name', () => {
    expect(() => getJoint('nope')).toThrow()
  })
})

describe('getJointChildren', () => {
  it("returns chest's direct children (neck and both clavicles)", () => {
    const children = getJointChildren('chest').map((joint) => joint.name).sort()
    expect(children).toEqual(['clavicle.L', 'clavicle.R', 'neck'])
  })

  it('returns an empty array for a leaf joint', () => {
    expect(getJointChildren('head')).toEqual([])
    expect(getJointChildren('fingers.L')).toEqual([])
  })
})

describe('getJointChain', () => {
  it('returns the chain from root to the given joint, inclusive', () => {
    expect(getJointChain('shoulder.L')).toEqual([
      'root',
      'spine',
      'chest',
      'clavicle.L',
      'shoulder.L',
    ])
  })

  it('returns just the root for the root joint', () => {
    expect(getJointChain('root')).toEqual(['root'])
  })
})

describe('getJointAxes', () => {
  it('returns the DOF axes of a multi-axis joint in x,y,z order', () => {
    expect(getJointAxes('shoulder.L')).toEqual(['x', 'y', 'z'])
  })

  it('returns a single axis for a hinge joint', () => {
    expect(getJointAxes('elbow.L')).toEqual(['x', 'y'])
    expect(getJointAxes('knee.L')).toEqual(['x'])
  })

  it('returns an empty array for the free root joint', () => {
    expect(getJointAxes('root')).toEqual([])
  })
})

describe('clampJointRotation', () => {
  it('clamps a hinge joint (elbow) to its single defined axis range [0, 150]', () => {
    expect(clampJointRotation('elbow.L', { x: 200 }).x).toBe(150)
    expect(clampJointRotation('elbow.L', { x: -10 }).x).toBe(0)
    expect(clampJointRotation('elbow.L', { x: 90 }).x).toBe(90)
  })

  it('locks axes that are not a defined degree of freedom for the joint', () => {
    expect(clampJointRotation('elbow.L', { z: 45 }).z).toBe(0)
  })

  it('lets the knee bend only in one direction (0 to 150)', () => {
    expect(clampJointRotation('knee.R', { x: -20 }).x).toBe(0)
    expect(clampJointRotation('knee.R', { x: 200 }).x).toBe(150)
  })

  it('clamps neck turn to +/-60 degrees', () => {
    expect(clampJointRotation('neck', { y: 100 }).y).toBe(60)
    expect(clampJointRotation('neck', { y: -100 }).y).toBe(-60)
  })

  it('leaves the root joint fully free (placement, not a body joint)', () => {
    const result = clampJointRotation('root', { x: 999, y: -999, z: 500 })
    expect(result).toEqual({ x: 999, y: -999, z: 500 })
  })

  it('always returns all three axes', () => {
    expect(clampJointRotation('wrist.L', {})).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('getHeightScale', () => {
  it('returns 1 at the reference height', () => {
    expect(getHeightScale(REFERENCE_HEIGHT_M)).toBe(1)
  })

  it('scales proportionally to height', () => {
    expect(getHeightScale(1.9)).toBeCloseTo(1.9 / 1.7, 5)
    expect(getHeightScale(1.5)).toBeCloseTo(1.5 / 1.7, 5)
  })
})
