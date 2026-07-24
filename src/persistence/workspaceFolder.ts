import type { SceneSnapshot, SceneSnapshotData } from '../store/figuresStore'
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
 */

export interface LoadedWorkspace {
  scenes: SceneSnapshot[]
  activeSceneId: string | null
}

function sceneToSnapshotData(scene: {
  figures: SceneSnapshotData['figures']
  nextFigureSeq: number
  environment: SceneSnapshotData['environment']
  cameraBookmarks: SceneSnapshotData['cameraBookmarks']
  nextCameraBookmarkSeq: number
  nextKeyframeNumber: number
}): SceneSnapshotData {
  return {
    figures: scene.figures,
    nextFigureSeq: scene.nextFigureSeq,
    environment: scene.environment,
    cameraBookmarks: scene.cameraBookmarks,
    nextCameraBookmarkSeq: scene.nextCameraBookmarkSeq,
    nextKeyframeNumber: scene.nextKeyframeNumber,
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
): Promise<void> {
  const manifest = buildWorkspaceManifest(scenes, activeSceneId)

  for (const entry of manifest.scenes) {
    const scene = scenes.find((candidate) => candidate.id === entry.id)
    if (!scene) continue
    const glb = await exportSceneToGlb({ name: scene.name, ...scene.data })
    await writeToDirectory(directoryHandle, entry.filename, new Blob([glb], { type: 'model/gltf-binary' }))
  }

  await writeToDirectory(directoryHandle, WORKSPACE_MANIFEST_FILENAME, JSON.stringify(manifest, null, 2))
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

  const scenes = await loadScenesFromEntries(manifest.scenes, async (filename) => {
    try {
      return await readFromDirectory(directoryHandle, filename)
    } catch {
      return null
    }
  })

  return { scenes, activeSceneId: manifest.activeSceneId }
}

/** Fallback para navegadores sem File System Access API: o usuário seleciona o `workspace.json` e os `.glb`s juntos. */
export async function loadWorkspaceFromFiles(files: readonly File[]): Promise<LoadedWorkspace | null> {
  const manifestFile = files.find((file) => file.name === WORKSPACE_MANIFEST_FILENAME)
  if (!manifestFile) return null

  const manifest = parseWorkspaceManifest(JSON.parse(await manifestFile.text()))
  const scenes = await loadScenesFromEntries(
    manifest.scenes,
    async (filename) => files.find((file) => file.name === filename) ?? null,
  )

  return { scenes, activeSceneId: manifest.activeSceneId }
}
