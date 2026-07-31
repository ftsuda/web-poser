import '../../i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCameraStore } from '../../store/cameraStore'
import { useFiguresStore } from '../../store/figuresStore'
import { useUIStore } from '../../store/uiStore'
import { CameraPanel } from '../CameraPanel'
import { focalLengthToFov } from '../../scene/lens'

// `importOriginal` preserva `SceneFileError` real (usado por `instanceof`).
vi.mock('../../persistence/sceneFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../persistence/sceneFile')>()),
  serializeCameraBookmarksFile: vi.fn().mockReturnValue('{}'),
  parseCameraBookmarksFile: vi.fn(),
}))
vi.mock('../../persistence/fileIO', () => ({
  writeFileToDirectoryOrDownload: vi.fn().mockResolvedValue(undefined),
  pickFile: vi.fn(),
}))

import {
  SceneFileError,
  serializeCameraBookmarksFile,
  parseCameraBookmarksFile,
} from '../../persistence/sceneFile'
import { pickFile, writeFileToDirectoryOrDownload } from '../../persistence/fileIO'

async function renderCameraPanel() {
  const utils = render(<CameraPanel />)
  await act(async () => {})
  return utils
}

/**
 * As quatro seções de uso ocasional do painel (vistas prontas, movimento,
 * vistas ortográficas e bookmarks) nascem RECOLHIDAS — escolha de layout,
 * `uiPreferences.ts`. Estes testes falam do conteúdo, então abrem todas.
 */
function abrirSecoes() {
  useUIStore.setState((state) => ({
    collapsedSections: Object.fromEntries(
      Object.keys(state.collapsedSections).map((key) => [key, false]),
    ) as typeof state.collapsedSections,
  }))
}

