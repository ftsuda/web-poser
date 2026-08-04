import '../../i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as THREE from 'three'
import { buildJointFrames } from '../../figure/jointFrames'
import { pickFile } from '../../persistence/fileIO'
import type { PoseMark, PoseMarkKey } from '../../pose-import/markedPose'
import { activeViewportCamera } from '../../scene/viewportViewBasis'
import { referenceVideoElement } from '../../scene/referenceVideo'
import { useFiguresStore, type Figure } from '../../store/figuresStore'
import { useReferenceImageStore } from '../../store/referenceImageStore'
import { ReferencePhotoControls } from '../ReferencePhotoControls'

vi.mock('../../persistence/fileIO')

/**
 * Os controles compartilhados da foto de referência (item 7 + pose por
 * marcação manual): carregar/limpar, o fluxo guiado e o "Inferir pose". O
 * overlay (toques na foto) tem a própria mecânica; aqui entra o que os DOIS
 * painéis (desktop e módulo) usam.
 */

/** Marcas sintéticas do próprio boneco, vistas de frente — o mínimo para inferir. */
function marksFromFigure(figure: Figure): Partial<Record<PoseMarkKey, PoseMark>> {
  const { joints } = buildJointFrames(figure)
  const sources: Partial<Record<PoseMarkKey, string>> = {
    head: 'head',
    'shoulder.L': 'shoulder.L',
    'shoulder.R': 'shoulder.R',
    'elbow.L': 'elbow.L',
    'elbow.R': 'elbow.R',
    'wrist.L': 'wrist.L',
    'wrist.R': 'wrist.R',
    'hip.L': 'hip.L',
    'hip.R': 'hip.R',
    'knee.L': 'knee.L',
    'knee.R': 'knee.R',
    'ankle.L': 'ankle.L',
    'ankle.R': 'ankle.R',
  }
  const marks: Partial<Record<PoseMarkKey, PoseMark>> = {}
  for (const [key, joint] of Object.entries(sources) as [PoseMarkKey, string][]) {
    const world = joints.get(joint)!.getWorldPosition(new THREE.Vector3())
    marks[key] = { x: 0.5 + world.x * 0.3, y: 0.5 - world.y * 0.3 }
  }
  return marks
}

