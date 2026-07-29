import { slugifySceneName } from '../snapshot/snapshotNaming'
import type { SceneSnapshot } from '../store/figuresStore'
import { JOINT_LIMITS_FILENAME } from './jointLimitsFile'
import { ANIMATIONS_FILENAME } from './animationsFile'
import { POSES_FILENAME } from './posesFile'
import { CLIPS_FILENAME } from './clipsFile'

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
  /** Arquivo de limites articulares customizados da pasta (ver DECISOES.md #29) — sempre gravado, mas opcional na leitura. */
  jointLimitsFile: string
  /** Arquivo da biblioteca de poses do usuário (ver DECISOES.md #42) — mesmo contrato do anterior. */
  posesFile: string
  /** Arquivo das animações do usuário (ver DECISOES.md #52) — mesmo contrato dos anteriores. */
  animationsFile: string
  /** Arquivo dos trechos salvos pelo usuário (item 39) — mesmo contrato dos anteriores. */
  clipsFile: string
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

  return {
    version: WORKSPACE_MANIFEST_VERSION,
    activeSceneId,
    jointLimitsFile: JOINT_LIMITS_FILENAME,
    posesFile: POSES_FILENAME,
    animationsFile: ANIMATIONS_FILENAME,
    clipsFile: CLIPS_FILENAME,
    scenes: entries,
  }
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
    // Workspaces gravados antes do #29 não têm o campo — o nome padrão vale, e
    // se o arquivo também não existir na pasta a aplicação volta aos padrões.
    jointLimitsFile:
      typeof source.jointLimitsFile === 'string' && source.jointLimitsFile.trim() !== ''
        ? source.jointLimitsFile
        : JOINT_LIMITS_FILENAME,
    posesFile:
      typeof source.posesFile === 'string' && source.posesFile.trim() !== '' ? source.posesFile : POSES_FILENAME,
    animationsFile:
      typeof source.animationsFile === 'string' && source.animationsFile.trim() !== ''
        ? source.animationsFile
        : ANIMATIONS_FILENAME,
    clipsFile:
      typeof source.clipsFile === 'string' && source.clipsFile.trim() !== '' ? source.clipsFile : CLIPS_FILENAME,
    scenes,
  }
}
