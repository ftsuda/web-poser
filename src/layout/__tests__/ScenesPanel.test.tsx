import '../../i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFiguresStore } from '../../store/figuresStore'
import { ScenesPanel } from '../ScenesPanel'

vi.mock('../../persistence/sceneFile', () => ({
  exportSceneToGlb: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
  importSceneFromGlb: vi.fn(),
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

import { importSceneFromGlb, exportSceneToGlb } from '../../persistence/sceneFile'
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
    vi.mocked(exportSceneToGlb).mockClear()
    vi.mocked(importSceneFromGlb).mockReset()
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

  it('exports the current working scene as a .glb download', async () => {
    useFiguresStore.getState().addFigure()
    const user = userEvent.setup()
    await renderScenesPanel()

    await user.click(screen.getByRole('button', { name: 'Exportar cena atual (.glb)' }))

    expect(vi.mocked(exportSceneToGlb)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(writeFileToDirectoryOrDownload)).toHaveBeenCalledTimes(1)
    const [directoryHandle, filename] = vi.mocked(writeFileToDirectoryOrDownload).mock.calls[0]
    expect(directoryHandle).toBeNull()
    expect(filename).toMatch(/\.glb$/)
  })

  it('imports a scene from a picked .glb file and replaces the working scene', async () => {
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'cena.glb'), data: new ArrayBuffer(4) })
    vi.mocked(importSceneFromGlb).mockResolvedValue({
      name: 'Cena importada',
      figures: [],
      nextFigureSeq: 1,
      environment: { background: 'medium', grid: true },
      cameraBookmarks: [],
      nextCameraBookmarkSeq: 1,
      nextKeyframeNumber: 1,
    })

    const user = userEvent.setup()
    await renderScenesPanel()
    await user.click(screen.getByRole('button', { name: 'Importar cena (.glb)' }))

    await vi.waitFor(() => {
      expect(useFiguresStore.getState().sceneName).toBe('Cena importada')
    })
  })

  it('does nothing when the user cancels the file picker', async () => {
    vi.mocked(pickFile).mockResolvedValue(null)
    const user = userEvent.setup()
    await renderScenesPanel()

    await user.click(screen.getByRole('button', { name: 'Importar cena (.glb)' }))
    expect(vi.mocked(importSceneFromGlb)).not.toHaveBeenCalled()
  })

  describe('workspace em pasta — sem File System Access API (fallback)', () => {
    it('hides the folder buttons and shows the fallback hint', async () => {
      await renderScenesPanel()
      expect(screen.queryByRole('button', { name: 'Salvar workspace em pasta' })).not.toBeInTheDocument()
      expect(
        screen.getByText(
          'Este navegador não suporta escolher pasta — use os arquivos individuais (workspace.json + joint-limits.json + .glb) para abrir um workspace salvo.',
        ),
      ).toBeInTheDocument()
    })

    it('opens a workspace from a set of picked files (workspace.json + .glb)', async () => {
      vi.mocked(pickMultipleFiles).mockResolvedValue([new File([], 'workspace.json')])
      vi.mocked(loadWorkspaceFromFiles).mockResolvedValue({
        scenes: [
          {
            id: 'scene-1',
            name: 'Cena da pasta',
            data: {
              figures: [],
              nextFigureSeq: 1,
              environment: { background: 'medium', grid: true },
              cameraBookmarks: [],
              nextCameraBookmarkSeq: 1,
              nextKeyframeNumber: 1,
            },
          },
        ],
        activeSceneId: 'scene-1',
        jointLimits: {},
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
              environment: { background: 'medium', grid: true },
              cameraBookmarks: [],
              nextCameraBookmarkSeq: 1,
              nextKeyframeNumber: 1,
            },
          },
        ],
        activeSceneId: 'scene-1',
        jointLimits: {},
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
