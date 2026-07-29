import type { Animation } from '../animation/animation'
import type { SavedPose } from '../figure/poseLibrary'
import type { SavedClip } from '../animation/clipLibrary'
import { resetJointLimitOverrides, setJointLimitOverrides, type JointLimitOverrides } from '../figure/skeleton'
import type { SceneSnapshot, SceneSnapshotData } from '../store/figuresStore'
import { buildAnimationsFile, parseAnimationsFile } from './animationsFile'
import { buildClipsFile, parseClipsFile } from './clipsFile'
import { buildJointLimitsFile, parseJointLimitsFile } from './jointLimitsFile'
import { buildPosesFile, parsePosesFile } from './posesFile'
import { exportSceneToGlb, importSceneFromGlb } from './sceneFile'
import {
  WORKSPACE_MANIFEST_FILENAME,
  buildWorkspaceManifest,
  parseWorkspaceManifest,
  type WorkspaceManifestEntry,
} from './workspaceManifest'

/**
 * Orquestra salvar/abrir um workspace inteiro (catálogo de cenas) numa pasta
 * do sistema de arquivos: um `.glb` por cena (independente) + o manifesto
 * `workspace.json` apontando para eles — ver DECISOES.md #11 (opção 1,
 * escolhida pelo usuário) e PLANO.md > "Workspace: catálogo de cenas".
 *
 * Desde o #29 a pasta também leva um `joint-limits.json` com os limites
 * articulares em vigor (os padrões do código, quando não customizados),
 * editável à mão e recarregado ao abrir o workspace.
 */

export interface LoadedWorkspace {
  scenes: SceneSnapshot[]
  activeSceneId: string | null
  /** Limites customizados que este workspace trouxe (vazio = padrões do código); já aplicados. */
  jointLimits: JointLimitOverrides
  /** Biblioteca de poses do usuário que este workspace trouxe (ver DECISOES.md #42) — vazia quando não há arquivo. */
  poses: SavedPose[]
  /** Animações que este workspace trouxe (ver DECISOES.md #52) — vazias quando não há arquivo. */
  animations: Animation[]
  /** Trechos salvos que este workspace trouxe (item 39) — vazios quando não há arquivo. */
  clips: SavedClip[]
}

function sceneToSnapshotData(scene: {
  figures: SceneSnapshotData['figures']
  nextFigureSeq: number
  environment: SceneSnapshotData['environment']
  cameraBookmarks: SceneSnapshotData['cameraBookmarks']
  nextCameraBookmarkSeq: number
  nextSnapshotNumber: number
}): SceneSnapshotData {
  return {
    figures: scene.figures,
    nextFigureSeq: scene.nextFigureSeq,
    environment: scene.environment,
    cameraBookmarks: scene.cameraBookmarks,
    nextCameraBookmarkSeq: scene.nextCameraBookmarkSeq,
    nextSnapshotNumber: scene.nextSnapshotNumber,
  }
}

async function writeToDirectory(directoryHandle: FileSystemDirectoryHandle, filename: string, content: Blob | string) {
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}

async function readFromDirectory(directoryHandle: FileSystemDirectoryHandle, filename: string): Promise<File> {
  const fileHandle = await directoryHandle.getFileHandle(filename)
  return fileHandle.getFile()
}

export async function saveWorkspaceToDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  scenes: readonly SceneSnapshot[],
  activeSceneId: string | null,
  poses: readonly SavedPose[] = [],
  animations: readonly Animation[] = [],
  clips: readonly SavedClip[] = [],
): Promise<void> {
  const manifest = buildWorkspaceManifest(scenes, activeSceneId)

  for (const entry of manifest.scenes) {
    const scene = scenes.find((candidate) => candidate.id === entry.id)
    if (!scene) continue
    const glb = await exportSceneToGlb({ name: scene.name, ...scene.data })
    await writeToDirectory(directoryHandle, entry.filename, new Blob([glb], { type: 'model/gltf-binary' }))
  }

  await writeToDirectory(
    directoryHandle,
    manifest.jointLimitsFile,
    JSON.stringify(buildJointLimitsFile(), null, 2),
  )
  // A biblioteca de poses é do workspace (não de uma cena), e por isso vive
  // num arquivo próprio ao lado do de limites — ver DECISOES.md #42.
  await writeToDirectory(directoryHandle, manifest.posesFile, JSON.stringify(buildPosesFile(poses), null, 2))
  // Animações também são do workspace, e pelo mesmo motivo (DECISOES.md #52).
  await writeToDirectory(
    directoryHandle,
    manifest.animationsFile,
    JSON.stringify(buildAnimationsFile(animations), null, 2),
  )
  // Trechos salvos, mesma regra das duas bibliotecas acima (item 39).
  await writeToDirectory(directoryHandle, manifest.clipsFile, JSON.stringify(buildClipsFile(clips), null, 2))
  await writeToDirectory(directoryHandle, WORKSPACE_MANIFEST_FILENAME, JSON.stringify(manifest, null, 2))
}

