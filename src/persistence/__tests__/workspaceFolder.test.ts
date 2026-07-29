import { describe, expect, it, vi } from 'vitest'
import type { SavedPose } from '../../figure/poseLibrary'
import { getJoint, getJointLimitOverrides, setJointLimitOverrides } from '../../figure/skeleton'
import type { Figure, SceneSnapshot } from '../../store/figuresStore'
import { JOINT_LIMITS_FILENAME, buildJointLimitsFile } from '../jointLimitsFile'
import { POSES_FILENAME, buildPosesFile } from '../posesFile'
import { exportSceneToGlb } from '../sceneFile'
import { WORKSPACE_MANIFEST_FILENAME, buildWorkspaceManifest } from '../workspaceManifest'
import { loadWorkspaceFromDirectory, loadWorkspaceFromFiles, saveWorkspaceToDirectory } from '../workspaceFolder'

const emptyData = {
  figures: [],
  nextFigureSeq: 1,
  environment: { background: 'medium' as const, grid: true },
  cameraBookmarks: [],
  nextCameraBookmarkSeq: 1,
  nextSnapshotNumber: 1,
}

const scenes: SceneSnapshot[] = [
  { id: 'scene-1', name: 'Cena A', data: emptyData },
  { id: 'scene-2', name: 'Cena B', data: emptyData },
]

/** Handle de diretório falso o bastante para os testes: grava em um Map em memória. */
function createFakeDirectory() {
  const files = new Map<string, Blob | string>()

  const directoryHandle = {
    getFileHandle: vi.fn(async (name: string, options?: { create?: boolean }) => {
      if (!options?.create && !files.has(name)) {
        throw new DOMException('Not found', 'NotFoundError')
      }
      return {
        createWritable: async () => ({
          write: async (data: Blob | string) => {
            files.set(name, data)
          },
          close: async () => {},
        }),
        getFile: async () => {
          const content = files.get(name)
          if (content === undefined) throw new DOMException('Not found', 'NotFoundError')
          return content instanceof Blob ? content : new Blob([content])
        },
      }
    }),
  } as unknown as FileSystemDirectoryHandle

  return { directoryHandle, files }
}

describe('workspaceFolder — salvar/abrir workspace numa pasta (File System Access API)', () => {
  it('grava um .glb por cena e o manifesto workspace.json na pasta', async () => {
    const { directoryHandle, files } = createFakeDirectory()

    await saveWorkspaceToDirectory(directoryHandle, scenes, 'scene-2')

    expect(files.has(WORKSPACE_MANIFEST_FILENAME)).toBe(true)
    const manifest = buildWorkspaceManifest(scenes, 'scene-2')
    for (const entry of manifest.scenes) {
      expect(files.has(entry.filename)).toBe(true)
    }
  })

  it('faz o round-trip completo: salva numa pasta falsa e recarrega de volta', async () => {
    const { directoryHandle } = createFakeDirectory()
    await saveWorkspaceToDirectory(directoryHandle, scenes, 'scene-1')

    const loaded = await loadWorkspaceFromDirectory(directoryHandle)

    expect(loaded.activeSceneId).toBe('scene-1')
    expect(loaded.scenes).toHaveLength(2)
    expect(loaded.scenes.map((s) => s.name).sort()).toEqual(['Cena A', 'Cena B'])
    expect(loaded.scenes[0].data.environment).toEqual(emptyData.environment)
  })
})

