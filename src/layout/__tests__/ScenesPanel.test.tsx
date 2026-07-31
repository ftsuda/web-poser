import '../../i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
import { useDepthStore } from '../../store/depthStore'
import { useFiguresStore } from '../../store/figuresStore'
import { useUIStore } from '../../store/uiStore'
import { ScenesPanel } from '../ScenesPanel'

// `importOriginal` preserva `SceneFileError` (classe real) — o painel usa
// `instanceof` para escolher a mensagem de erro (fase 9, item 4).
vi.mock('../../persistence/sceneFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../persistence/sceneFile')>()),
  serializeSceneFile: vi.fn().mockReturnValue('{}'),
  parseSceneFile: vi.fn(),
}))
vi.mock('../../persistence/fileIO', () => ({
  writeFileToDirectoryOrDownload: vi.fn().mockResolvedValue(undefined),
  pickFile: vi.fn(),
  pickMultipleFiles: vi.fn(),
  isFileSystemAccessAvailable: vi.fn(() => typeof window !== 'undefined' && 'showDirectoryPicker' in window),
}))
vi.mock('../../persistence/workspaceFolder', () => ({
  saveWorkspaceToDirectory: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceFromDirectory: vi.fn(),
  loadWorkspaceFromFiles: vi.fn(),
}))

import { SceneFileError, parseSceneFile, serializeSceneFile } from '../../persistence/sceneFile'
import { isFileSystemAccessAvailable, pickFile, pickMultipleFiles, writeFileToDirectoryOrDownload } from '../../persistence/fileIO'
import { loadWorkspaceFromDirectory, loadWorkspaceFromFiles, saveWorkspaceToDirectory } from '../../persistence/workspaceFolder'

async function renderScenesPanel() {
  const utils = render(<ScenesPanel />)
  await act(async () => {})
  return utils
}

