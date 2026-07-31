import { describe, expect, it } from 'vitest'
import {
  importedAnimationRoles,
  remapImportedKeyframes,
  substituteImportedKeyframes,
  transportCameraView,
} from '../animationRemap'
import type { AnimationKeyframe } from '../animation'
import type { CameraViewState } from '../../scene/cameraMove'
import type { Figure } from '../../store/figuresStore'

/**
 * O que estes testes protegem: uma animação importada é uma COREOGRAFIA, e quem
 * a executa são os bonecos que já estão em cena (fase 12). Eles medem as duas
 * promessas do remapeamento — que o boneco da cena mantém quem é (id, nome, cor
 * e altura) enquanto recebe a pose gravada, e que a câmera continua enquadrando
 * a ação depois de ela ser transportada.
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
    pose: { neck: { x: 10, y: 0, z: 0 } },
    ...extra,
  }
}

function daCena(id: string, extra: Partial<Figure> = {}): Figure {
  return {
    id,
    name: `Cena ${id}`,
    color: '#abcdef',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: {},
    ...extra,
  }
}

/** Duas poses andando em +Z: o papel 0 sai da origem e chega a 2 m à frente. */
const keyframes: AnimationKeyframe[] = [
  { id: 'k1', durationMs: 500, figures: [gravado('a')], camera },
  {
    id: 'k2',
    durationMs: 1500,
    figures: [gravado('a', { position: [0, 0, 2] })],
    camera: { ...camera, position: [0, 1.6, 6] },
    label: 'Andando',
  },
]

describe('importedAnimationRoles', () => {
  it('os papéis são os bonecos gravados, na ordem em que aparecem', () => {
    expect(importedAnimationRoles(keyframes).map((role) => role.id)).toEqual(['a'])
  })

  it('elenco que muda no meio da montagem entra inteiro, sem repetir', () => {
    const comEntrada: AnimationKeyframe[] = [
      { id: 'k1', durationMs: 500, figures: [gravado('a')], camera },
      { id: 'k2', durationMs: 500, figures: [gravado('a'), gravado('b')], camera },
    ]

    expect(importedAnimationRoles(comEntrada).map((role) => role.id)).toEqual(['a', 'b'])
  })
})

describe('remapImportedKeyframes — absoluto (substituir)', () => {
  it('o boneco da cena mantém quem é e recebe a pose gravada', () => {
    const cena = [daCena('figure-9', { color: '#ff0000', height: 1.7, name: 'Ana' })]

    const [primeiro] = remapImportedKeyframes({
      keyframes,
      sceneFigures: cena,
      assignment: ['figure-9'],
      anchoring: 'absolute',
      baseSeq: 0,
    })

    const boneco = primeiro.figures[0]
    expect(boneco.id).toBe('figure-9')
    expect(boneco.name).toBe('Ana')
    expect(boneco.color).toBe('#ff0000')
    expect(boneco.pose).toEqual({ neck: { x: 10, y: 0, z: 0 } })
  })

  it('as colocações são as gravadas, e a câmera do arquivo não é tocada', () => {
    const remapeado = remapImportedKeyframes({
      keyframes,
      sceneFigures: [daCena('figure-1', { position: [5, 0, 5] })],
      assignment: ['figure-1'],
      anchoring: 'absolute',
      baseSeq: 0,
    })

    expect(remapeado[0].figures[0].position).toEqual([0, 0, 0])
    expect(remapeado[1].figures[0].position).toEqual([0, 0, 2])
    expect(remapeado[0].camera).toEqual(camera)
    expect(remapeado[1].camera).toEqual({ ...camera, position: [0, 1.6, 6] })
  })

  it('a altura do quadril acompanha a escala do boneco que executa', () => {
    const noAr: AnimationKeyframe[] = [
      { id: 'k1', durationMs: 500, figures: [gravado('a', { position: [0, 0.5, 0] })], camera },
    ]

    const [quadro] = remapImportedKeyframes({
      keyframes: noAr,
      sceneFigures: [daCena('figure-1', { height: 1.9 })],
      assignment: ['figure-1'],
      anchoring: 'absolute',
      baseSeq: 0,
    })

    // 0,5 m gravados por um boneco de 1,70 m viram 0,5 × (1,9/1,7) no de 1,90 m.
    expect(quadro.figures[0].position[1]).toBeCloseTo(0.5 * (1.9 / 1.7), 6)
    // O chão não se move: em absoluto, X e Z são os gravados.
    expect(quadro.figures[0].position[0]).toBe(0)
  })

  it('aparecer e sumir fazem parte da coreografia', () => {
    const piscando: AnimationKeyframe[] = [
      { id: 'k1', durationMs: 500, figures: [gravado('a', { visible: false })], camera },
      { id: 'k2', durationMs: 500, figures: [gravado('a', { visible: true })], camera },
    ]

    const remapeado = remapImportedKeyframes({
      keyframes: piscando,
      sceneFigures: [daCena('figure-1')],
      assignment: ['figure-1'],
      anchoring: 'absolute',
      baseSeq: 0,
    })

    expect(remapeado[0].figures[0].visible).toBe(false)
    expect(remapeado[1].figures[0].visible).toBe(true)
  })
})