describe('CameraPanel', () => {
  beforeEach(() => {
    useCameraStore.setState(useCameraStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
    abrirSecoes()
    useFiguresStore.temporal.getState().clear()
    vi.mocked(serializeCameraBookmarksFile).mockClear()
    vi.mocked(parseCameraBookmarksFile).mockReset()
    vi.mocked(pickFile).mockReset()
    vi.mocked(writeFileToDirectoryOrDownload).mockClear()
  })

  it('shows the panel title and a focal length field bound to the camera store', async () => {
    await renderCameraPanel()
    expect(screen.getByRole('heading', { name: 'Câmera' })).toBeInTheDocument()
    expect(screen.getByLabelText('Distância focal (mm)')).toHaveValue(
      Math.round(useCameraStore.getState().focalMm),
    )
  })

  it('updates the lens in the store when the field changes', async () => {
    const user = userEvent.setup()
    await renderCameraPanel()

    const focalInput = screen.getByLabelText('Distância focal (mm)')
    await user.clear(focalInput)
    await user.type(focalInput, '85')
    await user.tab()

    expect(useCameraStore.getState().focalMm).toBe(85)
    expect(useCameraStore.getState().fov).toBeCloseTo(focalLengthToFov(85), 6)
  })

  it('applies an orthographic preset and switches the store to orthographic projection', async () => {
    const user = userEvent.setup()
    await renderCameraPanel()

    await user.click(screen.getByRole('button', { name: 'Frente' }))

    const state = useCameraStore.getState()
    expect(state.projection).toBe('orthographic')
    expect(state.pendingCommand).toEqual({ type: 'preset', preset: 'front' })
  })

  it('requests a return to perspective, disabled while already in perspective', async () => {
    const user = userEvent.setup()
    await renderCameraPanel()

    const backButton = screen.getByRole('button', { name: 'Voltar à perspectiva' })
    expect(backButton).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Topo' }))
    expect(backButton).not.toBeDisabled()

    await user.click(backButton)
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'toPerspective' })
  })

  it('shows the empty-state message when there are no saved bookmarks', async () => {
    await renderCameraPanel()
    expect(screen.getByText('Nenhum bookmark salvo ainda.')).toBeInTheDocument()
  })

  it('lists existing bookmarks from the figures store, with apply and remove actions', async () => {
    const id = useFiguresStore.getState().addCameraBookmark({
      name: 'Vista salva 1',
      position: [3, 2, 4],
      target: [0, 1, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })
    await renderCameraPanel()

    expect(screen.getByText('Vista salva 1')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Ir para este bookmark' }))
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyBookmark', id })

    await user.click(screen.getByRole('button', { name: 'Remover bookmark' }))
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(0)
  })

  it('opens a name field on "save current position" and queues a requestSaveBookmark command on confirm', async () => {
    const user = userEvent.setup()
    await renderCameraPanel()

    await user.click(screen.getByRole('button', { name: 'Salvar posição atual' }))

    const nameInput = screen.getByLabelText('Nome do bookmark')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ângulo 3/4')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(useCameraStore.getState().pendingCommand).toEqual({
      type: 'requestSaveBookmark',
      name: 'Ângulo 3/4',
    })
    // O formulário fecha depois de confirmar.
    expect(screen.queryByLabelText('Nome do bookmark')).not.toBeInTheDocument()
  })

  it('cancels the "save current position" form without queuing a command', async () => {
    const user = userEvent.setup()
    await renderCameraPanel()

    await user.click(screen.getByRole('button', { name: 'Salvar posição atual' }))
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByLabelText('Nome do bookmark')).not.toBeInTheDocument()
    expect(useCameraStore.getState().pendingCommand).toBeNull()
  })

  it('exports the saved camera bookmarks as a .json download', async () => {
    useFiguresStore.getState().addCameraBookmark({
      name: 'Vista salva 1',
      position: [3, 2, 4],
      target: [0, 1, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })
    const user = userEvent.setup()
    await renderCameraPanel()

    await user.click(screen.getByRole('button', { name: 'Exportar bookmarks (.json)' }))

    expect(vi.mocked(serializeCameraBookmarksFile)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(serializeCameraBookmarksFile).mock.calls[0][0]).toHaveLength(1)
    expect(vi.mocked(writeFileToDirectoryOrDownload)).toHaveBeenCalledTimes(1)
    const [directoryHandle, filename] = vi.mocked(writeFileToDirectoryOrDownload).mock.calls[0]
    expect(directoryHandle).toBeNull()
    expect(filename).toMatch(/\.json$/)
  })

  it('imports camera bookmarks from a picked .json file, adding them to the existing list', async () => {
    useFiguresStore.getState().addCameraBookmark({
      name: 'Vista A',
      position: [1, 1, 1],
      target: [0, 0, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'bookmarks.json'), data: new ArrayBuffer(4) })
    vi.mocked(parseCameraBookmarksFile).mockReturnValue([
      {
        id: 'imported-1',
        name: 'Vista B',
        position: [2, 2, 2],
        target: [0, 0, 0],
        projection: 'perspective',
        fov: 50,
        zoom: 1,
      },
    ])

    const user = userEvent.setup()
    await renderCameraPanel()
    await user.click(screen.getByRole('button', { name: 'Importar bookmarks (.json)' }))

    await vi.waitFor(() => {
      expect(useFiguresStore.getState().cameraBookmarks.map((b) => b.name)).toEqual(['Vista A', 'Vista B'])
    })
  })
})

describe('CameraPanel — erro de importação (fase 9, item 4)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    abrirSecoes()
    vi.mocked(parseCameraBookmarksFile).mockReset()
    vi.mocked(pickFile).mockReset()
  })

  it('avisa quando o arquivo de bookmarks não tem os dados do app', async () => {
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'x.json'), data: new ArrayBuffer(4) })
    vi.mocked(parseCameraBookmarksFile).mockImplementation(() => { throw new SceneFileError('missingAppData') })

    const user = userEvent.setup()
    await renderCameraPanel()
    await user.click(screen.getByRole('button', { name: 'Importar bookmarks (.json)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('não é do Virtual Mockup')
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(0)
  })
})

/**
 * Lente em milímetros, enquadramento cinematográfico, inclinação e movimento
 * entre dois pontos (DECISOES.md #46).
 */
