import { beforeEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { useFiguresStore } from '../figuresStore'
import {
  DEFAULT_ANIMATION_SPEED,
  MAX_ANIMATION_SPEED,
  MIN_KEYFRAME_DURATION_MS,
  WORKING_ANIMATION_ID,
  animationDurationMs,
  animationOutputDurationMs,
  createWorkingAnimation,
} from '../../animation/animation'
import { sampleAnimation } from '../../animation/animationSampler'
import type { CameraViewState } from '../../scene/cameraMove'

const camera: CameraViewState = { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 }

/**
 * Base ortonormal da câmera — o que o espectador de fato vê. Duas câmeras com
 * vetores `up` bem diferentes podem ter a MESMA base: o que define a orientação
 * é o plano que o topo da tela forma com a direção de visão, e o `lookAt`
 * reendireita o resto. Por isso comparar `up` com `up` mediria a
 * representação, não a imagem.
 */
function baseDaCamera(view: CameraViewState) {
  const direcao = new THREE.Vector3(...view.position).sub(new THREE.Vector3(...view.target)).normalize()
  const direita = new THREE.Vector3().crossVectors(new THREE.Vector3(...view.up), direcao).normalize()
  const topo = new THREE.Vector3().crossVectors(direcao, direita)
  return { direcao, direita, topo }
}

/**
 * Maior desvio angular, em graus, entre as orientações de duas câmeras.
 *
 * O piso desta medida é ~1,2e-6 grau: o `acos` perto de 1 amplifica o épsilon
 * do ponto flutuante duplo (√(2ε) ≈ 2e-8 rad). É por isso que os testes abaixo
 * comparam contra 1e-4 grau, e não contra zero — ainda assim, dez mil vezes
 * menor que o 1,46° que havia antes do `splitCameraView`.
 */
function desvioDeOrientacaoGraus(a: CameraViewState, b: CameraViewState): number {
  const um = baseDaCamera(a)
  const outro = baseDaCamera(b)
  const angulo = (u: THREE.Vector3, v: THREE.Vector3) =>
    (Math.acos(THREE.MathUtils.clamp(u.dot(v), -1, 1)) * 180) / Math.PI
  return Math.max(
    angulo(um.direcao, outro.direcao),
    angulo(um.direita, outro.direita),
    angulo(um.topo, outro.topo),
  )
}

function animacao(id: string) {
  return useFiguresStore.getState().animations.find((a) => a.id === id)!
}

describe('figuresStore — animações', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('começa sem nenhuma animação', () => {
    expect(useFiguresStore.getState().animations).toEqual([])
  })

  it('cria animação com nome automático e sequência própria', () => {
    const { createAnimation } = useFiguresStore.getState()
    const primeira = createAnimation()
    const segunda = useFiguresStore.getState().createAnimation('Corrida')

    expect(animacao(primeira).name).toBe('Animation 1')
    expect(animacao(segunda).name).toBe('Corrida')
    expect(primeira).not.toBe(segunda)
  })

  it('captura um keyframe com os bonecos da cena e a câmera recebida', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    addFigure()
    const id = createAnimation()

    useFiguresStore.getState().addAnimationKeyframe(id, camera)

    const [keyframe] = animacao(id).keyframes
    expect(keyframe.figures).toHaveLength(2)
    expect(keyframe.camera).toEqual(camera)
    expect(keyframe.figures).toEqual(useFiguresStore.getState().figures)
  })

  it('o keyframe é um retrato: mexer no boneco depois não muda o que foi capturado', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    const figureId = addFigure()!
    const id = createAnimation()
    useFiguresStore.getState().addAnimationKeyframe(id, camera)

    useFiguresStore.getState().setPosition(figureId, [9, 0, 9])

    expect(animacao(id).keyframes[0].figures[0].position).toEqual([0, 0, 0])
    expect(useFiguresStore.getState().figures[0].position).toEqual([9, 0, 9])
  })

  it('capturar sem boneco nenhum não cria keyframe — não há retrato de cena', () => {
    const id = useFiguresStore.getState().createAnimation()
    expect(useFiguresStore.getState().addAnimationKeyframe(id, camera)).toBeNull()
    expect(animacao(id).keyframes).toEqual([])
  })

  it('atualiza um keyframe existente com o estado atual, sem criar outro', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    const figureId = addFigure()!
    const id = createAnimation()
    const keyframeId = useFiguresStore.getState().addAnimationKeyframe(id, camera)!

    useFiguresStore.getState().setPosition(figureId, [3, 0, 0])
    const outraCamera: CameraViewState = { ...camera, focalMm: 85 }
    useFiguresStore.getState().updateAnimationKeyframe(id, keyframeId, outraCamera)

    expect(animacao(id).keyframes).toHaveLength(1)
    expect(animacao(id).keyframes[0].figures[0].position).toEqual([3, 0, 0])
    expect(animacao(id).keyframes[0].camera.focalMm).toBe(85)
  })

  it('remove keyframe e animação', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    const id = createAnimation()
    const k1 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!
    useFiguresStore.getState().addAnimationKeyframe(id, camera)

    useFiguresStore.getState().removeAnimationKeyframe(id, k1)
    expect(animacao(id).keyframes).toHaveLength(1)

    useFiguresStore.getState().removeAnimation(id)
    expect(useFiguresStore.getState().animations).toEqual([])
  })

  it('reordena keyframes, e nas pontas não sai da lista', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    const id = createAnimation()
    const k1 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!
    const k2 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!
    const k3 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!

    useFiguresStore.getState().moveAnimationKeyframe(id, k3, -1)
    expect(animacao(id).keyframes.map((k) => k.id)).toEqual([k1, k3, k2])

    useFiguresStore.getState().moveAnimationKeyframe(id, k1, -1)
    expect(animacao(id).keyframes.map((k) => k.id)).toEqual([k1, k3, k2])
  })

  it('grampeia a duração digitada e a soma ignora a do primeiro keyframe', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    const id = createAnimation()
    const k1 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!
    const k2 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!

    useFiguresStore.getState().setAnimationKeyframeDuration(id, k1, 5000)
    useFiguresStore.getState().setAnimationKeyframeDuration(id, k2, -20)

    expect(animacao(id).keyframes[1].durationMs).toBe(MIN_KEYFRAME_DURATION_MS)
    expect(animationDurationMs(animacao(id))).toBe(MIN_KEYFRAME_DURATION_MS)
  })

  it('animação nova nasce na velocidade normal', () => {
    const id = useFiguresStore.getState().createAnimation()
    expect(animacao(id).speed).toBe(DEFAULT_ANIMATION_SPEED)
  })

  it('a velocidade é grampeada e muda o comprimento do vídeo, não a linha do tempo', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    const id = createAnimation()
    useFiguresStore.getState().addAnimationKeyframe(id, camera)
    const k2 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!
    useFiguresStore.getState().setAnimationKeyframeDuration(id, k2, 2000)

    useFiguresStore.getState().setAnimationSpeed(id, 0.5)
    expect(animacao(id).speed).toBe(0.5)
    // A linha do tempo NÃO se mexe: os keyframes continuam onde estavam e as
    // durações digitadas continuam valendo o que dizem.
    expect(animationDurationMs(animacao(id))).toBe(2000)
    expect(animationOutputDurationMs(animacao(id))).toBe(4000)

    useFiguresStore.getState().setAnimationSpeed(id, 1.13)
    expect(animacao(id).speed).toBe(1.15)
    useFiguresStore.getState().setAnimationSpeed(id, 900)
    expect(animacao(id).speed).toBe(MAX_ANIMATION_SPEED)
  })

  it('mudar a velocidade é conteúdo: dá para desfazer', () => {
    const id = useFiguresStore.getState().createAnimation()
    useFiguresStore.getState().setAnimationSpeed(id, 2)
    expect(animacao(id).speed).toBe(2)

    useFiguresStore.temporal.getState().undo()
    expect(animacao(id).speed).toBe(DEFAULT_ANIMATION_SPEED)
  })

  it('cada keyframe novo ganha id próprio, mesmo depois de remover no meio', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    const id = createAnimation()
    const k1 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!
    const k2 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!
    useFiguresStore.getState().removeAnimationKeyframe(id, k1)
    const k3 = useFiguresStore.getState().addAnimationKeyframe(id, camera)!

    expect(new Set([k1, k2, k3]).size).toBe(3)
  })

  /**
   * A animação é conteúdo do workspace, como a biblioteca de poses (#42): entra
   * no histórico de undo e no autosave. Ver DECISOES.md #52.
   */
  it('criar e capturar entram no histórico de undo', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    const id = createAnimation()
    useFiguresStore.getState().addAnimationKeyframe(id, camera)
    expect(animacao(id).keyframes).toHaveLength(1)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().animations[0].keyframes).toHaveLength(0)

    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().animations).toEqual([])
  })

  it('substitui a biblioteca pela lida de um workspace, recalculando a sequência', () => {
    useFiguresStore.getState().loadAnimationLibrary([
      { id: 'animation-7', name: 'Salto', speed: 1, keyframes: [] },
    ])

    expect(useFiguresStore.getState().animations.map((a) => a.name)).toEqual(['Salto'])
    const nova = useFiguresStore.getState().createAnimation()
    expect(nova).not.toBe('animation-7')
    expect(useFiguresStore.getState().animations).toHaveLength(2)
  })

  it('limpar o workspace apaga também as animações', () => {
    useFiguresStore.getState().addFigure()
    const id = useFiguresStore.getState().createAnimation()
    useFiguresStore.getState().addAnimationKeyframe(id, camera)

    useFiguresStore.getState().resetWorkspace()

    expect(useFiguresStore.getState().animations).toEqual([])
  })
})

