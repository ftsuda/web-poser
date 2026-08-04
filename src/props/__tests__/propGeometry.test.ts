import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  buildPropGeometry,
  controlPointCount,
  controlPointPosition,
  controlPointPositions,
  controlPointsOf,
  propGroundOffset,
} from '../propGeometry'
import {
  DEFAULT_PROP_COLOR,
  DEFAULT_PROP_SIZE,
  PROP_SHAPES,
  clampPropSize,
  propShapeHasFreeVertex,
  sanitizeVertexOffsets,
  vertexOffsetCount,
  withVertexOffset,
  type PropShape,
  type SceneProp,
} from '../sceneProp'

function makeProp(overrides: Partial<SceneProp> = {}): SceneProp {
  const shape = overrides.shape ?? 'box'
  return {
    id: 'prop-1',
    name: 'Objeto 1',
    shape,
    color: DEFAULT_PROP_COLOR,
    visible: true,
    hiddenInEditor: false,
    locked: false,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    size: DEFAULT_PROP_SIZE[shape],
    vertexOffsets: {},
    attachment: null,
    ...overrides,
  }
}

function boundingBox(prop: SceneProp): THREE.Box3 {
  const geometry = buildPropGeometry(prop)
  geometry.computeBoundingBox()
  return geometry.boundingBox as THREE.Box3
}

describe('pontos de controle', () => {
  /**
   * **Trava de contrato de arquivo.** Os desvios de vértice são gravados por
   * ÍNDICE de ponto de controle (`{"3": [0.1, 0, 0]}`); mudar a subdivisão de
   * uma forma faria uma deformação salva reaparecer noutro canto do objeto.
   * Se este teste quebrar, a mudança precisa vir com migração — não com um
   * número novo aqui.
   */
  it('cada forma tem uma contagem FIXA de pontos de controle', () => {
    expect(controlPointCount('box')).toBe(8)
    expect(controlPointCount('plane')).toBe(4)
    expect(controlPointCount('ramp')).toBe(6)
    expect(controlPointCount('cylinder')).toBe(34)
    expect(controlPointCount('cone')).toBe(18)
    expect(controlPointCount('sphere')).toBe(114)
    // Compostas (kit de armas): a contagem existe para MEDIÇÃO (apoiar no
    // chão), não para alças — vértice livre não vale para elas, e desvio
    // gravado é descartado na leitura (`propShapeHasFreeVertex`).
    expect(controlPointCount('sword')).toBe(181)
    expect(controlPointCount('shield')).toBe(119)
    expect(controlPointCount('scabbard')).toBe(34)
  })

  it('a soldagem cobre TODO vértice do buffer, sem sobra nem repetição', () => {
    for (const shape of PROP_SHAPES) {
      const geometry = buildPropGeometry(makeProp({ shape }))
      const total = geometry.getAttribute('position').count
      const claimed = controlPointsOf(shape).flatMap((point) => point.vertices)

      expect(claimed).toHaveLength(total)
      expect(new Set(claimed).size).toBe(total)
    }
  })

  it('a caixa tem um ponto por canto, e cada um solda as 3 cópias de face', () => {
    for (const point of controlPointsOf('box')) {
      expect(point.vertices).toHaveLength(3)
      expect(point.unit.map(Math.abs)).toEqual([0.5, 0.5, 0.5])
    }
  })

  it('a ordem dos pontos não depende do tamanho do objeto', () => {
    // Se dependesse, redimensionar um objeto deformado embaralharia os desvios.
    const small = controlPointPosition('box', [0.1, 0.1, 0.1], {}, 0)
    const large = controlPointPosition('box', [4, 4, 4], {}, 0)
    expect(small.map((v) => Math.sign(v))).toEqual(large.map((v) => Math.sign(v)))
  })
})

