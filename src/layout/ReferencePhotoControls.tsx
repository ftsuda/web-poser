import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  POSE_MARK_SEQUENCE,
  inferPoseFromMarks,
  inferRootRotationFromMarks,
  poseMarkDepthKind,
  poseMarkSupportsDepth,
  type MarkedView,
} from '../pose-import/markedPose'
import { pickFile } from '../persistence/fileIO'
import { activeViewBasis } from '../scene/viewportViewBasis'
import { FPS_CHOICES, referenceVideoElement, stepFrameTime } from '../scene/referenceVideo'
import { useFiguresStore, type Figure } from '../store/figuresStore'
import { nextMarkStep, useReferenceImageStore } from '../store/referenceImageStore'
import { POSE_MARK_LABEL_KEYS } from './poseMarkLabels'

/**
 * Os controles da foto de referência + marcação de pose (item 7 e PLANO.md >
 * "Pose por marcação manual") — UM componente, usado pela seção do painel de
 * Propriedades (desktop) e pela aba Foto do módulo de poses. O overlay que
 * desenha a foto e recebe os toques é o `ReferencePhotoOverlay`, sobre o
 * viewport de cada casca; aqui é o fluxo: carregar, alinhar, marcar, inferir.
 *
 * O fluxo combinado com o usuário: (1) carregar a foto; (2) alinhar o ROOT do
 * boneco sobre ela com as ferramentas de sempre — a inferência nunca toca a
 * colocação; (3) marcar os pontos na ordem guiada; (4) inferir no boneco
 * selecionado, com juntas travadas respeitadas (#42) e avisos na tela.
 */
/** Boneco + base de tela, ou a chave do que faltou — o `error` é o discriminante. */
type MarkedTarget =
  | { figure: Figure; view: MarkedView; error: null }
  | { figure: null; view: null; error: string }

