import '../../i18n'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../i18n'
import { useCameraStore } from '../../store/cameraStore'
import { useFiguresStore } from '../../store/figuresStore'
import { useDepthStore } from '../../store/depthStore'
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
    useDepthStore.setState(useDepthStore.getInitialState())
    useCameraStore.setState(useCameraStore.getInitialState())
  })

  afterEach(async () => {
    await i18n.changeLanguage('pt-BR')
  })

  it('shows the app title', async () => {
    await renderToolbar()
    expect(screen.getByRole('heading', { name: 'WebPoser' })).toBeInTheDocument()
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

  it('escolhe a PROPORÇÃO da máscara de enquadramento (fase 11.4), e persiste a escolha', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const select = screen.getByLabelText('Máscara de enquadramento')
    expect(select).toHaveValue('off')

    await user.selectOptions(select, 'wide')
    expect(useUIStore.getState().frameMaskSource).toBe('wide')
    expect(localStorage.getItem('webposer:ui:v1')).toContain('"frameMaskSource":"wide"')

    await user.selectOptions(select, 'vertical')
    expect(useUIStore.getState().frameMaskSource).toBe('vertical')

    await user.selectOptions(select, 'square')
    expect(useUIStore.getState().frameMaskSource).toBe('square')
    expect(localStorage.getItem('webposer:ui:v1')).toContain('"frameMaskSource":"square"')
  })

  it('desligar a máscara larga o retângulo junto, para ela não ficar pintada na tela', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    act(() => {
      useUIStore.getState().setFrameMaskSource('wide')
      useUIStore.getState().setFrameMaskRect({ width: 900, height: 900, left: 350, top: 0, fit: 1 })
    })

    await user.selectOptions(screen.getByLabelText('Máscara de enquadramento'), 'off')
    expect(useUIStore.getState().frameMaskRect).toBeNull()
  })

  it('switches the UI language', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const languageSelect = screen.getByLabelText('Idioma')
    await user.selectOptions(languageSelect, 'en')

    await waitFor(() => expect(i18n.language).toBe('en'))
    expect(await screen.findByLabelText('Background')).toBeInTheDocument()
  })

  /**
   * Fase 13. A visualização de profundidade é modo de VISUALIZAÇÃO, como a
   * régua e a casca do boneco: fora do undo, fora do arquivo, e por isso mora
   * aqui e não num painel. Ligar a vista NÃO liga a saída — as três escolhas
   * são independentes.
   */
  it('liga e desliga a vista em profundidade sem mexer nas saídas', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const checkbox = screen.getByLabelText('Profundidade')
    expect(checkbox).not.toBeChecked()

    await user.click(checkbox)
    expect(useDepthStore.getState().previewEnabled).toBe(true)
    expect(useDepthStore.getState().snapshotDepth).toBe(false)
    expect(useDepthStore.getState().videoDepth).toBe(false)

    await user.click(checkbox)
    expect(useDepthStore.getState().previewEnabled).toBe(false)
  })

  /**
   * Ordem pedida pelo usuário (#117.1): a SILHUETA vem antes da casca do
   * boneco. As duas são modos de visualização vizinhos, e a silhueta é a
   * checagem que se liga e desliga o tempo todo — fica primeiro, à esquerda.
   */
  it('a silhueta vem ANTES da casca do boneco na barra', async () => {
    await renderToolbar()

    const silhueta = screen.getByLabelText('Silhueta')
    const boneco = screen.getByLabelText('Boneco')

    expect(
      silhueta.compareDocumentPosition(boneco) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  /**
   * As linhas de gesto (item 9) são apoio de TELA, como a régua: preferência
   * gravada por aparelho, fora do undo e fora do arquivo da cena.
   */
  it('a chave das linhas de gesto nasce desligada e persiste como preferência', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const chave = screen.getByLabelText('Linhas de gesto')
    expect(chave).not.toBeChecked()

    await user.click(chave)
    expect(useUIStore.getState().gestureLinesVisible).toBe(true)
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
  })

  /**
   * Isolar a seleção: a facilidade que o módulo de poses já tinha (lá só o
   * boneco em edição responde ao toque), trazida para a bancada. Estado de
   * FERRAMENTA — fora do undo e fora do arquivo, como a régua.
   */
  it('a chave de isolar a seleção nasce desligada e alterna sem entrar no undo', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const chave = screen.getByLabelText('Isolar seleção')
    expect(chave).not.toBeChecked()

    await user.click(chave)
    expect(useUIStore.getState().isolateSelection).toBe(true)
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
  })

  /**
   * Enquadrar o boneco na CÂMERA DE TRABALHO (a mesma tecla F): o comando já
   * existia só no teclado, e o módulo de poses tinha o botão desde o item 49.
   */
  it('o botão de enquadrar fica desabilitado sem boneco e pede o comando com um selecionado', async () => {
    const user = userEvent.setup()
    await renderToolbar()

    const botao = screen.getByRole('button', { name: /Enquadrar boneco/ })
    expect(botao).toBeDisabled()

    const id = useFiguresStore.getState().addFigure('Herói') as string
    act(() => {
      useFiguresStore.getState().selectFigure(id)
    })

    await user.click(screen.getByRole('button', { name: /Enquadrar boneco/ }))

    expect(useCameraStore.getState().pendingCommand).toEqual({ type: 'frameFigure', figureId: id })
    // Enquadrar é da bancada: a vista volta para a de edição, nunca a de cena.
    expect(useCameraStore.getState().viewMode).toBe('edit')
  })
})
