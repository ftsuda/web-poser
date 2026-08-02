import { useTranslation } from 'react-i18next'
import { MAX_FIGURES, useFiguresStore } from '../store/figuresStore'
import { MAX_HEIGHT_M, MIN_HEIGHT_M } from '../figure/skeleton'
import { usePosesShellStore } from '../store/posesShellStore'

/**
 * Aba "Bonecos": de 1 a 5 bonecos (o mesmo teto da aplicação completa), com o
 * boneco a editar ESCOLHIDO explicitamente — numa tela onde o alvo é o dedo,
 * ninguém edita por engano quem só estava passando na frente (PLANO.md, item
 * 44). Altura por boneco e o filtro "mostrar só o boneco em edição".
 */
export function PosesFiguresTab() {
  const { t } = useTranslation()
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const nextFigureSeq = useFiguresStore((state) => state.nextFigureSeq)
  const addFigure = useFiguresStore((state) => state.addFigure)
  const removeFigure = useFiguresStore((state) => state.removeFigure)
  const selectFigure = useFiguresStore((state) => state.selectFigure)
  const setHeight = useFiguresStore((state) => state.setHeight)
  const showOnlyEditing = usePosesShellStore((state) => state.showOnlyEditing)
  const toggleShowOnlyEditing = usePosesShellStore((state) => state.toggleShowOnlyEditing)

  const selected = figures.find((candidate) => candidate.id === selectedFigureId) ?? null

  return (
    <div className="poses-tab">
      {figures.length === 0 ? (
        <p className="poses-tab__empty">{t('poses.figures.empty')}</p>
      ) : (
        <ul className="poses-figures">
          {figures.map((figure) => (
            <li key={figure.id}>
              <button
                type="button"
                className="poses-figures__select"
                aria-pressed={figure.id === selectedFigureId}
                onClick={() => selectFigure(figure.id)}
              >
                <span className="poses-figures__swatch" style={{ backgroundColor: figure.color }} />
                {figure.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="panel-actions">
        <button
          type="button"
          disabled={figures.length >= MAX_FIGURES}
          onClick={() => addFigure(t('panels.figures.defaultName', { index: nextFigureSeq }))}
        >
          {t('poses.figures.add')}
        </button>
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && removeFigure(selected.id)}
        >
          {t('poses.figures.remove')}
        </button>
      </div>

      {selected && (
        <label className="poses-tab__slider">
          <span>{t('poses.figures.height', { value: selected.height.toFixed(2) })}</span>
          <input
            type="range"
            min={MIN_HEIGHT_M}
            max={MAX_HEIGHT_M}
            step={0.01}
            value={selected.height}
            onChange={(event) => setHeight(selected.id, Number(event.target.value))}
          />
        </label>
      )}

      <label className="poses-tab__toggle">
        <input type="checkbox" checked={showOnlyEditing} onChange={() => toggleShowOnlyEditing()} />
        <span>{t('poses.figures.showOnlyEditing')}</span>
      </label>
    </div>
  )
}
