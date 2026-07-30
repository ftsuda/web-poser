import { useEffect } from 'react'
import { JOINT_NAMES, ROOT_JOINT_NAME, getJointAxes } from '../figure/skeleton'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore, type FiguresState } from '../store/figuresStore'
import { useSnapshotCaptureStore } from '../store/snapshotCaptureStore'
import { useUIStore } from '../store/uiStore'
import { matchShortcut, type EventTargetLike, type ShortcutAction, type Step } from './shortcuts'

/** Passo de rotação (graus) por junta, conforme o modificador da seta. */
const ROTATION_STEP: Record<Step, number> = { fine: 1, normal: 5, large: 15 }
/** Passo de deslocamento do root no chão (metros), conforme o modificador da seta. */
const MOVE_STEP: Record<Step, number> = { fine: 0.01, normal: 0.05, large: 0.2 }

function applyArrow(action: Extract<ShortcutAction, { type: 'arrow' }>, state: FiguresState): boolean {
  const { selectedFigureId, selectedJointName, activeAxis } = state
  if (!selectedFigureId || !selectedJointName) return false

  if (selectedJointName === ROOT_JOINT_NAME) {
    const figure = state.figures.find((f) => f.id === selectedFigureId)
    if (!figure) return false

    const step = MOVE_STEP[action.step]
    const [x, y, z] = figure.position
    if (action.direction === 'left') state.setPosition(selectedFigureId, [x - step, y, z])
    else if (action.direction === 'right') state.setPosition(selectedFigureId, [x + step, y, z])
    else if (action.direction === 'up') state.setPosition(selectedFigureId, [x, y, z - step])
    else state.setPosition(selectedFigureId, [x, y, z + step])
    return true
  }

  const axes = getJointAxes(selectedJointName)
  if (axes.length === 0 || !activeAxis) return false

  if (action.direction === 'up' || action.direction === 'down') {
    if (axes.length < 2) return false
    const currentIndex = axes.indexOf(activeAxis)
    const offset = action.direction === 'up' ? -1 : 1
    const nextAxis = axes[(currentIndex + offset + axes.length) % axes.length]
    state.setActiveAxis(nextAxis)
    return true
  }

  const figure = state.figures.find((f) => f.id === selectedFigureId)
  if (!figure) return false

  const step = ROTATION_STEP[action.step]
  const delta = action.direction === 'right' ? step : -step
  const current = figure.pose[selectedJointName]?.[activeAxis] ?? 0
  state.setJointRotation(selectedFigureId, selectedJointName, { [activeAxis]: current + delta })
  return true
}

function applyShortcut(action: ShortcutAction): boolean {
  const state = useFiguresStore.getState()
  const { figures, selectedFigureId } = state

  switch (action.type) {
    case 'undo':
      useFiguresStore.temporal.getState().undo()
      return true

    case 'redo':
      useFiguresStore.temporal.getState().redo()
      return true

    case 'selectFigureByIndex': {
      const figure = figures[action.index]
      if (!figure) return false
      state.selectFigure(figure.id)
      return true
    }

    case 'duplicateFigure':
      if (!selectedFigureId) return false
      state.duplicateFigure(selectedFigureId)
      return true

    case 'deleteFigure':
      if (!selectedFigureId) return false
      state.removeFigure(selectedFigureId)
      return true

    case 'toggleVisibility':
      if (!selectedFigureId) return false
      state.toggleVisibility(selectedFigureId)
      return true

    case 'clearSelection':
      if (!selectedFigureId) return false
      state.selectFigure(null)
      return true

    case 'cycleJoint': {
      if (!selectedFigureId) return false
      const currentIndex = state.selectedJointName ? JOINT_NAMES.indexOf(state.selectedJointName) : -1
      const nextIndex = (currentIndex + action.direction + JOINT_NAMES.length) % JOINT_NAMES.length
      state.selectJoint(JOINT_NAMES[nextIndex])
      return true
    }

    case 'arrow':
      return applyArrow(action, state)

    case 'cameraPreset':
      useCameraStore.getState().applyPreset(action.preset)
      return true

    case 'applyCameraBookmarkByIndex': {
      const bookmark = state.cameraBookmarks[action.index]
      if (!bookmark) return false
      useCameraStore.getState().applyBookmark(bookmark.id)
      return true
    }

    case 'captureSnapshot':
      useSnapshotCaptureStore.getState().requestCapture()
      return true

    case 'toggleHelp':
      useUIStore.getState().toggleHelp()
      return true

    case 'frameFigure':
      if (!selectedFigureId) return false
      useCameraStore.getState().frameFigure(selectedFigureId)
      return true

    case 'saveScene':
      state.saveOrUpdateActiveScene()
      // Sempre "tratado", mesmo sem nada para salvar: é o `preventDefault`
      // que impede o diálogo "salvar página" do navegador de abrir por cima.
      return true

    case 'setGizmoMode':
      useUIStore.getState().setGizmoMode(action.mode)
      return true

    case 'toggleCameraView':
      useCameraStore.getState().toggleViewMode()
      return true

    default:
      return false
  }
}

/**
 * Liga o mapa central de atalhos (`shortcuts.ts`) ao estado da aplicação.
 * Um único listener em `window`, montado uma vez — ver PLANO.md > "Observação:
 * uso do teclado". `matchShortcut` já ignora atalhos com foco em campo de texto.
 */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Painel de ajuda aberto: só `?`/Escape fecham; qualquer outro atalho
      // fica suspenso para não editar a cena "por baixo" do painel enquanto
      // o usuário está lendo a lista de atalhos.
      if (useUIStore.getState().helpVisible) {
        if (event.key === '?' || event.key === 'Escape') {
          useUIStore.getState().closeHelp()
          event.preventDefault()
        }
        return
      }

      // Diálogo modal aberto (fase 12): mesma suspensão, sem tratar tecla
      // nenhuma — quem cuida do Escape ali é o próprio diálogo, que sabe o que
      // significa cancelar naquele contexto.
      if (useUIStore.getState().modalOpen) return

      const action = matchShortcut({
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: event.target as EventTargetLike | null,
      })
      if (!action) return

      const handled = applyShortcut(action)
      if (handled) event.preventDefault()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