describe('CameraPanel — lente, enquadramento e movimento', () => {
  beforeEach(() => {
    useCameraStore.setState(useCameraStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
    abrirSecoes()
    useFiguresStore.temporal.getState().clear()
  })

  it('oferece as lentes da tabela de referência e aplica a escolhida', async () => {
    const user = userEvent.setup()
    await renderCameraPanel()

    for (const mm of [14, 24, 35, 50, 85, 100, 200]) {
      expect(screen.getByRole('button', { name: String(mm) })).toBeInTheDocument()
    }

    await user.click(screen.getByRole('button', { name: '85' }))
    expect(useCameraStore.getState().focalMm).toBe(85)
    expect(screen.getByRole('button', { name: '85' })).toHaveAttribute('aria-pressed', 'true')
  })

  /**
   * O termo em inglês é o que se digita num prompt de geração de imagem, então
   * não muda com o idioma da interface (#47). Nos combos ele vem antes do
   * travessão, porque `<option>` não tem duas linhas (#51); nos botões que
   * sobraram — os movimentos — continua sendo termo em cima, legenda embaixo.
   */
  it('traz o termo em inglês e a tradução em cada opção e em cada botão', async () => {
    await renderCameraPanel()

    const planos = screen.getByLabelText('Tamanho do plano')
    expect(planos).toHaveTextContent('Close-Up — Primeiro plano')
    expect(planos).toHaveTextContent('Extreme Wide Shot — Plano geral extremo')
    expect(screen.getByLabelText('De que altura se olha')).toHaveTextContent(
      "Bird's-Eye View — Vista aérea",
    )
    expect(screen.getByRole('button', { name: /^Rotate/ })).toHaveTextContent('Orbitar')
  })

  /**
   * Escolher e confirmar, o mesmo mecanismo do combo de poses (#51): navegar
   * pela lista com o teclado não pode sair mexendo na câmera.
   */
  it('escolher no combo não move a câmera; só o botão aplica', async () => {
    const user = userEvent.setup()
    act(() => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
    })
    await renderCameraPanel()

    await user.selectOptions(screen.getByLabelText('Tamanho do plano'), 'closeUp')
    await user.selectOptions(screen.getByLabelText('De que altura se olha'), 'angle:lowAngle')
    expect(useCameraStore.getState().shot).toBeNull()
    expect(useCameraStore.getState().pendingCommand).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Aplicar enquadramento' }))
    const state = useCameraStore.getState()
    expect(state.shot).toBe('closeUp')
    expect(state.angle).toBe('lowAngle')
    expect(state.pendingCommand).toEqual({ type: 'applyShot' })
  })

  it('aplica o enquadramento inteiro num comando só', async () => {
    const user = userEvent.setup()
    act(() => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
    })
    await renderCameraPanel()

    await user.selectOptions(screen.getByLabelText('Tamanho do plano'), 'cowboy')
    await user.selectOptions(screen.getByLabelText('De que altura se olha'), 'height:knee')
    await user.selectOptions(screen.getByLabelText('Lado (relativo ao boneco)'), 'profile')
    await user.selectOptions(screen.getByLabelText('Composição'), 'both')
    await user.click(screen.getByRole('button', { name: 'Aplicar enquadramento' }))

    expect(useCameraStore.getState()).toMatchObject({
      shot: 'cowboy',
      cameraHeight: 'knee',
      orientation: 'profile',
      thirds: true,
      leadRoom: true,
    })
  })

  /** Ângulo e altura vão no mesmo combo: só um pode valer. */
  it('escolher uma altura de câmera apaga o ângulo, e vice-versa', async () => {
    const user = userEvent.setup()
    act(() => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
    })
    await renderCameraPanel()

    const vantagem = screen.getByLabelText('De que altura se olha')
    const aplicar = screen.getByRole('button', { name: 'Aplicar enquadramento' })

    await user.selectOptions(vantagem, 'height:knee')
    await user.click(aplicar)
    expect(useCameraStore.getState().cameraHeight).toBe('knee')

    await user.selectOptions(vantagem, 'angle:highAngle')
    await user.click(aplicar)
    expect(useCameraStore.getState().cameraHeight).toBeNull()
    expect(useCameraStore.getState().angle).toBe('highAngle')
  })

  it('o lado tem a opção de manter o que está', async () => {
    const user = userEvent.setup()
    act(() => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().selectFigure(id)
    })
    await renderCameraPanel()

    const lado = screen.getByLabelText('Lado (relativo ao boneco)')
    const aplicar = screen.getByRole('button', { name: 'Aplicar enquadramento' })

    await user.selectOptions(lado, 'back')
    await user.click(aplicar)
    expect(useCameraStore.getState().orientation).toBe('back')

    await user.selectOptions(lado, '')
    await user.click(aplicar)
    expect(useCameraStore.getState().orientation).toBeNull()
  })

  it('sem boneco na cena, não há o que enquadrar e o painel explica', async () => {
    await renderCameraPanel()
    expect(screen.getByRole('button', { name: 'Aplicar enquadramento' })).toBeDisabled()
    expect(screen.getByText('Adicione um boneco para enquadrar.')).toBeInTheDocument()
  })

  /**
   * Sem seleção, os planos abertos passam a enquadrar o conjunto (#48); os
   * fechados continuam exigindo um boneco escolhido — e o botão de aplicar
   * segue o plano ESCOLHIDO no combo, não um plano qualquer.
   */
  it('sem boneco selecionado, aplicar segue o plano escolhido: aberto pode, fechado não', async () => {
    const user = userEvent.setup()
    act(() => {
      useFiguresStore.getState().addFigure('Herói')
    })
    const { rerender } = await renderCameraPanel()

    const planos = screen.getByLabelText('Tamanho do plano')
    const aplicar = screen.getByRole('button', { name: 'Aplicar enquadramento' })

    await user.selectOptions(planos, 'wide')
    expect(aplicar).toBeEnabled()

    await user.selectOptions(planos, 'closeUp')
    expect(aplicar).toBeDisabled()
    expect(screen.getByText(/enquadram todos os bonecos/)).toBeInTheDocument()

    act(() => {
      const id = useFiguresStore.getState().figures[0].id
      useFiguresStore.getState().selectFigure(id)
    })
    rerender(<CameraPanel />)
    expect(aplicar).toBeEnabled()
  })

  it('o plano geral sem seleção manda enquadrar do mesmo jeito — quem decide o alvo é o rig', async () => {
    const user = userEvent.setup()
    act(() => {
      useFiguresStore.getState().addFigure('Herói')
      useFiguresStore.getState().addFigure('Vilã')
      useFiguresStore.getState().selectFigure(null)
    })
    await renderCameraPanel()

    await user.selectOptions(screen.getByLabelText('Tamanho do plano'), 'wide')
    await user.click(screen.getByRole('button', { name: 'Aplicar enquadramento' }))
    expect(useCameraStore.getState().shot).toBe('wide')
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyShot' })
  })

  /**
   * As vistas não compõem com o tamanho de plano — resolvem posição e
   * distância sozinhas —, então têm combo e botão próprios, e cada uma tem a
   * sua exigência.
   */
  it('cada vista habilita o botão pela própria exigência, e a dica diz qual falta', async () => {
    const user = userEvent.setup()
    const { rerender } = await renderCameraPanel()

    const vistas = screen.getByLabelText('Vistas da cena')
    const aplicar = screen.getByRole('button', { name: 'Aplicar vista' })

    // Contracampo é só meia-volta na câmera: não depende de boneco nenhum.
    await user.selectOptions(vistas, 'reverseAngle')
    expect(aplicar).toBeEnabled()
    await user.click(aplicar)
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyReverseAngle' })

    await user.selectOptions(vistas, 'pov')
    expect(aplicar).toBeDisabled()
    expect(screen.getByText('Selecione um boneco para esta vista.')).toBeInTheDocument()

    await user.selectOptions(vistas, 'overTheShoulder')
    expect(screen.getByText(/precisa de dois bonecos/)).toBeInTheDocument()

    act(() => {
      const id = useFiguresStore.getState().addFigure('Herói') as string
      useFiguresStore.getState().addFigure('Vilã')
      useFiguresStore.getState().selectFigure(id)
    })
    rerender(<CameraPanel />)
    expect(aplicar).toBeEnabled()

    // Two shot ainda precisa de um plano aplicado, que é o tamanho que ele usa.
    await user.selectOptions(vistas, 'twoShot')
    expect(aplicar).toBeDisabled()
    expect(screen.getByText('Escolha e aplique um tamanho de plano antes.')).toBeInTheDocument()

    act(() => useCameraStore.getState().applyShot('medium'))
    rerender(<CameraPanel />)
    expect(aplicar).toBeEnabled()
    await user.click(aplicar)
    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'applyTwoShot' })
  })

  it('inclina a câmera e avisa que a órbita fica torta, com botão para endireitar', async () => {
    await renderCameraPanel()

    const roll = screen.getByRole('slider', { name: /Dutch Angle/ })
    act(() => {
      fireEvent.change(roll, { target: { value: '20' } })
    })
    expect(useCameraStore.getState().rollDeg).toBe(20)
    expect(screen.getByText(/a órbita do mouse gira em torno do eixo torto/)).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Endireitar' }))
    expect(useCameraStore.getState().rollDeg).toBe(0)
  })

  it('o slider do movimento só libera com as duas pontas marcadas', async () => {
    await renderCameraPanel()
    expect(screen.getByRole('slider', { name: /Posição do movimento/ })).toBeDisabled()
    expect(screen.getByText(/Marque A e B/)).toBeInTheDocument()

    const A = {
      position: [0, 1.5, 4] as [number, number, number],
      target: [0, 1.5, 0] as [number, number, number],
      up: [0, 1, 0] as [number, number, number],
      focalMm: 50,
    }
    act(() => {
      useCameraStore.getState().setMovePoint('a', A)
      useCameraStore.getState().generateMove('zoomIn')
    })

    expect(screen.getByRole('slider', { name: /Posição do movimento/ })).toBeEnabled()
  })

  it('os atalhos de movimento ficam desabilitados enquanto não há ponto A', async () => {
    await renderCameraPanel()
    expect(screen.getByRole('button', { name: /Zoom In/ })).toBeDisabled()

    act(() => {
      useCameraStore.getState().setMovePoint('a', {
        position: [0, 1.5, 4],
        target: [0, 1.5, 0],
        up: [0, 1, 0],
        focalMm: 50,
      })
    })
    expect(screen.getByRole('button', { name: /Zoom In/ })).toBeEnabled()
  })

  /** Item 34: o travelling montado no painel vira dois keyframes do animador. */
  it('gera dois keyframes do movimento, com a cena atual e as duas câmeras', async () => {
    const user = userEvent.setup()
    const A = {
      position: [0, 1.5, 4] as [number, number, number],
      target: [0, 1.5, 0] as [number, number, number],
      up: [0, 1, 0] as [number, number, number],
      focalMm: 50,
    }
    const B = { ...A, position: [0, 1.5, 1.5] as [number, number, number], focalMm: 85 }
    await renderCameraPanel()

    const botao = () => screen.getByRole('button', { name: 'Gerar keyframes deste movimento' })
    expect(botao()).toBeDisabled()

    act(() => {
      useCameraStore.getState().setMovePoint('a', A)
      useCameraStore.getState().setMovePoint('b', B)
    })
    // Com o movimento montado mas sem boneco, o motivo aparece no painel.
    expect(botao()).toBeDisabled()
    expect(screen.getByText(/retrato da cena/)).toBeInTheDocument()

    act(() => {
      useFiguresStore.getState().addFigure()
    })
    await user.click(botao())

    const [animacao] = useFiguresStore.getState().animations
    expect(animacao.keyframes).toHaveLength(2)
    expect(animacao.keyframes[0].camera).toEqual(A)
    expect(animacao.keyframes[1].camera).toEqual(B)
  })
})