describe('remapImportedKeyframes — reancorado (anexar)', () => {
  const cena = [daCena('figure-1', { position: [2, 0, 1], rotation: { x: 0, y: 90, z: 0 } })]

  const remapeado = remapImportedKeyframes({
    keyframes,
    sceneFigures: cena,
    assignment: ['figure-1'],
    anchoring: 'anchored',
    baseSeq: 0,
  })

  it('a ação começa onde o boneco da cena está, virada para onde ele encara', () => {
    expect(remapeado[0].figures[0].position[0]).toBeCloseTo(2, 6)
    expect(remapeado[0].figures[0].position[2]).toBeCloseTo(1, 6)
    expect(remapeado[0].figures[0].rotation.y).toBeCloseTo(90, 6)
    // Andar 2 m "para a frente" com o boneco virado a 90° é avançar em +X.
    expect(remapeado[1].figures[0].position[0]).toBeCloseTo(4, 6)
    expect(remapeado[1].figures[0].position[2]).toBeCloseTo(1, 6)
  })

  it('a câmera vai junto: a posição dela RELATIVA ao boneco âncora é a mesma da gravação', () => {
    const relativoGravado = [
      camera.position[0] - keyframes[0].figures[0].position[0],
      camera.position[2] - keyframes[0].figures[0].position[2],
    ]
    const relativoNovo = [
      remapeado[0].camera.position[0] - remapeado[0].figures[0].position[0],
      remapeado[0].camera.position[2] - remapeado[0].figures[0].position[2],
    ]

    // Mesma distância, girada pelo mesmo heading: a câmera estava 4 m atrás em
    // +Z e passa a estar 4 m em +X, como o boneco.
    expect(Math.hypot(...(relativoNovo as [number, number]))).toBeCloseTo(
      Math.hypot(...(relativoGravado as [number, number])),
      6,
    )
    expect(relativoNovo[0]).toBeCloseTo(4, 6)
    expect(relativoNovo[1]).toBeCloseTo(0, 6)
    // A altura e a lente não mudam.
    expect(remapeado[0].camera.position[1]).toBeCloseTo(1.6, 6)
    expect(remapeado[0].camera.focalMm).toBe(35)
  })

  it('o deslocamento no chão acompanha a razão de altura, como nos trechos', () => {
    const [, segundo] = remapImportedKeyframes({
      keyframes,
      sceneFigures: [daCena('figure-1', { height: 1.9 })],
      assignment: ['figure-1'],
      anchoring: 'anchored',
      baseSeq: 0,
    })

    expect(segundo.figures[0].position[2]).toBeCloseTo(2 * (1.9 / 1.7), 6)
  })

  it('sem papel 0 mapeado não há de onde transportar: fica absoluto', () => {
    const dupla: AnimationKeyframe[] = [
      {
        id: 'k1',
        durationMs: 500,
        figures: [gravado('a'), gravado('b', { position: [1, 0, 0] })],
        camera,
      },
    ]

    const [quadro] = remapImportedKeyframes({
      keyframes: dupla,
      sceneFigures: [daCena('figure-1', { position: [9, 0, 9] })],
      // Só o papel 1 tem boneco.
      assignment: ['', 'figure-1'],
      anchoring: 'anchored',
      baseSeq: 0,
    })

    expect(quadro.figures[0].position).toEqual([1, 0, 0])
    expect(quadro.camera).toEqual(camera)
  })
})

