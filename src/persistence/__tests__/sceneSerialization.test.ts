import { describe, expect, it } from 'vitest'
import {
  SCENE_EXTRAS_VERSION,
  cameraBookmarkFromExtras,
  cameraBookmarkToExtras,
  figureFromExtras,
  figureToExtras,
  sceneFromExtras,
  sceneToExtras,
  type SceneWorkingState,
} from '../sceneSerialization'
import type { CameraBookmark, Figure } from '../../store/figuresStore'

const sampleFigure: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.75,
  position: [1.2, 0, -0.6],
  rotation: { x: 0, y: 45, z: 0 },
  pose: {
    'shoulder.L': { x: 30, y: 0, z: 10 },
    'elbow.L': { x: -90, y: 0, z: 0 },
  },
}

const sampleBookmark: CameraBookmark = {
  id: 'camera-bookmark-1',
  name: 'Plano geral',
  position: [3, 2, 4],
  target: [0, 1, 0],
  projection: 'perspective',
  fov: 50,
  zoom: 1,
}

const sampleScene: SceneWorkingState = {
  name: 'Cena de teste',
  figures: [sampleFigure],
  nextFigureSeq: 2,
  environment: { background: 'dark', grid: false },
  cameraBookmarks: [sampleBookmark],
  nextCameraBookmarkSeq: 2,
  nextKeyframeNumber: 7,
}

describe('sceneSerialization — figura', () => {
  it('converte uma figura para o formato de extras e de volta sem perda', () => {
    const extras = figureToExtras(sampleFigure)
    expect(extras.joints['shoulder.L']).toEqual([30, 0, 10])
    expect(extras.position).toEqual([1.2, 0, -0.6])

    const restored = figureFromExtras(extras, 0)
    expect(restored).toEqual(sampleFigure)
  })

  it('aplica defaults e grampeamento de skeleton.ts ao reconstruir uma figura de extras não confiáveis', () => {
    const restored = figureFromExtras(
      {
        id: 'figure-9',
        joints: { 'elbow.L': [-999, 0, 0] }, // fora do limite (-150 a 0) — deve ser grampeado
      },
      0,
    )
    expect(restored.pose['elbow.L']).toEqual({ x: -150, y: 0, z: 0 })
    expect(restored.name).toBe('Figure 1')
    expect(restored.color).toBe('#e04040')
    expect(restored.visible).toBe(true)
    expect(restored.height).toBeCloseTo(1.7)
  })

  it('ignora juntas desconhecidas ao reconstruir (não lança erro)', () => {
    const restored = figureFromExtras({ id: 'f1', joints: { juntaInexistente: [1, 2, 3] } }, 0)
    expect(restored.pose.juntaInexistente).toBeUndefined()
  })

  it('grampeia a altura fora do intervalo permitido ao reconstruir', () => {
    const restored = figureFromExtras({ id: 'f1', height: 99 }, 0)
    expect(restored.height).toBe(1.9)
  })

  it('usa um id/nome de fallback quando o extras não é um objeto válido', () => {
    const restored = figureFromExtras(null, 2)
    expect(restored.id).toBe('figure-3')
    expect(restored.name).toBe('Figure 3')
    expect(restored.position).toEqual([0, 0, 0])
  })
})

describe('sceneSerialization — bookmark de câmera', () => {
  it('converte um bookmark para extras e de volta sem perda', () => {
    const extras = cameraBookmarkToExtras(sampleBookmark)
    const restored = cameraBookmarkFromExtras(extras, 0)
    expect(restored).toEqual(sampleBookmark)
  })

  it('cai para "perspective" quando a projeção do extras é inválida/ausente', () => {
    const restored = cameraBookmarkFromExtras({ id: 'b1', projection: 'isometric' }, 0)
    expect(restored.projection).toBe('perspective')
  })
})

describe('sceneSerialization — cena completa', () => {
  it('faz o round-trip completo (cena → extras → cena) preservando todos os campos', () => {
    const extras = sceneToExtras(sampleScene)
    expect(extras.version).toBe(SCENE_EXTRAS_VERSION)
    expect(extras.keyframeCounter).toBe(7)

    const restored = sceneFromExtras(extras)
    expect(restored).toEqual(sampleScene)
  })

  it('aplica defaults completos quando o extras está vazio/corrompido', () => {
    const restored = sceneFromExtras({})
    expect(restored.name).toBe('Cena 1')
    expect(restored.figures).toEqual([])
    expect(restored.nextFigureSeq).toBe(1)
    expect(restored.environment).toEqual({ background: 'medium', grid: true })
    expect(restored.cameraBookmarks).toEqual([])
    expect(restored.nextCameraBookmarkSeq).toBe(1)
    expect(restored.nextKeyframeNumber).toBe(1)
  })

  it('aplica defaults quando o extras é undefined/não-objeto (ex.: .glb sem o bloco do app)', () => {
    const restored = sceneFromExtras(undefined)
    expect(restored.name).toBe('Cena 1')
    expect(restored.figures).toEqual([])
  })

  it('deriva nextFigureSeq/nextCameraBookmarkSeq a partir da contagem quando ausentes no extras', () => {
    const restored = sceneFromExtras({
      figures: [{ id: 'f1' }, { id: 'f2' }],
      cameraBookmarks: [{ id: 'b1' }],
    })
    expect(restored.nextFigureSeq).toBe(3)
    expect(restored.nextCameraBookmarkSeq).toBe(2)
  })
})