describe('workspaceFolder — fallback sem File System Access API (seleção manual de múltiplos arquivos)', () => {
  it('reconstrói o workspace a partir do workspace.json e dos .glb selecionados juntos', async () => {
    const manifest = buildWorkspaceManifest(scenes, 'scene-1')
    const manifestFile = new File([JSON.stringify(manifest)], WORKSPACE_MANIFEST_FILENAME, {
      type: 'application/json',
    })
    const glbFiles = await Promise.all(
      manifest.scenes.map(async (entry) => {
        const scene = scenes.find((s) => s.id === entry.id)!
        const glb = await exportSceneToGlb({ name: scene.name, ...scene.data })
        return new File([glb], entry.filename, { type: 'model/gltf-binary' })
      }),
    )

    const loaded = await loadWorkspaceFromFiles([manifestFile, ...glbFiles])

    expect(loaded).not.toBeNull()
    expect(loaded!.activeSceneId).toBe('scene-1')
    expect(loaded!.scenes).toHaveLength(2)
  })

  it('retorna null quando os arquivos selecionados não incluem o workspace.json', async () => {
    const loaded = await loadWorkspaceFromFiles([new File(['x'], 'algo.glb')])
    expect(loaded).toBeNull()
  })

  it('ignora entradas do manifesto cujo arquivo .glb não foi selecionado', async () => {
    const manifest = buildWorkspaceManifest(scenes, null)
    const manifestFile = new File([JSON.stringify(manifest)], WORKSPACE_MANIFEST_FILENAME)

    const loaded = await loadWorkspaceFromFiles([manifestFile])
    expect(loaded?.scenes).toEqual([])
  })

  it('aplica o joint-limits.json quando ele está entre os arquivos selecionados', async () => {
    const manifest = buildWorkspaceManifest(scenes, null)
    const files = [
      new File([JSON.stringify(manifest)], WORKSPACE_MANIFEST_FILENAME),
      new File([JSON.stringify(narrowedKneeLimitsFile())], JOINT_LIMITS_FILENAME),
    ]

    const loaded = await loadWorkspaceFromFiles(files)

    expect(loaded?.jointLimits).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
    expect(getJoint('knee.L').limits.x).toEqual({ min: 0, max: 45 })
  })
})

/** Cena com o joelho dobrado no máximo permitido pelo padrão do código (150°). */
const figureWithBentKnee: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [0, 0, 0],
  rotation: { x: 0, y: 0, z: 0 },
  pose: { 'knee.L': { x: 150, y: 0, z: 0 } },
}

const scenesWithPose: SceneSnapshot[] = [
  { id: 'scene-1', name: 'Cena A', data: { ...emptyData, figures: [figureWithBentKnee] } },
]

/** Mesmo arquivo que a aplicação grava, com uma única faixa apertada à mão. */
function narrowedKneeLimitsFile() {
  const file = buildJointLimitsFile()
  file.joints['knee.L'] = { x: { min: 0, max: 45 } }
  return file
}

describe('workspaceFolder — limites articulares customizados (DECISOES.md #29)', () => {
  it('grava o joint-limits.json com os padrões do código junto com o manifesto', async () => {
    const { directoryHandle, files } = createFakeDirectory()

    await saveWorkspaceToDirectory(directoryHandle, scenes, null)

    const written = JSON.parse(String(files.get(JOINT_LIMITS_FILENAME)))
    expect(written.joints['knee.L']).toEqual({ x: { min: 0, max: 150 } })
    expect(JSON.parse(String(files.get(WORKSPACE_MANIFEST_FILENAME))).jointLimitsFile).toBe(JOINT_LIMITS_FILENAME)
  })

  it('aplica os limites do arquivo e ajusta as poses salvas que ficaram fora da faixa', async () => {
    const { directoryHandle, files } = createFakeDirectory()
    await saveWorkspaceToDirectory(directoryHandle, scenesWithPose, 'scene-1')
    files.set(JOINT_LIMITS_FILENAME, JSON.stringify(narrowedKneeLimitsFile()))

    const loaded = await loadWorkspaceFromDirectory(directoryHandle)

    expect(loaded.jointLimits).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
    expect(getJoint('knee.L').limits.x).toEqual({ min: 0, max: 45 })
    expect(loaded.scenes[0].data.figures[0].pose['knee.L'].x).toBe(45)
  })

  it('volta aos padrões do código ao abrir uma pasta sem joint-limits.json', async () => {
    const { directoryHandle, files } = createFakeDirectory()
    await saveWorkspaceToDirectory(directoryHandle, scenesWithPose, 'scene-1')
    files.delete(JOINT_LIMITS_FILENAME)
    setJointLimitOverrides({ 'knee.L': { x: { min: 0, max: 45 } } })

    const loaded = await loadWorkspaceFromDirectory(directoryHandle)

    expect(loaded.jointLimits).toEqual({})
    expect(getJointLimitOverrides()).toEqual({})
    expect(loaded.scenes[0].data.figures[0].pose['knee.L'].x).toBe(150)
  })

  it('ignora um joint-limits.json corrompido e mantém os padrões', async () => {
    const { directoryHandle, files } = createFakeDirectory()
    await saveWorkspaceToDirectory(directoryHandle, scenes, null)
    files.set(JOINT_LIMITS_FILENAME, '{ isso não é json')

    const loaded = await loadWorkspaceFromDirectory(directoryHandle)

    expect(loaded.jointLimits).toEqual({})
    expect(getJoint('knee.L').limits.x).toEqual({ min: 0, max: 150 })
  })
})

