import { describe, expect, it } from 'vitest'
import {
  FIGURE_POSE_VERSION,
  buildFigurePoseFile,
  figureForPoseFile,
  parseFigurePoseFile,
  serializeFigurePoseFile,
} from '../figurePoseFile'
import { buildAnimationsFile } from '../animationsFile'
import type { Animation } from '../../animation/animation'
import type { Figure } from '../../store/figuresStore'

function makeFigure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'figure-1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.75,
    position: [2.5, 0.4, -1.25],
    rotation: { x: 0, y: 30, z: 0 },
    pose: {
      'elbow.L': { x: -40, y: 90, z: 0 },
      'knee.R': { x: 60, y: 0, z: 0 },
    },
    ...overrides,
  }
}

describe('gravação', () => {
  it('zera X e Z da colocação e preserva o Y', () => {
    const posed = figureForPoseFile(makeFigure())
    expect(posed.position).toEqual([0, 0.4, 0])
  })

  it('não mexe em mais nada do boneco', () => {
    const figure = makeFigure()
    const posed = figureForPoseFile(figure)
    expect({ ...posed, position: figure.position }).toEqual(figure)
  })

  it('o arquivo traz versão, leiame e o boneco', () => {
    const file = buildFigurePoseFile(makeFigure())
    expect(file.version).toBe(FIGURE_POSE_VERSION)
    expect(file.leiame.length).toBeGreaterThan(0)
    expect(file.figure.pose['elbow.L']).toEqual({ x: -40, y: 90, z: 0 })
  })

  it('serializa como JSON legível', () => {
    const json = serializeFigurePoseFile(makeFigure())
    expect(json).toContain('\n')
    expect(JSON.parse(json).figure.name).toBe('Boneco 1')
  })
})

describe('leitura: ida e volta', () => {
  it('recupera pose, rotação, altura e o Y — e nunca o X/Z', () => {
    const figure = makeFigure()
    const lida = parseFigurePoseFile(JSON.parse(serializeFigurePoseFile(figure)))

    expect(lida).not.toBeNull()
    expect(lida?.pose['elbow.L']).toEqual({ x: -40, y: 90, z: 0 })
    expect(lida?.pose['knee.R']).toEqual({ x: 60, y: 0, z: 0 })
    expect(lida?.rotation).toEqual({ x: 0, y: 30, z: 0 })
    expect(lida?.height).toBe(1.75)
    expect(lida?.positionY).toBe(0.4)
    // O tipo lido nem expõe X/Z: a colocação no plano não é pose.
    expect(Object.keys(lida ?? {}).sort()).toEqual(['height', 'pose', 'positionY', 'rotation'])
  })

  it('grampeia juntas fora dos limites, como qualquer outro carregamento', () => {
    // `knee.*` vai de 0 a 150 em x, e não tem DOF em y/z.
    const lida = parseFigurePoseFile({
      figure: { pose: { 'knee.L': { x: 999, y: 45, z: 45 } } },
    })
    expect(lida?.pose['knee.L']).toEqual({ x: 150, y: 0, z: 0 })
  })

  it('descarta juntas desconhecidas', () => {
    const lida = parseFigurePoseFile({
      figure: { pose: { 'elbow.L': { x: -10, y: 90, z: 0 }, 'tentacle.L': { x: 10, y: 0, z: 0 } } },
    })
    expect(Object.keys(lida?.pose ?? {})).toContain('elbow.L')
    expect(Object.keys(lida?.pose ?? {})).not.toContain('tentacle.L')
  })

  it('altura fora da faixa é trazida para dentro dela', () => {
    const lida = parseFigurePoseFile({ figure: { height: 9, pose: { 'elbow.L': { x: 0, y: 90, z: 0 } } } })
    expect(lida?.height).toBeLessThanOrEqual(1.9)
  })
})

describe('leitura: a família de formatos de animação', () => {
  const pose = { 'elbow.L': { x: -40, y: 90, z: 0 } }

  it('aceita um boneco cru', () => {
    expect(parseFigurePoseFile({ height: 1.6, position: [1, 0.2, 3], rotation: { x: 0, y: 0, z: 0 }, pose })?.positionY).toBe(0.2)
  })

  it('aceita um keyframe solto — entra o primeiro boneco', () => {
    const lida = parseFigurePoseFile({
      figures: [makeFigure({ pose }), makeFigure({ id: 'figure-2', pose: { 'knee.L': { x: 10, y: 0, z: 0 } } })],
    })
    expect(lida?.pose['elbow.L']).toBeDefined()
    expect(lida?.pose['knee.L']).toBeUndefined()
  })

  it('aceita uma animação solta e um animations.json inteiro', () => {
    const animation: Animation = {
      id: 'working',
      name: 'Andando',
      speed: 1,
      keyframes: [
        {
          id: 'k1',
          durationMs: 1000,
          figures: [makeFigure({ pose })],
          camera: { position: [0, 1, 3], target: [0, 1, 0], up: [0, 1, 0], focalMm: 50 },
        },
      ],
    }

    expect(parseFigurePoseFile(animation)?.pose['elbow.L']).toBeDefined()
    expect(parseFigurePoseFile(buildAnimationsFile([animation]))?.pose['elbow.L']).toBeDefined()
    // O mesmo carinho do `parseAnimationsFile` com quem cola só a lista.
    expect(parseFigurePoseFile([animation])?.pose['elbow.L']).toBeDefined()
  })

  it('pula keyframes sem bonecos até achar um que tenha', () => {
    const lida = parseFigurePoseFile({
      animations: [
        { keyframes: [{ figures: [] }, { figures: [makeFigure({ pose })] }] },
      ],
    })
    expect(lida?.pose['elbow.L']).toBeDefined()
  })
})

describe('leitura: recusa o que não dá pose', () => {
  it.each([
    ['null', null],
    ['texto', 'nada'],
    ['objeto qualquer', { foo: 1 }],
    ['arquivo de pose vazio', { figure: {} }],
    ['keyframe sem bonecos', { figures: [] }],
    ['animação sem keyframes', { animations: [{ keyframes: [] }] }],
    ['pose sem nenhuma junta conhecida', { figure: { pose: { 'tentacle.L': { x: 1, y: 2, z: 3 } } } }],
  ])('devolve null para %s', (_label, json) => {
    expect(parseFigurePoseFile(json)).toBeNull()
  })
})