/**
 * Inserir um keyframe intermediário na posição da linha do tempo. A promessa é
 * forte: **a animação continua a mesma** — o keyframe novo guarda exatamente o
 * que já se via naquele instante, e o trecho cortado se reparte entre as duas
 * metades.
 */
describe('figuresStore — inserir keyframe intermediário', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  /** Animação de dois keyframes com pose, lugar e câmera bem diferentes nas pontas. */
  function animacaoDeDuasPontas() {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    const figureId = addFigure()!
    const id = createAnimation('Corrida')

    useFiguresStore.getState().applyPosePreset(figureId, 'standing')
    useFiguresStore.getState().addAnimationKeyframe(id, camera)

    useFiguresStore.getState().applyPosePreset(figureId, 'running')
    useFiguresStore.getState().setPosition(figureId, [3, 0, -2])
    useFiguresStore.getState().setRootRotation(figureId, { y: 120 })
    useFiguresStore.getState().addAnimationKeyframe(id, {
      position: [5, 2.4, 1],
      target: [3, 1, -2],
      up: [0, 1, 0],
      focalMm: 85,
    })

    return id
  }

  it('reparte o trecho e mantém o total e os instantes dos outros keyframes', () => {
    const id = animacaoDeDuasPontas()
    const antes = animationDurationMs(animacao(id))

    const novo = useFiguresStore.getState().insertAnimationKeyframeAt(id, 600)

    const { keyframes } = animacao(id)
    expect(keyframes.map((k) => k.id)).toEqual(['k1', novo, 'k2'])
    expect(keyframes[1].durationMs).toBe(600)
    expect(keyframes[2].durationMs).toBe(400)
    expect(animationDurationMs(animacao(id))).toBe(antes)
  })

  it('A ANIMAÇÃO NÃO MUDA: cada instante mostra o mesmo antes e depois de inserir', () => {
    const id = animacaoDeDuasPontas()
    const instantes = [0, 1, 150, 300, 599, 600, 601, 750, 900, 999, 1000]
    const antes = instantes.map((ms) => sampleAnimation(animacao(id), ms)!)
    let maiorDesvioUp = 0

    useFiguresStore.getState().insertAnimationKeyframeAt(id, 600)

    instantes.forEach((ms, i) => {
      const depois = sampleAnimation(animacao(id), ms)!
      const boneco = { antes: antes[i].figures[0], depois: depois.figures[0] }

      expect(depois.figures).toHaveLength(1)
      // Colocação do boneco na cena.
      for (const eixo of [0, 1, 2]) {
        expect(boneco.depois.position[eixo]).toBeCloseTo(boneco.antes.position[eixo], 9)
      }
      for (const eixo of ['x', 'y', 'z'] as const) {
        expect(boneco.depois.rotation[eixo]).toBeCloseTo(boneco.antes.rotation[eixo], 9)
      }
      // Todas as juntas, eixo a eixo — é aqui que uma interpolação não linear
      // apareceria.
      for (const [junta, rotacao] of Object.entries(boneco.antes.pose)) {
        for (const eixo of ['x', 'y', 'z'] as const) {
          expect(boneco.depois.pose[junta][eixo]).toBeCloseTo(rotacao[eixo], 9)
        }
      }
      // E a câmera, que interpola por arco e progressão geométrica — as duas
      // com propriedade de semigrupo, então cortar no meio não muda o caminho.
      for (const eixo of [0, 1, 2]) {
        expect(depois.camera.position[eixo]).toBeCloseTo(antes[i].camera.position[eixo], 9)
        expect(depois.camera.target[eixo]).toBeCloseTo(antes[i].camera.target[eixo], 9)
      }
      expect(depois.camera.focalMm).toBeCloseTo(antes[i].camera.focalMm, 9)
      // A inclinação lateral da câmera é o canal delicado: o topo da tela é
      // interpolado em linha reta e depois reendireitado contra a direção de
      // visão. Guardar no keyframe o valor JÁ reendireitado faria cada metade
      // partir de outro lugar (medido: 1,46° de desvio) — daí o
      // `splitCameraView`.
      maiorDesvioUp = Math.max(maiorDesvioUp, desvioDeOrientacaoGraus(depois.camera, antes[i].camera))
    })

    // No piso da medida: o corte não muda a orientação da câmera em instante
    // nenhum.
    expect(maiorDesvioUp).toBeLessThan(1e-4)
  })

  /**
   * O caso em que o topo da tela realmente se mexe: ângulo holandês numa ponta
   * e não na outra. É onde o resíduo de reendireitar poderia crescer.
   */
  it('com ângulo holandês entre as pontas, o desvio do topo da tela continua desprezível', () => {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    const id = createAnimation('Holandês')
    useFiguresStore.getState().addAnimationKeyframe(id, camera)
    useFiguresStore.getState().addAnimationKeyframe(id, {
      position: [4, 1.6, 1],
      target: [0, 1, 0],
      // 30° de inclinação lateral, e a câmera ainda muda de lugar.
      up: [Math.sin(Math.PI / 6), Math.cos(Math.PI / 6), 0],
      focalMm: 85,
    })

    const instantes = [0, 100, 250, 400, 500, 600, 750, 900, 1000]
    const antes = instantes.map((ms) => sampleAnimation(animacao(id), ms)!)

    useFiguresStore.getState().insertAnimationKeyframeAt(id, 500)

    const desvios = instantes.map((ms, i) =>
      desvioDeOrientacaoGraus(sampleAnimation(animacao(id), ms)!.camera, antes[i].camera),
    )
    // Sem `splitCameraView` este era o pior caso, com 3,29° de desvio.
    expect(Math.max(...desvios)).toBeLessThan(1e-4)
  })

  it('o keyframe novo guarda o que se via naquele instante', () => {
    const id = animacaoDeDuasPontas()
    const amostra = sampleAnimation(animacao(id), 600)!

    const novo = useFiguresStore.getState().insertAnimationKeyframeAt(id, 600)

    const inserido = animacao(id).keyframes.find((k) => k.id === novo)!
    expect(inserido.figures).toEqual(amostra.figures)
    expect(inserido.camera.position).toEqual(amostra.camera.position)
    expect(inserido.camera.target).toEqual(amostra.camera.target)
    expect(inserido.camera.focalMm).toEqual(amostra.camera.focalMm)
    // O topo da tela é guardado sem reendireitar (`splitCameraView`), então o
    // VETOR difere do da amostra — a orientação resultante, não.
    expect(inserido.camera.up).not.toEqual(amostra.camera.up)
    expect(desvioDeOrientacaoGraus(inserido.camera, amostra.camera)).toBeLessThan(1e-4)
  })

  it('recusa em cima de um keyframe, fora da linha do tempo e em animação inexistente', () => {
    const id = animacaoDeDuasPontas()

    for (const instante of [0, 1000, -5, 4000]) {
      expect(useFiguresStore.getState().insertAnimationKeyframeAt(id, instante)).toBeNull()
    }
    expect(useFiguresStore.getState().insertAnimationKeyframeAt('nao-existe', 600)).toBeNull()
    expect(animacao(id).keyframes).toHaveLength(2)
  })

  it('inserir duas vezes no mesmo trecho não repete id nem perde tempo', () => {
    const id = animacaoDeDuasPontas()

    const primeiro = useFiguresStore.getState().insertAnimationKeyframeAt(id, 400)
    const segundo = useFiguresStore.getState().insertAnimationKeyframeAt(id, 800)

    const { keyframes } = animacao(id)
    expect(keyframes.map((k) => k.id)).toEqual(['k1', primeiro, segundo, 'k2'])
    expect(keyframes.map((k) => k.durationMs).slice(1)).toEqual([400, 400, 200])
    expect(animationDurationMs(animacao(id))).toBe(1000)
  })

  it('entra no histórico como uma edição só', () => {
    const id = animacaoDeDuasPontas()
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().insertAnimationKeyframeAt(id, 600)
    expect(animacao(id).keyframes).toHaveLength(3)

    useFiguresStore.temporal.getState().undo()
    expect(animacao(id).keyframes).toHaveLength(2)
    expect(animacao(id).keyframes[1].durationMs).toBe(1000)
  })
})

