import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HAND_PRESET_KEYS, type HandPresetKey } from '../figure/handPresets'
import { isDraggableJoint } from '../figure/dragSolver'
import { JOINT_GROUPS, getArmSide, type JointGroupKey } from '../figure/jointGroups'
import { JOINT_GROUP_LABEL_KEYS } from './jointGroupLabels'
import { getLockedJoints, getLockedRootAxes, rootAxisLockToken } from '../figure/jointLocks'
import { frozenJointsByPins, getPinnedJoints, isPlacementPinned } from '../figure/jointPins'
import { figureBlendState, resolveBlendTarget, type BlendablePose, type BlendSource } from '../figure/poseBlend'
import { getMirrorScope, type Side } from '../figure/poseMirror'
import { getPosePairing } from '../figure/posePairs'
import {
  POSE_PRESET_GROUPS,
  resolvePosePreset,
  resolvePosePresetPlacement,
  type PosePresetKey,
} from '../figure/posePresets'
import {
  POSE_PRESET_GROUP_LABEL_KEYS,
  POSE_PRESET_HINT_KEYS,
  POSE_PRESET_LABEL_KEYS,
} from './posePresetLabels'
import { ROOT_JOINT_NAME, getJoint, getJointAxes, type Axis } from '../figure/skeleton'
import { pickFile, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { parseFigurePoseFile, serializeFigurePoseFile } from '../persistence/figurePoseFile'
import { matchesPoseFilter } from './poseFilter'
import { AXIS_COLORS } from '../scene/axisColors'
import { slugifySceneName } from '../snapshot/snapshotNaming'
import { useFiguresStore, type Figure } from '../store/figuresStore'
import { useUIStore, type GizmoMode } from '../store/uiStore'
import { UNDO_BATCH_POINTER_PROPS } from '../store/undoBatch'
import { CollapsiblePanel } from './CollapsiblePanel'
import { CollapsibleSection } from './CollapsibleSection'
import { ReferencePhotoControls } from './ReferencePhotoControls'
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
  /** Cadeado do eixo da raiz (item 64) — só a raiz o passa; `undefined` esconde o botão. */
  locked?: boolean
  onToggleLock?: () => void
  lockLabel?: string
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
  locked,
  onToggleLock,
  lockLabel,
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
        // Arrastar o slider é um gesto só, e um passo de undo só
        // (DECISOES.md #118) — as setas do teclado continuam passo a passo.
        {...UNDO_BATCH_POINTER_PROPS}
      />
      <span className="properties-panel__value">{Math.round(value)}°</span>
      {onToggleLock && (
        <button
          type="button"
          className="properties-panel__axis-lock"
          aria-pressed={locked}
          aria-label={lockLabel}
          title={lockLabel}
          onClick={onToggleLock}
        >
          {locked ? '\u{1F512}' : '\u{1F513}'}
        </button>
      )}
    </div>
  )
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
      <div className="panel-actions">
        <button type="button" aria-pressed={mode === 'translate'} onClick={() => onSelect('translate')}>
          {t('common.gizmoTranslate')}
        </button>
        <button type="button" aria-pressed={mode === 'rotate'} onClick={() => onSelect('rotate')}>
          {t('common.gizmoRotate')}
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
/**
 * Pose do boneco em ARQUIVO JSON (DECISOES.md #81) — a ponte entre a pose montada
 * no celular e o refino aqui.
 *
 * Mora neste painel, junto das demais operações de pose do boneco INTEIRO
 * (presets, mistura, salvar na biblioteca, copiar para outro boneco), e por isso
 * aparece só na visão da raiz, como elas. A área de transferência de poses ficou
 * no painel de Bonecos por um motivo que não vale aqui: aquela lista é da SESSÃO
 * e sumiria a cada troca de seleção; esta seção é sobre o boneco selecionado, que
 * é exatamente o assunto deste painel.
 *
 * O arquivo guarda um boneco com a estrutura exata de `keyframes[].figures[]` das
 * animações; o contrato de colocação (grava no (0,0) do plano, carrega mantendo
 * X/Z e trazendo só o Y) está em `figurePoseFile.ts`.
 */
