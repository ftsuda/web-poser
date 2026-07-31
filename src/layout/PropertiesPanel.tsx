import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HAND_PRESET_KEYS, type HandPresetKey } from '../figure/handPresets'
import { isDraggableJoint } from '../figure/dragSolver'
import { JOINT_GROUPS, getArmSide, type JointGroupKey } from '../figure/jointGroups'
import { getLockedJoints } from '../figure/jointLocks'
import { figureBlendState, resolveBlendTarget, type BlendablePose, type BlendSource } from '../figure/poseBlend'
import { getMirrorScope, type Side } from '../figure/poseMirror'
import { getPosePairing } from '../figure/posePairs'
import {
  POSE_PRESET_GROUPS,
  resolvePosePreset,
  resolvePosePresetPlacement,
  type PosePresetGroupKey,
  type PosePresetKey,
} from '../figure/posePresets'
import { ROOT_JOINT_NAME, getJoint, getJointAxes, type Axis } from '../figure/skeleton'
import { AXIS_COLORS } from '../scene/axisColors'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore, type GizmoMode } from '../store/uiStore'
import { CollapsiblePanel } from './CollapsiblePanel'
import { PropProperties } from './PropsSection'

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
  /** Junta travada (DECISOES.md #42): o slider fica inerte, e não "volta sozinho". */
  disabled?: boolean
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
  disabled,
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
        disabled={disabled}
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
  kpopFingerHeart: 'panels.properties.posePresetKpopFingerHeart',
  kpopBoxArms: 'panels.properties.posePresetKpopBoxArms',
  kpopPointDance: 'panels.properties.posePresetKpopPointDance',
  kpopShoulderWave: 'panels.properties.posePresetKpopShoulderWave',
  jumping: 'panels.properties.posePresetJumping',
  throwing: 'panels.properties.posePresetThrowing',
  kickingBall: 'panels.properties.posePresetKickingBall',
  carryingBox: 'panels.properties.posePresetCarryingBox',
  climbing: 'panels.properties.posePresetClimbing',
  stepUp: 'panels.properties.posePresetStepUp',
  balletPreparation: 'panels.properties.posePresetBalletPreparation',
  balletPirouette: 'panels.properties.posePresetBalletPirouette',
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
  kneeStrikeGiving: 'panels.properties.posePresetKneeStrikeGiving',
  kneeStrikeTaking: 'panels.properties.posePresetKneeStrikeTaking',
  armLockPushGiving: 'panels.properties.posePresetArmLockPushGiving',
  armLockPushTaking: 'panels.properties.posePresetArmLockPushTaking',
  armLockPullGiving: 'panels.properties.posePresetArmLockPullGiving',
  armLockPullTaking: 'panels.properties.posePresetArmLockPullTaking',
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
  kpopFingerHeart: 'panels.properties.posePresetKpopFingerHeartHint',
  kpopBoxArms: 'panels.properties.posePresetKpopBoxArmsHint',
  kpopPointDance: 'panels.properties.posePresetKpopPointDanceHint',
  kpopShoulderWave: 'panels.properties.posePresetKpopShoulderWaveHint',
  jumping: 'panels.properties.posePresetJumpingHint',
  throwing: 'panels.properties.posePresetThrowingHint',
  kickingBall: 'panels.properties.posePresetKickingBallHint',
  carryingBox: 'panels.properties.posePresetCarryingBoxHint',
  climbing: 'panels.properties.posePresetClimbingHint',
  stepUp: 'panels.properties.posePresetStepUpHint',
  balletPreparation: 'panels.properties.posePresetBalletPreparationHint',
  balletPirouette: 'panels.properties.posePresetBalletPirouetteHint',
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
  kneeStrikeGiving: 'panels.properties.posePresetKneeStrikeGivingHint',
  kneeStrikeTaking: 'panels.properties.posePresetKneeStrikeTakingHint',
  armLockPushGiving: 'panels.properties.posePresetArmLockPushGivingHint',
  armLockPushTaking: 'panels.properties.posePresetArmLockPushTakingHint',
  armLockPullGiving: 'panels.properties.posePresetArmLockPullGivingHint',
  armLockPullTaking: 'panels.properties.posePresetArmLockPullTakingHint',
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
  point: 'panels.properties.handPresetPoint',
  pinch: 'panels.properties.handPresetPinch',
}

