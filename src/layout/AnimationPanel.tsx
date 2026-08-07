import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ANIMATION_SPEED_STEP,
  DEFAULT_ANIMATION_SPEED,
  KEYFRAME_EASINGS,
  MAX_ANIMATION_SPEED,
  MIN_ANIMATION_SPEED,
  anchorKeyframeIndex,
  animationDurationMs,
  animationOutputDurationMs,
  findWorkingAnimation,
  keyframeGroups,
  keyframeStartTimesMs,
  savedAnimations,
  estimableKeyframeFigures,
  sharedKeyframeFigures,
  type KeyframeEasing,
} from '../animation/animation'
import { ANIMATION_CLIPS, ANIMATION_CLIP_KEYS, type AnimationClipKey } from '../animation/animationClips'
import { clipRoleCount } from '../animation/clipLibrary'
import { FPS_OPTIONS } from '../animation/frameTimeline'
import { ONION_SKIN_MODES, type OnionSkinMode } from '../animation/onionSkin'
import {
  applyEstimatedPoseToWorkbench,
  goToKeyframeWithStash,
  markWorkbenchRecorded,
  restoreStash,
} from '../animation/sceneStashActions'
import { averageKeyframeFigures } from '../animation/animationSampler'
import { shouldHighlightUpdate } from './updateHighlight'
import { withExportTimestamp } from '../persistence/exportTimestamp'
import { pickFile, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import {
  parseImportedAnimation,
  serializeAnimationFile,
  type ImportedAnimation,
} from '../persistence/animationsFile'
import { slugifySceneName } from '../snapshot/snapshotNaming'
import {
  ASPECT_LABEL_KEYS,
  OUTPUT_ASPECT_KEYS,
  OUTPUT_QUALITY_KEYS,
  QUALITY_LABEL_KEYS,
  type OutputAspectKey,
  type OutputQualityKey,
} from '../snapshot/constants'
import { useAnimationStore } from '../store/animationStore'
import { useCameraStore } from '../store/cameraStore'
import { useDepthStore } from '../store/depthStore'
import { useFiguresStore } from '../store/figuresStore'
import { useKeyframeThumbnailStore } from '../store/keyframeThumbnailStore'
import { useSceneStashStore } from '../store/sceneStashStore'
import type { AnimationImportMode } from '../store/figuresStore'
import { AnimationImportDialog, type SubstituteChoice } from './AnimationImportDialog'
import { ApplyCameraDialog } from './ApplyCameraDialog'
import { CollapsiblePanel } from './CollapsiblePanel'
import { CollapsibleSection } from './CollapsibleSection'
import { ConfirmDialog } from './ConfirmDialog'
import { CopyFiguresDialog } from './CopyFiguresDialog'

/** Rótulo de cada curva de suavização (item 26) — mapa explícito, para o typecheck acusar curva nova sem tradução. */
const EASING_LABEL_KEYS: Record<KeyframeEasing, string> = {
  linear: 'panels.animation.easingLinear',
  easeInOut: 'panels.animation.easingInOut',
  easeIn: 'panels.animation.easingIn',
  easeOut: 'panels.animation.easingOut',
}

/** Rótulo de cada modo do papel-cebola — mapa explícito, para o typecheck acusar modo novo sem tradução. */
const ONION_SKIN_MODE_LABEL_KEYS: Record<OnionSkinMode, string> = {
  both: 'panels.animation.onionSkinModeBoth',
  previous: 'panels.animation.onionSkinModePrevious',
  next: 'panels.animation.onionSkinModeNext',
}

/** Rótulo e dica de cada trecho pronto — mapa explícito para o typecheck acusar trecho novo sem tradução. */
const CLIP_LABEL_KEYS: Record<AnimationClipKey, { label: string; hint: string }> = {
  walking: { label: 'panels.animation.clipWalking', hint: 'panels.animation.clipHintWalking' },
  running: { label: 'panels.animation.clipRunning', hint: 'panels.animation.clipHintRunning' },
  jumping: { label: 'panels.animation.clipJumping', hint: 'panels.animation.clipHintJumping' },
  kpopFingerHeart: {
    label: 'panels.animation.clipKpopFingerHeart',
    hint: 'panels.animation.clipHintKpopFingerHeart',
  },
  kpopBoxArms: { label: 'panels.animation.clipKpopBoxArms', hint: 'panels.animation.clipHintKpopBoxArms' },
  kpopPointDance: {
    label: 'panels.animation.clipKpopPointDance',
    hint: 'panels.animation.clipHintKpopPointDance',
  },
  kpopShoulderWave: {
    label: 'panels.animation.clipKpopShoulderWave',
    hint: 'panels.animation.clipHintKpopShoulderWave',
  },
  balletPirouette: {
    label: 'panels.animation.clipBalletPirouette',
    hint: 'panels.animation.clipHintBalletPirouette',
  },
  dance: { label: 'panels.animation.clipDance', hint: 'panels.animation.clipHintDance' },
  handshake: { label: 'panels.animation.clipHandshake', hint: 'panels.animation.clipHintHandshake' },
  shoulderSpin: { label: 'panels.animation.clipShoulderSpin', hint: 'panels.animation.clipHintShoulderSpin' },
  piggyback: { label: 'panels.animation.clipPiggyback', hint: 'panels.animation.clipHintPiggyback' },
  carryCradle: { label: 'panels.animation.clipCarryCradle', hint: 'panels.animation.clipHintCarryCradle' },
  clinch: { label: 'panels.animation.clipClinch', hint: 'panels.animation.clipHintClinch' },
  punch: { label: 'panels.animation.clipPunch', hint: 'panels.animation.clipHintPunch' },
  kick: { label: 'panels.animation.clipKick', hint: 'panels.animation.clipHintKick' },
  kneeStrike: { label: 'panels.animation.clipKneeStrike', hint: 'panels.animation.clipHintKneeStrike' },
  armLock: { label: 'panels.animation.clipArmLock', hint: 'panels.animation.clipHintArmLock' },
  rearChokeStanding: {
    label: 'panels.animation.clipRearChokeStanding',
    hint: 'panels.animation.clipHintRearChokeStanding',
  },
  rearChokeSeated: {
    label: 'panels.animation.clipRearChokeSeated',
    hint: 'panels.animation.clipHintRearChokeSeated',
  },
  rearChokeGround: {
    label: 'panels.animation.clipRearChokeGround',
    hint: 'panels.animation.clipHintRearChokeGround',
  },
}

/**
 * Cópia vinda do keyframe vizinho esperando a escolha de quem recebe
 * (2026-08-06). `kind` diz o que se copia — o retrato inteiro ou só a colocação
 * no plano —, e `offset` de qual vizinho.
 */
interface PendingCopy {
  kind: 'pose' | 'placement'
  keyframeId: string
  offset: -1 | 1
}

/** A dica do botão que originou o clique vira o resumo do diálogo. */
const COPY_HINT_KEYS: Record<PendingCopy['kind'], { previous: string; next: string }> = {
  pose: { previous: 'panels.animation.copyPosePrevHint', next: 'panels.animation.copyPoseNextHint' },
  placement: {
    previous: 'panels.animation.copyPlacementPrevHint',
    next: 'panels.animation.copyPlacementNextHint',
  },
}

/**
 * Cópia vinda do vizinho esperando CONFIRMAÇÃO (pedido do usuário, 2026-08-07).
 *
 * É o caminho de quem não tem elenco a escolher: a câmera do keyframe é uma só,
 * e a pose/colocação com um boneco em cena também não tem o que marcar. Aí o
 * diálogo é o `ConfirmDialog` do "Regravar", e não o de caixas — que, com dois
 * bonecos ou mais, JÁ é a confirmação (empilhar as duas seriam duas telas para
 * uma cópia).
 */
interface PendingCopyConfirm {
  kind: 'camera' | 'pose' | 'placement'
  keyframeId: string
  offset: -1 | 1
}

/**
 * O que cada cópia vai fazer, dito POR LADO: os botões de um par ficam colados
 * na mesma fileira e a única diferença entre eles é a seta — trocar um pelo
 * outro é exatamente o engano que a confirmação existe para pegar, e um texto
 * genérico não o pegaria.
 */
const COPY_CONFIRM_KEYS: Record<
  PendingCopyConfirm['kind'],
  { title: string; confirm: string; previous: string; next: string }
> = {
  camera: {
    title: 'panels.animation.copyCameraTitle',
    confirm: 'panels.animation.copyCameraConfirm',
    previous: 'panels.animation.copyCameraPrevConfirmHint',
    next: 'panels.animation.copyCameraNextConfirmHint',
  },
  pose: {
    title: 'panels.animation.copyFiguresTitle',
    confirm: 'panels.animation.copyFiguresConfirm',
    previous: 'panels.animation.copyPosePrevConfirmHint',
    next: 'panels.animation.copyPoseNextConfirmHint',
  },
  placement: {
    title: 'panels.animation.copyFiguresTitle',
    confirm: 'panels.animation.copyFiguresConfirm',
    previous: 'panels.animation.copyPlacementPrevConfirmHint',
    next: 'panels.animation.copyPlacementNextConfirmHint',
  },
}

/** Prefixo que distingue, no combo de trechos, um trecho do usuário de um de fábrica. */
const SAVED_CLIP_PREFIX = 'saved:'

/** Segundos com uma casa — a linha do tempo se lê melhor em segundos que em milissegundos. */
function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

interface DurationFieldProps {
  label: string
  durationMs: number
  disabled: boolean
  onCommit: (durationMs: number) => void
}

/**
 * Duração de um trecho, confirmada ao sair do campo — o mesmo padrão da altura
 * do boneco (`FiguresPanel`). Grampear a cada tecla transformaria "2500" em
 * "12500": o primeiro dígito viraria 1 (o mínimo) e os seguintes se
 * acumulariam em cima dele.
 */
function DurationField({ label, durationMs, disabled, onCommit }: DurationFieldProps) {
  const [draft, setDraft] = useState(() => String(durationMs))
  const [lastSynced, setLastSynced] = useState(durationMs)
  if (durationMs !== lastSynced) {
    setLastSynced(durationMs)
    setDraft(String(durationMs))
  }

  return (
    <label className="animation-panel__duration">
      {label}
      <input
        type="number"
        min={1}
        step={100}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const value = Number(event.target.value)
          if (!Number.isNaN(value)) onCommit(value)
        }}
      />
    </label>
  )
}

interface NameFieldProps {
  label: string
  name: string
  disabled: boolean
  onCommit: (name: string) => void
}

/**
 * Nome da animação de trabalho, confirmado ao sair do campo — é ele que vira o
 * nome do MP4 e o nome sugerido ao guardar na biblioteca. Mesmo padrão da
 * duração: renomear a cada tecla encheria o undo de nomes pela metade.
 */