describe('ScenesPanel', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    vi.mocked(serializeSceneFile).mockClear()
    vi.mocked(parseSceneFile).mockReset()
    vi.mocked(pickFile).mockReset()
    vi.mocked(writeFileToDirectoryOrDownload).mockClear()
    vi.mocked(pickMultipleFiles).mockReset()
    vi.mocked(saveWorkspaceToDirectory).mockClear()
    vi.mocked(loadWorkspaceFromDirectory).mockReset()
    vi.mocked(loadWorkspaceFromFiles).mockReset()
    vi.mocked(isFileSystemAccessAvailable).mockReturnValue(false)
  })

  it('shows the empty state when there are no saved snapshots', async () => {
    await renderScenesPanel()
    expect(screen.getByRole('heading', { name: 'Cenas' })).toBeInTheDocument()
    expect(screen.getByText('Nenhuma cena salva ainda.')).toBeInTheDocument()
  })

  it('saves the current scene as a new named snapshot', async () => {
    const user = userEvent.setup()
    await renderScenesPanel()

    await user.click(screen.getByRole('button', { name: 'Salvar cena atual como snapshot' }))
    const input = screen.getByLabelText('Nome da cena')
    await user.clear(input)
    await user.type(input, 'Pose final')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    const state = useFiguresStore.getState()
    expect(state.scenes).toHaveLength(1)
    expect(state.scenes[0].name).toBe('Pose final')
  })

  it('lists saved snapshots and loads one on click', async () => {
    useFiguresStore.getState().addFigure()
    const id = useFiguresStore.getState().saveSceneSnapshot('Cena A')
    useFiguresStore.getState().addFigure()

    const user = userEvent.setup()
    await renderScenesPanel()

    expect(screen.getByText('Cena A')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Carregar esta cena' }))

    expect(useFiguresStore.getState().activeSceneId).toBe(id)
    expect(useFiguresStore.getState().figures).toHaveLength(1)
  })

  it('removes a saved snapshot', async () => {
    useFiguresStore.getState().saveSceneSnapshot('Cena A')
    const user = userEvent.setup()
    await renderScenesPanel()

    await user.click(screen.getByRole('button', { name: 'Remover cena' }))
    expect(useFiguresStore.getState().scenes).toHaveLength(0)
  })

  it('exports the current working scene as a .json download', async () => {
    useFiguresStore.getState().addFigure()
    const user = userEvent.setup()
    await renderScenesPanel()

    await user.click(screen.getByRole('button', { name: 'Exportar cena atual (.json)' }))

    expect(vi.mocked(serializeSceneFile)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(writeFileToDirectoryOrDownload)).toHaveBeenCalledTimes(1)
    const [directoryHandle, filename] = vi.mocked(writeFileToDirectoryOrDownload).mock.calls[0]
    expect(directoryHandle).toBeNull()
    expect(filename).toMatch(/\.json$/)
  })

  it('imports a scene from a picked .json file and replaces the working scene', async () => {
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'cena.json'), data: new ArrayBuffer(4) })
    vi.mocked(parseSceneFile).mockReturnValue({
      name: 'Cena importada',
      figures: [],
      nextFigureSeq: 1,
      props: [],
      nextPropSeq: 1,
      environment: { background: 'medium', grid: true },
      cameraBookmarks: [],
      nextCameraBookmarkSeq: 1,
      nextSnapshotNumber: 1,
      sceneCamera: DEFAULT_SCENE_CAMERA,
    })

    const user = userEvent.setup()
    await renderScenesPanel()
    await user.click(screen.getByRole('button', { name: 'Importar cena (.json)' }))

    await vi.waitFor(() => {
      expect(useFiguresStore.getState().sceneName).toBe('Cena importada')
    })
  })

  it('shows an error and keeps the current scene when the file is corrupted (fase 9, item 4)', async () => {
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'ruim.json'), data: new ArrayBuffer(4) })
    vi.mocked(parseSceneFile).mockImplementation(() => { throw new SceneFileError('unreadable') })

    const user = userEvent.setup()
    await renderScenesPanel()
    await user.click(screen.getByRole('button', { name: 'Importar cena (.json)' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Arquivo não pôde ser lido — o conteúdo não é um JSON válido (arquivo corrompido ou truncado).')
    expect(useFiguresStore.getState().sceneName).toBe('Cena 1')
  })

  it('explains when the file has no app data instead of wiping the scene (fase 9, item 4)', async () => {
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'blender.json'), data: new ArrayBuffer(4) })
    vi.mocked(parseSceneFile).mockImplementation(() => { throw new SceneFileError('missingAppData') })

    const user = userEvent.setup()
    await renderScenesPanel()
    await user.click(screen.getByRole('button', { name: 'Importar cena (.json)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O arquivo é um JSON válido, mas não é do Virtual Mockup — falta o campo "version" que todo arquivo do aplicativo grava.',
    )
  })

  it('clears the error message after a successful import (fase 9, item 4)', async () => {
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'x.json'), data: new ArrayBuffer(4) })
    vi.mocked(parseSceneFile).mockImplementationOnce(() => { throw new SceneFileError('unreadable') }).mockReturnValueOnce({
      name: 'Cena importada',
      figures: [],
      nextFigureSeq: 1,
      props: [],
      nextPropSeq: 1,
      environment: { background: 'medium', grid: true },
      cameraBookmarks: [],
      nextCameraBookmarkSeq: 1,
      nextSnapshotNumber: 1,
      sceneCamera: DEFAULT_SCENE_CAMERA,
    })

    const user = userEvent.setup()
    await renderScenesPanel()
    const button = screen.getByRole('button', { name: 'Importar cena (.json)' })

    await user.click(button)
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(button)
    await vi.waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(useFiguresStore.getState().sceneName).toBe('Cena importada')
  })

  it('does nothing when the user cancels the file picker', async () => {
    vi.mocked(pickFile).mockResolvedValue(null)
    const user = userEvent.setup()
    await renderScenesPanel()

    await user.click(screen.getByRole('button', { name: 'Importar cena (.json)' }))
    expect(vi.mocked(parseSceneFile)).not.toHaveBeenCalled()
  })

  describe('workspace em pasta — sem File System Access API (fallback)', () => {
    it('hides the folder buttons and shows the fallback hint', async () => {
      await renderScenesPanel()
      expect(screen.queryByRole('button', { name: 'Salvar workspace em pasta' })).not.toBeInTheDocument()
      expect(
        screen.getByText(
          'Este navegador não suporta escolher pasta — selecione os arquivos individuais (workspace.json + os .json das cenas + joint-limits.json + poses.json) para abrir um workspace salvo.',
        ),
      ).toBeInTheDocument()
    })

    it('opens a workspace from a set of picked files (workspace.json + scene .json)', async () => {
      vi.mocked(pickMultipleFiles).mockResolvedValue([new File([], 'workspace.json')])
      vi.mocked(loadWorkspaceFromFiles).mockResolvedValue({
        scenes: [
          {
            id: 'scene-1',
            name: 'Cena da pasta',
            data: {
              figures: [],
              nextFigureSeq: 1,
              props: [],
              nextPropSeq: 1,
              environment: { background: 'medium', grid: true },
              cameraBookmarks: [],
              nextCameraBookmarkSeq: 1,
              nextSnapshotNumber: 1,
              sceneCamera: DEFAULT_SCENE_CAMERA,
            },
          },
        ],
        activeSceneId: 'scene-1',
        jointLimits: {},
        poses: [],
        animations: [],
        clips: [],
      })

      const user = userEvent.setup()
      await renderScenesPanel()
      await user.click(screen.getByRole('button', { name: 'Abrir workspace de pasta' }))

      await vi.waitFor(() => {
        expect(useFiguresStore.getState().scenes).toHaveLength(1)
        expect(useFiguresStore.getState().activeSceneId).toBe('scene-1')
      })
    })

    it('aplica os limites articulares que vieram no workspace (DECISOES.md #29)', async () => {
      vi.mocked(pickMultipleFiles).mockResolvedValue([new File([], 'workspace.json')])
      vi.mocked(loadWorkspaceFromFiles).mockResolvedValue({
        scenes: [],
        activeSceneId: null,
        jointLimits: { 'knee.L': { x: { min: 0, max: 45 } } },
        poses: [],
        animations: [],
        clips: [],
      })

      const user = userEvent.setup()
      await renderScenesPanel()
      await user.click(screen.getByRole('button', { name: 'Abrir workspace de pasta' }))

      expect(
        await screen.findByText('Limites articulares customizados por este workspace em 1 junta (joint-limits.json).'),
      ).toBeInTheDocument()
      expect(useFiguresStore.getState().jointLimits).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
    })

    it('restaura os limites padrão pelo botão, sem precisar editar o JSON', async () => {
      const user = userEvent.setup()
      await renderScenesPanel()
      act(() => {
        useFiguresStore.getState().applyJointLimits({ 'knee.L': { x: { min: 0, max: 45 } } })
      })

      await user.click(screen.getByRole('button', { name: 'Restaurar limites padrão' }))

      expect(useFiguresStore.getState().jointLimits).toEqual({})
      expect(screen.queryByRole('button', { name: 'Restaurar limites padrão' })).not.toBeInTheDocument()
    })

    it('não mostra nada sobre limites quando valem os padrões do código', async () => {
      await renderScenesPanel()
      expect(screen.queryByRole('button', { name: 'Restaurar limites padrão' })).not.toBeInTheDocument()
    })
  })

  describe('workspace em pasta — com File System Access API', () => {
    const originalShowDirectoryPicker = window.showDirectoryPicker

    beforeEach(() => {
      vi.mocked(isFileSystemAccessAvailable).mockReturnValue(true)
    })

    afterEach(() => {
      window.showDirectoryPicker = originalShowDirectoryPicker
    })

    it('picks a folder and saves the workspace into it', async () => {
      const fakeHandle = { name: 'meu-workspace' } as unknown as FileSystemDirectoryHandle
      window.showDirectoryPicker = vi.fn().mockResolvedValue(fakeHandle)
      useFiguresStore.getState().saveSceneSnapshot('Cena A')

      const user = userEvent.setup()
      await renderScenesPanel()
      await user.click(screen.getByRole('button', { name: 'Salvar workspace em pasta' }))

      expect(await screen.findByText('Pasta do workspace: meu-workspace')).toBeInTheDocument()
      expect(vi.mocked(saveWorkspaceToDirectory)).toHaveBeenCalledTimes(1)
    })

    it('picks a folder and loads the workspace from it', async () => {
      const fakeHandle = { name: 'meu-workspace' } as unknown as FileSystemDirectoryHandle
      window.showDirectoryPicker = vi.fn().mockResolvedValue(fakeHandle)
      vi.mocked(loadWorkspaceFromDirectory).mockResolvedValue({
        scenes: [
          {
            id: 'scene-1',
            name: 'Cena da pasta',
            data: {
              figures: [],
              nextFigureSeq: 1,
              props: [],
              nextPropSeq: 1,
              environment: { background: 'medium', grid: true },
              cameraBookmarks: [],
              nextCameraBookmarkSeq: 1,
              nextSnapshotNumber: 1,
              sceneCamera: DEFAULT_SCENE_CAMERA,
            },
          },
        ],
        activeSceneId: 'scene-1',
        jointLimits: {},
        poses: [],
        animations: [],
        clips: [],
      })

      const user = userEvent.setup()
      await renderScenesPanel()
      await user.click(screen.getByRole('button', { name: 'Abrir workspace de pasta' }))

      await vi.waitFor(() => {
        expect(useFiguresStore.getState().scenes).toHaveLength(1)
      })
    })
  })
})

