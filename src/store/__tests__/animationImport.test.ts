import { beforeEach, describe, expect, it } from 'vitest'
import { useFiguresStore } from '../figuresStore'
import { WORKING_ANIMATION_ID, findWorkingAnimation, savedAnimations } from '../../animation/animation'
import type { ImportedAnimation } from '../../persistence/animationsFile'
import type { CameraViewState } from '../../scene/cameraMove'
import type { Figure } from '../figuresStore'

/**
 * Importar um arquivo de animação (fase 12): a biblioteca não entra na
 * história — o arquivo substitui a animação de trabalho ou é anexado ao fim
 * dela, remapeado para os bonecos da cena ou recriando os gravados.
 */

const camera: CameraViewState = { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 }

function gravado(id: string, extra: Partial<Figure> = {}): Figure {
  return {
    id,
    name: `Gravado ${id}`,
    color: '#111111',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: {},
    ...extra,
  }
}

/** Arquivo de duas poses, com o segundo keyframe rotulado. */
function arquivo(extra: Partial<ImportedAnimation> = {}): ImportedAnimation {
  return {
    name: 'Corrida',
    speed: 1.5,
    keyframes: [
      { id: 'k1', durationMs: 400, figures: [gravado('a')], camera },
      {
        id: 'k2',
        durationMs: 800,
        figures: [gravado('a', { position: [0, 0, 2] })],
        camera,
        label: 'Andando',
      },
    ],
    ...extra,
  }
}

function trabalho() {
  return findWorkingAnimation(useFiguresStore.getState().animations)
}

describe('figuresStore — importar animação de arquivo', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('substituir cria a animação de trabalho com o nome e a velocidade do arquivo', () => {
    const ok = useFiguresStore.getState().importAnimation(arquivo(), { mode: 'replace' })

    expect(ok).toBe(true)
    const working = trabalho()!
    expect(working.id).toBe(WORKING_ANIMATION_ID)
    expect(working.name).toBe('Corrida')
    expect(working.speed).toBe(1.5)
    expect(working.keyframes.map((keyframe) => keyframe.id)).toEqual(['k1', 'k2'])
  })

  it('sem remapear, os keyframes entram com os bonecos gravados', () => {
    useFiguresStore.getState().addFigure()

    useFiguresStore.getState().importAnimation(arquivo(), { mode: 'replace' })

    expect(trabalho()!.keyframes[0].figures[0].name).toBe('Gravado a')
  })

  it('substituir troca a linha do tempo inteira, e é UM passo de undo', () => {
    useFiguresStore.getState().importAnimation(arquivo({ name: 'Antiga' }), { mode: 'replace' })
    const antes = trabalho()!.keyframes

    useFiguresStore.getState().importAnimation(arquivo({ name: 'Nova' }), { mode: 'replace' })
    expect(trabalho()!.name).toBe('Nova')

    useFiguresStore.temporal.getState().undo()
    expect(trabalho()!.name).toBe('Antiga')
    expect(trabalho()!.keyframes).toEqual(antes)
  })

  it('anexar emenda no fim, continuando a numeração e mantendo nome e velocidade da bancada', () => {
    useFiguresStore.getState().importAnimation(arquivo({ name: 'Bancada', speed: 1 }), { mode: 'replace' })

    useFiguresStore.getState().importAnimation(arquivo({ name: 'Outra', speed: 0.5 }), { mode: 'append' })

    const working = trabalho()!
    expect(working.name).toBe('Bancada')
    expect(working.speed).toBe(1)
    expect(working.keyframes.map((keyframe) => keyframe.id)).toEqual(['k1', 'k2', 'k3', 'k4'])
    expect(working.keyframes[2].durationMs).toBe(400)
  })

  it('anexar desconflita o rótulo do grupo: dois trechos "Andando" são dois grupos', () => {
    useFiguresStore.getState().importAnimation(arquivo(), { mode: 'replace' })

    useFiguresStore.getState().importAnimation(arquivo(), { mode: 'append' })

    expect(trabalho()!.keyframes.map((keyframe) => keyframe.label)).toEqual([
      undefined,
      'Andando',
      undefined,
      'Andando 2',
    ])
  })

  it('remapear põe os bonecos da cena a executar a animação', () => {
    const figureId = useFiguresStore.getState().addFigure()!
    useFiguresStore.getState().renameFigure(figureId, 'Ana')

    useFiguresStore.getState().importAnimation(arquivo(), { mode: 'replace', assignment: [figureId] })

    const [primeiro, segundo] = trabalho()!.keyframes
    expect(primeiro.figures).toHaveLength(1)
    expect(primeiro.figures[0].id).toBe(figureId)
    expect(primeiro.figures[0].name).toBe('Ana')
    // Substituir é absoluto: as colocações são as gravadas.
    expect(segundo.figures[0].position[2]).toBeCloseTo(2, 6)
  })

  it('anexar remapeado transporta a ação para onde o boneco está', () => {
    const figureId = useFiguresStore.getState().addFigure()!
    useFiguresStore.getState().importAnimation(arquivo(), { mode: 'replace', assignment: [figureId] })
    useFiguresStore.getState().setPosition(figureId, [3, 0, 0])

    useFiguresStore.getState().importAnimation(arquivo(), { mode: 'append', assignment: [figureId] })

    const anexado = trabalho()!.keyframes[2]
    expect(anexado.figures[0].position[0]).toBeCloseTo(3, 6)
    expect(anexado.figures[0].position[2]).toBeCloseTo(0, 6)
  })

  it('remapeamento sem nenhum papel com boneco não mexe em nada', () => {
    useFiguresStore.getState().importAnimation(arquivo({ name: 'Bancada' }), { mode: 'replace' })
    const antes = trabalho()!

    const ok = useFiguresStore
      .getState()
      .importAnimation(arquivo(), { mode: 'replace', assignment: ['figure-fantasma'] })

    expect(ok).toBe(false)
    expect(trabalho()).toBe(antes)
  })

  it('arquivo sem keyframes é recusado sem tocar na bancada', () => {
    const ok = useFiguresStore
      .getState()
      .importAnimation({ name: 'Vazia', speed: 1, keyframes: [] }, { mode: 'replace' })

    expect(ok).toBe(false)
    expect(trabalho()).toBeNull()
  })

  it('a biblioteca não entra na história: importar não cria nem mexe em animação salva', () => {
    useFiguresStore.getState().importAnimation(arquivo(), { mode: 'replace' })
    useFiguresStore.getState().saveAnimationToLibrary('Guardada')
    const salvasAntes = savedAnimations(useFiguresStore.getState().animations)

    useFiguresStore.getState().importAnimation(arquivo({ name: 'Outra' }), { mode: 'replace' })

    expect(savedAnimations(useFiguresStore.getState().animations)).toEqual(salvasAntes)
  })
})
