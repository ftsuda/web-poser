import { beforeEach, describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { Figure } from '../../figure/Figure'
import { ONION_SKIN_COLORS, ONION_SKIN_OPACITY } from '../../animation/onionSkin'
import { WORKING_ANIMATION_ID } from '../../animation/animation'
import { REFERENCE_HEIGHT_M } from '../../figure/skeleton'
import { OnionSkin } from '../OnionSkin'
import { OVERLAY_NAMES, OVERLAY_NAME_LIST } from '../constants'
import { useAnimationStore } from '../../store/animationStore'
import { useFiguresStore } from '../../store/figuresStore'
import type { Figure as FigureData } from '../../store/figuresStore'
import type { CameraViewState } from '../cameraMove'

const CAMERA: CameraViewState = {
  position: [3, 2, 4],
  target: [0, 1, 0],
  up: [0, 1, 0],
  focalMm: 35,
}

function makeFigure(overrides: Partial<FigureData> = {}): FigureData {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: REFERENCE_HEIGHT_M,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: {},
    ...overrides,
  }
}

/** Animação de trabalho com `count` keyframes de um boneco cada. */
function seedWorkingAnimation(count: number) {
  useFiguresStore.setState({
    animations: [
      {
        id: WORKING_ANIMATION_ID,
        name: 'Animation',
        speed: 1,
        keyframes: Array.from({ length: count }, (_, index) => ({
          id: `k${index + 1}`,
          durationMs: 1000,
          figures: [makeFigure({ id: `f${index + 1}`, position: [index, 0, 0] })],
          camera: CAMERA,
        })),
      },
    ],
  })
}

describe('Figure — fantasma do papel-cebola', () => {
  it('pinta o boneco inteiro com a cor do papel, translúcido e sem escrever profundidade', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} ghost={{ color: '#4a9ee0', opacity: 0.3 }} />,
    )

    const materials = renderer.scene
      .findAllByType('MeshStandardMaterial')
      .map((node) => node.instance as unknown as THREE.MeshStandardMaterial)

    expect(materials.length).toBeGreaterThan(0)
    for (const material of materials) {
      expect(material.color.getHexString()).toBe('4a9ee0')
      expect(material.transparent).toBe(true)
      expect(material.opacity).toBeCloseTo(0.3, 5)
      expect(material.depthWrite).toBe(false)
    }
  })

  it('não desenha a sombra de chão', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} ghost={{ color: '#4a9ee0', opacity: 0.3 }} />,
    )

    expect(() => renderer.scene.findByProps({ name: 'figure-shadow-f1' })).toThrow()
  })

  /**
   * O `CameraRig` acha o boneco por `getObjectByName('figure-<id>')`, que
   * devolve o PRIMEIRO da travessia. Se o fantasma repetisse o nome, "enquadrar
   * boneco" poderia medir a caixa de um keyframe vizinho.
   */
  it('não repete os nomes de cena do boneco real', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} ghost={{ color: '#4a9ee0', opacity: 0.3 }} />,
    )

    expect(() => renderer.scene.findByProps({ name: 'figure-f1' })).toThrow()
    expect(() => renderer.scene.findByProps({ name: 'joint-root' })).toThrow()
    expect(() => renderer.scene.findByProps({ name: 'segment-elbow.L' })).toThrow()
  })

  it('ignora seleção e não registra clique nem gizmo', async () => {
    const clicks: string[] = []
    const refs: string[] = []
    const renderer = await ReactThreeTestRenderer.create(
      <Figure
        figure={makeFigure()}
        ghost={{ color: '#4a9ee0', opacity: 0.3 }}
        selectedJointName="elbow.L"
        onSelectJoint={(name) => clicks.push(name)}
        onJointRef={(name) => refs.push(name)}
      />,
    )

    expect(refs).toEqual([])
    expect(clicks).toEqual([])

    const materials = renderer.scene
      .findAllByType('MeshStandardMaterial')
      .map((node) => node.instance as unknown as THREE.MeshStandardMaterial)
    // Nenhum destaque emissivo: o fantasma não tem junta selecionada. Quem
    // carrega o destaque é a COR emissiva (os ossos nem chegam a mexer na
    // intensidade, que fica no 1 padrão do three com emissivo preto).
    for (const material of materials) expect(material.emissive.getHexString()).toBe('000000')
  })

  it('mantém nomes, sombra e clique quando NÃO é fantasma', async () => {
    const clicks: string[] = []
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} onSelectJoint={(name) => clicks.push(name)} />,
    )

    expect(renderer.scene.findByProps({ name: 'figure-f1' })).toBeTruthy()
    expect(renderer.scene.findByProps({ name: 'figure-shadow-f1' })).toBeTruthy()

    const elbow = renderer.scene.findByProps({ name: 'segment-elbow.L' })
    await renderer.fireEvent(elbow, 'click')
    expect(clicks).toEqual(['elbow.L'])
  })
})

