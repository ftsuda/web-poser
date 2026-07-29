import { describe, expect, it } from 'vitest'
import {
  buildKeyframesFromClip,
  captureClipFromAnimation,
  clipRoleCount,
  resolveSavedClip,
  sanitizeSavedClips,
} from '../clipLibrary'
import type { Animation, AnimationKeyframe } from '../animation'
import { resolvePosePreset } from '../../figure/posePresets'
import type { Figure } from '../../store/figuresStore'

const camera = { position: [0, 1, 4] as [number, number, number], target: [0, 1, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number], focalMm: 50 }

function figure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: resolvePosePreset('standing'),
    ...overrides,
  }
}

function keyframe(figures: Figure[], overrides: Partial<AnimationKeyframe> = {}): AnimationKeyframe {
  return { id: 'k1', durationMs: 1000, figures, camera, ...overrides }
}

function animation(keyframes: AnimationKeyframe[]): Animation {
  return { id: 'a1', name: 'A', speed: 1, keyframes }
}

describe('captureClipFromAnimation', () => {
  const andando = animation([
    keyframe([figure({ position: [0, 0, 0] })], { id: 'k1' }),
    keyframe([figure({ position: [0, 0, 1] })], { id: 'k2', durationMs: 500 }),
    keyframe([figure({ position: [0, 0, 2] })], { id: 'k3', durationMs: 700 }),
  ])

  it('grava a faixa pedida, com as durações e sem a câmera', () => {
    const clip = captureClipFromAnimation(andando, 0, 2, { id: 'clip-1', name: 'Andando' })!

    expect(clip.name).toBe('Andando')
    expect(clip.steps).toHaveLength(3)
    expect(clip.steps.map((step) => step.durationMs)).toEqual([1000, 500, 700])
    expect(JSON.stringify(clip)).not.toContain('focalMm')
  })

  it('a faixa é inclusive nas duas pontas, e a ordem dos índices não importa', () => {
    expect(captureClipFromAnimation(andando, 1, 2, { id: 'c', name: 'X' })!.steps).toHaveLength(2)
    expect(captureClipFromAnimation(andando, 2, 1, { id: 'c', name: 'X' })!.steps).toHaveLength(2)
  })

  it('menos de dois keyframes (ou faixa fora da lista) não vira trecho', () => {
    expect(captureClipFromAnimation(andando, 1, 1, { id: 'c', name: 'X' })).toBeNull()
    expect(captureClipFromAnimation(andando, 0, 9, { id: 'c', name: 'X' })).toBeNull()
  })

  /** Quem ficou parado o tempo todo era cenário, não parte do trecho. */
  it('só vira papel quem se mexe na faixa', () => {
    const parado = figure({ id: 'f2', position: [5, 0, 5] })
    const comFigurante = animation([
      keyframe([figure({ position: [0, 0, 0] }), parado], { id: 'k1' }),
      keyframe([figure({ position: [0, 0, 1] }), parado], { id: 'k2' }),
    ])

    const clip = captureClipFromAnimation(comFigurante, 0, 1, { id: 'c', name: 'X' })!

    expect(clipRoleCount(clip)).toBe(1)
    expect(clip.steps[0].figures).toHaveLength(1)
  })

  it('se ninguém se mexe, o trecho é uma pausa e todos entram', () => {
    const parado = animation([
      keyframe([figure(), figure({ id: 'f2' })], { id: 'k1' }),
      keyframe([figure(), figure({ id: 'f2' })], { id: 'k2' }),
    ])

    expect(clipRoleCount(captureClipFromAnimation(parado, 0, 1, { id: 'c', name: 'X' })!)).toBe(2)
  })

  it('leva o rótulo do grupo de cada keyframe gravado', () => {
    const comGrupo = animation([
      keyframe([figure({ position: [0, 0, 0] })], { id: 'k1', label: 'Andando 1' }),
      keyframe([figure({ position: [0, 0, 1] })], { id: 'k2', label: 'Andando 1' }),
    ])

    const clip = captureClipFromAnimation(comGrupo, 0, 1, { id: 'c', name: 'X' })!
    expect(clip.steps.map((step) => step.label)).toEqual(['Andando 1', 'Andando 1'])
  })
})

describe('resolveSavedClip', () => {
  const clip = captureClipFromAnimation(
    animation([
      keyframe([figure({ position: [0, 0, 0] })], { id: 'k1' }),
      keyframe([figure({ position: [0, 0, 2] })], { id: 'k2' }),
    ]),
    0,
    1,
    { id: 'c', name: 'Andando' },
  )!

  it('reancora na posição do boneco escolhido, preservando o deslocamento', () => {
    const [primeiro, segundo] = resolveSavedClip(clip, {
      position: [3, 0, -1],
      headingDeg: 0,
      heightM: 1.7,
    })

    expect(primeiro[0].position[0]).toBeCloseTo(3, 6)
    expect(primeiro[0].position[2]).toBeCloseTo(-1, 6)
    expect(segundo[0].position[2]).toBeCloseTo(1, 6)
  })

  /** Virado a 90°, andar "para a frente" é avançar em +X. */
  it('gira o trecho junto com o heading do boneco', () => {
    const [, segundo] = resolveSavedClip(clip, { position: [0, 0, 0], headingDeg: 90, heightM: 1.7 })

    expect(segundo[0].position[0]).toBeCloseTo(2, 6)
    expect(segundo[0].position[2]).toBeCloseTo(0, 6)
    expect(segundo[0].rotation.y).toBe(90)
  })

  it('reescala o deslocamento pela altura de quem recebe', () => {
    const [, segundo] = resolveSavedClip(clip, { position: [0, 0, 0], headingDeg: 0, heightM: 1.9 })

    expect(segundo[0].position[2]).toBeCloseTo(2 * (1.9 / 1.7), 4)
  })
})

