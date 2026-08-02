import { describe, expect, it } from 'vitest'
import {
  POSES_VIEWS,
  POSES_VIEW_KEYS,
  closestPointOnAxisToRay,
  nudgeFromView,
  projectPointerOnPlane,
  projectPointerOnViewPlane,
  stepViewKey,
  viewCameraPose,
  viewScreenBasis,
} from '../posesViews'

describe('catálogo de vistas', () => {
  it('são as seis vistas do plano, na ordem do seletor (um giro em volta do boneco)', () => {
    expect(POSES_VIEW_KEYS).toEqual(['right', 'front', 'left', 'back', 'top', 'free'])
  })

  it('cada vista ortográfica trava o eixo perpendicular a ela; a livre não edita', () => {
    expect(POSES_VIEWS.front.lockedAxis).toBe('z')
    expect(POSES_VIEWS.back.lockedAxis).toBe('z')
    expect(POSES_VIEWS.left.lockedAxis).toBe('x')
    expect(POSES_VIEWS.right.lockedAxis).toBe('x')
    expect(POSES_VIEWS.top.lockedAxis).toBe('y')
    expect(POSES_VIEWS.free.lockedAxis).toBeNull()
    expect(POSES_VIEWS.free.editable).toBe(false)
    expect(POSES_VIEWS.front.editable).toBe(true)
  })

  it('avançar/voltar percorre as seis em ciclo', () => {
    expect(stepViewKey('front', 1)).toBe('left')
    expect(stepViewKey('free', 1)).toBe('right')
    expect(stepViewKey('right', -1)).toBe('free')
  })
})

describe('base de tela por vista (derivada da base da câmera, não escrita à mão)', () => {
  it('frente: direita da tela é +X, cima é +Y', () => {
    const basis = viewScreenBasis('front')
    expect(basis.right).toEqual([1, 0, 0])
    expect(basis.up).toEqual([0, 1, 0])
  })

  it('trás: direita da tela é -X — o espelho sai de graça da base', () => {
    const basis = viewScreenBasis('back')
    expect(basis.right).toEqual([-1, 0, 0])
    expect(basis.up).toEqual([0, 1, 0])
  })

  it('lados: a direita da tela é a profundidade Z, com sinal oposto entre eles', () => {
    expect(viewScreenBasis('left').right).toEqual([0, 0, -1])
    expect(viewScreenBasis('right').right).toEqual([0, 0, 1])
  })

  it('cima: cima da tela é -Z (a frente do boneco aponta para baixo da tela)', () => {
    const basis = viewScreenBasis('top')
    expect(basis.right).toEqual([1, 0, 0])
    expect(basis.up).toEqual([0, 0, -1])
  })
})

describe('projeção do toque no plano da junta', () => {
  it('a profundidade travada fica a que já era: o alvo herda o eixo travado da âncora', () => {
    // Vista de frente (trava Z), junta em z=0.3: um raio qualquer que cruza o
    // plano z=0.3 tem de devolver o ponto do plano — z NUNCA muda.
    const target = projectPointerOnViewPlane('front', [0.2, 1.1, 0.3], [5, 3, 10], [-0.4, -0.1, -1])
    expect(target).not.toBeNull()
    expect(target![2]).toBeCloseTo(0.3, 10)
  })

  it('na vista de cima o plano é horizontal, na altura da junta', () => {
    const target = projectPointerOnViewPlane('top', [0, 0.9, 0], [1, 10, 2], [0, -1, 0])
    expect(target).toEqual([1, 0.9, 2])
  })

  it('raio paralelo ao plano devolve null em vez de um alvo no infinito', () => {
    expect(projectPointerOnViewPlane('front', [0, 1, 0], [0, 1, 5], [1, 0, 0])).toBeNull()
  })

  it('a vista livre não projeta: não há edição nela', () => {
    expect(projectPointerOnViewPlane('free', [0, 1, 0], [0, 1, 5], [0, 0, -1])).toBeNull()
  })
})