describe('ScenesPanel — novo workspace (fase 9, item 7)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    vi.mocked(isFileSystemAccessAvailable).mockReturnValue(false)
  })

  it('pede confirmação antes de limpar e não faz nada se cancelado', async () => {
    useFiguresStore.getState().addFigure('Herói')
    useFiguresStore.getState().saveSceneSnapshot('Cena salva')

    const user = userEvent.setup()
    await renderScenesPanel()
    await user.click(screen.getByRole('button', { name: 'Novo workspace (limpar tudo)' }))

    expect(screen.getByText(/Isto apaga todos os bonecos/)).toBeInTheDocument()
    expect(useFiguresStore.getState().figures).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(useFiguresStore.getState().figures).toHaveLength(1)
    expect(useFiguresStore.getState().scenes).toHaveLength(1)
  })

  it('limpa todo o ambiente ao confirmar', async () => {
    useFiguresStore.getState().addFigure('Herói')
    useFiguresStore.getState().saveSceneSnapshot('Cena salva')

    const user = userEvent.setup()
    await renderScenesPanel()
    await user.click(screen.getByRole('button', { name: 'Novo workspace (limpar tudo)' }))
    await user.click(screen.getByRole('button', { name: 'Limpar tudo' }))

    expect(useFiguresStore.getState().figures).toHaveLength(0)
    expect(useFiguresStore.getState().scenes).toHaveLength(0)
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
    expect(screen.getByText('Nenhuma cena salva ainda.')).toBeInTheDocument()
  })
})