describe('OnionSkin', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
  })

  it('não desenha nada com o papel-cebola desligado', async () => {
    seedWorkingAnimation(3)
    useAnimationStore.setState({ onionSkin: false, timeMs: 1000 })

    const renderer = await ReactThreeTestRenderer.create(<OnionSkin />)

    expect(() => renderer.scene.findByProps({ name: OVERLAY_NAMES.onionSkin })).toThrow()
  })

  it('desenha o keyframe anterior e o seguinte, cada um na cor do seu papel', async () => {
    seedWorkingAnimation(3)
    useAnimationStore.setState({ onionSkin: true, timeMs: 1000 })

    const renderer = await ReactThreeTestRenderer.create(<OnionSkin />)

    const group = renderer.scene.findByProps({ name: OVERLAY_NAMES.onionSkin })
    expect(group).toBeTruthy()

    const colors = new Set(
      renderer.scene
        .findAllByType('MeshStandardMaterial')
        .map((node) => `#${(node.instance as unknown as THREE.MeshStandardMaterial).color.getHexString()}`),
    )
    expect(colors).toEqual(new Set([ONION_SKIN_COLORS.previous, ONION_SKIN_COLORS.next]))

    const opacities = new Set(
      renderer.scene
        .findAllByType('MeshStandardMaterial')
        .map((node) => (node.instance as unknown as THREE.MeshStandardMaterial).opacity),
    )
    expect(opacities).toEqual(new Set([ONION_SKIN_OPACITY]))
  })

  /** Escolher o lado (pedido do usuário): a cor diz qual dos dois ficou. */
  it('no modo "só o anterior", desenha um fantasma só, na cor quente', async () => {
    seedWorkingAnimation(3)
    useAnimationStore.setState({ onionSkin: true, onionSkinMode: 'previous', timeMs: 1000 })

    const renderer = await ReactThreeTestRenderer.create(<OnionSkin />)

    const colors = new Set(
      renderer.scene
        .findAllByType('MeshStandardMaterial')
        .map((node) => `#${(node.instance as unknown as THREE.MeshStandardMaterial).color.getHexString()}`),
    )
    expect(colors).toEqual(new Set([ONION_SKIN_COLORS.previous]))
  })

  it('no modo "só o seguinte", desenha um fantasma só, na cor fria', async () => {
    seedWorkingAnimation(3)
    useAnimationStore.setState({ onionSkin: true, onionSkinMode: 'next', timeMs: 1000 })

    const renderer = await ReactThreeTestRenderer.create(<OnionSkin />)

    const colors = new Set(
      renderer.scene
        .findAllByType('MeshStandardMaterial')
        .map((node) => `#${(node.instance as unknown as THREE.MeshStandardMaterial).color.getHexString()}`),
    )
    expect(colors).toEqual(new Set([ONION_SKIN_COLORS.next]))
  })

  /** Na ponta do lado escolhido não há vizinho — e não se cai no outro. */
  it('no primeiro keyframe, o modo "só o anterior" não desenha nada', async () => {
    seedWorkingAnimation(3)
    useAnimationStore.setState({ onionSkin: true, onionSkinMode: 'previous', timeMs: 0 })

    const renderer = await ReactThreeTestRenderer.create(<OnionSkin />)

    expect(() => renderer.scene.findByProps({ name: OVERLAY_NAMES.onionSkin })).toThrow()
  })

  it('some enquanto a animação toca', async () => {
    seedWorkingAnimation(3)
    useAnimationStore.setState({ onionSkin: true, timeMs: 1000, playing: true })

    const renderer = await ReactThreeTestRenderer.create(<OnionSkin />)

    expect(() => renderer.scene.findByProps({ name: OVERLAY_NAMES.onionSkin })).toThrow()
  })

  it('some enquanto exporta', async () => {
    seedWorkingAnimation(3)
    useAnimationStore.setState({ onionSkin: true, timeMs: 1000, exportPhase: 'running' })

    const renderer = await ReactThreeTestRenderer.create(<OnionSkin />)

    expect(() => renderer.scene.findByProps({ name: OVERLAY_NAMES.onionSkin })).toThrow()
  })

  it('não desenha nada com um keyframe só', async () => {
    seedWorkingAnimation(1)
    useAnimationStore.setState({ onionSkin: true, timeMs: 0 })

    const renderer = await ReactThreeTestRenderer.create(<OnionSkin />)

    expect(() => renderer.scene.findByProps({ name: OVERLAY_NAMES.onionSkin })).toThrow()
  })

  /**
   * É esta linha que mantém o fantasma fora do PNG e do MP4: as duas saídas
   * escondem tudo o que está em `OVERLAY_NAME_LIST`, com uma regra só.
   */
  it('usa um nome de overlay, para as saídas o esconderem sozinhas', () => {
    expect(OVERLAY_NAME_LIST).toContain(OVERLAY_NAMES.onionSkin)
  })
})
