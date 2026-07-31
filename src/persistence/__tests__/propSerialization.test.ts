import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENE_CAMERA } from '../../scene/cameraMove'
import { controlPointCount } from '../../props/propGeometry'
import { DEFAULT_PROP_COLOR, DEFAULT_PROP_SIZE, type SceneProp } from '../../props/sceneProp'
import { parseSceneFile, serializeSceneFile } from '../sceneFile'
import { propFromExtras, propToExtras, sceneFromExtras, sceneToExtras, type SceneWorkingState } from '../sceneSerialization'

function makeProp(overrides: Partial<SceneProp> = {}): SceneProp {
  return {
    id: 'prop-1',
    name: 'Caixa',
    shape: 'box',
    color: '#336699',
    visible: true,
    hiddenInEditor: false,
    locked: false,
    position: [1, 0.25, -2],
    rotation: { x: 0, y: 30, z: 0 },
    size: [0.5, 0.5, 0.5],
    vertexOffsets: {},
    ...overrides,
  }
}

function makeScene(props: SceneProp[]): SceneWorkingState {
  return {
    name: 'Cena com objetos',
    figures: [],
    nextFigureSeq: 1,
    props,
    nextPropSeq: props.length + 1,
    environment: { background: 'medium', grid: true },
    cameraBookmarks: [],
    nextCameraBookmarkSeq: 1,
    nextSnapshotNumber: 1,
    sceneCamera: DEFAULT_SCENE_CAMERA,
  }
}

describe('serialização de objetos de cena', () => {
  it('ida e volta preserva tudo o que define o objeto', () => {
    const prop = makeProp({ vertexOffsets: { 2: [0.1, -0.2, 0.3] }, locked: true, hiddenInEditor: true })
    const restored = propFromExtras(propToExtras(prop), 0)
    expect(restored).toEqual(prop)
  })

  it('objeto intacto não grava a chave de vértices', () => {
    expect(propToExtras(makeProp()).vertices).toBeUndefined()
  })

  it('a cena inteira faz a volta pelo bloco de extras', () => {
    const scene = makeScene([makeProp(), makeProp({ id: 'prop-2', shape: 'ramp', name: 'Rampa' })])
    const restored = sceneFromExtras(sceneToExtras(scene))

    expect(restored.props).toHaveLength(2)
    expect(restored.props[1].shape).toBe('ramp')
    expect(restored.nextPropSeq).toBe(3)
  })

  describe('campo aditivo: arquivos gravados antes do item 42', () => {
    it('cena sem o campo `props` abre com a lista vazia, e não quebra', () => {
      const scene = sceneToExtras(makeScene([])) as unknown as Record<string, unknown>
      delete scene.props
      delete scene.nextPropSeq

      const restored = sceneFromExtras(scene)
      expect(restored.props).toEqual([])
      expect(restored.nextPropSeq).toBe(1)
    })
  })

  describe('leitura de dado não confiável', () => {
    it('forma desconhecida vira caixa, sem sumir com o objeto', () => {
      const restored = propFromExtras({ id: 'prop-9', shape: 'dodecaedro' }, 0)
      expect(restored.shape).toBe('box')
      expect(restored.size).toEqual([...DEFAULT_PROP_SIZE.box])
    })

    it('cor ilegível cai no cinza padrão', () => {
      expect(propFromExtras({ color: 'rgb(1,2,3)' }, 0).color).toBe(DEFAULT_PROP_COLOR)
    })

    it('desvio de vértice fora da forma é descartado', () => {
      const restored = propFromExtras(
        { shape: 'box', vertices: { 1: [0.1, 0, 0], 400: [9, 9, 9] } },
        0,
      )
      expect(Object.keys(restored.vertexOffsets)).toEqual(['1'])
      expect(controlPointCount('box')).toBe(8)
    })

    it('tamanho absurdo é grampeado, não propagado para a geometria', () => {
      expect(propFromExtras({ shape: 'box', size: [0, 1e9, NaN] }, 0).size).toEqual([0.01, 20, 0.5])
    })

    it('objeto sem as chaves novas chega destravado e visível na bancada', () => {
      const restored = propFromExtras({ id: 'prop-1', shape: 'cone' }, 0)
      expect(restored.locked).toBe(false)
      expect(restored.hiddenInEditor).toBe(false)
      expect(restored.visible).toBe(true)
    })
  })

  describe('arquivo de cena', () => {
    it('o objeto sai no arquivo e volta com forma, desvios e nome', () => {
      const scene = makeScene([makeProp({ vertexOffsets: { 0: [0.2, 0, 0] } })])
      const restored = parseSceneFile(serializeSceneFile(scene))

      expect(restored.props).toHaveLength(1)
      expect(restored.props[0].vertexOffsets).toEqual({ 0: [0.2, 0, 0] })
      expect(restored.props[0].name).toBe('Caixa')
    })

    it('"oculto na bancada" e "travado" viajam no arquivo, e não são o mesmo que invisível', () => {
      const scene = makeScene([makeProp({ hiddenInEditor: true, locked: true, visible: false })])
      const restored = parseSceneFile(serializeSceneFile(scene))

      expect(restored.props[0]).toMatchObject({ hiddenInEditor: true, locked: true, visible: false })
    })
  })
})
