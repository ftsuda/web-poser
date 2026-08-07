import { afterEach, describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type * as THREE from 'three'
import { REFERENCE_HEIGHT_M } from '../../figure/skeleton'
import { useAnimationStore } from '../../store/animationStore'
import { useFiguresStore, type Figure } from '../../store/figuresStore'
import { SceneFigures } from '../SceneFigures'
import type { AnimationSample } from '../../animation/animationSampler'
import type { CameraViewState } from '../cameraMove'

/**
 * O que se trava aqui é o CUSTO de um re-render dos bonecos da cena, e não o que
 * se vê — isto é, uma coisa que nenhum teste de aparência pegaria.
 *
 * O React reexecuta um `ref` sempre que a IDENTIDADE do callback muda: chama o
 * anterior com `null` e o novo com o objeto. O `onJointRef` que chega ao `Figure`
 * vira o `ref` de cada uma das 32 juntas, e cada registro é um `setState` no
 * `Viewport` — que re-renderiza os bonecos, que registram de novo. Com as setas
 * inline que havia aqui, andar UM quadro na linha do tempo custava ~740
 * registros, 17 renders do viewport e ~1 s de script — com um único boneco na
 * cena (DECISOES.md #132).
 */
const CAMERA: CameraViewState = {
  position: [3, 2, 4],
  target: [0, 1, 0],
  up: [0, 1, 0],
  focalMm: 35,
}

function makeFigure(overrides: Partial<Figure> = {}): Figure {
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

function sampleOf(figures: Figure[]): AnimationSample {
  return { figures, camera: CAMERA }
}

afterEach(() => {
  useAnimationStore.setState({ preview: null })
  useFiguresStore.setState({ figures: [], selectedFigureId: null, selectedJointName: null })
})

describe('SceneFigures — estabilidade do registro de juntas', () => {
  it('não reexecuta o ref das juntas quando a pré-visualização anda um quadro', async () => {
    useFiguresStore.setState({ figures: [makeFigure()], selectedFigureId: 'f1' })

    const registros: string[] = []
    const anota = (figureId: string, jointName: string, object: THREE.Group | null) =>
      registros.push(`${figureId}:${jointName}:${object ? 'on' : 'off'}`)

    await ReactThreeTestRenderer.create(<SceneFigures onJointRef={anota} />)
    const aoMontar = registros.length
    expect(aoMontar).toBeGreaterThan(0)

    // É exatamente o que a seta de quadro faz: publica uma amostra nova, com
    // objetos de boneco novos e os MESMOS ids.
    await ReactThreeTestRenderer.act(async () => {
      useAnimationStore.setState({ preview: sampleOf([makeFigure({ pose: { 'elbow.L': { x: 20, y: 0, z: 0 } } })]) })
    })

    expect(registros).toHaveLength(aoMontar)
  })

  it('registra e desregistra quando um boneco entra e sai da cena — o `ref` continua vivo', async () => {
    useFiguresStore.setState({ figures: [makeFigure()] })

    const ativos = new Map<string, THREE.Group>()
    const anota = (figureId: string, jointName: string, object: THREE.Group | null) => {
      const chave = `${figureId}:${jointName}`
      if (object) ativos.set(chave, object)
      else ativos.delete(chave)
    }

    const renderer = await ReactThreeTestRenderer.create(<SceneFigures onJointRef={anota} />)
    const doPrimeiro = ativos.size
    expect(doPrimeiro).toBeGreaterThan(0)

    await ReactThreeTestRenderer.act(async () => {
      useFiguresStore.setState({ figures: [makeFigure(), makeFigure({ id: 'f2', name: 'Boneco 2' })] })
    })
    expect(ativos.size).toBe(doPrimeiro * 2)
    expect([...ativos.keys()].some((chave) => chave.startsWith('f2:'))).toBe(true)

    await ReactThreeTestRenderer.act(async () => {
      useFiguresStore.setState({ figures: [makeFigure()] })
    })
    expect(ativos.size).toBe(doPrimeiro)
    expect([...ativos.keys()].some((chave) => chave.startsWith('f2:'))).toBe(false)

    await renderer.unmount()
    expect(ativos.size).toBe(0)
  })
})