describe('ReferencePhotoControls', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useReferenceImageStore.setState(useReferenceImageStore.getInitialState())
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
    activeViewportCamera.current = new THREE.PerspectiveCamera()
  })

  afterEach(() => {
    activeViewportCamera.current = null
    referenceVideoElement.current = null
    vi.restoreAllMocks()
  })

  it('sem foto: dica de sessão e botão de carregar; carregar registra a foto', async () => {
    const user = userEvent.setup()
    vi.mocked(pickFile).mockResolvedValue({
      file: new File(['x'], 'referencia.jpg', { type: 'image/jpeg' }),
      data: new ArrayBuffer(4),
    })
    render(<ReferencePhotoControls />)

    expect(screen.getByText(/só nesta sessão/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Carregar foto/vídeo…' }))

    expect(useReferenceImageStore.getState().imageUrl).toBe('blob:mock')
    expect(useReferenceImageStore.getState().kind).toBe('image')
    expect(screen.getByText('referencia.jpg')).toBeInTheDocument()
    // Foto não tem controles de frame.
    expect(screen.queryByRole('button', { name: 'Próximo frame' })).not.toBeInTheDocument()
  })

  it('vídeo: o MESMO carregador detecta pelo MIME e liga os controles de frame', async () => {
    const user = userEvent.setup()
    vi.mocked(pickFile).mockResolvedValue({
      file: new File(['x'], 'referencia.mp4', { type: 'video/mp4' }),
      data: new ArrayBuffer(4),
    })
    render(<ReferencePhotoControls />)
    await user.click(screen.getByRole('button', { name: 'Carregar foto/vídeo…' }))

    expect(useReferenceImageStore.getState().kind).toBe('video')

    // O elemento vivo mora no overlay; aqui, um dublê pelo ref de módulo.
    const fakeVideo = {
      currentTime: 2,
      duration: 10,
      paused: true,
      ended: false,
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
    } as unknown as HTMLVideoElement
    referenceVideoElement.current = fakeVideo
    act(() => {
      useReferenceImageStore.getState().syncVideoPlayback({ time: 2, duration: 10, playing: false })
    })

    // Frame a frame: pausa e anda 1/fps (30 por padrão) — grampeado pelo puro.
    await user.click(screen.getByRole('button', { name: 'Próximo frame' }))
    expect(fakeVideo.pause).toHaveBeenCalled()
    expect(fakeVideo.currentTime).toBeCloseTo(2 + 1 / 30, 9)
    await user.click(screen.getByRole('button', { name: 'Frame anterior' }))
    expect(fakeVideo.currentTime).toBeCloseTo(2, 9)

    // Reproduzir/pausar pelo dublê; a linha do tempo busca direto.
    await user.click(screen.getByRole('button', { name: 'Reproduzir' }))
    expect(fakeVideo.play).toHaveBeenCalled()
    const timeline = screen.getByLabelText(/Linha do tempo/)
    fireEvent.change(timeline, { target: { value: '5' } })
    expect(fakeVideo.currentTime).toBe(5)

    // A linha do tempo fica EMPILHADA: rótulo em cima, barra inteira embaixo —
    // o texto com tempo/duração espremia a barra na mesma linha (#115.2).
    expect(timeline.closest('label')).toHaveClass('photo-ref__row--stack')

    // O seletor de fps muda o passo — e vira escolha MANUAL.
    await user.selectOptions(screen.getByLabelText(/Passo do frame/), '60')
    expect(useReferenceImageStore.getState().videoFps).toBe(60)
    expect(useReferenceImageStore.getState().videoFpsManual).toBe(true)
  })

  it('o fluxo guiado começa na cabeça, e "pular" só libera em ponto opcional', async () => {
    const user = userEvent.setup()
    act(() => {
      useReferenceImageStore.getState().setImage('blob:foto', 'pose.jpg')
    })
    render(<ReferencePhotoControls />)

    expect(screen.getByText(/alinhe a POSIÇÃO e a ROTAÇÃO/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Marcar pose na foto' }))

    expect(screen.getByText(/Junta 1\/18 — Cabeça/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pular ponto opcional' })).toBeDisabled()
  })

  it('a marcação anda junta a junta, e a profundidade é sempre a da junta CORRENTE (#115.1)', async () => {
    const user = userEvent.setup()
    act(() => {
      useReferenceImageStore.getState().setImage('blob:foto', 'pose.jpg')
    })
    render(<ReferencePhotoControls />)
    await user.click(screen.getByRole('button', { name: 'Marcar pose na foto' }))

    // No primeiro ponto não há para onde voltar; marcar não faz o cursor pular.
    expect(screen.getByRole('button', { name: 'Junta anterior' })).toBeDisabled()
    act(() => {
      useReferenceImageStore.getState().placeMark(0.5, 0.1)
    })
    expect(screen.getByText(/Junta 1\/18 — Cabeça/)).toBeInTheDocument()
    expect(screen.getByText(/toque de novo/)).toBeInTheDocument()

    // Cabeça não tem osso encurtado nem par: nada de profundidade.
    expect(screen.queryByText(/^Profundidade/)).not.toBeInTheDocument()

    // Anda até o ombro direito — nariz, pescoço, base do tórax, ombro.
    for (const step of ['nose', 'neck', 'chest', 'shoulder.R']) {
      void step
      await user.click(screen.getByRole('button', { name: 'Próxima junta' }))
    }
    expect(screen.getByText(/Junta 5\/18 — Ombro direito/)).toBeInTheDocument()
    expect(screen.getByText(/Toque na foto/)).toBeInTheDocument()

    // Marcado, o painel oferece a profundidade DESTE ombro (não da junta
    // anterior) e explica que ombros/quadris andam em par (#115).
    act(() => {
      useReferenceImageStore.getState().placeMark(0.4, 0.3)
    })
    expect(screen.getByText('Profundidade — Ombro direito')).toBeInTheDocument()
    expect(screen.getByText(/o outro recua a mesma medida/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'À frente' }))
    expect(useReferenceImageStore.getState().marks['shoulder.R']?.depth).toBe('front')

    // Voltar uma junta leva o painel junto: a base do tórax é um ponto SOBRE o
    // eixo do tronco (#119) e não tem profundidade.
    await user.click(screen.getByRole('button', { name: 'Junta anterior' }))
    expect(screen.getByText(/Junta 4\/18 — Base do tórax/)).toBeInTheDocument()
    expect(screen.queryByText(/^Profundidade/)).not.toBeInTheDocument()
  })

  it('ao VOLTAR a uma junta já marcada, a profundidade escolhida vem marcada (DECISOES.md #118.1)', async () => {
    const user = userEvent.setup()
    act(() => {
      useReferenceImageStore.getState().setImage('blob:foto', 'pose.jpg')
      useReferenceImageStore.getState().startMarking()
      useReferenceImageStore.getState().selectMark('shoulder.R')
      useReferenceImageStore.getState().placeMark(0.4, 0.3)
    })
    render(<ReferencePhotoControls />)

    // Sem escolha, quem está marcado é "No plano" — o padrão da marca.
    expect(screen.getByRole('button', { name: 'No plano' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Atrás' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Atrás' }))
    expect(screen.getByRole('button', { name: 'Atrás' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'No plano' })).toHaveAttribute('aria-pressed', 'false')

    // Sai da junta e volta — o gesto que se faz o tempo todo: marcar o resto
    // do corpo e reconferir. O botão tem de continuar marcado.
    await user.click(screen.getByRole('button', { name: 'Próxima junta' }))
    expect(screen.getByText(/Junta 6\/18/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Junta anterior' }))

    expect(screen.getByText('Profundidade — Ombro direito')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atrás' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('zoom por slider (escala log), modo "Ajustar foto" e "Recentrar" — a vista da foto no painel', async () => {
    const user = userEvent.setup()
    act(() => {
      useReferenceImageStore.getState().setImage('blob:foto', 'pose.jpg')
    })
    render(<ReferencePhotoControls />)

    // Vista neutra: recentrar não tem o que fazer.
    expect(screen.getByRole('button', { name: 'Recentrar foto' })).toBeDisabled()

    // O slider é em log2: valor 1 = zoom 2×.
    fireEvent.change(screen.getByLabelText(/Zoom da foto/), { target: { value: '1' } })
    expect(useReferenceImageStore.getState().photoZoom).toBeCloseTo(2, 9)

    await user.click(screen.getByRole('button', { name: 'Ajustar foto' }))
    expect(useReferenceImageStore.getState().adjusting).toBe(true)
    expect(screen.getByText(/Arraste para mover/)).toBeInTheDocument()

    // Entrar na marcação desliga o ajuste (modos exclusivos).
    await user.click(screen.getByRole('button', { name: 'Marcar pose na foto' }))
    expect(useReferenceImageStore.getState().adjusting).toBe(false)
    expect(useReferenceImageStore.getState().marking).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Recentrar foto' }))
    expect(useReferenceImageStore.getState().photoZoom).toBe(1)
  })

  it('inferir sem boneco selecionado explica em vez de calar', async () => {
    const user = userEvent.setup()
    act(() => {
      useReferenceImageStore.setState({ imageUrl: 'blob:foto', imageName: 'pose.jpg', marking: true })
    })
    render(<ReferencePhotoControls />)

    await user.click(screen.getByRole('button', { name: 'Inferir pose no boneco' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Selecione um boneco para receber a pose.')
  })

  it('inferir aplica a pose no boneco selecionado e lista os avisos', async () => {
    const user = userEvent.setup()
    let figureId = ''
    act(() => {
      figureId = useFiguresStore.getState().addFigure()!
      useFiguresStore.setState({ selectedFigureId: figureId })
      const figure = useFiguresStore.getState().figures[0]
      useReferenceImageStore.setState({
        imageUrl: 'blob:foto',
        imageName: 'pose.jpg',
        marking: true,
        marks: marksFromFigure(figure),
      })
    })
    render(<ReferencePhotoControls />)

    await user.click(screen.getByRole('button', { name: 'Inferir pose no boneco' }))

    // O boneco nasce em T-pose: a inferência da própria projeção o mantém.
    const applied = useFiguresStore.getState().figures[0].pose
    expect(applied['shoulder.L'].z).toBeCloseTo(90, 0)
    expect(applied['elbow.L'].y).toBe(90)

    expect(screen.getByText('Pose aplicada no boneco selecionado.')).toBeInTheDocument()
    expect(screen.getByText(/plano da vista/)).toBeInTheDocument()
  })

  it('a raiz torta vira aviso no inferir, e o botão dos quadris a acerta (#119)', async () => {
    const user = userEvent.setup()
    act(() => {
      const figureId = useFiguresStore.getState().addFigure()!
      useFiguresStore.setState({ selectedFigureId: figureId })
      const figure = useFiguresStore.getState().figures[0]
      // As marcas vêm de uma pelve TORTA; o boneco foi alinhado reto, a olho —
      // o desencontro que faz o tronco inteiro sair torto junto.
      useReferenceImageStore.setState({
        imageUrl: 'blob:foto',
        imageName: 'pose.jpg',
        marking: true,
        marks: marksFromFigure({ ...figure, rotation: { x: 0, y: 0, z: 12 } }),
      })
    })
    render(<ReferencePhotoControls />)

    // Inferir AVISA, mas não mexe na colocação: ela é do usuário (#111).
    await user.click(screen.getByRole('button', { name: 'Inferir pose no boneco' }))
    expect(screen.getByText(/discorda da rotação da raiz/)).toBeInTheDocument()
    expect(useFiguresStore.getState().figures[0].rotation.z).toBe(0)

    // O botão é o ato explícito — e diz o que corrigiu: sem profundidade nos
    // quadris, só a inclinação lateral da pelve.
    await user.click(screen.getByRole('button', { name: 'Acertar raiz pelos quadris' }))
    expect(useFiguresStore.getState().figures[0].rotation.z).toBeCloseTo(12, 0)
    expect(screen.getByText(/só a inclinação lateral da pelve/)).toBeInTheDocument()
  })

  it('sem os dois quadris marcados não há linha: o botão da raiz fica desabilitado', () => {
    act(() => {
      useReferenceImageStore.setState({ imageUrl: 'blob:foto', imageName: 'pose.jpg', marking: true })
    })
    render(<ReferencePhotoControls />)

    expect(screen.getByRole('button', { name: 'Acertar raiz pelos quadris' })).toBeDisabled()
  })
})
