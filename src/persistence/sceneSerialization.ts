/**
 * Conversão pura entre o estado de uma cena (bonecos, ambiente, bookmarks de
 * câmera etc.) e o schema serializável gravado em `extras["virtual-mockup"]`
 * do glTF — ver PLANO.md > "Persistência (formato da cena)". Não depende de
 * `three`/glTF nenhum: só mapeia objetos JS simples, então é 100% testável
 * sem navegador/WebGL. A camada que efetivamente grava/lê `.glb` (`gltfIO.ts`)
 * usa essas funções para preparar/consumir o bloco de `extras`.
 */
import {
  JOINT_NAMES,
  clampJointRotation,
  type JointRotation,
} from '../figure/skeleton'
import { MAX_HEIGHT_M, MIN_HEIGHT_M, REFERENCE_HEIGHT_M } from '../figure/skeleton'
import { withLegacyIndexFinger } from '../figure/poseCompat'
import { DEFAULT_SCENE_CAMERA, type CameraViewState } from '../scene/cameraMove'
import { clampFocalLength } from '../scene/lens'
import { DEFAULT_FIGURE_COLOR, normalizeFigureColor } from '../store/figuresStore'
import type { BackgroundTone, CameraBookmark, CameraProjection, EnvironmentSettings, Figure } from '../store/figuresStore'

export const SCENE_EXTRAS_VERSION = 1

export type Vec3Tuple = [number, number, number]

export interface FigureExtras {
  id: string
  name: string
  color: string
  visible: boolean
  height: number
  position: Vec3Tuple
  rotation: Vec3Tuple
  joints: Record<string, Vec3Tuple>
}

export interface CameraBookmarkExtras {
  id: string
  name: string
  position: Vec3Tuple
  target: Vec3Tuple
  projection: CameraProjection
  fov: number
  zoom: number
  /** Topo da tela — ausente nos arquivos gravados antes do ângulo holandês (#46). */
  up?: Vec3Tuple
}

/** A câmera de cena serializada (fase 11). Mesmo formato do `CameraViewState`. */
export interface SceneCameraExtras {
  position: Vec3Tuple
  target: Vec3Tuple
  up: Vec3Tuple
  focalMm: number
}

export interface SceneExtras {
  version: number
  name: string
  environment: EnvironmentSettings
  /**
   * A câmera de cena (fase 11). Adição de campo, sem subir
   * `SCENE_EXTRAS_VERSION`: arquivo antigo sem ela recebe a câmera padrão.
   */
  sceneCamera: SceneCameraExtras
  /**
   * Próximo número da sequência de instantâneos. Era `keyframeCounter` até a
   * fase 10 (DECISOES.md #52); grava-se o nome novo e lê-se os dois, para que
   * cenas antigas continuem a contagem em vez de reiniciar do 1. Adição de
   * campo não sobe `SCENE_EXTRAS_VERSION`.
   */
  snapshotCounter: number
  nextFigureSeq: number
  nextCameraBookmarkSeq: number
  cameraBookmarks: CameraBookmarkExtras[]
  figures: FigureExtras[]
}

/** Estado de uma cena de trabalho, no formato usado pelo `figuresStore`. */
export interface SceneWorkingState {
  name: string
  figures: Figure[]
  nextFigureSeq: number
  environment: EnvironmentSettings
  cameraBookmarks: CameraBookmark[]
  nextCameraBookmarkSeq: number
  nextSnapshotNumber: number
  sceneCamera: CameraViewState
}

const DEFAULT_BACKGROUND: BackgroundTone = 'medium'
const DEFAULT_ENVIRONMENT: EnvironmentSettings = { background: DEFAULT_BACKGROUND, grid: true }
const VALID_BACKGROUNDS: readonly BackgroundTone[] = ['light', 'medium', 'dark']
const VALID_PROJECTIONS: readonly CameraProjection[] = ['perspective', 'orthographic']

function rotationToTuple(rotation: JointRotation): Vec3Tuple {
  return [rotation.x, rotation.y, rotation.z]
}

function tupleToRotation(tuple: unknown): JointRotation {
  if (!Array.isArray(tuple) || tuple.length !== 3 || tuple.some((n) => typeof n !== 'number')) {
    return { x: 0, y: 0, z: 0 }
  }
  const [x, y, z] = tuple as Vec3Tuple
  return { x, y, z }
}

