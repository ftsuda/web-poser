import { beforeEach, describe, expect, it } from 'vitest'
import { findWorkingAnimation } from '../../animation/animation'
import {
  POSES_AUTOSAVE_KEY,
  loadWorkspaceFromLocalStorage,
  saveWorkspaceToLocalStorage,
} from '../../persistence/autosave'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
import { useFiguresStore } from '../figuresStore'

/**
 * Trazer a sessão da outra casca (item 54): a ação `loadRestoredWorkspace`
 * aplica ao store vivo um `RestoredWorkspace` inteiro — mesma forma que o
 * init consome do autosave — substituindo a sessão atual, limpando a seleção
 * e zerando o undo (trocar de sessão não é edição desfazível, como o
 * `resetWorkspace`).
 */

beforeEach(() => {
  localStorage.clear()
  useFiguresStore.setState(useFiguresStore.getInitialState())
  useFiguresStore.temporal.getState().clear()
})

/** Monta uma sessão de exemplo no store e grava na chave do módulo de poses. */
function buildAndSaveSourceSession(): void {
  const store = useFiguresStore.getState()
  const id = store.addFigure('Vindo da outra casca') as string
  useFiguresStore.getState().setJointRotation(id, 'elbow.L', { x: -45 })
  useFiguresStore.getState().toggleJointLock(id, 'knee.R')
  useFiguresStore.getState().toggleJointPin(id, 'wrist.L')
  useFiguresStore.getState().addAnimationKeyframe(null, DEFAULT_SCENE_CAMERA)
  saveWorkspaceToLocalStorage(useFiguresStore.getState(), POSES_AUTOSAVE_KEY)
}

describe('loadRestoredWorkspace (item 54)', () => {
  it('substitui a sessão atual pela restaurada — bonecos, keyframes, travas e âncoras', () => {
    buildAndSaveSourceSession()

    // A sessão "de destino" é outra: um boneco diferente, sem animação.
    useFiguresStore.getState().resetWorkspace()
    useFiguresStore.getState().addFigure('Só do destino')

    const restored = loadWorkspaceFromLocalStorage(POSES_AUTOSAVE_KEY)
    expect(restored).not.toBeNull()
    useFiguresStore.getState().loadRestoredWorkspace(restored!)

    const state = useFiguresStore.getState()
    expect(state.figures).toHaveLength(1)
    expect(state.figures[0].name).toBe('Vindo da outra casca')
    expect(state.figures[0].pose['elbow.L'].x).toBe(-45)
    expect(state.jointLocks[state.figures[0].id]).toEqual(['knee.R'])
    expect(state.jointPins[state.figures[0].id]).toEqual(['wrist.L'])
    expect(findWorkingAnimation(state.animations)?.keyframes).toHaveLength(1)
  })

  it('limpa a seleção e zera o histórico de undo', () => {
    buildAndSaveSourceSession()
    useFiguresStore.getState().resetWorkspace()
    const destinationId = useFiguresStore.getState().addFigure() as string
    useFiguresStore.getState().selectFigure(destinationId)
    useFiguresStore.getState().selectJoint('elbow.R')

    const restored = loadWorkspaceFromLocalStorage(POSES_AUTOSAVE_KEY)!
    useFiguresStore.getState().loadRestoredWorkspace(restored)

    const state = useFiguresStore.getState()
    expect(state.selectedFigureId).toBeNull()
    expect(state.selectedPropId).toBeNull()
    expect(state.selectedJointName).toBeNull()
    expect(useFiguresStore.temporal.getState().pastStates).toHaveLength(0)
  })

  it('espelha os limites articulares customizados da sessão trazida', () => {
    useFiguresStore.getState().applyJointLimits({ 'elbow.L': { x: { min: -90, max: 0 } } })
    saveWorkspaceToLocalStorage(useFiguresStore.getState(), POSES_AUTOSAVE_KEY)
    useFiguresStore.getState().resetWorkspace()
    expect(useFiguresStore.getState().jointLimits).toEqual({})

    const restored = loadWorkspaceFromLocalStorage(POSES_AUTOSAVE_KEY)!
    useFiguresStore.getState().loadRestoredWorkspace(restored)

    expect(useFiguresStore.getState().jointLimits).toEqual({ 'elbow.L': { x: { min: -90, max: 0 } } })
  })
})
