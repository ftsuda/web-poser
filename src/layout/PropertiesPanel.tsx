import type { ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HAND_PRESET_KEYS, type HandPresetKey } from '../figure/handPresets'
import { applyIKTarget, toggleLimbIK } from '../figure/ikActions'
import { JOINT_GROUPS, getArmSide, type JointGroupKey } from '../figure/jointGroups'
import { getLimbEndEffector } from '../figure/ikSolver'
import type { Side } from '../figure/poseMirror'
import { POSE_PRESET_KEYS, type PosePresetKey } from '../figure/posePresets'
import { ROOT_JOINT_NAME, getJoint, getJointAxes, type Axis } from '../figure/skeleton'
import { AXIS_COLORS } from '../scene/axisColors'
import { useFiguresStore } from '../store/figuresStore'
import { useIKStore } from '../store/ikStore'
import { useUIStore } from '../store/uiStore'
import { CollapsiblePanel } from './CollapsiblePanel'

const POSITION_AXES: readonly Axis[] = ['x', 'y', 'z']

/**
 * Faixa dos sliders de rotação do `root` (fase 9, item 13). Diferente das
 * demais juntas, a colocação do boneco na cena não passa por limites
 * articulares — é uma volta completa, em graus.
 */
const ROOT_ROTATION_MIN = -180
const ROOT_ROTATION_MAX = 180

interface AxisSliderProps {
  axis: Axis
  value: number
  min: number
  max: number
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  /** Botão de eixo ativo (setas do teclado) — só as juntas com FK têm. */
  activeAxis?: Axis | null
  onSelectAxis?: (axis: Axis) => void
  activeAxisTitle?: string
}

/**
 * Linha de slider de um eixo, com a cor do eixo correspondente no gizmo
 * (fase 9, item 9 — ver `axisColors.ts`). As cores vão por `style` inline, e
 * não por classe CSS, porque a fonte única delas é o módulo compartilhado com
 * a convenção do `TransformControls`.
 */
function AxisSlider({
  axis,
  value,
  min,
  max,
  onChange,
  activeAxis,
  onSelectAxis,
  activeAxisTitle,
}: AxisSliderProps) {
  const color = AXIS_COLORS[axis]
  const label = axis.toUpperCase()

  return (
    <div className="properties-panel__axis-row">
      {onSelectAxis ? (
        <button
          type="button"
          aria-pressed={axis === activeAxis}
          className="properties-panel__axis-button"
          style={{ color, borderColor: color }}
          title={activeAxisTitle}
          onClick={() => onSelectAxis(axis)}
        >
          {label}
        </button>
      ) : (
        <span className="properties-panel__axis-tag" style={{ color, borderColor: color }}>
          {label}
        </span>
      )}
      <input
        type="range"
        aria-label={label}
        style={{ accentColor: color }}
        min={min}
        max={max}
        value={value}
        onChange={onChange}
      />
      <span className="properties-panel__value">{Math.round(value)}°</span>
    </div>
  )
}

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
  const resetJointRotation = useFiguresStore((state) => state.resetJointRotation)
  const rootGizmoMode = useUIStore((state) => state.rootGizmoMode)
  const setRootGizmoMode = useUIStore((state) => state.setRootGizmoMode)
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
      <CollapsiblePanel panelKey="properties" className="panel--properties" title={t('panels.properties.title')}>
                <p className="panel__empty">{t('panels.properties.empty')}</p>
      </CollapsiblePanel>
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
    <CollapsiblePanel panelKey="properties" className="panel--properties" title={t('panels.properties.title')}>
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

          {/* Alternância translação/rotação do gizmo da raiz (fase 9, item
              13) — a rotação gira em torno do próprio pivô do quadril, ponto
              confirmado com o usuário. */}
          <fieldset aria-label={t('panels.properties.rootGizmoMode')}>
            <legend>{t('panels.properties.rootGizmoMode')}</legend>
            <div className="properties-panel__pose-presets">
              <button
                type="button"
                aria-pressed={rootGizmoMode === 'translate'}
                onClick={() => setRootGizmoMode('translate')}
              >
                {t('panels.properties.rootGizmoTranslate')}
              </button>
              <button
                type="button"
                aria-pressed={rootGizmoMode === 'rotate'}
                onClick={() => setRootGizmoMode('rotate')}
              >
                {t('panels.properties.rootGizmoRotate')}
              </button>
            </div>
          </fieldset>

          <fieldset aria-label={t('panels.properties.position')}>
            <legend>{t('panels.properties.position')}</legend>
            {POSITION_AXES.map((axis, index) => (
              <label key={axis} htmlFor={`position-${axis}`} className="properties-panel__field">
                <span style={{ color: AXIS_COLORS[axis] }}>{axis.toUpperCase()}</span>
                <input
                  id={`position-${axis}`}
                  type="number"
                  step={0.01}
                  style={{ accentColor: AXIS_COLORS[axis] }}
                  value={figure.position[index]}
                  onChange={handlePositionChange(index)}
                />
              </label>
            ))}
          </fieldset>

          {/* Rotação da raiz por slider, como nas demais juntas (fase 9, item
              13) — os campos numéricos livres não tinham nem faixa nem a
              mesma interação do resto do painel. */}
          <fieldset aria-label={t('panels.properties.rotation')}>
            <legend>{t('panels.properties.rotation')}</legend>
            {POSITION_AXES.map((axis) => (
              <AxisSlider
                key={axis}
                axis={axis}
                value={figure.rotation[axis]}
                min={ROOT_ROTATION_MIN}
                max={ROOT_ROTATION_MAX}
                onChange={handleRootRotationChange(axis)}
              />
            ))}
            <button
              type="button"
              className="properties-panel__reset"
              onClick={() => resetJointRotation(figure.id, ROOT_JOINT_NAME)}
            >
              {t('panels.properties.resetRootRotation')}
            </button>
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
                  <span style={{ color: AXIS_COLORS[axis] }}>{axis.toUpperCase()}</span>
                  <input
                    id={`ik-target-${axis}`}
                    type="number"
                    step={0.01}
                    style={{ accentColor: AXIS_COLORS[axis] }}
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

                return (
                  <AxisSlider
                    key={axis}
                    axis={axis}
                    value={figure.pose[selectedJointName]?.[axis] ?? 0}
                    min={limit.min}
                    max={limit.max}
                    onChange={handleJointRotationChange(axis)}
                    activeAxis={activeAxis}
                    onSelectAxis={setActiveAxis}
                    activeAxisTitle={t('panels.properties.makeActiveAxis', { axis: axis.toUpperCase() })}
                  />
                )
              })}

              {/* Reset por junta (fase 9, item 6): sem isto, voltar uma junta
                  ao neutro exigia acertar cada eixo na mão. */}
              <button
                type="button"
                className="properties-panel__reset"
                title={t('panels.properties.resetJointHint')}
                onClick={() => resetJointRotation(figure.id, selectedJointName)}
              >
                {t('panels.properties.resetJoint')}
              </button>
            </fieldset>
          )}
        </>
      )}
    </CollapsiblePanel>
  )
}
