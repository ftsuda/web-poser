import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { POSE_MARK_SEQUENCE, type PoseMarkKey } from '../pose-import/markedPose'
import { POSE_MARK_LABEL_KEYS } from '../layout/poseMarkLabels'
import { useReferenceImageStore } from '../store/referenceImageStore'
import { panPhotoView, transformedPhotoRect, zoomPhotoViewAround } from './referencePhotoView'
import { fpsFromFrameDeltas, referenceVideoElement } from './referenceVideo'

/**
 * A referência POR CIMA do viewport (item 7 + PLANO.md > "Pose por marcação
 * manual" e "Vídeo como referência"), nas duas cascas — papel vegetal:
 * semitransparente, com opacidade regulável, e NUNCA nas capturas (é DOM,
 * como o `FrameMaskOverlay`; o PNG e o MP4 nascem do canvas e não a veem).
 * FOTO e VÍDEO são o mesmo papel vegetal: a `<video>` ocupa o mesmo retângulo
 * transformado, e a marcação opera sobre o frame parado como sobre uma foto —
 * o elemento fica registrado em `referenceVideoElement` para os controles do
 * painel comandarem play/seek sem acoplamento de árvore.
 *
 * Fora dos modos a camada é `pointer-events: none` — órbita e seleção passam
 * direto. No modo de MARCAÇÃO e no modo AJUSTAR FOTO ela ENGOLE os toques: é
 * o que congela a câmera e o boneco sem mexer em nenhum controle — o
 * alinhamento root↔foto feito antes fica protegido.
 *
 * A foto tem zoom e deslocamento próprios (`referencePhotoView`): no modo de
 * ajuste, arrastar move e pinça/roda ampliam; no modo de marcação os MESMOS
 * gestos de dois dedos/roda valem (precisão no touch), e por isso a marca só
 * se confirma na SOLTURA de um toque parado — descer o dedo pode ser o começo
 * de uma pinça.
 *
 * As marcas são guardadas em coordenadas normalizadas DA FOTO (não do
 * contêiner): janela, zoom e deslocamento mudam a foto na tela, e as marcas
 * vão junto, sempre no mesmo pixel da imagem.
 */

/** Deslocamento (px) a partir do qual um dedo descido deixa de ser um toque. */
const TAP_SLOP_PX = 8
/** Sensibilidade da roda: fator de zoom por unidade de `deltaY`. */
const WHEEL_ZOOM_RATE = 0.002

/** Índice 1-based do ponto na sequência guiada — é o número escrito no marcador. */
function markNumber(key: PoseMarkKey): number {
  return POSE_MARK_SEQUENCE.findIndex((step) => step.key === key) + 1
}

function markSideClass(key: PoseMarkKey): string {
  if (key.endsWith('.L')) return 'reference-photo__mark--left'
  if (key.endsWith('.R')) return 'reference-photo__mark--right'
  return 'reference-photo__mark--center'
}

/** A vista corrente lida DIRETO do store — gestos não podem usar closure velha. */
function currentView() {
  const state = useReferenceImageStore.getState()
  return { zoom: state.photoZoom, offsetX: state.photoOffsetX, offsetY: state.photoOffsetY }
}

