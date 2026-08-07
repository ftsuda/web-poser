import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installPreviewGuard } from '../previewGuard'
import { useAnimationStore } from '../../store/animationStore'
import { useFiguresStore } from '../../store/figuresStore'
import type { CameraViewState } from '../../scene/cameraMove'

const CAMERA: CameraViewState = { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 }

const previa = () => ({ figures: [], camera: CAMERA })

/**
 * A regra que impede a bancada de travar: mexeu na cena de trabalho, a
 * pré-visualização sai da frente. Ver `previewGuard.ts` e DECISOES.md #134.
 */
describe('rede de segurança da pré-visualização', () => {
  let desliga: () => void

  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useAnimationStore.setState(useAnimationStore.getInitialState())
    desliga = installPreviewGuard()
  })

  afterEach(() => {
    desliga()
  })

  it('editar uma pose com a pré-visualização na tela a larga', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useAnimationStore.setState({ preview: previa() })

    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 10 })

    expect(useAnimationStore.getState().preview).toBeNull()
  })

  it('vale para qualquer mudança da cena, não só pose', () => {
    useAnimationStore.setState({ preview: previa() })

    useFiguresStore.getState().addFigure()

    expect(useAnimationStore.getState().preview).toBeNull()
  })

  /** Tocando, a pré-visualização É o que se está olhando — o quadro muda sozinho. */
  it('não larga nada enquanto a animação toca', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useAnimationStore.setState({ preview: previa(), playing: true })

    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 10 })

    expect(useAnimationStore.getState().preview).not.toBeNull()
  })

  /** Na exportação ela é o mecanismo: cada quadro do arquivo passa por ali. */
  it('não larga nada durante a exportação', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useAnimationStore.setState({ preview: previa(), exportPhase: 'running' })

    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 10 })

    expect(useAnimationStore.getState().preview).not.toBeNull()
  })

  /** Mexer no que NÃO é a cena (a câmera de cena, navegar) não larga nada. */
  it('mexer só na câmera de cena não larga a pré-visualização', () => {
    useFiguresStore.getState().addFigure()
    useAnimationStore.setState({ preview: previa() })

    useFiguresStore.getState().setSceneCamera({ ...CAMERA, focalMm: 85 })

    expect(useAnimationStore.getState().preview).not.toBeNull()
  })

  it('desligada, a assinatura não age mais', () => {
    const id = useFiguresStore.getState().addFigure() as string
    useAnimationStore.setState({ preview: previa() })

    desliga()
    useFiguresStore.getState().setJointRotation(id, 'hip.L', { x: 10 })

    expect(useAnimationStore.getState().preview).not.toBeNull()
  })
})
