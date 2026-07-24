import { useWorkspaceAutosave } from '../persistence/useWorkspaceAutosave'
import { Viewport } from '../scene/Viewport'
import { useKeyboardShortcuts } from '../shortcuts/useKeyboardShortcuts'
import { CameraPanel } from './CameraPanel'
import { FiguresPanel } from './FiguresPanel'
import { KeyframePanel } from './KeyframePanel'
import { PropertiesPanel } from './PropertiesPanel'
import { ScenesPanel } from './ScenesPanel'
import { ShortcutsHelpPanel } from './ShortcutsHelpPanel'
import { Toolbar } from './Toolbar'

export function AppShell() {
  useKeyboardShortcuts()
  useWorkspaceAutosave()

  return (
    <div className="app-shell">
      <Toolbar />
      <div className="app-shell__body">
        <FiguresPanel />
        <main className="app-shell__viewport">
          <Viewport />
        </main>
        <PropertiesPanel />
        <CameraPanel />
        <KeyframePanel />
        <ScenesPanel />
      </div>
      <ShortcutsHelpPanel />
    </div>
  )
}
