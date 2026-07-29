import { beforeEach, describe, expect, it } from 'vitest'
import { useFiguresStore } from '../figuresStore'
import { ANIMATION_CLIPS } from '../../animation/animationClips'
import { WORKING_ANIMATION_ID } from '../../animation/animation'
import type { CameraViewState } from '../../scene/cameraMove'

const camera: CameraViewState = { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 }

function animacao(id: string) {
  return useFiguresStore.getState().animations.find((a) => a.id === id)!
}

/** Cena com `count` bonecos e uma animação vazia ativa; devolve os ids. */
function cena(count: number): { animationId: string; figureIds: string[] } {
  const figureIds: string[] = []
  for (let i = 0; i < count; i += 1) figureIds.push(useFiguresStore.getState().addFigure()!)
  const animationId = useFiguresStore.getState().createAnimation('Cena')
  return { animationId, figureIds }
}

describe('figuresStore — acrescentar trecho de animação', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('em linha do tempo vazia cria um keyframe por passo, todos com a câmera congelada', () => {
    const { animationId, figureIds } = cena(1)

    const ok = useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, figureIds[0])

    expect(ok).toBe(true)
    const { keyframes } = animacao(animationId)
    const clip = ANIMATION_CLIPS.walking
    expect(keyframes).toHaveLength(clip.steps.length)
    keyframes.forEach((keyframe, index) => {
      expect(keyframe.camera).toEqual(camera)
      expect(keyframe.durationMs).toBe(clip.steps[index].durationMs)
      expect(keyframe.id).toBe(`k${index + 1}`)
    })
  })

  it('parte da posição e do heading do boneco A: virado a 90°, andar é avançar em +X', () => {
    const { animationId, figureIds } = cena(1)
    useFiguresStore.getState().setPosition(figureIds[0], [2, 0, 1])
    useFiguresStore.getState().setRootRotation(figureIds[0], { y: 90 })

    useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, figureIds[0])

    const { keyframes } = animacao(animationId)
    const primeiro = keyframes[0].figures[0]
    const ultimo = keyframes[keyframes.length - 1].figures[0]
    expect(primeiro.position[0]).toBeCloseTo(2, 4)
    expect(primeiro.position[2]).toBeCloseTo(1, 4)
    expect(ultimo.position[0]).toBeCloseTo(2 + 2.4, 4)
    expect(ultimo.position[2]).toBeCloseTo(1, 4)
    expect(ultimo.rotation.y).toBe(90)
  })

  it('o deslocamento no chão acompanha a altura do boneco (medido na referência de 1,70 m)', () => {
    const { animationId, figureIds } = cena(1)
    useFiguresStore.getState().setHeight(figureIds[0], 1.9)

    useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, figureIds[0])

    const { keyframes } = animacao(animationId)
    const ultimo = keyframes[keyframes.length - 1].figures[0]
    expect(ultimo.position[2]).toBeCloseTo(2.4 * (1.9 / 1.7), 4)
  })

  it('acrescenta ao FINAL: os keyframes existentes não mudam e os ids continuam a sequência', () => {
    const { animationId, figureIds } = cena(1)
    useFiguresStore.getState().addAnimationKeyframe(animationId, camera)
    useFiguresStore.getState().addAnimationKeyframe(animationId, camera)
    const antes = animacao(animationId).keyframes

    useFiguresStore.getState().appendAnimationClip(animationId, 'jumping', camera, figureIds[0])

    const { keyframes } = animacao(animationId)
    expect(keyframes.slice(0, 2)).toEqual(antes)
    expect(keyframes).toHaveLength(2 + ANIMATION_CLIPS.jumping.steps.length)
    expect(keyframes[2].id).toBe('k3')
  })

  it('cena em dupla aplica cada papel ao seu boneco e posiciona B em relação a A', () => {
    const { animationId, figureIds } = cena(3)
    const [a, b, outro] = figureIds
    useFiguresStore.getState().setPosition(outro, [5, 0, 5])

    const ok = useFiguresStore.getState().appendAnimationClip(animationId, 'punch', camera, a, b)

    expect(ok).toBe(true)
    const { keyframes } = animacao(animationId)
    const impacto = keyframes[2]
    const bonecoA = impacto.figures.find((f) => f.id === a)!
    const bonecoB = impacto.figures.find((f) => f.id === b)!
    // O instante do impacto usa o par medido: B de frente (180°), a 0,629 m.
    expect(bonecoB.rotation.y).toBe(180)
    expect(bonecoB.position[2] - bonecoA.position[2]).toBeCloseTo(0.629, 4)
    // As poses dos papéis são as do par soco (spot check num eixo marcante).
    expect(bonecoA.pose['shoulder.R'].x).toBe(-128)
    expect(bonecoB.pose['neck'].x).toBe(-40)
    // Quem não participa fica parado onde está, em todos os keyframes.
    for (const keyframe of keyframes) {
      expect(keyframe.figures.find((f) => f.id === outro)!.position).toEqual([5, 0, 5])
    }
  })

  it('recusa dupla sem dois bonecos DISTINTOS, sem tocar na animação', () => {
    const { animationId, figureIds } = cena(1)

    expect(useFiguresStore.getState().appendAnimationClip(animationId, 'punch', camera, figureIds[0])).toBe(false)
    expect(
      useFiguresStore.getState().appendAnimationClip(animationId, 'punch', camera, figureIds[0], figureIds[0]),
    ).toBe(false)
    expect(animacao(animationId).keyframes).toHaveLength(0)
  })

  it('recusa boneco inexistente', () => {
    const { animationId, figureIds } = cena(1)

    expect(useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, 'nao-existe')).toBe(false)
    expect(animacao(animationId).keyframes).toHaveLength(0)
    expect(figureIds).toHaveLength(1)
  })

  /**
   * Item 36: sem animação (ou com um id que já não existe) o trecho não é
   * recusado — ele CRIA a animação de trabalho e entra nela, no mesmo passo de
   * undo. É o que faz "adicionar um trecho" funcionar partindo do zero.
   */
  it('sem animação nenhuma, o trecho cria a de trabalho e entra nela', () => {
    const { figureIds } = cena(1)
    useFiguresStore.setState({ animations: [] })

    expect(useFiguresStore.getState().appendAnimationClip(null, 'walking', camera, figureIds[0])).toBe(true)

    const [criada] = useFiguresStore.getState().animations
    expect(criada.id).toBe(WORKING_ANIMATION_ID)
    expect(criada.keyframes).toHaveLength(ANIMATION_CLIPS.walking.steps.length)

    // Um único undo desfaz o trecho E a animação criada por ele.
    useFiguresStore.temporal.getState().undo()
    expect(useFiguresStore.getState().animations).toEqual([])
  })

  it('a cena de trabalho NÃO muda — só a animação ganha keyframes', () => {
    const { animationId, figureIds } = cena(2)
    const antes = useFiguresStore.getState().figures

    useFiguresStore.getState().appendAnimationClip(animationId, 'handshake', camera, figureIds[0], figureIds[1])

    expect(useFiguresStore.getState().figures).toEqual(antes)
  })

  it('entra no histórico como UMA edição: um undo remove o trecho inteiro', () => {
    const { animationId, figureIds } = cena(1)
    useFiguresStore.getState().addAnimationKeyframe(animationId, camera)

    useFiguresStore.getState().appendAnimationClip(animationId, 'running', camera, figureIds[0])
    expect(animacao(animationId).keyframes).toHaveLength(1 + ANIMATION_CLIPS.running.steps.length)

    useFiguresStore.temporal.getState().undo()
    expect(animacao(animationId).keyframes).toHaveLength(1)
  })
})