describe('buildKeyframesFromClip', () => {
  const clip = captureClipFromAnimation(
    animation([
      keyframe([figure({ position: [0, 0, 0] })], { id: 'k1' }),
      keyframe([figure({ position: [0, 0, 2] })], { id: 'k2', durationMs: 400 }),
    ]),
    0,
    1,
    { id: 'c', name: 'Andando' },
  )!

  it('congela a câmera recebida em todos os keyframes e continua a sequência de ids', () => {
    const alvo = figure({ id: 'f9', position: [1, 0, 1] })
    const keyframes = buildKeyframesFromClip({
      clip,
      assignments: [[alvo]],
      sceneFigures: [alvo],
      camera,
      baseSeq: 3,
      label: 'Andando 1',
    })

    expect(keyframes.map((k) => k.id)).toEqual(['k4', 'k5'])
    expect(keyframes.every((k) => k.camera === camera)).toBe(true)
    expect(keyframes.map((k) => k.label)).toEqual(['Andando 1', 'Andando 1'])
    expect(keyframes[1].durationMs).toBe(400)
  })

  it('quem não participa aparece parado em todos os passos', () => {
    const alvo = figure({ id: 'f9' })
    const figurante = figure({ id: 'f8', position: [5, 0, 5] })

    const keyframes = buildKeyframesFromClip({
      clip,
      assignments: [[alvo]],
      sceneFigures: [alvo, figurante],
      camera,
      baseSeq: 0,
    })

    for (const frame of keyframes) {
      expect(frame.figures.find((f) => f.id === 'f8')).toBe(figurante)
    }
  })

  /** Item 37 levado ao trecho salvo: vários bonecos executam o mesmo trecho. */
  it('vários elencos: cada boneco executa o trecho a partir de onde está', () => {
    const um = figure({ id: 'f1', position: [0, 0, 0] })
    const outro = figure({ id: 'f2', position: [4, 0, 0] })

    const keyframes = buildKeyframesFromClip({
      clip,
      assignments: [[um], [outro]],
      sceneFigures: [um, outro],
      camera,
      baseSeq: 0,
    })

    const fim = keyframes[1]
    expect(fim.figures.find((f) => f.id === 'f1')!.position[2]).toBeCloseTo(2, 6)
    expect(fim.figures.find((f) => f.id === 'f2')!.position).toEqual([4, 0, 2])
  })
})

describe('sanitizeSavedClips', () => {
  it('descarta o que não é trecho, e o que tem menos de dois passos', () => {
    expect(sanitizeSavedClips(null)).toEqual([])
    expect(sanitizeSavedClips([{ id: 'c', name: 'X' }])).toEqual([])
    expect(sanitizeSavedClips([{ id: 'c', name: 'X', steps: [{ figures: [{}] }] }])).toEqual([])
  })

  it('grampeia durações, poses e preenche a altura que faltar', () => {
    const [clip] = sanitizeSavedClips([
      {
        id: 'clip-1',
        name: 'Andando',
        steps: [
          { durationMs: -5, figures: [{ role: 0, pose: { 'knee.L': { x: 999 } }, position: [0, 0, 0] }] },
          { durationMs: 500, figures: [{ role: 0, pose: {}, position: 'nada' }] },
        ],
      },
    ])

    expect(clip.steps[0].durationMs).toBe(1)
    expect(clip.steps[0].figures[0].pose['knee.L'].x).toBeLessThanOrEqual(150)
    expect(clip.steps[1].figures[0].position).toEqual([0, 0, 0])
    expect(clip.roleHeights).toEqual([1.7])
  })

  it('ida e volta preserva o trecho gravado', () => {
    const clip = captureClipFromAnimation(
      animation([keyframe([figure()], { id: 'k1' }), keyframe([figure({ position: [0, 0, 1] })], { id: 'k2' })]),
      0,
      1,
      { id: 'clip-1', name: 'Andando' },
    )!

    const [lido] = sanitizeSavedClips(JSON.parse(JSON.stringify([clip])))

    expect(lido.id).toBe('clip-1')
    expect(lido.name).toBe('Andando')
    expect(lido.roleHeights).toEqual(clip.roleHeights)
    expect(lido.steps.map((step) => step.figures[0].position)).toEqual(
      clip.steps.map((step) => step.figures[0].position),
    )
  })
})
