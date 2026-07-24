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
}

export interface SceneExtras {
  version: number
  name: string
  environment: EnvironmentSettings
  keyframeCounter: number
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
  nextKeyframeNumber: number
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
    color: typeof source.color === 'string' ? source.color : '#e04040',
    visible: typeof source.visible === 'boolean' ? source.visible : true,
    height: typeof source.height === 'number' ? clampHeight(source.height) : REFERENCE_HEIGHT_M,
    position: tupleToVec3(source.position, [0, 0, 0]),
    rotation: tupleToRotation(source.rotation),
    pose,
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
    keyframeCounter: scene.nextKeyframeNumber,
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
    cameraBookmarks,
    nextCameraBookmarkSeq:
      typeof source.nextCameraBookmarkSeq === 'number'
        ? source.nextCameraBookmarkSeq
        : cameraBookmarks.length + 1,
    nextKeyframeNumber: typeof source.keyframeCounter === 'number' ? source.keyframeCounter : 1,
  }
}