/** Itens 37 e 38 — vários bonecos no trecho individual, e o rótulo automático. */
describe('figuresStore — trecho em vários bonecos e rótulo de grupo', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('trecho individual aplicado a três bonecos: cada um executa no próprio lugar', () => {
    const { animationId, figureIds } = cena(3)
    // Lugares e headings distintos, para a ancoragem ter o que provar.
    useFiguresStore.getState().setPosition(figureIds[1], [2, 0, 0])
    useFiguresStore.getState().setPosition(figureIds[2], [-2, 0, 1])

    const ok = useFiguresStore
      .getState()
      .appendAnimationClip(animationId, 'walking', camera, figureIds)
    expect(ok).toBe(true)

    const passos = ANIMATION_CLIPS.walking.steps.length
    const { keyframes } = animacao(animationId)
    expect(keyframes).toHaveLength(passos)

    const ultimo = keyframes[passos - 1]
    const primeiro = keyframes[0]
    for (const figureId of figureIds) {
      const antes = primeiro.figures.find((f) => f.id === figureId)!
      const depois = ultimo.figures.find((f) => f.id === figureId)!
      // Todos andaram, e cada um partindo de onde estava.
      expect(depois.position[2]).not.toBeCloseTo(antes.position[2], 3)
    }
    // O deslocamento é o MESMO para todos: o trecho é o mesmo, só a âncora muda.
    const avanco = (id: string) =>
      ultimo.figures.find((f) => f.id === id)!.position[2] -
      primeiro.figures.find((f) => f.id === id)!.position[2]
    expect(avanco(figureIds[1])).toBeCloseTo(avanco(figureIds[0]), 6)
    expect(avanco(figureIds[2])).toBeCloseTo(avanco(figureIds[0]), 6)
  })

  it('em dupla, mais de um boneco no papel A é recusado', () => {
    const { animationId, figureIds } = cena(3)

    expect(
      useFiguresStore
        .getState()
        .appendAnimationClip(animationId, 'punch', camera, [figureIds[0], figureIds[1]], figureIds[2]),
    ).toBe(false)
    expect(animacao(animationId).keyframes).toHaveLength(0)
  })

  it('lista vazia (ou só com boneco que não existe) não acrescenta nada', () => {
    const { animationId } = cena(1)

    expect(useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, [])).toBe(false)
    expect(
      useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, ['nao-existe']),
    ).toBe(false)
    expect(animacao(animationId).keyframes).toHaveLength(0)
  })

  it('o trecho já nasce agrupado, e a segunda inserção ganha sufixo', () => {
    const { animationId, figureIds } = cena(1)

    useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, figureIds[0], undefined, 'Andando 1')
    useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, figureIds[0], undefined, 'Andando 1')

    const rotulos = new Set(animacao(animationId).keyframes.map((k) => k.label))
    expect([...rotulos].sort()).toEqual(['Andando 1', 'Andando 2'])
  })

  it('sem rótulo, os keyframes do trecho ficam sem grupo', () => {
    const { animationId, figureIds } = cena(1)

    useFiguresStore.getState().appendAnimationClip(animationId, 'walking', camera, figureIds[0])

    expect(animacao(animationId).keyframes.every((k) => k.label === undefined)).toBe(true)
  })
})

