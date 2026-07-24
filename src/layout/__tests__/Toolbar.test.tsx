import '../../i18n'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../i18n'
import { useFiguresStore } from '../../store/figuresStore'
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

  it('switches the UI language', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const languageSelect = screen.getByLabelText('Idioma')
    await user.selectOptions(languageSelect, 'en')

    await waitFor(() => expect(i18n.language).toBe('en'))
    expect(await screen.findByLabelText('Background')).toBeInTheDocument()
  })
})
