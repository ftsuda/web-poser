import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HAND_PRESET_KEYS, type HandPresetKey } from '../figure/handPresets'
import { applyIKTarget, toggleLimbIK } from '../figure/ikActions'
import { JOINT_GROUPS, getArmSide, type JointGroupKey } from '../figure/jointGroups'
import { getLimbEndEffector } from '../figure/ikSolver'
import type { Side } from '../figure/poseMirror'
import { POSE_PRESET_KEYS, type PosePresetKey } from '../figure/posePresets'
import { ROOT_JOINT_NAME, getJoint, getJointAxes, type Axis } from '../figure/skeleton'
import { useFiguresStore } from '../store/figuresStore'
import { useIKStore } from '../store/ikStore'

const POSITION_AXES: readonly Axis[] = ['x', 'y', 'z']

const POSE_PRESET_LABEL_KEYS: Record<PosePresetKey, string> = {
  standing: 'panels.properties.posePresetStanding',
  tpose: 'panels.properties.posePresetTPose',
  sitting: 'panels.properties.posePresetSitting',
  walking: 'panels.properties.posePresetWalking',
  running: 'panels.properties.posePresetRunning',
  lyingHandsBehindHead: 'panels.properties.posePresetLying',
  fetal: 'panels.properties.posePresetFetal',
  fighting: 'panels.properties.posePresetFighting',
  superman: 'panels.properties.posePresetSuperman',
  model: 'panels.properties.posePresetModel',
}

/** Descrição longa (tooltip) das poses cujo rótulo curto não se explica sozinho. */
const POSE_PRESET_HINT_KEYS: Partial<Record<PosePresetKey, string>> = {
  lyingHandsBehindHead: 'panels.properties.posePresetLyingHint',
  fetal: 'panels.properties.posePresetFetalHint',
  fighting: 'panels.properties.posePresetFightingHint',
  superman: 'panels.properties.posePresetSupermanHint',
  model: 'panels.properties.posePresetModelHint',
}

const HAND_PRESET_LABEL_KEYS: Record<HandPresetKey, string> = {
  open: 'panels.properties.handPresetOpen',
  relaxed: 'panels.properties.handPresetRelaxed',
  fist: 'panels.properties.handPresetFist',
  thumbsUp: 'panels.properties.handPresetThumbsUp',
}

const HAND_PRESETS_LEGEND_KEYS: Record<Side, string> = {
  L: 'panels.properties.handPresetsLeft',
  R: 'panels.properties.handPresetsRight',
}

const JOINT_GROUP_LABEL_KEYS: Record<JointGroupKey, string> = {
  trunk: 'panels.properties.jointGroupTrunk',
  head: 'panels.properties.jointGroupHead',
  armRight: 'panels.properties.jointGroupArmRight',
  armLeft: 'panels.properties.jointGroupArmLeft',
  legRight: 'panels.properties.jointGroupLegRight',
  legLeft: 'panels.properties.jointGroupLegLeft',
}

