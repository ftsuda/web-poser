import { describe, expect, it } from 'vitest'
import {
  ONION_SKIN_COLORS,
  ONION_SKIN_MODES,
  ONION_SKIN_OPACITY,
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

// `anchorKeyframeIndex` mudou-se para o `animation.ts` em 2026-08-06, quando o
// painel de Animação passou a marcar o âncora — os testes dele foram junto.

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

/**
 * Escolher o lado (pedido do usuário): os dois vizinhos, só o de trás ou só o
 * da frente.
 */
describe('onionSkinFrames — modes', () => {
  it('defaults to both neighbours when no mode is given', () => {
    expect(onionSkinFrames(animation(3), 1000).map((frame) => frame.role)).toEqual(['previous', 'next'])
    expect(onionSkinFrames(animation(3), 1000, 'both').map((frame) => frame.role)).toEqual([
      'previous',
      'next',
    ])
  })

  it('previous-only drops the ghost that comes after', () => {
    const frames = onionSkinFrames(animation(3), 1000, 'previous')

    expect(frames.map((frame) => frame.role)).toEqual(['previous'])
    expect(frames[0].keyframe.id).toBe('k1')
  })

  it('next-only drops the ghost that came before', () => {
    const frames = onionSkinFrames(animation(3), 1000, 'next')

    expect(frames.map((frame) => frame.role)).toEqual(['next'])
    expect(frames[0].keyframe.id).toBe('k3')
  })

  /**
   * Na ponta do lado escolhido não sai NADA. Mostrar o outro vizinho "para não
   * ficar vazio" seria justamente o que quem escolheu um lado não quer ver.
   */
  it('shows nothing at the end of the chosen side, instead of falling back', () => {
    expect(onionSkinFrames(animation(3), 0, 'previous')).toEqual([])
    expect(onionSkinFrames(animation(3), 2000, 'next')).toEqual([])
  })

  it('keeps the roles — and therefore the colours — the same in every mode', () => {
    // O modo escolhe QUEM aparece, não o que cada um significa: o fantasma
    // quente continua sendo o passado nos três casos.
    expect(onionSkinFrames(animation(3), 1000, 'previous')[0].role).toBe('previous')
    expect(onionSkinFrames(animation(3), 1000, 'next')[0].role).toBe('next')
  })

  it('lists the three modes, in the order the panel offers them', () => {
    expect(ONION_SKIN_MODES).toEqual(['both', 'previous', 'next'])
  })
})

/**
 * Escolha de quais bonecos ganham fantasma (pedido do usuário, 2026-08-06):
 * numa cena de várias pessoas, os fantasmas de todo mundo em volta lavam a tela
 * e escondem justamente o movimento que se está lendo.
 */
describe('onionSkinFrames — bonecos escolhidos', () => {
  /** Dois bonecos em cada keyframe, os mesmos ids nos três. */
  function dupla(count: number): Animation {
    return {
      id: 'a1',
      name: 'Corrida',
      speed: 1,
      keyframes: Array.from({ length: count }, (_, index) => ({
        id: `k${index + 1}`,
        durationMs: 1000,
        figures: [figure({ id: 'f1', position: [index, 0, 0] }), figure({ id: 'f2' })],
        camera: CAMERA,
      })),
    }
  }

  it('sem escolha, o fantasma leva todos os bonecos do keyframe', () => {
    const frames = onionSkinFrames(dupla(3), 1000, 'both')

    expect(frames.map((frame) => frame.figures.map((f) => f.id))).toEqual([
      ['f1', 'f2'],
      ['f1', 'f2'],
    ])
  })

  it('o boneco desmarcado não ganha fantasma', () => {
    const frames = onionSkinFrames(dupla(3), 1000, 'both', ['f2'])

    expect(frames.map((frame) => frame.figures.map((f) => f.id))).toEqual([['f1'], ['f1']])
  })

  /** Fantasma que não desenha ninguém não é fantasma. */
  it('com todos desmarcados, não sobra fantasma nenhum', () => {
    expect(onionSkinFrames(dupla(3), 1000, 'both', ['f1', 'f2'])).toEqual([])
  })

  /** A escolha não mexe em QUEM é vizinho de quem: modo e papéis seguem iguais. */
  it('a escolha não muda os papéis nem o modo', () => {
    const frames = onionSkinFrames(dupla(3), 1000, 'previous', ['f2'])

    expect(frames.map((frame) => frame.role)).toEqual(['previous'])
    expect(frames[0].keyframe.id).toBe('k1')
  })

  /** Id que não está em cena nenhuma não esconde ninguém. */
  it('id desconhecido não tira fantasma de ninguém', () => {
    const frames = onionSkinFrames(dupla(3), 1000, 'both', ['f9'])

    expect(frames[0].figures.map((f) => f.id)).toEqual(['f1', 'f2'])
  })
})