const HAND_PRESETS_LEGEND_KEYS: Record<Side, string> = {
  L: 'panels.properties.handPresetsLeft',
  R: 'panels.properties.handPresetsRight',
}

/**
 * Seletor mover/girar do gizmo (W/E) — o mesmo modo global do `uiStore`,
 * mostrado tanto na seção da raiz (mover/girar a colocação, fase 9, item 13)
 * quanto nas juntas arrastáveis (arrasto de cadeia / rotação FK). Juntas sem
 * arrasto não o mostram: nelas só existe rotação.
 */
function GizmoModeFieldset({ mode, onSelect }: { mode: GizmoMode; onSelect: (mode: GizmoMode) => void }) {
  const { t } = useTranslation()

  return (
    <fieldset aria-label={t('panels.properties.gizmoMode')}>
      <legend>{t('panels.properties.gizmoMode')}</legend>
      <div className="properties-panel__pose-presets">
        <button type="button" aria-pressed={mode === 'translate'} onClick={() => onSelect('translate')}>
          {t('panels.properties.gizmoTranslate')}
        </button>
        <button type="button" aria-pressed={mode === 'rotate'} onClick={() => onSelect('rotate')}>
          {t('panels.properties.gizmoRotate')}
        </button>
      </div>
    </fieldset>
  )
}

/**
 * Assentar o boneco no chão. Aparece nas DUAS seções do painel — com a raiz
 * selecionada e com uma junta selecionada — porque o momento em que ele faz
 * falta é logo depois de dobrar um joelho ou girar o quadril, e aí quem está
 * posando tem uma junta selecionada. As duas seções são exclusivas, então
 * nunca há dois botões na tela.
 */
function SeatOnGroundButton({ figureId }: { figureId: string }) {
  const { t } = useTranslation()
  const seatFigureOnGround = useFiguresStore((state) => state.seatFigureOnGround)

  return (
    <button
      type="button"
      className="properties-panel__reset"
      onClick={() => seatFigureOnGround(figureId)}
      title={t('panels.properties.seatOnGroundHint')}
    >
      {t('panels.properties.seatOnGround')}
    </button>
  )
}

/**
 * Zerar um grupo inteiro de juntas (item 4 do backlog). Raramente se quer
 * zerar exatamente UMA junta — o gesto real é "refazer este braço". Os rótulos
 * são os mesmos grupos do combo de seleção de junta, então quem já se
 * acostumou com eles não aprende nomes novos.
 *
 * Um grupo com todas as juntas travadas fica desabilitado, em vez de virar um
 * botão que não faz nada (mesma escolha do slider de junta travada).
 */
