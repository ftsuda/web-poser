import { useState, type ChangeEvent, type FocusEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_FIGURES, useFiguresStore, type Figure } from '../store/figuresStore'
import { MAX_HEIGHT_M, MIN_HEIGHT_M } from '../figure/skeleton'
import { slugifySceneName } from '../snapshot/snapshotNaming'
import { pickFile, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { exportFigureToGlb, importFigureFromGlb } from '../persistence/sceneFile'
import { usePoseClipboardStore } from '../store/poseClipboardStore'
import { importErrorKey } from './fileFeedback'
import { CollapsiblePanel } from './CollapsiblePanel'
import { PropsSection } from './PropsSection'

interface FigureRowProps {
  figure: Figure
  selected: boolean
  atLimit: boolean
}

function FigureRow({ figure, selected, atLimit }: FigureRowProps) {
  const { t } = useTranslation()
  const selectFigure = useFiguresStore((state) => state.selectFigure)
  const renameFigure = useFiguresStore((state) => state.renameFigure)
  const removeFigure = useFiguresStore((state) => state.removeFigure)
  const duplicateFigure = useFiguresStore((state) => state.duplicateFigure)
  const toggleVisibility = useFiguresStore((state) => state.toggleVisibility)
  const setHeight = useFiguresStore((state) => state.setHeight)
  const setColor = useFiguresStore((state) => state.setColor)

  const [heightDraft, setHeightDraft] = useState(() => String(figure.height))
  const [lastSyncedHeight, setLastSyncedHeight] = useState(figure.height)
  if (figure.height !== lastSyncedHeight) {
    setLastSyncedHeight(figure.height)
    setHeightDraft(String(figure.height))
  }

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    renameFigure(figure.id, event.target.value)
  }

  const handleHeightInput = (event: ChangeEvent<HTMLInputElement>) => {
    setHeightDraft(event.target.value)
  }

  const commitHeight = (event: FocusEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isNaN(value)) setHeight(figure.id, value)
  }

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    setColor(figure.id, event.target.value)
  }

  const handleExport = async () => {
    const glb = await exportFigureToGlb(figure)
    const filename = `${slugifySceneName(figure.name)}.glb`
    await writeFileToDirectoryOrDownload(null, filename, new Blob([glb], { type: 'model/gltf-binary' }))
  }

  return (
    <li
      className={`figures-panel__row${selected ? ' figures-panel__row--selected' : ''}`}
      aria-selected={selected}
      onClick={() => selectFigure(figure.id)}
    >
      {/* Seletor de cor LIVRE (DECISOES.md #39): era um botão que ciclava
          entre 5 cores fixas. O `<input type="color">` nativo já é o próprio
          indicador da cor atual e abre o seletor do sistema — sem dependência
          nova e com o teclado funcionando de graça. */}
      <input
        type="color"
        className="figures-panel__swatch"
        title={t('panels.figures.changeColor')}
        aria-label={t('panels.figures.changeColor')}
        value={figure.color}
        onClick={(event) => event.stopPropagation()}
        onChange={handleColorChange}
      />

      <input
        className="figures-panel__name"
        type="text"
        aria-label={t('panels.figures.nameLabel')}
        value={figure.name}
        onClick={(event) => event.stopPropagation()}
        onChange={handleNameChange}
      />

      <label className="figures-panel__height" onClick={(event) => event.stopPropagation()}>
        {t('panels.figures.height')}
        <input
          type="number"
          min={MIN_HEIGHT_M}
          max={MAX_HEIGHT_M}
          step={0.01}
          value={heightDraft}
          onChange={handleHeightInput}
          onBlur={commitHeight}
        />
      </label>

      <label
        className="figures-panel__visibility"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={figure.visible}
          aria-label={t(figure.visible ? 'panels.figures.hide' : 'panels.figures.show')}
          onChange={() => toggleVisibility(figure.id)}
        />
      </label>

      <button
        type="button"
        className="figures-panel__duplicate"
        aria-label={t('panels.figures.duplicate')}
        title={t('panels.figures.duplicate')}
        disabled={atLimit}
        onClick={(event) => {
          event.stopPropagation()
          duplicateFigure(figure.id)
        }}
      >
        &#10064;
      </button>

      <button
        type="button"
        className="figures-panel__remove"
        aria-label={t('panels.figures.remove')}
        onClick={(event) => {
          event.stopPropagation()
          removeFigure(figure.id)
        }}
      >
        &times;
      </button>

      <button
        type="button"
        className="figures-panel__export"
        aria-label={t('panels.figures.exportFigure')}
        title={t('panels.figures.exportFigure')}
        onClick={(event) => {
          event.stopPropagation()
          void handleExport()
        }}
      >
        &#8615;
      </button>
    </li>
  )
}

