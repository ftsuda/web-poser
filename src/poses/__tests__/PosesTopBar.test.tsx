import '../../i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useFiguresStore } from '../../store/figuresStore'
import { usePosesShellStore } from '../../store/posesShellStore'
import { useUIStore } from '../../store/uiStore'
import { PosesCaptureButton } from '../PosesCaptureButton'
import { PosesTopBar } from '../PosesTopBar'
import { findWorkingAnimation } from '../../animation/animation'

beforeEach(() => {
  useFiguresStore.setState(useFiguresStore.getInitialState())
  useFiguresStore.temporal.getState().clear()
  usePosesShellStore.setState(usePosesShellStore.getInitialState())
  useUIStore.setState(useUIStore.getInitialState())
})

describe('PosesTopBar', () => {
  it('mostra as seis vistas, com a ativa marcada, e troca por toque e pelas setas', async () => {
    const user = userEvent.setup()
    render(<PosesTopBar />)
    await act(async () => {})

    expect(screen.getByRole('button', { name: 'Frente' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'Cima' }))
    expect(usePosesShellStore.getState().viewKey).toBe('top')

    await user.click(screen.getByRole('button', { name: 'Próxima vista' }))
    expect(usePosesShellStore.getState().viewKey).toBe('free')
    await user.click(screen.getByRole('button', { name: 'Próxima vista' }))
    expect(usePosesShellStore.getState().viewKey).toBe('right')
    await user.click(screen.getByRole('button', { name: 'Vista anterior' }))
    expect(usePosesShellStore.getState().viewKey).toBe('free')
  })

  it('"enquadrar boneco" fica desabilitado sem boneco e dispara o comando com boneco (item 49)', async () => {
    const user = userEvent.setup()
    render(<PosesTopBar />)
    await act(async () => {})

    const frameButton = screen.getByRole('button', { name: 'Enquadrar boneco' })
    expect(frameButton).toBeDisabled()

    act(() => {
      useFiguresStore.getState().addFigure()
    })
    await user.click(frameButton)
    expect(usePosesShellStore.getState().frameRequestSeq).toBe(1)
  })

  it('o cadeado da edição só existe na vista Livre, e alterna o destravamento (#93)', async () => {
    const user = userEvent.setup()
    render(<PosesTopBar />)
    await act(async () => {})

    expect(
      screen.queryByRole('button', { name: 'Liberar a edição na vista livre' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Livre' }))
    const unlock = screen.getByRole('button', { name: 'Liberar a edição na vista livre' })
    await user.click(unlock)
    expect(usePosesShellStore.getState().freeEditEnabled).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Travar a edição na vista livre' }))
    expect(usePosesShellStore.getState().freeEditEnabled).toBe(false)
  })

  it('mostra o estado do autosave da sessão do módulo (item 53), com as mesmas mensagens da Toolbar', () => {
    render(<PosesTopBar />)

    // O módulo grava na chave própria (#92), mas o ESTADO da gravação é o
    // mesmo `uiStore` do desktop — o hook de autosave é compartilhado.
    expect(screen.getByRole('status')).toHaveAccessibleName('Ainda não salvo')

    act(() => {
      useUIStore.getState().markAutosavePending()
    })
    expect(screen.getByRole('status')).toHaveAccessibleName('Salvando…')

    act(() => {
      useUIStore.getState().markAutosaveSaved(Date.UTC(2026, 0, 1, 12, 0))
    })
    expect(screen.getByRole('status')).toHaveAccessibleName(/^Salvo às /)

    act(() => {
      useUIStore.getState().markAutosaveFailed()
    })
    expect(screen.getByRole('status')).toHaveAccessibleName('Falha ao salvar')
  })

  it('desfazer/refazer são botões (decisão do usuário), habilitados pelo histórico do zundo', async () => {
    const user = userEvent.setup()
    render(<PosesTopBar />)
    await act(async () => {})

    const undoButton = screen.getByRole('button', { name: 'Desfazer' })
    expect(undoButton).toBeDisabled()

    act(() => {
      useFiguresStore.getState().addFigure()
    })
    expect(undoButton).toBeEnabled()

    await user.click(undoButton)
    expect(useFiguresStore.getState().figures).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Refazer' })).toBeEnabled()
  })
})

describe('PosesCaptureButton', () => {
  it('desabilitado sem boneco; com boneco, captura keyframe com câmera padrão e o marca corrente', async () => {
    const user = userEvent.setup()
    render(<PosesCaptureButton />)
    await act(async () => {})

    const button = screen.getByRole('button', { name: 'Capturar keyframe' })
    expect(button).toBeDisabled()

    act(() => {
      useFiguresStore.getState().addFigure()
    })
    await user.click(button)

    const working = findWorkingAnimation(useFiguresStore.getState().animations)
    expect(working).not.toBeNull()
    expect(working!.keyframes).toHaveLength(1)
    // A câmera é a PADRÃO (sanitizeAnimations descarta keyframe sem câmera).
    expect(working!.keyframes[0].camera.position).toEqual([3, 2, 4])
    expect(usePosesShellStore.getState().currentKeyframeId).toBe(working!.keyframes[0].id)
  })
})