function PoseFileFieldset({ figure }: { figure: Figure }) {
  const { t } = useTranslation()
  const applyImportedFigurePose = useFiguresStore((state) => state.applyImportedFigurePose)
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const handleExport = async () => {
    setErrorKey(null)
    const json = serializeFigurePoseFile(figure)
    await writeFileToDirectoryOrDownload(
      null,
      `${slugifySceneName(figure.name)}-pose.json`,
      new Blob([json], { type: 'application/json' }),
    )
  }

  const handleLoad = async () => {
    setErrorKey(null)
    const picked = await pickFile('.json,application/json')
    if (!picked) return
    try {
      const imported = parseFigurePoseFile(JSON.parse(new TextDecoder().decode(picked.data)))
      // Arquivo lido, mas sem pose aproveitável (nenhuma junta conhecida): dizer
      // isso vale mais do que aplicar uma pose vazia e apagar a que estava lá.
      if (!imported) {
        setErrorKey('errors.importNoPose')
        return
      }
      applyImportedFigurePose(figure.id, imported)
    } catch {
      setErrorKey('errors.importUnreadableJson')
    }
  }

  return (
    <fieldset className="properties-panel__pose-file" aria-label={t('panels.properties.poseFile')}>
      <legend>{t('panels.properties.poseFile')}</legend>

      <button
        type="button"
        title={t('panels.properties.poseFileExportHint')}
        onClick={() => void handleExport()}
      >
        {t('panels.properties.poseFileExport')}
      </button>

      <button
        type="button"
        title={t('panels.properties.poseFileLoadHint')}
        onClick={() => void handleLoad()}
      >
        {t('panels.properties.poseFileLoad')}
      </button>

      {errorKey && (
        <p role="alert" className="panel__error">
          {t(errorKey)}
        </p>
      )}
    </fieldset>
  )
}