describe('formas compostas (kit de armas)', () => {
  it('cada composta cabe na caixa do próprio tamanho em metros', () => {
    for (const shape of ['sword', 'shield', 'scabbard'] as const) {
      const size = DEFAULT_PROP_SIZE[shape]
      const box = boundingBox(makeProp({ shape }))
      expect(box.min.x).toBeGreaterThanOrEqual(-size[0] / 2 - 1e-6)
      expect(box.max.x).toBeLessThanOrEqual(size[0] / 2 + 1e-6)
      expect(box.min.y).toBeGreaterThanOrEqual(-size[1] / 2 - 1e-6)
      expect(box.max.y).toBeLessThanOrEqual(size[1] / 2 + 1e-6)
      expect(box.min.z).toBeGreaterThanOrEqual(-size[2] / 2 - 1e-6)
      expect(box.max.z).toBeLessThanOrEqual(size[2] / 2 + 1e-6)
    }
  })

  it('a espada usa a altura inteira (do pomo à ponta) e apoia no chão pela metade dela', () => {
    const sword = makeProp({ shape: 'sword' })
    const box = boundingBox(sword)
    expect(box.min.y).toBeCloseTo(-DEFAULT_PROP_SIZE.sword[1] / 2, 4)
    expect(box.max.y).toBeCloseTo(DEFAULT_PROP_SIZE.sword[1] / 2, 4)
    expect(propGroundOffset(sword)).toBeCloseTo(DEFAULT_PROP_SIZE.sword[1] / 2, 4)
  })

  it('composta não tem vértice livre; primitiva tem', () => {
    expect(propShapeHasFreeVertex('sword')).toBe(false)
    expect(propShapeHasFreeVertex('shield')).toBe(false)
    expect(propShapeHasFreeVertex('scabbard')).toBe(false)
    expect(propShapeHasFreeVertex('box')).toBe(true)
    expect(propShapeHasFreeVertex('sphere')).toBe(true)
  })

  it('esticar o Y da espada alonga a composição inteira, em metros', () => {
    const stretched = boundingBox(makeProp({ shape: 'sword', size: [0.15, 2.2, 0.03] }))
    expect(stretched.max.y).toBeCloseTo(1.1, 4)
  })
})

describe('buildPropGeometry', () => {
  it('a primitiva sai no TAMANHO EM METROS pedido, centrada na origem', () => {
    const box = boundingBox(makeProp({ size: [2, 0.5, 3] }))
    expect(box.min.toArray()).toEqual([-1, -0.25, -1.5])
    expect(box.max.toArray()).toEqual([1, 0.25, 1.5])
  })

  it('o cilindro fica elíptico quando X e Z diferem', () => {
    const box = boundingBox(makeProp({ shape: 'cylinder', size: [1, 2, 0.4] }))
    expect(box.max.x).toBeCloseTo(0.5, 5)
    expect(box.max.y).toBeCloseTo(1, 5)
    expect(box.max.z).toBeCloseTo(0.2, 5)
  })

  it('o plano ignora o eixo Z — é uma folha, não um volume', () => {
    const box = boundingBox(makeProp({ shape: 'plane', size: [2, 1, 5] }))
    expect(box.min.z).toBe(0)
    expect(box.max.z).toBe(0)
  })

  it('a rampa sobe do fundo (−Z) até a face da frente (+Z)', () => {
    const geometry = buildPropGeometry(makeProp({ shape: 'ramp', size: [1, 1, 1] }))
    const position = geometry.getAttribute('position')

    // No fundo o prisma tem só a aresta de baixo; na frente, a face inteira.
    let backTop = -Infinity
    let frontTop = -Infinity
    for (let index = 0; index < position.count; index += 1) {
      if (position.getZ(index) < 0) backTop = Math.max(backTop, position.getY(index))
      else frontTop = Math.max(frontTop, position.getY(index))
    }

    expect(backTop).toBeCloseTo(-0.5, 5)
    expect(frontTop).toBeCloseTo(0.5, 5)
  })

  it('mover um ponto de controle move TODAS as cópias juntas — a malha não rasga', () => {
    const moved = makeProp({ size: [1, 1, 1], vertexOffsets: { 0: [0.5, 0, 0] } })
    const geometry = buildPropGeometry(moved)
    const position = geometry.getAttribute('position')
    const target = controlPointPosition('box', [1, 1, 1], moved.vertexOffsets, 0)

    let atTarget = 0
    for (let index = 0; index < position.count; index += 1) {
      const distance = Math.hypot(
        position.getX(index) - target[0],
        position.getY(index) - target[1],
        position.getZ(index) - target[2],
      )
      if (distance < 1e-6) atTarget += 1
    }

    expect(atTarget).toBe(controlPointsOf('box')[0].vertices.length)
  })

  it('o desvio é em METROS ABSOLUTOS: redimensionar não o multiplica', () => {
    const offsets = { 0: [0.25, 0, 0] as const }
    const corner = controlPointsOf('box')[0].unit[0]
    const small = controlPointPosition('box', [1, 1, 1], offsets, 0)
    const large = controlPointPosition('box', [2, 1, 1], offsets, 0)

    // A primitiva dobra de largura; o desvio continua valendo 0,25 m.
    expect(small[0]).toBeCloseTo(corner + 0.25, 6)
    expect(large[0]).toBeCloseTo(corner * 2 + 0.25, 6)
  })

  it('as normais são recalculadas depois da deformação', () => {
    const flat = buildPropGeometry(makeProp({ size: [1, 1, 1] }))
    const bent = buildPropGeometry(makeProp({ size: [1, 1, 1], vertexOffsets: { 0: [0, 2, 0] } }))

    const before = flat.getAttribute('normal')
    const after = bent.getAttribute('normal')
    let changed = false
    for (let index = 0; index < before.count && !changed; index += 1) {
      if (Math.abs(before.getY(index) - after.getY(index)) > 1e-3) changed = true
    }

    expect(changed).toBe(true)
  })

  it('cada objeto recebe uma geometria PRÓPRIA — deformar um não deforma o outro', () => {
    const first = buildPropGeometry(makeProp({ size: [1, 1, 1], vertexOffsets: { 0: [3, 0, 0] } }))
    const second = buildPropGeometry(makeProp({ size: [1, 1, 1] }))

    first.computeBoundingBox()
    second.computeBoundingBox()
    expect(first.boundingBox?.max.x).toBeCloseTo(controlPointsOf('box')[0].unit[0] + 3, 5)
    expect(second.boundingBox?.max.x).toBeCloseTo(0.5, 5)
  })
})