/**
 * Fase 13 — a faixa do mapa de profundidade (perto/longe) é COMPARTILHADA
 * pelas três saídas, então mora aqui, na seção de Configurações do painel de
 * Cenas, e não dentro de uma delas.
 */
describe('ScenesPanel — Configurações', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useDepthStore.setState(useDepthStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
  })

  // Regra do #83: seção nova nasce recolhida — as exceções são "poses" e
  // "cameraFraming".
  it('nasce recolhida e abre no clique', async () => {
    const user = userEvent.setup()
    await renderScenesPanel()

    expect(screen.queryByLabelText('Perto (m)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Configurações' }))
    expect(useUIStore.getState().collapsedSections.sceneSettings).toBe(false)
    expect(screen.getByLabelText('Perto (m)')).toBeInTheDocument()
  })

  it('a faixa nasce automática, e travá-la libera os campos de perto/longe', async () => {
    useUIStore.setState((state) => ({
      collapsedSections: { ...state.collapsedSections, sceneSettings: false },
    }))
    const user = userEvent.setup()
    await renderScenesPanel()

    const automatica = screen.getByLabelText('Faixa automática (pelos bonecos e objetos)')
    expect(automatica).toBeChecked()
    expect(screen.getByLabelText('Perto (m)')).toBeDisabled()

    await user.click(automatica)
    expect(useDepthStore.getState().autoRange).toBe(false)
    expect(screen.getByLabelText('Perto (m)')).toBeEnabled()
  })

  /**
   * O chão fora da conta da faixa vira uma cunha branca chapada em primeiro
   * plano, disputando o branco com a superfície mais próxima do boneco. O
   * recorte pela faixa é o padrão; os outros dois valores continuam à mão.
   */
  it('escolhe o que o chão faz no mapa, recortado por padrão', async () => {
    useUIStore.setState((state) => ({
      collapsedSections: { ...state.collapsedSections, sceneSettings: false },
    }))
    const user = userEvent.setup()
    await renderScenesPanel()

    const select = screen.getByLabelText('Chão no mapa')
    expect(select).toHaveValue('clipped')

    await user.selectOptions(select, 'hidden')
    expect(useDepthStore.getState().groundMode).toBe('hidden')
  })

  it('comita perto e longe no blur, como os demais numéricos do projeto', async () => {
    useUIStore.setState((state) => ({
      collapsedSections: { ...state.collapsedSections, sceneSettings: false },
    }))
    useDepthStore.setState({ autoRange: false })
    const user = userEvent.setup()
    await renderScenesPanel()

    const perto = screen.getByLabelText('Perto (m)')
    await user.clear(perto)
    await user.type(perto, '3')
    await user.tab()

    expect(useDepthStore.getState().nearM).toBe(3)
  })
})