describe('remapImportedKeyframes — elenco e forma dos keyframes', () => {
  it('boneco da cena sem papel fica parado onde está, em todos os keyframes', () => {
    const cena = [daCena('figure-1'), daCena('figure-2', { position: [3, 0, 3] })]

    const remapeado = remapImportedKeyframes({
      keyframes,
      sceneFigures: cena,
      assignment: ['figure-1'],
      anchoring: 'absolute',
      baseSeq: 0,
    })

    expect(remapeado[0].figures[1]).toBe(cena[1])
    expect(remapeado[1].figures[1]).toBe(cena[1])
  })

  it('nenhum papel com boneco não produz animação nenhuma', () => {
    expect(
      remapImportedKeyframes({
        keyframes,
        sceneFigures: [daCena('figure-1')],
        assignment: ['figure-fantasma'],
        anchoring: 'absolute',
        baseSeq: 0,
      }),
    ).toEqual([])
  })

  it('ids continuam a sequência pedida; duração e rótulo são os gravados', () => {
    const remapeado = remapImportedKeyframes({
      keyframes,
      sceneFigures: [daCena('figure-1')],
      assignment: ['figure-1'],
      anchoring: 'absolute',
      baseSeq: 7,
    })

    expect(remapeado.map((keyframe) => keyframe.id)).toEqual(['k8', 'k9'])
    expect(remapeado.map((keyframe) => keyframe.durationMs)).toEqual([500, 1500])
    expect(remapeado[1].label).toBe('Andando')
    expect(remapeado[0].label).toBeUndefined()
  })

  it('papel que só aparece num keyframe posterior mantém o estado conhecido antes disso', () => {
    const entradaTardia: AnimationKeyframe[] = [
      { id: 'k1', durationMs: 500, figures: [gravado('a')], camera },
      {
        id: 'k2',
        durationMs: 500,
        figures: [gravado('a'), gravado('b', { position: [1, 0, 0] })],
        camera,
      },
    ]

    const remapeado = remapImportedKeyframes({
      keyframes: entradaTardia,
      sceneFigures: [daCena('figure-1'), daCena('figure-2')],
      assignment: ['figure-1', 'figure-2'],
      anchoring: 'absolute',
      baseSeq: 0,
    })

    // No primeiro keyframe o papel 1 ainda não tinha estado gravado: entra com
    // o primeiro que ele terá, e não com o do boneco da cena.
    expect(remapeado[0].figures[1].position).toEqual([1, 0, 0])
    expect(remapeado[1].figures[1].position).toEqual([1, 0, 0])
  })
})

/**
 * Enxertar (pedido do usuário, 2026-07-31) é a operação que os outros dois
 * modos não fazem: reescrever PARTE de uma linha do tempo montada. O que estes
 * testes protegem é justamente o que NÃO pode mudar — os keyframes anteriores,
 * as durações, os bonecos sem papel e, se a caixa estiver desmarcada, as
 * câmeras.
 */
