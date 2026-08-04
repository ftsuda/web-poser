import { beforeEach, describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { SceneProps } from '../SceneProps'
import { DEFAULT_SCENE_CAMERA } from '../cameraMove'
import { attachedPropPlacement } from '../../props/propAttachment'
import { useAnimationStore } from '../../store/animationStore'
import { useFiguresStore } from '../../store/figuresStore'

/**
 * O render do objeto AMARRADO (PLANO.md > amarração): a colocação da mesh é
 * derivada do frame da junta — inclusive durante a pré-visualização da
 * animação, que é o que faz a espada acompanhar a mão na reprodução e no MP4.
 * (A armadilha real: o `SceneProps` ignorava o preview de propósito, porque
 * cenário estático não anda. O amarrado é a exceção: o movimento é emprestado.)
 */
describe('SceneProps — objeto amarrado', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
  })

  function setupAttached() {
    const figureId = useFiguresStore.getState().addFigure()!
    const propId = useFiguresStore.getState().addProp('box')!
    useFiguresStore.getState().attachProp(propId, figureId, 'wrist.R')
    return { figureId, propId }
  }

  it('a mesh do objeto amarrado fica na colocação derivada da junta', async () => {
    const { figureId, propId } = setupAttached()
    const figure = useFiguresStore.getState().figures.find((candidate) => candidate.id === figureId)!
    const prop = useFiguresStore.getState().props.find((candidate) => candidate.id === propId)!
    const placement = attachedPropPlacement(figure, prop.attachment!)!

    const renderer = await ReactThreeTestRenderer.create(<SceneProps />)
    const mesh = renderer.scene.findByProps({ name: `prop-${propId}` })

    expect(mesh.instance.position.x).toBeCloseTo(placement.position[0], 5)
    expect(mesh.instance.position.y).toBeCloseTo(placement.position[1], 5)
    expect(mesh.instance.position.z).toBeCloseTo(placement.position[2], 5)
  })

  it('durante a pré-visualização da animação, o objeto segue o boneco do PREVIEW, não o do store', async () => {
    const { figureId, propId } = setupAttached()
    const figure = useFiguresStore.getState().figures.find((candidate) => candidate.id === figureId)!
    const prop = useFiguresStore.getState().props.find((candidate) => candidate.id === propId)!

    const renderer = await ReactThreeTestRenderer.create(<SceneProps />)

    const movedFigure = { ...figure, position: [2, 0, 1] as const }
    await ReactThreeTestRenderer.act(async () => {
      useAnimationStore.getState().setPreview({ figures: [movedFigure], camera: DEFAULT_SCENE_CAMERA })
    })

    const placement = attachedPropPlacement(movedFigure, prop.attachment!)!
    const mesh = renderer.scene.findByProps({ name: `prop-${propId}` })
    expect(mesh.instance.position.x).toBeCloseTo(placement.position[0], 5)
    expect(mesh.instance.position.z).toBeCloseTo(placement.position[2], 5)
  })

  it('objeto solto continua na própria colocação, preview ou não', async () => {
    const propId = useFiguresStore.getState().addProp('box')!
    const prop = useFiguresStore.getState().props.find((candidate) => candidate.id === propId)!

    const renderer = await ReactThreeTestRenderer.create(<SceneProps />)
    const mesh = renderer.scene.findByProps({ name: `prop-${propId}` })
    expect(mesh.instance.position.x).toBeCloseTo(prop.position[0], 6)
    expect(mesh.instance.position.y).toBeCloseTo(prop.position[1], 6)
  })
})
