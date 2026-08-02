import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { saveWorkspaceToLocalStorage } from '../persistence/autosave'
import { useFiguresStore } from '../store/figuresStore'
import { usePosesShellStore } from '../store/posesShellStore'
import { POSES_AUTOSAVE_KEY, switchShell } from './shellChoice'
import { POSES_VIEW_KEYS } from './posesViews'

/**
 * Barra superior do módulo de poses: as ABAS DE VISTA com setas de
 * avançar/voltar (a vista ativa é a que está na tela — não há vista em
 * segundo plano), desfazer/refazer por BOTÕES (decisão do usuário: sem
 * gestos de toque para undo) e a volta para a aplicação completa.
 */
export function PosesTopBar() {
  const { t } = useTranslation()
  const viewKey = usePosesShellStore((state) => state.viewKey)
  const setViewKey = usePosesShellStore((state) => state.setViewKey)
  const stepView = usePosesShellStore((state) => state.stepView)
  const freeEditEnabled = usePosesShellStore((state) => state.freeEditEnabled)
  const toggleFreeEdit = usePosesShellStore((state) => state.toggleFreeEdit)
  const requestFrameFigure = usePosesShellStore((state) => state.requestFrameFigure)
  const hasFigures = useFiguresStore((state) => state.figures.length > 0)

  const canUndo = useStore(useFiguresStore.temporal, (state) => state.pastStates.length > 0)
  const canRedo = useStore(useFiguresStore.temporal, (state) => state.futureStates.length > 0)

  const handleSwitchToDesktop = () => {
    // Grava a sessão do módulo AGORA (o debounce do autosave pode estar no
    // meio) antes de trocar o override e recarregar — trocar de casca é
    // recarga de página por desenho (`shellChoice.ts`).
    saveWorkspaceToLocalStorage(useFiguresStore.getState(), POSES_AUTOSAVE_KEY)
    switchShell('desktop')
  }

  return (
    <header className="poses-topbar">
      <button
        type="button"
        className="poses-topbar__icon"
        aria-label={t('poses.viewPrev')}
        title={t('poses.viewPrev')}
        onClick={() => stepView(-1)}
      >
        &#8249;
      </button>
      <nav className="poses-topbar__views" aria-label={t('poses.viewsLabel')}>
        {POSES_VIEW_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="poses-topbar__view"
            aria-pressed={viewKey === key}
            onClick={() => setViewKey(key)}
          >
            {t(`poses.views.${key}`)}
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="poses-topbar__icon"
        aria-label={t('poses.viewNext')}
        title={t('poses.viewNext')}
        onClick={() => stepView(1)}
      >
        &#8250;
      </button>

      {/* Enquadrar boneco (item 49): com pan/zoom livres é fácil perder o
          boneco da vista; isto recentra nele — em qualquer vista. */}
      <button
        type="button"
        className="poses-topbar__icon"
        aria-label={t('poses.frameFigure')}
        title={t('poses.frameFigure')}
        disabled={!hasFigures}
        onClick={requestFrameFigure}
      >
        &#8982;
      </button>

      {/* Cadeado da vista Livre (#93): travada = conferência (manequim
          completo); destravada = palito com arrasto + gizmo. Só aparece na
          própria vista — nas outras não há o que travar. */}
      {viewKey === 'free' && (
        <button
          type="button"
          className="poses-topbar__icon"
          aria-pressed={freeEditEnabled}
          aria-label={freeEditEnabled ? t('poses.freeEditLock') : t('poses.freeEditUnlock')}
          title={freeEditEnabled ? t('poses.freeEditLock') : t('poses.freeEditUnlock')}
          onClick={toggleFreeEdit}
        >
          {freeEditEnabled ? '\u{1F513}' : '\u{1F512}'}
        </button>
      )}

      <div className="poses-topbar__actions">
        <button
          type="button"
          className="poses-topbar__icon"
          aria-label={t('poses.undo')}
          title={t('poses.undo')}
          disabled={!canUndo}
          onClick={() => useFiguresStore.temporal.getState().undo()}
        >
          &#8630;
        </button>
        <button
          type="button"
          className="poses-topbar__icon"
          aria-label={t('poses.redo')}
          title={t('poses.redo')}
          disabled={!canRedo}
          onClick={() => useFiguresStore.temporal.getState().redo()}
        >
          &#8631;
        </button>
        <button
          type="button"
          className="poses-topbar__icon poses-topbar__switch"
          aria-label={t('poses.switchToDesktop')}
          title={t('poses.switchToDesktop')}
          onClick={handleSwitchToDesktop}
        >
          &#8689;
        </button>
      </div>
    </header>
  )
}