/**
 * Copiar a câmera de um keyframe vizinho: é o gesto de "segura o
 * enquadramento" — deixar a câmera parada num trecho enquanto só os bonecos se
 * movem, sem ter de reposicionar a câmera no olho.
 */
describe('figuresStore — copiar câmera do keyframe vizinho', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const outraCamera: CameraViewState = {
    position: [6, 3, -2],
    target: [1, 1.2, 0],
    up: [0, 1, 0],
    focalMm: 85,
  }

  /** Três keyframes, cada um com uma câmera própria. */
  function comTresKeyframes() {
    const { addFigure, createAnimation } = useFiguresStore.getState()
    addFigure()
    const id = createAnimation('Corrida')
    useFiguresStore.getState().addAnimationKeyframe(id, camera)
    useFiguresStore.getState().addAnimationKeyframe(id, outraCamera)
    useFiguresStore.getState().addAnimationKeyframe(id, { ...camera, focalMm: 24 })
    return id
  }

  it('copia a câmera do keyframe ANTERIOR sem tocar na pose nem na duração', () => {
    const id = comTresKeyframes()
    const antes = animacao(id).keyframes[1]

    useFiguresStore.getState().copyAnimationKeyframeCamera(id, 'k2', -1)

    const depois = animacao(id).keyframes[1]
    expect(depois.camera).toEqual(camera)
    // O retrato dos bonecos é o mesmo objeto: copiar câmera não é regravar.
    expect(depois.figures).toBe(antes.figures)
    expect(depois.durationMs).toBe(antes.durationMs)
  })

  it('copia a câmera do keyframe POSTERIOR', () => {
    const id = comTresKeyframes()

    useFiguresStore.getState().copyAnimationKeyframeCamera(id, 'k2', 1)

    expect(animacao(id).keyframes[1].camera).toEqual({ ...camera, focalMm: 24 })
  })

  it('nas pontas não há vizinho: nada muda', () => {
    const id = comTresKeyframes()
    const antes = animacao(id).keyframes

    useFiguresStore.getState().copyAnimationKeyframeCamera(id, 'k1', -1)
    useFiguresStore.getState().copyAnimationKeyframeCamera(id, 'k3', 1)

    expect(animacao(id).keyframes).toBe(antes)
  })

  it('ignora animação e keyframe inexistentes, sem lançar', () => {
    const id = comTresKeyframes()
    expect(() => {
      useFiguresStore.getState().copyAnimationKeyframeCamera('nao-existe', 'k1', 1)
      useFiguresStore.getState().copyAnimationKeyframeCamera(id, 'k99', 1)
    }).not.toThrow()
    expect(animacao(id).keyframes[0].camera).toEqual(camera)
  })

  it('entra no histórico como uma edição só', () => {
    const id = comTresKeyframes()
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().copyAnimationKeyframeCamera(id, 'k2', -1)
    expect(animacao(id).keyframes[1].camera).toEqual(camera)

    useFiguresStore.temporal.getState().undo()
    expect(animacao(id).keyframes[1].camera).toEqual(outraCamera)
  })
})

