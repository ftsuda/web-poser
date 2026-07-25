import { beforeEach, describe, expect, it } from 'vitest'
import {
  PANEL_KEYS,
  createExpandedPanels,
  loadUIPreferences,
  saveUIPreferences,
} from '../uiPreferences'

describe('uiPreferences (fase 9, item 8)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('começa com todos os painéis expandidos quando não há nada gravado', () => {
    const { collapsedPanels } = loadUIPreferences()
    expect(Object.keys(collapsedPanels).sort()).toEqual([...PANEL_KEYS].sort())
    expect(Object.values(collapsedPanels).every((collapsed) => collapsed === false)).toBe(true)
  })

  it('faz round-trip do estado recolhido de cada painel', () => {
    const collapsedPanels = { ...createExpandedPanels(), camera: true, scenes: true }
    saveUIPreferences({ collapsedPanels, rulerVisible: false })

    expect(loadUIPreferences().collapsedPanels).toEqual(collapsedPanels)
  })

  it('ignora conteúdo corrompido e volta ao padrão, sem lançar', () => {
    localStorage.setItem('virtual-mockup:ui:v1', '{isto não é json')
    expect(loadUIPreferences().collapsedPanels).toEqual(createExpandedPanels())
  })

  it('preenche com defaults as chaves ausentes de uma versão antiga', () => {
    localStorage.setItem(
      'virtual-mockup:ui:v1',
      JSON.stringify({ version: 1, collapsedPanels: { figures: true } }),
    )

    const { collapsedPanels } = loadUIPreferences()
    expect(collapsedPanels.figures).toBe(true)
    expect(collapsedPanels.scenes).toBe(false)
  })

  it('não grava no bloco do workspace (autosave) — chave própria', () => {
    saveUIPreferences({
      collapsedPanels: { ...createExpandedPanels(), figures: true },
      rulerVisible: true,
    })
    expect(localStorage.getItem('virtual-mockup:workspace:v1')).toBeNull()
  })

  it('faz round-trip da régua vertical (fase 9, item 11), desligada por padrão', () => {
    expect(loadUIPreferences().rulerVisible).toBe(false)

    saveUIPreferences({ collapsedPanels: createExpandedPanels(), rulerVisible: true })
    expect(loadUIPreferences().rulerVisible).toBe(true)
  })
})