function NameField({ label, name, disabled, onCommit }: NameFieldProps) {
  const [draft, setDraft] = useState(name)
  const [lastSynced, setLastSynced] = useState(name)
  if (name !== lastSynced) {
    setLastSynced(name)
    setDraft(name)
  }

  return (
    <label className="animation-panel__field" htmlFor="animation-name">
      {label}
      <input
        id="animation-name"
        type="text"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const value = event.target.value.trim()
          // Campo vazio devolve o nome que estava lá: uma animação sem nome não
          // teria como virar arquivo.
          if (value === '') setDraft(name)
          else onCommit(value)
        }}
      />
    </label>
  )
}

interface GroupFieldProps {
  label: string
  value: string
  onCommit: (label: string) => void
}

/**
 * Rótulo do grupo do keyframe (item 38), confirmado ao sair do campo. O valor
 * que fica pode não ser o digitado: um rótulo já usado em outro trecho ganha
 * sufixo numérico no store, e o campo se sincroniza com o resultado.
 */
function GroupField({ label, value, onCommit }: GroupFieldProps) {
  const [draft, setDraft] = useState(value)
  const [lastSynced, setLastSynced] = useState(value)
  if (value !== lastSynced) {
    setLastSynced(value)
    setDraft(value)
  }

  return (
    <label className="animation-panel__group-field">
      {label}
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => onCommit(event.target.value)}
      />
    </label>
  )
}

interface SpeedFieldProps {
  label: string
  speed: number
  disabled: boolean
  onCommit: (speed: number) => void
}

/**
 * Redutor/acelerador de toda a linha do tempo, confirmado ao sair do campo —
 * mesmo padrão da duração do trecho, e pela mesma razão: grampear a cada tecla
 * impediria de digitar "0,5", porque o "0" sozinho já viraria o mínimo.
 */
function SpeedField({ label, speed, disabled, onCommit }: SpeedFieldProps) {
  const [draft, setDraft] = useState(() => speed.toFixed(2))
  const [lastSynced, setLastSynced] = useState(speed)
  if (speed !== lastSynced) {
    setLastSynced(speed)
    setDraft(speed.toFixed(2))
  }

  return (
    <label className="animation-panel__field" htmlFor="animation-speed">
      {label}
      <input
        id="animation-speed"
        type="number"
        min={MIN_ANIMATION_SPEED}
        max={MAX_ANIMATION_SPEED}
        step={ANIMATION_SPEED_STEP}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          const value = Number(event.target.value)
          // Campo vazio ("") vira 0 no `Number` e seria grampeado ao mínimo:
          // sair do campo sem digitar nada devolve o valor que estava lá.
          if (event.target.value.trim() === '' || Number.isNaN(value)) setDraft(speed.toFixed(2))
          else onCommit(value)
        }}
      />
    </label>
  )
}

