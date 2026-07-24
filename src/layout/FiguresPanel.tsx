import { useState, type ChangeEvent, type FocusEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  COLOR_PALETTE,
  MAX_FIGURES,
  useFiguresStore,
  type Figure,
} from '../store/figuresStore'
import { MAX_HEIGHT_M, MIN_HEIGHT_M } from '../figure/skeleton'
import { slugifySceneName } from '../keyframe/keyframeNaming'
import { pickFile, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { exportFigureToGlb, importFigureFromGlb } from '../persistence/sceneFile'
import { useIKStore } from '../store/ikStore'

function nextUnusedColor(figures: readonly Figure[], current: string): string {
  const used = new Set(figures.filter((figure) => figure.color !== current).map((f) => f.color))
  const startIndex = COLOR_PALETTE.indexOf(current)
  for (let offset = 1; offset <= COLOR_PALETTE.length; offset += 1) {
    const candidate = COLOR_PALETTE[(startIndex + offset) % COLOR_PALETTE.length]
    if (!used.has(candidate)) return candidate
  }
  return current
}

interface FigureRowProps {
  figure: Figure
  selected: boolean
  atLimit: boolean
}

function FigureRow({ figure, selected, atLimit }: FigureRowProps) {
  const { t } = useTranslation()
  const figures = useFiguresStore((state) => state.figures)
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

  const handleColorClick = () => {
    setColor(figure.id, nextUnusedColor(figures, figure.color))
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
      <button
        type="button"
        className="figures-panel__swatch"
        style={{ backgroundColor: figure.color }}
        title={t('panels.figures.changeColor')}
        aria-label={t('panels.figures.changeColor')}
        onClick={(event) => {
          event.stopPropagation()
          handleColorClick()
        }}
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
          useIKStore.getState().removeFigure(figure.id)
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

  const atLimit = figures.length >= MAX_FIGURES

  const handleAdd = () => {
    addFigure(t('panels.figures.defaultName', { index: nextFigureSeq }))
  }

  const handleImport = async () => {
    const picked = await pickFile('.glb')
    if (!picked) return
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
  }

  return (
    <aside className="panel panel--figures" aria-label={t('panels.figures.title')}>
      <h2>{t('panels.figures.title')}</h2>

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
    </aside>
  )
}