function ResetGroupFieldset({ figureId }: { figureId: string }) {
  const { t } = useTranslation()
  const resetJointGroup = useFiguresStore((state) => state.resetJointGroup)
  const jointLocks = useFiguresStore((state) => state.jointLocks)
  const locked = new Set(getLockedJoints(jointLocks, figureId))

  return (
    <fieldset aria-label={t('panels.properties.resetGroup')}>
      <legend>{t('panels.properties.resetGroup')}</legend>
      <p className="properties-panel__hint">{t('panels.properties.resetGroupHint')}</p>
      <div className="properties-panel__pose-presets">
        {JOINT_GROUPS.map((group) => (
          <button
            key={group.key}
            type="button"
            disabled={group.joints.every((jointName) => locked.has(jointName))}
            onClick={() => resetJointGroup(figureId, group.key)}
          >
            {t(JOINT_GROUP_LABEL_KEYS[group.key])}
          </button>
        ))}
      </div>
    </fieldset>
  )
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
  const liveMirrorEnabled = useFiguresStore((state) => state.liveMirrorEnabled)
  const toggleLiveMirror = useFiguresStore((state) => state.toggleLiveMirror)
  const mirrorWholeFigure = useFiguresStore((state) => state.mirrorWholeFigure)

  // As operações de LADO não têm o que fazer sem junta pareada no escopo (com a
  // cabeça selecionada, por exemplo). O espelho completo e o espelho ao vivo
  // não dependem do escopo — valem para o boneco todo —, então o bloco continua
  // na tela: esconder o "espelhar tudo" justamente quando a cabeça está
  // selecionada pareceria defeito.
  const hasPairScope = getMirrorScope(scopeJoint).length > 0

  return (
    <fieldset aria-label={t('panels.properties.symmetry')}>
      <legend>{t('panels.properties.symmetry')}</legend>

      {hasPairScope && (
        <>
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
        </>
      )}

      {/* Espelho completo (pedido do usuário): as três operações acima só
          trocam os membros de lado, e um tronco torcido ou uma cabeça virada
          ficavam para o mesmo lado — o boneco saía espelhado pela metade. Este
          soma a reflexão das juntas SEM par.

          Fica fora da fileira e ignora o escopo da junta selecionada: "o boneco
          todo" é o que ele promete, e obedecer ao escopo faria o botão mentir.
          Por isso também o aviso próprio embaixo. */}
      <button
        type="button"
        className="properties-panel__mirror-all"
        title={t('panels.properties.mirrorWholeHint')}
        onClick={() => mirrorWholeFigure(figureId)}
      >
        {t('panels.properties.mirrorWhole')}
      </button>
      <p className="properties-panel__hint">{t('panels.properties.mirrorWholeHint')}</p>

      {/* O espelho ao vivo é MODO, não operação: por isso caixa e não botão,
          ao lado das três operações pontuais que ele automatiza. Vale para o
          boneco todo, e não para o escopo da junta selecionada — quem posa um
          braço espelhado quer o outro braço acompanhando, não uma regra que
          muda conforme o que está selecionado. */}
      <label className="properties-panel__field properties-panel__field--checkbox">
        <input type="checkbox" checked={liveMirrorEnabled} onChange={toggleLiveMirror} />
        {t('panels.properties.liveMirror')}
      </label>
      <p className="properties-panel__hint">
        {liveMirrorEnabled
          ? t('panels.properties.liveMirrorOnHint')
          : t('panels.properties.liveMirrorOffHint')}
      </p>
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

/**
 * Prefixo dos valores do combo que apontam para a biblioteca do usuário
 * (DECISOES.md #42) — as poses de fábrica usam a própria chave, e nenhuma
 * delas começa assim.
 */
const SAVED_POSE_PREFIX = 'saved:'

const POSE_PRESET_GROUP_LABEL_KEYS: Record<PosePresetGroupKey, string> = {
  reference: 'panels.properties.poseGroupReference',
  everyday: 'panels.properties.poseGroupEveryday',
  ground: 'panels.properties.poseGroupGround',
  pointing: 'panels.properties.poseGroupPointing',
  action: 'panels.properties.poseGroupAction',
  expressive: 'panels.properties.poseGroupExpressive',
  kpop: 'panels.properties.poseGroupKpop',
  pairs: 'panels.properties.poseGroupPairs',
  fight: 'panels.properties.poseGroupFight',
}

export function PropertiesPanel() {
  const { t } = useTranslation()
  /**
   * Qual pose está ESCOLHIDA no combo — aplicar é um passo à parte. É uma
   * string, e não uma `PosePresetKey`, porque o mesmo combo lista também as
   * poses da biblioteca do usuário (DECISOES.md #42), prefixadas para não
   * colidirem com as chaves de fábrica.
   */
  const [selectedPose, setSelectedPose] = useState<string>('standing')
  /** Formulário de nome ao salvar uma pose na biblioteca — fechado por padrão. */
  const [isNamingPose, setIsNamingPose] = useState(false)
  const [copyTargetDraft, setCopyTargetDraft] = useState<string | null>(null)
  const [copyScope, setCopyScope] = useState<JointGroupKey | 'all'>('all')
  const [poseNameDraft, setPoseNameDraft] = useState('')
  /**
   * Mistura entre a pose do boneco e a escolhida no combo (DECISOES.md #43).
   * As duas pontas são capturadas UMA vez, no primeiro evento do slider, e
   * guardadas com uma chave (boneco + pose alvo): a base não pode ser relida
   * a cada passo, senão cada evento partiria do resultado do anterior e
   * arrastar de volta para 0% não devolveria a pose original.
   */
  const [mix, setMix] = useState<{ key: string; amount: number; base: BlendablePose; target: BlendablePose } | null>(
    null,
  )
  const figures = useFiguresStore((state) => state.figures)
  const props = useFiguresStore((state) => state.props)
  const selectedPropId = useFiguresStore((state) => state.selectedPropId)
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
  const poseLibrary = useFiguresStore((state) => state.poseLibrary)
  const saveFigurePose = useFiguresStore((state) => state.saveFigurePose)
  const applySavedPose = useFiguresStore((state) => state.applySavedPose)
  const copyFigurePose = useFiguresStore((state) => state.copyFigurePose)
  const blendPose = useFiguresStore((state) => state.blendPose)
  const removeSavedPose = useFiguresStore((state) => state.removeSavedPose)
  const jointLocks = useFiguresStore((state) => state.jointLocks)
  const toggleJointLock = useFiguresStore((state) => state.toggleJointLock)
  const clearJointLocks = useFiguresStore((state) => state.clearJointLocks)
  const gizmoMode = useUIStore((state) => state.gizmoMode)
  const setGizmoMode = useUIStore((state) => state.setGizmoMode)
  const pairPoseEnabled = useUIStore((state) => state.pairPoseEnabled)
  const togglePairPose = useUIStore((state) => state.togglePairPose)
  // Não é usado diretamente: assina a customização de limites do workspace só
  // para que as faixas dos sliders (lidas de `getJoint`) sejam recalculadas
  // quando ela mudar — ver DECISOES.md #29.
  useFiguresStore((state) => state.jointLimits)

  const figure = figures.find((f) => f.id === selectedFigureId)
  const selectedProp = props.find((prop) => prop.id === selectedPropId)

  // Objeto de cena selecionado (item 42): o painel mostra as MEDIDAS dele. Vem
  // antes do caminho do boneco porque as duas seleções são exclusivas — com um
  // objeto escolhido não há boneco escolhido, e cair no "nada selecionado"
  // seria mentira.
  if (selectedProp) {
    return (
      <CollapsiblePanel panelKey="properties" className="panel--properties" title={t('panels.properties.title')}>
        <PropProperties prop={selectedProp} />
      </CollapsiblePanel>
    )
  }

  if (!figure || !selectedJointName) {
    return (
      <CollapsiblePanel panelKey="properties" className="panel--properties" title={t('panels.properties.title')}>
                <p className="panel__empty">{t('panels.properties.empty')}</p>
      </CollapsiblePanel>
    )
  }

  const isRoot = selectedJointName === ROOT_JOINT_NAME

  // Pose escolhida no combo: da biblioteca do usuário (prefixada) ou de
  // fábrica. Uma pose da biblioteca removida enquanto estava escolhida cai de
  // volta para a primeira de fábrica, em vez de deixar o combo em branco.
  const savedPoseId = selectedPose.startsWith(SAVED_POSE_PREFIX)
    ? selectedPose.slice(SAVED_POSE_PREFIX.length)
    : null
  const savedPose = savedPoseId ? poseLibrary.find((pose) => pose.id === savedPoseId) : undefined
  const presetKey = savedPoseId ? null : (selectedPose as PosePresetKey)
  const poseSelectValue = savedPoseId && !savedPose ? 'standing' : selectedPose

  const selectedPoseHintKey = presetKey ? POSE_PRESET_HINT_KEYS[presetKey] : undefined
  // Aviso de que aplicar vai mexer TAMBÉM no outro boneco (DECISOES.md #41).
  // Só aparece quando isso de fato vai acontecer — com um boneco só, ou com
  // três, a montagem continua manual e a dica da pose (com a distância) é que
  // vale. Poses da biblioteca não têm par: o pareamento é das de fábrica.
  const pairsAutomatically = figures.length === 2 && presetKey !== null && getPosePairing(presetKey) !== null

  // Destino da cópia de pose. O escolhido é reconferido a cada render em vez de
  // guardado: remover o boneco de destino (ou trocar de boneco selecionado)
  // deixaria um id órfão apontando para ninguém.
  const otherFigures = figures.filter((other) => other.id !== figure.id)
  const copyTarget = otherFigures.find((other) => other.id === copyTargetDraft) ?? otherFigures[0]

  // Travamento de juntas (DECISOES.md #42).
  const lockedJoints = getLockedJoints(jointLocks, figure.id)
  const isSelectedJointLocked = lockedJoints.includes(selectedJointName)

  /** A pose escolhida no combo, no formato comum a presets e biblioteca. */
  const selectedPoseSource: BlendSource | null = savedPose
    ? savedPose
    : presetKey
      ? { pose: resolvePosePreset(presetKey), ...resolvePosePresetPlacement(presetKey) }
      : null

  // Chave da mistura em curso: trocar de boneco ou de pose alvo recomeça do
  // zero, sem precisar de efeito nenhum para "limpar" o estado.
  const mixKey = `${figure.id}|${selectedPose}`
  const mixAmount = mix?.key === mixKey ? mix.amount : 0

  const handleMixChange = (event: ChangeEvent<HTMLInputElement>) => {
    const percent = Number(event.target.value)
    if (Number.isNaN(percent) || !selectedPoseSource) return

    const pontas =
      mix?.key === mixKey
        ? mix
        : { key: mixKey, base: figureBlendState(figure), target: resolveBlendTarget(figure, selectedPoseSource) }

    setMix({ ...pontas, amount: percent })
    blendPose(figure.id, pontas.base, pontas.target, percent / 100)
  }

  /** Depois de aplicar/sortear, a pose do boneco mudou: a base guardada não vale mais. */
  const resetMix = () => setMix(null)

  const applySelectedPose = () => {
    if (savedPose) applySavedPose(figure.id, savedPose.id)
    else if (presetKey) applyPosePreset(figure.id, presetKey, { pairPartner: pairPoseEnabled })
    resetMix()
  }

  const confirmSavePose = (event: FormEvent) => {
    event.preventDefault()
    const poseId = saveFigurePose(figure.id, poseNameDraft)
    setIsNamingPose(false)
    setPoseNameDraft('')
    // Já deixa a pose recém-salva escolhida: o passo seguinte natural é
    // aplicá-la no outro boneco.
    if (poseId) setSelectedPose(`${SAVED_POSE_PREFIX}${poseId}`)
  }
  // Poses de mão aparecem no contexto: qualquer junta do braço (clavícula →
  // ponta dos dedos) revela as poses DAQUELA mão, sem um seletor de lado à
  // parte (ver DECISOES.md #30).
  const armSide = getArmSide(selectedJointName)
  // A junta tem os dois modos de gizmo (W/E)? Fora da raiz, só as juntas
  // arrastáveis — mão/dedos e spine/hip.* ficam sempre em rotação, e o
  // seletor de modo não aparece para elas.
  const selectedJointDraggable = !isRoot && isDraggableJoint(selectedJointName)

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
                value={poseSelectValue}
                onChange={(event) => setSelectedPose(event.target.value)}
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
                {/* Biblioteca do usuário no MESMO combo das poses de fábrica
                    (DECISOES.md #42): escolher e aplicar uma pose é um gesto
                    só, venha ela de onde vier. */}
                {poseLibrary.length > 0 && (
                  <optgroup label={t('panels.properties.poseGroupLibrary')}>
                    {poseLibrary.map((pose) => (
                      <option key={pose.id} value={`${SAVED_POSE_PREFIX}${pose.id}`}>
                        {pose.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            {selectedPoseHintKey && (
              <p className="properties-panel__hint">{t(selectedPoseHintKey)}</p>
            )}
            {/* A caixa só aparece quando há um par para montar — pose em dupla
                E exatamente dois bonecos —, que é quando marcar ou desmarcar
                muda alguma coisa. A escolha em si é persistida, então quem
                prefere montar à mão não precisa desmarcar de novo a cada pose. */}
            {pairsAutomatically && (
              <>
                <label className="properties-panel__field properties-panel__field--checkbox">
                  <input type="checkbox" checked={pairPoseEnabled} onChange={togglePairPose} />
                  {t('panels.properties.posePairApply')}
                </label>
                <p className="properties-panel__hint">
                  {t(pairPoseEnabled ? 'panels.properties.posePairAuto' : 'panels.properties.posePairManual')}
                </p>
              </>
            )}
            <div className="properties-panel__pose-presets">
              <button type="button" className="properties-panel__apply-pose" onClick={applySelectedPose}>
                {t('panels.properties.applyPose')}
              </button>
              {/* O sorteio fica FORA do combo (pedido do usuário): não é uma
                  pose da lista — cada clique dá uma diferente. */}
              <button
                type="button"
                className="properties-panel__random-pose"
                title={t('panels.properties.randomPoseHint')}
                onClick={() => {
                  applyRandomPose(figure.id)
                  resetMix()
                }}
              >
                {t('panels.properties.randomPose')}
              </button>
              {/* Remover só aparece com uma pose da BIBLIOTECA escolhida: as
                  de fábrica não são removíveis. */}
              {savedPose && (
                <button
                  type="button"
                  onClick={() => {
                    removeSavedPose(savedPose.id)
                    setSelectedPose('standing')
                  }}
                >
                  {t('panels.properties.removeSavedPose')}
                </button>
              )}
            </div>

            {/* Mistura entre a pose atual e a escolhida (DECISOES.md #43):
                "andando, mas só metade do passo". Não é animação — o que fica
                é a pose estática do ponto onde o slider parar, e 100% dá
                exatamente o mesmo que "Aplicar pose". */}
            <div className="properties-panel__mix">
              <label htmlFor="pose-mix" className="properties-panel__mix-label">
                {t('panels.properties.poseMix')}
              </label>
              <div className="properties-panel__axis-row">
                <input
                  id="pose-mix"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={mixAmount}
                  onChange={handleMixChange}
                />
                <span className="properties-panel__value">{mixAmount}%</span>
              </div>
              <p className="properties-panel__hint">{t('panels.properties.poseMixHint')}</p>
            </div>

            {/* Biblioteca de poses (DECISOES.md #42): guardar a pose montada à
                mão, com nome, para reaplicá-la em qualquer boneco de qualquer
                cena. */}
            {isNamingPose ? (
              <form className="properties-panel__save-pose-form" onSubmit={confirmSavePose}>
                <label htmlFor="saved-pose-name" className="properties-panel__field">
                  {t('panels.properties.savePoseNameLabel')}
                  <input
                    id="saved-pose-name"
                    type="text"
                    value={poseNameDraft}
                    onChange={(event) => setPoseNameDraft(event.target.value)}
                    autoFocus
                  />
                </label>
                <div className="properties-panel__pose-presets">
                  <button type="submit">{t('panels.properties.savePoseConfirm')}</button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsNamingPose(false)
                      setPoseNameDraft('')
                    }}
                  >
                    {t('panels.properties.savePoseCancel')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className="properties-panel__save-pose"
                title={t('panels.properties.savePoseHint')}
                onClick={() => setIsNamingPose(true)}
              >
                {t('panels.properties.savePose')}
              </button>
            )}

            {/* Copiar a pose deste boneco para outro (pedido do usuário). Passa
                pelo mesmo caminho da biblioteca — capturar e aplicar —, então
                leva o assentamento e respeita as juntas travadas do destino,
                sem precisar salvar nada. Só aparece havendo para onde copiar. */}
            {otherFigures.length > 0 && (
              <div className="properties-panel__copy-pose">
                <label htmlFor="copy-pose-target" className="properties-panel__field">
                  {t('panels.properties.copyPoseTo')}
                  <select
                    id="copy-pose-target"
                    value={copyTarget.id}
                    onChange={(event) => setCopyTargetDraft(event.target.value)}
                  >
                    {otherFigures.map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.name}
                      </option>
                    ))}
                  </select>
                </label>
                {/* O que copiar. "Pose inteira" leva o assentamento, como
                    sempre; um grupo leva só aquelas juntas e NÃO mexe na
                    colocação de quem recebe — copiar um braço não pode tirar o
                    boneco do chão onde ele estava. */}
                <label htmlFor="copy-pose-scope" className="properties-panel__field">
                  {t('panels.properties.copyPoseScope')}
                  <select
                    id="copy-pose-scope"
                    value={copyScope}
                    onChange={(event) => setCopyScope(event.target.value as JointGroupKey | 'all')}
                  >
                    <option value="all">{t('panels.properties.copyPoseScopeAll')}</option>
                    {JOINT_GROUPS.map((group) => (
                      <option key={group.key} value={group.key}>
                        {t(JOINT_GROUP_LABEL_KEYS[group.key])}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  title={t(copyScope === 'all' ? 'panels.properties.copyPoseHint' : 'panels.properties.copyPoseGroupHint')}
                  onClick={() =>
                    copyFigurePose(figure.id, copyTarget.id, copyScope === 'all' ? undefined : copyScope)
                  }
                >
                  {t('panels.properties.copyPose')}
                </button>
              </div>
            )}
          </fieldset>

          {/* Juntas travadas (DECISOES.md #42): a contagem fica na visão da
              raiz — é o resumo do boneco inteiro — para que o efeito de uma
              trava nunca seja inexplicável ao aplicar uma pose. */}
          {lockedJoints.length > 0 && (
            <div className="properties-panel__locked-summary">
              <p className="properties-panel__hint">
                {t('panels.properties.lockedJointCount', { count: lockedJoints.length })}
              </p>
              <button type="button" onClick={() => clearJointLocks(figure.id)}>
                {t('panels.properties.unlockAllJoints')}
              </button>
            </div>
          )}

          <SymmetryFieldset figureId={figure.id} scopeJoint={null} />

          {/* Alternância translação/rotação do gizmo (W/E). Na raiz (fase 9,
              item 13): mover a colocação ou girar em torno do próprio pivô do
              quadril, ponto confirmado com o usuário. */}
          <GizmoModeFieldset mode={gizmoMode} onSelect={setGizmoMode} />

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
            {/* Assentar é edição de ALTURA, por isso mora aqui e não junto das
                poses: depois de mexer no quadril ou nos joelhos o boneco fica
                flutuando ou afundado, e acertar isso à mão era o que sobrava
                de trabalho manual em toda pose nova. */}
            <SeatOnGroundButton figureId={figure.id} />
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

          <ResetGroupFieldset figureId={figure.id} />
        </>
      ) : (
        <>
          <p className="properties-panel__joint-name">
            {t('panels.properties.selectedJoint')}: <span>{selectedJointName}</span>
          </p>

          {/* Travar a junta (DECISOES.md #42): fica no topo da junta
              selecionada porque é o que explica os sliders desabilitados logo
              abaixo. */}
          <div className="properties-panel__pose-presets">
            <button
              type="button"
              className="properties-panel__lock-joint"
              aria-pressed={isSelectedJointLocked}
              title={t('panels.properties.lockJointHint')}
              onClick={() => toggleJointLock(figure.id, selectedJointName)}
            >
              {t(isSelectedJointLocked ? 'panels.properties.unlockJoint' : 'panels.properties.lockJoint')}
            </button>
          </div>
          {isSelectedJointLocked && (
            <p className="properties-panel__hint properties-panel__hint--warning">
              {t('panels.properties.jointLockedHint')}
            </p>
          )}

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

          {/* O mesmo seletor W/E da raiz, nas juntas que têm os dois modos:
              mover (arrasto de cadeia — puxa os ancestrais até os limites,
              com a raiz fixa) ou girar (FK de sempre). */}
          {selectedJointDraggable && (
            <>
              <GizmoModeFieldset mode={gizmoMode} onSelect={setGizmoMode} />
              {gizmoMode === 'translate' && (
                <p className="properties-panel__hint">{t('panels.properties.gizmoDragHint')}</p>
              )}
            </>
          )}

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
                  // Travada: o store recusaria a escrita de qualquer jeito —
                  // desabilitar é dizer isso ANTES do usuário arrastar e
                  // ver o slider voltar sozinho.
                  disabled={isSelectedJointLocked}
                />
              )
            })}

            {/* Reset por junta (fase 9, item 6): sem isto, voltar uma junta
                ao neutro exigia acertar cada eixo na mão. */}
            <button
              type="button"
              className="properties-panel__reset"
              title={t('panels.properties.resetJointHint')}
              disabled={isSelectedJointLocked}
              onClick={() => resetJointRotation(figure.id, selectedJointName)}
            >
              {t('panels.properties.resetJoint')}
            </button>
          </fieldset>

          {/* O mesmo botão da seção da raiz: dobrar um joelho é o que costuma
              deixar o boneco flutuando, e obrigar a voltar para a raiz só para
              apoiá-lo seria atrito no pior momento. */}
          <SeatOnGroundButton figureId={figure.id} />

          <ResetGroupFieldset figureId={figure.id} />

          {/* Simetria parcial (DECISOES.md #34): daqui para baixo, nos dois
              lados. Fica depois da rotação para não empurrar os sliders — o
              controle principal da junta — para longe do topo do painel. */}
          <SymmetryFieldset figureId={figure.id} scopeJoint={selectedJointName} />
        </>
      )}
    </CollapsiblePanel>
  )
}
