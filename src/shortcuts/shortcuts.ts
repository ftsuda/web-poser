/**
 * Mapa central de atalhos de teclado (ver PLANO.md > "Observação: uso do
 * teclado"). `matchShortcut` é puro — recebe um evento de teclado (real ou
 * um objeto compatível, para facilitar testes) e devolve uma ação
 * abstrata, sem conhecer o estado da aplicação (qual boneco/junta está
 * selecionado etc.) — quem interpreta a ação no contexto atual é o
 * consumidor (`useKeyboardShortcuts`).
 */

import type { OrthoPresetName } from '../scene/cameraPresets'
import type { GizmoMode } from '../store/uiStore'

export type Step = 'normal' | 'large' | 'fine'
export type ArrowDirection = 'up' | 'down' | 'left' | 'right'

export type ShortcutAction =
  | { type: 'arrow'; direction: ArrowDirection; step: Step }
  | { type: 'cycleJoint'; direction: 1 | -1 }
  | { type: 'selectFigureByIndex'; index: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'duplicateFigure' }
  | { type: 'clearSelection' }
  | { type: 'deleteFigure' }
  | { type: 'toggleVisibility' }
  | { type: 'cameraPreset'; preset: OrthoPresetName }
  | { type: 'applyCameraBookmarkByIndex'; index: number }
  | { type: 'captureSnapshot' }
  | { type: 'toggleHelp' }
  | { type: 'frameFigure' }
  | { type: 'saveScene' }
  | { type: 'setGizmoMode'; mode: GizmoMode }

export interface EventTargetLike {
  tagName?: string
  isContentEditable?: boolean
}

/** Formato mínimo de `KeyboardEvent` necessário para o matching — real ou simulado em teste. */
export interface ShortcutKeyEvent {
  key: string
  /** Tecla física (`event.code`) — necessário para distinguir o numpad (`Numpad1`) do dígito comum (`Digit1`), que já tem outro significado. */
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  target: EventTargetLike | null
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

/** Atalhos são ignorados quando o foco está num campo de texto (ou editável). */
export function isTypingTarget(target: EventTargetLike | null): boolean {
  if (!target) return false
  if (target.isContentEditable) return true
  return !!target.tagName && TYPING_TAGS.has(target.tagName)
}

const ARROW_DIRECTIONS: Record<string, ArrowDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
}

/**
 * Presets ortográficos por tecla física do numpad, convenção Blender —
 * `event.code` (não `event.key`) porque com NumLock ligado o `key` do
 * numpad é indistinguível dos dígitos comuns (já usados para selecionar
 * boneco). Ctrl+Numpad1/3 dá a vista oposta (costas/esquerda).
 */
const NUMPAD_PRESET_CODES: Record<string, { plain: OrthoPresetName; ctrl?: OrthoPresetName }> = {
  Numpad1: { plain: 'front', ctrl: 'back' },
  Numpad3: { plain: 'right', ctrl: 'left' },
  Numpad7: { plain: 'top' },
}

/** Ctrl (ou Cmd no Mac) é o modificador de plataforma para atalhos com "Ctrl" no mapa. */
function isPlatformModifier(event: ShortcutKeyEvent): boolean {
  return event.ctrlKey || event.metaKey
}

