import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { sampleAnimation, sampleAnimationOutput, splitCameraView } from '../animationSampler'
import { DEFAULT_ANIMATION_SPEED, animationOutputDurationMs, type Animation, type AnimationKeyframe } from '../animation'
import { buildJointFrames } from '../../figure/jointFrames'
import { blendPoses, figureBlendState } from '../../figure/poseBlend'
import { resolvePosePreset, resolvePosePresetPlacement } from '../../figure/posePresets'
import { interpolateCameraView, type CameraViewState } from '../../scene/cameraMove'
import type { Figure } from '../../store/figuresStore'

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

const cameraA: CameraViewState = { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 }
const cameraB: CameraViewState = { position: [4, 1.6, 0], target: [1, 1, 0], up: [0, 1, 0], focalMm: 85 }

function keyframe(id: string, durationMs: number, figures: Figure[], camera: CameraViewState): AnimationKeyframe {
  return { id, durationMs, figures, camera }
}

function animation(keyframes: AnimationKeyframe[], speed = DEFAULT_ANIMATION_SPEED): Animation {
  return { id: 'a1', name: 'Animação 1', speed, keyframes }
}

/** Junta mais baixa do boneco, no mundo — o que diz se ele atravessou o chão. */
function menorJunta(alvo: Figure): number {
  const { joints } = buildJointFrames(alvo)
  let menor = Infinity
  const mundo = new THREE.Vector3()
  for (const group of joints.values()) {
    group.getWorldPosition(mundo)
    menor = Math.min(menor, mundo.y)
  }
  return menor
}

describe('sampleAnimation — pontas', () => {
  const anim = animation([
    keyframe('k1', 1000, [figure({ position: [0, 0, 0] })], cameraA),
    keyframe('k2', 1000, [figure({ position: [2, 0, 4] })], cameraB),
  ])

  it('sem keyframes não há o que amostrar', () => {
    expect(sampleAnimation(animation([]), 0)).toBeNull()
  })

  it('no instante 0 devolve o primeiro keyframe IDÊNTICO, sem ruído de ponto flutuante', () => {
    const amostra = sampleAnimation(anim, 0)!
    expect(amostra.figures).toBe(anim.keyframes[0].figures)
    expect(amostra.camera).toBe(anim.keyframes[0].camera)
  })

  it('no fim devolve o último keyframe idêntico', () => {
    const amostra = sampleAnimation(anim, 1000)!
    expect(amostra.figures).toBe(anim.keyframes[1].figures)
    expect(amostra.camera).toBe(anim.keyframes[1].camera)
  })

  it('grampeia fora da linha do tempo em vez de extrapolar', () => {
    expect(sampleAnimation(anim, -500)!.figures).toBe(anim.keyframes[0].figures)
    expect(sampleAnimation(anim, 999999)!.figures).toBe(anim.keyframes[1].figures)
  })

  it('um keyframe só devolve sempre ele mesmo', () => {
    const parada = animation([keyframe('k1', 1000, [figure()], cameraA)])
    expect(sampleAnimation(parada, 0)!.figures).toBe(parada.keyframes[0].figures)
    expect(sampleAnimation(parada, 5000)!.figures).toBe(parada.keyframes[0].figures)
  })
})

describe('sampleAnimation — posição e câmera', () => {
  const anim = animation([
    keyframe('k1', 1000, [figure({ position: [0, 0, 0] })], cameraA),
    keyframe('k2', 1000, [figure({ position: [2, 1, 4] })], cameraB),
  ])

  /**
   * O buraco que só a animação revela (DECISOES.md #52): a mistura de poses só
   * carrega `positionY`, porque acontece parada no lugar. Um boneco que
   * atravessa a cena muda X e Z.
   */
  it('interpola a posição INTEIRA, não só a altura', () => {
    const meio = sampleAnimation(anim, 500)!.figures[0]
    expect(meio.position[0]).toBeCloseTo(1, 6)
    expect(meio.position[1]).toBeCloseTo(0.5, 6)
    expect(meio.position[2]).toBeCloseTo(2, 6)
  })

  it('a câmera sai exatamente do mesmo cálculo do movimento entre dois pontos (#46)', () => {
    const meio = sampleAnimation(anim, 250)!.camera
    expect(meio).toEqual(interpolateCameraView(cameraA, cameraB, 0.25))
  })

  it('caminha em linha reta: 25% fica entre a partida e 50%', () => {
    const x = (ms: number) => sampleAnimation(anim, ms)!.figures[0].position[0]
    expect(x(250)).toBeGreaterThan(x(0))
    expect(x(250)).toBeLessThan(x(500))
  })
})

