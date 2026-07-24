import { slugifySceneName } from '../keyframe/keyframeNaming'
import type { SceneSnapshot } from '../store/figuresStore'

/**
 * Manifesto `workspace.json` de um workspace salvo em pasta: aponta, por
 * nome de arquivo, para os `.glb`s de cada cena salvos independentemente na
 * mesma pasta — ver PLANO.md > "Workspace: catálogo de cenas" e
 * DECISOES.md #11 (opção 1: pasta + manifesto, não um `.glb` único).
 */

export const WORKSPACE_MANIFEST_FILENAME = 'workspace.json'
export const WORKSPACE_MANIFEST_VERSION = 1

export interface WorkspaceManifestEntry {
  id: string
  name: string
  filename: string
}

export interface WorkspaceManifest {
  version: number
  activeSceneId: string | null
  scenes: WorkspaceManifestEntry[]
}

export function buildWorkspaceManifest(
  scenes: readonly SceneSnapshot[],
  activeSceneId: string | null,
): WorkspaceManifest {
  const usedFilenames = new Set<string>()

  const entries = scenes.map((scene) => {
    const base = slugifySceneName(scene.name)
    let filename = `${base}.glb`
    let suffix = 2
    while (usedFilenames.has(filename)) {
      filename = `${base}-${suffix}.glb`
      suffix += 1
    }
    usedFilenames.add(filename)
    return { id: scene.id, name: scene.name, filename }
  })

  return { version: WORKSPACE_MANIFEST_VERSION, activeSceneId, scenes: entries }
}

export function parseWorkspaceManifest(json: unknown): WorkspaceManifest {
  const source = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>
  const scenesSource = Array.isArray(source.scenes) ? source.scenes : []

  const scenes = scenesSource.map((entry, index) => {
    const entrySource = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>
    return {
      id: typeof entrySource.id === 'string' ? entrySource.id : `scene-${index + 1}`,
      name: typeof entrySource.name === 'string' ? entrySource.name : `Cena ${index + 1}`,
      filename: typeof entrySource.filename === 'string' ? entrySource.filename : `scene-${index + 1}.glb`,
    }
  })

  return {
    version: typeof source.version === 'number' ? source.version : WORKSPACE_MANIFEST_VERSION,
    activeSceneId: typeof source.activeSceneId === 'string' ? source.activeSceneId : null,
    scenes,
  }
}
