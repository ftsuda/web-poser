import { beforeEach, describe, expect, it } from 'vitest'
import type { JointLockMap } from '../../figure/jointLocks'
import type { JointPinMap } from '../../figure/jointPins'
import type { Animation } from '../../animation/animation'
import type { SavedPose } from '../../figure/poseLibrary'
import { getJoint, type JointLimitOverrides } from '../../figure/skeleton'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
import type { SceneSnapshot } from '../../store/figuresStore'
import { loadWorkspaceFromLocalStorage, saveWorkspaceToLocalStorage } from '../autosave'

const emptyEnvironment = { background: 'medium' as const, grid: true }

const baseState = {
  figures: [],
  nextFigureSeq: 1,
  props: [],
  nextPropSeq: 1,
  environment: emptyEnvironment,
  cameraBookmarks: [],
  nextCameraBookmarkSeq: 1,
  sceneCamera: DEFAULT_SCENE_CAMERA,
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
  jointPins: {} as JointPinMap,
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
            props: [],
            nextPropSeq: 1,
            environment: emptyEnvironment,
            cameraBookmarks: [],
            nextCameraBookmarkSeq: 1,
            nextSnapshotNumber: 4,
            sceneCamera: DEFAULT_SCENE_CAMERA,
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
   * a página como a biblioteca de poses — e não viaja no arquivo da cena.
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
    localStorage.setItem('webposer:workspace:v1', '{ isto não é json válido')
    expect(loadWorkspaceFromLocalStorage()).toBeNull()
  })

  it('aplica defaults quando o JSON salvo é válido mas não tem o formato esperado', () => {
    localStorage.setItem('webposer:workspace:v1', JSON.stringify({ foo: 'bar' }))
    const restored = loadWorkspaceFromLocalStorage()
    expect(restored?.workingScene.figures).toEqual([])
    expect(restored?.scenes).toEqual([])
    expect(restored?.activeSceneId).toBeNull()
    expect(restored?.poseLibrary).toEqual([])
    expect(restored?.jointLocks).toEqual({})
  })

  /**
   * O caso de compatibilidade que mais importa (DECISOES.md #86): o autosave
   * gravava o boneco com `joints:[x,y,z]` e a rotação em tupla, e a biblioteca
   * de poses idem. Este é o payload que TODO usuário tem no navegador ao abrir
   * o app pela primeira vez depois da unificação — se ele não for lido, a cena
   * de trabalho volta em T-pose e a biblioteca volta vazia.
   */
  it('restaura um autosave gravado na codificação antiga, sem perder pose nem biblioteca', () => {
    localStorage.setItem(
      'webposer:workspace:v1',
      JSON.stringify({
        version: 1,
        workingScene: {
          version: 1,
          name: 'Cena antiga',
          figures: [
            {
              id: 'figure-1',
              name: 'Boneco 1',
              color: '#e04040',
              visible: true,
              height: 1.75,
              position: [1, 0, 2],
              rotation: [0, 45, 0],
              joints: { 'shoulder.L': [30, 0, 10], 'elbow.L': [-90, 0, 0] },
            },
          ],
        },
        poseLibrary: [
          { id: 'pose-1', name: 'Guarda alta', rotation: [0, 0, 0], groundOffsetM: 0, pose: { 'shoulder.L': [10, 90, 20] } },
        ],
      }),
    )

    const restored = loadWorkspaceFromLocalStorage()
    const figure = restored!.workingScene.figures[0]

    expect(figure.pose['shoulder.L']).toEqual({ x: 30, y: 0, z: 10 })
    expect(figure.pose['elbow.L']).toEqual({ x: -90, y: 0, z: 0 })
    expect(figure.rotation).toEqual({ x: 0, y: 45, z: 0 })
    expect(figure.position).toEqual([1, 0, 2])
    expect(figure.height).toBe(1.75)
    expect(restored!.poseLibrary[0].pose['shoulder.L']).toEqual({ x: 10, y: 90, z: 20 })
    expect(restored!.poseLibrary[0].rotation).toEqual({ x: 0, y: 0, z: 0 })
  })
})

/**
 * Biblioteca de poses e travas de junta no autosave (DECISOES.md #42). As duas
 * ficam no NÍVEL DE CIMA do payload, fora do bloco de cena que o arquivo `.json`
 * compartilha: a biblioteca é do workspace (não de uma cena) e a trava é
 * estado de trabalho, que por decisão do usuário não viaja no arquivo da cena.
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

  it('salva e restaura as travas de junta — inclusive os cadeados de eixo da raiz (item 64)', () => {
    saveWorkspaceToLocalStorage({
      ...baseState,
      jointLocks: { 'figure-1': ['elbow.L', 'knee.R', 'root.y'] },
    })

    expect(loadWorkspaceFromLocalStorage()!.jointLocks).toEqual({
      'figure-1': ['elbow.L', 'knee.R', 'root.y'],
    })
  })

  it('salva e restaura as âncoras de junta (item 62), no mesmo regime das travas', () => {
    saveWorkspaceToLocalStorage({ ...baseState, jointPins: { 'figure-1': ['elbow.L'] } })

    expect(loadWorkspaceFromLocalStorage()!.jointPins).toEqual({ 'figure-1': ['elbow.L'] })
  })

  it('sanitiza o que veio do localStorage, que é entrada não confiável como qualquer outra', () => {
    localStorage.setItem(
      'webposer:workspace:v1',
      JSON.stringify({
        poseLibrary: [{ id: 'pose-1', name: 'Inválida', pose: { asaEsquerda: [1, 2, 3] } }, 'nem objeto'],
        jointLocks: { 'figure-1': ['elbow.L', 'root', 'asaEsquerda'], 'figure-2': 'nem lista' },
        jointPins: { 'figure-1': ['elbow.R', 'root', 'asaDireita'], 'figure-2': 42 },
      }),
    )

    const restored = loadWorkspaceFromLocalStorage()

    expect(restored!.poseLibrary).toEqual([])
    expect(restored!.jointLocks).toEqual({ 'figure-1': ['elbow.L'] })
    expect(restored!.jointPins).toEqual({ 'figure-1': ['elbow.R'] })
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

  it('workspaces salvos antes do recurso voltam com biblioteca vazia, sem travas e sem âncoras', () => {
    saveWorkspaceToLocalStorage(baseState)
    const raw = JSON.parse(localStorage.getItem('webposer:workspace:v1')!)
    delete raw.poseLibrary
    delete raw.nextPoseSeq
    delete raw.jointLocks
    delete raw.jointPins
    localStorage.setItem('webposer:workspace:v1', JSON.stringify(raw))

    const restored = loadWorkspaceFromLocalStorage()

    expect(restored!.poseLibrary).toEqual([])
    expect(restored!.nextPoseSeq).toBe(1)
    expect(restored!.jointLocks).toEqual({})
    expect(restored!.jointPins).toEqual({})
  })
})