function tupleToVec3(tuple: unknown, fallback: Vec3Tuple): Vec3Tuple {
  if (!Array.isArray(tuple) || tuple.length !== 3 || tuple.some((n) => typeof n !== 'number')) {
    return fallback
  }
  return [...(tuple as Vec3Tuple)]
}

function clampHeight(heightM: number): number {
  return Math.min(MAX_HEIGHT_M, Math.max(MIN_HEIGHT_M, heightM))
}

export function figureToExtras(figure: Figure): FigureExtras {
  const joints: Record<string, Vec3Tuple> = {}
  for (const [jointName, rotation] of Object.entries(figure.pose)) {
    joints[jointName] = rotationToTuple(rotation)
  }
  return {
    id: figure.id,
    name: figure.name,
    color: figure.color,
    visible: figure.visible,
    height: figure.height,
    position: [...figure.position],
    rotation: rotationToTuple(figure.rotation),
    joints,
  }
}

export function figureFromExtras(extras: unknown, fallbackIndex: number): Figure {
  const source = (typeof extras === 'object' && extras !== null ? extras : {}) as Record<string, unknown>

  const pose: Record<string, JointRotation> = {}
  const joints = source.joints
  if (typeof joints === 'object' && joints !== null) {
    for (const [jointName, tuple] of Object.entries(joints as Record<string, unknown>)) {
      if (!JOINT_NAMES.includes(jointName)) continue
      pose[jointName] = clampJointRotation(jointName, tupleToRotation(tuple))
    }
  }

  return {
    id: typeof source.id === 'string' ? source.id : `figure-${fallbackIndex + 1}`,
    name: typeof source.name === 'string' ? source.name : `Figure ${fallbackIndex + 1}`,
    // Cor livre desde DECISOES.md #39: qualquer `#rrggbb` serve, mas uma
    // string que não seja cor NÃO passa — ela iria direto para o material do
    // three.js e para o `style` do painel.
    color: normalizeFigureColor(source.color) ?? DEFAULT_FIGURE_COLOR,
    visible: typeof source.visible === 'boolean' ? source.visible : true,
    height: typeof source.height === 'number' ? clampHeight(source.height) : REFERENCE_HEIGHT_M,
    position: tupleToVec3(source.position, [0, 0, 0]),
    rotation: tupleToRotation(source.rotation),
    // Poses gravadas antes do dedo indicador separado ganham o indicador
    // copiado do bloco (DECISOES.md #45) — sem isso um punho salvo reabriria
    // com o indicador esticado, virando um "apontando".
    pose: withLegacyIndexFinger(pose),
  }
}

export function cameraBookmarkToExtras(bookmark: CameraBookmark): CameraBookmarkExtras {
  return {
    id: bookmark.id,
    name: bookmark.name,
    position: [...bookmark.position],
    target: [...bookmark.target],
    projection: bookmark.projection,
    fov: bookmark.fov,
    zoom: bookmark.zoom,
    ...(bookmark.up ? { up: [...bookmark.up] as Vec3Tuple } : {}),
  }
}

export function cameraBookmarkFromExtras(extras: unknown, fallbackIndex: number): CameraBookmark {
  const source = (typeof extras === 'object' && extras !== null ? extras : {}) as Record<string, unknown>
  const projection = source.projection
  return {
    id: typeof source.id === 'string' ? source.id : `camera-bookmark-${fallbackIndex + 1}`,
    name: typeof source.name === 'string' ? source.name : `Bookmark ${fallbackIndex + 1}`,
    position: tupleToVec3(source.position, [0, 0, 0]),
    target: tupleToVec3(source.target, [0, 0, 0]),
    projection: VALID_PROJECTIONS.includes(projection as CameraProjection)
      ? (projection as CameraProjection)
      : 'perspective',
    fov: typeof source.fov === 'number' ? source.fov : 50,
    zoom: typeof source.zoom === 'number' ? source.zoom : 1,
    // Sem `up` no arquivo, a câmera volta em pé — foi assim que ela foi salva.
    ...(Array.isArray(source.up) ? { up: tupleToVec3(source.up, [0, 1, 0]) } : {}),
  }
}

export function sceneCameraToExtras(camera: CameraViewState): SceneCameraExtras {
  return {
    position: [...camera.position],
    target: [...camera.target],
    up: [...camera.up],
    focalMm: camera.focalMm,
  }
}

