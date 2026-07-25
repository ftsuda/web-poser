import '../../i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useCameraStore } from '../../store/cameraStore'
import { useFiguresStore } from '../../store/figuresStore'
import { CameraPanel } from '../CameraPanel'

// `importOriginal` preserva `SceneFileError` real (usado por `instanceof`).
vi.mock('../../persistence/sceneFile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../persistence/sceneFile')>()),
  exportCameraBookmarksToGlb: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
  importCameraBookmarksFromGlb: vi.fn(),
}))
vi.mock('../../persistence/fileIO', () => ({
  writeFileToDirectoryOrDownload: vi.fn().mockResolvedValue(undefined),
  pickFile: vi.fn(),
}))

import {
  SceneFileError,
  exportCameraBookmarksToGlb,
  importCameraBookmarksFromGlb,
} from '../../persistence/sceneFile'
import { pickFile, writeFileToDirectoryOrDownload } from '../../persistence/fileIO'

async function renderCameraPanel() {
  const utils = render(<CameraPanel />)
  await act(async () => {})
  return utils
}

describe('CameraPanel', () => {
  beforeEach(() => {
    useCameraStore.setState(useCameraStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    vi.mocked(exportCameraBookmarksToGlb).mockClear()
    vi.mocked(importCameraBookmarksFromGlb).mockReset()
    vi.mocked(pickFile).mockReset()
    vi.mocked(writeFileToDirectoryOrDownload).mockClear()
  })

  it('shows the panel title and a FOV field bound to the camera store', async () => {
    await renderCameraPanel()
    expect(screen.getByRole('heading', { name: 'Câmera' })).toBeInTheDocument()
    expect(screen.getByLabelText('Campo de visão (°)')).toHaveValue(useCameraStore.getState().fov)
  })

  it('updates the FOV in the store when the field changes', async () => {
    const user = userEvent.setup()
    await renderCameraPanel()

    const fovInput = screen.getByLabelText('Campo de visão (°)')
    await user.clear(fovInput)
    await user.type(fovInput, '70')
    await user.tab()

    expect(useCameraStore.getState().fov).toBe(70)
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
      name: 'Plano geral',
      position: [3, 2, 4],
      target: [0, 1, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })
    await renderCameraPanel()

    expect(screen.getByText('Plano geral')).toBeInTheDocument()

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

  it('exports the saved camera bookmarks as a .glb download', async () => {
    useFiguresStore.getState().addCameraBookmark({
      name: 'Plano geral',
      position: [3, 2, 4],
      target: [0, 1, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })
    const user = userEvent.setup()
    await renderCameraPanel()

    await user.click(screen.getByRole('button', { name: 'Exportar bookmarks (.glb)' }))

    expect(vi.mocked(exportCameraBookmarksToGlb)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(exportCameraBookmarksToGlb).mock.calls[0][0]).toHaveLength(1)
    expect(vi.mocked(writeFileToDirectoryOrDownload)).toHaveBeenCalledTimes(1)
    const [directoryHandle, filename] = vi.mocked(writeFileToDirectoryOrDownload).mock.calls[0]
    expect(directoryHandle).toBeNull()
    expect(filename).toMatch(/\.glb$/)
  })

  it('imports camera bookmarks from a picked .glb file, adding them to the existing list', async () => {
    useFiguresStore.getState().addCameraBookmark({
      name: 'Vista A',
      position: [1, 1, 1],
      target: [0, 0, 0],
      projection: 'perspective',
      fov: 50,
      zoom: 1,
    })
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'bookmarks.glb'), data: new ArrayBuffer(4) })
    vi.mocked(importCameraBookmarksFromGlb).mockResolvedValue([
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
    await user.click(screen.getByRole('button', { name: 'Importar bookmarks (.glb)' }))

    await vi.waitFor(() => {
      expect(useFiguresStore.getState().cameraBookmarks.map((b) => b.name)).toEqual(['Vista A', 'Vista B'])
    })
  })
})

describe('CameraPanel — erro de importação (fase 9, item 4)', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    vi.mocked(importCameraBookmarksFromGlb).mockReset()
    vi.mocked(pickFile).mockReset()
  })

  it('avisa quando o .glb de bookmarks não tem os dados do app', async () => {
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'x.glb'), data: new ArrayBuffer(4) })
    vi.mocked(importCameraBookmarksFromGlb).mockRejectedValue(new SceneFileError('missingAppData'))

    const user = userEvent.setup()
    await renderCameraPanel()
    await user.click(screen.getByRole('button', { name: 'Importar bookmarks (.glb)' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('não contém os dados do Virtual Mockup')
    expect(useFiguresStore.getState().cameraBookmarks).toHaveLength(0)
  })
})
