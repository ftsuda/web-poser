import { beforeEach, describe, expect, it } from 'vitest'
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
  nextKeyframeNumber: 1,
  scenes: [] as SceneSnapshot[],
  nextSceneSnapshotSeq: 1,
  activeSceneId: null as string | null,
  jointLimits: {} as JointLimitOverrides,
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
            nextKeyframeNumber: 4,
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
  })
})
