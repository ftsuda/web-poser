import { setJointLimitOverrides, type JointLimitOverrides } from '../figure/skeleton'
import type { CameraBookmark, EnvironmentSettings, Figure, SceneSnapshot, SceneSnapshotData } from '../store/figuresStore'
import { sceneFromExtras, sceneToExtras, type SceneWorkingState } from './sceneSerialization'

/**
 * Autosave contínuo do workspace inteiro (cena de trabalho + catálogo de
 * snapshots) em `localStorage` — restaurado automaticamente ao abrir o app,
 * sem diálogo de confirmação (ver PLANO.md > "Workspace: catálogo de
 * cenas"). Reaproveita o mesmo schema de `extras` usado pelo `.glb`
 * (`sceneToExtras`/`sceneFromExtras`) por desempenho e para não duplicar
 * regras de validação/defaults.
 */

const AUTOSAVE_KEY = 'virtual-mockup:workspace:v1'

export interface WorkspaceState {
  figures: Figure[]
  nextFigureSeq: number
  environment: EnvironmentSettings
  cameraBookmarks: CameraBookmark[]
  nextCameraBookmarkSeq: number
  sceneName: string
  nextKeyframeNumber: number
  scenes: SceneSnapshot[]
  nextSceneSnapshotSeq: number
  activeSceneId: string | null
  /** Limites articulares customizados em vigor (ver DECISOES.md #29) — vazio quando são os padrões do código. */
  jointLimits: JointLimitOverrides
}

export interface RestoredWorkspace {
  workingScene: SceneWorkingState
  scenes: SceneSnapshot[]
  nextSceneSnapshotSeq: number
  activeSceneId: string | null
  /** Limites customizados restaurados — já aplicados ao `skeleton.ts` antes das poses serem lidas. */
  jointLimits: JointLimitOverrides
}

function snapshotDataToExtras(data: SceneSnapshotData): Record<string, unknown> {
  return sceneToExtras({ name: '', ...data }) as unknown as Record<string, unknown>
}

function extrasToSnapshotData(extras: unknown): SceneSnapshotData {
  const scene = sceneFromExtras(extras)
  return {
    figures: scene.figures,
    nextFigureSeq: scene.nextFigureSeq,
    environment: scene.environment,
    cameraBookmarks: scene.cameraBookmarks,
    nextCameraBookmarkSeq: scene.nextCameraBookmarkSeq,
    nextKeyframeNumber: scene.nextKeyframeNumber,
  }
}

export function saveWorkspaceToLocalStorage(state: WorkspaceState): void {
  if (typeof localStorage === 'undefined') return

  const payload = {
    version: 1,
    workingScene: sceneToExtras({
      name: state.sceneName,
      figures: state.figures,
      nextFigureSeq: state.nextFigureSeq,
      environment: state.environment,
      cameraBookmarks: state.cameraBookmarks,
      nextCameraBookmarkSeq: state.nextCameraBookmarkSeq,
      nextKeyframeNumber: state.nextKeyframeNumber,
    }),
    scenes: state.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      data: snapshotDataToExtras(scene.data),
    })),
    nextSceneSnapshotSeq: state.nextSceneSnapshotSeq,
    activeSceneId: state.activeSceneId,
    jointLimits: state.jointLimits,
  }

  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload))
  } catch {
    // Quota excedida ou localStorage indisponível (ex.: modo privado) —
    // autosave é "melhor esforço", não deve quebrar a aplicação.
  }
}

export function loadWorkspaceFromLocalStorage(): RestoredWorkspace | null {
  if (typeof localStorage === 'undefined') return null

  let raw: string | null
  try {
    raw = localStorage.getItem(AUTOSAVE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const source = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>

  // Limites ANTES das cenas: é ao reconstruir as poses que o clamp acontece
  // (`sceneFromExtras` → `figureFromExtras`), então os limites customizados
  // precisam já estar valendo — mesma ordem de `workspaceFolder.ts`.
  const jointLimits = setJointLimitOverrides(source.jointLimits)

  const workingScene = sceneFromExtras(source.workingScene)

  const scenesSource = Array.isArray(source.scenes) ? source.scenes : []
  const scenes: SceneSnapshot[] = scenesSource.map((entry, index) => {
    const entrySource = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>
    return {
      id: typeof entrySource.id === 'string' ? entrySource.id : `scene-${index + 1}`,
      name: typeof entrySource.name === 'string' ? entrySource.name : `Cena ${index + 1}`,
      data: extrasToSnapshotData(entrySource.data),
    }
  })

  return {
    workingScene,
    scenes,
    nextSceneSnapshotSeq:
      typeof source.nextSceneSnapshotSeq === 'number' ? source.nextSceneSnapshotSeq : scenes.length + 1,
    activeSceneId: typeof source.activeSceneId === 'string' ? source.activeSceneId : null,
    jointLimits,
  }
}
