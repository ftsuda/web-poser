import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { supportedLanguages } from '../i18n'
import type { FigureStyle } from '../figure/skeleton'
import { saveWorkspaceToLocalStorage } from '../persistence/autosave'
import { WORKSPACE_AUTOSAVE_KEY, switchShell } from '../poses/shellChoice'
import type { FrameMaskSource } from '../scene/frameMask'
import { useDepthStore } from '../store/depthStore'
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
  const frameMaskSource = useUIStore((state) => state.frameMaskSource)
  const setFrameMaskSource = useUIStore((state) => state.setFrameMaskSource)
  const figureStyle = useUIStore((state) => state.figureStyle)
  const setFigureStyle = useUIStore((state) => state.setFigureStyle)
  const depthPreview = useDepthStore((state) => state.previewEnabled)
  const togglePreviewDepth = useDepthStore((state) => state.togglePreview)

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

  const handleFrameMaskChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setFrameMaskSource(event.target.value as FrameMaskSource)
  }

  const handleFigureStyleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setFigureStyle(event.target.value as FigureStyle)
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

        {/* A régua só aparece com um boneco selecionado (ela é ancorada nele),
            então a dica explica o que fazer quando marcar não muda nada. */}
        <label className="toolbar__field toolbar__field--checkbox" title={t('toolbar.rulerHint')}>
          <input type="checkbox" checked={rulerVisible} onChange={toggleRuler} />
          {t('toolbar.ruler')}
        </label>

        {/* Mapa de profundidade NA TELA (fase 13). Mesma natureza da régua e da
            casca do boneco: é modo de VISUALIZAÇÃO — fora do undo, fora do
            arquivo da cena —, e por isso mora aqui e não num painel. Ligar a
            vista não liga saída nenhuma: o PNG e o MP4 têm escolha própria, no
            painel de cada um. */}
        <label className="toolbar__field toolbar__field--checkbox" title={t('toolbar.depthHint')}>
          <input type="checkbox" checked={depthPreview} onChange={togglePreviewDepth} />
          {t('toolbar.depth')}
        </label>

        {/* Casca visual do boneco (DECISOES.md #81). É modo de VISUALIZAÇÃO: não
            entra no undo, não viaja no arquivo da cena e não muda pose nem limites — por
            isso mora na Toolbar, ao lado do fundo e da régua, e não no painel de
            Propriedades do boneco selecionado. */}
        <label className="toolbar__field" title={t('toolbar.figureStyleHint')}>
          {t('toolbar.figureStyle')}
          <select value={figureStyle} onChange={handleFigureStyleChange}>
            <option value="wooden">{t('toolbar.figureStyleWooden')}</option>
            <option value="stick">{t('toolbar.figureStyleStick')}</option>
          </select>
        </label>

        {/* Um controle só para as duas saídas: o instantâneo e a animação têm
            resoluções independentes, e duas máscaras ao mesmo tempo não teriam
            sentido na mesma tela. */}
        <label className="toolbar__field" title={t('toolbar.frameMaskHint')}>
          {t('toolbar.frameMask')}
          <select value={frameMaskSource} onChange={handleFrameMaskChange}>
            <option value="off">{t('toolbar.frameMaskOff')}</option>
            <option value="wide">{t('toolbar.frameMaskWide')}</option>
            <option value="vertical">{t('toolbar.frameMaskVertical')}</option>
            <option value="square">{t('toolbar.frameMaskSquare')}</option>
          </select>
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
          {/* Módulo de poses (item 44): override persistido + recarga — a
              troca de casca é recarga de página por desenho (`shellChoice.ts`),
              porque a chave de autosave é decidida no init dos stores. A
              sessão do desktop é gravada AGORA (o debounce pode estar no meio). */}
          <button
            type="button"
            className="toolbar__icon-button"
            aria-label={t('toolbar.posesShell')}
            title={t('toolbar.posesShellHint')}
            onClick={() => {
              saveWorkspaceToLocalStorage(useFiguresStore.getState(), WORKSPACE_AUTOSAVE_KEY)
              switchShell('poses')
            }}
          >
            &#9995;
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
