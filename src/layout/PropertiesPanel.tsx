import { useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HAND_PRESET_KEYS, type HandPresetKey } from '../figure/handPresets'
import { applyIKTarget, toggleLimbIK } from '../figure/ikActions'
import { JOINT_GROUPS, getArmSide, type JointGroupKey } from '../figure/jointGroups'
import { getLimbEndEffector } from '../figure/ikSolver'
import { getMirrorScope, type Side } from '../figure/poseMirror'
import { getPosePairing } from '../figure/posePairs'
import { POSE_PRESET_GROUPS, type PosePresetGroupKey, type PosePresetKey } from '../figure/posePresets'
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
  punchGiving: 'panels.properties.posePresetPunchGiving',
  punchTaking: 'panels.properties.posePresetPunchTaking',
  kickGiving: 'panels.properties.posePresetKickGiving',
  kickTaking: 'panels.properties.posePresetKickTaking',
  chokeGiving: 'panels.properties.posePresetChokeGiving',
  chokeTaking: 'panels.properties.posePresetChokeTaking',
  apose: 'panels.properties.posePresetAPose',
  pointForward: 'panels.properties.posePresetPointForward',
  pointUp: 'panels.properties.posePresetPointUp',
  pointDown: 'panels.properties.posePresetPointDown',
  pointFar: 'panels.properties.posePresetPointFar',
  pointAtOther: 'panels.properties.posePresetPointAtOther',
  presenting: 'panels.properties.posePresetPresenting',
  pointSelf: 'panels.properties.posePresetPointSelf',
  thumbBack: 'panels.properties.posePresetThumbBack',
  squat: 'panels.properties.posePresetSquat',
  kneelingOneKnee: 'panels.properties.posePresetKneelingOneKnee',
  kneelingBoth: 'panels.properties.posePresetKneelingBoth',
  crossLegged: 'panels.properties.posePresetCrossLegged',
  allFours: 'panels.properties.posePresetAllFours',
  plank: 'panels.properties.posePresetPlank',
  pronePropped: 'panels.properties.posePresetPronePropped',
  sideLying: 'panels.properties.posePresetSideLying',
  touchToes: 'panels.properties.posePresetTouchToes',
  armsCrossed: 'panels.properties.posePresetArmsCrossed',
  handsOnHips: 'panels.properties.posePresetHandsOnHips',
  waving: 'panels.properties.posePresetWaving',
  celebrating: 'panels.properties.posePresetCelebrating',
  handOnChin: 'panels.properties.posePresetHandOnChin',
  headDown: 'panels.properties.posePresetHeadDown',
  startled: 'panels.properties.posePresetStartled',
  jumping: 'panels.properties.posePresetJumping',
  throwing: 'panels.properties.posePresetThrowing',
  kickingBall: 'panels.properties.posePresetKickingBall',
  carryingBox: 'panels.properties.posePresetCarryingBox',
  climbing: 'panels.properties.posePresetClimbing',
  stepUp: 'panels.properties.posePresetStepUp',
  handshake: 'panels.properties.posePresetHandshake',
  hug: 'panels.properties.posePresetHug',
  danceLead: 'panels.properties.posePresetDanceLead',
  danceFollow: 'panels.properties.posePresetDanceFollow',
  carryingPiggyback: 'panels.properties.posePresetCarryingPiggyback',
  carriedPiggyback: 'panels.properties.posePresetCarriedPiggyback',
  carryingCradle: 'panels.properties.posePresetCarryingCradle',
  carriedCradle: 'panels.properties.posePresetCarriedCradle',
  pullingUp: 'panels.properties.posePresetPullingUp',
  beingPulledUp: 'panels.properties.posePresetBeingPulledUp',
  pushGiving: 'panels.properties.posePresetPushGiving',
  pushTaking: 'panels.properties.posePresetPushTaking',
  clinch: 'panels.properties.posePresetClinch',
  meditating: 'panels.properties.posePresetMeditating',
  businessman: 'panels.properties.posePresetBusinessman',
  heroStance: 'panels.properties.posePresetHeroStance',
  lyingSpreadSupine: 'panels.properties.posePresetLyingSpreadSupine',
  lyingSpreadProne: 'panels.properties.posePresetLyingSpreadProne',
  sittingLegsForward: 'panels.properties.posePresetSittingLegsForward',
  sittingKneesBent: 'panels.properties.posePresetSittingKneesBent',
  rearChokeKneeling: 'panels.properties.posePresetRearChokeKneeling',
  rearChokeSeated: 'panels.properties.posePresetRearChokeSeated',
  groundChokeGiving: 'panels.properties.posePresetGroundChokeGiving',
  groundChokeTaking: 'panels.properties.posePresetGroundChokeTaking',
}

