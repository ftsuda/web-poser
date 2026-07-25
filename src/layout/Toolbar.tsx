import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { supportedLanguages } from '../i18n'
import { useFiguresStore, type BackgroundTone } from '../store/figuresStore'
import { useUIStore } from '../store/uiStore'

export function Toolbar() {
  const { t, i18n } = useTranslation()
  const environment = useFiguresStore((state) => state.environment)
  const setBackground = useFiguresStore((state) => state.setBackground)
  const toggleGrid = useFiguresStore((state) => state.toggleGrid)
  const sceneName = useFiguresStore((state) => state.sceneName)
  const renameScene = useFiguresStore((state) => state.renameScene)
  const toggleHelp = useUIStore((state) => state.toggleHelp)
  const autosaveStatus = useUIStore((state) => state.autosaveStatus)
  const lastSavedAt = useUIStore((state) => state.lastSavedAt)
  const rulerVisible = useUIStore((state) => state.rulerVisible)
  const toggleRuler = useUIStore((state) => state.toggleRuler)

  // O histórico do `zundo` é um store vanilla à parte do `figuresStore` — sem
  // esta assinatura os botões não saberiam quando habilitar/desabilitar.
  const canUndo = useStore(useFiguresStore.temporal, (state) => state.pastStates.length > 0)
  const canRedo = useStore(useFiguresStore.temporal, (state) => state.futureStates.length > 0)

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value)
  }

  const handleBackgroundChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setBackground(event.target.value as BackgroundTone)
  }

  const handleSceneNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    renameScene(event.target.value)
  }

  const savedTime =
    lastSavedAt === null
      ? ''
      : new Date(lastSavedAt).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  const autosaveLabel =
    autosaveStatus === 'pending'
      ? t('toolbar.autosaveSaving')
      : autosaveStatus === 'error'
        ? t('toolbar.autosaveError')
        : autosaveStatus === 'saved'
          ? t('toolbar.autosaveSaved', { time: savedTime })
          : t('toolbar.autosaveNever')

  return (
    <header className="toolbar">
      <h1>{t('app.title')}</h1>

      <div className="toolbar__controls">
        <label className="toolbar__field">
          {t('toolbar.sceneName')}
          <input type="text" value={sceneName} onChange={handleSceneNameChange} />
        </label>

        <label className="toolbar__field">
          {t('toolbar.language')}
          <select value={i18n.language} onChange={handleLanguageChange}>
            {supportedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </label>

        <label className="toolbar__field">
          {t('toolbar.background')}
          <select value={environment.background} onChange={handleBackgroundChange}>
            <option value="light">{t('toolbar.backgroundLight')}</option>
            <option value="medium">{t('toolbar.backgroundMedium')}</option>
            <option value="dark">{t('toolbar.backgroundDark')}</option>
          </select>
        </label>

        <label className="toolbar__field toolbar__field--checkbox">
          <input type="checkbox" checked={environment.grid} onChange={toggleGrid} />
          {t('toolbar.grid')}
        </label>

        <label className="toolbar__field toolbar__field--checkbox">
          <input type="checkbox" checked={rulerVisible} onChange={toggleRuler} />
          {t('toolbar.ruler')}
        </label>

        <div className="toolbar__actions">
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label={t('toolbar.undo')}
            title={t('toolbar.undo')}
            disabled={!canUndo}
            onClick={() => useFiguresStore.temporal.getState().undo()}
          >
            &#8630;
          </button>
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label={t('toolbar.redo')}
            title={t('toolbar.redo')}
            disabled={!canRedo}
            onClick={() => useFiguresStore.temporal.getState().redo()}
          >
            &#8631;
          </button>
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label={t('toolbar.help')}
            title={t('toolbar.help')}
            onClick={toggleHelp}
          >
            ?
          </button>
        </div>

        <span
          role="status"
          className={`toolbar__autosave toolbar__autosave--${autosaveStatus}`}
          title={autosaveLabel}
        >
          {autosaveLabel}
        </span>
      </div>
    </header>
  )
}
