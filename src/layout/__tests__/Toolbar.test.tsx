import '../../i18n'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../i18n'
import { useFiguresStore } from '../../store/figuresStore'
import { useUIStore } from '../../store/uiStore'
import { Toolbar } from '../Toolbar'

// react-i18next subscreve ao i18n via useSyncExternalStore num efeito que só
// roda um tick após a montagem; um flush extra evita falso-positivo de "update
// fora do act()" quando esse efeito dispara entre a montagem e a asserção.
async function renderToolbar() {
  const utils = render(<Toolbar />)
  await act(async () => {})
  return utils
}

describe('Toolbar', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
    useUIStore.setState(useUIStore.getInitialState())
  })

  afterEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  it('shows the app title', async () => {
    await renderToolbar()
    expect(screen.getByRole('heading', { name: 'Virtual Mockup' })).toBeInTheDocument()
  })

  it('changes the background tone in the scene store', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const select = screen.getByLabelText('Fundo')
    await user.selectOptions(select, 'dark')

    expect(useFiguresStore.getState().environment.background).toBe('dark')
  })

  it('toggles grid visibility in the scene store', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const checkbox = screen.getByLabelText('Grade')
    expect(checkbox).toBeChecked()

    await user.click(checkbox)
    expect(useFiguresStore.getState().environment.grid).toBe(false)
  })

  it('shows the default scene name and renames it in the store', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const nameInput = screen.getByLabelText('Nome da cena')
    expect(nameInput).toHaveValue('Cena 1')

    await user.clear(nameInput)
    await user.type(nameInput, 'Praia ao pôr do sol')

    expect(useFiguresStore.getState().sceneName).toBe('Praia ao pôr do sol')
  })

  it('opens the shortcuts help panel from a visible button (fase 9, item 1)', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    expect(useUIStore.getState().helpVisible).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Atalhos de teclado (?)' }))
    expect(useUIStore.getState().helpVisible).toBe(true)
  })

  it('undoes and redoes from toolbar buttons, disabled when there is no history (fase 9, item 3)', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const undo = screen.getByRole('button', { name: 'Desfazer (Ctrl+Z)' })
    const redo = screen.getByRole('button', { name: 'Refazer (Ctrl+Shift+Z)' })
    expect(undo).toBeDisabled()
    expect(redo).toBeDisabled()

    act(() => {
      useFiguresStore.getState().addFigure()
    })
    expect(useFiguresStore.getState().figures).toHaveLength(1)
    await waitFor(() => expect(undo).toBeEnabled())

    await user.click(undo)
    expect(useFiguresStore.getState().figures).toHaveLength(0)

    await waitFor(() => expect(redo).toBeEnabled())
    await user.click(redo)
    expect(useFiguresStore.getState().figures).toHaveLength(1)
  })

  it('shows the autosave status (fase 9, item 2)', async () => {
    await renderToolbar()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Ainda não salvo')

    act(() => {
      useUIStore.getState().markAutosavePending()
    })
    expect(status).toHaveTextContent('Salvando…')

    act(() => {
      useUIStore.getState().markAutosaveSaved(new Date(2026, 6, 25, 14, 5).getTime())
    })
    expect(status).toHaveTextContent(/Salvo às 14:05/)

    act(() => {
      useUIStore.getState().markAutosaveFailed()
    })
    expect(status).toHaveTextContent('Falha ao salvar')
  })

  it('switches the UI language', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const languageSelect = screen.getByLabelText('Idioma')
    await user.selectOptions(languageSelect, 'en')

    await waitFor(() => expect(i18n.language).toBe('en'))
    expect(await screen.findByLabelText('Background')).toBeInTheDocument()
  })
})
