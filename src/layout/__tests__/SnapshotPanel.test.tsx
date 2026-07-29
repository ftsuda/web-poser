import '../../i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFiguresStore } from '../../store/figuresStore'
import { useSnapshotCaptureStore } from '../../store/snapshotCaptureStore'
import { SnapshotPanel } from '../SnapshotPanel'

async function renderSnapshotPanel() {
  const utils = render(<SnapshotPanel />)
  await act(async () => {})
  return utils
}

describe('SnapshotPanel', () => {
  beforeEach(() => {
    useSnapshotCaptureStore.setState(useSnapshotCaptureStore.getInitialState())
    useFiguresStore.setState(useFiguresStore.getInitialState())
  })

  it('shows the panel title and the Full HD resolution selected by default', async () => {
    await renderSnapshotPanel()
    expect(screen.getByRole('heading', { name: 'Instantâneos' })).toBeInTheDocument()
    expect(screen.getByLabelText('Resolução')).toHaveValue('fullHD')
  })

  it('changing the resolution preset updates the store', async () => {
    const user = userEvent.setup()
    await renderSnapshotPanel()

    await user.selectOptions(screen.getByLabelText('Resolução'), 'square')

    expect(useSnapshotCaptureStore.getState().width).toBe(1080)
    expect(useSnapshotCaptureStore.getState().height).toBe(1080)
  })

  it('shows custom width/height fields only when the custom preset is selected', async () => {
    const user = userEvent.setup()
    await renderSnapshotPanel()

    expect(screen.queryByLabelText('Largura (px)')).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Resolução'), 'custom')
    expect(screen.getByLabelText('Largura (px)')).toBeInTheDocument()
    expect(screen.getByLabelText('Altura (px)')).toBeInTheDocument()

    const widthInput = screen.getByLabelText('Largura (px)')
    await user.clear(widthInput)
    await user.type(widthInput, '800')
    await user.tab()

    expect(useSnapshotCaptureStore.getState().width).toBe(800)
  })

  it('toggles hiding grid/gizmos on capture, checked by default', async () => {
    const user = userEvent.setup()
    await renderSnapshotPanel()

    const checkbox = screen.getByLabelText('Ocultar grade/gizmos/junta na captura')
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(useSnapshotCaptureStore.getState().hideOverlaysOnCapture).toBe(false)
  })

  it('requests a capture when the capture button is clicked', async () => {
    const user = userEvent.setup()
    await renderSnapshotPanel()

    await user.click(screen.getByRole('button', { name: 'Capturar instantâneo' }))
    expect(useSnapshotCaptureStore.getState().pendingCapture).toBe(true)
  })

  it('shows feedback with the last captured filename', async () => {
    useSnapshotCaptureStore.getState().setLastCapturedFilename('Cena-1_kf001.png')
    await renderSnapshotPanel()

    expect(screen.getByText('Último instantâneo: Cena-1_kf001.png')).toBeInTheDocument()
  })

  describe('when File System Access API is unavailable (e.g. Firefox, or this jsdom test environment)', () => {
    it('hides the "choose folder" button and explains captures will download instead', async () => {
      await renderSnapshotPanel()
      expect(screen.queryByRole('button', { name: 'Escolher pasta de destino' })).not.toBeInTheDocument()
      expect(
        screen.getByText("Este navegador não suporta escolher pasta — as capturas serão baixadas."),
      ).toBeInTheDocument()
    })
  })

  describe('when File System Access API is available', () => {
    const originalShowDirectoryPicker = window.showDirectoryPicker

    afterEach(() => {
      window.showDirectoryPicker = originalShowDirectoryPicker
    })

    it('lets the user pick a directory and shows its name once chosen', async () => {
      const fakeHandle = { name: 'keyframes', kind: 'directory' } as unknown as FileSystemDirectoryHandle
      window.showDirectoryPicker = vi.fn().mockResolvedValue(fakeHandle)

      const user = userEvent.setup()
      await renderSnapshotPanel()

      expect(screen.getByText('Nenhuma pasta escolhida — as capturas serão baixadas.')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Escolher pasta de destino' }))

      expect(await screen.findByText('Pasta: keyframes')).toBeInTheDocument()
      expect(useSnapshotCaptureStore.getState().directoryHandle).toBe(fakeHandle)
    })
  })
})
