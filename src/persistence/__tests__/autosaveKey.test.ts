import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
import { writeShellOverride } from '../../poses/shellChoice'
import {
  POSES_AUTOSAVE_KEY,
  WORKSPACE_AUTOSAVE_KEY,
  loadWorkspaceFromLocalStorage,
  resolveAutosaveKey,
  saveWorkspaceToLocalStorage,
  type WorkspaceState,
} from '../autosave'

function emptyWorkspace(sceneName: string): WorkspaceState {
  return {
    figures: [],
    nextFigureSeq: 1,
    props: [],
    nextPropSeq: 1,
    environment: { background: 'medium', grid: true },
    cameraBookmarks: [],
    nextCameraBookmarkSeq: 1,
    sceneCamera: DEFAULT_SCENE_CAMERA,
    sceneName,
    nextSnapshotNumber: 1,
    scenes: [],
    nextSceneSnapshotSeq: 1,
    activeSceneId: null,
    jointLimits: {},
    poseLibrary: [],
    nextPoseSeq: 1,
    animations: [],
    nextAnimationSeq: 1,
    clipLibrary: [],
    nextClipSeq: 1,
    jointLocks: {},
    jointPins: {},
  }
}

afterEach(() => {
  localStorage.clear()
})

describe('sessão própria do módulo de poses (chave de autosave)', () => {
  it('as duas chaves são distintas e estáveis (contrato de armazenamento)', () => {
    expect(WORKSPACE_AUTOSAVE_KEY).toBe('webposer:workspace:v1')
    expect(POSES_AUTOSAVE_KEY).toBe('webposer:poses:v1')
  })

  it('gravar na chave do módulo de poses não toca na sessão do desktop, e vice-versa', () => {
    expect(saveWorkspaceToLocalStorage(emptyWorkspace('No celular'), POSES_AUTOSAVE_KEY)).toBe(true)
    expect(localStorage.getItem(WORKSPACE_AUTOSAVE_KEY)).toBeNull()

    expect(saveWorkspaceToLocalStorage(emptyWorkspace('No desktop'), WORKSPACE_AUTOSAVE_KEY)).toBe(true)

    expect(loadWorkspaceFromLocalStorage(POSES_AUTOSAVE_KEY)?.workingScene.name).toBe('No celular')
    expect(loadWorkspaceFromLocalStorage(WORKSPACE_AUTOSAVE_KEY)?.workingScene.name).toBe('No desktop')
  })

  it('sem nada gravado na chave pedida, devolve null', () => {
    expect(loadWorkspaceFromLocalStorage(POSES_AUTOSAVE_KEY)).toBeNull()
  })

  it('a chave ativa segue a casca: desktop por padrão, poses com o override gravado', () => {
    expect(resolveAutosaveKey()).toBe(WORKSPACE_AUTOSAVE_KEY)
    writeShellOverride('poses')
    expect(resolveAutosaveKey()).toBe(POSES_AUTOSAVE_KEY)
  })
})
