import { beforeEach, describe, expect, it } from 'vitest'
import {
  SECTION_KEYS,
  PANEL_KEYS,
  createCollapsedSections,
  createExpandedPanels,
  loadUIPreferences,
  saveUIPreferences,
  type UIPreferences,
} from '../uiPreferences'

/** Preferências completas com os padrões de fábrica, para cada teste dizer só o que lhe importa. */
function prefs(overrides: Partial<UIPreferences> = {}): UIPreferences {
  return {
    collapsedPanels: createExpandedPanels(),
    collapsedSections: createCollapsedSections(),
    rulerVisible: false,
    frameMaskSource: 'off',
    pairPoseEnabled: true,
    figureStyle: 'wooden',
    ...overrides,
  }
}

describe('uiPreferences (fase 9, item 8)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('começa com os painéis do fluxo de posar expandidos; animador e linha do tempo recolhidos', () => {
    const { collapsedPanels } = loadUIPreferences()
    expect(Object.keys(collapsedPanels).sort()).toEqual([...PANEL_KEYS].sort())
    // Sete colunas: o animador é o único que não faz parte do fluxo de posar e
    // capturar, e por isso é o que nasce fora do caminho (DECISOES.md #52). A
    // barra da linha do tempo (item 29) nasce recolhida pela mesma razão — só
    // que roubando ALTURA em vez de largura.
    expect(collapsedPanels.animation).toBe(true)
    expect(collapsedPanels.timeline).toBe(true)
    for (const key of PANEL_KEYS) {
      if (key !== 'animation' && key !== 'timeline') expect(collapsedPanels[key]).toBe(false)
    }
  })

  it('expandir um painel que nasce recolhido sobrevive à sessão seguinte', () => {
    saveUIPreferences(prefs())

    // Sem isto, o `false` gravado seria ignorado e o painel voltaria recolhido.
    expect(loadUIPreferences().collapsedPanels.animation).toBe(false)
  })

  it('faz round-trip do estado recolhido de cada painel', () => {
    const collapsedPanels = { ...createExpandedPanels(), camera: true, scenes: true }
    saveUIPreferences(prefs({ collapsedPanels }))

    expect(loadUIPreferences().collapsedPanels).toEqual(collapsedPanels)
  })

  /**
   * Seções recolhíveis dentro do painel de Animação (pedido do usuário,
   * 2026-07-31): nascem recolhidas, e é por isso que a leitura precisa aceitar
   * o `false` gravado — abrir "Trechos prontos" a cada sessão seria pior do
   * que o problema que a seção resolve.
   */
  it('as seções de uso ocasional nascem recolhidas, e as duas principais abertas', () => {
    const { collapsedSections } = loadUIPreferences()
    expect(Object.keys(collapsedSections).sort()).toEqual([...SECTION_KEYS].sort())

    // Abertas: escolher/aplicar uma pose e enquadrar a câmera são o motivo de
    // aqueles painéis existirem — recolhê-las trocaria rolagem por cliques.
    expect(collapsedSections.poses).toBe(false)
    expect(collapsedSections.cameraFraming).toBe(false)
    for (const key of SECTION_KEYS) {
      if (key !== 'poses' && key !== 'cameraFraming') expect(collapsedSections[key]).toBe(true)
    }
  })

  it('o estado de uma seção sobrevive à sessão seguinte, nos dois sentidos', () => {
    saveUIPreferences({
      ...prefs(),
      collapsedSections: { ...createCollapsedSections(), animationClips: false, poses: true },
    })

    const depois = loadUIPreferences().collapsedSections
    expect(depois.animationClips).toBe(false)
    expect(depois.poses).toBe(true)
    expect(depois.animationVideo).toBe(true)
  })

  it('arquivo antigo, sem as seções, abre com elas recolhidas', () => {
    localStorage.setItem(
      'virtual-mockup:ui:v1',
      JSON.stringify({ version: 1, collapsedPanels: { figures: true } }),
    )

    expect(loadUIPreferences().collapsedSections).toEqual(createCollapsedSections())
  })

  it('ignora conteúdo corrompido e volta ao padrão, sem lançar', () => {
    localStorage.setItem('virtual-mockup:ui:v1', '{isto não é json')
    expect(loadUIPreferences().collapsedPanels).toEqual({
      ...createExpandedPanels(),
      animation: true,
      timeline: true,
    })
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
    saveUIPreferences(prefs({ collapsedPanels: { ...createExpandedPanels(), figures: true }, rulerVisible: true }))
    expect(localStorage.getItem('virtual-mockup:workspace:v1')).toBeNull()
  })

  it('faz round-trip da régua vertical (fase 9, item 11), desligada por padrão', () => {
    expect(loadUIPreferences().rulerVisible).toBe(false)

    saveUIPreferences(prefs({ rulerVisible: true }))
    expect(loadUIPreferences().rulerVisible).toBe(true)
  })

  it('faz round-trip da máscara de enquadramento, desligada por padrão', () => {
    expect(loadUIPreferences().frameMaskSource).toBe('off')

    saveUIPreferences(prefs({ frameMaskSource: 'vertical' }))
    expect(loadUIPreferences().frameMaskSource).toBe('vertical')
  })

  it('recusa uma fonte de máscara desconhecida e volta a desligada', () => {
    localStorage.setItem(
      'virtual-mockup:ui:v1',
      JSON.stringify({ version: 1, frameMaskSource: 'holograma' }),
    )
    expect(loadUIPreferences().frameMaskSource).toBe('off')
  })

  it('faz round-trip da pose em dupla automática, LIGADA por padrão', () => {
    expect(loadUIPreferences().pairPoseEnabled).toBe(true)

    // Sem ler o `false`, o desligamento seria esquecido a cada sessão — mesmo
    // problema do painel que nasce recolhido.
    saveUIPreferences(prefs({ pairPoseEnabled: false }))
    expect(loadUIPreferences().pairPoseEnabled).toBe(false)
  })

  it('faz round-trip da casca do boneco, manequim de madeira por padrão', () => {
    expect(loadUIPreferences().figureStyle).toBe('wooden')

    saveUIPreferences(prefs({ figureStyle: 'stick' }))
    expect(loadUIPreferences().figureStyle).toBe('stick')
  })

  it('casca desconhecida no arquivo cai no padrão, sem derrubar a leitura', () => {
    localStorage.setItem(
      'virtual-mockup:ui:v1',
      JSON.stringify({ version: 1, figureStyle: 'plasticina' }),
    )
    expect(loadUIPreferences().figureStyle).toBe('wooden')
  })
})