/**
 * Item 36 — a animação de trabalho ("default"): nasce da primeira captura, e a
 * biblioteca guarda cópias nomeadas dela para reabrir depois.
 */
describe('figuresStore — animação de trabalho e biblioteca', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('capturar sem animação nenhuma cria a de trabalho e põe o keyframe nela', () => {
    useFiguresStore.getState().addFigure()

    const keyframeId = useFiguresStore.getState().addAnimationKeyframe(null, camera)

    const [criada] = useFiguresStore.getState().animations
    expect(criada.id).toBe(WORKING_ANIMATION_ID)
    expect(criada.speed).toBe(DEFAULT_ANIMATION_SPEED)
    expect(criada.keyframes.map((k) => k.id)).toEqual([keyframeId])
  })

  /** Senão o Ctrl+Z deixaria uma animação vazia para trás. */
  it('criar a de trabalho e capturar o keyframe são UM passo de undo', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.temporal.getState().undo()

    expect(useFiguresStore.getState().animations).toEqual([])
  })

  it('a segunda captura entra na mesma animação de trabalho', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().addAnimationKeyframe(null, camera)

    expect(useFiguresStore.getState().animations).toHaveLength(1)
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(2)
  })

  it('sem boneco em cena não há retrato: nem keyframe, nem animação criada', () => {
    expect(useFiguresStore.getState().addAnimationKeyframe(null, camera)).toBeNull()
    expect(useFiguresStore.getState().animations).toEqual([])
  })

  it('salvar na biblioteca guarda uma cópia nomeada, sem tirar a de trabalho da bancada', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().setAnimationSpeed(WORKING_ANIMATION_ID, 0.5)

    const savedId = useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')!

    const salva = animacao(savedId)
    expect(salva.name).toBe('Tomada 1')
    expect(salva.speed).toBe(0.5)
    expect(salva.keyframes).toBe(animacao(WORKING_ANIMATION_ID).keyframes)
    expect(useFiguresStore.getState().animations).toHaveLength(2)
  })

  it('salvar a de trabalho vazia (ou inexistente) não guarda nada', () => {
    expect(useFiguresStore.getState().saveAnimationToLibrary('Vazia')).toBeNull()

    useFiguresStore.setState({ animations: [createWorkingAnimation()] })
    expect(useFiguresStore.getState().saveAnimationToLibrary('Vazia')).toBeNull()
    expect(useFiguresStore.getState().animations).toHaveLength(1)
  })

  it('editar a de trabalho depois de salvar não muda a cópia guardada', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    const savedId = useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')!

    useFiguresStore.getState().addAnimationKeyframe(null, camera)

    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(2)
    expect(animacao(savedId).keyframes).toHaveLength(1)
  })

  it('abrir uma salva substitui a de trabalho — conteúdo, velocidade e nome', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    const savedId = useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')!

    useFiguresStore.getState().removeAnimationKeyframe(WORKING_ANIMATION_ID, 'k2')
    useFiguresStore.getState().setAnimationSpeed(WORKING_ANIMATION_ID, 2)
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(1)

    expect(useFiguresStore.getState().openAnimationFromLibrary(savedId)).toBe(true)

    const trabalho = animacao(WORKING_ANIMATION_ID)
    expect(trabalho.keyframes).toHaveLength(2)
    expect(trabalho.speed).toBe(1)
    expect(trabalho.name).toBe('Tomada 1')
    // A salva fica intacta: o que se edita daqui em diante é a de trabalho.
    expect(animacao(savedId).keyframes).toHaveLength(2)
  })

  it('abrir entra no histórico como uma edição só — Ctrl+Z devolve a bancada', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    const savedId = useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')!
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().openAnimationFromLibrary(savedId)
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(1)

    useFiguresStore.temporal.getState().undo()
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(2)
  })

  it('abrir sem animação de trabalho na bancada cria uma com o conteúdo da salva', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    const savedId = useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')!
    useFiguresStore.getState().removeAnimation(WORKING_ANIMATION_ID)

    expect(useFiguresStore.getState().openAnimationFromLibrary(savedId)).toBe(true)
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(1)
  })

  it('abrir a própria de trabalho, ou algo que não existe, não faz nada', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)

    expect(useFiguresStore.getState().openAnimationFromLibrary(WORKING_ANIMATION_ID)).toBe(false)
    expect(useFiguresStore.getState().openAnimationFromLibrary('nao-existe')).toBe(false)
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(1)
  })

  it('regravar a salva leva o conteúdo da bancada e mantém o nome dela', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    const savedId = useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')!
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.getState().renameAnimation(WORKING_ANIMATION_ID, 'Outro nome')

    expect(useFiguresStore.getState().overwriteSavedAnimation(savedId)).toBe(true)

    expect(animacao(savedId).name).toBe('Tomada 1')
    expect(animacao(savedId).keyframes).toHaveLength(2)
  })

  it('a de trabalho não colide com os ids da biblioteca', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    const primeiro = useFiguresStore.getState().saveAnimationToLibrary('Tomada 1')!
    const segundo = useFiguresStore.getState().saveAnimationToLibrary('Tomada 2')!

    expect([primeiro, segundo]).toEqual(['animation-1', 'animation-2'])
    expect(WORKING_ANIMATION_ID).not.toMatch(/^animation-\d+$/)
  })
})