describe('sampleAnimation — vários trechos', () => {
  const anim = animation([
    keyframe('k1', 999, [figure({ position: [0, 0, 0] })], cameraA),
    keyframe('k2', 1000, [figure({ position: [10, 0, 0] })], cameraA),
    keyframe('k3', 500, [figure({ position: [20, 0, 0] })], cameraA),
  ])

  it('a duração do primeiro keyframe é ignorada — o trecho 1 começa no instante 0', () => {
    expect(sampleAnimation(anim, 0)!.figures[0].position[0]).toBe(0)
    expect(sampleAnimation(anim, 1000)!.figures[0].position[0]).toBeCloseTo(10, 6)
  })

  it('cada trecho tem a sua própria velocidade', () => {
    // Trecho 1: 10 m em 1000 ms. Trecho 2: 10 m em 500 ms — o dobro da rapidez.
    expect(sampleAnimation(anim, 500)!.figures[0].position[0]).toBeCloseTo(5, 6)
    expect(sampleAnimation(anim, 1250)!.figures[0].position[0]).toBeCloseTo(15, 6)
  })

  it('em cima de um keyframe do meio, devolve o valor daquele keyframe', () => {
    expect(sampleAnimation(anim, 1000)!.figures[0].position[0]).toBeCloseTo(10, 6)
  })
})

describe('sampleAnimation — o que não interpola', () => {
  const anim = animation([
    keyframe('k1', 100, [figure({ name: 'A', color: '#ff0000', visible: true, height: 1.5 })], cameraA),
    keyframe('k2', 1000, [figure({ name: 'B', color: '#0000ff', visible: false, height: 1.9 })], cameraA),
  ])

  /**
   * Cor e visibilidade são identidade, não movimento; altura é característica
   * da personagem. Valem em degrau, com o valor do keyframe de PARTIDA — é
   * assim que um boneco entra e sai de cena entre dois keyframes.
   */
  it('nome, cor, visibilidade e altura ficam no valor da partida durante todo o trecho', () => {
    for (const ms of [0, 1, 500, 999]) {
      const amostra = sampleAnimation(anim, ms)!.figures[0]
      expect(amostra.name).toBe('A')
      expect(amostra.color).toBe('#ff0000')
      expect(amostra.visible).toBe(true)
      expect(amostra.height).toBe(1.5)
    }
  })

  it('no keyframe de chegada, valem os valores dele', () => {
    const fim = sampleAnimation(anim, 1000)!.figures[0]
    expect(fim.color).toBe('#0000ff')
    expect(fim.visible).toBe(false)
    expect(fim.height).toBe(1.9)
  })
})

describe('sampleAnimation — bonecos que só existem numa ponta', () => {
  const anim = animation([
    keyframe(
      'k1',
      100,
      [figure({ id: 'f1', position: [0, 0, 0] }), figure({ id: 'f2', position: [5, 0, 0] })],
      cameraA,
    ),
    keyframe('k2', 1000, [figure({ id: 'f1', position: [10, 0, 0] })], cameraA),
  ])

  it('o conjunto de bonecos do trecho é o do keyframe de partida', () => {
    expect(sampleAnimation(anim, 500)!.figures.map((f) => f.id)).toEqual(['f1', 'f2'])
  })

  it('quem não está na chegada fica parado onde estava', () => {
    const f2 = sampleAnimation(anim, 500)!.figures[1]
    expect(f2.position).toEqual([5, 0, 0])
  })

  it('quem só aparece na chegada entra em cena ali, sem transição', () => {
    const entrando = animation([
      keyframe('k1', 100, [figure({ id: 'f1' })], cameraA),
      keyframe('k2', 1000, [figure({ id: 'f1' }), figure({ id: 'f2' })], cameraA),
    ])
    expect(sampleAnimation(entrando, 999)!.figures.map((f) => f.id)).toEqual(['f1'])
    expect(sampleAnimation(entrando, 1000)!.figures.map((f) => f.id)).toEqual(['f1', 'f2'])
  })
})

