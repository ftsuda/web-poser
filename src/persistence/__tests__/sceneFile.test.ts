import { describe, expect, it } from 'vitest'
import type { CameraBookmark, Figure } from '../../store/figuresStore'
import {
  SceneFileError,
  parseCameraBookmarksFile,
  parseSceneFile,
  serializeCameraBookmarksFile,
  serializeSceneFile,
} from '../sceneFile'
import type { SceneWorkingState } from '../sceneSerialization'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
import { DEFAULT_LIGHT } from '../../scene/sceneLight'

const figureA: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [0, 0, 0],
  rotation: { x: 0, y: 0, z: 0 },
  pose: { 'shoulder.L': { x: 20, y: 0, z: 0 } },
}

const bookmark: CameraBookmark = {
  id: 'camera-bookmark-1',
  name: 'Plano geral',
  position: [3, 2, 4],
  target: [0, 1, 0],
  projection: 'perspective',
  fov: 50,
  zoom: 1,
}

const scene: SceneWorkingState = {
  name: 'Cena de teste',
  figures: [figureA],
  nextFigureSeq: 2,
  props: [],
  nextPropSeq: 1,
  environment: { background: 'dark', grid: false, ...DEFAULT_LIGHT },
  cameraBookmarks: [bookmark],
  nextCameraBookmarkSeq: 2,
  nextSnapshotNumber: 3,
  sceneCamera: { position: [2, 1.6, 3], target: [0, 0.9, 0], up: [0, 1, 0], focalMm: 50 },
}

describe('sceneFile — cena completa', () => {
  it('exporta e reimporta uma cena completa preservando bonecos, ambiente, bookmarks e contadores', () => {
    expect(parseSceneFile(serializeSceneFile(scene))).toEqual(scene)
  })

  it('exporta uma cena vazia sem lançar erro', () => {
    const empty: SceneWorkingState = {
      name: 'Vazia',
      figures: [],
      nextFigureSeq: 1,
      props: [],
      nextPropSeq: 1,
      environment: { background: 'medium', grid: true, ...DEFAULT_LIGHT },
      cameraBookmarks: [],
      nextCameraBookmarkSeq: 1,
      nextSnapshotNumber: 1,
      sceneCamera: DEFAULT_SCENE_CAMERA,
    }
    expect(parseSceneFile(serializeSceneFile(empty))).toEqual(empty)
  })

  it('o arquivo abre no editor identificando-se: `version` e `leiame` antes do conteúdo', () => {
    const keys = Object.keys(JSON.parse(serializeSceneFile(scene)) as Record<string, unknown>)
    expect(keys.slice(0, 2)).toEqual(['version', 'leiame'])
  })
})

describe('sceneFile — conjunto de bookmarks de câmera', () => {
  it('exporta e reimporta bookmarks de câmera sem depender de bonecos/ambiente', () => {
    expect(parseCameraBookmarksFile(serializeCameraBookmarksFile([bookmark]))).toEqual([bookmark])
  })

  it('aceita um arquivo de cena inteiro como fonte de bookmarks', () => {
    expect(parseCameraBookmarksFile(serializeSceneFile(scene))).toEqual([bookmark])
  })
})

describe('sceneFile — erro de importação visível (fase 9, item 4)', () => {
  it('rejeita um texto que não é JSON com reason "unreadable"', () => {
    expect(() => parseSceneFile('isto não é json')).toThrow(SceneFileError)
    expect(() => parseSceneFile('isto não é json')).toThrow(expect.objectContaining({ reason: 'unreadable' }))
  })

  it('rejeita um JSON válido de outra origem com reason "missingAppData"', () => {
    // Um JSON legítimo, mas que não é nosso — antes de existir esta checagem,
    // isso substituía a cena por uma vazia sem nenhum aviso.
    const alheio = JSON.stringify({ scene: 'de outro programa', objects: [] })

    for (const parse of [parseSceneFile, parseCameraBookmarksFile]) {
      expect(() => parse(alheio)).toThrow(expect.objectContaining({ reason: 'missingAppData' }))
    }
  })

  it('continua importando normalmente um arquivo válido do app', () => {
    expect(parseSceneFile(serializeSceneFile(scene))).toMatchObject({ name: scene.name })
  })
})