/** Item 34 — o "Movimento A→B" do painel de câmera vira dois keyframes. */
describe('figuresStore — keyframes a partir do movimento de câmera', () => {
  const outroPonto: CameraViewState = { position: [4, 2, 0], target: [0, 1, 0], up: [0, 1, 0], focalMm: 85 }

  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('gera dois keyframes com a MESMA cena e as duas câmeras do movimento', () => {
    useFiguresStore.getState().addFigure()

    expect(useFiguresStore.getState().appendCameraMoveKeyframes(null, camera, outroPonto)).toBe(true)

    const { keyframes } = animacao(WORKING_ANIMATION_ID)
    expect(keyframes).toHaveLength(2)
    expect(keyframes[0].camera).toEqual(camera)
    expect(keyframes[1].camera).toEqual(outroPonto)
    // O travelling move a câmera, não os bonecos: os dois retratos são o mesmo.
    expect(keyframes[1].figures).toBe(keyframes[0].figures)
  })

  it('entra no FINAL da linha do tempo, sem tocar no que já havia', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)

    useFiguresStore.getState().appendCameraMoveKeyframes(WORKING_ANIMATION_ID, camera, outroPonto)

    expect(animacao(WORKING_ANIMATION_ID).keyframes.map((k) => k.id)).toEqual(['k1', 'k2', 'k3'])
  })

  it('a duração é a do keyframe de CHEGADA, grampeada como qualquer outra', () => {
    useFiguresStore.getState().addFigure()

    useFiguresStore.getState().appendCameraMoveKeyframes(null, camera, outroPonto, 2500)

    const { keyframes } = animacao(WORKING_ANIMATION_ID)
    expect(keyframes[1].durationMs).toBe(2500)

    useFiguresStore.getState().appendCameraMoveKeyframes(null, camera, outroPonto, -10)
    expect(animacao(WORKING_ANIMATION_ID).keyframes[3].durationMs).toBe(MIN_KEYFRAME_DURATION_MS)
  })

  it('sem boneco em cena não há retrato: recusa sem criar animação', () => {
    expect(useFiguresStore.getState().appendCameraMoveKeyframes(null, camera, outroPonto)).toBe(false)
    expect(useFiguresStore.getState().animations).toEqual([])
  })

  it('os dois keyframes entram como UMA edição de undo', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().appendCameraMoveKeyframes(null, camera, outroPonto)
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(3)

    useFiguresStore.temporal.getState().undo()
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(1)
  })
})

