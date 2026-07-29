import { beforeEach, describe, expect, it } from 'vitest'
import type { JointLockMap } from '../../figure/jointLocks'
import type { Animation } from '../../animation/animation'
import type { SavedPose } from '../../figure/poseLibrary'
import { getJoint, type JointLimitOverrides } from '../../figure/skeleton'
import type { SceneSnapshot } from '../../store/figuresStore'
import { loadWorkspaceFromLocalStorage, saveWorkspaceToLocalStorage } from '../autosave'

const emptyEnvironment = { background: 'medium' as const, grid: true }

const baseState = {
  figures: [],
  nextFigureSeq: 1,
  environment: emptyEnvironment,
  cameraBookmarks: [],
  nextCameraBookmarkSeq: 1,
  sceneName: 'Cena 1',
  nextSnapshotNumber: 1,
  scenes: [] as SceneSnapshot[],
  nextSceneSnapshotSeq: 1,
  activeSceneId: null as string | null,
  jointLimits: {} as JointLimitOverrides,
  poseLibrary: [] as SavedPose[],
  nextPoseSeq: 1,
  animations: [] as Animation[],
  nextAnimationSeq: 1,
  clipLibrary: [],
  nextClipSeq: 1,
  jointLocks: {} as JointLockMap,
}

describe('autosave — persistência do workspace em localStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('retorna null quando não há nada salvo ainda', () => {
    expect(loadWorkspaceFromLocalStorage()).toBeNull()
  })

  it('salva e recupera a cena de trabalho e o catálogo de snapshots sem perda', () => {
    const state = {
      ...baseState,
      figures: [
        {
          id: 'figure-1',
          name: 'Boneco 1',
          color: '#e04040',
          visible: true,
          height: 1.75,
          position: [1, 0, 0] as [number, number, number],
          rotation: { x: 0, y: 0, z: 0 },
          pose: { 'shoulder.L': { x: 20, y: 0, z: 0 } },
        },
      ],
      sceneName: 'Cena da praia',
      scenes: [
        {
          id: 'scene-1',
          name: 'Snapshot A',
          data: {
            figures: [],
            nextFigureSeq: 1,
            environment: emptyEnvironment,
            cameraBookmarks: [],
            nextCameraBookmarkSeq: 1,
            nextSnapshotNumber: 4,
          },
        },
      ],
      nextSceneSnapshotSeq: 2,
      activeSceneId: 'scene-1',
    }

    saveWorkspaceToLocalStorage(state)
    const restored = loadWorkspaceFromLocalStorage()

    expect(restored).not.toBeNull()
    expect(restored!.workingScene.name).toBe('Cena da praia')
    expect(restored!.workingScene.figures).toEqual(state.figures)
    expect(restored!.scenes).toEqual(state.scenes)
    expect(restored!.nextSceneSnapshotSeq).toBe(2)
    expect(restored!.activeSceneId).toBe('scene-1')
  })

  /**
   * A animação é do workspace (DECISOES.md #52), então sobrevive a recarregar
   * a página como a biblioteca de poses — e não viaja no `.glb` da cena.
   */
  it('faz o round-trip das animações, com poses, câmera e durações', () => {
    const animations: Animation[] = [
      {
        id: 'animation-1',
        name: 'Corrida',
        speed: 0.5,
        keyframes: [
          {
            id: 'k1',
            durationMs: 1000,
            figures: [
              {
                id: 'figure-1',
                name: 'Boneco 1',
                color: '#e04040',
                visible: true,
                height: 1.7,
                position: [1, 0, -2],
                rotation: { x: 0, y: 30, z: 0 },
                pose: { 'shoulder.L': { x: 10, y: 0, z: -20 } },
              },
            ],
            camera: { position: [0, 1.6, 4], target: [0, 1, 0], up: [0, 1, 0], focalMm: 35 },
          },
        ],
      },
    ]

    saveWorkspaceToLocalStorage({ ...baseState, animations, nextAnimationSeq: 2 })
    const restored = loadWorkspaceFromLocalStorage()

    expect(restored!.animations).toEqual(animations)
    expect(restored!.nextAnimationSeq).toBe(2)
  })

  it('restaura os limites articulares customizados e já os aplica ao ler as poses', () => {
    saveWorkspaceToLocalStorage({
      ...baseState,
      jointLimits: { 'knee.L': { x: { min: 0, max: 45 } } },
      figures: [
        {
          id: 'figure-1',
          name: 'Boneco 1',
          color: '#e04040',
          visible: true,
          height: 1.7,
          position: [0, 0, 0] as [number, number, number],
          rotation: { x: 0, y: 0, z: 0 },
          pose: { 'knee.L': { x: 150, y: 0, z: 0 } },
        },
      ],
    })

    const restored = loadWorkspaceFromLocalStorage()

    expect(restored!.jointLimits).toEqual({ 'knee.L': { x: { min: 0, max: 45 } } })
    expect(getJoint('knee.L').limits.x).toEqual({ min: 0, max: 45 })
    // A pose salva estava em 150° (o máximo do código) — como os limites são
    // aplicados antes da leitura, ela volta já ajustada à faixa customizada.
    expect(restored!.workingScene.figures[0].pose['knee.L'].x).toBe(45)
  })

  it('retorna null (sem lançar erro) quando o conteúdo salvo está corrompido', () => {
    localStorage.setItem('virtual-mockup:workspace:v1', '{ isto não é json válido')
    expect(loadWorkspaceFromLocalStorage()).toBeNull()
  })

  it('aplica defaults quando o JSON salvo é válido mas não tem o formato esperado', () => {
    localStorage.setItem('virtual-mockup:workspace:v1', JSON.stringify({ foo: 'bar' }))
    const restored = loadWorkspaceFromLocalStorage()
    expect(restored?.workingScene.figures).toEqual([])
    expect(restored?.scenes).toEqual([])
    expect(restored?.activeSceneId).toBeNull()
    expect(restored?.poseLibrary).toEqual([])
    expect(restored?.jointLocks).toEqual({})
  })
})

