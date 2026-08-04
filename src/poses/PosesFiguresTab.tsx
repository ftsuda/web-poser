import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_FIGURES, useFiguresStore } from '../store/figuresStore'
import { MAX_HEIGHT_M, MIN_HEIGHT_M } from '../figure/skeleton'
import { POSE_PRESET_GROUPS, type PosePresetKey } from '../figure/posePresets'
import {
  POSE_PRESET_GROUP_LABEL_KEYS,
  POSE_PRESET_LABEL_KEYS,
} from '../layout/posePresetLabels'
import { usePosesShellStore } from '../store/posesShellStore'
import { UNDO_BATCH_POINTER_PROPS } from '../store/undoBatch'

/**
 * Aba "Bonecos": de 1 a 5 bonecos (o mesmo teto da aplicação completa), com o
 * boneco a editar ESCOLHIDO explicitamente — numa tela onde o alvo é o dedo,
 * ninguém edita por engano quem só estava passando na frente (PLANO.md, item
 * 44). Altura por boneco, o filtro "mostrar só o boneco em edição" e as POSES
 * DE PARTIDA (item 52): o plano original tirou os presets da Lite, mas montar
 * pose do zero no celular sem ponto de partida é trabalhoso — revisão
 * consciente, decidida pelo usuário ao mandar implementar o item.
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
  const applyPosePreset = useFiguresStore((state) => state.applyPosePreset)
  const showOnlyEditing = usePosesShellStore((state) => state.showOnlyEditing)
  const toggleShowOnlyEditing = usePosesShellStore((state) => state.toggleShowOnlyEditing)
  /** Preset escolhido no combo — aplicar é um passo à parte, como no desktop. */
  const [presetKey, setPresetKey] = useState<PosePresetKey>('standing')

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
            // Um passo de undo por arrasto do slider (DECISOES.md #118).
            {...UNDO_BATCH_POINTER_PROPS}
          />
        </label>
      )}

      {/* Pose de partida (item 52): o MESMO catálogo do desktop, com os mesmos
          rótulos (`posePresetLabels.ts`). Aplica ao boneco em edição pelas
          regras de sempre — X/Z preservados, juntas travadas intactas. Sem o
          pareamento automático de dupla: montar par é assunto do desktop. */}
      {selected && (
        <>
          <label className="poses-tab__field" htmlFor="poses-preset-select">
            {t('poses.figures.posePreset')}
            <select
              id="poses-preset-select"
              value={presetKey}
              onChange={(event) => setPresetKey(event.target.value as PosePresetKey)}
            >
              {POSE_PRESET_GROUPS.map((group) => (
                <optgroup key={group.key} label={t(POSE_PRESET_GROUP_LABEL_KEYS[group.key])}>
                  {group.poses.map((key) => (
                    <option key={key} value={key}>
                      {t(POSE_PRESET_LABEL_KEYS[key])}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="panel-action"
            onClick={() => applyPosePreset(selected.id, presetKey)}
          >
            {t('poses.figures.applyPose')}
          </button>
        </>
      )}

      <label className="poses-tab__toggle">
        <input type="checkbox" checked={showOnlyEditing} onChange={() => toggleShowOnlyEditing()} />
        <span>{t('poses.figures.showOnlyEditing')}</span>
      </label>
    </div>
  )
}