/** Item 28 — copiar a pose do vizinho e duplicar keyframe (a pausa). */
describe('figuresStore — copiar pose do vizinho e duplicar keyframe', () => {
  const outraCamera: CameraViewState = { position: [4, 2, 0], target: [0, 1, 0], up: [0, 1, 0], focalMm: 85 }

  /** Três keyframes com poses distintas e a mesma câmera. */
  function comTres(): string {
    const figureId = useFiguresStore.getState().addFigure()!
    for (const x of [0, 1, 2]) {
      useFiguresStore.getState().setPosition(figureId, [x, 0, 0])
      useFiguresStore.getState().addAnimationKeyframe(null, camera)
    }
    return WORKING_ANIMATION_ID
  }

  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('copia o retrato do vizinho sem tocar na câmera nem na duração', () => {
    const id = comTres()
    useFiguresStore.getState().updateAnimationKeyframe(id, 'k2', outraCamera)
    useFiguresStore.getState().setAnimationKeyframeDuration(id, 'k2', 2500)

    useFiguresStore.getState().copyAnimationKeyframeFigures(id, 'k2', -1)

    const [primeiro, segundo] = animacao(id).keyframes
    expect(segundo.figures).toBe(primeiro.figures)
    expect(segundo.camera).toEqual(outraCamera)
    expect(segundo.durationMs).toBe(2500)
  })

  it('copia também do keyframe seguinte', () => {
    const id = comTres()

    useFiguresStore.getState().copyAnimationKeyframeFigures(id, 'k1', 1)

    const { keyframes } = animacao(id)
    expect(keyframes[0].figures[0].position).toEqual([1, 0, 0])
  })

  it('nas pontas, e com ids inexistentes, não faz nada', () => {
    const id = comTres()
    const antes = animacao(id).keyframes

    useFiguresStore.getState().copyAnimationKeyframeFigures(id, 'k1', -1)
    useFiguresStore.getState().copyAnimationKeyframeFigures(id, 'k3', 1)
    useFiguresStore.getState().copyAnimationKeyframeFigures(id, 'k99', 1)
    useFiguresStore.getState().copyAnimationKeyframeFigures('nao-existe', 'k1', 1)

    expect(animacao(id).keyframes).toBe(antes)
  })

  it('duplicar põe a cópia logo depois, com o mesmo retrato, câmera e duração', () => {
    const id = comTres()
    useFiguresStore.getState().setAnimationKeyframeDuration(id, 'k2', 400)

    const novo = useFiguresStore.getState().duplicateAnimationKeyframe(id, 'k2')!

    const { keyframes } = animacao(id)
    expect(keyframes.map((k) => k.id)).toEqual(['k1', 'k2', novo, 'k3'])
    expect(keyframes[2].figures).toBe(keyframes[1].figures)
    expect(keyframes[2].camera).toEqual(keyframes[1].camera)
    // Dois retratos iguais = pausa; a pausa dura o mesmo que o trecho anterior.
    expect(keyframes[2].durationMs).toBe(400)
  })

  it('a cópia ganha id novo, sem reaproveitar o de ninguém', () => {
    const id = comTres()
    const novo = useFiguresStore.getState().duplicateAnimationKeyframe(id, 'k1')!

    expect(novo).toBe('k4')
    expect(new Set(animacao(id).keyframes.map((k) => k.id)).size).toBe(4)
  })

  it('duplicar keyframe inexistente devolve null e não mexe na lista', () => {
    const id = comTres()
    const antes = animacao(id).keyframes

    expect(useFiguresStore.getState().duplicateAnimationKeyframe(id, 'k99')).toBeNull()
    expect(useFiguresStore.getState().duplicateAnimationKeyframe('nao-existe', 'k1')).toBeNull()
    expect(animacao(id).keyframes).toBe(antes)
  })
})