export function AnimationPanel() {
  const { t } = useTranslation()

  const animations = useFiguresStore((state) => state.animations)
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const figureCount = figures.length
  const renameAnimation = useFiguresStore((state) => state.renameAnimation)
  const removeAnimation = useFiguresStore((state) => state.removeAnimation)
  const saveAnimationToLibrary = useFiguresStore((state) => state.saveAnimationToLibrary)
  const openAnimationFromLibrary = useFiguresStore((state) => state.openAnimationFromLibrary)
  const overwriteSavedAnimation = useFiguresStore((state) => state.overwriteSavedAnimation)
  const moveSavedAnimation = useFiguresStore((state) => state.moveSavedAnimation)
  const importAnimation = useFiguresStore((state) => state.importAnimation)
  const removeAnimationKeyframe = useFiguresStore((state) => state.removeAnimationKeyframe)
  const moveAnimationKeyframe = useFiguresStore((state) => state.moveAnimationKeyframe)
  const moveAnimationKeyframeBlock = useFiguresStore((state) => state.moveAnimationKeyframeBlock)
  const setAnimationKeyframeDuration = useFiguresStore((state) => state.setAnimationKeyframeDuration)
  const setAnimationKeyframeEasing = useFiguresStore((state) => state.setAnimationKeyframeEasing)
  const setAnimationKeyframeLabel = useFiguresStore((state) => state.setAnimationKeyframeLabel)
  const copyAnimationKeyframeCamera = useFiguresStore((state) => state.copyAnimationKeyframeCamera)
  const copyAnimationKeyframeFigures = useFiguresStore((state) => state.copyAnimationKeyframeFigures)
  const copyAnimationKeyframePlacement = useFiguresStore((state) => state.copyAnimationKeyframePlacement)
  const applySceneCameraToKeyframes = useFiguresStore((state) => state.applySceneCameraToKeyframes)
  const duplicateAnimationKeyframe = useFiguresStore((state) => state.duplicateAnimationKeyframe)
  const closeAnimationCycle = useFiguresStore((state) => state.closeAnimationCycle)
  const clipLibrary = useFiguresStore((state) => state.clipLibrary)
  const thumbnails = useKeyframeThumbnailStore((state) => state.thumbnails)
  const clearThumbnails = useKeyframeThumbnailStore((state) => state.clearThumbnails)
  const saveClipFromRange = useFiguresStore((state) => state.saveClipFromRange)
  const renameSavedClip = useFiguresStore((state) => state.renameSavedClip)
  const removeSavedClip = useFiguresStore((state) => state.removeSavedClip)
  const setAnimationSpeed = useFiguresStore((state) => state.setAnimationSpeed)

  const projection = useCameraStore((state) => state.projection)

  const timeMs = useAnimationStore((state) => state.timeMs)
  const playing = useAnimationStore((state) => state.playing)
  const onionSkin = useAnimationStore((state) => state.onionSkin)
  const setOnionSkin = useAnimationStore((state) => state.setOnionSkin)
  const onionSkinMode = useAnimationStore((state) => state.onionSkinMode)
  const setOnionSkinMode = useAnimationStore((state) => state.setOnionSkinMode)
  const onionSkinHiddenFigureIds = useAnimationStore((state) => state.onionSkinHiddenFigureIds)
  const setOnionSkinFigureShown = useAnimationStore((state) => state.setOnionSkinFigureShown)
  const depthOutput = useDepthStore((state) => state.videoDepth)
  const toggleDepthOutput = useDepthStore((state) => state.toggleVideoDepth)
  const fps = useAnimationStore((state) => state.fps)
  const aspectKey = useAnimationStore((state) => state.aspectKey)
  const qualityKey = useAnimationStore((state) => state.qualityKey)
  const exportPhase = useAnimationStore((state) => state.exportPhase)
  const exportedFrames = useAnimationStore((state) => state.exportedFrames)
  const exportTotalFrames = useAnimationStore((state) => state.exportTotalFrames)
  const exportErrorKey = useAnimationStore((state) => state.exportErrorKey)
  const lastExportFilename = useAnimationStore((state) => state.lastExportFilename)
  const resetTimeline = useAnimationStore((state) => state.resetTimeline)
  const visitedKeyframeId = useAnimationStore((state) => state.visitedKeyframeId)
  const setFps = useAnimationStore((state) => state.setFps)
  const selectAspect = useAnimationStore((state) => state.selectAspect)
  const selectQuality = useAnimationStore((state) => state.selectQuality)
  const requestCaptureKeyframe = useAnimationStore((state) => state.requestCaptureKeyframe)
  const requestAppendClip = useAnimationStore((state) => state.requestAppendClip)
  const requestAppendSavedClip = useAnimationStore((state) => state.requestAppendSavedClip)
  const requestUpdateKeyframe = useAnimationStore((state) => state.requestUpdateKeyframe)
  // A guarda temporária da bancada (2026-08-06): o "Ir para" a enche, este
  // botão a recupera. `requestGoToKeyframe` deixou de ser chamado direto —
  // quem despacha o comando é `goToKeyframeWithStash`, para não haver caminho
  // que sobrescreva a cena de trabalho sem guardá-la antes.
  const stash = useSceneStashStore((state) => state.stash)
  // A mesma marca de "intocado" da guarda alimenta o destaque do "Regravar"
  // (2026-08-07): se a bancada já não é o retrato que foi carregado nela, há o
  // que gravar. Ver `updateHighlight.ts`.
  const pristineFigures = useSceneStashStore((state) => state.pristineFigures)
  const requestThumbnails = useAnimationStore((state) => state.requestThumbnails)
  const requestExport = useAnimationStore((state) => state.requestExport)
  const cancelExport = useAnimationStore((state) => state.cancelExport)

  // Qual animação da biblioteca está escolhida para abrir/regravar/remover.
  const [savedDraft, setSavedDraft] = useState('')
  const [libraryNameDraft, setLibraryNameDraft] = useState('')

  // Animação lida de um arquivo, esperando o diálogo dizer o que fazer com ela
  // (fase 12); e a falha da última leitura/gravação de arquivo.
  const [pendingImport, setPendingImport] = useState<ImportedAnimation | null>(null)
  const [fileErrorKey, setFileErrorKey] = useState<string | null>(null)

  // Trechos prontos: qual trecho e quem faz cada papel. A escolha guarda o ID
  // e cai no padrão (1º boneco como A, o 1º diferente como B) quando o boneco
  // escolhido sai de cena — o combo nunca aponta para quem não existe.
  const [clipSelection, setClipSelection] = useState<string>('walking')
  const [clipRoleADraft, setClipRoleADraft] = useState('')
  const [clipRoleBDraft, setClipRoleBDraft] = useState('')
  // `null` = ninguém mexeu nas checkboxes ainda (item 37).
  const [soloDraft, setSoloDraft] = useState<string[] | null>(null)
  /** Grupos recolhidos na lista (item 38) — estado de ferramenta, fora do undo e do arquivo. */
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  /**
   * Keyframe cujo "Regravar" está esperando confirmação (pedido do usuário).
   * Um id só, e não um mapa: abrir a confirmação de outro card fecha a anterior
   * sozinho, que é o comportamento certo — duas confirmações abertas ao mesmo
   * tempo seriam duas chances de clicar na errada.
   */
  const [confirmingUpdateId, setConfirmingUpdateId] = useState<string | null>(null)
  /**
   * E o keyframe cujo "×" espera confirmação (pedido do usuário, 2026-08-06).
   * Mesma regra de um id só do "Regravar": abrir a confirmação de outro card
   * fecha a anterior sozinho.
   */
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)
  /**
   * E a cópia vinda do vizinho esperando confirmação (pedido do usuário,
   * 2026-08-07). Guarda o keyframe QUE RECEBE, o que se copia e de que lado vem
   * — é o que o diálogo precisa dizer. Mesma regra de um por vez do "Regravar"
   * e do "×".
   */
  const [confirmingCopy, setConfirmingCopy] = useState<PendingCopyConfirm | null>(null)
  /**
   * A pose estimada esperando confirmação: o keyframe do meio cujo card foi
   * clicado (pedido do usuário, 2026-08-07).
   */
  const [estimatingId, setEstimatingId] = useState<string | null>(null)
  /** O diálogo de carimbar a câmera atual numa faixa de keyframes está aberto? */
  const [applyingCamera, setApplyingCamera] = useState(false)
  /** E o de confirmar o "Limpar", que apaga a linha do tempo inteira. */
  const [clearingWorking, setClearingWorking] = useState(false)
  /**
   * A cópia vinda do vizinho esperando o diálogo dizer quem recebe
   * (2026-08-06), e os bonecos DESMARCADOS na última escolha.
   *
   * Guardar quem está de fora, e não quem está dentro, é o que faz "todas
   * marcadas" continuar valendo para boneco que entrou em cena depois — ele
   * nunca esteve na lista, então nasce marcado, como o usuário pediu.
   * Escolha de ferramenta: fora do undo e do arquivo.
   */
  const [pendingCopy, setPendingCopy] = useState<PendingCopy | null>(null)
  const [excludedCopyIds, setExcludedCopyIds] = useState<string[]>([])
  /** Papéis do trecho salvo escolhido, faixa a salvar e nome do trecho (item 39). */
  const [savedRoleDrafts, setSavedRoleDrafts] = useState<string[]>([])
  const [rangeFromDraft, setRangeFromDraft] = useState(0)
  const [rangeToDraft, setRangeToDraft] = useState(1)
  const [clipNameDraft, setClipNameDraft] = useState('')

  // O painel edita SEMPRE a animação de trabalho (item 36); a biblioteca é
  // cópia guardada, e abrir uma delas a traz para cá.
  const active = findWorkingAnimation(animations)
  const library = savedAnimations(animations)
  const selectedSaved = library.some((animation) => animation.id === savedDraft)
    ? savedDraft
    : (library[0]?.id ?? '')
  const totalMs = active ? animationDurationMs(active) : 0
  const speed = active ? active.speed : DEFAULT_ANIMATION_SPEED
  // O que o vídeo vai durar de fato — a linha do tempo dividida pela
  // velocidade. É o número que responde "e se eu puser 0,5?".
  const outputMs = active ? animationOutputDurationMs(active) : 0
  // Encurtar um trecho (ou trocar de animação) pode deixar a linha do tempo
  // parada além do fim; o que se mostra é sempre o instante que existe.
  const currentMs = Math.min(timeMs, totalMs)
  const startTimes = active ? keyframeStartTimesMs(active) : []
  // Onde a linha do tempo está (pedido do usuário): o ÚLTIMO keyframe por onde
  // ela passou. Derivado do instante, sem estado novo — vale para o ⏮/⏭, para
  // arrastar a régua e para as setas de quadro.
  //
  // Era o `keyframeIndexAtTimeMs`, que só acende o card quando o playhead cai
  // EXATAMENTE em cima de um keyframe: andando de quadro em quadro no meio de um
  // trecho, o painel ficava sem marca nenhuma, e perder a referência de onde se
  // estava foi a queixa do usuário (2026-08-06; DECISOES.md #133). O âncora é o
  // mesmo que o papel-cebola usa para saber de quem desenhar os vizinhos.
  const playheadIndex = active ? anchorKeyframeIndex(active, currentMs) : -1
  const groups = active ? keyframeGroups(active) : []
  const exporting = exportPhase === 'running'
  // Qual keyframe está esperando a confirmação de "Regravar": o diálogo precisa
  // do número e do instante, porque o card que originou o clique não está mais
  // à vista. Um keyframe que sumiu da lista (removido enquanto o diálogo
  // esperava) cai fora sozinho, sem estado a limpar.
  const confirmingIndex =
    active && confirmingUpdateId
      ? active.keyframes.findIndex((keyframe) => keyframe.id === confirmingUpdateId)
      : -1
  const confirmingUpdate =
    confirmingIndex >= 0 && confirmingUpdateId ? { id: confirmingUpdateId, index: confirmingIndex } : null
  // Mesma leitura para o "×": o diálogo precisa do número e do instante, e um
  // keyframe que sumiu da lista cai fora sozinho.
  const confirmingRemoveIndex =
    active && confirmingRemoveId
      ? active.keyframes.findIndex((keyframe) => keyframe.id === confirmingRemoveId)
      : -1
  const confirmingRemove =
    confirmingRemoveIndex >= 0 && confirmingRemoveId
      ? { id: confirmingRemoveId, index: confirmingRemoveIndex }
      : null
  // E para a cópia que espera confirmação. Além de sumir com o keyframe
  // removido, cai fora quando o vizinho de onde a cópia viria deixa de existir —
  // confirmar uma cópia sem origem não faria nada, e o diálogo estaria mentindo.
  const copyConfirmIndex =
    active && confirmingCopy
      ? active.keyframes.findIndex((keyframe) => keyframe.id === confirmingCopy.keyframeId)
      : -1
  const confirmingCopyTarget =
    active && confirmingCopy && copyConfirmIndex >= 0 &&
    active.keyframes[copyConfirmIndex + confirmingCopy.offset]
      ? { ...confirmingCopy, index: copyConfirmIndex }
      : null

  // A pose estimada precisa dos DOIS vizinhos: sem uma das pontas não há
  // caminho a dividir, e o keyframe que perdeu um vizinho enquanto o diálogo
  // esperava cai fora sozinho.
  const estimatingIndex =
    active && estimatingId
      ? active.keyframes.findIndex((keyframe) => keyframe.id === estimatingId)
      : -1
  const estimating =
    active && estimatingIndex > 0 && estimatingIndex < active.keyframes.length - 1
      ? { id: estimatingId as string, index: estimatingIndex }
      : null
  // Quem a estimativa alcança: os bonecos presentes nos TRÊS keyframes. É a
  // lista das caixas — e é ela, não a contagem de bonecos da cena, que decide
  // se há o que escolher (uma cena de três com um só estimável não tem).
  const estimableFigures =
    active && estimating
      ? estimableKeyframeFigures(
          active.keyframes[estimating.index],
          active.keyframes[estimating.index - 1],
          active.keyframes[estimating.index + 1],
        )
      : []
  const estimableInitialIds = estimableFigures
    .filter((figure) => !excludedCopyIds.includes(figure.id))
    .map((figure) => figure.id)

  // O destaque do "Regravar" (`updateHighlight.ts`): a bancada ainda é o retrato
  // que foi carregado nela? A marca de "intocado" da guarda (#127) já responde
  // isso por referência do array de bonecos — não há estado novo aqui.
  const benchPristine = pristineFigures !== null && pristineFigures === figures

  // A cópia esperando escolha: o keyframe que recebe, o vizinho de onde vem e o
  // elenco comum aos dois — que é o que o diálogo mostra em caixas. Um keyframe
  // removido enquanto o diálogo esperava cai fora sozinho, sem estado a limpar.
  const pendingCopyIndex =
    active && pendingCopy
      ? active.keyframes.findIndex((keyframe) => keyframe.id === pendingCopy.keyframeId)
      : -1
  const pendingCopyTarget = active && pendingCopyIndex >= 0 ? active.keyframes[pendingCopyIndex] : null
  const pendingCopySource =
    active && pendingCopyTarget && pendingCopy
      ? (active.keyframes[pendingCopyIndex + pendingCopy.offset] ?? null)
      : null
  const pendingCopyFigures =
    pendingCopyTarget && pendingCopySource ? sharedKeyframeFigures(pendingCopyTarget, pendingCopySource) : []
  // Todas marcadas, menos as que a última escolha deixou de fora.
  const pendingCopyInitialIds = pendingCopyFigures
    .filter((figure) => !excludedCopyIds.includes(figure.id))
    .map((figure) => figure.id)

  // A câmera do keyframe é uma câmera em perspectiva (posição, alvo e lente);
  // em ortográfica não há lente que interpolar, então a captura fica de fora.
  const perspective = projection === 'perspective'
  // Capturar NÃO exige animação: é a captura que cria a de trabalho (item 36).
  const canCapture = figureCount > 0 && perspective && !exporting
  const canExport = active !== null && active.keyframes.length > 0 && !exporting
  // Trecho escolhido: de fábrica ou do usuário (item 39).
  const savedClip = clipSelection.startsWith(SAVED_CLIP_PREFIX)
    ? (clipLibrary.find((clip) => clip.id === clipSelection.slice(SAVED_CLIP_PREFIX.length)) ?? null)
    : null
  const clipKey = (savedClip ? 'walking' : clipSelection) as AnimationClipKey
  const savedClipRoles = savedClip ? clipRoleCount(savedClip) : 0

  // Papéis efetivos dos trechos prontos.
  const duoClip = !savedClip && ANIMATION_CLIPS[clipKey].kind === 'duo'
  const clipRoleA = figures.some((figure) => figure.id === clipRoleADraft)
    ? clipRoleADraft
    : (figures[0]?.id ?? '')
  // Trecho individual: quem está marcado. Antes de qualquer clique vale o
  // boneco SELECIONADO (ou o primeiro), para o gesto de um clique continuar
  // existindo; desmarcar todos é uma escolha, e aí o botão desabilita.
  const soloFigureIds =
    soloDraft === null
      ? figures
          .filter((figure) => figure.id === (selectedFigureId ?? figures[0]?.id))
          .map((figure) => figure.id)
      : soloDraft.filter((id) => figures.some((figure) => figure.id === id))
  const clipRoleB =
    clipRoleBDraft !== clipRoleA && figures.some((figure) => figure.id === clipRoleBDraft)
      ? clipRoleBDraft
      : (figures.find((figure) => figure.id !== clipRoleA)?.id ?? '')
  // Mesmas condições da captura (animação ativa, boneco em cena, câmera em
  // perspectiva) — o trecho também congela a câmera viva nos keyframes.
  // Papéis do trecho salvo: cada um cai no primeiro boneco ainda não usado,
  // para o combo nunca nascer com dois papéis no mesmo boneco.
  const savedRoleIds: string[] = []
  for (let role = 0; role < savedClipRoles; role += 1) {
    const wanted = savedRoleDrafts[role]
    const valid = figures.some((figure) => figure.id === wanted) && !savedRoleIds.includes(wanted)
    savedRoleIds.push(
      valid ? wanted : (figures.find((figure) => !savedRoleIds.includes(figure.id))?.id ?? ''),
    )
  }

  const canAddClip =
    canCapture &&
    (savedClip
      ? savedClipRoles === 1
        ? soloFigureIds.length > 0
        : savedRoleIds.every((id) => id !== '') && new Set(savedRoleIds).size === savedClipRoles
      : duoClip
        ? clipRoleA !== '' && clipRoleB !== ''
        : soloFigureIds.length > 0)

  // Faixa a salvar como trecho: sempre dentro da lista de keyframes.
  const keyframeCount = active?.keyframes.length ?? 0
  const rangeFrom = Math.min(rangeFromDraft, Math.max(keyframeCount - 1, 0))
  const rangeTo = Math.min(rangeToDraft, Math.max(keyframeCount - 1, 0))

  const blockedReasonKey =
    figureCount === 0
      ? 'panels.animation.needsFigures'
      : !perspective
        ? 'panels.animation.needsPerspective'
        : !active
          ? 'panels.animation.startByCapturing'
          : null

  /**
   * Copiar do vizinho — câmera, pose ou colocação. Dois caminhos, e a escolha
   * entre eles é sobre haver ou não o que ESCOLHER:
   *
   * - com dois bonecos ou mais, pose e colocação vão para o diálogo de caixas
   *   (2026-08-06), que já é uma confirmação — quem marca as caixas e clica em
   *   "Copiar" não precisa de um aviso antes dizendo que vai copiar;
   * - o resto (a câmera sempre, e pose/colocação com um boneco só em cena) vai
   *   para o modal de confirmação (2026-08-07): não há nada a marcar, mas há o
   *   que perder — e são botões pequenos, colados, oito por card.
   */
  const requestCopy = (kind: PendingCopyConfirm['kind'], keyframeId: string, offset: -1 | 1) => {
    if (!active) return
    if (kind !== 'camera' && figureCount >= 2) {
      setPendingCopy({ kind, keyframeId, offset })
      return
    }
    setConfirmingCopy({ kind, keyframeId, offset })
  }

  const applyCopy = (copy: PendingCopyConfirm, figureIds?: string[]) => {
    if (!active) return
    if (copy.kind === 'camera') copyAnimationKeyframeCamera(active.id, copy.keyframeId, copy.offset)
    else if (copy.kind === 'pose')
      copyAnimationKeyframeFigures(active.id, copy.keyframeId, copy.offset, figureIds)
    else copyAnimationKeyframePlacement(active.id, copy.keyframeId, copy.offset, figureIds)
    // E a bancada vai JUNTO, para o keyframe já atualizado (pedido do usuário,
    // 2026-08-07): copiar é um ajuste daquele keyframe, e ver o resultado é
    // parte do gesto — antes disto a cópia acontecia fora da tela, e conferir
    // exigia um "Ir para" à mão logo depois. É o mesmo caminho daquele botão, e
    // por isso herda tudo dele: a cena que se estava montando vai para a guarda,
    // e a marca do item 40 passa a este card.
    //
    // A ordem importa: a cópia escreve no keyframe ANTES do carregamento, senão
    // a bancada receberia o retrato velho.
    const index = active.keyframes.findIndex((keyframe) => keyframe.id === copy.keyframeId)
    if (index >= 0) goToKeyframeWithStash(copy.keyframeId, startTimes[index])
  }

  /**
   * A pose estimada do card (pedido do usuário, 2026-08-07): a média entre o
   * keyframe anterior e o seguinte vai para a BANCADA, com o enquadramento
   * deste keyframe — conferir em 3D, ajustar, e só então "Regravar". A cena que
   * estava na tela vai para a guarda, como em todo "Ir para".
   */
  const applyEstimate = (index: number, figureIds?: string[]) => {
    if (!active) return
    const target = active.keyframes[index]
    const previous = active.keyframes[index - 1]
    const next = active.keyframes[index + 1]
    if (!target || !previous || !next) return
    applyEstimatedPoseToWorkbench(
      target.id,
      averageKeyframeFigures(target, previous, next, figureIds),
      target.camera,
    )
  }

  /**
   * Duplicar e ir para a CÓPIA (pedido do usuário, 2026-08-06): é ela que se
   * ajusta em seguida — duplicar é o jeito de criar o próximo keyframe partindo
   * deste —, e sem o "Ir para" os indicadores do painel e da régua continuavam
   * apontando para outro card, ou para nenhum.
   *
   * O instante da cópia é lido da lista JÁ atualizada, e não somado à mão: o
   * `set` do zustand é síncrono, então `getState()` logo depois já tem a lista
   * nova, e a aritmética de "duração do trecho que chega" não precisa ser
   * refeita aqui.
   *
   * **São dois passos de undo**, e é o certo: duplicar é uma edição da linha do
   * tempo, carregar o retrato é uma edição da cena. O primeiro Ctrl+Z devolve a
   * bancada, o segundo tira a cópia.
   */
  const handleDuplicate = (keyframeId: string) => {
    if (!active) return
    const copyId = duplicateAnimationKeyframe(active.id, keyframeId)
    if (!copyId) return
    const updated = findWorkingAnimation(useFiguresStore.getState().animations)
    if (!updated) return
    const at = updated.keyframes.findIndex((keyframe) => keyframe.id === copyId)
    if (at < 0) return
    goToKeyframeWithStash(copyId, keyframeStartTimesMs(updated)[at])
  }

  const handleSaveToLibrary = () => {
    if (saveAnimationToLibrary(libraryNameDraft)) setLibraryNameDraft('')
  }

  // Abrir SUBSTITUI a animação de trabalho — um Ctrl+Z devolve o que estava
  // nela, como carregar um snapshot de cena.
  const handleOpenSaved = () => {
    if (selectedSaved && openAnimationFromLibrary(selectedSaved)) {
      resetTimeline()
      // Ids de keyframe são únicos DENTRO de uma animação: sem limpar, o `k1`
      // da animação aberta mostraria a miniatura do `k1` da anterior.
      clearThumbnails()
    }
  }

  const handleClearWorking = () => {
    if (!active) return
    removeAnimation(active.id)
    resetTimeline()
    clearThumbnails()
  }

  // ------------------------------------------------------------------
  // Arquivo avulso da animação (fase 12)
  // ------------------------------------------------------------------

  const handleExportJson = async () => {
    if (!active) return
    setFileErrorKey(null)
    const json = serializeAnimationFile(active)
    await writeFileToDirectoryOrDownload(
      null,
      withExportTimestamp(`${slugifySceneName(active.name)}.json`),
      new Blob([json], { type: 'application/json' }),
    )
  }

  const handleImportJson = async () => {
    setFileErrorKey(null)
    const picked = await pickFile('.json,application/json')
    if (!picked) return
    try {
      const imported = parseImportedAnimation(JSON.parse(new TextDecoder().decode(picked.data)))
      // Arquivo lido, mas sem keyframe nenhum aproveitável: dizer isso é bem
      // mais útil do que abrir um diálogo para importar coisa nenhuma.
      if (!imported) {
        setFileErrorKey('errors.importNoAnimation')
        return
      }
      setPendingImport(imported)
    } catch {
      setFileErrorKey('errors.importUnreadable')
    }
  }

  const handleConfirmImport = (
    mode: AnimationImportMode,
    assignment: readonly string[] | null,
    substitute?: SubstituteChoice,
  ) => {
    setPendingImport(null)
    if (!pendingImport) return
    if (
      !importAnimation(pendingImport, {
        mode,
        assignment,
        startIndex: substitute?.startIndex,
        replaceCamera: substitute?.replaceCamera,
      })
    ) {
      setFileErrorKey('errors.importFailed')
      return
    }
    resetTimeline()
    // Ids de keyframe são únicos DENTRO de uma animação: sem limpar, o `k1` da
    // animação importada mostraria a miniatura do `k1` da anterior.
    clearThumbnails()
  }

  return (
    <CollapsiblePanel panelKey="animation" className="panel--animation" title={t('panels.animation.title')}>
      {/* Capturar fica GRUDADO no topo (pedido do usuário): é a ação repetida
          do painel, e com a lista de keyframes crescendo ela sumia para fora da
          rolagem justamente quando mais se usa. Vem antes de tudo e a rolagem
          acontece só embaixo dela. O aviso de "por que não dá para capturar"
          viaja junto — um botão desabilitado sem o motivo à vista não explica
          nada. */}
      <div className="animation-panel__capture-bar">
        <button
          type="button"
          className="animation-panel__capture"
          onClick={requestCaptureKeyframe}
          disabled={!canCapture}
        >
          {t('panels.animation.capture')}
        </button>

        {blockedReasonKey && (
          <p className="animation-panel__hint animation-panel__capture-hint">{t(blockedReasonKey)}</p>
        )}

        {/* Guarda temporária da bancada (pedido do usuário, 2026-08-06): "Ir
            para" sobrescreve a cena que se estava montando, e recuperá-la
            exigia lembrar do Ctrl+Z no meio de um ajuste. Fica AQUI, na barra
            grudada, e não junto dos cards: numa lista de vinte keyframes um
            botão no rodapé some da tela justamente quando se precisa dele.
            Sempre visível, desabilitado enquanto não há o que recuperar — um
            botão que só aparece depois do primeiro "Ir para" não se descobre. */}
        <button
          type="button"
          className="panel-action animation-panel__restore"
          onClick={restoreStash}
          disabled={!stash}
          title={t('panels.animation.restoreStashHint')}
        >
          {t('panels.animation.restoreStash')}
        </button>
        {!stash && (
          <p className="animation-panel__hint animation-panel__capture-hint">
            {t('panels.animation.restoreStashEmpty')}
          </p>
        )}
      </div>

      {/* Papel-cebola (item 31): fica logo acima da lista porque é dela que ele
          fala — o fantasma é o keyframe de cima e o de baixo do que está no
          playhead. Só faz sentido com dois keyframes ou mais, e some enquanto a
          animação toca (ver `OnionSkin.tsx`). */}
      {active && active.keyframes.length > 1 && (
        <label className="animation-panel__toggle">
          <input
            type="checkbox"
            checked={onionSkin}
            onChange={(event) => setOnionSkin(event.target.checked)}
          />
          {t('panels.animation.onionSkin')}
        </label>
      )}
      {/* Qual lado mostrar (pedido do usuário). Só aparece com o papel-cebola
          LIGADO: desligado, é um combo que não faz nada e ainda ocupa a linha
          logo acima da lista de keyframes, que é o espaço mais disputado do
          painel. */}
      {active && active.keyframes.length > 1 && onionSkin && (
        <>
          <label className="animation-panel__field" htmlFor="onion-skin-mode">
            {t('panels.animation.onionSkinMode')}
            <select
              id="onion-skin-mode"
              value={onionSkinMode}
              onChange={(event) => setOnionSkinMode(event.target.value as OnionSkinMode)}
            >
              {ONION_SKIN_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(ONION_SKIN_MODE_LABEL_KEYS[mode])}
                </option>
              ))}
            </select>
          </label>
          <p className="animation-panel__hint">{t('panels.animation.onionSkinHint')}</p>

          {/* De QUAIS bonecos sai o fantasma (pedido do usuário, 2026-08-06).
              Numa cena de várias pessoas, os fantasmas de todo mundo em volta
              lavam a tela e escondem o movimento que se está lendo. Só aparece
              com dois bonecos ou mais: com um só, a caixa seria uma linha a
              mais para não decidir nada, logo acima da lista de keyframes. */}
          {figureCount > 1 && (
            <fieldset className="animation-panel__clip-figures">
              <legend>{t('panels.animation.onionSkinFigures')}</legend>
              {figures.map((figure) => (
                <label key={figure.id} className="animation-panel__clip-figure">
                  <input
                    type="checkbox"
                    checked={!onionSkinHiddenFigureIds.includes(figure.id)}
                    onChange={(event) => setOnionSkinFigureShown(figure.id, event.target.checked)}
                  />
                  {figure.name}
                </label>
              ))}
              {figures.every((figure) => onionSkinHiddenFigureIds.includes(figure.id)) && (
                <p className="animation-panel__hint">{t('panels.animation.onionSkinNoFigures')}</p>
              )}
            </fieldset>
          )}
        </>
      )}

      {active && active.keyframes.length > 0 && (
        <ol className="animation-panel__keyframes">
          {active.keyframes.map((keyframe, index) => {
            // Grupos (item 38): keyframes CONSECUTIVOS com o mesmo rótulo. O
            // cabeçalho aparece no primeiro deles e recolhe o bloco inteiro.
            const label = keyframe.label?.trim() ?? ''
            const previousLabel = index > 0 ? (active.keyframes[index - 1].label?.trim() ?? '') : ''
            const startsGroup = label !== '' && label !== previousLabel
            const group = startsGroup ? groups.find((candidate) => candidate.startIndex === index) : undefined
            const groupCollapsed = label !== '' && collapsedGroups[label] === true
            // O "Regravar" deste card pede atenção? (2026-08-07, `updateHighlight.ts`)
            const updatePending = shouldHighlightUpdate({
              keyframeId: keyframe.id,
              visitedKeyframeId,
              benchPristine,
            })
            // A pose estimada precisa dos dois vizinhos — nas pontas não há
            // caminho a dividir — e de pelo menos um boneco presente nos três:
            // sem ninguém a estimar, o botão não teria o que fazer.
            const canEstimate =
              index > 0 &&
              index < active.keyframes.length - 1 &&
              !exporting &&
              estimableKeyframeFigures(
                keyframe,
                active.keyframes[index - 1],
                active.keyframes[index + 1],
              ).length > 0

            return (
              <Fragment key={keyframe.id}>
                {startsGroup && group && (
                  <li className="animation-panel__group">
                    {/* Nome e contagem numa linha; as setas do bloco na
                        seguinte (pedido do usuário, #117.1) — o título de um
                        grupo pode ser comprido, e disputar a linha com os
                        botões espremia os dois. */}
                    <span className="animation-panel__group-title">
                      <button
                        type="button"
                        className="animation-panel__group-toggle"
                        aria-expanded={!groupCollapsed}
                        onClick={() =>
                          setCollapsedGroups((current) => ({ ...current, [label]: !groupCollapsed }))
                        }
                      >
                        {groupCollapsed ? '▸' : '▾'} {label}
                      </button>
                      <span className="animation-panel__group-count">
                        {t('panels.animation.groupCount', {
                          count: group.endIndex - group.startIndex + 1,
                        })}
                      </span>
                    </span>
                    {/* O bloco anda INTEIRO e pula o vizinho inteiro (#117):
                        meio bloco dentro do outro partiria o vizinho em dois
                        grupos de mesmo nome, que é o que o item 38 evita. */}
                    <span className="animation-panel__group-actions">
                      <button
                        type="button"
                        onClick={() => moveAnimationKeyframeBlock(active.id, keyframe.id, -1)}
                        disabled={group.startIndex === 0}
                        aria-label={t('panels.animation.moveGroupUp')}
                        title={t('panels.animation.moveGroupUpHint')}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveAnimationKeyframeBlock(active.id, keyframe.id, 1)}
                        disabled={group.endIndex === active.keyframes.length - 1}
                        aria-label={t('panels.animation.moveGroupDown')}
                        title={t('panels.animation.moveGroupDownHint')}
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                )}

                {/* O card do keyframe que está NA BANCADA fica destacado (item
                    40): depois de um "Ir para", é ele que "Regravar" deve
                    reescrever, e sem a marca não havia nada na tela dizendo
                    qual era. O `aria-current` é a semântica certa para "o item
                    atual de um conjunto" — e serve de gancho ao teste. */}
                {/* E o card em que a LINHA DO TEMPO parou ganha marca própria,
                    mais discreta (pedido do usuário: saber onde o ⏮/⏭ deixou o
                    playhead). São duas coisas diferentes e por isso duas
                    marcas: o playhead só mexe na pré-visualização, enquanto a
                    cena que "Regravar" reescreve continua sendo a da bancada.
                    Fundi-las diria que se está editando um keyframe que não foi
                    carregado. */}
                {!groupCollapsed && (
            <li
              className={`animation-panel__keyframe${
                keyframe.id === visitedKeyframeId ? ' animation-panel__keyframe--visited' : ''
              }${index === playheadIndex ? ' animation-panel__keyframe--playhead' : ''}`}
              aria-current={keyframe.id === visitedKeyframeId ? 'true' : undefined}
            >
              <span className="animation-panel__keyframe-index">
                {index === playheadIndex && (
                  <span className="animation-panel__playhead" title={t('panels.animation.playheadHere')}>
                    ▶
                  </span>
                )}
                {t('panels.animation.keyframeLabel', { index: index + 1, time: formatSeconds(startTimes[index]) })}
              </span>

              {thumbnails[keyframe.id] && (
                <img
                  className="animation-panel__thumbnail"
                  src={thumbnails[keyframe.id]}
                  alt={t('panels.animation.thumbnailAlt', { index: index + 1 })}
                />
              )}

              <GroupField
                label={t('panels.animation.group')}
                value={keyframe.label ?? ''}
                onCommit={(next) => setAnimationKeyframeLabel(active.id, keyframe.id, next)}
              />

              <DurationField
                label={t('panels.animation.duration')}
                durationMs={keyframe.durationMs}
                // O primeiro keyframe não tem trecho de chegada: a duração dele
                // existe (reordenar não pode perdê-la) mas não vale.
                disabled={index === 0}
                onCommit={(durationMs) => setAnimationKeyframeDuration(active.id, keyframe.id, durationMs)}
              />

              {/* Suavização do trecho de chegada (item 26) — mesma convenção
                  da duração, inclusive o primeiro keyframe desabilitado. */}
              <label className="animation-panel__duration">
                {t('panels.animation.easing')}
                <select
                  value={keyframe.easing ?? 'linear'}
                  disabled={index === 0}
                  onChange={(event) =>
                    setAnimationKeyframeEasing(active.id, keyframe.id, event.target.value as KeyframeEasing)
                  }
                >
                  {KEYFRAME_EASINGS.map((easing) => (
                    <option key={easing} value={easing}>
                      {t(EASING_LABEL_KEYS[easing])}
                    </option>
                  ))}
                </select>
              </label>

              {/* Quatro linhas fixas (pedido do usuário), cada uma declarada
                  aqui e não deduzida por `nth-child`: elas têm contagens
                  diferentes (2, 2, 2 e 4) e um botão novo desalinharia qualquer
                  aritmética de seletor. A leitura também fica por pares — o que
                  é do keyframe, o que é da câmera, o que é da pose e o que é da
                  ordem da lista. */}
              <div className="animation-panel__keyframe-actions">
                {/* Regravar em DOIS passos (pedido do usuário, por cliques
                    indevidos): ele substitui a pose e a câmera guardadas pelo
                    que está na tela, e o Ctrl+Z é a única saída — num painel com
                    oito botões por card, um clique errado custa caro. Os outros
                    botões da lista não pedem confirmação porque são reversíveis
                    à vista (mover, duplicar) ou não perdem nada (Ir para).
                    A confirmação em si mora num `<dialog>` modal, fora da lista
                    (pedido do usuário, 2026-07-31): dentro do card ela ficava
                    colada nos botões dos keyframes VIZINHOS, que continuavam
                    clicáveis — ver `KeyframeUpdateDialog`. */}
                <div className="animation-panel__keyframe-row">
                  <button
                    type="button"
                    onClick={() => goToKeyframeWithStash(keyframe.id, startTimes[index])}
                    title={t('panels.animation.goTo')}
                  >
                    {t('panels.animation.goTo')}
                  </button>
                  {/* O destaque (2026-08-07) avisa que a cena e este card se
                      separaram — ou porque a bancada mudou depois de carregá-lo,
                      ou porque ele acabou de receber uma cópia do vizinho. A
                      regra está em `updateHighlight.ts`; aqui só se pendura a
                      classe e se troca a dica, porque o rótulo do botão não pode
                      mudar (é por ele que se acha o botão). */}
                  <button
                    type="button"
                    className={updatePending ? 'animation-panel__update--pending' : undefined}
                    onClick={() => setConfirmingUpdateId(keyframe.id)}
                    disabled={!canCapture}
                    title={
                      updatePending
                        ? t('panels.animation.updatePendingHint')
                        : t('panels.animation.update')
                    }
                  >
                    {t('panels.animation.update')}
                  </button>
                </div>

                {/* Copiar a câmera do vizinho: é o gesto de segurar o
                    enquadramento num trecho e deixar só os bonecos se moverem.
                    A pose deste keyframe não é tocada.

                    Passa pelo modal desde 2026-08-07 (pedido do usuário), pela
                    mesma razão do "Regravar" e do "×": joga fora o
                    enquadramento guardado no keyframe, só o Ctrl+Z devolve, e
                    os dois lados ficam colados na mesma fileira. */}
                <div className="animation-panel__keyframe-row">
                  <button
                    type="button"
                    onClick={() => requestCopy('camera', keyframe.id, -1)}
                    disabled={index === 0 || exporting}
                    aria-label={t('panels.animation.copyCameraPrevHint')}
                    title={t('panels.animation.copyCameraPrevHint')}
                  >
                    {t('panels.animation.copyCameraPrev')}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestCopy('camera', keyframe.id, 1)}
                    disabled={index === active.keyframes.length - 1 || exporting}
                    aria-label={t('panels.animation.copyCameraNextHint')}
                    title={t('panels.animation.copyCameraNextHint')}
                  >
                    {t('panels.animation.copyCameraNext')}
                  </button>
                </div>

                {/* Item 28: o simétrico dos dois de cima — segura a POSE e
                    deixa só a câmera se mover. */}
                <div className="animation-panel__keyframe-row">
                  <button
                    type="button"
                    onClick={() => requestCopy('pose', keyframe.id, -1)}
                    disabled={index === 0 || exporting}
                    aria-label={t('panels.animation.copyPosePrevHint')}
                    title={t('panels.animation.copyPosePrevHint')}
                  >
                    {t('panels.animation.copyPosePrev')}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestCopy('pose', keyframe.id, 1)}
                    disabled={index === active.keyframes.length - 1 || exporting}
                    aria-label={t('panels.animation.copyPoseNextHint')}
                    title={t('panels.animation.copyPoseNextHint')}
                  >
                    {t('panels.animation.copyPoseNext')}
                  </button>
                </div>

                {/* Pedido do usuário (2026-08-06): o terceiro par de setas, e o
                    mais fino dos três — traz do vizinho só a COLOCAÇÃO no plano
                    (X/Z), deixando pose, giro e a altura de um salto (Y) onde
                    estão. É o gesto de tirar a deriva de quem escorrega alguns
                    centímetros entre dois keyframes. */}
                <div className="animation-panel__keyframe-row">
                  <button
                    type="button"
                    onClick={() => requestCopy('placement', keyframe.id, -1)}
                    disabled={index === 0 || exporting}
                    aria-label={t('panels.animation.copyPlacementPrevHint')}
                    title={t('panels.animation.copyPlacementPrevHint')}
                  >
                    {t('panels.animation.copyPlacementPrev')}
                  </button>
                  <button
                    type="button"
                    onClick={() => requestCopy('placement', keyframe.id, 1)}
                    disabled={index === active.keyframes.length - 1 || exporting}
                    aria-label={t('panels.animation.copyPlacementNextHint')}
                    title={t('panels.animation.copyPlacementNextHint')}
                  >
                    {t('panels.animation.copyPlacementNext')}
                  </button>
                </div>

                {/* Pose estimada (pedido do usuário, 2026-08-07): o meio do
                    caminho entre os dois vizinhos, para preencher um quadro do
                    meio sem posar tudo à mão. Linha sozinha, e não um quinto
                    par: não é uma escolha entre dois lados — é UMA ação, e a
                    fileira inteira é dela.

                    A estimativa vai para a BANCADA, não para o keyframe
                    (decisão do usuário): dá para conferir em 3D e ajustar, e é
                    o "Regravar" que a grava — que, aliás, já vai estar
                    piscando. */}
                <div className="animation-panel__keyframe-row">
                  <button
                    type="button"
                    onClick={() => setEstimatingId(keyframe.id)}
                    disabled={!canEstimate}
                    title={t('panels.animation.estimatePoseHint')}
                  >
                    {t('panels.animation.estimatePose')}
                  </button>
                </div>

                <div className="animation-panel__keyframe-row animation-panel__keyframe-row--mixed">
                  <button
                    type="button"
                    onClick={() => moveAnimationKeyframe(active.id, keyframe.id, -1)}
                    disabled={index === 0}
                    aria-label={t('panels.animation.moveUp')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAnimationKeyframe(active.id, keyframe.id, 1)}
                    disabled={index === active.keyframes.length - 1}
                    aria-label={t('panels.animation.moveDown')}
                  >
                    ↓
                  </button>
                  {/* Dois retratos iguais em sequência são uma pausa. */}
                  <button
                    type="button"
                    className="animation-panel__duplicate"
                    onClick={() => handleDuplicate(keyframe.id)}
                    disabled={exporting}
                    aria-label={t('panels.animation.duplicateKeyframe')}
                    title={t('panels.animation.duplicateKeyframeHint')}
                  >
                    {t('panels.animation.duplicate')}
                  </button>
                  {/* Apagar confirma em MODAL (pedido do usuário, 2026-08-06):
                      é a única ação do card que joga fora a pose e a câmera
                      gravadas, e o × fica na mesma linha de quatro botões
                      pequenos onde o clique erra. Mesmo caminho do "Regravar"
                      (#100): o botão fica sempre visível, o diálogo é que é
                      renderizado condicionalmente, fora da lista. */}
                  <button
                    type="button"
                    onClick={() => setConfirmingRemoveId(keyframe.id)}
                    aria-label={t('panels.animation.removeKeyframe')}
                  >
                    ×
                  </button>
                </div>
              </div>
            </li>
                )}
              </Fragment>
            )
          })}
        </ol>
      )}

      {/* Ações da linha do tempo INTEIRA (pedido do usuário, 2026-07-31):
          fechar o ciclo, carimbar a câmera e gerar miniaturas fazem todas a
          mesma coisa — agem sobre a lista, não sobre um keyframe. Estavam
          espalhadas por três pontos do painel, duas delas depois do bloco de
          vídeo. Aqui elas ficam logo abaixo da lista de que falam, abertas
          pela velocidade — a outra propriedade da linha do tempo como um todo.

          "Salvar trecho" morava aqui e saiu para "Trechos prontos" (pedido do
          usuário, 2026-07-31): das quatro, era a única que não MEXIA na linha
          do tempo — lia uma faixa dela para produzir um trecho, que é o que o
          outro bloco aplica, renomeia e remove. */}
      <fieldset className="animation-panel__timeline-actions">
        <legend>{t('panels.animation.timelineActions')}</legend>

        {/* A velocidade abre o bloco (pedido do usuário): é a propriedade da
            linha do tempo como um todo, e não uma das ações — quem chega aqui
            depois de montar os keyframes olha para ela primeiro. Vale para a
            reprodução na tela E para o vídeo; não mexe na linha do tempo, os
            keyframes continuam nos mesmos instantes. */}
        <SpeedField
          label={t('panels.animation.speed')}
          speed={speed}
          disabled={!active || exporting}
          onCommit={(value) => active && setAnimationSpeed(active.id, value)}
        />
        <p className="animation-panel__hint">
          {t('panels.animation.speedHint', { duration: formatSeconds(outputMs) })}
        </p>

        {/* Item 27: sem o keyframe 1 repetido no fim, nenhum ciclo emenda — a
            última transição não volta ao ponto de partida. */}
        <button
          type="button"
          className="panel-action animation-panel__wide"
          onClick={() => active && closeAnimationCycle(active.id)}
          disabled={!active || active.keyframes.length < 2 || exporting}
          title={t('panels.animation.closeCycleHint')}
        >
          {t('panels.animation.closeCycle')}
        </button>

        {/* Carimbar a câmera atual numa faixa de keyframes (pedido do usuário):
            o gesto de achar o enquadramento e querer ele na animação inteira.
            Fica desabilitado TOCANDO porque durante a reprodução quem anda é o
            objeto vivo da câmera — o store só é sincronizado ao parar, e o que
            seria carimbado é o enquadramento de antes de dar play. */}
        <button
          type="button"
          className="panel-action animation-panel__wide"
          onClick={() => setApplyingCamera(true)}
          disabled={!active || active.keyframes.length === 0 || playing || exporting}
          title={t('panels.animation.applyCameraHint')}
        >
          {t('panels.animation.applyCamera')}
        </button>
        {active && active.keyframes.length > 0 && playing && (
          <p className="animation-panel__hint">{t('panels.animation.applyCameraPlaying')}</p>
        )}

        {/* Item 30: um retrato pequeno por keyframe, gerado sob demanda e
            guardado só em memória. */}
        <button
          type="button"
          className="panel-action animation-panel__wide"
          onClick={requestThumbnails}
          disabled={!active || active.keyframes.length === 0 || exporting}
          title={t('panels.animation.thumbnailsHint')}
        >
          {t('panels.animation.thumbnails')}
        </button>

      </fieldset>

      {/* Trechos prontos (DECISOES.md #60): sequências predefinidas de
          keyframes que entram no FINAL da linha do tempo, ancoradas no boneco
          do papel A. Nas cenas em dupla, os combos escolhem quem faz o quê.
          Recolhido por padrão (pedido do usuário, 2026-07-31): o combo tem 21
          opções e se escolhe uma por sessão — aberto, ele empurrava a lista de
          keyframes para fora da tela. */}
      <CollapsibleSection sectionKey="animationClips" title={t('panels.animation.clips')}>
        <fieldset className="animation-panel__clips">
          <label htmlFor="animation-clip" className="animation-panel__field">
            {t('panels.animation.clip')}
            <select
              id="animation-clip"
              value={clipSelection}
              onChange={(event) => setClipSelection(event.target.value)}
            >
              <optgroup label={t('panels.animation.clipGroupSolo')}>
                {ANIMATION_CLIP_KEYS.filter((key) => ANIMATION_CLIPS[key].kind === 'solo').map((key) => (
                  <option key={key} value={key}>
                    {t(CLIP_LABEL_KEYS[key].label)}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('panels.animation.clipGroupDuo')}>
                {ANIMATION_CLIP_KEYS.filter((key) => ANIMATION_CLIPS[key].kind === 'duo').map((key) => (
                  <option key={key} value={key}>
                    {t(CLIP_LABEL_KEYS[key].label)}
                  </option>
                ))}
              </optgroup>
              {/* Trechos do usuário (item 39) no MESMO combo dos prontos — do
                  lado de quem aplica, um trecho salvo é um trecho pronto. */}
              {clipLibrary.length > 0 && (
                <optgroup label={t('panels.animation.clipGroupSaved')}>
                  {clipLibrary.map((clip) => (
                    <option key={clip.id} value={`${SAVED_CLIP_PREFIX}${clip.id}`}>
                      {clip.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>

          <p className="animation-panel__hint">
            {savedClip
              ? t('panels.animation.clipSavedHint', { count: clipRoleCount(savedClip) })
              : t(CLIP_LABEL_KEYS[clipKey].hint)}
          </p>

          {/* Item 37: no trecho INDIVIDUAL, marcar vários bonecos aplica o
              trecho inteiro a todos ao mesmo tempo, cada um ancorado no próprio
              lugar. Em dupla continua sendo um combo por papel: os encaixes são
              medidos par a par, e dois "A" cairiam no mesmo ponto. */}
          {savedClipRoles > 1 ? (
            // Trecho salvo com mais de um papel: um combo por papel gravado.
            <>
              {Array.from({ length: savedClipRoles }, (_, role) => (
                <label
                  key={role}
                  htmlFor={`animation-saved-role-${role}`}
                  className="animation-panel__field"
                >
                  {t('panels.animation.clipSavedRole', { role: role + 1 })}
                  <select
                    id={`animation-saved-role-${role}`}
                    value={savedRoleIds[role] ?? ''}
                    onChange={(event) => {
                      const next = [...savedRoleIds]
                      next[role] = event.target.value
                      setSavedRoleDrafts(next)
                    }}
                  >
                    {figures.map((figure) => (
                      <option key={figure.id} value={figure.id}>
                        {figure.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              {new Set(savedRoleIds).size < savedClipRoles && (
                <p className="animation-panel__hint">{t('panels.animation.clipSavedNeedsDistinct')}</p>
              )}
            </>
          ) : duoClip ? (
            <label htmlFor="animation-clip-role-a" className="animation-panel__field">
              {t('panels.animation.clipRoleA')}
              <select
                id="animation-clip-role-a"
                value={clipRoleA}
                onChange={(event) => setClipRoleADraft(event.target.value)}
              >
                {figures.map((figure) => (
                  <option key={figure.id} value={figure.id}>
                    {figure.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <fieldset className="animation-panel__clip-figures">
              <legend>{t('panels.animation.clipFigures')}</legend>
              {figures.map((figure) => (
                <label key={figure.id} className="animation-panel__clip-figure">
                  <input
                    type="checkbox"
                    checked={soloFigureIds.includes(figure.id)}
                    onChange={(event) =>
                      setSoloDraft(
                        event.target.checked
                          ? [...soloFigureIds, figure.id]
                          : soloFigureIds.filter((id) => id !== figure.id),
                      )
                    }
                  />
                  {figure.name}
                </label>
              ))}
              {soloFigureIds.length === 0 && (
                <p className="animation-panel__hint">{t('panels.animation.clipNeedsFigure')}</p>
              )}
            </fieldset>
          )}

          {duoClip && (
            <label htmlFor="animation-clip-role-b" className="animation-panel__field">
              {t('panels.animation.clipRoleB')}
              <select
                id="animation-clip-role-b"
                value={clipRoleB}
                onChange={(event) => setClipRoleBDraft(event.target.value)}
              >
                {figures
                  .filter((figure) => figure.id !== clipRoleA)
                  .map((figure) => (
                    <option key={figure.id} value={figure.id}>
                      {figure.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

          <button
            type="button"
            className="panel-action"
            onClick={() => {
              if (savedClip) {
                // Um papel só: cada boneco marcado executa o trecho no próprio
                // lugar (item 37). Mais de um: um elenco só, um boneco por papel.
                const casts =
                  savedClipRoles === 1 ? soloFigureIds.map((id) => [id]) : [savedRoleIds]
                requestAppendSavedClip(savedClip.id, casts, `${savedClip.name} 1`)
                return
              }
              requestAppendClip(
                clipKey,
                duoClip ? [clipRoleA] : soloFigureIds,
                duoClip ? clipRoleB : undefined,
                // O trecho já nasce agrupado com o próprio nome (item 38); o
                // sufixo resolve a segunda inserção sozinho.
                `${t(CLIP_LABEL_KEYS[clipKey].label)} 1`,
              )
            }}
            disabled={!canAddClip}
            title={t('panels.animation.clipAddHint')}
          >
            {t('panels.animation.clipAdd')}
          </button>

          {duoClip && figureCount < 2 && (
            <p className="animation-panel__hint">{t('panels.animation.clipNeedsTwoFigures')}</p>
          )}

          {/* Salvar uma faixa da linha do tempo como trecho reutilizável (item
              39): os keyframes literais, SEM a câmera — ao aplicar, o trecho
              congela a câmera viva, como os de fábrica.

              Mora AQUI (pedido do usuário, 2026-07-31), e não nas ações da
              linha do tempo: o que sai daqui é um trecho, e é este bloco que
              aplica, renomeia e remove trechos. Lá em cima ele era a única
              ação que produzia algo para OUTRO bloco consumir.

              É também o que põe "Nome do trecho" acima dos dois botões que o
              usam — "Salvar trecho" cria um novo com esse nome, "Renomear
              trecho" rebatiza o que está escolhido no combo. */}
          {active && active.keyframes.length >= 2 && (
            <div className="animation-panel__save-clip">
              <label htmlFor="animation-clip-from" className="animation-panel__field">
                {t('panels.animation.clipRangeFrom')}
                <select
                  id="animation-clip-from"
                  value={rangeFrom}
                  onChange={(event) => setRangeFromDraft(Number(event.target.value))}
                >
                  {active.keyframes.map((keyframe, index) => (
                    // O número do keyframe MAIS o instante: só o número faria a
                    // opção "2" (índice 1) e o valor 2 se confundirem, na leitura
                    // e em qualquer automação.
                    <option key={keyframe.id} value={index}>
                      {`${index + 1} — ${formatSeconds(startTimes[index])}`}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="animation-clip-to" className="animation-panel__field">
                {t('panels.animation.clipRangeTo')}
                <select
                  id="animation-clip-to"
                  value={rangeTo}
                  onChange={(event) => setRangeToDraft(Number(event.target.value))}
                >
                  {active.keyframes.map((keyframe, index) => (
                    // O número do keyframe MAIS o instante: só o número faria a
                    // opção "2" (índice 1) e o valor 2 se confundirem, na leitura
                    // e em qualquer automação.
                    <option key={keyframe.id} value={index}>
                      {`${index + 1} — ${formatSeconds(startTimes[index])}`}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="animation-clip-name" className="animation-panel__field">
                {t('panels.animation.clipSaveName')}
                <input
                  id="animation-clip-name"
                  type="text"
                  value={clipNameDraft}
                  onChange={(event) => setClipNameDraft(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="panel-action"
                onClick={() => {
                  if (saveClipFromRange(active.id, rangeFrom, rangeTo, clipNameDraft)) setClipNameDraft('')
                }}
                disabled={rangeFrom === rangeTo}
                title={t('panels.animation.clipSaveHint')}
              >
                {t('panels.animation.clipSave')}
              </button>
              {rangeFrom === rangeTo && (
                <p className="animation-panel__hint">{t('panels.animation.clipRangeTooShort')}</p>
              )}
            </div>
          )}

          {savedClip && (
            <div className="animation-panel__buttons">
              <button
                type="button"
                onClick={() => {
                  renameSavedClip(savedClip.id, clipNameDraft)
                  setClipNameDraft('')
                }}
                disabled={!clipNameDraft.trim()}
              >
                {t('panels.animation.clipRenameSaved')}
              </button>
              <button
                type="button"
                onClick={() => {
                  removeSavedClip(savedClip.id)
                  setClipSelection('walking')
                }}
              >
                {t('panels.animation.clipRemoveSaved')}
              </button>
            </div>
          )}
        </fieldset>
      </CollapsibleSection>

      {/* Saída em vídeo, também recolhida: quadros por segundo, proporção,
          qualidade e a exportação em si. É o último passo do trabalho, e o
          único bloco que não se toca enquanto se monta a animação. */}
      <CollapsibleSection sectionKey="animationVideo" title={t('panels.animation.video')}>
        <label htmlFor="animation-fps" className="animation-panel__field">
          {t('panels.animation.fps')}
          <select id="animation-fps" value={fps} onChange={(event) => setFps(Number(event.target.value))}>
            {FPS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        {/* Proporção × qualidade (fase 11.4): os mesmos rótulos do instantâneo —
            o vídeo só não tem a personalizada. */}
        <label htmlFor="animation-aspect" className="animation-panel__field">
          {t('panels.snapshots.aspect')}
          <select
            id="animation-aspect"
            value={aspectKey}
            onChange={(event) => selectAspect(event.target.value as OutputAspectKey)}
          >
            {OUTPUT_ASPECT_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(ASPECT_LABEL_KEYS[key])}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="animation-quality" className="animation-panel__field">
          {t('panels.snapshots.quality')}
          <select
            id="animation-quality"
            value={qualityKey}
            onChange={(event) => selectQuality(event.target.value as OutputQualityKey)}
          >
            {OUTPUT_QUALITY_KEYS.map((key) => (
              <option key={key} value={key}>
                {t(QUALITY_LABEL_KEYS[key])}
              </option>
            ))}
          </select>
        </label>

        {/* Mapa de profundidade (fase 13): mesma regra do instantâneo — saída
            alternativa, um arquivo por exportação, sufixo `_depth` no nome. */}
        <label className="animation-panel__toggle" title={t('panels.animation.depthOutputHint')}>
          <input type="checkbox" checked={depthOutput} onChange={toggleDepthOutput} />
          {t('panels.animation.depthOutput')}
        </label>

        <button type="button" className="panel-action animation-panel__export" onClick={requestExport} disabled={!canExport}>
          {t('panels.animation.export')}
        </button>

        {exporting && (
          <div className="animation-panel__export-status">
            <p>{t('panels.animation.exporting', { frame: exportedFrames, total: exportTotalFrames })}</p>
            <button type="button" onClick={cancelExport}>
              {t('panels.animation.cancelExport')}
            </button>
          </div>
        )}

        {exportPhase === 'done' && lastExportFilename && (
          <p className="animation-panel__hint">
            {t('panels.animation.exported', { filename: lastExportFilename })}
          </p>
        )}
        {exportPhase === 'cancelled' && <p className="animation-panel__hint">{t('panels.animation.cancelled')}</p>}
        {exportPhase === 'error' && exportErrorKey && (
          <p className="animation-panel__hint animation-panel__hint--error">{t(exportErrorKey)}</p>
        )}
      </CollapsibleSection>

      {/* Biblioteca de animações (item 36) e os arquivos JSON (fase 12):
          guardar, reabrir, exportar e importar. Recolhida pela mesma razão
          das outras duas — é onde se começa e onde se termina, não onde se
          trabalha. */}
      <CollapsibleSection sectionKey="animationLibrary" title={t('panels.animation.library')}>
        {/* Biblioteca de animações (item 36): cópias nomeadas da de trabalho,
            guardadas no mesmo autosave e no mesmo `animations.json`. Abrir uma
            delas SUBSTITUI a de trabalho, como carregar um snapshot de cena. */}
        <fieldset className="animation-panel__library">
          {/* O nome da animação de trabalho (item 36) mora AQUI, e não no topo do
              painel (pedido do usuário): é do mesmo assunto que a biblioteca —
              ele é o que vira o nome do MP4 e o padrão de "Nome para guardar",
              logo abaixo. No topo ele separava o botão de capturar da lista de
              keyframes sem ter nada a ver com nenhum dos dois. */}
          <NameField
            label={t('panels.animation.name')}
            name={active?.name ?? ''}
            disabled={!active}
            onCommit={(name) => active && renameAnimation(active.id, name)}
          />

          <label htmlFor="animation-library-name" className="animation-panel__field">
            {t('panels.animation.libraryName')}
            <input
              id="animation-library-name"
              type="text"
              value={libraryNameDraft}
              onChange={(event) => setLibraryNameDraft(event.target.value)}
              placeholder={active?.name ?? ''}
            />
          </label>

          <div className="animation-panel__buttons">
            <button
              type="button"
              onClick={handleSaveToLibrary}
              disabled={!active || active.keyframes.length === 0}
              title={t('panels.animation.saveToLibraryHint')}
            >
              {t('panels.animation.saveToLibrary')}
            </button>
            <button type="button" onClick={() => setClearingWorking(true)} disabled={!active}>
              {t('panels.animation.clearWorking')}
            </button>
          </div>

          {library.length === 0 ? (
            <p className="animation-panel__hint">{t('panels.animation.libraryEmpty')}</p>
          ) : (
            <>
              <label htmlFor="animation-saved" className="animation-panel__field">
                {t('panels.animation.savedAnimation')}
                <select
                  id="animation-saved"
                  value={selectedSaved}
                  onChange={(event) => setSavedDraft(event.target.value)}
                >
                  {library.map((animation) => (
                    <option key={animation.id} value={animation.id}>
                      {animation.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="animation-panel__buttons">
                <button type="button" onClick={handleOpenSaved} title={t('panels.animation.openHint')}>
                  {t('panels.animation.open')}
                </button>
                <button
                  type="button"
                  onClick={() => overwriteSavedAnimation(selectedSaved)}
                  disabled={!active || active.keyframes.length === 0}
                  title={t('panels.animation.overwriteSavedHint')}
                >
                  {t('panels.animation.overwriteSaved')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    renameAnimation(selectedSaved, libraryNameDraft)
                    setLibraryNameDraft('')
                  }}
                  disabled={!libraryNameDraft.trim()}
                >
                  {t('panels.animation.rename')}
                </button>
                <button type="button" onClick={() => removeAnimation(selectedSaved)}>
                  {t('panels.animation.remove')}
                </button>
                {/* Reordenar a biblioteca (item 19), como no catálogo de
                    cenas: a ordem era fixa pela criação. */}
                <button
                  type="button"
                  disabled={library.findIndex((animation) => animation.id === selectedSaved) <= 0}
                  onClick={() => moveSavedAnimation(selectedSaved, -1)}
                >
                  {t('panels.animation.moveSavedUp')}
                </button>
                <button
                  type="button"
                  disabled={
                    library.findIndex((animation) => animation.id === selectedSaved) ===
                    library.length - 1
                  }
                  onClick={() => moveSavedAnimation(selectedSaved, 1)}
                >
                  {t('panels.animation.moveSavedDown')}
                </button>
              </div>

              <p className="animation-panel__hint">{t('panels.animation.openHint')}</p>
            </>
          )}
        </fieldset>

        {/* Arquivo avulso da animação de trabalho (fase 12), em bloco PRÓPRIO
            (pedido do usuário, 2026-07-31): exportar leva a linha do tempo
            inteira num JSON e importar traz um de volta. É o outro sistema de
            guarda — no meio dos botões da biblioteca, os dois se liam como se
            fossem o mesmo. */}
        <fieldset className="animation-panel__files">
          <legend>{t('panels.animation.libraryFiles')}</legend>

          <div className="animation-panel__buttons">
            <button
              type="button"
              onClick={() => void handleExportJson()}
              disabled={!active || active.keyframes.length === 0}
              title={t('panels.animation.exportJsonHint')}
            >
              {t('panels.animation.exportJson')}
            </button>
            <button
              type="button"
              onClick={() => void handleImportJson()}
              title={t('panels.animation.importJsonHint')}
            >
              {t('panels.animation.importJson')}
            </button>
          </div>

          {fileErrorKey && (
            <p role="alert" className="panel__error">
              {t(fileErrorKey)}
            </p>
          )}
        </fieldset>
      </CollapsibleSection>

      {pendingImport && (
        <AnimationImportDialog
          imported={pendingImport}
          sceneFigures={figures}
          workingKeyframes={active?.keyframes ?? []}
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {/* A confirmação de "Regravar" (DECISOES.md #69) mora fora da lista: o
          card que originou o clique some de vista, então o diálogo repete o
          número e o instante do keyframe. Um id em confirmação por vez — abrir
          a de outro card fecha a anterior sozinho. */}
      {active && confirmingUpdate && (
        <ConfirmDialog
          title={t('panels.animation.updateTitle')}
          detail={t('panels.animation.keyframeLabel', {
            index: confirmingUpdate.index + 1,
            time: formatSeconds(startTimes[confirmingUpdate.index]),
          })}
          message={t('panels.animation.updateConfirmHint')}
          confirmLabel={t('panels.animation.updateConfirm')}
          onConfirm={() => {
            requestUpdateKeyframe(confirmingUpdate.id)
            setConfirmingUpdateId(null)
            // Gravado: o keyframe passou a guardar exatamente o que está na
            // bancada, que volta a valer como retrato intocado — e o destaque,
            // que só lê essa marca, se apaga.
            markWorkbenchRecorded()
          }}
          onCancel={() => setConfirmingUpdateId(null)}
        />
      )}

      {/* Quem recebe a cópia vinda do vizinho (pedido do usuário, 2026-08-06).
          A lista é o elenco COMUM aos dois keyframes: marcar quem não está nos
          dois seria uma caixa que não faz nada. */}
      {pendingCopyTarget && pendingCopy && (
        <CopyFiguresDialog
          detail={t('panels.animation.keyframeLabel', {
            index: pendingCopyIndex + 1,
            time: formatSeconds(startTimes[pendingCopyIndex]),
          })}
          summary={t(COPY_HINT_KEYS[pendingCopy.kind][pendingCopy.offset === -1 ? 'previous' : 'next'])}
          figures={pendingCopyFigures}
          initialIds={pendingCopyInitialIds}
          onConfirm={(figureIds) => {
            // A escolha vale para as cópias seguintes da sessão: guarda-se quem
            // ficou DE FORA, entre os que estavam à vista. Quem não foi listado
            // agora mantém o estado que já tinha.
            const listed = pendingCopyFigures.map((figure) => figure.id)
            setExcludedCopyIds([
              ...excludedCopyIds.filter((id) => !listed.includes(id)),
              ...listed.filter((id) => !figureIds.includes(id)),
            ])
            applyCopy(pendingCopy, figureIds)
            setPendingCopy(null)
          }}
          onCancel={() => setPendingCopy(null)}
        />
      )}

      {/* Copiar do vizinho quando não há elenco a escolher (pedido do usuário:
          a câmera em 2026-08-07, a pose e a colocação no mesmo dia). O molde é o
          `ConfirmDialog` do "Regravar", com o número do keyframe QUE RECEBE e o
          lado de onde a cópia vem: os pares ficam colados na fileira, e trocar
          um pelo outro é exatamente o engano que a confirmação pega. */}
      {active && confirmingCopyTarget && (
        <ConfirmDialog
          title={t(COPY_CONFIRM_KEYS[confirmingCopyTarget.kind].title)}
          detail={t('panels.animation.keyframeLabel', {
            index: confirmingCopyTarget.index + 1,
            time: formatSeconds(startTimes[confirmingCopyTarget.index]),
          })}
          message={t(
            COPY_CONFIRM_KEYS[confirmingCopyTarget.kind][
              confirmingCopyTarget.offset === -1 ? 'previous' : 'next'
            ],
          )}
          confirmLabel={t(COPY_CONFIRM_KEYS[confirmingCopyTarget.kind].confirm)}
          onConfirm={() => {
            applyCopy(confirmingCopyTarget)
            setConfirmingCopy(null)
          }}
          onCancel={() => setConfirmingCopy(null)}
        />
      )}

      {/* A pose estimada (pedido do usuário, 2026-08-07). O detalhe diz o
          keyframe que se está estimando; a mensagem, que quem muda é a BANCADA
          e que a cena atual vai para a guarda — é o oposto do que os outros
          diálogos deste painel fazem, e não dizê-lo seria deixar o usuário
          achando que o keyframe já mudou. */}
      {active && estimating && estimableFigures.length < 2 && (
        <ConfirmDialog
          title={t('panels.animation.estimatePoseTitle')}
          detail={t('panels.animation.keyframeLabel', {
            index: estimating.index + 1,
            time: formatSeconds(startTimes[estimating.index]),
          })}
          message={t('panels.animation.estimatePoseConfirmHint')}
          confirmLabel={t('panels.animation.estimatePoseConfirm')}
          onConfirm={() => {
            applyEstimate(estimating.index)
            setEstimatingId(null)
          }}
          onCancel={() => setEstimatingId(null)}
        />
      )}

      {/* Com dois estimáveis ou mais, a pergunta deixa de ser "confirma?" e passa
          a ser "em quem?" (pedido do usuário, 2026-08-07) — e aí é a MESMA caixa
          da cópia entre vizinhos, com outro título. Numa cena de duas pessoas,
          estimar o quadro do meio de uma não pode arrastar a outra junto.

          A memória de quem ficou de fora é COMPARTILHADA com as cópias, de
          propósito: é a mesma pergunta sobre o mesmo elenco no mesmo card
          ("quem eu estou acertando agora"), e duas memórias independentes para
          botões vizinhos seriam duas respostas para uma pergunta só. Nada fica
          escondido — as caixas estão à vista ao confirmar. */}
      {active && estimating && estimableFigures.length >= 2 && (
        <CopyFiguresDialog
          title={t('panels.animation.estimatePoseTitle')}
          confirmLabel={t('panels.animation.estimatePoseConfirm')}
          detail={t('panels.animation.keyframeLabel', {
            index: estimating.index + 1,
            time: formatSeconds(startTimes[estimating.index]),
          })}
          summary={t('panels.animation.estimatePoseConfirmHint')}
          figures={estimableFigures}
          initialIds={estimableInitialIds}
          onConfirm={(figureIds) => {
            const listed = estimableFigures.map((figure) => figure.id)
            setExcludedCopyIds([
              ...excludedCopyIds.filter((id) => !listed.includes(id)),
              ...listed.filter((id) => !figureIds.includes(id)),
            ])
            applyEstimate(estimating.index, figureIds)
            setEstimatingId(null)
          }}
          onCancel={() => setEstimatingId(null)}
        />
      )}

      {/* E a de apagar (pedido do usuário, 2026-08-06), pela mesma razão e no
          mesmo molde: o "×" joga fora a pose e a câmera gravadas no keyframe, e
          fica encostado em três outros botões pequenos. */}
      {active && confirmingRemove && (
        <ConfirmDialog
          title={t('panels.animation.removeTitle')}
          detail={t('panels.animation.keyframeLabel', {
            index: confirmingRemove.index + 1,
            time: formatSeconds(startTimes[confirmingRemove.index]),
          })}
          message={t('panels.animation.removeConfirmHint')}
          confirmLabel={t('panels.animation.removeConfirm')}
          onConfirm={() => {
            removeAnimationKeyframe(active.id, confirmingRemove.id)
            setConfirmingRemoveId(null)
          }}
          onCancel={() => setConfirmingRemoveId(null)}
        />
      )}

      {/* Limpar apaga a linha do tempo INTEIRA e só o Ctrl+Z devolve — e ele
          ficava ao lado de "Salvar na biblioteca", sem pedir nada, enquanto
          regravar UM keyframe pedia confirmação. A proteção agora é a mesma
          (pedido do usuário, 2026-07-31). */}
      {active && clearingWorking && (
        <ConfirmDialog
          title={t('panels.animation.clearWorkingTitle')}
          detail={t('panels.animation.clearWorkingDetail', {
            name: active.name,
            count: active.keyframes.length,
          })}
          message={t('panels.animation.clearWorkingConfirmHint')}
          confirmLabel={t('panels.animation.clearWorkingConfirm')}
          onConfirm={() => {
            handleClearWorking()
            setClearingWorking(false)
          }}
          onCancel={() => setClearingWorking(false)}
        />
      )}

      {active && applyingCamera && active.keyframes.length > 0 && (
        <ApplyCameraDialog
          keyframes={active.keyframes}
          onConfirm={(fromIndex, toIndex) => {
            applySceneCameraToKeyframes(active.id, fromIndex, toIndex)
            setApplyingCamera(false)
          }}
          onCancel={() => setApplyingCamera(false)}
        />
      )}
    </CollapsiblePanel>
  )
}