/**
 * Reconstrói a câmera de cena de um bloco não confiável. Além dos defaults de
 * praxe, recusa uma câmera DEGENERADA (posição em cima do alvo, que não define
 * direção de visão) devolvendo a padrão — um arquivo editado à mão não pode
 * deixar a cena sem enquadramento válido.
 */
export function sceneCameraFromExtras(extras: unknown): CameraViewState {
  if (typeof extras !== 'object' || extras === null) return DEFAULT_SCENE_CAMERA
  const source = extras as Record<string, unknown>

  const position = tupleToVec3(source.position, [...DEFAULT_SCENE_CAMERA.position])
  const target = tupleToVec3(source.target, [...DEFAULT_SCENE_CAMERA.target])
  const up = tupleToVec3(source.up, [...DEFAULT_SCENE_CAMERA.up])

  const dx = position[0] - target[0]
  const dy = position[1] - target[1]
  const dz = position[2] - target[2]
  if (dx * dx + dy * dy + dz * dz < 1e-8) return DEFAULT_SCENE_CAMERA
  if (up[0] * up[0] + up[1] * up[1] + up[2] * up[2] < 1e-8) return DEFAULT_SCENE_CAMERA

  return {
    position,
    target,
    up,
    focalMm:
      typeof source.focalMm === 'number' && Number.isFinite(source.focalMm)
        ? clampFocalLength(source.focalMm)
        : DEFAULT_SCENE_CAMERA.focalMm,
  }
}

function environmentFromExtras(extras: unknown): EnvironmentSettings {
  const source = (typeof extras === 'object' && extras !== null ? extras : {}) as Record<string, unknown>
  const background = VALID_BACKGROUNDS.includes(source.background as BackgroundTone)
    ? (source.background as BackgroundTone)
    : DEFAULT_ENVIRONMENT.background
  const grid = typeof source.grid === 'boolean' ? source.grid : DEFAULT_ENVIRONMENT.grid
  return { background, grid }
}

/** Monta o bloco `extras["virtual-mockup"]` a partir do estado de uma cena de trabalho. */
export function sceneToExtras(scene: SceneWorkingState): SceneExtras {
  return {
    version: SCENE_EXTRAS_VERSION,
    name: scene.name,
    environment: { ...scene.environment },
    sceneCamera: sceneCameraToExtras(scene.sceneCamera),
    snapshotCounter: scene.nextSnapshotNumber,
    nextFigureSeq: scene.nextFigureSeq,
    nextCameraBookmarkSeq: scene.nextCameraBookmarkSeq,
    cameraBookmarks: scene.cameraBookmarks.map(cameraBookmarkToExtras),
    figures: scene.figures.map(figureToExtras),
  }
}

/**
 * Reconstrói o estado de uma cena de trabalho a partir de um bloco de
 * `extras` lido de um `.glb` (ou de qualquer JSON não confiável — nunca
 * assume que os campos existem/têm o tipo certo, ver PLANO.md > "Regras de
 * leitura/gravação" > "Campo version + validação com defaults ao carregar").
 */
export function sceneFromExtras(extras: unknown): SceneWorkingState {
  const source = (typeof extras === 'object' && extras !== null ? extras : {}) as Record<string, unknown>

  const figuresSource = Array.isArray(source.figures) ? source.figures : []
  const figures = figuresSource.map((figureExtras, index) => figureFromExtras(figureExtras, index))

  const bookmarksSource = Array.isArray(source.cameraBookmarks) ? source.cameraBookmarks : []
  const cameraBookmarks = bookmarksSource.map((bookmarkExtras, index) =>
    cameraBookmarkFromExtras(bookmarkExtras, index),
  )

  return {
    name: typeof source.name === 'string' && source.name.trim() !== '' ? source.name : 'Cena 1',
    figures,
    nextFigureSeq: typeof source.nextFigureSeq === 'number' ? source.nextFigureSeq : figures.length + 1,
    environment: environmentFromExtras(source.environment),
    sceneCamera: sceneCameraFromExtras(source.sceneCamera),
    cameraBookmarks,
    nextCameraBookmarkSeq:
      typeof source.nextCameraBookmarkSeq === 'number'
        ? source.nextCameraBookmarkSeq
        : cameraBookmarks.length + 1,
    nextSnapshotNumber:
      typeof source.snapshotCounter === 'number'
        ? source.snapshotCounter
        : typeof source.keyframeCounter === 'number'
          ? source.keyframeCounter
          : 1,
  }
}