export function ReferencePhotoControls() {
  const { t } = useTranslation()
  const imageUrl = useReferenceImageStore((state) => state.imageUrl)
  const imageName = useReferenceImageStore((state) => state.imageName)
  const kind = useReferenceImageStore((state) => state.kind)
  const videoFps = useReferenceImageStore((state) => state.videoFps)
  const videoTime = useReferenceImageStore((state) => state.videoTime)
  const videoDuration = useReferenceImageStore((state) => state.videoDuration)
  const videoPlaying = useReferenceImageStore((state) => state.videoPlaying)
  const aspect = useReferenceImageStore((state) => state.aspect)
  const opacity = useReferenceImageStore((state) => state.opacity)
  const imageVisible = useReferenceImageStore((state) => state.imageVisible)
  const marking = useReferenceImageStore((state) => state.marking)
  const adjusting = useReferenceImageStore((state) => state.adjusting)
  const photoZoom = useReferenceImageStore((state) => state.photoZoom)
  const photoOffsetX = useReferenceImageStore((state) => state.photoOffsetX)
  const photoOffsetY = useReferenceImageStore((state) => state.photoOffsetY)
  const marks = useReferenceImageStore((state) => state.marks)
  const skippedKeys = useReferenceImageStore((state) => state.skippedKeys)
  const selectedMarkKey = useReferenceImageStore((state) => state.selectedMarkKey)
  const setImage = useReferenceImageStore((state) => state.setImage)
  const clearImage = useReferenceImageStore((state) => state.clearImage)
  const setOpacity = useReferenceImageStore((state) => state.setOpacity)
  const toggleImageVisible = useReferenceImageStore((state) => state.toggleImageVisible)
  const setVideoFps = useReferenceImageStore((state) => state.setVideoFps)
  const setPhotoZoom = useReferenceImageStore((state) => state.setPhotoZoom)
  const resetPhotoView = useReferenceImageStore((state) => state.resetPhotoView)
  const startAdjusting = useReferenceImageStore((state) => state.startAdjusting)
  const stopAdjusting = useReferenceImageStore((state) => state.stopAdjusting)
  const startMarking = useReferenceImageStore((state) => state.startMarking)
  const stopMarking = useReferenceImageStore((state) => state.stopMarking)
  const moveMarkCursor = useReferenceImageStore((state) => state.moveMarkCursor)
  const skipMarkAtCursor = useReferenceImageStore((state) => state.skipMarkAtCursor)
  const setMarkDepth = useReferenceImageStore((state) => state.setMarkDepth)
  const clearMarks = useReferenceImageStore((state) => state.clearMarks)

  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const applyInferredPose = useFiguresStore((state) => state.applyInferredPose)
  const setRootRotation = useFiguresStore((state) => state.setRootRotation)

  /** O resultado do último "Inferir": chaves de i18n, para a lista de avisos. */
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; keys: string[] } | null>(null)

  const handleLoad = async () => {
    const picked = await pickFile('image/*,video/*')
    if (!picked) return
    // O `File` original vira um object URL — arquivo LOCAL, nunca rede, nunca
    // persistido (só sessão, decisão do usuário; o store revoga o anterior).
    // Foto e vídeo entram pelo MESMO botão: o MIME decide o tipo.
    const blob = new Blob([picked.data], { type: picked.file.type })
    const pickedKind = picked.file.type.startsWith('video/') ? 'video' : 'image'
    setImage(URL.createObjectURL(blob), picked.file.name, pickedKind)
    setFeedback(null)
  }

  /** Anda um frame (1/fps) com o vídeo PAUSADO — quem espelha o tempo é o overlay. */
  const stepFrame = (direction: 1 | -1) => {
    const video = referenceVideoElement.current
    if (!video) return
    video.pause()
    video.currentTime = stepFrameTime(video.currentTime, video.duration, videoFps, direction)
  }

  const togglePlay = () => {
    const video = referenceVideoElement.current
    if (!video) return
    if (video.paused) void video.play()
    else video.pause()
  }

  const scrubTo = (timeS: number) => {
    const video = referenceVideoElement.current
    if (!video || !Number.isFinite(timeS)) return
    video.currentTime = timeS
  }

  /** O boneco e a base de tela — o que a inferência e a conferência da raiz precisam. */
  const markedTarget = (): MarkedTarget => {
    const figure = figures.find((candidate) => candidate.id === selectedFigureId)
    if (!figure) return { figure: null, view: null, error: 'poses.photo.inferNeedsFigure' }
    const view = activeViewBasis()
    if (!view) return { figure: null, view: null, error: 'poses.photo.inferNoView' }
    return { figure, view, error: null }
  }

  /**
   * A conferência da raiz (#119): a linha dos quadris marcada contra a pelve do
   * boneco. Ato EXPLÍCITO, num botão só dele — a colocação é do usuário (#111)
   * e o "Inferir" continua sem tocá-la; aqui vale um passo de undo próprio.
   */
  const handleAlignRoot = () => {
    const target = markedTarget()
    if (target.error !== null) {
      setFeedback({ kind: 'error', keys: [target.error] })
      return
    }
    const result = inferRootRotationFromMarks(target.figure, marks, target.view, aspect)
    if (!result) {
      setFeedback({ kind: 'error', keys: ['poses.photo.rootNeedsHips'] })
      return
    }
    setRootRotation(target.figure.id, result.rotation)
    setFeedback({
      kind: 'ok',
      keys: [result.usedDepth ? 'poses.photo.rootAligned' : 'poses.photo.rootAlignedFlat'],
    })
  }

  const handleInfer = () => {
    const target = markedTarget()
    if (target.error !== null) {
      setFeedback({ kind: 'error', keys: [target.error] })
      return
    }
    const { figure, view } = target
    const result = inferPoseFromMarks(figure, marks, view, aspect)
    if (!result) {
      setFeedback({ kind: 'error', keys: ['poses.photo.inferMissing'] })
      return
    }
    applyInferredPose(figure.id, result.pose)
    setFeedback({ kind: 'ok', keys: ['poses.photo.applied', ...result.warnings] })
  }

  if (!imageUrl) {
    return (
      <div className="photo-ref">
        <p className="photo-ref__hint">{t('poses.photo.emptyHint')}</p>
        <button type="button" className="panel-action" onClick={() => void handleLoad()}>
          {t('poses.photo.load')}
        </button>
      </div>
    )
  }

  const next = nextMarkStep({ marks, skippedKeys })
  const placed = Object.keys(marks).length
  // O CURSOR da marcação (#115.1): a junta corrente — a que o toque marca, a
  // que o painel nomeia e a dona da profundidade mostrada. Sem cursor no store
  // (marcação forçada de fora), vale o primeiro ponto pendente.
  const cursorKey = selectedMarkKey ?? next?.key ?? POSE_MARK_SEQUENCE[0].key
  const cursorIndex = POSE_MARK_SEQUENCE.findIndex((step) => step.key === cursorKey)
  const cursorStep = POSE_MARK_SEQUENCE[cursorIndex]
  const cursorMark = marks[cursorKey]

  return (
    <div className="photo-ref">
      <p className="photo-ref__name" title={imageName ?? undefined}>
        {imageName}
      </p>

      <div className="panel-actions">
        <button type="button" onClick={() => void handleLoad()}>
          {t('poses.photo.load')}
        </button>
        <button type="button" onClick={() => { clearImage(); setFeedback(null) }}>
          {t('poses.photo.clear')}
        </button>
      </div>

      <label className="photo-ref__row">
        {t('poses.photo.opacity')}
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(event) => setOpacity(Number(event.target.value))}
        />
      </label>
      <label className="photo-ref__row photo-ref__row--check">
        <input type="checkbox" checked={imageVisible} onChange={toggleImageVisible} />
        {t('poses.photo.visible')}
      </label>

      {/* A vista da foto (zoom/deslocamento) vale nos dois modos: o slider é
          o ajuste fino; os gestos (arrasto/pinça/roda) moram no overlay. */}
      <label className="photo-ref__row">
        {t('poses.photo.zoom', { percent: Math.round(photoZoom * 100) })}
        <input
          type="range"
          min={-2}
          max={3}
          step={0.1}
          value={Math.log2(photoZoom)}
          onChange={(event) => setPhotoZoom(2 ** Number(event.target.value))}
        />
      </label>
      <div className="panel-actions">
        <button
          type="button"
          aria-pressed={adjusting}
          onClick={adjusting ? stopAdjusting : startAdjusting}
        >
          {t(adjusting ? 'poses.photo.adjustStop' : 'poses.photo.adjust')}
        </button>
        <button
          type="button"
          disabled={photoZoom === 1 && photoOffsetX === 0 && photoOffsetY === 0}
          onClick={resetPhotoView}
        >
          {t('poses.photo.resetView')}
        </button>
      </div>
      {adjusting && <p className="photo-ref__hint">{t('poses.photo.adjustHint')}</p>}

      {kind === 'video' && (
        <>
          {/* Frame a frame vale TAMBÉM durante a marcação: é o fluxo de
              animação — marcar, inferir, gravar keyframe, avançar, ajustar. */}
          <div className="photo-ref__frames">
            <button type="button" onClick={() => stepFrame(-1)} aria-label={t('poses.photo.videoPrevFrame')}>
              ◀ {t('poses.photo.videoFrame')}
            </button>
            <button type="button" onClick={togglePlay}>
              {t(videoPlaying ? 'poses.photo.videoPause' : 'poses.photo.videoPlay')}
            </button>
            <button type="button" onClick={() => stepFrame(1)} aria-label={t('poses.photo.videoNextFrame')}>
              {t('poses.photo.videoFrame')} ▶
            </button>
          </div>
          {/* Empilhada: o rótulo traz tempo E duração, e na mesma linha sobrava
              um toco de barra — a linha do tempo é a que mais se arrasta. */}
          <label className="photo-ref__row photo-ref__row--stack">
            {t('poses.photo.videoTimeline', {
              time: videoTime.toFixed(2),
              duration: videoDuration.toFixed(2),
            })}
            <input
              type="range"
              min={0}
              max={videoDuration > 0 ? videoDuration : 1}
              step={0.01}
              value={Math.min(videoTime, videoDuration)}
              disabled={videoDuration <= 0}
              onChange={(event) => scrubTo(Number(event.target.value))}
            />
          </label>
          <label className="photo-ref__row">
            {t('poses.photo.videoFps')}
            <select value={String(videoFps)} onChange={(event) => setVideoFps(Number(event.target.value))}>
              {(FPS_CHOICES.includes(videoFps) ? FPS_CHOICES : [...FPS_CHOICES, videoFps]).map((fps) => (
                <option key={fps} value={String(fps)}>
                  {fps}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {!marking ? (
        <>
          {/* O passo 2 do fluxo é MANUAL de propósito: alinhar o root sobre a
              foto com mover/girar de sempre — daí a dica antes do botão. */}
          <p className="photo-ref__hint">{t('poses.photo.alignHint')}</p>
          <button type="button" className="panel-action" onClick={startMarking}>
            {t('poses.photo.startMarking')}
          </button>
        </>
      ) : (
        <>
          {/* Uma junta de cada vez: o cursor só anda a pedido, então o nome
              aqui, o ponto que o toque marca e a profundidade lá embaixo são
              sempre a MESMA junta (#115.1). */}
          <p className="photo-ref__progress" role="status">
            {t('poses.photo.markCursor', {
              index: cursorIndex + 1,
              total: POSE_MARK_SEQUENCE.length,
              label: t(POSE_MARK_LABEL_KEYS[cursorKey]),
            })}
          </p>
          <p className="photo-ref__hint">
            {t(cursorMark ? 'poses.photo.markPlaced' : 'poses.photo.markPending')}
          </p>

          <div className="panel-actions">
            <button
              type="button"
              disabled={cursorIndex <= 0}
              aria-label={t('poses.photo.markPrevJoint')}
              onClick={() => moveMarkCursor(-1)}
            >
              ◀ {t('poses.photo.markPrev')}
            </button>
            <button
              type="button"
              disabled={cursorIndex >= POSE_MARK_SEQUENCE.length - 1}
              aria-label={t('poses.photo.markNextJoint')}
              onClick={() => moveMarkCursor(1)}
            >
              {t('poses.photo.markNext')} ▶
            </button>
          </div>

          {cursorMark && poseMarkSupportsDepth(cursorKey) && (
            <fieldset className="photo-ref__depth">
              <legend>
                {t('poses.photo.depth', { label: t(POSE_MARK_LABEL_KEYS[cursorKey]) })}
              </legend>
              <div className="panel-actions" role="group">
                {([
                  ['plane', null],
                  ['front', 'front'],
                  ['back', 'back'],
                ] as const).map(([option, value]) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={(cursorMark.depth ?? 'plane') === (value ?? 'plane')}
                    onClick={() => setMarkDepth(cursorKey, value)}
                  >
                    {t(`poses.photo.depth${option === 'plane' ? 'Plane' : option === 'front' ? 'Front' : 'Back'}`)}
                  </button>
                ))}
              </div>
              {/* Ombros e quadris medem contra o OUTRO LADO: vale explicar que
                  o par se abre em profundidade, e não só o lado marcado (#115). */}
              {poseMarkDepthKind(cursorKey) === 'pair' && (
                <p className="photo-ref__hint">{t('poses.photo.depthPairHint')}</p>
              )}
            </fieldset>
          )}

          <div className="panel-actions">
            <button
              type="button"
              disabled={!cursorStep.optional || !!cursorMark}
              onClick={skipMarkAtCursor}
            >
              {t('poses.photo.skip')}
            </button>
            <button type="button" disabled={placed === 0} onClick={clearMarks}>
              {t('poses.photo.clearMarks')}
            </button>
          </div>

          {!next && <p className="photo-ref__hint">{t('poses.photo.allMarked')}</p>}

          {/* Antes de inferir: a raiz é a âncora de tudo, e a linha dos quadris
              é a medida da pelve que a foto sabe dar (#119). */}
          <button
            type="button"
            className="panel-action"
            disabled={!marks['hip.L'] || !marks['hip.R']}
            onClick={handleAlignRoot}
          >
            {t('poses.photo.alignRoot')}
          </button>
          <button type="button" className="panel-action" onClick={handleInfer}>
            {t('poses.photo.infer')}
          </button>
          <button type="button" className="panel-action" onClick={stopMarking}>
            {t('poses.photo.stopMarking')}
          </button>
        </>
      )}

      {feedback && (
        <ul
          className={`photo-ref__feedback photo-ref__feedback--${feedback.kind}`}
          role={feedback.kind === 'error' ? 'alert' : 'status'}
        >
          {feedback.keys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
