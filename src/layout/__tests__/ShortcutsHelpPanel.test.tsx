import '../../i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SHORTCUT_CATALOG } from '../../shortcuts/shortcuts'
import { useUIStore } from '../../store/uiStore'
import { ShortcutsHelpPanel } from '../ShortcutsHelpPanel'

describe('ShortcutsHelpPanel', () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('renders nothing when the help panel is hidden', () => {
    render(<ShortcutsHelpPanel />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows every shortcut from the catalog when visible', () => {
    useUIStore.getState().toggleHelp()
    render(<ShortcutsHelpPanel />)

    const dialog = screen.getByRole('dialog', { name: 'Atalhos de teclado' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(SHORTCUT_CATALOG.length)
  })

  it('closes when the close button is clicked', async () => {
    const user = userEvent.setup()
    useUIStore.getState().toggleHelp()
    render(<ShortcutsHelpPanel />)

    await user.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(useUIStore.getState().helpVisible).toBe(false)
  })

  it('closes when clicking the backdrop, but not when clicking inside the dialog', async () => {
    const user = userEvent.setup()
    useUIStore.getState().toggleHelp()
    const { container } = render(<ShortcutsHelpPanel />)

    await user.click(screen.getByRole('dialog'))
    expect(useUIStore.getState().helpVisible).toBe(true)

    await user.click(container.querySelector('.shortcuts-help__backdrop')!)
    expect(useUIStore.getState().helpVisible).toBe(false)
  })
})