/**
 * Controles numéricos da câmera de cena (fase 11.1) — mão dupla com o gizmo:
 * os campos leem o `sceneCamera` do store (arrastar o gizmo os atualiza) e
 * editá-los grava de volta pelo mesmo `setSceneCamera`.
 */
describe('CameraPanel — posição e rotação da câmera de cena', () => {
  beforeEach(() => {
    useCameraStore.setState(useCameraStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
    abrirSecoes()
    useUIStore.setState(useUIStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('os botões Mover/Girar trocam o gizmo global e selecionam a câmera', async () => {
    const figureId = useFiguresStore.getState().addFigure() as string
    act(() => {
      useFiguresStore.getState().selectFigure(figureId)
    })
    const user = userEvent.setup()
    await renderCameraPanel()

    await user.click(screen.getByRole('button', { name: 'Girar' }))

    expect(useUIStore.getState().gizmoMode).toBe('rotate')
    // Seleção exclusiva: apertar daqui é "quero girar a CÂMERA".
    expect(useCameraStore.getState().cameraSelected).toBe(true)
    expect(useFiguresStore.getState().selectedFigureId).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Mover' }))
    expect(useUIStore.getState().gizmoMode).toBe('translate')
    expect(useCameraStore.getState().cameraSelected).toBe(true)
  })

  it('Mover/Girar ficam desabilitados no modo visão-câmera (o gizmo não está na tela)', async () => {
    act(() => {
      useCameraStore.getState().toggleViewMode()
    })
    await renderCameraPanel()

    expect(screen.getByRole('button', { name: 'Mover' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Girar' })).toBeDisabled()
  })

  it('mostra a posição atual da câmera e editá-la translada posição e alvo juntos', async () => {
    act(() => {
      useFiguresStore.getState().setSceneCamera({
        position: [1, 2, 3],
        target: [0, 1, 0],
        up: [0, 1, 0],
        focalMm: 35,
      })
    })
    await renderCameraPanel()

    const campoX = screen.getByLabelText('X', { selector: '#camera-position-x' })
    expect(campoX).toHaveValue(1)

    fireEvent.change(campoX, { target: { value: '4' } })

    const { sceneCamera } = useFiguresStore.getState()
    expect(sceneCamera.position).toEqual([4, 2, 3])
    // O alvo anda junto: a direção de visão não muda (modo W do gizmo).
    expect(sceneCamera.target).toEqual([3, 1, 0])
  })

  it('os sliders de rotação refletem a orientação vinda do store (o gizmo mexe neles)', async () => {
    act(() => {
      // Olhando de +X para a origem: guinada de +90°.
      useFiguresStore.getState().setSceneCamera({
        position: [5, 1.5, 0],
        target: [0, 1.5, 0],
        up: [0, 1, 0],
        focalMm: 35,
      })
    })
    await renderCameraPanel()

    expect(screen.getByRole('slider', { name: /Rotação Y/ })).toHaveValue('90')
    expect(screen.getByRole('slider', { name: /Rotação X/ })).toHaveValue('0')
  })

  it('girar pelo slider preserva a posição e a distância ao alvo', async () => {
    act(() => {
      useFiguresStore.getState().setSceneCamera({
        position: [0, 1.5, 5],
        target: [0, 1.5, 0],
        up: [0, 1, 0],
        focalMm: 35,
      })
    })
    await renderCameraPanel()

    fireEvent.change(screen.getByRole('slider', { name: /Rotação Y/ }), { target: { value: '90' } })

    const { sceneCamera } = useFiguresStore.getState()
    expect(sceneCamera.position).toEqual([0, 1.5, 5])
    expect(sceneCamera.target[0]).toBeCloseTo(-5, 4)
    expect(sceneCamera.target[2]).toBeCloseTo(5, 4)
    // Girar pelo painel não empilha undo: câmera fica fora do histórico.
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
  })
})

/**
 * Reorganização do painel (pedido do usuário, 2026-07-31): a inclinação sai do
 * bloco de enquadramento (era o único controle AO VIVO num bloco que espera o
 * "Aplicar"), as vistas prontas ganham bloco próprio (eram o segundo "Aplicar"
 * do mesmo fieldset) e as vistas ortográficas dizem no título que são da
 * bancada.
 */
describe('CameraPanel — ordem e seções', () => {
  beforeEach(() => {
    useCameraStore.setState(useCameraStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('a inclinação mora com a lente, e não no bloco de enquadramento', async () => {
    render(<CameraPanel />)
    await act(async () => {})

    const lente = screen.getByRole('group', { name: 'Lente e inclinação' })
    expect(within(lente).getByRole('slider')).toBeInTheDocument()
    expect(within(lente).getByRole('button', { name: 'Endireitar' })).toBeInTheDocument()
  })

  it('enquadramento e vistas prontas são blocos separados, um Aplicar em cada', async () => {
    render(<CameraPanel />)
    await act(async () => {})

    const enquadramento = screen.getByRole('group', { name: 'Enquadramento' })
    expect(within(enquadramento).getByRole('button', { name: 'Aplicar enquadramento' })).toBeInTheDocument()
    expect(within(enquadramento).queryByRole('button', { name: 'Aplicar vista' })).not.toBeInTheDocument()

    // "Vistas prontas" nasce recolhida — o botão do bloco existe, o conteúdo não.
    expect(screen.getByRole('button', { name: 'Vistas prontas' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByRole('button', { name: 'Aplicar vista' })).not.toBeInTheDocument()
  })

  it('as quatro seções ocasionais nascem recolhidas; o enquadramento, aberto', async () => {
    render(<CameraPanel />)
    await act(async () => {})

    expect(screen.getByRole('button', { name: 'Enquadramento' })).toHaveAttribute('aria-expanded', 'true')
    for (const titulo of ['Vistas prontas', 'Movimento', 'Bancada: vistas ortográficas', 'Bookmarks']) {
      expect(screen.getByRole('button', { name: titulo })).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.queryByRole('button', { name: 'Voltar à perspectiva' })).not.toBeInTheDocument()
  })
})
