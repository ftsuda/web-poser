import { describe, expect, it } from 'vitest'
import { SHORTCUT_CATALOG, isTypingTarget, matchShortcut, type ShortcutKeyEvent } from '../shortcuts'

function key(overrides: Partial<ShortcutKeyEvent>): ShortcutKeyEvent {
  return {
    key: 'a',
    code: 'KeyA',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    ...overrides,
  }
}

describe('isTypingTarget', () => {
  it('treats input, textarea and select as typing contexts', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true)
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true)
  })

  it('treats contentEditable elements as typing contexts', () => {
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('does not treat a plain element or null as a typing context', () => {
    expect(isTypingTarget({ tagName: 'DIV' })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('matchShortcut — arrows (joint/root axis or ground move)', () => {
  it('maps plain arrows to a normal step', () => {
    expect(matchShortcut(key({ key: 'ArrowUp' }))).toEqual({
      type: 'arrow',
      direction: 'up',
      step: 'normal',
    })
    expect(matchShortcut(key({ key: 'ArrowLeft' }))).toEqual({
      type: 'arrow',
      direction: 'left',
      step: 'normal',
    })
  })

  it('maps Shift+arrow to a large step', () => {
    expect(matchShortcut(key({ key: 'ArrowDown', shiftKey: true }))).toEqual({
      type: 'arrow',
      direction: 'down',
      step: 'large',
    })
  })

  it('maps Ctrl+arrow to a fine step', () => {
    expect(matchShortcut(key({ key: 'ArrowRight', ctrlKey: true }))).toEqual({
      type: 'arrow',
      direction: 'right',
      step: 'fine',
    })
  })
})

describe('matchShortcut — joint cycling and figure selection', () => {
  it('maps Tab to cycle joints forward and Shift+Tab backward', () => {
    expect(matchShortcut(key({ key: 'Tab' }))).toEqual({ type: 'cycleJoint', direction: 1 })
    expect(matchShortcut(key({ key: 'Tab', shiftKey: true }))).toEqual({
      type: 'cycleJoint',
      direction: -1,
    })
  })

  it('maps digits 1-5 to selecting a figure by index', () => {
    expect(matchShortcut(key({ key: '1' }))).toEqual({ type: 'selectFigureByIndex', index: 0 })
    expect(matchShortcut(key({ key: '5' }))).toEqual({ type: 'selectFigureByIndex', index: 4 })
  })

  it('does not treat digits 6-9 or 0 as figure selection (max 5 figures)', () => {
    expect(matchShortcut(key({ key: '6' }))).toBeNull()
    expect(matchShortcut(key({ key: '0' }))).toBeNull()
  })
})

describe('matchShortcut — camera presets (numpad, Blender convention) and bookmarks', () => {
  it('maps Numpad1/3/7 to the front/right/top orthographic presets', () => {
    expect(matchShortcut(key({ key: '1', code: 'Numpad1' }))).toEqual({
      type: 'cameraPreset',
      preset: 'front',
    })
    expect(matchShortcut(key({ key: '3', code: 'Numpad3' }))).toEqual({
      type: 'cameraPreset',
      preset: 'right',
    })
    expect(matchShortcut(key({ key: '7', code: 'Numpad7' }))).toEqual({
      type: 'cameraPreset',
      preset: 'top',
    })
  })

  it('maps Ctrl+Numpad1/3 to the back/left presets', () => {
    expect(matchShortcut(key({ key: '1', code: 'Numpad1', ctrlKey: true }))).toEqual({
      type: 'cameraPreset',
      preset: 'back',
    })
    expect(matchShortcut(key({ key: '3', code: 'Numpad3', ctrlKey: true }))).toEqual({
      type: 'cameraPreset',
      preset: 'left',
    })
  })

  it('does not treat the regular top-row digits 1/3/7 as camera presets (only the numpad codes)', () => {
    expect(matchShortcut(key({ key: '1', code: 'Digit1' }))).toEqual({
      type: 'selectFigureByIndex',
      index: 0,
    })
  })

  it('maps Shift+1..5 to applying a camera bookmark by index', () => {
    expect(matchShortcut(key({ key: '1', code: 'Digit1', shiftKey: true }))).toEqual({
      type: 'applyCameraBookmarkByIndex',
      index: 0,
    })
    expect(matchShortcut(key({ key: '5', code: 'Digit5', shiftKey: true }))).toEqual({
      type: 'applyCameraBookmarkByIndex',
      index: 4,
    })
  })
})

describe('matchShortcut — capture keyframe', () => {
  it('maps Space to captureKeyframe', () => {
    expect(matchShortcut(key({ key: ' ', code: 'Space' }))).toEqual({ type: 'captureKeyframe' })
  })

  it('ignores Space with a modifier held', () => {
    expect(matchShortcut(key({ key: ' ', code: 'Space', ctrlKey: true }))).toBeNull()
    expect(matchShortcut(key({ key: ' ', code: 'Space', shiftKey: true }))).toBeNull()
  })

  it('ignores Space while typing in a text field, like any other shortcut', () => {
    expect(matchShortcut(key({ key: ' ', code: 'Space', target: { tagName: 'INPUT' } }))).toBeNull()
  })
})

describe('matchShortcut — undo/redo/duplicate/delete/visibility/escape', () => {
  it('maps Ctrl+Z to undo and Ctrl+Shift+Z / Ctrl+Y to redo', () => {
    expect(matchShortcut(key({ key: 'z', ctrlKey: true }))).toEqual({ type: 'undo' })
    expect(matchShortcut(key({ key: 'z', ctrlKey: true, shiftKey: true }))).toEqual({
      type: 'redo',
    })
    expect(matchShortcut(key({ key: 'y', ctrlKey: true }))).toEqual({ type: 'redo' })
  })

  it('accepts Cmd (metaKey) as the platform modifier too', () => {
    expect(matchShortcut(key({ key: 'z', metaKey: true }))).toEqual({ type: 'undo' })
  })

  it('maps Ctrl+D to duplicate the selected figure', () => {
    expect(matchShortcut(key({ key: 'd', ctrlKey: true }))).toEqual({ type: 'duplicateFigure' })
  })

  it('maps Escape to clearSelection', () => {
    expect(matchShortcut(key({ key: 'Escape' }))).toEqual({ type: 'clearSelection' })
  })

  it('maps Delete to deleteFigure', () => {
    expect(matchShortcut(key({ key: 'Delete' }))).toEqual({ type: 'deleteFigure' })
  })

  it('maps H to toggleVisibility', () => {
    expect(matchShortcut(key({ key: 'h' }))).toEqual({ type: 'toggleVisibility' })
  })

  it('maps R to toggleIK', () => {
    expect(matchShortcut(key({ key: 'r' }))).toEqual({ type: 'toggleIK' })
  })

  it('maps ? to toggleHelp', () => {
    expect(matchShortcut(key({ key: '?', shiftKey: true }))).toEqual({ type: 'toggleHelp' })
  })

  it('is case-insensitive for letter shortcuts', () => {
    expect(matchShortcut(key({ key: 'H' }))).toEqual({ type: 'toggleVisibility' })
    expect(matchShortcut(key({ key: 'D', ctrlKey: true }))).toEqual({ type: 'duplicateFigure' })
    expect(matchShortcut(key({ key: 'R' }))).toEqual({ type: 'toggleIK' })
  })
})

describe('matchShortcut — no false positives', () => {
  it('returns null for unmapped keys', () => {
    expect(matchShortcut(key({ key: 'x' }))).toBeNull()
    expect(matchShortcut(key({ key: 'Enter' }))).toBeNull()
  })

  it('returns null when Alt is held (reserved for browser back/forward on arrows)', () => {
    expect(matchShortcut(key({ key: 'ArrowLeft', altKey: true }))).toBeNull()
  })

  it('returns null for Ctrl+1..9 (browser tab switching, must not be intercepted)', () => {
    expect(matchShortcut(key({ key: '1', ctrlKey: true }))).toBeNull()
  })

  it('returns null when the event target is a typing context, even for an otherwise valid shortcut', () => {
    expect(matchShortcut(key({ key: 'h', target: { tagName: 'INPUT' } }))).toBeNull()
    expect(matchShortcut(key({ key: 'r', target: { tagName: 'INPUT' } }))).toBeNull()
    expect(matchShortcut(key({ key: 'Escape', target: { tagName: 'TEXTAREA' } }))).toBeNull()
  })
})

describe('SHORTCUT_CATALOG', () => {
  it('has a non-empty keys label and descriptionKey for every entry, with no duplicate description keys', () => {
    expect(SHORTCUT_CATALOG.length).toBeGreaterThan(0)
    const seen = new Set<string>()
    for (const entry of SHORTCUT_CATALOG) {
      expect(entry.keys.length).toBeGreaterThan(0)
      expect(entry.descriptionKey.length).toBeGreaterThan(0)
      expect(seen.has(entry.descriptionKey)).toBe(false)
      seen.add(entry.descriptionKey)
    }
  })
})
