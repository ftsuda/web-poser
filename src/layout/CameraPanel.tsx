import { useMemo, useState, type ChangeEvent, type FocusEvent, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { withExportTimestamp } from '../persistence/exportTimestamp'
import { pickFile, writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { parseCameraBookmarksFile, serializeCameraBookmarksFile } from '../persistence/sceneFile'
import { AXIS_COLORS } from '../scene/axisColors'
import { ORTHO_PRESET_NAMES, type OrthoPresetName, type Vector3Tuple } from '../scene/cameraPresets'
import { figureAimPoint, figuresAimPoint, withSceneCameraAimedAt } from '../scene/cameraAim'
import {
  sceneCameraEulerDeg,
  withSceneCameraEulerDeg,
  withSceneCameraPosition,
} from '../scene/sceneCameraTransform'
import { MOVE_GENERATOR_KEYS, MOVE_TERMS, type MoveGeneratorKey } from '../scene/cameraMove'
import { LENS_FAMILY_TERMS, LENS_PRESETS, MAX_FOCAL_MM, MIN_FOCAL_MM, lensFamilyKey } from '../scene/lens'
import {
  ANGLE_KEYS,
  ANGLE_TERMS,
  CAMERA_HEIGHT_KEYS,
  CAMERA_HEIGHT_TERMS,
  DUTCH_ANGLE_TERM,
  LEAD_ROOM_TERM,
  MAX_ROLL_DEG,
  ORIENTATION_KEYS,
  ORIENTATION_TERMS,
  OVER_THE_SHOULDER_TERM,
  POV_TERM,
  REVERSE_ANGLE_TERM,
  RULE_OF_THIRDS_TERM,
  SHOT_KEYS,
  SHOT_TERMS,
  TWO_SHOT_TERM,
  canApplyShot,
  type AngleKey,
  type CameraHeightKey,
  type OrientationKey,
  type ShotKey,
} from '../scene/shotFraming'
import { useCameraStore } from '../store/cameraStore'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore, type GizmoMode } from '../store/uiStore'
import { importErrorKey } from './fileFeedback'
import { CollapsiblePanel } from './CollapsiblePanel'
import { CollapsibleSection } from './CollapsibleSection'

const PRESET_LABEL_KEYS: Record<OrthoPresetName, string> = {
  front: 'panels.camera.presetFront',
  back: 'panels.camera.presetBack',
  left: 'panels.camera.presetLeft',
  right: 'panels.camera.presetRight',
  top: 'panels.camera.presetTop',
  threeQuarter: 'panels.camera.presetThreeQuarter',
}

const SHOT_LABEL_KEYS: Record<ShotKey, string> = {
  extremeWide: 'panels.camera.shotExtremeWide',
  wide: 'panels.camera.shotWide',
  fullShot: 'panels.camera.shotFull',
  cowboy: 'panels.camera.shotCowboy',
  medium: 'panels.camera.shotMedium',
  mediumCloseUp: 'panels.camera.shotMediumCloseUp',
  closeUp: 'panels.camera.shotCloseUp',
  extremeCloseUp: 'panels.camera.shotExtremeCloseUp',
}

const ANGLE_LABEL_KEYS: Record<AngleKey, string> = {
  eyeLevel: 'panels.camera.angleEyeLevel',
  lowAngle: 'panels.camera.angleLow',
  highAngle: 'panels.camera.angleHigh',
  birdsEye: 'panels.camera.angleBirdsEye',
  wormsEye: 'panels.camera.angleWormsEye',
}

const HEIGHT_LABEL_KEYS: Record<CameraHeightKey, string> = {
  ground: 'panels.camera.heightGround',
  knee: 'panels.camera.heightKnee',
  hip: 'panels.camera.heightHip',
  shoulder: 'panels.camera.heightShoulder',
}

const ORIENTATION_LABEL_KEYS: Record<OrientationKey, string> = {
  front: 'panels.camera.orientationFront',
  threeQuarterFront: 'panels.camera.orientationThreeQuarterFront',
  profile: 'panels.camera.orientationProfile',
  threeQuarterBack: 'panels.camera.orientationThreeQuarterBack',
  back: 'panels.camera.orientationBack',
}

const MOVE_LABEL_KEYS: Record<MoveGeneratorKey, string> = {
  zoomIn: 'panels.camera.moveZoomIn',
  zoomOut: 'panels.camera.moveZoomOut',
  orbit: 'panels.camera.moveOrbit',
  truck: 'panels.camera.moveTruck',
  dollyZoom: 'panels.camera.moveDollyZoom',
  crane: 'panels.camera.moveCrane',
}

/**
 * Botão de vocabulário: o TERMO em inglês na linha de cima — é o texto que vai
 * para um prompt de geração de imagem, e por isso não muda com o idioma da
 * interface — e a tradução como legenda embaixo (pedido do usuário, ver
 * DECISOES.md #47).
 */
interface TermButtonProps {
  term: string
  caption: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
}

/**
 * Rótulo de uma opção de combo: o mesmo par termo/tradução do `TermButton`,
 * numa linha só — `<option>` não aceita duas linhas. O travessão separa o que
 * vai para o prompt do que explica (DECISOES.md #47 e #51).
 */
function optionLabel(term: string, caption: string): string {
  return `${term} — ${caption}`
}

/** As quatro combinações de composição, como uma escolha só. */
type CompositionChoice = 'centered' | 'thirds' | 'leadRoom' | 'both'

/** Vistas que substituem o enquadramento em vez de compor com ele. */
type ViewChoice = 'overTheShoulder' | 'pov' | 'twoShot' | 'reverseAngle'

type CameraAxis = 'x' | 'y' | 'z'

const CAMERA_AXES: readonly CameraAxis[] = ['x', 'y', 'z']

/**
 * Faixa dos sliders de rotação da câmera (fase 11.1). Y e Z dão a volta
 * completa, como a colocação do boneco; X (olhar para cima/baixo) para em
 * ±90° — além disso a câmera estaria de cabeça para baixo e o slider deixaria
 * de bater com o ângulo extraído (ver `sceneCameraTransform.ts`).
 */
const CAMERA_ROTATION_RANGE: Record<CameraAxis, { min: number; max: number }> = {
  x: { min: -90, max: 90 },
  y: { min: -180, max: 180 },
  z: { min: -180, max: 180 },
}

function TermButton({ term, caption, pressed, disabled, onClick }: TermButtonProps) {
  return (
    <button
      type="button"
      className="camera-panel__term-button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="camera-panel__term">{term}</span>
      <span className="camera-panel__caption">{caption}</span>
    </button>
  )
}

export function CameraPanel() {
  const { t } = useTranslation()
  const viewMode = useCameraStore((state) => state.viewMode)
  const toggleViewMode = useCameraStore((state) => state.toggleViewMode)
  const requestPlaceCameraAtView = useCameraStore((state) => state.requestPlaceCameraAtView)
  const cameraSelected = useCameraStore((state) => state.cameraSelected)
  const setCameraSelected = useCameraStore((state) => state.setCameraSelected)
  const gizmoMode = useUIStore((state) => state.gizmoMode)
  const setGizmoMode = useUIStore((state) => state.setGizmoMode)
  const fov = useCameraStore((state) => state.fov)
  const focalMm = useCameraStore((state) => state.focalMm)
  const projection = useCameraStore((state) => state.projection)
  const shot = useCameraStore((state) => state.shot)
  const angle = useCameraStore((state) => state.angle)
  const cameraHeight = useCameraStore((state) => state.cameraHeight)
  const orientation = useCameraStore((state) => state.orientation)
  const thirds = useCameraStore((state) => state.thirds)
  const leadRoom = useCameraStore((state) => state.leadRoom)
  const rollDeg = useCameraStore((state) => state.rollDeg)
  const moveA = useCameraStore((state) => state.moveA)
  const moveB = useCameraStore((state) => state.moveB)
  const moveT = useCameraStore((state) => state.moveT)
  const setFocalLength = useCameraStore((state) => state.setFocalLength)
  const applyFraming = useCameraStore((state) => state.applyFraming)
  const applyOverTheShoulder = useCameraStore((state) => state.applyOverTheShoulder)
  const applyPov = useCameraStore((state) => state.applyPov)
  const applyTwoShot = useCameraStore((state) => state.applyTwoShot)
  const applyReverseAngle = useCameraStore((state) => state.applyReverseAngle)
  const setRoll = useCameraStore((state) => state.setRoll)
  const requestCaptureMovePoint = useCameraStore((state) => state.requestCaptureMovePoint)
  const generateMove = useCameraStore((state) => state.generateMove)
  const setMoveT = useCameraStore((state) => state.setMoveT)
  const clearMove = useCameraStore((state) => state.clearMove)
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const applyPreset = useCameraStore((state) => state.applyPreset)
  const requestPerspective = useCameraStore((state) => state.requestPerspective)
  const applyBookmark = useCameraStore((state) => state.applyBookmark)
  const requestSaveBookmark = useCameraStore((state) => state.requestSaveBookmark)
  const sceneCamera = useFiguresStore((state) => state.sceneCamera)
  const setSceneCamera = useFiguresStore((state) => state.setSceneCamera)
  const selectFigure = useFiguresStore((state) => state.selectFigure)
  const cameraBookmarks = useFiguresStore((state) => state.cameraBookmarks)
  const removeCameraBookmark = useFiguresStore((state) => state.removeCameraBookmark)
  const importCameraBookmarks = useFiguresStore((state) => state.importCameraBookmarks)
  const appendCameraMoveKeyframes = useFiguresStore((state) => state.appendCameraMoveKeyframes)
  const figureCount = figures.length

  const roundedFocal = Math.round(focalMm)
  const [focalDraft, setFocalDraft] = useState(() => String(roundedFocal))
  const [lastSyncedFocal, setLastSyncedFocal] = useState(roundedFocal)
  if (roundedFocal !== lastSyncedFocal) {
    setLastSyncedFocal(roundedFocal)
    setFocalDraft(String(roundedFocal))
  }

  // Enquadrar precisa de algo para medir: com um boneco selecionado, ele; sem
  // seleção, o conjunto — mas só nos planos abertos (#48). Um botão habilitado
  // que não faz nada é pior que um desabilitado.
  const hasSelection = figures.some((figure) => figure.id === selectedFigureId)
  const canOverTheShoulder = hasSelection && figures.length >= 2
  const canPlayMove = moveA !== null && moveB !== null

  /**
   * Rascunho do enquadramento: os combos guardam a INTENÇÃO e só o botão
   * compromete (pedido do usuário, o mesmo mecanismo das poses — DECISOES.md
   * #36). Navegar pela lista com o teclado não pode sair mexendo na câmera.
   */
  const [shotDraft, setShotDraft] = useState<ShotKey>(shot ?? 'fullShot')
  const [vantageDraft, setVantageDraft] = useState(
    cameraHeight ? `height:${cameraHeight}` : `angle:${angle}`,
  )
  const [orientationDraft, setOrientationDraft] = useState<string>(orientation ?? '')
  const [compositionDraft, setCompositionDraft] = useState<CompositionChoice>(
    thirds && leadRoom ? 'both' : thirds ? 'thirds' : leadRoom ? 'leadRoom' : 'centered',
  )
  const [viewDraft, setViewDraft] = useState<ViewChoice>('overTheShoulder')

  const applyDraftFraming = () => {
    const [family, value] = vantageDraft.split(':')
    applyFraming({
      shot: shotDraft,
      angle: family === 'angle' ? (value as AngleKey) : angle,
      cameraHeight: family === 'height' ? (value as CameraHeightKey) : null,
      orientation: orientationDraft ? (orientationDraft as OrientationKey) : null,
      thirds: compositionDraft === 'thirds' || compositionDraft === 'both',
      leadRoom: compositionDraft === 'leadRoom' || compositionDraft === 'both',
    })
  }

  /** Cada vista tem a sua exigência, e a dica diz qual está faltando. */
  const viewBlockedKey =
    viewDraft === 'pov'
      ? 'panels.camera.viewNeedsSelection'
      : viewDraft === 'twoShot' && canOverTheShoulder
        ? 'panels.camera.viewNeedsShot'
        : 'panels.camera.viewNeedsPair'
  const canApplyView =
    viewDraft === 'reverseAngle'
      ? true
      : viewDraft === 'pov'
        ? hasSelection
        : viewDraft === 'twoShot'
          ? canOverTheShoulder && shot !== null
          : canOverTheShoulder

  const applyDraftView = () => {
    if (viewDraft === 'overTheShoulder') applyOverTheShoulder()
    else if (viewDraft === 'pov') applyPov()
    else if (viewDraft === 'twoShot') applyTwoShot()
    else applyReverseAngle()
  }

  /**
   * Controles numéricos da câmera de cena (fase 11.1) — o caminho de mão
   * dupla com o gizmo: os valores são LIDOS do estado (arrastar o gizmo os
   * atualiza ao vivo) e editá-los grava de volta pelo mesmo `setSceneCamera`.
   */
  const cameraEuler = useMemo(() => sceneCameraEulerDeg(sceneCamera), [sceneCamera])

  /**
   * Para onde cada botão de apontar mira (2026-08-06). `null` desabilita —
   * sem boneco selecionado, ou sem ninguém visível, não há para onde girar. As
   * contas reconstroem as juntas dos bonecos, então ficam em `useMemo`: a
   * seleção e a pose mudam muito menos que o resto do painel.
   */
  const selectedFigure = figures.find((figure) => figure.id === selectedFigureId) ?? null
  const aimFigurePoint = useMemo(
    () => (selectedFigure ? figureAimPoint(selectedFigure) : null),
    [selectedFigure],
  )
  const aimAllPoint = useMemo(() => figuresAimPoint(figures), [figures])

  /**
   * Gira a câmera de cena no lugar. Fica FORA do undo, como todo o resto da
   * câmera de cena (ver `undoPartialize`) — é enquadramento, não conteúdo.
   */
  const aimAt = (point: Vector3Tuple | null) => {
    if (point) setSceneCamera(withSceneCameraAimedAt(sceneCamera, point))
  }

  const handleCameraPositionChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isFinite(value)) return
    const position = [...sceneCamera.position] as [number, number, number]
    position[index] = value
    setSceneCamera(withSceneCameraPosition(sceneCamera, position))
  }

  const handleCameraRotationChange = (axis: CameraAxis) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isFinite(value)) return
    setSceneCamera(withSceneCameraEulerDeg(sceneCamera, { ...cameraEuler, [axis]: value }))
  }

  /**
   * Alternador do gizmo da câmera (mover/girar). Age no MESMO modo global dos
   * W/E — é o mesmo gizmo compartilhado com as juntas — e, apertado daqui,
   * também SELECIONA a câmera: o gesto é "quero mover/girar a câmera", e sem a
   * seleção o botão trocaria um gizmo que não está na tela.
   */
  const selectCameraGizmo = (mode: GizmoMode) => {
    setGizmoMode(mode)
    selectFigure(null)
    setCameraSelected(true)
  }

  const [isNamingBookmark, setIsNamingBookmark] = useState(false)
  const [bookmarkNameDraft, setBookmarkNameDraft] = useState('')
  /** Chave i18n do último erro de importação de bookmarks (fase 9, item 4). */
  const [errorKey, setErrorKey] = useState<string | null>(null)

  const handleFocalInput = (event: ChangeEvent<HTMLInputElement>) => {
    setFocalDraft(event.target.value)
  }

  const commitFocal = (event: FocusEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isNaN(value)) setFocalLength(value)
  }

  const startNamingBookmark = () => {
    setBookmarkNameDraft(t('panels.camera.defaultBookmarkName', { index: cameraBookmarks.length + 1 }))
    setIsNamingBookmark(true)
  }

  const cancelNamingBookmark = () => {
    setIsNamingBookmark(false)
    setBookmarkNameDraft('')
  }

  const confirmSaveBookmark = (event: FormEvent) => {
    event.preventDefault()
    const name = bookmarkNameDraft.trim()
    if (!name) return
    requestSaveBookmark(name)
    setIsNamingBookmark(false)
    setBookmarkNameDraft('')
  }

  const handleExportBookmarks = async () => {
    const json = serializeCameraBookmarksFile(cameraBookmarks)
    await writeFileToDirectoryOrDownload(
      null,
      withExportTimestamp('camera-bookmarks.json'),
      new Blob([json], { type: 'application/json' }),
    )
  }

  const handleImportBookmarks = async () => {
    const picked = await pickFile('.json')
    if (!picked) return
    try {
      const imported = parseCameraBookmarksFile(await picked.file.text())
      importCameraBookmarks(
        imported.map((bookmark) => ({
          name: bookmark.name,
          position: bookmark.position,
          target: bookmark.target,
          projection: bookmark.projection,
          fov: bookmark.fov,
          zoom: bookmark.zoom,
          up: bookmark.up,
        })),
      )
      setErrorKey(null)
    } catch (error) {
      setErrorKey(importErrorKey(error))
    }
  }

  return (
    <CollapsiblePanel panelKey="camera" className="panel--camera" title={t('panels.camera.title')}>
      {/* A câmera de cena (fase 11): alternar entre a bancada e o quadro dela,
          e trazê-la para onde a bancada está olhando. Tudo o mais neste painel
          comanda a CÂMERA DE CENA — as vistas ortográficas, mais abaixo, são a
          exceção: navegação do viewport de trabalho. */}
      <fieldset aria-label={t('panels.camera.sceneCamera')}>
        <legend>{t('panels.camera.sceneCamera')}</legend>

        <button
          type="button"
          className="panel-action camera-panel__apply"
          aria-pressed={viewMode === 'camera'}
          onClick={toggleViewMode}
        >
          {t(viewMode === 'camera' ? 'panels.camera.exitCameraView' : 'panels.camera.enterCameraView')}
        </button>

        <button
          type="button"
          className="panel-action"
          disabled={viewMode === 'camera'}
          title={t('panels.camera.placeAtViewHint')}
          onClick={requestPlaceCameraAtView}
        >
          {t('panels.camera.placeAtView')}
        </button>

        {/* Mover/Girar da câmera — mesmo par (e mesmos rótulos) do gizmo das
            juntas, agindo no modo global dos atalhos W/E. Desabilitado no modo
            visão-câmera: ali o gizmo não está na tela. */}
        <div className="panel-actions camera-panel__presets">
          <button
            type="button"
            aria-pressed={cameraSelected && gizmoMode === 'translate'}
            disabled={viewMode === 'camera'}
            title={t('panels.camera.gizmoHint')}
            onClick={() => selectCameraGizmo('translate')}
          >
            {t('common.gizmoTranslate')}
          </button>
          <button
            type="button"
            aria-pressed={cameraSelected && gizmoMode === 'rotate'}
            disabled={viewMode === 'camera'}
            title={t('panels.camera.gizmoHint')}
            onClick={() => selectCameraGizmo('rotate')}
          >
            {t('common.gizmoRotate')}
          </button>
        </div>

        <p className="camera-panel__hint">
          {t(viewMode === 'camera' ? 'panels.camera.cameraViewHint' : 'panels.camera.editViewHint')}
        </p>
      </fieldset>

      {/* Controles numéricos da câmera (fase 11.1), no mesmo desenho da
          colocação do boneco no painel de Propriedades: posição em campos
          numéricos, rotação em sliders com a cor de cada eixo. Mão dupla com o
          gizmo — arrastar/girar no viewport mexe nestes valores ao vivo. */}
      <fieldset aria-label={t('panels.camera.position')}>
        <legend>{t('panels.camera.position')}</legend>
        {CAMERA_AXES.map((axis, index) => (
          <label key={axis} htmlFor={`camera-position-${axis}`} className="properties-panel__field">
            <span style={{ color: AXIS_COLORS[axis] }}>{axis.toUpperCase()}</span>
            <input
              id={`camera-position-${axis}`}
              type="number"
              step={0.01}
              style={{ accentColor: AXIS_COLORS[axis] }}
              value={sceneCamera.position[index]}
              onChange={handleCameraPositionChange(index)}
            />
          </label>
        ))}
      </fieldset>

      <fieldset aria-label={t('panels.camera.rotation')}>
        <legend>{t('panels.camera.rotation')}</legend>
        {CAMERA_AXES.map((axis) => (
          <div key={axis} className="properties-panel__axis-row">
            <span className="properties-panel__axis-tag" style={{ color: AXIS_COLORS[axis], borderColor: AXIS_COLORS[axis] }}>
              {axis.toUpperCase()}
            </span>
            <input
              type="range"
              aria-label={t(`panels.camera.rotation${axis.toUpperCase()}`)}
              style={{ accentColor: AXIS_COLORS[axis] }}
              min={CAMERA_ROTATION_RANGE[axis].min}
              max={CAMERA_ROTATION_RANGE[axis].max}
              value={Math.round(cameraEuler[axis])}
              onChange={handleCameraRotationChange(axis)}
            />
            <span className="properties-panel__value">{Math.round(cameraEuler[axis])}°</span>
          </div>
        ))}

        {/* Apontar para o assunto (pedido do usuário, 2026-08-06). Fica AQUI,
            e não no bloco de enquadramento: aquele escolhe plano e ângulo e
            RECOLOCA a câmera inteira, estes dois só giram — são a versão
            automática dos três sliders logo acima, e o ponto de vista
            escolhido fica onde está. Dois botões entre os quais se escolhe:
            `.panel-actions`, pela convenção do #88. */}
        <div className="panel-actions">
          <button
            type="button"
            onClick={() => aimAt(aimFigurePoint)}
            disabled={aimFigurePoint === null}
            title={t('panels.camera.aimAtFigureHint')}
          >
            {t('panels.camera.aimAtFigure')}
          </button>
          <button
            type="button"
            onClick={() => aimAt(aimAllPoint)}
            disabled={aimAllPoint === null}
            title={t('panels.camera.aimAtAllHint')}
          >
            {t('panels.camera.aimAtAll')}
          </button>
        </div>
      </fieldset>


      {/* Lente e INCLINAÇÃO (pedido do usuário, 2026-07-31). O roll morava
          no bloco de enquadramento, que é todo "escolha e aperte Aplicar";
          ele é o único de lá que age ao vivo, e é propriedade contínua da
          câmera — como a distância focal. Aqui os dois controles ao vivo
          ficam juntos, e o bloco de enquadramento fica com um só modelo de
          interação. */}
      <fieldset aria-label={t('panels.camera.lens')}>
        <legend>{t('panels.camera.lens')}</legend>

        <label htmlFor="camera-focal" className="camera-panel__field">
          {t('panels.camera.focalLength')}
          <input
            id="camera-focal"
            type="number"
            min={MIN_FOCAL_MM}
            max={MAX_FOCAL_MM}
            step={1}
            value={focalDraft}
            onChange={handleFocalInput}
            onBlur={commitFocal}
          />
        </label>

        <div className="camera-panel__lens-presets">
          {LENS_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={Math.round(focalMm) === preset}
              title={`${LENS_FAMILY_TERMS[lensFamilyKey(preset)]} — ${t(`panels.camera.lensFamily.${lensFamilyKey(preset)}`)}`}
              onClick={() => setFocalLength(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <p className="camera-panel__hint">
          {t('panels.camera.lensHint', {
            term: LENS_FAMILY_TERMS[lensFamilyKey(focalMm)],
            family: t(`panels.camera.lensFamily.${lensFamilyKey(focalMm)}`),
            fov: fov.toFixed(1),
          })}
        </p>

        <label htmlFor="camera-roll" className="camera-panel__slider-label">
          {DUTCH_ANGLE_TERM} — {t('panels.camera.roll', { value: Math.round(rollDeg) })}
        </label>
        {/* Slider e "Endireitar" em linhas separadas (pedido do usuário,
            2026-07-31): dividindo a linha, o slider perdia para o botão a
            largura de que o ajuste fino precisa. Endireitar é ação isolada e
            segue a convenção do #88 — `.panel-action`, largura cheia. */}
        <div className="camera-panel__slider-row">
          <input
            id="camera-roll"
            type="range"
            min={-MAX_ROLL_DEG}
            max={MAX_ROLL_DEG}
            step={1}
            value={rollDeg}
            onChange={(event) => setRoll(Number(event.target.value))}
          />
        </div>
        <button
          type="button"
          className="panel-action"
          disabled={rollDeg === 0}
          onClick={() => setRoll(0)}
        >
          {t('panels.camera.rollReset')}
        </button>

        {rollDeg !== 0 && <p className="camera-panel__hint">{t('panels.camera.rollHint')}</p>}
      </fieldset>

      {/* Enquadramento e ângulo (DECISOES.md #46): o plano decide o recorte,
          o ponto de vista decide de onde se olha, a orientação decide de que
          lado e a composição decide onde o sujeito fica no quadro. Tudo aqui
          espera o "Aplicar enquadramento" — e é só isso que espera. */}
      <CollapsibleSection sectionKey="cameraFraming" title={t('panels.camera.shots')}>
        <fieldset aria-label={t('panels.camera.shots')}>
          <label className="camera-panel__field" htmlFor="camera-shot-select">
            {t('panels.camera.shotGroup')}
            <select
              id="camera-shot-select"
              value={shotDraft}
              onChange={(event) => setShotDraft(event.target.value as ShotKey)}
            >
              {SHOT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {optionLabel(SHOT_TERMS[key], t(SHOT_LABEL_KEYS[key]))}
                </option>
              ))}
            </select>
          </label>

          {/* De que ALTURA se olha. Ângulo e altura vão no MESMO combo, em dois
              grupos: as duas respondem à mesma pergunta e só uma pode valer — num
              combo isso é evidente, com botões era preciso explicar. */}
          <label className="camera-panel__field" htmlFor="camera-vantage-select">
            {t('panels.camera.vantageGroup')}
            <select
              id="camera-vantage-select"
              value={vantageDraft}
              onChange={(event) => setVantageDraft(event.target.value)}
            >
              <optgroup label={t('panels.camera.angleGroup')}>
                {ANGLE_KEYS.map((key) => (
                  <option key={key} value={`angle:${key}`}>
                    {optionLabel(ANGLE_TERMS[key], t(ANGLE_LABEL_KEYS[key]))}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t('panels.camera.heightGroup')}>
                {CAMERA_HEIGHT_KEYS.map((key) => (
                  <option key={key} value={`height:${key}`}>
                    {optionLabel(CAMERA_HEIGHT_TERMS[key], t(HEIGHT_LABEL_KEYS[key]))}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          {/* De que LADO se olha — relativo ao boneco, não ao mundo (#50). */}
          <label className="camera-panel__field" htmlFor="camera-orientation-select">
            {t('panels.camera.orientationGroup')}
            <select
              id="camera-orientation-select"
              value={orientationDraft}
              onChange={(event) => setOrientationDraft(event.target.value)}
            >
              <option value="">{t('panels.camera.orientationKeep')}</option>
              {ORIENTATION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {optionLabel(ORIENTATION_TERMS[key], t(ORIENTATION_LABEL_KEYS[key]))}
                </option>
              ))}
            </select>
          </label>

          {/* Onde o sujeito fica DENTRO do quadro. Eram dois interruptores
              independentes; como combo, as quatro combinações ficam explícitas. */}
          <label className="camera-panel__field" htmlFor="camera-composition-select">
            {t('panels.camera.compositionGroup')}
            <select
              id="camera-composition-select"
              value={compositionDraft}
              onChange={(event) => setCompositionDraft(event.target.value as CompositionChoice)}
            >
              <option value="centered">{t('panels.camera.compositionCentered')}</option>
              <option value="thirds">
                {optionLabel(RULE_OF_THIRDS_TERM, t('panels.camera.compositionThirds'))}
              </option>
              <option value="leadRoom">
                {optionLabel(LEAD_ROOM_TERM, t('panels.camera.compositionLeadRoom'))}
              </option>
              <option value="both">
                {optionLabel(
                  `${RULE_OF_THIRDS_TERM} + ${LEAD_ROOM_TERM}`,
                  t('panels.camera.compositionBoth'),
                )}
              </option>
            </select>
          </label>

          <button
            type="button"
            className="panel-action camera-panel__apply"
            disabled={!canApplyShot(shotDraft, figures.length, hasSelection)}
            onClick={applyDraftFraming}
          >
            {t('panels.camera.applyFraming')}
          </button>

          <p className="camera-panel__hint">
            {figures.length === 0
              ? t('panels.camera.shotsNeedFigure')
              : hasSelection
                ? t('panels.camera.shotsHint')
                : t('panels.camera.shotsGroup')}
          </p>
        </fieldset>
      </CollapsibleSection>

      {/* Vistas que resolvem posição e distância sozinhas, a partir de quem
          está na cena. Dividiam o fieldset com o enquadramento, e o bloco
          ficava com dois botões "Aplicar" — ambíguo na leitura e no clique. */}
      <CollapsibleSection sectionKey="cameraViews" title={t('panels.camera.viewsSection')}>
        <fieldset aria-label={t('panels.camera.viewsSection')}>
          <label className="camera-panel__field" htmlFor="camera-view-select">
            {t('panels.camera.viewsGroup')}
            <select
              id="camera-view-select"
              value={viewDraft}
              onChange={(event) => setViewDraft(event.target.value as ViewChoice)}
            >
              <option value="overTheShoulder">
                {optionLabel(OVER_THE_SHOULDER_TERM, t('panels.camera.angleOverTheShoulder'))}
              </option>
              <option value="pov">{optionLabel(POV_TERM, t('panels.camera.viewPov'))}</option>
              <option value="twoShot">
                {optionLabel(TWO_SHOT_TERM, t('panels.camera.viewTwoShot'))}
              </option>
              <option value="reverseAngle">
                {optionLabel(REVERSE_ANGLE_TERM, t('panels.camera.viewReverseAngle'))}
              </option>
            </select>
          </label>

          <button
            type="button"
            className="panel-action camera-panel__apply"
            disabled={!canApplyView}
            onClick={applyDraftView}
          >
            {t('panels.camera.applyView')}
          </button>

          {!canApplyView && <p className="camera-panel__hint">{t(viewBlockedKey)}</p>}
        </fieldset>
      </CollapsibleSection>

      <CollapsibleSection sectionKey="cameraMove" title={t('panels.camera.move')}>
        {/* Movimento entre dois pontos: as pontas guardam a câmera inteira
            (posição, alvo, inclinação e lente), e o slider anda entre elas. */}
        <fieldset aria-label={t('panels.camera.move')}>
          <div className="panel-actions camera-panel__presets">
            <button type="button" aria-pressed={moveA !== null} onClick={() => requestCaptureMovePoint('a')}>
              {t('panels.camera.moveSetA')}
            </button>
            <button type="button" aria-pressed={moveB !== null} onClick={() => requestCaptureMovePoint('b')}>
              {t('panels.camera.moveSetB')}
            </button>
            <button type="button" disabled={!moveA && !moveB} onClick={clearMove}>
              {t('panels.camera.moveClear')}
            </button>
          </div>

          <div className="panel-actions camera-panel__presets">
            {MOVE_GENERATOR_KEYS.map((key) => (
              <TermButton
                key={key}
                term={MOVE_TERMS[key]}
                caption={t(MOVE_LABEL_KEYS[key])}
                disabled={moveA === null}
                onClick={() => generateMove(key)}
              />
            ))}
          </div>

          <label htmlFor="camera-move-t" className="camera-panel__slider-label">
            {t('panels.camera.movePosition', { value: Math.round(moveT * 100) })}
          </label>
          <div className="camera-panel__slider-row">
            <input
              id="camera-move-t"
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(moveT * 100)}
              disabled={!canPlayMove}
              onChange={(event) => setMoveT(Number(event.target.value) / 100)}
            />
          </div>

          <p className="camera-panel__hint">
            {canPlayMove ? t('panels.camera.moveHint') : t('panels.camera.moveNeedsBothPoints')}
          </p>

          {/* Item 34: o movimento e o animador usam o MESMO `interpolateCameraView`
              (#46) e mesmo assim não se falavam — quem já montou o travelling
              tinha de remontá-lo em keyframes. */}
          <button
            type="button"
            className="panel-action"
            disabled={!canPlayMove || figureCount === 0}
            title={t('panels.camera.moveToKeyframesHint')}
            onClick={() => moveA && moveB && appendCameraMoveKeyframes(null, moveA, moveB)}
          >
            {t('panels.camera.moveToKeyframes')}
          </button>
          {canPlayMove && figureCount === 0 && (
            <p className="camera-panel__hint">{t('panels.camera.moveToKeyframesNeedsFigure')}</p>
          )}
        </fieldset>
      </CollapsibleSection>

      {/* A EXCEÇÃO do painel, agora dita no título: as vistas ortográficas
          e o "voltar à perspectiva" comandam a câmera da BANCADA, não a de
          cena. O comentário do topo já avisava disso; um bloco que precisa
          de aviso para não ser confundido estava com o nome errado. */}
      <CollapsibleSection sectionKey="cameraOrtho" title={t('panels.camera.presets')}>
        <fieldset aria-label={t('panels.camera.presets')}>
          <div className="panel-actions camera-panel__presets">
            {ORTHO_PRESET_NAMES.map((preset) => (
              <button key={preset} type="button" onClick={() => applyPreset(preset)}>
                {t(PRESET_LABEL_KEYS[preset])}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="panel-action camera-panel__back-to-perspective"
            disabled={projection === 'perspective'}
            onClick={requestPerspective}
          >
            {t('panels.camera.backToPerspective')}
          </button>
        </fieldset>
      </CollapsibleSection>

      <CollapsibleSection sectionKey="cameraBookmarks" title={t('panels.camera.bookmarks')}>
        <fieldset aria-label={t('panels.camera.bookmarks')}>
          {cameraBookmarks.length === 0 ? (
            <p className="panel__empty">{t('panels.camera.bookmarksEmpty')}</p>
          ) : (
            <ul className="camera-panel__bookmark-list">
              {cameraBookmarks.map((bookmark) => (
                <li key={bookmark.id} className="camera-panel__bookmark-row">
                  <span className="camera-panel__bookmark-name">{bookmark.name}</span>
                  <button
                    type="button"
                    aria-label={t('panels.camera.applyBookmark')}
                    title={t('panels.camera.applyBookmark')}
                    onClick={() => applyBookmark(bookmark.id)}
                  >
                    &#8594;
                  </button>
                  <button
                    type="button"
                    aria-label={t('panels.camera.removeBookmark')}
                    title={t('panels.camera.removeBookmark')}
                    onClick={() => removeCameraBookmark(bookmark.id)}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}

          {isNamingBookmark ? (
            <form className="camera-panel__save-form" onSubmit={confirmSaveBookmark}>
              <label htmlFor="camera-bookmark-name" className="camera-panel__field">
                {t('panels.camera.bookmarkNameLabel')}
                <input
                  id="camera-bookmark-name"
                  type="text"
                  value={bookmarkNameDraft}
                  onChange={(event) => setBookmarkNameDraft(event.target.value)}
                  autoFocus
                />
              </label>
              <div className="camera-panel__save-form-actions">
                <button type="submit">{t('panels.camera.confirmSave')}</button>
                <button type="button" onClick={cancelNamingBookmark}>
                  {t('panels.camera.cancelSave')}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="panel-action camera-panel__save" onClick={startNamingBookmark}>
              {t('panels.camera.saveCurrent')}
            </button>
          )}

          <div className="camera-panel__bookmark-file-actions">
            <button type="button" className="panel-action" onClick={() => void handleExportBookmarks()}>
              {t('panels.camera.exportBookmarks')}
            </button>
            <button type="button" className="panel-action" onClick={() => void handleImportBookmarks()}>
              {t('panels.camera.importBookmarks')}
            </button>
          </div>

          {errorKey && (
            <p role="alert" className="panel__error">
              {t(errorKey)}
            </p>
          )}
        </fieldset>
      </CollapsibleSection>

    </CollapsiblePanel>
  )
}