/** Item 27 — "fechar o ciclo": o keyframe 1 repetido no fim. */
describe('figuresStore — fechar o ciclo', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  function comCiclo(): string {
    const figureId = useFiguresStore.getState().addFigure()!
    for (const x of [0, 1, 2]) {
      useFiguresStore.getState().setPosition(figureId, [x, 0, 0])
      useFiguresStore.getState().addAnimationKeyframe(null, camera)
    }
    return WORKING_ANIMATION_ID
  }

  it('copia o primeiro keyframe para o fim, com a duração do último trecho', () => {
    const id = comCiclo()
    useFiguresStore.getState().setAnimationKeyframeDuration(id, 'k3', 750)

    const novo = useFiguresStore.getState().closeAnimationCycle(id)!

    const { keyframes } = animacao(id)
    expect(keyframes.map((k) => k.id)).toEqual(['k1', 'k2', 'k3', novo])
    // O retrato do fim é o mesmo do começo: a volta fecha.
    expect(keyframes[3].figures).toBe(keyframes[0].figures)
    expect(keyframes[3].camera).toEqual(keyframes[0].camera)
    expect(keyframes[3].durationMs).toBe(750)
  })

  it('com menos de dois keyframes não há ciclo a fechar', () => {
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().addAnimationKeyframe(null, camera)

    expect(useFiguresStore.getState().closeAnimationCycle(WORKING_ANIMATION_ID)).toBeNull()
    expect(useFiguresStore.getState().closeAnimationCycle('nao-existe')).toBeNull()
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(1)
  })

  it('depois de fechar, o fim da linha do tempo mostra a mesma cena do começo', () => {
    const id = comCiclo()
    useFiguresStore.getState().closeAnimationCycle(id)

    const animacaoFechada = animacao(id)
    const inicio = sampleAnimation(animacaoFechada, 0)!
    const fim = sampleAnimation(animacaoFechada, animationDurationMs(animacaoFechada))!

    expect(fim.figures[0].position).toEqual(inicio.figures[0].position)
  })
})

