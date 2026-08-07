import { useEffect } from 'react'
import { installPreviewGuard } from '../animation/previewGuard'
import { useWorkspaceAutosave } from '../persistence/useWorkspaceAutosave'
import { Viewport } from '../scene/Viewport'
import { useKeyboardShortcuts } from '../shortcuts/useKeyboardShortcuts'
import { AnimationPanel } from './AnimationPanel'
import { CameraPanel } from './CameraPanel'
import { FiguresPanel } from './FiguresPanel'
import { SnapshotPanel } from './SnapshotPanel'
import { PropertiesPanel } from './PropertiesPanel'
import { ScenesPanel } from './ScenesPanel'
import { ShortcutsHelpPanel } from './ShortcutsHelpPanel'
import { TimelineBar } from './TimelineBar'
import { Toolbar } from './Toolbar'

export function AppShell() {
  useKeyboardShortcuts()
  useWorkspaceAutosave()
  // Mexeu na cena de trabalho, a pré-visualização do animador sai da frente
  // (DECISOES.md #134). Vale para todo controle de navegação de uma vez —
  // enumerá-los um a um já deixou a bancada travada duas vezes.
  useEffect(() => installPreviewGuard(), [])

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
        {/* Animação antes de Instantâneos (pedido do usuário): a linha do tempo
            fica ao lado da câmera, que é de onde vêm os keyframes, e o
            Instantâneos — que é saída, não edição — vai para perto de Cenas. */}
        <AnimationPanel />
        <SnapshotPanel />
        <ScenesPanel />
      </div>
      {/* Barra da linha do tempo (item 29): ocupa a largura toda, abaixo dos
          painéis, e recolhe para uma faixa fina. */}
      <TimelineBar />
      <ShortcutsHelpPanel />
    </div>
  )
}
