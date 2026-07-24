import * as THREE from 'three'
import { CAMERA_DEFAULTS } from '../scene/constants'
import type { CameraBookmark, Figure } from '../store/figuresStore'
import { buildFigureObject3D } from './figureObject3D'
import { exportObjectsToGlb, importGlb } from './gltfIO'
import {
  SCENE_EXTRAS_VERSION,
  cameraBookmarkFromExtras,
  cameraBookmarkToExtras,
  figureFromExtras,
  figureToExtras,
  sceneFromExtras,
  sceneToExtras,
  type SceneWorkingState,
} from './sceneSerialization'

/**
 * Camada de mais alto nível: monta/lê arquivos `.glb` completos (cena,
 * boneco individual ou conjunto de bookmarks de câmera) combinando a
 * hierarquia headless de `figureObject3D.ts`, a serialização pura de
 * `sceneSerialization.ts` e o I/O de glTF de `gltfIO.ts`. Nenhuma função
 * aqui depende do `<Canvas>` montado — 100% testável em `vitest`/`jsdom`
 * (ver PLANO.md > "Persistência").
 */

function sanitizeNamePart(value: string): string {
  return value.replace(/\./g, '_')
}

/** Constrói uma câmera glTF (perspectiva ou ortográfica) a partir de um bookmark salvo. */
function buildCameraObject3D(bookmark: CameraBookmark): THREE.Object3D {
  const camera: THREE.PerspectiveCamera | THREE.OrthographicCamera =
    bookmark.projection === 'orthographic'
      ? new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA_DEFAULTS.near, CAMERA_DEFAULTS.far)
      : new THREE.PerspectiveCamera(bookmark.fov, 1, CAMERA_DEFAULTS.near, CAMERA_DEFAULTS.far)

  camera.name = `camera_${sanitizeNamePart(bookmark.id)}`
  camera.position.set(...bookmark.position)
  camera.zoom = bookmark.zoom
  camera.lookAt(new THREE.Vector3(...bookmark.target))
  camera.updateProjectionMatrix()
  return camera
}

function buildSceneObjects(figures: readonly Figure[], cameraBookmarks: readonly CameraBookmark[]): THREE.Object3D[] {
  return [...figures.map(buildFigureObject3D), ...cameraBookmarks.map(buildCameraObject3D)]
}

export async function exportSceneToGlb(scene: SceneWorkingState): Promise<ArrayBuffer> {
  const objects = buildSceneObjects(scene.figures, scene.cameraBookmarks)
  const extras = sceneToExtras(scene) as unknown as Record<string, unknown>
  return exportObjectsToGlb(objects, extras)
}

export async function importSceneFromGlb(data: ArrayBuffer): Promise<SceneWorkingState> {
  const { extras } = await importGlb(data)
  return sceneFromExtras(extras)
}

const FIGURE_EXTRAS_VERSION = SCENE_EXTRAS_VERSION

export async function exportFigureToGlb(figure: Figure): Promise<ArrayBuffer> {
  const extras = { version: FIGURE_EXTRAS_VERSION, figures: [figureToExtras(figure)] }
  return exportObjectsToGlb([buildFigureObject3D(figure)], extras)
}

export async function importFigureFromGlb(data: ArrayBuffer): Promise<Figure> {
  const { extras } = await importGlb(data)
  const figures = Array.isArray((extras as { figures?: unknown[] }).figures)
    ? (extras as { figures: unknown[] }).figures
    : []
  return figureFromExtras(figures[0], 0)
}

export async function exportCameraBookmarksToGlb(bookmarks: readonly CameraBookmark[]): Promise<ArrayBuffer> {
  const extras = {
    version: SCENE_EXTRAS_VERSION,
    cameraBookmarks: bookmarks.map(cameraBookmarkToExtras),
  }
  return exportObjectsToGlb(bookmarks.map(buildCameraObject3D), extras)
}

export async function importCameraBookmarksFromGlb(data: ArrayBuffer): Promise<CameraBookmark[]> {
  const { extras } = await importGlb(data)
  const bookmarksSource = Array.isArray((extras as { cameraBookmarks?: unknown[] }).cameraBookmarks)
    ? (extras as { cameraBookmarks: unknown[] }).cameraBookmarks
    : []
  return bookmarksSource.map((bookmarkExtras, index) => cameraBookmarkFromExtras(bookmarkExtras, index))
}
