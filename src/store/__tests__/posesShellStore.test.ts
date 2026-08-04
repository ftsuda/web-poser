import { beforeEach, describe, expect, it } from 'vitest'
import { POSES_TAB_KEYS, usePosesShellStore } from '../posesShellStore'

beforeEach(() => {
  usePosesShellStore.setState(usePosesShellStore.getInitialState())
})

describe('posesShellStore', () => {
  it('nasce na vista de frente, na aba de boneco, mostrando todos os bonecos', () => {
    const state = usePosesShellStore.getState()
    expect(state.viewKey).toBe('front')
    expect(state.activeTab).toBe('figures')
    expect(state.showOnlyEditing).toBe(false)
  })

  it('as abas seguem a ordem pedida pelo usuário, com a Foto (marcação manual) no fim', () => {
    expect(POSES_TAB_KEYS).toEqual(['figures', 'joint', 'symmetry', 'keyframes', 'file', 'photo'])
  })

  it('troca de vista direto e pelas setas, em ciclo', () => {
    usePosesShellStore.getState().setViewKey('top')
    expect(usePosesShellStore.getState().viewKey).toBe('top')
    usePosesShellStore.getState().stepView(1)
    expect(usePosesShellStore.getState().viewKey).toBe('free')
    usePosesShellStore.getState().stepView(1)
    expect(usePosesShellStore.getState().viewKey).toBe('right')
    usePosesShellStore.getState().stepView(-1)
    expect(usePosesShellStore.getState().viewKey).toBe('free')
  })

  it('a edição da vista livre nasce travada e destravável (#93)', () => {
    expect(usePosesShellStore.getState().freeEditEnabled).toBe(false)
    usePosesShellStore.getState().toggleFreeEdit()
    expect(usePosesShellStore.getState().freeEditEnabled).toBe(true)
    usePosesShellStore.getState().toggleFreeEdit()
    expect(usePosesShellStore.getState().freeEditEnabled).toBe(false)
  })

  it('"enquadrar boneco" é um contador de comando: cada pedido incrementa (item 49)', () => {
    expect(usePosesShellStore.getState().frameRequestSeq).toBe(0)
    usePosesShellStore.getState().requestFrameFigure()
    usePosesShellStore.getState().requestFrameFigure()
    expect(usePosesShellStore.getState().frameRequestSeq).toBe(2)
  })

  it('troca de aba e alterna "mostrar só o boneco em edição"', () => {
    usePosesShellStore.getState().setActiveTab('keyframes')
    expect(usePosesShellStore.getState().activeTab).toBe('keyframes')
    usePosesShellStore.getState().toggleShowOnlyEditing()
    expect(usePosesShellStore.getState().showOnlyEditing).toBe(true)
    usePosesShellStore.getState().toggleShowOnlyEditing()
    expect(usePosesShellStore.getState().showOnlyEditing).toBe(false)
  })
})