export function matchShortcut(event: ShortcutKeyEvent): ShortcutAction | null {
  if (isTypingTarget(event.target)) return null
  if (event.altKey) return null // Alt+setas é reservado pelo navegador (voltar/avançar).

  const direction = ARROW_DIRECTIONS[event.key]
  if (direction) {
    const step: Step = isPlatformModifier(event) ? 'fine' : event.shiftKey ? 'large' : 'normal'
    return { type: 'arrow', direction, step }
  }

  if (event.key === 'Tab' && !isPlatformModifier(event)) {
    return { type: 'cycleJoint', direction: event.shiftKey ? -1 : 1 }
  }

  if (event.key === ' ' && !isPlatformModifier(event) && !event.shiftKey) {
    return { type: 'captureSnapshot' }
  }

  const numpadPreset = NUMPAD_PRESET_CODES[event.code]
  if (numpadPreset && !event.shiftKey) {
    const preset = isPlatformModifier(event) ? numpadPreset.ctrl : numpadPreset.plain
    return preset ? { type: 'cameraPreset', preset } : null
  }

  if (/^[1-5]$/.test(event.key) && !isPlatformModifier(event) && event.shiftKey) {
    return { type: 'applyCameraBookmarkByIndex', index: Number(event.key) - 1 }
  }

  if (/^[1-5]$/.test(event.key) && !isPlatformModifier(event) && !event.shiftKey) {
    return { type: 'selectFigureByIndex', index: Number(event.key) - 1 }
  }

  const key = event.key.toLowerCase()

  if (isPlatformModifier(event) && key === 'z') {
    return event.shiftKey ? { type: 'redo' } : { type: 'undo' }
  }

  if (isPlatformModifier(event) && key === 'y' && !event.shiftKey) {
    return { type: 'redo' }
  }

  if (isPlatformModifier(event) && key === 'd' && !event.shiftKey) {
    return { type: 'duplicateFigure' }
  }

  // Ctrl+S é interceptável via `preventDefault` (ao contrário de Ctrl+W/T/N) —
  // ver PLANO.md > "Observação: uso do teclado".
  if (isPlatformModifier(event) && key === 's' && !event.shiftKey) {
    return { type: 'saveScene' }
  }

  if (event.key === 'Escape' && !isPlatformModifier(event) && !event.shiftKey) {
    return { type: 'clearSelection' }
  }

  if (event.key === 'Delete' && !isPlatformModifier(event) && !event.shiftKey) {
    return { type: 'deleteFigure' }
  }

  if (key === 'h' && !isPlatformModifier(event) && !event.shiftKey) {
    return { type: 'toggleVisibility' }
  }

  if (key === 'f' && !isPlatformModifier(event) && !event.shiftKey) {
    return { type: 'frameFigure' }
  }

  // W/E na convenção dos softwares 3D (mover/girar), valendo para a junta
  // selecionada: na raiz, colocação (mover/girar o boneco); nas demais,
  // arrasto de cadeia / rotação FK. O "R" (alternar FK/IK) saiu junto com o
  // IK de 2 ossos, substituído pelo arrasto de junta; o "Q" (selecionar) do
  // mapa original não foi construído — o app não tem um modo de seleção
  // separado, e Esc já limpa a seleção.
  if (key === 'w' && !isPlatformModifier(event) && !event.shiftKey) {
    return { type: 'setGizmoMode', mode: 'translate' }
  }

  if (key === 'e' && !isPlatformModifier(event) && !event.shiftKey) {
    return { type: 'setGizmoMode', mode: 'rotate' }
  }

  if (event.key === '?' && !isPlatformModifier(event)) {
    return { type: 'toggleHelp' }
  }

  return null
}

/**
 * Catálogo declarativo dos atalhos realmente implementados — fonte única para
 * o painel de ajuda (`?`), em vez de uma segunda lista mantida à mão e sujeita
 * a ficar desatualizada. Desde 2026-07-25 cobre o mapa inteiro do `PLANO.md`:
 * o único item proposto que não virou atalho é o "Q" (modo selecionar), por
 * não existir modo de seleção separado no app (ver DECISOES.md #32).
 */
export interface ShortcutCatalogEntry {
  keys: string
  descriptionKey: string
}

export const SHORTCUT_CATALOG: readonly ShortcutCatalogEntry[] = [
  { keys: '↑ ↓ ← →', descriptionKey: 'help.arrows' },
  { keys: 'Shift + ↑ ↓ ← →', descriptionKey: 'help.arrowsLarge' },
  { keys: 'Ctrl + ↑ ↓ ← →', descriptionKey: 'help.arrowsFine' },
  { keys: 'Tab / Shift+Tab', descriptionKey: 'help.cycleJoint' },
  { keys: '1–5', descriptionKey: 'help.selectFigure' },
  { keys: 'W / E', descriptionKey: 'help.gizmoMode' },
  { keys: 'F', descriptionKey: 'help.frameFigure' },
  { keys: 'Espaço', descriptionKey: 'help.captureSnapshot' },
  { keys: 'Ctrl+Z / Ctrl+Shift+Z', descriptionKey: 'help.undoRedo' },
  { keys: 'Ctrl+S', descriptionKey: 'help.saveScene' },
  { keys: 'Ctrl+D', descriptionKey: 'help.duplicateFigure' },
  { keys: 'Delete', descriptionKey: 'help.deleteFigure' },
  { keys: 'H', descriptionKey: 'help.toggleVisibility' },
  { keys: 'Esc', descriptionKey: 'help.clearSelection' },
  { keys: 'Numpad 1 / 3 / 7', descriptionKey: 'help.orthoPresets' },
  { keys: 'Ctrl+Numpad 1 / 3', descriptionKey: 'help.orthoPresetsBack' },
  { keys: 'Shift+1..5', descriptionKey: 'help.applyCameraBookmark' },
  { keys: '?', descriptionKey: 'help.toggleHelp' },
]
