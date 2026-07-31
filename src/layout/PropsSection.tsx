import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { controlPointCount } from '../props/propGeometry'
import {
  MAX_PROPS,
  MAX_PROP_SIZE_M,
  MIN_PROP_SIZE_M,
  PROP_SHAPES,
  vertexOffsetCount,
  type PropShape,
  type SceneProp,
} from '../props/sceneProp'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore, type PropGizmoMode } from '../store/uiStore'

/**
 * Subseção "Objetos de cena" no painel de Bonecos (item 42) — decisão do
 * usuário: um painel novo gastaria mais uma coluna numa tela que já tem seis.
 *
 * O que fica aqui é a LISTA (criar, nomear, cor, as três chaves de
 * visibilidade/trava, remover); o que é medida — posição, rotação, tamanho em
 * metros e vértices — fica no painel de Propriedades, junto do que se edita do
 * boneco selecionado.
 *
 * **As três chaves não são a mesma coisa, e a UI precisa dizer isso:**
 * `visible` tira o objeto de tudo (inclusive do PNG/MP4), "ocultar na bancada"
 * tira só da tela de trabalho, e "travar" deixa tudo visível mas fora do
 * alcance do clique.
 */
export function PropsSection() {
  const { t } = useTranslation()
  const props = useFiguresStore((state) => state.props)
  const nextPropSeq = useFiguresStore((state) => state.nextPropSeq)
  const selectedPropId = useFiguresStore((state) => state.selectedPropId)
  const addProp = useFiguresStore((state) => state.addProp)
  const setAllPropsHiddenInEditor = useFiguresStore((state) => state.setAllPropsHiddenInEditor)

  const [shape, setShape] = useState<PropShape>('box')

  const atLimit = props.length >= MAX_PROPS
  const allHidden = props.length > 0 && props.every((prop) => prop.hiddenInEditor)

  return (
    <fieldset className="props-section">
      <legend>{t('panels.figures.props.title')}</legend>

      <div className="props-section__add">
        <label className="props-section__shape">
          {t('panels.figures.props.shape')}
          <select value={shape} onChange={(event) => setShape(event.target.value as PropShape)}>
            {PROP_SHAPES.map((candidate) => (
              <option key={candidate} value={candidate}>
                {t(`panels.figures.props.shapes.${candidate}`)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={atLimit}
          title={atLimit ? t('panels.figures.props.addLimitReached', { max: MAX_PROPS }) : undefined}
          onClick={() => addProp(shape, t('panels.figures.props.defaultName', { index: nextPropSeq }))}
        >
          {t('panels.figures.props.add')}
        </button>
      </div>

      {props.length === 0 ? (
        <p className="panel__empty">{t('panels.figures.props.empty')}</p>
      ) : (
        <>
          {/* O gesto de limpar a mesa para posar: uma chave para os dois
              sentidos, em vez de percorrer a lista objeto a objeto. */}
          <label className="props-section__hide-all">
            <input
              type="checkbox"
              checked={allHidden}
              onChange={(event) => setAllPropsHiddenInEditor(event.target.checked)}
            />
            {t('panels.figures.props.hideAllInEditor')}
          </label>

          <ul className="props-section__list">
            {props.map((prop) => (
              <PropRow key={prop.id} prop={prop} selected={prop.id === selectedPropId} />
            ))}
          </ul>
        </>
      )}
    </fieldset>
  )
}

function PropRow({ prop, selected }: { prop: SceneProp; selected: boolean }) {
  const { t } = useTranslation()
  const selectProp = useFiguresStore((state) => state.selectProp)
  const renameProp = useFiguresStore((state) => state.renameProp)
  const removeProp = useFiguresStore((state) => state.removeProp)
  const duplicateProp = useFiguresStore((state) => state.duplicateProp)
  const setPropColor = useFiguresStore((state) => state.setPropColor)
  const togglePropVisible = useFiguresStore((state) => state.togglePropVisible)
  const togglePropHiddenInEditor = useFiguresStore((state) => state.togglePropHiddenInEditor)
  const togglePropLocked = useFiguresStore((state) => state.togglePropLocked)

  return (
    <li
      className={`props-section__row${selected ? ' props-section__row--selected' : ''}`}
      aria-selected={selected}
      onClick={() => selectProp(prop.id)}
    >
      <input
        type="color"
        className="props-section__swatch"
        title={t('panels.figures.props.changeColor')}
        aria-label={t('panels.figures.props.changeColor')}
        value={prop.color}
        onClick={(event) => event.stopPropagation()}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setPropColor(prop.id, event.target.value)}
      />

      <input
        className="props-section__name"
        type="text"
        aria-label={t('panels.figures.props.nameLabel')}
        value={prop.name}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => renameProp(prop.id, event.target.value)}
      />

      <button
        type="button"
        aria-pressed={!prop.visible}
        aria-label={t('panels.figures.props.toggleVisible')}
        title={t('panels.figures.props.toggleVisibleHint')}
        onClick={(event) => {
          event.stopPropagation()
          togglePropVisible(prop.id)
        }}
      >
        {prop.visible ? '◉' : '○'}
      </button>

      <button
        type="button"
        aria-pressed={prop.hiddenInEditor}
        aria-label={t('panels.figures.props.toggleHiddenInEditor')}
        title={t('panels.figures.props.toggleHiddenInEditorHint')}
        onClick={(event) => {
          event.stopPropagation()
          togglePropHiddenInEditor(prop.id)
        }}
      >
        {'▧'}
      </button>

      <button
        type="button"
        aria-pressed={prop.locked}
        aria-label={t('panels.figures.props.toggleLocked')}
        title={t('panels.figures.props.toggleLockedHint')}
        onClick={(event) => {
          event.stopPropagation()
          togglePropLocked(prop.id)
        }}
      >
        {prop.locked ? '\u{1F512}' : '\u{1F513}'}
      </button>

      <button
        type="button"
        aria-label={t('panels.figures.props.duplicate')}
        title={t('panels.figures.props.duplicate')}
        onClick={(event) => {
          event.stopPropagation()
          duplicateProp(prop.id)
        }}
      >
        &#10064;
      </button>

      <button
        type="button"
        className="props-section__remove"
        aria-label={t('panels.figures.props.remove')}
        onClick={(event) => {
          event.stopPropagation()
          removeProp(prop.id)
        }}
      >
        &times;
      </button>
    </li>
  )
}

const SIZE_AXES = [0, 1, 2] as const
const ROTATION_AXES = ['x', 'y', 'z'] as const
const PROP_GIZMO_MODES: readonly PropGizmoMode[] = ['translate', 'rotate', 'scale', 'vertex']

/**
 * O bloco de MEDIDAS do objeto selecionado, no painel de Propriedades: a
 * ferramenta em uso, posição, rotação, tamanho em metros e o estado da
 * deformação por vértice.
 *
 * O tamanho é sempre metro — o gizmo de escala é só outra forma de mexer neste
 * mesmo número (`figuresStore.setPropSize`), e os campos aqui e o arrasto lá
 * mostram exatamente o mesmo valor.
 */
export function PropProperties({ prop }: { prop: SceneProp }) {
  const { t } = useTranslation()
  const setPropShape = useFiguresStore((state) => state.setPropShape)
  const setPropPosition = useFiguresStore((state) => state.setPropPosition)
  const setPropRotation = useFiguresStore((state) => state.setPropRotation)
  const setPropSize = useFiguresStore((state) => state.setPropSize)
  const seatPropOnGround = useFiguresStore((state) => state.seatPropOnGround)
  const clearPropVertices = useFiguresStore((state) => state.clearPropVertices)
  const mode = useUIStore((state) => state.propGizmoMode)
  const setPropGizmoMode = useUIStore((state) => state.setPropGizmoMode)

  const moved = vertexOffsetCount(prop.vertexOffsets)

  return (
    <div className="prop-properties">
      <div className="prop-properties__tools" role="group" aria-label={t('panels.properties.prop.tool')}>
        {PROP_GIZMO_MODES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={mode === candidate}
            disabled={prop.locked}
            onClick={() => setPropGizmoMode(candidate)}
          >
            {t(`panels.properties.prop.tools.${candidate}`)}
          </button>
        ))}
      </div>

      {prop.locked && <p className="prop-properties__hint">{t('panels.properties.prop.lockedHint')}</p>}

      <label className="prop-properties__shape">
        {t('panels.figures.props.shape')}
        <select
          value={prop.shape}
          disabled={prop.locked}
          onChange={(event) => setPropShape(prop.id, event.target.value as PropShape)}
        >
          {PROP_SHAPES.map((candidate) => (
            <option key={candidate} value={candidate}>
              {t(`panels.figures.props.shapes.${candidate}`)}
            </option>
          ))}
        </select>
      </label>
      {/* Trocar a forma joga fora os vértices arrastados — dizer isso ANTES
          vale mais do que um desfazer depois. */}
      {moved > 0 && <p className="prop-properties__hint">{t('panels.properties.prop.shapeResetsVertices')}</p>}

      <fieldset className="prop-properties__vectors">
        <legend>{t('panels.properties.prop.size')}</legend>
        {SIZE_AXES.map((axis) => (
          <label key={axis}>
            {['X', 'Y', 'Z'][axis]}
            <input
              type="number"
              step={0.05}
              min={MIN_PROP_SIZE_M}
              max={MAX_PROP_SIZE_M}
              value={prop.size[axis]}
              disabled={prop.locked}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isNaN(value)) return
                const size: [number, number, number] = [...prop.size]
                size[axis] = value
                setPropSize(prop.id, size)
              }}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="prop-properties__vectors">
        <legend>{t('panels.properties.prop.position')}</legend>
        {SIZE_AXES.map((axis) => (
          <label key={axis}>
            {['X', 'Y', 'Z'][axis]}
            <input
              type="number"
              step={0.05}
              value={prop.position[axis]}
              disabled={prop.locked}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isNaN(value)) return
                const position: [number, number, number] = [...prop.position]
                position[axis] = value
                setPropPosition(prop.id, position)
              }}
            />
          </label>
        ))}
      </fieldset>

      <fieldset className="prop-properties__vectors">
        <legend>{t('panels.properties.prop.rotation')}</legend>
        {ROTATION_AXES.map((axis) => (
          <label key={axis}>
            {axis.toUpperCase()}
            <input
              type="number"
              step={5}
              value={prop.rotation[axis]}
              disabled={prop.locked}
              onChange={(event) => {
                const value = Number(event.target.value)
                if (Number.isNaN(value)) return
                setPropRotation(prop.id, { [axis]: value })
              }}
            />
          </label>
        ))}
      </fieldset>

      <button type="button" disabled={prop.locked} onClick={() => seatPropOnGround(prop.id)}>
        {t('panels.properties.prop.seatOnGround')}
      </button>

      <p className="prop-properties__vertices">
        {t('panels.properties.prop.vertexCount', { moved, total: controlPointCount(prop.shape) })}
      </p>
      <button
        type="button"
        disabled={prop.locked || moved === 0}
        onClick={() => clearPropVertices(prop.id)}
      >
        {t('panels.properties.prop.clearVertices')}
      </button>
    </div>
  )
}
