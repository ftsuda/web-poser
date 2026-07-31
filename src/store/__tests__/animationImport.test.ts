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

  // -------------------------------------------------------------------------
  // Enxertar a partir de um keyframe (pedido do usuário, 2026-07-31)
  // -------------------------------------------------------------------------

  /**
   * Uma bancada de três keyframes com dois bonecos, montada pelo caminho normal
   * (capturar), para que o enxerto seja medido contra o que o app produz.
   */
  function bancadaDeTres(): { a: string; b: string } {
    const a = useFiguresStore.getState().addFigure()!
    const b = useFiguresStore.getState().addFigure()!
    for (let i = 0; i < 3; i += 1) {
      useFiguresStore.getState().setPosition(a, [i, 0, 0])
      useFiguresStore.getState().addAnimationKeyframe(null, { ...camera, position: [i, 5, 5] })
    }
    return { a, b }
  }

  it('enxertar troca as poses do keyframe escolhido em diante e mantém o resto', () => {
    const { a, b } = bancadaDeTres()
    const primeiroAntes = trabalho()!.keyframes[0]

    const ok = useFiguresStore.getState().importAnimation(arquivo(), {
      mode: 'substitute',
      assignment: [b],
      startIndex: 1,
      replaceCamera: true,
    })

    expect(ok).toBe(true)
    const working = trabalho()!
    // Nome e velocidade da bancada continuam: o arquivo não escreveu a animação.
    expect(working.name).not.toBe('Corrida')
    expect(working.speed).toBe(1)
    expect(working.keyframes).toHaveLength(3)

    const posicaoDe = (index: number, id: string) =>
      working.keyframes[index].figures.find((figure) => figure.id === id)!.position

    // Keyframe 1 intacto; do 2 em diante o boneco B executa o arquivo.
    expect(working.keyframes[0]).toEqual(primeiroAntes)
    expect(posicaoDe(1, b)[2]).toBeCloseTo(0, 6)
    expect(posicaoDe(2, b)[2]).toBeCloseTo(2, 6)
    // E o boneco A, sem papel, continua no caminho que ele já fazia.
    expect(posicaoDe(0, a)[0]).toBeCloseTo(0, 6)
    expect(posicaoDe(2, a)[0]).toBeCloseTo(2, 6)
  })

  it('a caixa da câmera decide se o enquadramento montado sobrevive', () => {
    const { b } = bancadaDeTres()

    useFiguresStore.getState().importAnimation(arquivo(), {
      mode: 'substitute',
      assignment: [b],
      startIndex: 0,
      replaceCamera: false,
    })

    const comCameraDaBancada = trabalho()!.keyframes.map((keyframe) => keyframe.camera.position[0])
    expect(comCameraDaBancada).toEqual([0, 1, 2])

    useFiguresStore.getState().importAnimation(arquivo(), {
      mode: 'substitute',
      assignment: [b],
      startIndex: 0,
      replaceCamera: true,
    })

    expect(trabalho()!.keyframes[0].camera).toEqual(camera)
  })

  it('o que passa do fim vira keyframe novo, com rótulo desconflitado', () => {
    const { b } = bancadaDeTres()
    // A bancada já tem um grupo "Andando" — o rótulo que o arquivo traz.
    useFiguresStore.getState().setAnimationKeyframeLabel(WORKING_ANIMATION_ID, 'k1', 'Andando')

    useFiguresStore.getState().importAnimation(arquivo(), {
      mode: 'substitute',
      assignment: [b],
      startIndex: 2,
      replaceCamera: true,
    })

    const working = trabalho()!
    expect(working.keyframes).toHaveLength(4)
    expect(working.keyframes[3].id).toBe('k4')
    expect(working.keyframes[3].durationMs).toBe(800)
    expect(working.keyframes[3].label).toBe('Andando 2')
  })

  it('enxertar é um passo de undo só, e o Ctrl+Z devolve a linha do tempo inteira', () => {
    const { b } = bancadaDeTres()
    const antes = trabalho()!

    useFiguresStore.getState().importAnimation(arquivo(), {
      mode: 'substitute',
      assignment: [b],
      startIndex: 0,
      replaceCamera: true,
    })
    useFiguresStore.temporal.getState().undo()

    expect(trabalho()).toEqual(antes)
  })

  it('sem bancada, sem papéis ou sem remapeamento, o enxerto é recusado', () => {
    const semBancada = useFiguresStore
      .getState()
      .importAnimation(arquivo(), { mode: 'substitute', assignment: ['figure-1'], startIndex: 0 })
    expect(semBancada).toBe(false)
    expect(trabalho()).toBeNull()

    const { b } = bancadaDeTres()
    const antes = trabalho()!

    // Sem `assignment` não há de quem para quem — é o mapa que define o enxerto.
    expect(useFiguresStore.getState().importAnimation(arquivo(), { mode: 'substitute' })).toBe(false)
    expect(
      useFiguresStore
        .getState()
        .importAnimation(arquivo(), { mode: 'substitute', assignment: ['figure-fantasma'] }),
    ).toBe(false)
    expect(trabalho()).toBe(antes)
    expect(b).toBeTruthy()
  })

  it('a biblioteca não entra na história: importar não cria nem mexe em animação salva', () => {
    useFiguresStore.getState().importAnimation(arquivo(), { mode: 'replace' })
    useFiguresStore.getState().saveAnimationToLibrary('Guardada')
    const salvasAntes = savedAnimations(useFiguresStore.getState().animations)

    useFiguresStore.getState().importAnimation(arquivo({ name: 'Outra' }), { mode: 'replace' })

    expect(savedAnimations(useFiguresStore.getState().animations)).toEqual(salvasAntes)
  })
})