export function FiguresPanel() {
  const { t } = useTranslation()
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const nextFigureSeq = useFiguresStore((state) => state.nextFigureSeq)
  const addFigure = useFiguresStore((state) => state.addFigure)
  const applyImportedPose = useFiguresStore((state) => state.applyImportedPose)
  const importFigureAsNew = useFiguresStore((state) => state.importFigureAsNew)

  const [errorKey, setErrorKey] = useState<string | null>(null)

  const atLimit = figures.length >= MAX_FIGURES
  const selectedFigure = figures.find((figure) => figure.id === selectedFigureId)

  const handleAdd = () => {
    addFigure(t('panels.figures.defaultName', { index: nextFigureSeq }))
  }

  const handleImport = async () => {
    const picked = await pickFile('.glb')
    if (!picked) return
    try {
      const imported = await importFigureFromGlb(picked.data)
      if (selectedFigureId) {
        applyImportedPose(selectedFigureId, { height: imported.height, pose: imported.pose })
      } else {
        importFigureAsNew({
          name: imported.name,
          color: imported.color,
          visible: imported.visible,
          height: imported.height,
          position: imported.position,
          rotation: imported.rotation,
          pose: imported.pose,
        })
      }
      setErrorKey(null)
    } catch (error) {
      setErrorKey(importErrorKey(error))
    }
  }

  return (
    <CollapsiblePanel panelKey="figures" className="panel--figures" title={t('panels.figures.title')}>
      
      <button
        type="button"
        className="figures-panel__add"
        onClick={handleAdd}
        disabled={atLimit}
        title={atLimit ? t('panels.figures.addLimitReached', { max: MAX_FIGURES }) : undefined}
      >
        {t('panels.figures.add')}
      </button>

      <button type="button" className="figures-panel__import" onClick={() => void handleImport()}>
        {t('panels.figures.importFigure')}
      </button>

      {errorKey && (
        <p role="alert" className="panel__error">
          {t(errorKey)}
        </p>
      )}

      {figures.length === 0 ? (
        <p className="panel__empty">{t('panels.figures.empty')}</p>
      ) : (
        <ul className="figures-panel__list">
          {figures.map((figure) => (
            <FigureRow
              key={figure.id}
              figure={figure}
              selected={figure.id === selectedFigureId}
              atLimit={atLimit}
            />
          ))}
        </ul>
      )}

      <PoseClipboard selectedFigure={selectedFigure ?? null} />

      {/* Objetos de cena (item 42): subseção deste painel, e não painel
          próprio — decisão do usuário, para não gastar mais uma coluna. */}
      <PropsSection />
    </CollapsiblePanel>
  )
}

interface PoseClipboardProps {
  selectedFigure: Figure | null
}

/**
 * Área de transferência de poses (pedido do usuário), no rodapé do painel de
 * Bonecos: copiar a pose de um boneco e colar em outro — inclusive **em outra
 * cena**, que é o que a separa de "Copiar pose para" do painel de Propriedades,
 * que precisa dos dois bonecos vivos ao mesmo tempo.
 *
 * Fica aqui, e não em Propriedades, porque a lista é da SESSÃO inteira e não do
 * boneco selecionado — em Propriedades ela sumiria a cada troca de seleção, que
 * é exatamente o gesto que se faz entre copiar e colar.
 *
 * O conteúdo vive só em memória (`poseClipboardStore`), por decisão do usuário.
 */
function PoseClipboard({ selectedFigure }: PoseClipboardProps) {
  const { t } = useTranslation()
  const entries = usePoseClipboardStore((state) => state.entries)
  const copyPose = usePoseClipboardStore((state) => state.copyPose)
  const removePose = usePoseClipboardStore((state) => state.removePose)
  const pasteFigurePose = useFiguresStore((state) => state.pasteFigurePose)

  return (
    <fieldset className="figures-panel__clipboard">
      <legend>{t('panels.figures.clipboard')}</legend>

      <button
        type="button"
        disabled={!selectedFigure}
        title={t('panels.figures.clipboardCopyHint')}
        onClick={() => selectedFigure && copyPose(selectedFigure)}
      >
        {t('panels.figures.clipboardCopy')}
      </button>

      {entries.length === 0 ? (
        <p className="figures-panel__hint">{t('panels.figures.clipboardEmpty')}</p>
      ) : (
        <>
          <ul className="figures-panel__clipboard-list">
            {entries.map((entry) => (
              <li key={entry.id} className="figures-panel__clipboard-item">
                <span className="figures-panel__clipboard-name" title={entry.name}>
                  {entry.name}
                </span>
                <button
                  type="button"
                  disabled={!selectedFigure}
                  title={t('panels.figures.clipboardPasteHint')}
                  onClick={() => selectedFigure && pasteFigurePose(selectedFigure.id, entry)}
                >
                  {t('panels.figures.clipboardPaste')}
                </button>
                <button
                  type="button"
                  className="figures-panel__clipboard-remove"
                  aria-label={t('panels.figures.clipboardRemove', { name: entry.name })}
                  title={t('panels.figures.clipboardRemove', { name: entry.name })}
                  onClick={() => removePose(entry.id)}
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
          {/* Sem boneco escolhido não há onde colar — dizer isso vale mais do
              que deixar os botões apagados sem explicação. */}
          {!selectedFigure && <p className="figures-panel__hint">{t('panels.figures.clipboardNoSelection')}</p>}
        </>
      )}
    </fieldset>
  )
}