describe('projeção em plano arbitrário (vista Livre: plano paralelo à tela)', () => {
  it('com a normal de um eixo, bate com a projeção das vistas travadas', () => {
    const viaAxis = projectPointerOnViewPlane('front', [0.2, 1.1, 0.3], [5, 3, 10], [-0.4, -0.1, -1])
    const viaPlane = projectPointerOnPlane([0.2, 1.1, 0.3], [0, 0, 1], [5, 3, 10], [-0.4, -0.1, -1])
    expect(viaPlane).not.toBeNull()
    expect(viaPlane![0]).toBeCloseTo(viaAxis![0], 10)
    expect(viaPlane![1]).toBeCloseTo(viaAxis![1], 10)
    expect(viaPlane![2]).toBeCloseTo(viaAxis![2], 10)
  })

  it('com normal diagonal, o alvo cai no plano e sobre o raio', () => {
    const anchor: [number, number, number] = [0, 1, 0]
    const normal: [number, number, number] = [0.577, 0.577, 0.577]
    const origin: [number, number, number] = [2, 3, 4]
    const dir: [number, number, number] = [-0.5, -0.6, -1]
    const target = projectPointerOnPlane(anchor, normal, origin, dir)
    expect(target).not.toBeNull()
    const offPlane =
      (target![0] - anchor[0]) * normal[0] +
      (target![1] - anchor[1]) * normal[1] +
      (target![2] - anchor[2]) * normal[2]
    expect(offPlane).toBeCloseTo(0, 10)
    // Sobre o raio: (alvo - origem) é múltiplo de dir.
    const t = (target![0] - origin[0]) / dir[0]
    expect(target![1] - origin[1]).toBeCloseTo(t * dir[1], 10)
    expect(target![2] - origin[2]).toBeCloseTo(t * dir[2], 10)
  })

  it('raio paralelo ao plano devolve null', () => {
    expect(projectPointerOnPlane([0, 1, 0], [0, 0, 1], [0, 1, 5], [1, 0, 0])).toBeNull()
  })
})

describe('arrasto por eixo (as setas do gizmo da vista Livre)', () => {
  it('devolve o ponto do eixo mais próximo do raio do toque', () => {
    // Eixo Y passando pela junta (0,1,0); raio horizontal na altura y=2.
    const target = closestPointOnAxisToRay([0, 1, 0], [0, 1, 0], [5, 2, 0], [-1, 0, 0])
    expect(target).not.toBeNull()
    expect(target![0]).toBeCloseTo(0, 10)
    expect(target![1]).toBeCloseTo(2, 10)
    expect(target![2]).toBeCloseTo(0, 10)
  })

  it('o alvo fica SEMPRE sobre a reta do eixo, mesmo com raio torto', () => {
    const target = closestPointOnAxisToRay([1, 0, 2], [1, 0, 0], [0, 5, 0], [0.3, -1, 0.45])
    expect(target).not.toBeNull()
    expect(target![1]).toBeCloseTo(0, 10)
    expect(target![2]).toBeCloseTo(2, 10)
  })

  it('raio paralelo ao eixo devolve null em vez de um alvo ambíguo', () => {
    expect(closestPointOnAxisToRay([0, 1, 0], [0, 1, 0], [5, 0, 0], [0, 1, 0])).toBeNull()
  })
})

describe('setas do painel: o arrasto em passos, na mesma base', () => {
  it('frente: direita empurra +X, cima empurra +Y', () => {
    expect(nudgeFromView('front', [0, 1, 0], 'right', 0.5)).toEqual([0.5, 1, 0])
    expect(nudgeFromView('front', [0, 1, 0], 'up', 0.5)).toEqual([0, 1.5, 0])
  })

  it('trás: direita da tela empurra -X — sem caso especial', () => {
    expect(nudgeFromView('back', [0, 1, 0], 'right', 0.5)).toEqual([-0.5, 1, 0])
  })

  it('cima: cima da tela empurra -Z', () => {
    expect(nudgeFromView('top', [0, 1, 0], 'up', 0.5)).toEqual([0, 1, -0.5])
  })

  it('baixo e esquerda são os opostos exatos', () => {
    expect(nudgeFromView('front', [0, 1, 0], 'down', 0.5)).toEqual([0, 0.5, 0])
    expect(nudgeFromView('left', [0, 1, 0], 'left', 0.5)).toEqual([0, 1, 0.5])
  })
})

describe('pose da câmera por vista', () => {
  it('frente: câmera à frente do alvo (+Z), em pé', () => {
    const pose = viewCameraPose('front', [0, 1, 0], 3)
    expect(pose.position).toEqual([0, 1, 3])
    expect(pose.up).toEqual([0, 1, 0])
  })

  it('cima: câmera acima do alvo, com o topo da tela apontando -Z', () => {
    const pose = viewCameraPose('top', [0, 0, 0], 5)
    expect(pose.position).toEqual([0, 5, 0])
    expect(pose.up).toEqual([0, 0, -1])
  })

  it('lado esquerdo: câmera no +X (o lado esquerdo do boneco)', () => {
    const pose = viewCameraPose('left', [0, 1, 0], 2)
    expect(pose.position).toEqual([2, 1, 0])
  })
})
