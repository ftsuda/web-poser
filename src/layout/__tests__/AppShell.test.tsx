import '../../i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { useFiguresStore } from '../../store/figuresStore'
import { useUIStore } from '../../store/uiStore'

vi.mock('../../scene/Viewport', () => ({
  Viewport: () => <div data-testid="viewport-stub" />,
}))

const { AppShell } = await import('../AppShell')

describe('AppShell', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('lays out toolbar, figures panel, viewport, properties panel, camera panel, snapshot panel and scenes panel as landmarks', () => {
    render(<AppShell />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bonecos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Propriedades' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Câmera' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Instantâneos' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Cenas' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByTestId('viewport-stub')).toBeInTheDocument()
  })

  // Ordem pedida pelo usuário: da esquerda para a direita, Animação vem ANTES
  // de Instantâneos; o resto da fila fica como estava. É a ordem do DOM que
  // manda no layout (os painéis são irmãos num flex row), então travar a lista
  // aqui é o jeito de a ordem não voltar sozinha num refactor do AppShell.
  it('orders the side panels with the animation panel before the snapshot panel', () => {
    render(<AppShell />)

    const titles = screen.getAllByRole('complementary').map((panel) => panel.getAttribute('aria-label'))

    expect(titles).toEqual(['Bonecos', 'Propriedades', 'Câmera', 'Animação', 'Instantâneos', 'Cenas'])
  })

  it('activates global keyboard shortcuts (e.g. Escape clears the selection)', () => {
    render(<AppShell />)
    const id = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().selectFigure(id)

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    window.dispatchEvent(event)

    expect(useFiguresStore.getState().selectedFigureId).toBeNull()
  })

  it('opens the shortcuts help panel with ?', () => {
    render(<AppShell />)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }))
    })

    expect(screen.getByRole('dialog', { name: 'Atalhos de teclado' })).toBeInTheDocument()
  })
})
