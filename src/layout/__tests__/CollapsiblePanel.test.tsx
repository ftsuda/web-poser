import '../../i18n'
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { loadUIPreferences } from '../../persistence/uiPreferences'
import { useUIStore } from '../../store/uiStore'
import { CollapsiblePanel } from '../CollapsiblePanel'

async function renderPanel() {
  const utils = render(
    <CollapsiblePanel panelKey="camera" className="panel--camera" title="Câmera">
      <p>conteúdo do painel</p>
    </CollapsiblePanel>,
  )
  await act(async () => {})
  return utils
}

describe('CollapsiblePanel (fase 9, item 8)', () => {
  beforeEach(() => {
    localStorage.clear()
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('começa expandido, mostrando o conteúdo', async () => {
    await renderPanel()
    expect(screen.getByText('conteúdo do painel')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recolher painel Câmera' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })

  it('esconde o conteúdo ao recolher e o traz de volta ao expandir', async () => {
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Recolher painel Câmera' }))
    expect(screen.queryByText('conteúdo do painel')).not.toBeInTheDocument()
    // O título continua acessível: o painel vira uma faixa fina, não some.
    expect(screen.getByRole('complementary', { name: 'Câmera' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expandir painel Câmera' }))
    expect(screen.getByText('conteúdo do painel')).toBeInTheDocument()
  })

  it('persiste o estado recolhido em localStorage', async () => {
    const user = userEvent.setup()
    await renderPanel()

    await user.click(screen.getByRole('button', { name: 'Recolher painel Câmera' }))

    expect(loadUIPreferences().collapsedPanels.camera).toBe(true)
    expect(loadUIPreferences().collapsedPanels.scenes).toBe(false)
  })
})