describe('substituteImportedKeyframes', () => {
  const cameraDaBancada: CameraViewState = { ...camera, position: [9, 9, 9] }

  /** Três keyframes na bancada, com dois bonecos e uma câmera bem diferente. */
  function bancada(): AnimationKeyframe[] {
    return [0, 1, 2].map((index) => ({
      id: `k${index + 1}`,
      durationMs: 300 + index,
      figures: [
        daCena('figure-1', { position: [index, 0, 0] }),
        daCena('figure-2', { position: [10 + index, 0, 0] }),
      ],
      camera: cameraDaBancada,
      label: 'Cena montada',
    }))
  }

  const cena = [daCena('figure-1'), daCena('figure-2')]

  it('troca a pose só do boneco de destino, e só do keyframe escolhido em diante', () => {
    const { keyframes: resultado, appended } = substituteImportedKeyframes({
      keyframes,
      target: bancada(),
      sceneFigures: cena,
      // O papel 0 (o gravado "a") passa a ser executado pelo figure-2.
      assignment: ['figure-2'],
      startIndex: 1,
      replaceCamera: true,
      baseSeq: 3,
    })!

    expect(appended).toBe(0)
    expect(resultado).toHaveLength(3)
    // O keyframe 1 não foi tocado — nem a pose, nem a câmera.
    expect(resultado[0]).toEqual(bancada()[0])
    // Do 2 em diante, o figure-2 recebe a pose gravada e a colocação absoluta.
    expect(resultado[1].figures[1].pose).toEqual({ neck: { x: 10, y: 0, z: 0 } })
    expect(resultado[1].figures[1].position).toEqual([0, 0, 0])
    expect(resultado[2].figures[1].position).toEqual([0, 0, 2])
    // E o figure-1, sem papel, continua exatamente onde estava em cada um.
    expect(resultado[1].figures[0].position).toEqual([1, 0, 0])
    expect(resultado[2].figures[0].position).toEqual([2, 0, 0])
  })

  it('duração, id e grupo são os da bancada — o arquivo só traz pose e câmera', () => {
    const alvo = bancada()
    const { keyframes: resultado } = substituteImportedKeyframes({
      keyframes,
      target: alvo,
      sceneFigures: cena,
      assignment: ['figure-1'],
      startIndex: 0,
      replaceCamera: true,
      baseSeq: 3,
    })!

    expect(resultado.map((keyframe) => keyframe.id)).toEqual(['k1', 'k2', 'k3'])
    expect(resultado.map((keyframe) => keyframe.durationMs)).toEqual([300, 301, 302])
    expect(resultado.every((keyframe) => keyframe.label === 'Cena montada')).toBe(true)
    expect(resultado[0].camera).toEqual(camera)
  })

  it('com a caixa da câmera desmarcada, o enquadramento montado fica de pé', () => {
    const { keyframes: resultado } = substituteImportedKeyframes({
      keyframes,
      target: bancada(),
      sceneFigures: cena,
      assignment: ['figure-1'],
      startIndex: 0,
      replaceCamera: false,
      baseSeq: 3,
    })!

    expect(resultado.every((keyframe) => keyframe.camera === cameraDaBancada)).toBe(true)
    // …mas as poses entraram assim mesmo.
    expect(resultado[1].figures[0].position).toEqual([0, 0, 2])
  })

  it('o que não cabe vai para o fim, com a duração e o rótulo gravados', () => {
    const { keyframes: resultado, appended } = substituteImportedKeyframes({
      keyframes,
      target: bancada(),
      sceneFigures: cena,
      assignment: ['figure-1'],
      // Começando no último, só o primeiro keyframe do arquivo cabe.
      startIndex: 2,
      replaceCamera: true,
      baseSeq: 3,
    })!

    expect(appended).toBe(1)
    expect(resultado).toHaveLength(4)
    expect(resultado[3].id).toBe('k4')
    expect(resultado[3].durationMs).toBe(1500)
    expect(resultado[3].label).toBe('Andando')
    // O boneco sem papel congela onde ele parou: o último keyframe da bancada.
    expect(resultado[3].figures[1].position).toEqual([12, 0, 0])
  })

  it('boneco de destino ausente do retrato entra nele — senão a troca não teria efeito', () => {
    const alvo: AnimationKeyframe[] = [
      { id: 'k1', durationMs: 300, figures: [daCena('figure-1')], camera: cameraDaBancada },
    ]

    const { keyframes: resultado } = substituteImportedKeyframes({
      keyframes,
      target: alvo,
      sceneFigures: cena,
      assignment: ['figure-2'],
      startIndex: 0,
      replaceCamera: true,
      baseSeq: 1,
    })!

    expect(resultado[0].figures.map((figure) => figure.id)).toEqual(['figure-1', 'figure-2'])
    expect(resultado[0].figures[1].pose).toEqual({ neck: { x: 10, y: 0, z: 0 } })
  })

  it('sem papel com boneco, sem bancada ou sem arquivo, não há enxerto', () => {
    const semPapel = substituteImportedKeyframes({
      keyframes,
      target: bancada(),
      sceneFigures: cena,
      assignment: [''],
      startIndex: 0,
      replaceCamera: true,
      baseSeq: 3,
    })
    const semBancada = substituteImportedKeyframes({
      keyframes,
      target: [],
      sceneFigures: cena,
      assignment: ['figure-1'],
      startIndex: 0,
      replaceCamera: true,
      baseSeq: 0,
    })

    expect(semPapel).toBeNull()
    expect(semBancada).toBeNull()
  })

  it('índice fora da lista é grampeado ao último keyframe', () => {
    const { keyframes: resultado, appended } = substituteImportedKeyframes({
      keyframes,
      target: bancada(),
      sceneFigures: cena,
      assignment: ['figure-1'],
      startIndex: 99,
      replaceCamera: true,
      baseSeq: 3,
    })!

    expect(appended).toBe(1)
    expect(resultado).toHaveLength(4)
  })
})

describe('transportCameraView', () => {
  it('gira `up` junto: a inclinação holandesa sobrevive ao transporte', () => {
    const inclinada: CameraViewState = { ...camera, up: [1, 0, 0] }

    const levada = transportCameraView(
      inclinada,
      { recorded: [0, 0, 0], scene: [0, 0, 0] },
      90,
    )

    // `up` é direção: gira, mas não translada.
    expect(levada.up[0]).toBeCloseTo(0, 6)
    expect(levada.up[2]).toBeCloseTo(-1, 6)
    expect(levada.up[1]).toBe(0)
  })

  it('sem giro nem translação, devolve a mesma vista', () => {
    const levada = transportCameraView(camera, { recorded: [1, 0, 1], scene: [1, 0, 1] }, 0)

    expect(levada.position[0]).toBeCloseTo(camera.position[0], 6)
    expect(levada.position[2]).toBeCloseTo(camera.position[2], 6)
    expect(levada.target[2]).toBeCloseTo(camera.target[2], 6)
  })
})