/** Item 39 — biblioteca de trechos do usuário. */
describe('figuresStore — trechos salvos pelo usuário', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  /** Uma animação de trabalho com um boneco andando três keyframes. */
  function comCaminhada(): string {
    const figureId = useFiguresStore.getState().addFigure()!
    for (const z of [0, 1, 2]) {
      useFiguresStore.getState().setPosition(figureId, [0, 0, z])
      useFiguresStore.getState().addAnimationKeyframe(null, camera)
    }
    return figureId
  }

  it('salva a faixa escolhida como trecho, com nome e id próprios', () => {
    comCaminhada()

    const clipId = useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 0, 2, 'Andando')!

    const [clip] = useFiguresStore.getState().clipLibrary
    expect(clipId).toBe('clip-1')
    expect(clip.name).toBe('Andando')
    expect(clip.steps).toHaveLength(3)
    expect(useFiguresStore.getState().nextClipSeq).toBe(2)
  })

  it('faixa de um keyframe só não vira trecho', () => {
    comCaminhada()
    expect(useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 1, 1, 'X')).toBeNull()
    expect(useFiguresStore.getState().clipLibrary).toEqual([])
  })

  it('aplicar o trecho acrescenta os keyframes ao final, ancorados no boneco escolhido', () => {
    const figureId = comCaminhada()
    useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 0, 2, 'Andando')
    useFiguresStore.getState().setPosition(figureId, [5, 0, 5])

    const ok = useFiguresStore
      .getState()
      .appendSavedClip(WORKING_ANIMATION_ID, 'clip-1', camera, [[figureId]], 'Andando 1')

    expect(ok).toBe(true)
    const { keyframes } = animacao(WORKING_ANIMATION_ID)
    expect(keyframes).toHaveLength(6)
    // Reancorado: parte de onde o boneco está agora.
    expect(keyframes[3].figures[0].position[2]).toBeCloseTo(5, 6)
    expect(keyframes[5].figures[0].position[2]).toBeCloseTo(7, 6)
    // A câmera é a recebida, congelada em todos.
    expect(keyframes[5].camera).toEqual(camera)
    expect(keyframes[3].label).toBe('Andando 1')
  })

  it('o trecho salvo entra como UMA edição de undo', () => {
    const figureId = comCaminhada()
    useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 0, 2, 'Andando')
    useFiguresStore.temporal.getState().clear()

    useFiguresStore.getState().appendSavedClip(WORKING_ANIMATION_ID, 'clip-1', camera, [[figureId]])
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(6)

    useFiguresStore.temporal.getState().undo()
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(3)
  })

  it('recusa elenco incompleto, repetido ou de boneco inexistente', () => {
    const figureId = comCaminhada()
    useFiguresStore.getState().addFigure()
    useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 0, 2, 'Andando')
    const antes = animacao(WORKING_ANIMATION_ID).keyframes.length

    expect(useFiguresStore.getState().appendSavedClip(WORKING_ANIMATION_ID, 'clip-1', camera, [[]])).toBe(false)
    expect(
      useFiguresStore.getState().appendSavedClip(WORKING_ANIMATION_ID, 'clip-1', camera, [['nao-existe']]),
    ).toBe(false)
    expect(
      useFiguresStore.getState().appendSavedClip(WORKING_ANIMATION_ID, 'clip-1', camera, [[figureId, figureId]]),
    ).toBe(false)
    expect(useFiguresStore.getState().appendSavedClip(WORKING_ANIMATION_ID, 'nao-existe', camera, [[figureId]])).toBe(
      false,
    )
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(antes)
  })

  it('sem animação nenhuma, o trecho salvo cria a de trabalho', () => {
    const figureId = comCaminhada()
    useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 0, 2, 'Andando')
    useFiguresStore.getState().removeAnimation(WORKING_ANIMATION_ID)

    expect(useFiguresStore.getState().appendSavedClip(null, 'clip-1', camera, [[figureId]])).toBe(true)
    expect(animacao(WORKING_ANIMATION_ID).keyframes).toHaveLength(3)
  })

  it('renomeia e remove um trecho da biblioteca', () => {
    comCaminhada()
    useFiguresStore.getState().saveClipFromRange(WORKING_ANIMATION_ID, 0, 2, 'Andando')

    useFiguresStore.getState().renameSavedClip('clip-1', ' Caminhada ')
    expect(useFiguresStore.getState().clipLibrary[0].name).toBe('Caminhada')

    useFiguresStore.getState().renameSavedClip('clip-1', '   ')
    expect(useFiguresStore.getState().clipLibrary[0].name).toBe('Caminhada')

    useFiguresStore.getState().removeSavedClip('clip-1')
    expect(useFiguresStore.getState().clipLibrary).toEqual([])
  })
})
