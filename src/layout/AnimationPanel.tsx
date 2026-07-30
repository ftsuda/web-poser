import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ANIMATION_SPEED_STEP,
  DEFAULT_ANIMATION_SPEED,
  MAX_ANIMATION_SPEED,
  MIN_ANIMATION_SPEED,
  animationDurationMs,
  animationOutputDurationMs,
  findWorkingAnimation,
  keyframeGroups,
  keyframeIndexAtTimeMs,
  keyframeStartTimesMs,
  savedAnimations,
} from '../animation/animation'
import { ANIMATION_CLIPS, ANIMATION_CLIP_KEYS, type AnimationClipKey } from '../animation/animationClips'
import { clipRoleCount } from '../animation/clipLibrary'
import { FPS_OPTIONS } from '../animation/frameTimeline'
import { ONION_SKIN_MODES, type OnionSkinMode } from '../animation/onionSkin'
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
import { useFiguresStore } from '../store/figuresStore'
import { useKeyframeThumbnailStore } from '../store/keyframeThumbnailStore'
import type { AnimationImportMode } from '../store/figuresStore'
import { AnimationImportDialog } from './AnimationImportDialog'
import { CollapsiblePanel } from './CollapsiblePanel'

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
  const importAnimation = useFiguresStore((state) => state.importAnimation)
  const removeAnimationKeyframe = useFiguresStore((state) => state.removeAnimationKeyframe)
  const moveAnimationKeyframe = useFiguresStore((state) => state.moveAnimationKeyframe)
  const setAnimationKeyframeDuration = useFiguresStore((state) => state.setAnimationKeyframeDuration)
  const setAnimationKeyframeLabel = useFiguresStore((state) => state.setAnimationKeyframeLabel)
  const copyAnimationKeyframeCamera = useFiguresStore((state) => state.copyAnimationKeyframeCamera)
  const copyAnimationKeyframeFigures = useFiguresStore((state) => state.copyAnimationKeyframeFigures)
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
  const onionSkin = useAnimationStore((state) => state.onionSkin)
  const setOnionSkin = useAnimationStore((state) => state.setOnionSkin)
  const onionSkinMode = useAnimationStore((state) => state.onionSkinMode)
  const setOnionSkinMode = useAnimationStore((state) => state.setOnionSkinMode)
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
  const requestGoToKeyframe = useAnimationStore((state) => state.requestGoToKeyframe)
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
  // Em qual keyframe a linha do tempo parou (pedido do usuário): é o que
  // responde "onde o ⏮/⏭ me deixou". Derivado do instante, sem estado novo —
  // vale também para arrastar a régua e para as setas de quadro, que param em
  // cima de um keyframe do mesmo jeito.
  const playheadIndex = keyframeIndexAtTimeMs(active, currentMs)
  const groups = active ? keyframeGroups(active) : []
  const exporting = exportPhase === 'running'

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
      `${slugifySceneName(active.name)}.json`,
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

  const handleConfirmImport = (mode: AnimationImportMode, assignment: readonly string[] | null) => {
    setPendingImport(null)
    if (!pendingImport) return
    if (!importAnimation(pendingImport, { mode, assignment })) {
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
      </div>


      {/* Trechos prontos (DECISOES.md #60): sequências predefinidas de
          keyframes que entram no FINAL da linha do tempo, ancoradas no boneco
          do papel A. Nas cenas em dupla, os combos escolhem quem faz o quê. */}
      <fieldset className="animation-panel__clips">
        <legend>{t('panels.animation.clips')}</legend>

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
            congela a câmera viva, como os de fábrica. */}
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

            return (
              <Fragment key={keyframe.id}>
                {startsGroup && group && (
                  <li className="animation-panel__group">
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
                    à vista (mover, duplicar) ou não perdem nada (Ir para). */}
                {confirmingUpdateId === keyframe.id ? (
                  <>
                    <p className="animation-panel__hint animation-panel__hint--warning">
                      {t('panels.animation.updateConfirmHint')}
                    </p>
                    <div className="animation-panel__keyframe-row">
                      <button
                        type="button"
                        className="animation-panel__confirm"
                        onClick={() => {
                          requestUpdateKeyframe(keyframe.id)
                          setConfirmingUpdateId(null)
                        }}
                      >
                        {t('panels.animation.updateConfirm')}
                      </button>
                      <button type="button" onClick={() => setConfirmingUpdateId(null)}>
                        {t('panels.animation.updateCancel')}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="animation-panel__keyframe-row">
                    <button
                      type="button"
                      onClick={() => requestGoToKeyframe(keyframe.id, startTimes[index])}
                      title={t('panels.animation.goTo')}
                    >
                      {t('panels.animation.goTo')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingUpdateId(keyframe.id)}
                      disabled={!canCapture}
                      title={t('panels.animation.update')}
                    >
                      {t('panels.animation.update')}
                    </button>
                  </div>
                )}

                {/* Copiar a câmera do vizinho: é o gesto de segurar o
                    enquadramento num trecho e deixar só os bonecos se moverem.
                    A pose deste keyframe não é tocada. */}
                <div className="animation-panel__keyframe-row">
                  <button
                    type="button"
                    onClick={() => copyAnimationKeyframeCamera(active.id, keyframe.id, -1)}
                    disabled={index === 0 || exporting}
                    aria-label={t('panels.animation.copyCameraPrevHint')}
                    title={t('panels.animation.copyCameraPrevHint')}
                  >
                    {t('panels.animation.copyCameraPrev')}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyAnimationKeyframeCamera(active.id, keyframe.id, 1)}
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
                    onClick={() => copyAnimationKeyframeFigures(active.id, keyframe.id, -1)}
                    disabled={index === 0 || exporting}
                    aria-label={t('panels.animation.copyPosePrevHint')}
                    title={t('panels.animation.copyPosePrevHint')}
                  >
                    {t('panels.animation.copyPosePrev')}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyAnimationKeyframeFigures(active.id, keyframe.id, 1)}
                    disabled={index === active.keyframes.length - 1 || exporting}
                    aria-label={t('panels.animation.copyPoseNextHint')}
                    title={t('panels.animation.copyPoseNextHint')}
                  >
                    {t('panels.animation.copyPoseNext')}
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
                    onClick={() => duplicateAnimationKeyframe(active.id, keyframe.id)}
                    disabled={exporting}
                    aria-label={t('panels.animation.duplicateKeyframe')}
                    title={t('panels.animation.duplicateKeyframeHint')}
                  >
                    {t('panels.animation.duplicate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAnimationKeyframe(active.id, keyframe.id)}
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

      {/* A linha do tempo, o transporte e o "pular keyframe" ficam na barra do
          RODAPÉ (`TimelineBar.tsx`, item 29): aqui fica o que é edição, lá o
          que é navegação. */}
      <p className="animation-panel__hint">
        {t('panels.animation.timelineMoved', {
          time: formatSeconds(currentMs),
          total: formatSeconds(totalMs),
        })}
      </p>

      {/* Vale para a reprodução na tela E para o vídeo — o que se vê tocando é
          o que sai no arquivo. Não mexe na linha do tempo: os keyframes
          continuam nos mesmos instantes. */}
      <SpeedField
        label={t('panels.animation.speed')}
        speed={speed}
        disabled={!active || exporting}
        onCommit={(value) => active && setAnimationSpeed(active.id, value)}
      />
      <p className="animation-panel__hint">
        {t('panels.animation.speedHint', { duration: formatSeconds(outputMs) })}
      </p>

      {/* "Inserir keyframe aqui" saiu daqui para a barra da linha do tempo
          (pedido do usuário): ele corta o trecho NO INSTANTE do playhead, e o
          playhead mora lá. Ver `TimelineBar.tsx`. */}

      {/* Item 27: sem o keyframe 1 repetido no fim, nenhum ciclo emenda — a
          última transição não volta ao ponto de partida. */}
      <button
        type="button"
        className="animation-panel__insert"
        onClick={() => active && closeAnimationCycle(active.id)}
        disabled={!active || active.keyframes.length < 2 || exporting}
        title={t('panels.animation.closeCycleHint')}
      >
        {t('panels.animation.closeCycle')}
      </button>

      {/* Item 30: um retrato pequeno por keyframe, gerado sob demanda e
          guardado só em memória. */}
      <button
        type="button"
        className="animation-panel__insert"
        onClick={requestThumbnails}
        disabled={!active || active.keyframes.length === 0 || exporting}
        title={t('panels.animation.thumbnailsHint')}
      >
        {t('panels.animation.thumbnails')}
      </button>

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

      <button type="button" className="animation-panel__export" onClick={requestExport} disabled={!canExport}>
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

      {/* Biblioteca de animações (item 36): cópias nomeadas da de trabalho,
          guardadas no mesmo autosave e no mesmo `animations.json`. Abrir uma
          delas SUBSTITUI a de trabalho, como carregar um snapshot de cena. */}
      <fieldset className="animation-panel__library">
        <legend>{t('panels.animation.library')}</legend>

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
          <button type="button" onClick={handleClearWorking} disabled={!active}>
            {t('panels.animation.clearWorking')}
          </button>
        </div>

        {/* Arquivo avulso da animação de trabalho (fase 12): exportar leva a
            linha do tempo inteira num JSON; importar traz um de volta, e o
            diálogo pergunta se ele substitui a bancada ou emenda no fim dela.
            A biblioteca não entra nessa história. */}
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
            </div>

            <p className="animation-panel__hint">{t('panels.animation.openHint')}</p>
          </>
        )}
      </fieldset>

      {pendingImport && (
        <AnimationImportDialog
          imported={pendingImport}
          sceneFigures={figures}
          hasWorkingKeyframes={active !== null && active.keyframes.length > 0}
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </CollapsiblePanel>
  )
}