describe('propGroundOffset', () => {
  it('sem rotação, apoia metade da altura acima do chão', () => {
    expect(propGroundOffset(makeProp({ size: [1, 0.5, 1] }))).toBeCloseTo(0.25, 6)
  })

  it('com o cubo girado 45°, sobe até a diagonal tocar o chão', () => {
    const rotated = makeProp({ size: [1, 1, 1], rotation: { x: 0, y: 0, z: 45 } })
    expect(propGroundOffset(rotated)).toBeCloseTo(Math.SQRT2 / 2, 5)
  })

  it('leva em conta o vértice arrastado para baixo, não a primitiva', () => {
    // Um canto QUALQUER da face de baixo — qual é o índice 0 é detalhe do
    // `BoxGeometry`, não contrato deste cálculo.
    const bottom = controlPointsOf('box').findIndex((point) => point.unit[1] < 0)
    const dented = makeProp({ size: [1, 1, 1], vertexOffsets: { [bottom]: [0, -0.4, 0] } })
    expect(propGroundOffset(dented)).toBeCloseTo(0.9, 6)
  })

  it('a rampa apoia a base no chão', () => {
    expect(propGroundOffset(makeProp({ shape: 'ramp', size: [1, 0.5, 1] }))).toBeCloseTo(0.25, 6)
  })
})

describe('sanitização', () => {
  it('grampeia o tamanho e cai no padrão da forma quando o valor não é número', () => {
    expect(clampPropSize([0, 100, 'x'], 'box')).toEqual([0.01, 20, 0.5])
    expect(clampPropSize(null, 'cone')).toEqual([...DEFAULT_PROP_SIZE.cone])
  })

  it('descarta desvio de índice inexistente, em vez de grampeá-lo para outro vértice', () => {
    const offsets = sanitizeVertexOffsets({ 0: [0.1, 0, 0], 99: [1, 1, 1], nope: [1, 1, 1] }, controlPointCount('box'))
    expect(Object.keys(offsets)).toEqual(['0'])
  })

  it('desvio zerado não é gravado — "intacto" é a ausência da chave', () => {
    expect(sanitizeVertexOffsets({ 3: [0, 0, 0] }, 8)).toEqual({})
    expect(vertexOffsetCount(withVertexOffset({ 3: [1, 0, 0] }, 3, [0, 0, 0]))).toBe(0)
  })

  it('eixo ilegível vira zero, sem contaminar a geometria com NaN', () => {
    expect(sanitizeVertexOffsets({ 2: [0.5, 'a', null] }, 8)).toEqual({ 2: [0.5, 0, 0] })
  })
})

describe('todas as formas', () => {
  it('geram geometria válida, sem NaN, em qualquer tamanho', () => {
    for (const shape of PROP_SHAPES as readonly PropShape[]) {
      const geometry = buildPropGeometry(makeProp({ shape, size: [0.01, 20, 3] }))
      const position = geometry.getAttribute('position')
      for (let index = 0; index < position.count; index += 1) {
        expect(Number.isFinite(position.getX(index))).toBe(true)
        expect(Number.isFinite(position.getY(index))).toBe(true)
        expect(Number.isFinite(position.getZ(index))).toBe(true)
      }
      expect(controlPointPositions(makeProp({ shape }))).toHaveLength(controlPointCount(shape))
    }
  })
})