export function PropertiesPanel() {
  const { t } = useTranslation()
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedJointName = useFiguresStore((state) => state.selectedJointName)
  const selectJoint = useFiguresStore((state) => state.selectJoint)
  const activeAxis = useFiguresStore((state) => state.activeAxis)
  const setPosition = useFiguresStore((state) => state.setPosition)
  const setRootRotation = useFiguresStore((state) => state.setRootRotation)
  const setJointRotation = useFiguresStore((state) => state.setJointRotation)
  const setActiveAxis = useFiguresStore((state) => state.setActiveAxis)
  const applyPosePreset = useFiguresStore((state) => state.applyPosePreset)
  const applyHandPreset = useFiguresStore((state) => state.applyHandPreset)
  const mirrorSide = useFiguresStore((state) => state.mirrorSide)
  const swapSides = useFiguresStore((state) => state.swapSides)
  // Não é usado diretamente: assina a customização de limites do workspace só
  // para que as faixas dos sliders (lidas de `getJoint`) sejam recalculadas
  // quando ela mudar — ver DECISOES.md #29.
  useFiguresStore((state) => state.jointLimits)

  const figure = figures.find((f) => f.id === selectedFigureId)
  const limbEndEffector = selectedJointName ? getLimbEndEffector(selectedJointName) : null
  const ikEnabled = useIKStore((state) =>
    figure && limbEndEffector ? state.isLimbEnabled(figure.id, limbEndEffector) : false,
  )
  const ikTarget = useIKStore((state) =>
    figure && limbEndEffector ? state.getTarget(figure.id, limbEndEffector) : undefined,
  )
  const ikReached = useIKStore((state) =>
    figure && limbEndEffector ? state.getReached(figure.id, limbEndEffector) : true,
  )

  if (!figure || !selectedJointName) {
    return (
      <aside className="panel panel--properties" aria-label={t('panels.properties.title')}>
        <h2>{t('panels.properties.title')}</h2>
        <p className="panel__empty">{t('panels.properties.empty')}</p>
      </aside>
    )
  }

  const isRoot = selectedJointName === ROOT_JOINT_NAME
  // Poses de mão aparecem no contexto: qualquer junta do braço (clavícula →
  // ponta dos dedos) revela as poses DAQUELA mão, sem um seletor de lado à
  // parte (ver DECISOES.md #30).
  const armSide = getArmSide(selectedJointName)
  // Ombro/cotovelo (ou quadril/joelho) somem dos controles de FK enquanto o
  // membro estiver em IK — só a própria junta-efetuador (pulso/tornozelo)
  // continua com seus eixos de FK próprios (torção, sem efeito na posição do
  // alvo), já que o IK não controla essa junta — ver PLANO.md > "Interação
  // de pose", passo 3, e a decisão de UI em DECISOES.md.
  const isIKControlledJoint = ikEnabled && limbEndEffector !== null && selectedJointName !== limbEndEffector

  const handleIKTargetChange =
    (index: number) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = Number(event.target.value)
      if (Number.isNaN(value) || !limbEndEffector || !ikTarget) return
      const next = [...ikTarget] as [number, number, number]
      next[index] = value
      applyIKTarget(figure.id, limbEndEffector, next)
    }

  const handlePositionChange =
    (index: number) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = Number(event.target.value)
      if (Number.isNaN(value)) return
      const next = [...figure.position] as [number, number, number]
      next[index] = value
      setPosition(figure.id, next)
    }

  const handleRootRotationChange =
    (axis: Axis) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = Number(event.target.value)
      if (Number.isNaN(value)) return
      setRootRotation(figure.id, { [axis]: value })
    }

  const handleJointRotationChange =
    (axis: Axis) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const value = Number(event.target.value)
      if (Number.isNaN(value)) return
      setJointRotation(figure.id, selectedJointName, { [axis]: value })
    }

  return (
    <aside className="panel panel--properties" aria-label={t('panels.properties.title')}>
      <h2>{t('panels.properties.title')}</h2>
      <p className="properties-panel__figure-name">{figure.name}</p>

      <label className="properties-panel__field properties-panel__joint-select" htmlFor="joint-select">
        {t('panels.properties.jointSelect')}
        <select
          id="joint-select"
          value={selectedJointName}
          onChange={(event) => selectJoint(event.target.value)}
        >
          <option value={ROOT_JOINT_NAME}>{t('panels.properties.jointSelectRoot')}</option>
          {JOINT_GROUPS.map((group) => (
            <optgroup key={group.key} label={t(JOINT_GROUP_LABEL_KEYS[group.key])}>
              {group.joints.map((jointName) => (
                <option key={jointName} value={jointName}>
                  {jointName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      {isRoot ? (
        <>
          <fieldset aria-label={t('panels.properties.posePresets')}>
            <legend>{t('panels.properties.posePresets')}</legend>
            <div className="properties-panel__pose-presets">
              {POSE_PRESET_KEYS.map((key) => {
                const hintKey = POSE_PRESET_HINT_KEYS[key]
                return (
                  <button
                    key={key}
                    type="button"
                    title={hintKey ? t(hintKey) : undefined}
                    onClick={() => applyPosePreset(figure.id, key)}
                  >
                    {t(POSE_PRESET_LABEL_KEYS[key])}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset aria-label={t('panels.properties.symmetry')}>
            <legend>{t('panels.properties.symmetry')}</legend>
            <p className="properties-panel__hint">{t('panels.properties.symmetryHint')}</p>
            <div className="properties-panel__pose-presets">
              <button type="button" onClick={() => mirrorSide(figure.id, 'R')}>
                {t('panels.properties.mirrorFromRight')}
              </button>
              <button type="button" onClick={() => mirrorSide(figure.id, 'L')}>
                {t('panels.properties.mirrorFromLeft')}
              </button>
              <button type="button" onClick={() => swapSides(figure.id)}>
                {t('panels.properties.swapSides')}
              </button>
            </div>
          </fieldset>

          <fieldset aria-label={t('panels.properties.position')}>
            <legend>{t('panels.properties.position')}</legend>
            {POSITION_AXES.map((axis, index) => (
              <label key={axis} htmlFor={`position-${axis}`} className="properties-panel__field">
                {axis.toUpperCase()}
                <input
                  id={`position-${axis}`}
                  type="number"
                  step={0.01}
                  value={figure.position[index]}
                  onChange={handlePositionChange(index)}
                />
              </label>
            ))}
          </fieldset>

          <fieldset aria-label={t('panels.properties.rotation')}>
            <legend>{t('panels.properties.rotation')}</legend>
            {POSITION_AXES.map((axis) => (
              <label key={axis} htmlFor={`rotation-${axis}`} className="properties-panel__field">
                {axis.toUpperCase()}
                <input
                  id={`rotation-${axis}`}
                  type="number"
                  step={1}
                  value={figure.rotation[axis]}
                  onChange={handleRootRotationChange(axis)}
                />
              </label>
            ))}
          </fieldset>
        </>
      ) : (
        <>
          <p className="properties-panel__joint-name">
            {t('panels.properties.selectedJoint')}: <span>{selectedJointName}</span>
          </p>

          {armSide && (
            <fieldset aria-label={t(HAND_PRESETS_LEGEND_KEYS[armSide])}>
              <legend>{t(HAND_PRESETS_LEGEND_KEYS[armSide])}</legend>
              <div className="properties-panel__pose-presets">
                {HAND_PRESET_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyHandPreset(figure.id, armSide, key)}
                  >
                    {t(HAND_PRESET_LABEL_KEYS[key])}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {limbEndEffector && (
            <label className="properties-panel__field properties-panel__field--checkbox">
              <input
                type="checkbox"
                checked={ikEnabled}
                onChange={() => toggleLimbIK(figure.id, limbEndEffector)}
              />
              {t('panels.properties.ikEnabled')}
            </label>
          )}

          {ikEnabled && limbEndEffector && (
            <fieldset aria-label={t('panels.properties.ikTarget')}>
              <legend>{t('panels.properties.ikTarget')}</legend>
              {!ikReached && <p className="properties-panel__hint properties-panel__hint--warning">{t('panels.properties.ikUnreachable')}</p>}
              {POSITION_AXES.map((axis, index) => (
                <label key={axis} htmlFor={`ik-target-${axis}`} className="properties-panel__field">
                  {axis.toUpperCase()}
                  <input
                    id={`ik-target-${axis}`}
                    type="number"
                    step={0.01}
                    value={ikTarget?.[index] ?? 0}
                    onChange={handleIKTargetChange(index)}
                  />
                </label>
              ))}
            </fieldset>
          )}

          {!isIKControlledJoint && (
            <fieldset aria-label={t('panels.properties.rotation')}>
              <legend>{t('panels.properties.rotation')}</legend>
              <p className="properties-panel__hint">{t('panels.properties.activeAxisHint')}</p>

              {getJointAxes(selectedJointName).map((axis) => {
                const limit = getJoint(selectedJointName).limits[axis]
                if (!limit) return null
                const value = figure.pose[selectedJointName]?.[axis] ?? 0

                return (
                  <div key={axis} className="properties-panel__axis-row">
                    <button
                      type="button"
                      aria-pressed={axis === activeAxis}
                      className="properties-panel__axis-button"
                      title={t('panels.properties.makeActiveAxis', { axis: axis.toUpperCase() })}
                      onClick={() => setActiveAxis(axis)}
                    >
                      {axis.toUpperCase()}
                    </button>
                    <input
                      type="range"
                      aria-label={axis.toUpperCase()}
                      min={limit.min}
                      max={limit.max}
                      value={value}
                      onChange={handleJointRotationChange(axis)}
                    />
                    <span className="properties-panel__value">{Math.round(value)}°</span>
                  </div>
                )
              })}
            </fieldset>
          )}
        </>
      )}
    </aside>
  )
}
