import { describe, expect, it } from 'vitest'
import { importedAnimationRoles, remapImportedKeyframes, transportCameraView } from '../animationRemap'
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