/**
 * Biblioteca de poses e travas de junta no autosave (DECISOES.md #42). As duas
 * ficam no NÍVEL DE CIMA do payload, fora do bloco de `extras` que o `.glb`
 * compartilha: a biblioteca é do workspace (não de uma cena) e a trava é
 * estado de trabalho, que por decisão do usuário não viaja no `.glb`.
 */
describe('autosave — biblioteca de poses e travas de junta', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const poses: SavedPose[] = [
    {
      id: 'pose-3',
      name: 'Guarda alta',
      pose: { 'shoulder.L': { x: 10, y: 90, z: 20 } },
      rotation: { x: 0, y: 0, z: 0 },
      groundOffsetM: 0,
      preservesHeading: true,
    },
    {
      id: 'pose-4',
      name: 'Deitado',
      pose: { 'knee.L': { x: 90, y: 0, z: 0 } },
      rotation: { x: -90, y: 0, z: 0 },
      groundOffsetM: -0.79,
      preservesHeading: false,
    },
  ]

  it('salva e restaura a biblioteca inteira, com o assentamento', () => {
    saveWorkspaceToLocalStorage({ ...baseState, poseLibrary: poses, nextPoseSeq: 5 })

    const restored = loadWorkspaceFromLocalStorage()

    expect(restored!.poseLibrary).toEqual(poses)
    expect(restored!.nextPoseSeq).toBe(5)
  })

  it('salva e restaura as travas de junta', () => {
    saveWorkspaceToLocalStorage({ ...baseState, jointLocks: { 'figure-1': ['elbow.L', 'knee.R'] } })

    expect(loadWorkspaceFromLocalStorage()!.jointLocks).toEqual({ 'figure-1': ['elbow.L', 'knee.R'] })
  })

  it('sanitiza o que veio do localStorage, que é entrada não confiável como qualquer outra', () => {
    localStorage.setItem(
      'virtual-mockup:workspace:v1',
      JSON.stringify({
        poseLibrary: [{ id: 'pose-1', name: 'Inválida', pose: { asaEsquerda: [1, 2, 3] } }, 'nem objeto'],
        jointLocks: { 'figure-1': ['elbow.L', 'root', 'asaEsquerda'], 'figure-2': 'nem lista' },
      }),
    )

    const restored = loadWorkspaceFromLocalStorage()

    expect(restored!.poseLibrary).toEqual([])
    expect(restored!.jointLocks).toEqual({ 'figure-1': ['elbow.L'] })
  })

  it('grampeia as poses da biblioteca pelos limites customizados do próprio workspace', () => {
    saveWorkspaceToLocalStorage({
      ...baseState,
      jointLimits: { 'knee.L': { x: { min: 0, max: 45 } } },
      poseLibrary: [{ ...poses[1], pose: { 'knee.L': { x: 150, y: 0, z: 0 } } }],
    })

    const restored = loadWorkspaceFromLocalStorage()

    expect(restored!.poseLibrary[0].pose['knee.L'].x).toBe(45)
  })

  it('workspaces salvos antes do recurso voltam com biblioteca vazia e sem travas', () => {
    saveWorkspaceToLocalStorage(baseState)
    const raw = JSON.parse(localStorage.getItem('virtual-mockup:workspace:v1')!)
    delete raw.poseLibrary
    delete raw.nextPoseSeq
    delete raw.jointLocks
    localStorage.setItem('virtual-mockup:workspace:v1', JSON.stringify(raw))

    const restored = loadWorkspaceFromLocalStorage()

    expect(restored!.poseLibrary).toEqual([])
    expect(restored!.nextPoseSeq).toBe(1)
    expect(restored!.jointLocks).toEqual({})
  })
})