/**
 * Instala os limites do workspace ANTES de reconstruir as cenas — a ordem
 * importa: é ao ler cada `.glb` que as poses passam por clamp
 * (`sceneSerialization.figureFromExtras`), então poses fora da faixa nova só
 * são corrigidas se os limites já estiverem valendo (decisão do usuário:
 * grampear a pose, ver DECISOES.md #29).
 *
 * Sem arquivo (ou com arquivo ilegível) volta aos padrões do código, em vez de
 * herdar os limites de um workspace aberto antes.
 */
async function applyJointLimitsFile(file: File | null): Promise<JointLimitOverrides> {
  if (!file) {
    resetJointLimitOverrides()
    return {}
  }

  try {
    return setJointLimitOverrides(parseJointLimitsFile(JSON.parse(await file.text())))
  } catch {
    resetJointLimitOverrides()
    return {}
  }
}

/**
 * Biblioteca de poses do workspace. Diferente dos limites, ela não altera
 * estado global nenhum — arquivo ausente ou ilegível é simplesmente uma
 * biblioteca vazia, e as poses de fábrica continuam valendo.
 */
async function readPosesFile(file: File | null): Promise<SavedPose[]> {
  if (!file) return []
  try {
    return parsePosesFile(JSON.parse(await file.text()))
  } catch {
    return []
  }
}

/** Animações do workspace — mesma política da biblioteca de poses: ausente ou ilegível é lista vazia. */
async function readAnimationsFile(file: File | null): Promise<Animation[]> {
  if (!file) return []
  try {
    return parseAnimationsFile(JSON.parse(await file.text()))
  } catch {
    return []
  }
}

/** Trechos do workspace — mesma política dos dois acima: ausente ou ilegível é lista vazia. */
async function readClipsFile(file: File | null): Promise<SavedClip[]> {
  if (!file) return []
  try {
    return parseClipsFile(JSON.parse(await file.text()))
  } catch {
    return []
  }
}

async function loadScenesFromEntries(
  entries: readonly WorkspaceManifestEntry[],
  readFile: (filename: string) => Promise<File | null>,
): Promise<SceneSnapshot[]> {
  const scenes: SceneSnapshot[] = []
  for (const entry of entries) {
    const file = await readFile(entry.filename)
    if (!file) continue
    const data = await file.arrayBuffer()
    const scene = await importSceneFromGlb(data)
    scenes.push({ id: entry.id, name: entry.name, data: sceneToSnapshotData(scene) })
  }
  return scenes
}

export async function loadWorkspaceFromDirectory(directoryHandle: FileSystemDirectoryHandle): Promise<LoadedWorkspace> {
  const manifestFile = await readFromDirectory(directoryHandle, WORKSPACE_MANIFEST_FILENAME)
  const manifest = parseWorkspaceManifest(JSON.parse(await manifestFile.text()))

  const readOrNull = async (filename: string) => {
    try {
      return await readFromDirectory(directoryHandle, filename)
    } catch {
      return null
    }
  }

  const jointLimits = await applyJointLimitsFile(await readOrNull(manifest.jointLimitsFile))
  const poses = await readPosesFile(await readOrNull(manifest.posesFile))
  const animations = await readAnimationsFile(await readOrNull(manifest.animationsFile))
  const clips = await readClipsFile(await readOrNull(manifest.clipsFile))
  const scenes = await loadScenesFromEntries(manifest.scenes, readOrNull)

  return { scenes, activeSceneId: manifest.activeSceneId, jointLimits, poses, animations, clips }
}

/**
 * Fallback para navegadores sem File System Access API: o usuário seleciona o
 * `workspace.json` e os `.glb`s juntos — e também o `joint-limits.json`, se
 * quiser os limites customizados (sem ele, valem os padrões do código).
 */
export async function loadWorkspaceFromFiles(files: readonly File[]): Promise<LoadedWorkspace | null> {
  const manifestFile = files.find((file) => file.name === WORKSPACE_MANIFEST_FILENAME)
  if (!manifestFile) return null

  const manifest = parseWorkspaceManifest(JSON.parse(await manifestFile.text()))
  const findFile = async (filename: string) => files.find((file) => file.name === filename) ?? null

  const jointLimits = await applyJointLimitsFile(await findFile(manifest.jointLimitsFile))
  const poses = await readPosesFile(await findFile(manifest.posesFile))
  const animations = await readAnimationsFile(await findFile(manifest.animationsFile))
  const clips = await readClipsFile(await findFile(manifest.clipsFile))
  const scenes = await loadScenesFromEntries(manifest.scenes, findFile)

  return { scenes, activeSceneId: manifest.activeSceneId, jointLimits, poses, animations, clips }
}
