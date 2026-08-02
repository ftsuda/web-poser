// PRIMEIRO import de propósito: `shellChoice` é módulo-folha e precisa estar
// inicializado quando o ciclo autosave → poseLibrary → figureFormat →
// figuresStore chama `loadWorkspaceFromLocalStorage` no meio da avaliação —
// é também por isso que as chaves e a resolução moram lá, e aqui só passam.
import { resolveAutosaveKey } from '../poses/shellChoice'
import { sanitizeAnimations, type Animation } from '../animation/animation'
import { sanitizeSavedClips, type SavedClip } from '../animation/clipLibrary'
import { sanitizeJointLocks, type JointLockMap } from '../figure/jointLocks'
import { sanitizeJointPins, type JointPinMap } from '../figure/jointPins'
import { sanitizeSavedPoses, type SavedPose } from '../figure/poseLibrary'
import { setJointLimitOverrides, type JointLimitOverrides } from '../figure/skeleton'
import type { CameraViewState } from '../scene/cameraMove'
import type { CameraBookmark, EnvironmentSettings, Figure, SceneSnapshot, SceneSnapshotData } from '../store/figuresStore'
import type { SceneProp } from '../props/sceneProp'
import { savedPoseToJson } from './posesFile'
import { sceneFromExtras, sceneToExtras, type SceneWorkingState } from './sceneSerialization'

/**
 * Autosave contínuo do workspace inteiro (cena de trabalho + catálogo de
 * snapshots) em `localStorage` — restaurado automaticamente ao abrir o app,
 * sem diálogo de confirmação (ver PLANO.md > "Workspace: catálogo de
 * cenas"). Reaproveita o mesmo schema de cena usado pelo arquivo `.json`
 * (`sceneToExtras`/`sceneFromExtras`) por desempenho e para não duplicar
 * regras de validação/defaults.
 */

// As chaves e a resolução moram em `shellChoice.ts` (módulo-folha, ver o
// comentário do primeiro import); reexportadas aqui porque autosave é onde os
// consumidores as procuram.
export { POSES_AUTOSAVE_KEY, WORKSPACE_AUTOSAVE_KEY, resolveAutosaveKey } from '../poses/shellChoice'

export interface WorkspaceState {
  figures: Figure[]
  nextFigureSeq: number
  /** Objetos de cena (item 42) — viajam com a cena de trabalho, como os bonecos. */
  props: SceneProp[]
  nextPropSeq: number
  environment: EnvironmentSettings
  cameraBookmarks: CameraBookmark[]
  nextCameraBookmarkSeq: number
  /** A câmera de cena (fase 11) — viaja com a cena de trabalho, como o ambiente. */
  sceneCamera: CameraViewState
  sceneName: string
  nextSnapshotNumber: number
  scenes: SceneSnapshot[]
  nextSceneSnapshotSeq: number
  activeSceneId: string | null
  /** Limites articulares customizados em vigor (ver DECISOES.md #29) — vazio quando são os padrões do código. */
  jointLimits: JointLimitOverrides
  /** Biblioteca de poses do usuário (ver DECISOES.md #42) — do workspace, não de uma cena. */
  poseLibrary: SavedPose[]
  nextPoseSeq: number
  /** Animações do usuário (ver DECISOES.md #52) — do workspace, como a biblioteca de poses. */
  animations: Animation[]
  nextAnimationSeq: number
  /** Biblioteca de trechos do usuário (item 39) — do workspace, como as duas acima. */
  clipLibrary: SavedClip[]
  nextClipSeq: number
  /**
   * Juntas travadas por boneco (ver DECISOES.md #42). É estado de TRABALHO
   * (decisão do usuário): entra aqui, para sobreviver a recarregar a página, e
   * NÃO entra no arquivo da cena — por isso fica no nível de cima do payload,
   * fora do bloco de cena que o `.json` compartilha.
   */
  jointLocks: JointLockMap
  /** Âncoras de junta por boneco (item 62) — mesmo regime de estado de trabalho das travas. */
  jointPins: JointPinMap
}

export interface RestoredWorkspace {
  workingScene: SceneWorkingState
  scenes: SceneSnapshot[]
  nextSceneSnapshotSeq: number
  activeSceneId: string | null
  /** Limites customizados restaurados — já aplicados ao `skeleton.ts` antes das poses serem lidas. */
  jointLimits: JointLimitOverrides
  poseLibrary: SavedPose[]
  nextPoseSeq: number
  animations: Animation[]
  nextAnimationSeq: number
  clipLibrary: SavedClip[]
  nextClipSeq: number
  jointLocks: JointLockMap
  jointPins: JointPinMap
}

function snapshotDataToExtras(data: SceneSnapshotData): Record<string, unknown> {
  return sceneToExtras({ name: '', ...data }) as unknown as Record<string, unknown>
}

function extrasToSnapshotData(extras: unknown): SceneSnapshotData {
  const scene = sceneFromExtras(extras)
  return {
    figures: scene.figures,
    nextFigureSeq: scene.nextFigureSeq,
    props: scene.props,
    nextPropSeq: scene.nextPropSeq,
    environment: scene.environment,
    cameraBookmarks: scene.cameraBookmarks,
    nextCameraBookmarkSeq: scene.nextCameraBookmarkSeq,
    nextSnapshotNumber: scene.nextSnapshotNumber,
    sceneCamera: scene.sceneCamera,
  }
}

