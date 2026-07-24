import '../../i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { COLOR_PALETTE, MAX_FIGURES, useFiguresStore } from '../../store/figuresStore'
import { FiguresPanel } from '../FiguresPanel'

vi.mock('../../persistence/sceneFile', () => ({
  exportFigureToGlb: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
  importFigureFromGlb: vi.fn(),
}))
vi.mock('../../persistence/fileIO', () => ({
  writeFileToDirectoryOrDownload: vi.fn().mockResolvedValue(undefined),
  pickFile: vi.fn(),
}))

import { exportFigureToGlb, importFigureFromGlb } from '../../persistence/sceneFile'
import { pickFile, writeFileToDirectoryOrDownload } from '../../persistence/fileIO'

async function renderFiguresPanel() {
  const utils = render(<FiguresPanel />)
  await act(async () => {})
  return utils
}

describe('FiguresPanel', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    vi.mocked(exportFigureToGlb).mockClear()
    vi.mocked(importFigureFromGlb).mockReset()
    vi.mocked(pickFile).mockReset()
    vi.mocked(writeFileToDirectoryOrDownload).mockClear()
  })

  it('shows the empty-state message when there are no figures', async () => {
    await renderFiguresPanel()
    expect(screen.getByRole('heading', { name: 'Bonecos' })).toBeInTheDocument()
    expect(screen.getByText('Nenhum boneco na cena ainda.')).toBeInTheDocument()
  })

  it('adds a figure to the store and lists it', async () => {
    const user = userEvent.setup()
    await renderFiguresPanel()

    await user.click(screen.getByRole('button', { name: 'Adicionar boneco' }))

    expect(useFiguresStore.getState().figures).toHaveLength(1)
    expect(screen.getByDisplayValue('Boneco 1')).toBeInTheDocument()
  })

  it('disables the add button once the 5-figure limit is reached', async () => {
    const user = userEvent.setup()
    await renderFiguresPanel()

    const addButton = screen.getByRole('button', { name: 'Adicionar boneco' })
    for (let i = 0; i < MAX_FIGURES; i += 1) {
      await user.click(addButton)
    }

    expect(useFiguresStore.getState().figures).toHaveLength(MAX_FIGURES)
    expect(addButton).toBeDisabled()
  })

  it('removes a figure from the store', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure('Herói')
    await renderFiguresPanel()

    await user.click(screen.getByRole('button', { name: 'Remover boneco' }))

    expect(useFiguresStore.getState().figures).toHaveLength(0)
  })

  it('selects a figure when its row is clicked', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure('Herói') as string
    await renderFiguresPanel()

    await user.click(screen.getByRole('listitem'))

    expect(useFiguresStore.getState().selectedFigureId).toBe(id)
  })

  it('renames a figure through the name field', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure('Herói') as string
    await renderFiguresPanel()

    const nameInput = screen.getByDisplayValue('Herói')
    await user.clear(nameInput)
    await user.type(nameInput, 'Vilão')

    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.name).toBe('Vilão')
  })

  it('toggles figure visibility', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure('Herói') as string
    await renderFiguresPanel()

    const visibilityToggle = screen.getByRole('checkbox', { name: 'Ocultar boneco' })
    await user.click(visibilityToggle)

    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.visible).toBe(false)
  })

  it('changes height through the height slider', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure('Herói') as string
    await renderFiguresPanel()

    const heightInput = screen.getByLabelText('Altura')
    await user.clear(heightInput)
    await user.type(heightInput, '1.85')
    await user.tab()

    expect(useFiguresStore.getState().figures.find((f) => f.id === id)?.height).toBeCloseTo(1.85, 2)
  })

  it('cycles to the next unused palette color when the swatch is clicked', async () => {
    const user = userEvent.setup()
    const id = useFiguresStore.getState().addFigure('Herói') as string
    await renderFiguresPanel()

    await user.click(screen.getByRole('button', { name: 'Trocar cor' }))

    const color = useFiguresStore.getState().figures.find((f) => f.id === id)?.color
    expect(color).toBe(COLOR_PALETTE[1])
  })

  it('duplicates a figure, copying its pose and height, when the duplicate button is clicked', async () => {
    const user = userEvent.setup()
    useFiguresStore.getState().addFigure('Herói')
    await renderFiguresPanel()

    await user.click(screen.getByRole('button', { name: 'Duplicar boneco' }))

    expect(useFiguresStore.getState().figures).toHaveLength(2)
  })

  it('disables the duplicate button once the 5-figure limit is reached', async () => {
    const { addFigure } = useFiguresStore.getState()
    for (let i = 0; i < MAX_FIGURES; i += 1) addFigure()
    await renderFiguresPanel()

    const duplicateButtons = screen.getAllByRole('button', { name: 'Duplicar boneco' })
    for (const button of duplicateButtons) {
      expect(button).toBeDisabled()
    }
  })

  it('exports a figure as a .glb download when its export button is clicked', async () => {
    useFiguresStore.getState().addFigure('Herói')
    const user = userEvent.setup()
    await renderFiguresPanel()

    await user.click(screen.getByRole('button', { name: 'Exportar boneco (.glb)' }))

    expect(vi.mocked(exportFigureToGlb)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(writeFileToDirectoryOrDownload)).toHaveBeenCalledTimes(1)
    const [directoryHandle, filename] = vi.mocked(writeFileToDirectoryOrDownload).mock.calls[0]
    expect(directoryHandle).toBeNull()
    expect(filename).toMatch(/\.glb$/)
  })

  it('applies an imported figure to the currently selected figure, keeping its identity/position', async () => {
    const id = useFiguresStore.getState().addFigure('Original') as string
    useFiguresStore.getState().selectFigure(id)
    useFiguresStore.getState().setPosition(id, [5, 0, 5])

    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'boneco.glb'), data: new ArrayBuffer(4) })
    vi.mocked(importFigureFromGlb).mockResolvedValue({
      id: 'figure-imported',
      name: 'Boneco importado',
      color: '#4060e0',
      visible: true,
      height: 1.85,
      position: [0, 0, 0],
      rotation: { x: 0, y: 0, z: 0 },
      pose: { 'elbow.L': { x: 30, y: 0, z: 0 } },
    })

    const user = userEvent.setup()
    await renderFiguresPanel()
    await user.click(screen.getByRole('button', { name: 'Importar boneco (.glb)' }))

    await vi.waitFor(() => {
      const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
      expect(figure?.height).toBe(1.85)
      expect(figure?.pose['elbow.L']).toEqual({ x: 30, y: 0, z: 0 })
    })
    const figure = useFiguresStore.getState().figures.find((f) => f.id === id)
    expect(figure?.name).toBe('Original')
    expect(figure?.position).toEqual([5, 0, 5])
  })

  it('creates a new figure from an imported file when nothing is selected', async () => {
    vi.mocked(pickFile).mockResolvedValue({ file: new File([], 'boneco.glb'), data: new ArrayBuffer(4) })
    vi.mocked(importFigureFromGlb).mockResolvedValue({
      id: 'figure-imported',
      name: 'Boneco importado',
      color: '#4060e0',
      visible: true,
      height: 1.6,
      position: [1, 0, 1],
      rotation: { x: 0, y: 0, z: 0 },
      pose: {},
    })

    const user = userEvent.setup()
    await renderFiguresPanel()
    await user.click(screen.getByRole('button', { name: 'Importar boneco (.glb)' }))

    await vi.waitFor(() => {
      expect(useFiguresStore.getState().figures).toHaveLength(1)
    })
    expect(useFiguresStore.getState().figures[0].name).toBe('Boneco importado')
  })
})
