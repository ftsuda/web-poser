import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
import type { SceneSnapshot } from '../../store/figuresStore'
import { WORKSPACE_MANIFEST_VERSION, buildWorkspaceManifest, parseWorkspaceManifest } from '../workspaceManifest'

const emptyData = {
  figures: [],
  nextFigureSeq: 1,
  props: [],
  nextPropSeq: 1,
  environment: { background: 'medium' as const, grid: true },
  cameraBookmarks: [],
  nextCameraBookmarkSeq: 1,
  nextSnapshotNumber: 1,
  sceneCamera: DEFAULT_SCENE_CAMERA,
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

  /**
   * Manifestos gravados antes de cada arquivo auxiliar existir não têm o campo
   * correspondente — o nome padrão vale, e se o arquivo também não estiver na
   * pasta a aplicação segue sem ele (limites padrão, biblioteca vazia).
   */
  it('assume os nomes padrão dos arquivos auxiliares em manifestos antigos', () => {
    const restored = parseWorkspaceManifest({ scenes: [] })
    expect(restored.jointLimitsFile).toBe('joint-limits.json')
    expect(restored.posesFile).toBe('poses.json')
    expect(restored.animationsFile).toBe('animations.json')
    expect(restored.clipsFile).toBe('clips.json')
  })

  it('respeita nomes de arquivo auxiliares customizados', () => {
    const restored = parseWorkspaceManifest({
      scenes: [],
      posesFile: 'minhas-poses.json',
      clipsFile: 'meus-trechos.json',
    })
    expect(restored.posesFile).toBe('minhas-poses.json')
    expect(restored.clipsFile).toBe('meus-trechos.json')
  })

  it('não lança erro com entrada completamente inválida', () => {
    expect(() => parseWorkspaceManifest(null)).not.toThrow()
    expect(() => parseWorkspaceManifest('texto qualquer')).not.toThrow()
  })
})
