import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from '../uiStore'

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('starts with the help panel hidden', () => {
    expect(useUIStore.getState().helpVisible).toBe(false)
  })

  it('toggleHelp flips visibility on/off', () => {
    useUIStore.getState().toggleHelp()
    expect(useUIStore.getState().helpVisible).toBe(true)
    useUIStore.getState().toggleHelp()
    expect(useUIStore.getState().helpVisible).toBe(false)
  })

  it('closeHelp always leaves it hidden, even if already hidden', () => {
    useUIStore.getState().closeHelp()
    expect(useUIStore.getState().helpVisible).toBe(false)
    useUIStore.getState().toggleHelp()
    useUIStore.getState().closeHelp()
    expect(useUIStore.getState().helpVisible).toBe(false)
  })
})

describe('uiStore — estado do autosave (fase 9, item 2)', () => {
  beforeEach(() => {
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('começa sem nenhuma gravação registrada', () => {
    expect(useUIStore.getState().autosaveStatus).toBe('idle')
    expect(useUIStore.getState().lastSavedAt).toBeNull()
  })

  it('marca gravação pendente e depois concluída, guardando o horário', () => {
    useUIStore.getState().markAutosavePending()
    expect(useUIStore.getState().autosaveStatus).toBe('pending')

    useUIStore.getState().markAutosaveSaved(1_700_000_000_000)
    expect(useUIStore.getState().autosaveStatus).toBe('saved')
    expect(useUIStore.getState().lastSavedAt).toBe(1_700_000_000_000)
  })

  it('marca falha sem apagar o horário da última gravação bem-sucedida', () => {
    useUIStore.getState().markAutosaveSaved(1_700_000_000_000)
    useUIStore.getState().markAutosaveFailed()

    expect(useUIStore.getState().autosaveStatus).toBe('error')
    expect(useUIStore.getState().lastSavedAt).toBe(1_700_000_000_000)
  })
})

describe('uiStore — casca visual do boneco (DECISOES.md #81)', () => {
  beforeEach(() => {
    localStorage.clear()
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('começa no manequim de madeira', () => {
    expect(useUIStore.getState().figureStyle).toBe('wooden')
  })

  it('troca de casca e grava a preferência — é modo de tela, não conteúdo de cena', () => {
    useUIStore.getState().setFigureStyle('stick')

    expect(useUIStore.getState().figureStyle).toBe('stick')
    expect(JSON.parse(localStorage.getItem('webposer:ui:v1') ?? '{}').figureStyle).toBe('stick')
  })

  it('gravar a casca não apaga as outras preferências do mesmo bloco', () => {
    useUIStore.getState().toggleRuler()
    useUIStore.getState().setFigureStyle('stick')

    const gravado = JSON.parse(localStorage.getItem('webposer:ui:v1') ?? '{}')
    expect(gravado.figureStyle).toBe('stick')
    expect(gravado.rulerVisible).toBe(true)
  })
})

describe('uiStore — modo silhueta (item 8)', () => {
  beforeEach(() => {
    localStorage.clear()
    useUIStore.setState(useUIStore.getInitialState())
  })

  it('nasce desligado e alterna, gravando a preferência (modo de tela, como a casca)', () => {
    expect(useUIStore.getState().figureSilhouette).toBe(false)

    useUIStore.getState().toggleFigureSilhouette()

    expect(useUIStore.getState().figureSilhouette).toBe(true)
    expect(JSON.parse(localStorage.getItem('webposer:ui:v1') ?? '{}').figureSilhouette).toBe(true)
  })

  it('gravar a silhueta não apaga as outras preferências do mesmo bloco', () => {
    useUIStore.getState().setFigureStyle('stick')
    useUIStore.getState().toggleFigureSilhouette()

    const gravado = JSON.parse(localStorage.getItem('webposer:ui:v1') ?? '{}')
    expect(gravado.figureSilhouette).toBe(true)
    expect(gravado.figureStyle).toBe('stick')
  })
})