/**
 * Biblioteca de poses do usuário (DECISOES.md #42): mesmo contrato do arquivo
 * de limites — arquivo próprio, apontado pelo manifesto e sanitizado na
 * leitura. A diferença é que ele não mexe em estado global nenhum: sem
 * arquivo, a biblioteca só fica vazia.
 */
describe('workspaceFolder — biblioteca de poses (DECISOES.md #42)', () => {
  const poses: SavedPose[] = [
    {
      id: 'pose-1',
      name: 'Guarda alta',
      pose: { 'shoulder.L': { x: 10, y: 90, z: 20 } },
      rotation: { x: 0, y: 0, z: 0 },
      groundOffsetM: 0,
      preservesHeading: true,
    },
    {
      id: 'pose-2',
      name: 'Deitado de lado',
      pose: { 'knee.L': { x: 90, y: 0, z: 0 } },
      rotation: { x: -90, y: 0, z: 0 },
      groundOffsetM: -0.79,
      preservesHeading: false,
    },
  ]

  it('grava o poses.json na pasta e o aponta no manifesto', async () => {
    const { directoryHandle, files } = createFakeDirectory()

    await saveWorkspaceToDirectory(directoryHandle, scenes, null, poses)

    const written = JSON.parse(String(files.get(POSES_FILENAME)))
    expect(written.poses).toHaveLength(2)
    expect(written.poses[0].pose['shoulder.L']).toEqual([10, 90, 20])
    expect(JSON.parse(String(files.get(WORKSPACE_MANIFEST_FILENAME))).posesFile).toBe(POSES_FILENAME)
  })

  it('faz o round-trip da biblioteca, com o assentamento da pose deitada', async () => {
    const { directoryHandle } = createFakeDirectory()
    await saveWorkspaceToDirectory(directoryHandle, scenes, null, poses)

    const loaded = await loadWorkspaceFromDirectory(directoryHandle)

    expect(loaded.poses.map((pose) => pose.name)).toEqual(['Guarda alta', 'Deitado de lado'])
    expect(loaded.poses[1].rotation).toEqual({ x: -90, y: 0, z: 0 })
    expect(loaded.poses[1].groundOffsetM).toBeCloseTo(-0.79, 6)
    expect(loaded.poses[1].preservesHeading).toBe(false)
  })

  it('abre normalmente uma pasta sem poses.json (workspaces anteriores ao recurso)', async () => {
    const { directoryHandle, files } = createFakeDirectory()
    await saveWorkspaceToDirectory(directoryHandle, scenes, null, poses)
    files.delete(POSES_FILENAME)

    const loaded = await loadWorkspaceFromDirectory(directoryHandle)

    expect(loaded.poses).toEqual([])
    expect(loaded.scenes).toHaveLength(2)
  })

  it('ignora um poses.json corrompido sem derrubar o resto do workspace', async () => {
    const { directoryHandle, files } = createFakeDirectory()
    await saveWorkspaceToDirectory(directoryHandle, scenes, 'scene-1', poses)
    files.set(POSES_FILENAME, '{ isso não é json')

    const loaded = await loadWorkspaceFromDirectory(directoryHandle)

    expect(loaded.poses).toEqual([])
    expect(loaded.scenes).toHaveLength(2)
    expect(loaded.activeSceneId).toBe('scene-1')
  })

  it('lê a biblioteca também pelo caminho sem File System Access API', async () => {
    const manifest = buildWorkspaceManifest(scenes, null)
    const files = [
      new File([JSON.stringify(manifest)], WORKSPACE_MANIFEST_FILENAME),
      new File([JSON.stringify(buildPosesFile(poses))], POSES_FILENAME),
    ]

    const loaded = await loadWorkspaceFromFiles(files)

    expect(loaded?.poses).toHaveLength(2)
  })
})
