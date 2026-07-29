import { describe, expect, it } from 'vitest'
import type { CameraBookmark, Figure } from '../../store/figuresStore'
import { exportObjectsToGlb } from '../gltfIO'
import {
  SceneFileError,
  exportCameraBookmarksToGlb,
  exportFigureToGlb,
  exportSceneToGlb,
  importCameraBookmarksFromGlb,
  importFigureFromGlb,
  importSceneFromGlb,
} from '../sceneFile'
import type { SceneWorkingState } from '../sceneSerialization'

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
  environment: { background: 'dark', grid: false },
  cameraBookmarks: [bookmark],
  nextCameraBookmarkSeq: 2,
  nextSnapshotNumber: 3,
}

describe('sceneFile — cena completa', () => {
  it('exporta e reimporta uma cena completa preservando bonecos, ambiente, bookmarks e contadores', async () => {
    const glb = await exportSceneToGlb(scene)
    expect(glb.byteLength).toBeGreaterThan(0)

    const restored = await importSceneFromGlb(glb)
    expect(restored).toEqual(scene)
  })

  it('exporta uma cena vazia sem lançar erro', async () => {
    const empty: SceneWorkingState = {
      name: 'Vazia',
      figures: [],
      nextFigureSeq: 1,
      environment: { background: 'medium', grid: true },
      cameraBookmarks: [],
      nextCameraBookmarkSeq: 1,
      nextSnapshotNumber: 1,
    }
    const glb = await exportSceneToGlb(empty)
    const restored = await importSceneFromGlb(glb)
    expect(restored).toEqual(empty)
  })
})

describe('sceneFile — boneco individual', () => {
  it('exporta um único boneco e reimporta com pose/altura/cor preservadas, sem dados de cena', async () => {
    const glb = await exportFigureToGlb(figureA)
    const restored = await importFigureFromGlb(glb)
    expect(restored).toEqual(figureA)
  })
})

describe('sceneFile — conjunto de bookmarks de câmera', () => {
  it('exporta e reimporta bookmarks de câmera sem depender de bonecos/ambiente', async () => {
    const glb = await exportCameraBookmarksToGlb([bookmark])
    const restored = await importCameraBookmarksFromGlb(glb)
    expect(restored).toEqual([bookmark])
  })

  it('inclui uma câmera glTF por bookmark exportado', async () => {
    const glb = await exportCameraBookmarksToGlb([bookmark])
    const { importGlb } = await import('../gltfIO')
    const imported = await importGlb(glb)
    let cameraCount = 0
    imported.scene.traverse((object) => {
      if ((object as { isCamera?: boolean }).isCamera) cameraCount += 1
    })
    expect(cameraCount).toBe(1)
  })
})

describe('sceneFile — erro de importação visível (fase 9, item 4)', () => {
  it('rejeita bytes que não são um .glb com reason "unreadable"', async () => {
    const garbage = new TextEncoder().encode('isto não é um glb').buffer as ArrayBuffer

    await expect(importSceneFromGlb(garbage)).rejects.toBeInstanceOf(SceneFileError)
    await expect(importSceneFromGlb(garbage)).rejects.toMatchObject({ reason: 'unreadable' })
  })

  it('rejeita um .glb válido sem o bloco de dados do app com reason "missingAppData"', async () => {
    // Um `.glb` legítimo (o Blender reexporta assim quando as custom
    // properties não viajam) — antes, isso substituía a cena por uma vazia
    // sem nenhum aviso.
    const glb = await exportObjectsToGlb([], {})

    await expect(importSceneFromGlb(glb)).rejects.toMatchObject({ reason: 'missingAppData' })
    await expect(importFigureFromGlb(glb)).rejects.toMatchObject({ reason: 'missingAppData' })
    await expect(importCameraBookmarksFromGlb(glb)).rejects.toMatchObject({ reason: 'missingAppData' })
  })

  it('continua importando normalmente um arquivo válido do app', async () => {
    const glb = await exportSceneToGlb(scene)
    await expect(importSceneFromGlb(glb)).resolves.toMatchObject({ name: scene.name })
  })
})