/**
 * Decisão do usuário (DECISOES.md #52): na animação, atravessar o chão é
 * problema de quem monta os keyframes. A correção de chão da mistura de poses
 * (#43) levantaria o boneco no meio da transição, criando um movimento
 * vertical que ninguém pediu.
 */
describe('sampleAnimation — sem correção de chão', () => {
  const dePe = resolvePosePresetPlacement('standing')
  const ajoelhado = resolvePosePresetPlacement('kneelingBoth')

  const partida = figure({
    pose: resolvePosePreset('standing'),
    rotation: dePe.rotation,
    position: [0, dePe.groundOffsetM, 0],
  })
  const chegada = figure({
    pose: resolvePosePreset('kneelingBoth'),
    rotation: ajoelhado.rotation,
    position: [0, ajoelhado.groundOffsetM, 0],
  })

  const anim = animation([keyframe('k1', 100, [partida], cameraA), keyframe('k2', 1000, [chegada], cameraA)])

  it('o boneco AFUNDA no meio do caminho, em vez de ser levantado', () => {
    const meio = sampleAnimation(anim, 500)!.figures[0]
    expect(menorJunta(meio)).toBeLessThan(-0.01)
  })

  it('a altura no meio é a média exata das pontas — nada de correção somada', () => {
    const meio = sampleAnimation(anim, 500)!.figures[0]
    expect(meio.position[1]).toBeCloseTo((dePe.groundOffsetM + ajoelhado.groundOffsetM) / 2, 9)
  })

  it('mas o slider de mistura de poses CONTINUA levantando — a correção só sai da animação', () => {
    const comCorrecao = blendPoses(figureBlendState(partida), figureBlendState(chegada), 0.5, 1.7)
    expect(comCorrecao.positionY).toBeGreaterThan((dePe.groundOffsetM + ajoelhado.groundOffsetM) / 2)
  })
})

describe('sampleAnimation — pose', () => {
  it('interpola cada eixo da junta, como a mistura de poses', () => {
    const partida = figure({ pose: resolvePosePreset('tpose') })
    const chegada = figure({ pose: resolvePosePreset('running') })
    const anim = animation([keyframe('k1', 100, [partida], cameraA), keyframe('k2', 1000, [chegada], cameraA)])

    const meio = sampleAnimation(anim, 500)!.figures[0]
    for (const junta of ['shoulder.L', 'hip.R', 'knee.L'] as const) {
      expect(meio.pose[junta].x).toBeCloseTo((partida.pose[junta].x + chegada.pose[junta].x) / 2, 6)
    }
  })

  it('a rotação de colocação vai pelo menor arco: de 170° para -170° passa por 180°', () => {
    const partida = figure({ rotation: { x: 0, y: 170, z: 0 } })
    const chegada = figure({ rotation: { x: 0, y: -170, z: 0 } })
    const anim = animation([keyframe('k1', 100, [partida], cameraA), keyframe('k2', 1000, [chegada], cameraA)])

    expect(Math.abs(sampleAnimation(anim, 500)!.figures[0].rotation.y)).toBeCloseTo(180, 6)
  })
})

/**
 * A câmera que um keyframe guarda ao cortar um trecho. A diferença para o
 * `interpolateCameraView` é só o topo da tela — guardado ANTES de ser
 * reendireitado —, e é ela que faz o corte não mudar a inclinação lateral.
 */