export function ReferencePhotoOverlay() {
  const { t } = useTranslation()
  const imageUrl = useReferenceImageStore((state) => state.imageUrl)
  const kind = useReferenceImageStore((state) => state.kind)
  const aspect = useReferenceImageStore((state) => state.aspect)
  const opacity = useReferenceImageStore((state) => state.opacity)
  const imageVisible = useReferenceImageStore((state) => state.imageVisible)
  const marking = useReferenceImageStore((state) => state.marking)
  const adjusting = useReferenceImageStore((state) => state.adjusting)
  const photoZoom = useReferenceImageStore((state) => state.photoZoom)
  const photoOffsetX = useReferenceImageStore((state) => state.photoOffsetX)
  const photoOffsetY = useReferenceImageStore((state) => state.photoOffsetY)
  const marks = useReferenceImageStore((state) => state.marks)
  const selectedMarkKey = useReferenceImageStore((state) => state.selectedMarkKey)
  const setAspect = useReferenceImageStore((state) => state.setAspect)
  const placeMark = useReferenceImageStore((state) => state.placeMark)
  const moveMark = useReferenceImageStore((state) => state.moveMark)
  const selectMark = useReferenceImageStore((state) => state.selectMark)
  const setPhotoView = useReferenceImageStore((state) => state.setPhotoView)
  const syncVideoPlayback = useReferenceImageStore((state) => state.syncVideoPlayback)

  const containerRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)
  const draggingKey = useRef<PoseMarkKey | null>(null)
  /** Dedos/ponteiros descidos sobre a CAMADA (marcas capturam os seus próprios). */
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  /** Candidato a toque: primeiro dedo do modo de marcação, ainda parado. */
  const pendingTap = useRef<{ id: number; x: number; y: number } | null>(null)

  // Mede o contêiner para posicionar os marcadores sobre a foto "contain".
  // `ResizeObserver` quando houver (navegador); uma medida única no jsdom.
  useEffect(() => {
    const element = containerRef.current
    if (!element || !imageUrl) return
    const measure = () => {
      const rect = element.getBoundingClientRect()
      setBox({ width: rect.width, height: rect.height })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [imageUrl])

  // Roda do mouse = zoom em torno do ponteiro, nos DOIS modos. Ouvinte nativo
  // com `passive: false`: é preciso `preventDefault` para a página não rolar.
  useEffect(() => {
    const element = containerRef.current
    if (!element || !imageUrl || (!marking && !adjusting)) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const state = useReferenceImageStore.getState()
      const bounds = element.getBoundingClientRect()
      const container = { width: bounds.width, height: bounds.height }
      const view = currentView()
      const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      state.setPhotoView(
        zoomPhotoViewAround(
          view,
          container,
          state.aspect,
          anchor,
          view.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE),
        ),
      )
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [imageUrl, marking, adjusting])

  // Medição OPORTUNISTA do fps (`requestVideoFrameCallback`, onde existir):
  // intervalos de `mediaTime` entre frames apresentados durante a reprodução.
  // A mediana com encaixe é do `fpsFromFrameDeltas`; a escolha manual do
  // usuário nunca é sobrescrita (`measureVideoFps` respeita).
  useEffect(() => {
    if (kind !== 'video' || !imageUrl) return
    const video = referenceVideoElement.current as
      | (HTMLVideoElement & {
          requestVideoFrameCallback?: (
            callback: (now: number, metadata: { mediaTime: number }) => void,
          ) => number
          cancelVideoFrameCallback?: (handle: number) => void
        })
      | null
    if (!video?.requestVideoFrameCallback) return
    let handle = 0
    let lastMediaTime: number | null = null
    const deltas: number[] = []
    const onFrame = (_now: number, metadata: { mediaTime: number }) => {
      if (lastMediaTime !== null) deltas.push(metadata.mediaTime - lastMediaTime)
      lastMediaTime = metadata.mediaTime
      const fps = deltas.length >= 12 ? fpsFromFrameDeltas(deltas) : null
      if (fps) {
        useReferenceImageStore.getState().measureVideoFps(fps)
        return
      }
      if (deltas.length > 120) return // só seeks/pausas — desiste da medição
      handle = video.requestVideoFrameCallback!(onFrame)
    }
    handle = video.requestVideoFrameCallback(onFrame)
    return () => video.cancelVideoFrameCallback?.(handle)
  }, [kind, imageUrl])

  if (!imageUrl) return null

  /** O espelho da reprodução no store — é o que os controles do painel leem. */
  const syncFromVideo = (video: HTMLVideoElement) => {
    syncVideoPlayback({
      time: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      playing: !video.paused && !video.ended,
    })
  }

  const rect = box
    ? transformedPhotoRect(box, aspect, { zoom: photoZoom, offsetX: photoOffsetX, offsetY: photoOffsetY })
    : null

  /** Coordenadas do evento, normalizadas à FOTO (já com zoom/deslocamento); `null` fora dela. */
  const photoPoint = (event: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const element = containerRef.current
    if (!element || !rect || rect.width <= 0 || rect.height <= 0) return null
    const bounds = element.getBoundingClientRect()
    const x = (event.clientX - bounds.left - rect.left) / rect.width
    const y = (event.clientY - bounds.top - rect.top) / rect.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return null
    return { x, y }
  }

  const handleLayerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!marking && !adjusting) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture?.(event.pointerId)
    if (pointers.current.size === 2) {
      // Virou pinça: o primeiro dedo deixou de ser um toque de marcação.
      pendingTap.current = null
    } else if (pointers.current.size === 1 && marking) {
      pendingTap.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    }
  }

  const handleLayerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(event.pointerId)
    if (!prev) return
    const current = { x: event.clientX, y: event.clientY }
    const element = containerRef.current
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId)

    if (others.length === 1 && element && box) {
      // Pinça: zoom pela razão das distâncias (em torno do ponto médio) e
      // deslocamento pelo movimento do ponto médio — incremental a cada evento.
      const [, other] = others[0]
      pointers.current.set(event.pointerId, current)
      const prevDist = Math.hypot(prev.x - other.x, prev.y - other.y)
      const dist = Math.hypot(current.x - other.x, current.y - other.y)
      if (prevDist <= 0 || dist <= 0) return
      const bounds = element.getBoundingClientRect()
      const prevMid = { x: (prev.x + other.x) / 2 - bounds.left, y: (prev.y + other.y) / 2 - bounds.top }
      const mid = { x: (current.x + other.x) / 2 - bounds.left, y: (current.y + other.y) / 2 - bounds.top }
      const state = useReferenceImageStore.getState()
      let view = currentView()
      view = zoomPhotoViewAround(view, box, state.aspect, prevMid, (view.zoom * dist) / prevDist)
      view = panPhotoView(view, box, state.aspect, mid.x - prevMid.x, mid.y - prevMid.y)
      setPhotoView(view)
      return
    }

    pointers.current.set(event.pointerId, current)
    if (adjusting && pointers.current.size === 1 && box) {
      const state = useReferenceImageStore.getState()
      setPhotoView(panPhotoView(currentView(), box, state.aspect, current.x - prev.x, current.y - prev.y))
    }
    if (pendingTap.current?.id === event.pointerId) {
      const moved = Math.hypot(current.x - pendingTap.current.x, current.y - pendingTap.current.y)
      if (moved > TAP_SLOP_PX) pendingTap.current = null
    }
  }

  const handleLayerPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    const tap = pendingTap.current
    if (tap?.id !== event.pointerId) return
    pendingTap.current = null
    if (!marking) return
    const point = photoPoint(event)
    if (point) placeMark(point.x, point.y)
  }

  const handleLayerPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    if (pendingTap.current?.id === event.pointerId) pendingTap.current = null
  }

  const handleMarkPointerDown = (key: PoseMarkKey) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!marking) return
    event.stopPropagation()
    selectMark(key)
    draggingKey.current = key
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleMarkPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const key = draggingKey.current
    if (!key) return
    const point = photoPoint(event)
    if (!point) return
    moveMark(key, point.x, point.y)
  }

  const handleMarkPointerUp = () => {
    draggingKey.current = null
  }

  return (
    <div
      ref={containerRef}
      className={[
        'reference-photo',
        marking ? 'reference-photo--marking' : '',
        adjusting ? 'reference-photo--adjusting' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid="reference-photo"
      onPointerDown={handleLayerPointerDown}
      onPointerMove={handleLayerPointerMove}
      onPointerUp={handleLayerPointerUp}
      onPointerCancel={handleLayerPointerCancel}
    >
      {kind === 'video' ? (
        <video
          className="reference-photo__img"
          data-testid="reference-video"
          ref={(element) => {
            referenceVideoElement.current = element
          }}
          src={imageUrl}
          muted
          playsInline
          preload="auto"
          style={{
            opacity: imageVisible ? opacity : 0,
            ...(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : {}),
          }}
          onLoadedMetadata={(event) => {
            const video = event.currentTarget
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              setAspect(video.videoWidth / video.videoHeight)
            }
            syncFromVideo(video)
          }}
          onTimeUpdate={(event) => syncFromVideo(event.currentTarget)}
          onDurationChange={(event) => syncFromVideo(event.currentTarget)}
          onSeeked={(event) => syncFromVideo(event.currentTarget)}
          onPlay={(event) => syncFromVideo(event.currentTarget)}
          onPause={(event) => syncFromVideo(event.currentTarget)}
          onEnded={(event) => syncFromVideo(event.currentTarget)}
        />
      ) : (
        <img
          className="reference-photo__img"
          src={imageUrl}
          alt=""
          draggable={false}
          style={{
            opacity: imageVisible ? opacity : 0,
            // Com a medida em mãos, a mídia é posicionada pela vista (zoom +
            // deslocamento); antes dela, o "contain" do CSS segura o primeiro quadro.
            ...(rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : {}),
          }}
          onLoad={(event) => {
            const image = event.currentTarget
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
              setAspect(image.naturalWidth / image.naturalHeight)
            }
          }}
        />
      )}

      {marking &&
        rect &&
        (Object.keys(marks) as PoseMarkKey[]).map((key) => {
          const mark = marks[key]!
          return (
            <button
              key={key}
              type="button"
              className={[
                'reference-photo__mark',
                markSideClass(key),
                key === selectedMarkKey ? 'reference-photo__mark--selected' : '',
                mark.depth === 'front' ? 'reference-photo__mark--front' : '',
                mark.depth === 'back' ? 'reference-photo__mark--back' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: rect.left + mark.x * rect.width, top: rect.top + mark.y * rect.height }}
              title={t(POSE_MARK_LABEL_KEYS[key])}
              aria-label={t(POSE_MARK_LABEL_KEYS[key])}
              onPointerDown={handleMarkPointerDown(key)}
              onPointerMove={handleMarkPointerMove}
              onPointerUp={handleMarkPointerUp}
            >
              {markNumber(key)}
            </button>
          )
        })}
    </div>
  )
}
