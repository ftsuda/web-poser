import { useTranslation } from 'react-i18next'
import { SHORTCUT_CATALOG } from '../shortcuts/shortcuts'
import { useUIStore } from '../store/uiStore'

/**
 * Painel de ajuda de atalhos (`?`) — fase 8, ver PLANO.md > "Observação: uso
 * do teclado". Lista o catálogo declarativo de `shortcuts.ts` (fonte única,
 * evita uma segunda lista desatualizada). Fecha com `?`/Escape ou clicando
 * fora — o fechamento por tecla já é tratado em `useKeyboardShortcuts.ts`
 * (que também suspende os outros atalhos enquanto este painel está aberto).
 */
export function ShortcutsHelpPanel() {
  const { t } = useTranslation()
  const helpVisible = useUIStore((state) => state.helpVisible)
  const closeHelp = useUIStore((state) => state.closeHelp)

  if (!helpVisible) return null

  return (
    <div className="shortcuts-help__backdrop" onClick={closeHelp}>
      <div
        className="shortcuts-help__dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('help.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shortcuts-help__header">
          <h2>{t('help.title')}</h2>
          <button type="button" aria-label={t('help.close')} onClick={closeHelp}>
            &times;
          </button>
        </div>
        <ul className="shortcuts-help__list">
          {SHORTCUT_CATALOG.map((entry) => (
            <li key={entry.descriptionKey} className="shortcuts-help__row">
              <kbd>{entry.keys}</kbd>
              <span>{t(entry.descriptionKey)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