describe('splitCameraView', () => {
  const inclinada: CameraViewState = {
    position: [4, 2, 1],
    target: [0, 1, 0],
    up: [Math.sin(Math.PI / 6), Math.cos(Math.PI / 6), 0],
    focalMm: 85,
  }

  /** Base ortonormal da câmera — o que se vê, independente de como o `up` foi escrito. */
  function base(view: CameraViewState) {
    const direcao = new THREE.Vector3(...view.position).sub(new THREE.Vector3(...view.target)).normalize()
    const direita = new THREE.Vector3().crossVectors(new THREE.Vector3(...view.up), direcao).normalize()
    return { direcao, direita, topo: new THREE.Vector3().crossVectors(direcao, direita) }
  }

  it('posição, alvo e lente são os mesmos do `interpolateCameraView`', () => {
    const corte = splitCameraView(cameraA, inclinada, 0.4)
    const caminho = interpolateCameraView(cameraA, inclinada, 0.4)

    expect(corte.position).toEqual(caminho.position)
    expect(corte.target).toEqual(caminho.target)
    expect(corte.focalMm).toEqual(caminho.focalMm)
  })

  it('guarda o topo da tela em linha reta — sem reendireitar contra a visão', () => {
    const corte = splitCameraView(cameraA, inclinada, 0.5)

    // Média exata dos dois topos, e NÃO perpendicular à direção de visão.
    expect(corte.up[0]).toBeCloseTo((cameraA.up[0] + inclinada.up[0]) / 2, 12)
    expect(corte.up[1]).toBeCloseTo((cameraA.up[1] + inclinada.up[1]) / 2, 12)
    expect(corte.up[2]).toBeCloseTo((cameraA.up[2] + inclinada.up[2]) / 2, 12)
    expect(corte.up).not.toEqual(interpolateCameraView(cameraA, inclinada, 0.5).up)
  })

  it('e mesmo assim mostra EXATAMENTE a mesma coisa: a orientação é idêntica', () => {
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const corte = base(splitCameraView(cameraA, inclinada, t))
      const caminho = base(interpolateCameraView(cameraA, inclinada, t))

      for (const eixo of ['direcao', 'direita', 'topo'] as const) {
        expect(corte[eixo].dot(caminho[eixo])).toBeCloseTo(1, 12)
      }
    }
  })

  it('nas pontas devolve o que o caminho devolve, sem inventar topo nenhum', () => {
    expect(splitCameraView(cameraA, inclinada, 0)).toBe(cameraA)
    expect(splitCameraView(cameraA, inclinada, 1)).toBe(inclinada)
  })
})

describe('sampleAnimationOutput — relógio do vídeo', () => {
  const anim = (speed: number) =>
    animation(
      [
        keyframe('k1', 1000, [figure({ position: [0, 0, 0] })], cameraA),
        keyframe('k2', 2000, [figure({ position: [2, 0, 0] })], cameraB),
      ],
      speed,
    )

  it('a meia velocidade, o quadro do segundo 2 do vídeo mostra o instante 1000 da animação', () => {
    // Linha do tempo de 2 s tocada em 4 s: na metade do vídeo (2 s) o boneco
    // está na metade do caminho (x = 1), não no fim.
    expect(sampleAnimationOutput(anim(0.5), 2000)!.figures[0].position[0]).toBeCloseTo(1, 12)
    expect(sampleAnimationOutput(anim(0.5), 1000)!.figures[0].position[0]).toBeCloseTo(0.5, 12)
  })

  it('a 1,15 o vídeo encurta, e o quadro cai adiante do mesmo instante na velocidade normal', () => {
    const rapida = sampleAnimationOutput(anim(1.15), 1000)!.figures[0].position[0]
    const normal = sampleAnimationOutput(anim(1), 1000)!.figures[0].position[0]

    expect(rapida).toBeCloseTo(1.15, 12)
    expect(rapida).toBeGreaterThan(normal)
  })

  /**
   * O quadro final é o que fecha o vídeo: tem de cair EM CIMA do último
   * keyframe (o mesmo objeto, como nas pontas do amostrador), senão a animação
   * termina antes ou depois de onde foi montada.
   */
  it('o último quadro do vídeo cai exatamente no último keyframe, em qualquer velocidade', () => {
    for (const speed of [0.1, 0.5, 1, 1.15, 5]) {
      const a = anim(speed)
      const amostra = sampleAnimationOutput(a, animationOutputDurationMs(a))!
      expect(amostra.figures).toBe(a.keyframes[1].figures)
    }
  })

  it('na velocidade normal é o próprio amostrador, sem desvio nenhum', () => {
    const a = anim(1)
    for (const t of [0, 250, 1000, 1999, 2000]) {
      expect(sampleAnimationOutput(a, t)).toEqual(sampleAnimation(a, t))
    }
  })
})
