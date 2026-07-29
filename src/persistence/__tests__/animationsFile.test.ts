import { describe, expect, it } from 'vitest'
import { ANIMATIONS_VERSION, buildAnimationsFile, parseAnimationsFile } from '../animationsFile'
import type { Animation } from '../../animation/animation'
import { resolvePosePreset } from '../../figure/posePresets'
import type { Figure } from '../../store/figuresStore'

const figure: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [1, 0, -2],
  rotation: { x: 0, y: 30, z: 0 },
  pose: resolvePosePreset('running'),
}

const animation: Animation = {
  id: 'animation-1',
  name: 'Corrida',
  speed: 1.15,
  keyframes: [
    {
      id: 'k1',
      durationMs: 1000,
      figures: [figure],
      camera: { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 },
    },
    {
      id: 'k2',
      durationMs: 2500,
      figures: [{ ...figure, position: [4, 0, -2] }],
      camera: { position: [4, 1.6, 0], target: [1, 1, 0], up: [0, 1, 0], focalMm: 85 },
    },
  ],
}

describe('animationsFile', () => {
  it('faz o round-trip completo, preservando poses, câmera e durações', () => {
    const file = buildAnimationsFile([animation])
    expect(file.version).toBe(ANIMATIONS_VERSION)

    const restored = parseAnimationsFile(JSON.parse(JSON.stringify(file)))
    expect(restored).toEqual([animation])
  })

  /**
   * `animations.json` gravado antes do redutor/acelerador não tem o campo. Tem
   * de abrir tocando na velocidade normal — que é exatamente o que quem montou
   * aquela animação viu na tela.
   */
  it('arquivo antigo, sem "speed", abre na velocidade normal', () => {
    const antigo = JSON.parse(JSON.stringify(buildAnimationsFile([animation])))
    delete antigo.animations[0].speed

    expect(parseAnimationsFile(antigo)[0].speed).toBe(1)
  })

  it('leva um leiame embutido — JSON não aceita comentários', () => {
    expect(buildAnimationsFile([]).leiame.length).toBeGreaterThan(0)
  })

  it('aceita a lista crua, para quem edita o arquivo à mão e cola só o array', () => {
    expect(parseAnimationsFile(JSON.parse(JSON.stringify([animation])))).toEqual([animation])
  })

  it('arquivo ausente/ilegível vira lista vazia, nunca exceção', () => {
    expect(parseAnimationsFile(null)).toEqual([])
    expect(parseAnimationsFile({ animations: 'nada' })).toEqual([])
    expect(parseAnimationsFile('{}')).toEqual([])
  })
})
