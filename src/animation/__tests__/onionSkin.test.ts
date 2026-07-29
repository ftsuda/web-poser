import { describe, expect, it } from 'vitest'
import {
  ONION_SKIN_COLORS,
  ONION_SKIN_OPACITY,
  anchorKeyframeIndex,
  onionSkinFrames,
} from '../onionSkin'
import type { Animation, AnimationKeyframe } from '../animation'
import { resolvePosePreset } from '../../figure/posePresets'
import type { CameraViewState } from '../../scene/cameraMove'
import type { Figure } from '../../store/figuresStore'

const CAMERA: CameraViewState = {
  position: [3, 2, 4],
  target: [0, 1, 0],
  up: [0, 1, 0],
  focalMm: 35,
}

function figure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: resolvePosePreset('tpose'),
    ...overrides,
  }
}

function keyframe(id: string, durationMs = 1000): AnimationKeyframe {
  return { id, durationMs, figures: [figure({ id: `f-${id}` })], camera: CAMERA }
}

function animation(count: number): Animation {
  return {
    id: 'working',
    name: 'Animation',
    speed: 1,
    keyframes: Array.from({ length: count }, (_, index) => keyframe(`k${index + 1}`)),
  }
}

describe('anchorKeyframeIndex', () => {
  it('points at the keyframe sitting exactly on the playhead', () => {
    const anim = animation(4)

    expect(anchorKeyframeIndex(anim, 0)).toBe(0)
    expect(anchorKeyframeIndex(anim, 1000)).toBe(1)
    expect(anchorKeyframeIndex(anim, 3000)).toBe(3)
  })

  it('falls back to the keyframe BEFORE the playhead when it sits between two', () => {
    const anim = animation(4)

    expect(anchorKeyframeIndex(anim, 1500)).toBe(1)
    expect(anchorKeyframeIndex(anim, 999)).toBe(0)
  })

  it('clamps past the end and before the start', () => {
    const anim = animation(3)

    expect(anchorKeyframeIndex(anim, 99_999)).toBe(2)
    expect(anchorKeyframeIndex(anim, -100)).toBe(0)
  })

  it('returns -1 with no keyframes', () => {
    expect(anchorKeyframeIndex({ id: 'working', name: 'A', speed: 1, keyframes: [] }, 0)).toBe(-1)
  })
})

describe('onionSkinFrames', () => {
  it('returns the previous and the next keyframe around the playhead', () => {
    const frames = onionSkinFrames(animation(4), 1000)

    expect(frames).toHaveLength(2)
    expect(frames[0]).toMatchObject({ role: 'previous', index: 0 })
    expect(frames[0].keyframe.id).toBe('k1')
    expect(frames[1]).toMatchObject({ role: 'next', index: 2 })
    expect(frames[1].keyframe.id).toBe('k3')
  })

  it('gives only the next one at the first keyframe', () => {
    const frames = onionSkinFrames(animation(3), 0)

    expect(frames.map((frame) => frame.role)).toEqual(['next'])
    expect(frames[0].keyframe.id).toBe('k2')
  })

  it('gives only the previous one at the last keyframe', () => {
    const frames = onionSkinFrames(animation(3), 2000)

    expect(frames.map((frame) => frame.role)).toEqual(['previous'])
    expect(frames[0].keyframe.id).toBe('k2')
  })

  it('returns nothing for a null animation, an empty one or a single keyframe', () => {
    expect(onionSkinFrames(null, 0)).toEqual([])
    expect(onionSkinFrames({ id: 'working', name: 'A', speed: 1, keyframes: [] }, 0)).toEqual([])
    expect(onionSkinFrames(animation(1), 0)).toEqual([])
  })

  it('carries the figures of each neighbour, untouched', () => {
    const anim = animation(3)
    const frames = onionSkinFrames(anim, 1000)

    expect(frames[0].keyframe.figures[0].id).toBe('f-k1')
    expect(frames[1].keyframe.figures[0].id).toBe('f-k3')
    // Mesma referência: o fantasma é uma LEITURA do keyframe, não uma cópia que
    // pudesse divergir do que está guardado.
    expect(frames[0].keyframe).toBe(anim.keyframes[0])
  })

  it('has one colour per role and a translucent opacity', () => {
    expect(ONION_SKIN_COLORS.previous).not.toBe(ONION_SKIN_COLORS.next)
    expect(ONION_SKIN_OPACITY).toBeGreaterThan(0)
    expect(ONION_SKIN_OPACITY).toBeLessThan(1)
  })
})
