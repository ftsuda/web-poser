import { describe, expect, it } from 'vitest'
import type { SceneSnapshot } from '../../store/figuresStore'
import { WORKSPACE_MANIFEST_VERSION, buildWorkspaceManifest, parseWorkspaceManifest } from '../workspaceManifest'

const emptyData = {
  figures: [],
  nextFigureSeq: 1,
  environment: { background: 'medium' as const, grid: true },
  cameraBookmarks: [],
  nextCameraBookmarkSeq: 1,
  nextKeyframeNumber: 1,
}

const scenes: SceneSnapshot[] = [
  { id: 'scene-1', name: 'Cena da praia', data: emptyData },
  { id: 'scene-2', name: 'Cena da praia', data: emptyData }, // nome duplicado — deve gerar arquivo distinto
]

describe('workspaceManifest — manifesto do workspace em pasta', () => {
  it('gera um manifesto com um nome de arquivo .glb único por cena, mesmo com nomes de cena duplicados', () => {
    const manifest = buildWorkspaceManifest(scenes, 'scene-2')
    expect(manifest.version).toBe(WORKSPACE_MANIFEST_VERSION)
    expect(manifest.activeSceneId).toBe('scene-2')
    expect(manifest.scenes).toHaveLength(2)
    const filenames = manifest.scenes.map((s) => s.filename)
    expect(new Set(filenames).size).toBe(2)
    expect(filenames[0]).toMatch(/\.glb$/)
    expect(filenames[1]).toMatch(/\.glb$/)
  })

  it('faz o round-trip completo (manifesto → JSON → manifesto)', () => {
    const manifest = buildWorkspaceManifest(scenes, 'scene-1')
    const restored = parseWorkspaceManifest(JSON.parse(JSON.stringify(manifest)))
    expect(restored).toEqual(manifest)
  })

  it('aplica defaults quando o JSON não tem o formato esperado', () => {
    const restored = parseWorkspaceManifest({})
    expect(restored.version).toBe(WORKSPACE_MANIFEST_VERSION)
    expect(restored.activeSceneId).toBeNull()
    expect(restored.scenes).toEqual([])
  })

  it('não lança erro com entrada completamente inválida', () => {
    expect(() => parseWorkspaceManifest(null)).not.toThrow()
    expect(() => parseWorkspaceManifest('texto qualquer')).not.toThrow()
  })
})