function SeatOnGroundButton({ figureId }: { figureId: string }) {
  const { t } = useTranslation()
  const seatFigureOnGround = useFiguresStore((state) => state.seatFigureOnGround)
  // Assentar move a colocação — congelada quando o boneco tem âncora (item 62).
  const placementPinned = useFiguresStore((state) => isPlacementPinned(state.jointPins, figureId))

  return (
    <button
      type="button"
      className="panel-action properties-panel__reset"
      disabled={placementPinned}
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
  const jointPins = useFiguresStore((state) => state.jointPins)
  // Grupo inteiro preso (trava ou congelado por âncora) = botão desabilitado.
  const locked = new Set([
    ...getLockedJoints(jointLocks, figureId),
    ...frozenJointsByPins(jointPins, figureId),
  ])

  return (
    <fieldset aria-label={t('panels.properties.resetGroup')}>
      <legend>{t('panels.properties.resetGroup')}</legend>
      <p className="properties-panel__hint">{t('panels.properties.resetGroupHint')}</p>
      <div className="panel-actions">
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

      {hasPairScope && (
        <>
          <p className="properties-panel__hint">
            {scopeJoint
              ? t('panels.properties.symmetryScopeHint', { joint: scopeJoint })
              : t('panels.properties.symmetryHint')}
          </p>
          {/* Os dois espelhos são um CONJUNTO — escolhe-se a direção da cópia
              —, e por isso dividem a linha. "Inverter lados" não é uma terceira
              direção: troca os dois de uma vez. Era o terceiro item da grade e
              caía sozinho na segunda fileira, com metade da largura e um buraco
              ao lado; agora é ação isolada, em largura cheia (#88). */}
          <div className="panel-actions">
            <button type="button" onClick={() => mirrorSide(figureId, 'R', scopeJoint)}>
              {t('panels.properties.mirrorFromRight')}
            </button>
            <button type="button" onClick={() => mirrorSide(figureId, 'L', scopeJoint)}>
              {t('panels.properties.mirrorFromLeft')}
            </button>
          </div>
          <button
            type="button"
            className="panel-action"
            onClick={() => swapSides(figureId, scopeJoint)}
          >
            {t('panels.properties.swapSides')}
          </button>
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
        className="panel-action properties-panel__mirror-all"
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

// O mapa de rótulos mudou-se para `jointGroupLabels.ts` quando o módulo de
// poses (item 44) passou a usar o mesmo combo — mesmos grupos, mesmos
// rótulos, uma fonte só (e exportá-lo daqui quebrava o fast refresh).

/**
 * Prefixo dos valores do combo que apontam para a biblioteca do usuário
 * (DECISOES.md #42) — as poses de fábrica usam a própria chave, e nenhuma
 * delas começa assim.
 */
const SAVED_POSE_PREFIX = 'saved:'

interface PoseNameFormProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  onCancel: () => void
}

/**
 * Campo de nome da biblioteca de poses, usado por SALVAR e por RENOMEAR
 * (pedido do usuário, 2026-07-31). Um componente só porque é o mesmo gesto —
 * digitar um nome e confirmar — e porque os dois nunca aparecem ao mesmo
 * tempo: quem os abre é o mesmo `namingMode`.
 */
function PoseNameForm({ value, onChange, onSubmit, onCancel }: PoseNameFormProps) {
  const { t } = useTranslation()

  return (
    <form className="properties-panel__save-pose-form" onSubmit={onSubmit}>
      <label htmlFor="saved-pose-name" className="properties-panel__field">
        {t('panels.properties.savePoseNameLabel')}
        <input
          id="saved-pose-name"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus
        />
      </label>
      <div className="panel-actions">
        <button type="submit">{t('panels.properties.savePoseConfirm')}</button>
        <button type="button" onClick={onCancel}>
          {t('panels.properties.savePoseCancel')}
        </button>
      </div>
    </form>
  )
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
  /**
   * Filtro da lista de poses (item 35): são dezenas de presets em grupos, e
   * achar um pelo combo exigia varrer grupo a grupo. Busca por trecho do nome,
   * sem caixa e sem acento (`poseFilter.ts`). Estado de tela, como o combo.
   */
  const [poseFilter, setPoseFilter] = useState('')
  /**
   * Formulário de nome da biblioteca de poses — fechado por padrão. Serve aos
   * dois gestos: batizar uma pose NOVA e renomear a que está escolhida no
   * combo (pedido do usuário, 2026-07-31). É o mesmo campo, e ter dois abertos
   * seria duas chances de digitar no errado.
   */
  const [namingMode, setNamingMode] = useState<'save' | 'rename' | null>(null)
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
  const renameSavedPose = useFiguresStore((state) => state.renameSavedPose)
  const jointLocks = useFiguresStore((state) => state.jointLocks)
  const toggleJointLock = useFiguresStore((state) => state.toggleJointLock)
  const clearJointLocks = useFiguresStore((state) => state.clearJointLocks)
  const jointPins = useFiguresStore((state) => state.jointPins)
  const toggleJointPin = useFiguresStore((state) => state.toggleJointPin)
  const clearJointPins = useFiguresStore((state) => state.clearJointPins)
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
        {/* A foto de referência não depende de seleção: carregar e regular a
            opacidade valem como auxílio avulso (item 7) — só o "Inferir pose"
            pede um boneco, e o próprio botão explica. */}
        <CollapsibleSection sectionKey="referencePhoto" title={t('panels.properties.referencePhoto')}>
          <ReferencePhotoControls />
        </CollapsibleSection>
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

  // Trava por eixo da raiz (item 64): tokens no mesmo mapa, cadeado por
  // slider. Na contagem de travas eles NÃO contam — a contagem fala de
  // juntas, e os eixos têm os próprios cadeados à vista.
  const lockedRootAxes = getLockedRootAxes(jointLocks, figure.id)
  const lockedJointCount = lockedJoints.length - lockedRootAxes.length

  // Âncoras (item 62): a junta ancorada segue com rotação livre; o que
  // desabilita são os ANCESTRAIS congelados e a colocação da raiz.
  const pinnedJoints = getPinnedJoints(jointPins, figure.id)
  const isSelectedJointPinned = pinnedJoints.includes(selectedJointName)
  const isSelectedJointFrozen = frozenJointsByPins(jointPins, figure.id).includes(selectedJointName)
  const placementPinned = isPlacementPinned(jointPins, figure.id)

  // Filtro da lista de poses (item 35). A opção ESCOLHIDA nunca é filtrada
  // para fora: um `<select>` cujo valor não está entre as opções fica em
  // branco no meio da digitação. Grupo sem sobrevivente some inteiro.
  const visiblePresetGroups = POSE_PRESET_GROUPS.map((group) => ({
    key: group.key,
    poses: group.poses.filter(
      (key) => key === poseSelectValue || matchesPoseFilter(t(POSE_PRESET_LABEL_KEYS[key]), poseFilter),
    ),
  })).filter((group) => group.poses.length > 0)
  const visibleLibrary = poseLibrary.filter(
    (pose) =>
      `${SAVED_POSE_PREFIX}${pose.id}` === poseSelectValue || matchesPoseFilter(pose.name, poseFilter),
  )

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

  const confirmPoseName = (event: FormEvent) => {
    event.preventDefault()
    if (namingMode === 'rename') {
      // Renomear age sobre a pose ESCOLHIDA no combo, e por isso o formulário
      // dele aparece ao lado do combo — e não na seção de guardar, que pode
      // estar recolhida.
      if (savedPose) renameSavedPose(savedPose.id, poseNameDraft)
    } else {
      const poseId = saveFigurePose(figure.id, poseNameDraft)
      // Já deixa a pose recém-salva escolhida: o passo seguinte natural é
      // aplicá-la no outro boneco.
      if (poseId) setSelectedPose(`${SAVED_POSE_PREFIX}${poseId}`)
    }
    setNamingMode(null)
    setPoseNameDraft('')
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

      {/* Empilhado (pedido do usuário, 2026-07-31): é o único campo do painel
          cujo rótulo é uma frase, e não uma letra de eixo — lado a lado, o
          combo ficava com o resto da linha e os nomes de junta não cabiam. */}
      <label className="properties-panel__field properties-panel__field--stacked" htmlFor="joint-select">
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
          {/* A COLOCAÇÃO vem primeiro (pedido do usuário, 2026-07-31).
              Ela estava no fim, atrás de cinco blocos de pose, e o gizmo
              W/E — que é a versão arrastável destes mesmos números — ficava
              separado deles por nada. Montar a cena é o que se faz antes de
              posar, e é o que a lista de bonecos manda para cá. */}
          {/* Alternância translação/rotação do gizmo (W/E). Na raiz (fase 9,
              item 13): mover a colocação ou girar em torno do próprio pivô do
              quadril, ponto confirmado com o usuário. */}
          <GizmoModeFieldset mode={gizmoMode} onSelect={setGizmoMode} />

          {/* Âncora ativa (item 62): a colocação inteira congela — desabilitar
              aqui é dizer o porquê ANTES de o campo não responder. */}
          {placementPinned && (
            <p className="properties-panel__hint properties-panel__hint--warning">
              {t('panels.properties.placementPinnedHint')}
            </p>
          )}

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
                  disabled={placementPinned}
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
            {POSITION_AXES.map((axis) => {
              // Cadeado por eixo (item 64): o slider desabilita e o solver de
              // arrasto deixa de girar a raiz naquele eixo — a UI e o store
              // contam a mesma história.
              const axisLocked = lockedRootAxes.includes(axis)
              return (
                <AxisSlider
                  key={axis}
                  axis={axis}
                  value={figure.rotation[axis]}
                  min={ROOT_ROTATION_MIN}
                  max={ROOT_ROTATION_MAX}
                  onChange={handleRootRotationChange(axis)}
                  disabled={placementPinned || axisLocked}
                  locked={axisLocked}
                  onToggleLock={() => toggleJointLock(figure.id, rootAxisLockToken(axis))}
                  lockLabel={t(
                    axisLocked ? 'panels.properties.unlockRootAxis' : 'panels.properties.lockRootAxis',
                    { axis: axis.toUpperCase() },
                  )}
                />
              )
            })}
            <button
              type="button"
              className="panel-action properties-panel__reset"
              disabled={placementPinned || lockedRootAxes.length === 3}
              onClick={() => resetJointRotation(figure.id, ROOT_JOINT_NAME)}
            >
              {t('panels.properties.resetRootRotation')}
            </button>
          </fieldset>

          {/* Escolher e aplicar uma pose: a seção nasce ABERTA, é o motivo
              de o painel existir. O que saiu daqui foi tudo o que não é
              "aplicar" — salvar, copiar e o arquivo —, que virou a seção
              "Guardar e copiar", hoje no rodapé do painel: um fieldset
              chamado "Poses predefinidas" com 193 linhas abrigava cinco
              assuntos, e copiar a pose para outro boneco não é uma pose
              predefinida em sentido nenhum. */}
          <CollapsibleSection sectionKey="poses" title={t('panels.properties.posePresets')}>
            <fieldset aria-label={t('panels.properties.posePresets')}>
                {/* Filtro (item 35): reduz o combo abaixo ao que casa com o
                    texto — presets e biblioteca, todos os grupos de uma vez. */}
                <label htmlFor="pose-filter" className="properties-panel__field properties-panel__field--stacked">
                  {t('panels.properties.poseFilter')}
                  <input
                    id="pose-filter"
                    type="search"
                    value={poseFilter}
                    onChange={(event) => setPoseFilter(event.target.value)}
                  />
                </label>
                <select
                  id="pose-preset-select"
                  className="properties-panel__pose-select"
                  aria-label={t('panels.properties.posePresets')}
                  value={poseSelectValue}
                  onChange={(event) => setSelectedPose(event.target.value)}
                >
                  {visiblePresetGroups.map((group) => (
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
                  {visibleLibrary.length > 0 && (
                    <optgroup label={t('panels.properties.poseGroupLibrary')}>
                      {visibleLibrary.map((pose) => (
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
              {/* Aplicar é a ação principal do painel e vai em largura cheia
                  (pedido do usuário). Renomear e remover continuam em par: são
                  duas ações irmãs sobre a pose escolhida no combo, e só
                  aparecem com uma pose da BIBLIOTECA selecionada — as de
                  fábrica não são nem uma coisa nem outra. */}
              <button
                type="button"
                className="panel-action"
                onClick={applySelectedPose}
              >
                {t('panels.properties.applyPose')}
              </button>
              {savedPose && (
                <div className="panel-actions">
                  <button
                    type="button"
                    title={t('panels.properties.renameSavedPoseHint')}
                    onClick={() => {
                      setNamingMode('rename')
                      setPoseNameDraft(savedPose.name)
                    }}
                  >
                    {t('panels.properties.renameSavedPose')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeSavedPose(savedPose.id)
                      setSelectedPose('standing')
                    }}
                  >
                    {t('panels.properties.removeSavedPose')}
                  </button>
                </div>
              )}

              {namingMode === 'rename' && savedPose && (
                <PoseNameForm
                  value={poseNameDraft}
                  onChange={setPoseNameDraft}
                  onSubmit={confirmPoseName}
                  onCancel={() => {
                    setNamingMode(null)
                    setPoseNameDraft('')
                  }}
                />
              )}

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
                    {...UNDO_BATCH_POINTER_PROPS}
                  />
                  <span className="properties-panel__value">{mixAmount}%</span>
                </div>
                <p className="properties-panel__hint">{t('panels.properties.poseMixHint')}</p>
              </div>

              {/* O sorteio fica FORA do combo (pedido do usuário): não é uma
                  pose da lista — cada clique dá uma diferente. E fica DEPOIS da
                  mistura (pedido do usuário, 2026-07-31): a fila de cima é a da
                  pose escolhida — aplicar, renomear, remover —, e o sorteio não
                  tem nada a ver com o que está no combo. */}
              <button
                type="button"
                className="panel-action properties-panel__random-pose"
                title={t('panels.properties.randomPoseHint')}
                onClick={() => {
                  applyRandomPose(figure.id)
                  resetMix()
                }}
              >
                {t('panels.properties.randomPose')}
              </button>
            </fieldset>
          </CollapsibleSection>

          <CollapsibleSection sectionKey="symmetry" title={t('panels.properties.symmetry')}>
            <SymmetryFieldset figureId={figure.id} scopeJoint={null} />
          </CollapsibleSection>

          {/* Restaurar, na MESMA ordem das duas vistas: o resumo de travas e o
              zerar por grupo estavam em pontas opostas do painel, e a dupla
              (simetria, zerar) aparecia invertida entre a raiz e a junta —
              trocar de junta reordenava o painel. */}
          {/* Juntas travadas (DECISOES.md #42): a contagem fica na visão da
              raiz — é o resumo do boneco inteiro — para que o efeito de uma
              trava nunca seja inexplicável ao aplicar uma pose. */}
          {lockedJointCount > 0 && (
            <div className="properties-panel__locked-summary">
              <p className="properties-panel__hint">
                {t('panels.properties.lockedJointCount', { count: lockedJointCount })}
              </p>
              <button type="button" onClick={() => clearJointLocks(figure.id)}>
                {t('panels.properties.unlockAllJoints')}
              </button>
            </div>
          )}

          {/* Mesmo resumo para as âncoras (item 62): o efeito de uma âncora
              (colocação e cadeia congeladas) nunca pode ficar inexplicável. */}
          {pinnedJoints.length > 0 && (
            <div className="properties-panel__locked-summary">
              <p className="properties-panel__hint">
                {t('panels.properties.pinnedJointCount', { count: pinnedJoints.length })}
              </p>
              <button type="button" onClick={() => clearJointPins(figure.id)}>
                {t('panels.properties.unpinAllJoints')}
              </button>
            </div>
          )}

          <ResetGroupFieldset figureId={figure.id} />

          {/* Tirar a pose DAQUI e levá-la para outro lugar: a biblioteca,
              outro boneco ou um arquivo. Os três eram vizinhos de "aplicar"
              dentro do mesmo fieldset. Fecham o painel (pedido do usuário,
              2026-07-31): são o fim de uma sessão de trabalho, não o meio
              dela. */}
          <CollapsibleSection sectionKey="poseTransfer" title={t('panels.properties.poseTransfer')}>
            {/* Biblioteca de poses (DECISOES.md #42): guardar a pose montada à
                mão, com nome, para reaplicá-la em qualquer boneco de qualquer
                cena. */}
            {namingMode === 'save' ? (
              <PoseNameForm
                value={poseNameDraft}
                onChange={setPoseNameDraft}
                onSubmit={confirmPoseName}
                onCancel={() => {
                  setNamingMode(null)
                  setPoseNameDraft('')
                }}
              />
            ) : (
              <button
                type="button"
                className="panel-action properties-panel__save-pose"
                title={t('panels.properties.savePoseHint')}
                onClick={() => {
                  setNamingMode('save')
                  setPoseNameDraft('')
                }}
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

          <PoseFileFieldset figure={figure} />
          </CollapsibleSection>
        </>
      ) : (
        <>
          <p className="properties-panel__joint-name">
            {t('panels.properties.selectedJoint')}: <span>{selectedJointName}</span>
          </p>

          {/* Travar (DECISOES.md #42) e ancorar (item 62), no topo da junta
              selecionada porque é o que explica os sliders desabilitados logo
              abaixo. Com a âncora o cadeado deixou de ser ação sozinha: as
              duas proteções formam um conjunto de duas colunas (#88) —
              cadeado congela os ÂNGULOS desta junta; âncora congela a
              POSIÇÃO dela (ancestrais + colocação). */}
          <div className="panel-actions">
            <button
              type="button"
              className="properties-panel__lock-joint"
              aria-pressed={isSelectedJointLocked}
              title={t('panels.properties.lockJointHint')}
              onClick={() => toggleJointLock(figure.id, selectedJointName)}
            >
              {t(isSelectedJointLocked ? 'panels.properties.unlockJoint' : 'panels.properties.lockJoint')}
            </button>
            <button
              type="button"
              className="properties-panel__pin-joint"
              aria-pressed={isSelectedJointPinned}
              title={t('panels.properties.pinJointHint')}
              onClick={() => toggleJointPin(figure.id, selectedJointName)}
            >
              {t(isSelectedJointPinned ? 'panels.properties.unpinJoint' : 'panels.properties.pinJoint')}
            </button>
          </div>
          {isSelectedJointLocked && (
            <p className="properties-panel__hint properties-panel__hint--warning">
              {t('panels.properties.jointLockedHint')}
            </p>
          )}
          {isSelectedJointPinned && (
            <p className="properties-panel__hint properties-panel__hint--warning">
              {t('panels.properties.jointPinnedHint')}
            </p>
          )}
          {isSelectedJointFrozen && (
            <p className="properties-panel__hint properties-panel__hint--warning">
              {t('panels.properties.jointFrozenByPinHint')}
            </p>
          )}

          {/* O mesmo seletor W/E da raiz, nas juntas que têm os dois modos:
              mover (arrasto de cadeia — puxa os ancestrais até os limites,
              com a raiz fixa) ou girar (FK de sempre). Vem ANTES da rotação
              (pedido do usuário, 2026-07-31), como na raiz: escolher a
              ferramenta do gizmo é o que se faz antes de mexer nos números. */}
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
                  // Travada ou congelada por âncora: o store recusaria a
                  // escrita de qualquer jeito — desabilitar é dizer isso
                  // ANTES do usuário arrastar e ver o slider voltar sozinho.
                  disabled={isSelectedJointLocked || isSelectedJointFrozen}
                />
              )
            })}

            {/* Reset por junta (fase 9, item 6): sem isto, voltar uma junta
                ao neutro exigia acertar cada eixo na mão. */}
            <button
              type="button"
              className="panel-action properties-panel__reset"
              title={t('panels.properties.resetJointHint')}
              disabled={isSelectedJointLocked || isSelectedJointFrozen}
              onClick={() => resetJointRotation(figure.id, selectedJointName)}
            >
              {t('panels.properties.resetJoint')}
            </button>
          </fieldset>

          {armSide && (
            <fieldset aria-label={t(HAND_PRESETS_LEGEND_KEYS[armSide])}>
              <legend>{t(HAND_PRESETS_LEGEND_KEYS[armSide])}</legend>
              <div className="panel-actions">
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

          {/* O mesmo botão da seção da raiz: dobrar um joelho é o que costuma
              deixar o boneco flutuando, e obrigar a voltar para a raiz só para
              apoiá-lo seria atrito no pior momento. */}
          <SeatOnGroundButton figureId={figure.id} />

          <CollapsibleSection sectionKey="symmetry" title={t('panels.properties.symmetry')}>
            {/* Simetria parcial (DECISOES.md #34): daqui para baixo, nos dois lados. */}
            <SymmetryFieldset figureId={figure.id} scopeJoint={selectedJointName} />
          </CollapsibleSection>

          <ResetGroupFieldset figureId={figure.id} />
        </>
      )}

      {/* Foto de referência + marcação (item 7 / pose por marcação manual):
          por último porque é fluxo esporádico — e recolhida por padrão. */}
      <CollapsibleSection sectionKey="referencePhoto" title={t('panels.properties.referencePhoto')}>
        <ReferencePhotoControls />
      </CollapsibleSection>
    </CollapsiblePanel>
  )
}
