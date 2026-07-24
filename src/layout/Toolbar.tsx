import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../i18n'
import { useFiguresStore, type BackgroundTone } from '../store/figuresStore'

export function Toolbar() {
  const { t, i18n } = useTranslation()
  const environment = useFiguresStore((state) => state.environment)
  const setBackground = useFiguresStore((state) => state.setBackground)
  const toggleGrid = useFiguresStore((state) => state.toggleGrid)
  const sceneName = useFiguresStore((state) => state.sceneName)
  const renameScene = useFiguresStore((state) => state.renameScene)

  const handleLanguageChange = (event: ChangeEvent<HTMLSelectElement>) => {
    void i18n.changeLanguage(event.target.value)
  }

  const handleBackgroundChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setBackground(event.target.value as BackgroundTone)
  }

  const handleSceneNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    renameScene(event.target.value)
  }

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
      </div>
    </header>
  )
}