/** Descrição longa (tooltip) das poses cujo rótulo curto não se explica sozinho. */
const POSE_PRESET_HINT_KEYS: Partial<Record<PosePresetKey, string>> = {
  lyingHandsBehindHead: 'panels.properties.posePresetLyingHint',
  fetal: 'panels.properties.posePresetFetalHint',
  fighting: 'panels.properties.posePresetFightingHint',
  superman: 'panels.properties.posePresetSupermanHint',
  model: 'panels.properties.posePresetModelHint',
  // As poses de luta vêm em par: a dica de cada uma diz com qual outra ela
  // se encaixa, senão não dá para saber que existe um par (DECISOES.md #35).
  punchGiving: 'panels.properties.posePresetPunchGivingHint',
  punchTaking: 'panels.properties.posePresetPunchTakingHint',
  kickGiving: 'panels.properties.posePresetKickGivingHint',
  kickTaking: 'panels.properties.posePresetKickTakingHint',
  chokeGiving: 'panels.properties.posePresetChokeGivingHint',
  chokeTaking: 'panels.properties.posePresetChokeTakingHint',
  apose: 'panels.properties.posePresetAPoseHint',
  pointForward: 'panels.properties.posePresetPointForwardHint',
  pointUp: 'panels.properties.posePresetPointUpHint',
  pointDown: 'panels.properties.posePresetPointDownHint',
  pointFar: 'panels.properties.posePresetPointFarHint',
  pointAtOther: 'panels.properties.posePresetPointAtOtherHint',
  presenting: 'panels.properties.posePresetPresentingHint',
  pointSelf: 'panels.properties.posePresetPointSelfHint',
  thumbBack: 'panels.properties.posePresetThumbBackHint',
  squat: 'panels.properties.posePresetSquatHint',
  kneelingOneKnee: 'panels.properties.posePresetKneelingOneKneeHint',
  kneelingBoth: 'panels.properties.posePresetKneelingBothHint',
  crossLegged: 'panels.properties.posePresetCrossLeggedHint',
  allFours: 'panels.properties.posePresetAllFoursHint',
  plank: 'panels.properties.posePresetPlankHint',
  pronePropped: 'panels.properties.posePresetProneProppedHint',
  sideLying: 'panels.properties.posePresetSideLyingHint',
  touchToes: 'panels.properties.posePresetTouchToesHint',
  armsCrossed: 'panels.properties.posePresetArmsCrossedHint',
  handsOnHips: 'panels.properties.posePresetHandsOnHipsHint',
  waving: 'panels.properties.posePresetWavingHint',
  celebrating: 'panels.properties.posePresetCelebratingHint',
  handOnChin: 'panels.properties.posePresetHandOnChinHint',
  headDown: 'panels.properties.posePresetHeadDownHint',
  startled: 'panels.properties.posePresetStartledHint',
  jumping: 'panels.properties.posePresetJumpingHint',
  throwing: 'panels.properties.posePresetThrowingHint',
  kickingBall: 'panels.properties.posePresetKickingBallHint',
  carryingBox: 'panels.properties.posePresetCarryingBoxHint',
  climbing: 'panels.properties.posePresetClimbingHint',
  stepUp: 'panels.properties.posePresetStepUpHint',
  // Nos pares, a dica é a única coisa que diz a DISTÂNCIA em que as duas
  // poses se encaixam — sem ela o encaixe resolvido numericamente não chega
  // ao usuário (DECISOES.md #37).
  handshake: 'panels.properties.posePresetHandshakeHint',
  hug: 'panels.properties.posePresetHugHint',
  danceLead: 'panels.properties.posePresetDanceLeadHint',
  danceFollow: 'panels.properties.posePresetDanceFollowHint',
  carryingPiggyback: 'panels.properties.posePresetCarryingPiggybackHint',
  carriedPiggyback: 'panels.properties.posePresetCarriedPiggybackHint',
  carryingCradle: 'panels.properties.posePresetCarryingCradleHint',
  carriedCradle: 'panels.properties.posePresetCarriedCradleHint',
  pullingUp: 'panels.properties.posePresetPullingUpHint',
  beingPulledUp: 'panels.properties.posePresetBeingPulledUpHint',
  pushGiving: 'panels.properties.posePresetPushGivingHint',
  pushTaking: 'panels.properties.posePresetPushTakingHint',
  clinch: 'panels.properties.posePresetClinchHint',
  meditating: 'panels.properties.posePresetMeditatingHint',
  businessman: 'panels.properties.posePresetBusinessmanHint',
  heroStance: 'panels.properties.posePresetHeroStanceHint',
  lyingSpreadSupine: 'panels.properties.posePresetLyingSpreadSupineHint',
  lyingSpreadProne: 'panels.properties.posePresetLyingSpreadProneHint',
  sittingLegsForward: 'panels.properties.posePresetSittingLegsForwardHint',
  sittingKneesBent: 'panels.properties.posePresetSittingKneesBentHint',
  rearChokeKneeling: 'panels.properties.posePresetRearChokeKneelingHint',
  rearChokeSeated: 'panels.properties.posePresetRearChokeSeatedHint',
  groundChokeGiving: 'panels.properties.posePresetGroundChokeGivingHint',
  groundChokeTaking: 'panels.properties.posePresetGroundChokeTakingHint',
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

interface SymmetryFieldsetProps {
  figureId: string
  /**
   * Junta a partir da qual a simetria vale (ela e seus descendentes), ou `null`
   * na raiz — aí é o boneco inteiro.
   */
  scopeJoint: string | null
}

/**
 * Espelhar/inverter os lados (DECISOES.md #30), agora com escopo parcial
 * (#34): os mesmos três botões aparecem na raiz e em qualquer junta que tenha
 * par embaixo, e o que muda é só até onde eles alcançam. Ficam ocultos onde
 * não há nada a espelhar (pescoço, cabeça), em vez de aparecerem sem efeito.
 *
 * Os rótulos continuam dizendo a direção da cópia (direito → esquerdo) em vez
 * de "deste lado para o outro": o escopo não depende do lado da junta
 * selecionada, então a direção precisa ser escolhida pelo botão.
 */
function SymmetryFieldset({ figureId, scopeJoint }: SymmetryFieldsetProps) {
  const { t } = useTranslation()
  const mirrorSide = useFiguresStore((state) => state.mirrorSide)
  const swapSides = useFiguresStore((state) => state.swapSides)

  if (getMirrorScope(scopeJoint).length === 0) return null

  return (
    <fieldset aria-label={t('panels.properties.symmetry')}>
      <legend>{t('panels.properties.symmetry')}</legend>
      <p className="properties-panel__hint">
        {scopeJoint
          ? t('panels.properties.symmetryScopeHint', { joint: scopeJoint })
          : t('panels.properties.symmetryHint')}
      </p>
      <div className="properties-panel__pose-presets">
        <button type="button" onClick={() => mirrorSide(figureId, 'R', scopeJoint)}>
          {t('panels.properties.mirrorFromRight')}
        </button>
        <button type="button" onClick={() => mirrorSide(figureId, 'L', scopeJoint)}>
          {t('panels.properties.mirrorFromLeft')}
        </button>
        <button type="button" onClick={() => swapSides(figureId, scopeJoint)}>
          {t('panels.properties.swapSides')}
        </button>
      </div>
    </fieldset>
  )
}

const JOINT_GROUP_LABEL_KEYS: Record<JointGroupKey, string> = {
  trunk: 'panels.properties.jointGroupTrunk',
  head: 'panels.properties.jointGroupHead',
  armRight: 'panels.properties.jointGroupArmRight',
  armLeft: 'panels.properties.jointGroupArmLeft',
  legRight: 'panels.properties.jointGroupLegRight',
  legLeft: 'panels.properties.jointGroupLegLeft',
}

const POSE_PRESET_GROUP_LABEL_KEYS: Record<PosePresetGroupKey, string> = {
  reference: 'panels.properties.poseGroupReference',
  everyday: 'panels.properties.poseGroupEveryday',
  ground: 'panels.properties.poseGroupGround',
  pointing: 'panels.properties.poseGroupPointing',
  action: 'panels.properties.poseGroupAction',
  expressive: 'panels.properties.poseGroupExpressive',
  pairs: 'panels.properties.poseGroupPairs',
  fight: 'panels.properties.poseGroupFight',
}

export function PropertiesPanel() {
  const { t } = useTranslation()
  // Qual pose está ESCOLHIDA no combo — aplicar é um passo à parte.
  const [selectedPose, setSelectedPose] = useState<PosePresetKey>('standing')
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
  const applyRandomPose = useFiguresStore((state) => state.applyRandomPose)
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
  const selectedPoseHintKey = POSE_PRESET_HINT_KEYS[selectedPose]
  // Aviso de que aplicar vai mexer TAMBÉM no outro boneco (DECISOES.md #41).
  // Só aparece quando isso de fato vai acontecer — com um boneco só, ou com
  // três, a montagem continua manual e a dica da pose (com a distância) é que
  // vale.
  const pairsAutomatically = figures.length === 2 && getPosePairing(selectedPose) !== null
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
          {/* Combo agrupado + botão "Aplicar" (pedido do usuário, DECISOES.md
              #36): com mais de 30 poses a grade de botões deixou de caber. A
              escolha não aplica sozinha — só o botão aplica —, para que
              navegar pela lista com o teclado não desmonte a pose atual. */}
          <fieldset aria-label={t('panels.properties.posePresets')}>
            <legend>{t('panels.properties.posePresets')}</legend>
              <select
                id="pose-preset-select"
                className="properties-panel__pose-select"
                aria-label={t('panels.properties.posePresets')}
                value={selectedPose}
                onChange={(event) => setSelectedPose(event.target.value as PosePresetKey)}
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
            {selectedPoseHintKey && (
              <p className="properties-panel__hint">{t(selectedPoseHintKey)}</p>
            )}
            {pairsAutomatically && (
              <p className="properties-panel__hint">{t('panels.properties.posePairAuto')}</p>
            )}
            <div className="properties-panel__pose-presets">
              <button
                type="button"
                className="properties-panel__apply-pose"
                onClick={() => applyPosePreset(figure.id, selectedPose)}
              >
                {t('panels.properties.applyPose')}
              </button>
              {/* O sorteio fica FORA do combo (pedido do usuário): não é uma
                  pose da lista — cada clique dá uma diferente. */}
              <button
                type="button"
                className="properties-panel__random-pose"
                title={t('panels.properties.randomPoseHint')}
                onClick={() => applyRandomPose(figure.id)}
              >
                {t('panels.properties.randomPose')}
              </button>
            </div>
          </fieldset>

          <SymmetryFieldset figureId={figure.id} scopeJoint={null} />

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

          {/* Simetria parcial (DECISOES.md #34): daqui para baixo, nos dois
              lados. Fica depois da rotação para não empurrar os sliders — o
              controle principal da junta — para longe do topo do painel. */}
          <SymmetryFieldset figureId={figure.id} scopeJoint={selectedJointName} />
        </>
      )}
    </CollapsiblePanel>
  )
}