/** Item 38 — rótulo de grupo no store: unicidade e herança. */
describe('figuresStore — grupos rotulados de keyframes', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  function comKeyframes(count: number): string {
    useFiguresStore.getState().addFigure()
    for (let i = 0; i < count; i += 1) useFiguresStore.getState().addAnimationKeyframe(null, camera)
    return WORKING_ANIMATION_ID
  }

  it('rotula um keyframe e tira o rótulo com texto vazio', () => {
    const id = comKeyframes(2)

    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k1', ' Andando ')
    expect(animacao(id).keyframes[0].label).toBe('Andando')

    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k1', '  ')
    expect(animacao(id).keyframes[0]).not.toHaveProperty('label')
  })

  it('o mesmo rótulo em outro trecho ganha sufixo, mas estender o grupo vizinho não', () => {
    const id = comKeyframes(4)
    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k1', 'Andando')

    // Vizinho: estende o grupo.
    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k2', 'Andando')
    expect(animacao(id).keyframes[1].label).toBe('Andando')

    // Separado por um keyframe sem grupo: vira outro grupo, com sufixo.
    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k4', 'Andando')
    expect(animacao(id).keyframes[3].label).toBe('Andando 2')
  })

  /** Cortar um trecho no meio de um grupo não pode parti-lo em dois. */
  it('o keyframe inserido herda o grupo do keyframe anterior', () => {
    const id = comKeyframes(2)
    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k1', 'Andando')
    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k2', 'Andando')

    useFiguresStore.getState().insertAnimationKeyframeAt(id, 600)

    expect(animacao(id).keyframes.map((k) => k.label)).toEqual(['Andando', 'Andando', 'Andando'])
  })

  it('duplicar mantém o keyframe no mesmo grupo', () => {
    const id = comKeyframes(2)
    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k1', 'Andando')

    useFiguresStore.getState().duplicateAnimationKeyframe(id, 'k1')

    expect(animacao(id).keyframes[1].label).toBe('Andando')
  })

  /** O fim do ciclo não pertence ao grupo do começo — seriam dois blocos iguais. */
  it('fechar o ciclo copia o primeiro keyframe SEM o rótulo dele', () => {
    const id = comKeyframes(2)
    useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k1', 'Andando')

    useFiguresStore.getState().closeAnimationCycle(id)

    const { keyframes } = animacao(id)
    expect(keyframes[2]).not.toHaveProperty('label')
    expect(keyframes[2].figures).toBe(keyframes[0].figures)
  })

  it('ignora keyframe e animação inexistentes, sem lançar', () => {
    const id = comKeyframes(1)
    expect(() => {
      useFiguresStore.getState().setAnimationKeyframeLabel(id, 'k99', 'X')
      useFiguresStore.getState().setAnimationKeyframeLabel('nao-existe', 'k1', 'X')
    }).not.toThrow()
    expect(animacao(id).keyframes[0]).not.toHaveProperty('label')
  })
})