/**
 * Serializa o workspace no JSON do autosave — o MESMO payload que vai para o
 * `localStorage`, exposto à parte para quem transporta a sessão por outro
 * canal (a remessa por QR do item 65 usa este formato, sem formato novo).
 */
export function serializeWorkspacePayload(state: WorkspaceState): string {
  const payload = {
    version: 1,
    workingScene: sceneToExtras({
      name: state.sceneName,
      figures: state.figures,
      nextFigureSeq: state.nextFigureSeq,
      props: state.props,
      nextPropSeq: state.nextPropSeq,
      environment: state.environment,
      cameraBookmarks: state.cameraBookmarks,
      nextCameraBookmarkSeq: state.nextCameraBookmarkSeq,
      nextSnapshotNumber: state.nextSnapshotNumber,
      sceneCamera: state.sceneCamera,
    }),
    scenes: state.scenes.map((scene) => ({
      id: scene.id,
      name: scene.name,
      data: snapshotDataToExtras(scene.data),
    })),
    nextSceneSnapshotSeq: state.nextSceneSnapshotSeq,
    activeSceneId: state.activeSceneId,
    jointLimits: state.jointLimits,
    poseLibrary: state.poseLibrary.map(savedPoseToJson),
    nextPoseSeq: state.nextPoseSeq,
    // As animações vão como estão: `Animation` já é JSON puro (bonecos em
    // objetos simples e a câmera em tuplas), então não há conversão a fazer.
    animations: state.animations,
    nextAnimationSeq: state.nextAnimationSeq,
    // Os trechos também vão como estão: `SavedClip` é JSON puro.
    clipLibrary: state.clipLibrary,
    nextClipSeq: state.nextClipSeq,
    jointLocks: state.jointLocks,
    jointPins: state.jointPins,
  }

  return JSON.stringify(payload)
}

/**
 * Grava o workspace em `localStorage`. Devolve `false` quando a gravação não
 * aconteceu (cota estourada, `localStorage` indisponível) — o autosave
 * continua sendo "melhor esforço" e nunca lança, mas quem chama precisa saber
 * para não exibir "salvo" ao usuário sem ter salvo nada (fase 9, item 2).
 */
export function saveWorkspaceToLocalStorage(
  state: WorkspaceState,
  key: string = resolveAutosaveKey(),
): boolean {
  if (typeof localStorage === 'undefined') return false

  try {
    localStorage.setItem(key, serializeWorkspacePayload(state))
    return true
  } catch {
    // Quota excedida ou localStorage indisponível (ex.: modo privado) —
    // autosave é "melhor esforço", não deve quebrar a aplicação.
    return false
  }
}

/**
 * Lê o payload do autosave de volta num `RestoredWorkspace`, com a mesma
 * sanitização de sempre — `localStorage`, QR ou qualquer outro transporte é
 * entrada não confiável do mesmo jeito. Devolve `null` se o JSON não parseia.
 *
 * Efeito colateral consciente: instala os limites articulares customizados
 * (`setJointLimitOverrides`) ANTES de reconstruir as cenas — é ao reconstruir
 * as poses que o clamp acontece, mesma ordem de `workspaceFolder.ts`.
 */
export function parseWorkspacePayload(raw: string): RestoredWorkspace | null {
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

  // A biblioteca passa pela MESMA sanitização do arquivo da pasta (juntas
  // desconhecidas fora, ângulos grampeados pelos limites que acabaram de ser
  // instalados) — `localStorage` é entrada não confiável como qualquer outra.
  const poseLibrary = sanitizeSavedPoses(source.poseLibrary)
  const animations = sanitizeAnimations(source.animations)
  const clipLibrary = sanitizeSavedClips(source.clipLibrary)

  return {
    workingScene,
    scenes,
    nextSceneSnapshotSeq:
      typeof source.nextSceneSnapshotSeq === 'number' ? source.nextSceneSnapshotSeq : scenes.length + 1,
    activeSceneId: typeof source.activeSceneId === 'string' ? source.activeSceneId : null,
    jointLimits,
    poseLibrary,
    nextPoseSeq:
      typeof source.nextPoseSeq === 'number' ? source.nextPoseSeq : poseLibrary.length + 1,
    animations,
    nextAnimationSeq:
      typeof source.nextAnimationSeq === 'number' ? source.nextAnimationSeq : animations.length + 1,
    clipLibrary,
    nextClipSeq: typeof source.nextClipSeq === 'number' ? source.nextClipSeq : clipLibrary.length + 1,
    jointLocks: sanitizeJointLocks(source.jointLocks),
    jointPins: sanitizeJointPins(source.jointPins),
  }
}

export function loadWorkspaceFromLocalStorage(
  key: string = resolveAutosaveKey(),
): RestoredWorkspace | null {
  if (typeof localStorage === 'undefined') return null

  let raw: string | null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return null
  }
  if (!raw) return null

  return parseWorkspacePayload(raw)
}
