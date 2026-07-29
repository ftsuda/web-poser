import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Figure } from '../../store/figuresStore'
import {
  ANGLE_ELEVATION_DEG,
  ANGLE_KEYS,
  ANGLE_TERMS,
  CAMERA_HEIGHT_KEYS,
  CAMERA_HEIGHT_TERMS,
  DUTCH_ANGLE_TERM,
  GROUP_SHOT_KEYS,
  LEAD_ROOM_TERM,
  ORIENTATION_KEYS,
  ORIENTATION_TERMS,
  ORIENTATION_YAW_DEG,
  OVER_THE_SHOULDER_TERM,
  POV_TERM,
  REVERSE_ANGLE_TERM,
  RULE_OF_THIRDS_TERM,
  SHOT_KEYS,
  SHOT_TERMS,
  TWO_SHOT_TERM,
  canApplyShot,
  computeGroupShotView,
  computeOverTheShoulderView,
  computePovView,
  computeShotView,
  figureLandmarks,
  isGroupShot,
  rollUpVector,
  twoShotDirection,
  twoShotPair,
  type ShotKey,
  type ShotRequest,
} from '../shotFraming'
import { focalLengthToFov } from '../lens'

const FIGURE: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [0, 0, 0],
  rotation: { x: 0, y: 0, z: 0 },
  pose: {},
}

/** Direção de onde a câmera olha hoje (do alvo para a câmera), como o rig informa. */
const FROM_FRONT: [number, number, number] = [0, 0, 1]
const FOV = focalLengthToFov(50)

/** Altura do que cabe na tela, em metros, à distância resolvida. */
function framedHeightM(distance: number, fovDeg: number): number {
  return 2 * distance * Math.tan((fovDeg * Math.PI) / 360)
}

const vec = (t: readonly [number, number, number]) => new THREE.Vector3(...t)

/** Tolerância de "no chão": descer exatamente até y = 0 erra na última casa do double. */
const NO_CHAO = 1e-9

/** Proporção de tela usada nos enquadramentos de conjunto. */
const ASPECT = 16 / 9

type Pedido = Partial<ShotRequest> & { shot: ShotKey }

/** Atalhos: o pedido completo só aparece onde o teste muda alguma coisa nele. */
const plano = (figure: Figure, over: Pedido) =>
  computeShotView(figure, { fovDeg: FOV, fromDirection: FROM_FRONT, ...over })

const grupo = (figures: readonly Figure[], over: Pedido) =>
  computeGroupShotView(figures, { fovDeg: FOV, fromDirection: FROM_FRONT, aspect: ASPECT, ...over })

describe('figureLandmarks', () => {
  it('mede os marcos do boneco em pé no mundo, do chão ao alto da cabeça', () => {
    const marks = figureLandmarks(FIGURE)
    // `feetY` é a junta do bloco dos dedos do pé, 1 cm acima da sola.
    expect(marks.feetY).toBeLessThan(0.02)
    // Boneco de 1,70 m: o alto do ovo da cabeça fica na altura nominal.
    expect(marks.headTopY).toBeCloseTo(1.7, 2)
    expect(marks.eyesY).toBeLessThan(marks.headTopY)
    expect(marks.shouldersY).toBeLessThan(marks.eyesY)
    expect(marks.waistY).toBeLessThan(marks.shouldersY)
    expect(marks.waistY).toBeGreaterThan(marks.feetY)
    expect(marks.bodyHeightM).toBeCloseTo(1.7, 1)
  })

  it('acompanha a escala do boneco', () => {
    expect(figureLandmarks({ ...FIGURE, height: 1.5 }).headTopY).toBeCloseTo(1.5, 2)
  })

  it('acompanha a pose: deitado, o corpo deixa de ser alto e vira comprido', () => {
    const emPe = figureLandmarks(FIGURE)
    const deitado = figureLandmarks({ ...FIGURE, rotation: { x: -90, y: 0, z: 0 } })
    // A cabeça sai do alto e vai parar na altura do quadril, o eixo do giro.
    expect(deitado.headTopY).toBeLessThan(emPe.headTopY * 0.6)
    // E a extensão VERTICAL do corpo encolhe — é o que decide o enquadramento.
    expect(deitado.bodyHeightM).toBeLessThan(emPe.bodyHeightM * 0.6)
  })

  /** A caixa é o que permite juntar vários bonecos num enquadramento só. */
  it('entrega os cantos da caixa do corpo, coerentes com o centro e a altura', () => {
    const marks = figureLandmarks(FIGURE)
    expect((vec(marks.bodyMin).y + vec(marks.bodyMax).y) / 2).toBeCloseTo(vec(marks.bodyCenter).y, 6)
    expect(vec(marks.bodyMax).y - vec(marks.bodyMin).y).toBeCloseTo(marks.bodyHeightM, 6)
    expect(vec(marks.bodyMax).y).toBeCloseTo(marks.headTopY, 6)
    // Ombro a ombro de um boneco de 1,70 m: largura de tronco, não de braços.
    expect(marks.shoulderSpanM).toBeGreaterThan(0.25)
    expect(marks.shoulderSpanM).toBeLessThan(0.6)
  })

  /** É essa diferença que faz o plano médio de um grupo não virar plano geral. */
  it('a largura dos ombros não cresce com os braços abertos, mas a da caixa cresce', () => {
    const bracosAbertos: Figure = {
      ...FIGURE,
      pose: { 'shoulder.L': { x: 0, y: 0, z: -75 }, 'shoulder.R': { x: 0, y: 0, z: 75 } },
    }
    const parado = figureLandmarks(FIGURE)
    const aberto = figureLandmarks(bracosAbertos)
    expect(aberto.shoulderSpanM).toBeCloseTo(parado.shoulderSpanM, 6)
    expect(vec(aberto.bodyMax).x - vec(aberto.bodyMin).x).toBeGreaterThan(
      (vec(parado.bodyMax).x - vec(parado.bodyMin).x) * 2,
    )
  })

  it('acompanha a posição do boneco na cena', () => {
    const deslocado = figureLandmarks({ ...FIGURE, position: [2, 0, -3] })
    expect(vec(deslocado.headTop).x).toBeCloseTo(2, 2)
    expect(vec(deslocado.headTop).z).toBeCloseTo(-3, 2)
  })
})

describe('computeShotView — tamanhos de plano', () => {
  const marks = figureLandmarks(FIGURE)
  const alturaDoCorpo = marks.headTopY - marks.feetY

  it('plano inteiro: o corpo cabe, com folga', () => {
    const full = plano(FIGURE, { shot: 'fullShot' })
    const altura = framedHeightM(full.distance, FOV)
    expect(altura).toBeGreaterThan(alturaDoCorpo)
    expect(altura).toBeLessThan(alturaDoCorpo * 1.5)
  })

  it('plano geral extremo: o boneco ocupa uma fração da tela', () => {
    const shot = plano(FIGURE, { shot: 'extremeWide' })
    expect(alturaDoCorpo / framedHeightM(shot.distance, FOV)).toBeLessThan(0.3)
  })

  it('plano médio: corta na cintura', () => {
    const shot = plano(FIGURE, { shot: 'medium' })
    const altura = framedHeightM(shot.distance, FOV)
    const trecho = marks.headTopY - marks.waistY
    expect(altura).toBeGreaterThan(trecho)
    expect(altura).toBeLessThan(alturaDoCorpo)
    // O centro do enquadramento fica entre a cintura e o alto da cabeça.
    expect(shot.target[1]).toBeGreaterThan(marks.waistY)
    expect(shot.target[1]).toBeLessThan(marks.headTopY)
  })

  it('primeiro plano: rosto e ombros, mais perto que o plano médio', () => {
    const closeUp = plano(FIGURE, { shot: 'closeUp' })
    const medium = plano(FIGURE, { shot: 'medium' })
    expect(closeUp.distance).toBeLessThan(medium.distance)
    const altura = framedHeightM(closeUp.distance, FOV)
    expect(altura).toBeGreaterThan(marks.headTopY - marks.shouldersY)
    expect(altura).toBeLessThan(marks.headTopY - marks.waistY)
  })

  it('cada plano é mais fechado que o anterior', () => {
    const distancias = SHOT_KEYS.map(
      (shot) => plano(FIGURE, { shot, selectedJoint: 'head' }).distance,
    )
    for (let i = 1; i < distancias.length; i += 1) {
      expect({ [SHOT_KEYS[i]]: distancias[i] < distancias[i - 1] }).toEqual({ [SHOT_KEYS[i]]: true })
    }
  })

  /** O "detalhe" da tabela é a junta selecionada: é o que o app tem de específico. */
  it('plano detalhe: enquadra a junta selecionada', () => {
    const shot = plano(FIGURE, { shot: 'extremeCloseUp', selectedJoint: 'wrist.R' })
    expect(framedHeightM(shot.distance, FOV)).toBeLessThan(0.2)

    const semJunta = plano(FIGURE, { shot: 'extremeCloseUp' })
    // Sem junta selecionada, o detalhe é o rosto.
    expect(semJunta.target[1]).toBeCloseTo(figureLandmarks(FIGURE).eyesY, 1)
    expect(vec(shot.target).distanceTo(vec(semJunta.target))).toBeGreaterThan(0.3)
  })

  it('lente mais longa afasta a câmera para manter o mesmo enquadramento', () => {
    const cinquenta = plano(FIGURE, { shot: 'closeUp', fovDeg: focalLengthToFov(50) })
    const oitentaCinco = plano(FIGURE, { shot: 'closeUp', fovDeg: focalLengthToFov(85) })
    expect(oitentaCinco.distance).toBeGreaterThan(cinquenta.distance)
    // Mesmo recorte: a altura enquadrada é a mesma, só muda a compressão.
    expect(framedHeightM(oitentaCinco.distance, focalLengthToFov(85))).toBeCloseTo(
      framedHeightM(cinquenta.distance, focalLengthToFov(50)),
      6,
    )
  })
})

describe('computeShotView — ângulos', () => {
  it('nível dos olhos deixa a câmera na altura do que ela enquadra', () => {
    const shot = plano(FIGURE, { shot: 'closeUp' })
    expect(shot.position[1]).toBeCloseTo(shot.target[1], 6)
  })

  it('contra-picado olha de baixo e picado de cima', () => {
    const baixo = plano(FIGURE, { shot: 'medium', angle: 'lowAngle' })
    const alto = plano(FIGURE, { shot: 'medium', angle: 'highAngle' })
    expect(baixo.position[1]).toBeLessThan(baixo.target[1])
    expect(alto.position[1]).toBeGreaterThan(alto.target[1])
    expect(ANGLE_ELEVATION_DEG.lowAngle).toBeLessThan(0)
    expect(ANGLE_ELEVATION_DEG.highAngle).toBeGreaterThan(0)
  })

  it('vista aérea olha reto de cima, com o topo da tela apontando para onde a câmera estava', () => {
    const shot = plano(FIGURE, { shot: 'wide', angle: 'birdsEye' })
    expect(shot.position[0]).toBeCloseTo(shot.target[0], 6)
    expect(shot.position[2]).toBeCloseTo(shot.target[2], 6)
    expect(shot.position[1]).toBeGreaterThan(shot.target[1])
    // `up` não pode ser paralelo à direção de visão (degenerado).
    expect(Math.abs(vec(shot.up).y)).toBeLessThan(0.01)
  })

  it('mantém o lado de onde a câmera já olhava — o ângulo muda a altura, não o giro', () => {
    const deLado: [number, number, number] = [1, 0, 0]
    for (const angle of ANGLE_KEYS) {
      const shot = plano(FIGURE, { shot: 'medium', angle, fromDirection: deLado })
      const direcao = vec(shot.position).sub(vec(shot.target))
      if (angle === 'birdsEye') continue // olha reto de cima: não há azimute
      expect({ [angle]: direcao.x > 0 }).toEqual({ [angle]: true })
      expect({ [angle]: Math.abs(direcao.z) < 1e-6 }).toEqual({ [angle]: true })
    }
  })

  /**
   * O contra-picado desce a câmera, mas o chão é o limite: enterrada, ela mostra
   * o boneco visto por baixo do piso (pedido do usuário, DECISOES.md #49).
   */
  it('o contra-picado nunca põe a câmera abaixo do chão', () => {
    for (const shot of SHOT_KEYS) {
      for (const altura of [1.4, 1.7, 1.9]) {
        const figura = { ...FIGURE, height: altura }
        const view = plano(figura, { shot, angle: 'lowAngle' })
        // Nos planos abertos a câmera encosta no chão: a margem é só o ruído
        // de arredondamento de descer exatamente até y = 0.
        expect({ [`${shot}-${altura}`]: view.position[1] >= -NO_CHAO }).toEqual({
          [`${shot}-${altura}`]: true,
        })
      }
    }
  })

  it('quando cabe embaixo do alvo, o contra-picado mantém os 30° da tabela', () => {
    const view = plano(FIGURE, { shot: 'closeUp', angle: 'lowAngle' })
    const seno = (view.position[1] - view.target[1]) / view.distance
    expect(seno).toBeCloseTo(Math.sin(THREE.MathUtils.degToRad(ANGLE_ELEVATION_DEG.lowAngle)), 6)
    expect(view.position[1]).toBeGreaterThan(0)
  })

  it('num plano aberto, a câmera para no chão em vez de furá-lo — e continua olhando de baixo', () => {
    const view = plano(FIGURE, { shot: 'wide', angle: 'lowAngle' })
    expect(view.position[1]).toBeCloseTo(0, 6)
    // Ainda é contra-picado: a câmera está abaixo do que enquadra.
    expect(view.position[1]).toBeLessThan(view.target[1])
    // E o enquadramento não mudou: só a inclinação foi limitada.
    const nivel = plano(FIGURE, { shot: 'wide' })
    expect(view.distance).toBeCloseTo(nivel.distance, 6)
  })

  it('a distância não muda com o ângulo — só a direção', () => {
    const distancias = ANGLE_KEYS.map(
      (angle) => plano(FIGURE, { shot: 'medium', angle }).distance,
    )
    for (const distancia of distancias) expect(distancia).toBeCloseTo(distancias[0], 10)
  })
})

describe('rollUpVector — ângulo holandês', () => {
  it('sem inclinação, o topo da tela é o topo do mundo', () => {
    expect(rollUpVector([0, 0, 1], 0)).toEqual([0, 1, 0])
  })

  it('inclina o topo da tela em torno do eixo de visão, mantendo o vetor unitário', () => {
    const inclinado = vec(rollUpVector([0, 0, 1], 30))
    expect(inclinado.length()).toBeCloseTo(1, 10)
    expect(inclinado.y).toBeCloseTo(Math.cos(Math.PI / 6), 6)
    expect(Math.abs(inclinado.x)).toBeCloseTo(Math.sin(Math.PI / 6), 6)
    expect(inclinado.z).toBeCloseTo(0, 6)
  })

  it('inclina para lados opostos com sinais opostos', () => {
    expect(vec(rollUpVector([0, 0, 1], 20)).x).toBeCloseTo(-vec(rollUpVector([0, 0, 1], -20)).x, 10)
  })

  it('nunca devolve um `up` paralelo à direção de visão', () => {
    for (const roll of [0, 15, 45, -45]) {
      const direction: [number, number, number] = [0, 1, 0] // olhando reto para baixo
      const up = vec(rollUpVector(direction, roll))
      expect(Math.abs(up.dot(vec(direction).normalize()))).toBeLessThan(1e-6)
    }
  })
})

describe('computeOverTheShoulderView', () => {
  const perto: Figure = { ...FIGURE, id: 'a', position: [0, 0, 0] }
  const longe: Figure = { ...FIGURE, id: 'b', position: [0, 0, -1.4], rotation: { x: 0, y: 180, z: 0 } }

  it('põe a câmera atrás e ao lado da cabeça de quem está perto, olhando para o outro', () => {
    const shot = computeOverTheShoulderView(perto, longe)!
    const cabecaPerto = vec(figureLandmarks(perto).headTop)
    const cabecaLonge = vec(figureLandmarks(longe).headTop)

    // Alvo: a cabeça do outro boneco.
    expect(vec(shot.target).distanceTo(cabecaLonge)).toBeLessThan(0.3)
    // A câmera fica do lado oposto ao outro boneco, atrás da cabeça de quem está perto.
    expect(shot.position[2]).toBeGreaterThan(cabecaPerto.z)
    // E deslocada para um lado, para o ombro entrar no canto do quadro.
    expect(Math.abs(shot.position[0])).toBeGreaterThan(0.15)
    // Na altura da cabeça, não no chão.
    expect(shot.position[1]).toBeGreaterThan(1.2)
  })

  it('não resolve nada quando os dois bonecos estão no mesmo lugar', () => {
    expect(computeOverTheShoulderView(perto, { ...perto, id: 'b' })).toBeNull()
  })
})

/**
 * Sem boneco selecionado, os planos abertos enquadram o CONJUNTO: o alvo é o
 * ponto médio de todos os bonecos da cena (pedido do usuário, DECISOES.md #48).
 */
describe('computeGroupShotView', () => {
  const esquerda: Figure = { ...FIGURE, id: 'a', position: [-2, 0, 0] }
  const direita: Figure = { ...FIGURE, id: 'b', position: [2, 0, 1] }
  const dupla = [esquerda, direita]

  const caixaDoGrupo = (figures: Figure[]) => {
    const box = new THREE.Box3()
    for (const figure of figures) {
      const marks = figureLandmarks(figure)
      box.expandByPoint(vec(marks.bodyMin)).expandByPoint(vec(marks.bodyMax))
    }
    return box
  }

  /**
   * Quanto do meio-quadro cada canto da caixa ocupa, na horizontal e na
   * vertical: 1 é exatamente a borda, acima de 1 está cortado. É a conta da
   * própria câmera em perspectiva, então leva em conta que um boneco mais perto
   * aparece maior — que é o erro que medir a largura no plano do alvo comete.
   */
  const bordas = (view: ReturnType<typeof computeShotView>, box: THREE.Box3, aspect: number) => {
    const position = vec(view.position)
    const olhar = vec(view.target).sub(position).normalize()
    const up = vec(view.up)
    const direita = olhar.clone().cross(up).normalize()
    const tanV = Math.tan((FOV * Math.PI) / 360)

    let horizontal = 0
    let vertical = 0
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          const q = new THREE.Vector3(x, y, z).sub(position)
          const profundidade = q.dot(olhar)
          horizontal = Math.max(horizontal, Math.abs(q.dot(direita)) / (profundidade * tanV * aspect))
          vertical = Math.max(vertical, Math.abs(q.dot(up)) / (profundidade * tanV))
        }
      }
    }
    return { horizontal, vertical }
  }

  it('mira no ponto médio de todos os bonecos', () => {
    const view = grupo(dupla, { shot: 'wide' })!
    const centroA = vec(figureLandmarks(esquerda).bodyCenter)
    const centroB = vec(figureLandmarks(direita).bodyCenter)
    expect(view.target[0]).toBeCloseTo((centroA.x + centroB.x) / 2, 6)
    expect(view.target[2]).toBeCloseTo((centroA.z + centroB.z) / 2, 6)
  })

  /** Selecionar ou não o único boneco da cena não pode mudar o enquadramento. */
  it('com um boneco só, dá o mesmo enquadramento de quando ele está selecionado', () => {
    for (const shot of GROUP_SHOT_KEYS) {
      const conjunto = grupo([FIGURE], { shot })!
      const individual = plano(FIGURE, { shot })
      expect({ [shot]: conjunto.distance }).toEqual({
        [shot]: expect.closeTo(individual.distance, 6),
      })
      expect(vec(conjunto.target).distanceTo(vec(individual.target))).toBeLessThan(1e-6)
    }
  })

  /**
   * O plano médio corta os braços abertos como já corta as pernas: quem manda
   * na largura é o tronco. Sem isso, um grupo de braços abertos empurraria a
   * câmera para trás até o plano médio virar um plano geral.
   */
  it('no plano médio do grupo, os troncos cabem e o corte na cintura se mantém', () => {
    const trio = [
      { ...FIGURE, id: 'a', position: [-1, 0, 0] as [number, number, number] },
      { ...FIGURE, id: 'b', position: [0, 0, 0] as [number, number, number] },
      { ...FIGURE, id: 'c', position: [1, 0, 0] as [number, number, number] },
    ]
    const medium = grupo(trio, { shot: 'medium' })!
    const wide = grupo(trio, { shot: 'wide' })!
    expect(medium.distance).toBeLessThan(wide.distance)

    // Os troncos (ombro a ombro de cada boneco) cabem inteiros no quadro.
    const troncos = new THREE.Box3()
    for (const figure of trio) {
      const marks = figureLandmarks(figure)
      const half = marks.shoulderSpanM / 2
      for (const p of [marks.waist, marks.headTop]) {
        troncos.expandByPoint(new THREE.Vector3(p[0] - half, p[1], p[2] - half))
        troncos.expandByPoint(new THREE.Vector3(p[0] + half, p[1], p[2] + half))
      }
    }
    expect(bordas(medium, troncos, ASPECT).horizontal).toBeLessThanOrEqual(1)
    // E os pés ficam de fora: continua sendo um corte, não um plano geral.
    expect(bordas(medium, caixaDoGrupo(trio), ASPECT).vertical).toBeGreaterThan(1)
  })

  /**
   * A distância sai da ALTURA enquadrada (o `fov` do three.js é vertical), e a
   * altura de um grupo não diz nada sobre a largura dele: sem a conferência de
   * quadro, um plano geral de bonecos lado a lado cortaria os das pontas.
   */
  it('nos planos abertos, todos os bonecos cabem no quadro — inclusive os das pontas', () => {
    for (const shot of ['extremeWide', 'wide'] as const) {
      const view = grupo(dupla, { shot })!
      const { horizontal } = bordas(view, caixaDoGrupo(dupla), ASPECT)
      expect({ [shot]: horizontal <= 1 }).toEqual({ [shot]: true })
    }
  })

  it('e o plano geral cabe também na vertical, sem sobrar tela à toa', () => {
    const view = grupo(dupla, { shot: 'wide' })!
    const { horizontal, vertical } = bordas(view, caixaDoGrupo(dupla), ASPECT)
    expect(vertical).toBeLessThanOrEqual(1)
    // Um dos dois eixos tem de estar quase encostando: senão a câmera recuou à toa.
    expect(Math.max(horizontal, vertical)).toBeGreaterThan(0.75)
  })

  /**
   * O erro que a conferência de quadro corrige: medir a largura no plano do
   * alvo ignora que o boneco mais próximo da câmera ocupa mais tela.
   */
  it('num grupo em diagonal, quem está na frente da câmera também cabe', () => {
    const diagonal = [
      { ...FIGURE, id: 'a', position: [-2, 0, -2] as [number, number, number] },
      { ...FIGURE, id: 'b', position: [0, 0, 0] as [number, number, number] },
      { ...FIGURE, id: 'c', position: [2, 0, 2] as [number, number, number] },
    ]
    const view = grupo(diagonal, { shot: 'wide', fromDirection: [1, 0, 1] })!
    const { horizontal, vertical } = bordas(view, caixaDoGrupo(diagonal), ASPECT)
    expect(horizontal).toBeLessThanOrEqual(1)
    expect(vertical).toBeLessThanOrEqual(1)
  })

  it('com os bonecos juntos, a câmera não recua à toa', () => {
    const juntos = [
      { ...FIGURE, id: 'a', position: [-0.3, 0, 0] as [number, number, number] },
      { ...FIGURE, id: 'b', position: [0.3, 0, 0] as [number, number, number] },
    ]
    const view = grupo(juntos, { shot: 'wide' })!
    const individual = plano(FIGURE, { shot: 'wide' })
    expect(view.distance).toBeCloseTo(individual.distance, 6)
  })

  /**
   * O eixo que aperta muda com o lado de onde se olha: lado a lado, é a largura
   * da tela; um atrás do outro, é a altura do que está na frente da câmera.
   */
  it('o enquadramento se resolve pelo eixo apertado de cada lado', () => {
    const ladoALado = [
      { ...FIGURE, id: 'a', position: [-2, 0, 0] as [number, number, number] },
      { ...FIGURE, id: 'b', position: [2, 0, 0] as [number, number, number] },
    ]
    const box = caixaDoGrupo(ladoALado)

    // No `fullShot` o conjunto é justo, então a conferência de quadro é que
    // manda — é nele que dá para ver qual eixo está apertando.
    const deFrente = bordas(grupo(ladoALado, { shot: 'fullShot' })!, box, ASPECT)
    expect(deFrente.horizontal).toBeGreaterThan(0.9)
    expect(deFrente.horizontal).toBeLessThanOrEqual(1)
    expect(deFrente.vertical).toBeLessThan(0.8)

    const deLado = bordas(
      grupo(ladoALado, { shot: 'fullShot', fromDirection: [1, 0, 0] })!,
      box,
      ASPECT,
    )
    expect(deLado.vertical).toBeGreaterThan(0.9)
    expect(deLado.vertical).toBeLessThanOrEqual(1)
    expect(deLado.horizontal).toBeLessThan(0.8)
  })

  /** Reto de cima, a "altura" do grupo vira profundidade: só a conferência de quadro salva. */
  it('em vista aérea, o quadro cobre o espalhamento no chão', () => {
    const view = grupo(dupla, { shot: 'wide', angle: 'birdsEye' })!
    const { horizontal, vertical } = bordas(view, caixaDoGrupo(dupla), ASPECT)
    expect(horizontal).toBeLessThanOrEqual(1)
    expect(vertical).toBeLessThanOrEqual(1)
  })

  it('plano médio do grupo vai da cintura mais baixa ao alto da cabeça mais alta', () => {
    const baixo: Figure = { ...FIGURE, id: 'b', height: 1.4, position: [0.6, 0, 0] }
    const view = grupo([FIGURE, baixo], { shot: 'medium' })!
    const cintura = Math.min(figureLandmarks(FIGURE).waistY, figureLandmarks(baixo).waistY)
    const cabeca = Math.max(figureLandmarks(FIGURE).headTopY, figureLandmarks(baixo).headTopY)
    expect(view.target[1]).toBeCloseTo((cintura + cabeca) / 2, 6)
    expect(framedHeightM(view.distance, FOV)).toBeGreaterThan(cabeca - cintura)
  })

  /** Primeiro plano e detalhe de "todo mundo" seria um close no ar entre os bonecos. */
  it('não enquadra grupo em primeiro plano nem em detalhe, nem com a cena vazia', () => {
    expect(grupo(dupla, { shot: 'closeUp' })).toBeNull()
    expect(grupo(dupla, { shot: 'extremeCloseUp' })).toBeNull()
    expect(grupo([], { shot: 'wide' })).toBeNull()
  })

  it('o plano geral extremo do grupo deixa o conjunto pequeno na tela', () => {
    const geral = grupo(dupla, { shot: 'wide' })!
    const extremo = grupo(dupla, { shot: 'extremeWide' })!
    expect(extremo.distance).toBeGreaterThan(geral.distance)
  })

  it('o contra-picado do grupo também para no chão, com todo mundo ainda no quadro', () => {
    for (const shot of GROUP_SHOT_KEYS) {
      const view = grupo(dupla, { shot, angle: 'lowAngle' })!
      expect({ [shot]: view.position[1] >= -NO_CHAO }).toEqual({ [shot]: true })
      expect({ [shot]: view.position[1] < view.target[1] }).toEqual({ [shot]: true })
    }
    // O plano geral é o que mais recua, e é onde a limitação mais pesa: a
    // conferência de quadro tem de valer para a direção JÁ limitada.
    const wide = grupo(dupla, { shot: 'wide', angle: 'lowAngle' })!
    const { horizontal, vertical } = bordas(wide, caixaDoGrupo(dupla), ASPECT)
    expect(horizontal).toBeLessThanOrEqual(1)
    expect(vertical).toBeLessThanOrEqual(1)
  })

  it('ângulo e inclinação valem igual para o grupo', () => {
    const alto = grupo(dupla, { shot: 'wide', angle: 'highAngle' })!
    expect(alto.position[1]).toBeGreaterThan(alto.target[1])

    const torto = grupo(dupla, { shot: 'wide', rollDeg: 20 })!
    expect(Math.abs(vec(torto.up).x)).toBeCloseTo(Math.sin(Math.PI / 9), 6)
  })
})

describe('canApplyShot', () => {
  it('os planos abertos dispensam seleção; os fechados exigem', () => {
    expect(GROUP_SHOT_KEYS).toEqual([
      'extremeWide',
      'wide',
      'fullShot',
      'cowboy',
      'medium',
      'mediumCloseUp',
    ])
    expect(SHOT_KEYS.filter(isGroupShot)).toEqual(GROUP_SHOT_KEYS)

    for (const shot of GROUP_SHOT_KEYS) {
      expect({ [shot]: canApplyShot(shot, 2, false) }).toEqual({ [shot]: true })
    }
    expect(canApplyShot('closeUp', 2, false)).toBe(false)
    expect(canApplyShot('extremeCloseUp', 2, false)).toBe(false)
    expect(canApplyShot('closeUp', 1, true)).toBe(true)
  })

  it('sem boneco nenhum, e sem plano escolhido, não há o que aplicar', () => {
    for (const shot of SHOT_KEYS) {
      expect({ [shot]: canApplyShot(shot, 0, true) }).toEqual({ [shot]: false })
    }
    expect(canApplyShot(null, 3, true)).toBe(false)
  })
})

/**
 * A escada de planos completa (DECISOES.md #50): o plano geral virou "boneco no
 * ambiente" e o corpo justo virou `fullShot`, com o americano e o plano peito
 * preenchendo os degraus que faltavam.
 */
describe('escada de planos', () => {
  const marks = figureLandmarks(FIGURE)

  it('cada degrau corta no seu marco, do quadril para cima', () => {
    const corte = (shot: ShotKey) => {
      const view = plano(FIGURE, { shot })
      // Borda de baixo do quadro, na altura do alvo.
      return view.target[1] - framedHeightM(view.distance, FOV) / 2
    }
    // Americano corta na coxa, médio na cintura, peito no peito, primeiro
    // plano nos ombros — cada um mais alto que o anterior.
    expect(corte('cowboy')).toBeLessThan(marks.thighY)
    expect(corte('cowboy')).toBeGreaterThan(marks.kneeY)
    expect(corte('medium')).toBeLessThan(marks.waistY)
    expect(corte('medium')).toBeGreaterThan(marks.thighY)
    expect(corte('mediumCloseUp')).toBeLessThan(marks.chestY)
    expect(corte('mediumCloseUp')).toBeGreaterThan(marks.waistY)
    expect(corte('closeUp')).toBeGreaterThan(marks.chestY)
  })

  it('o plano geral mostra o ambiente e o `fullShot` é o corpo justo', () => {
    const alturaDoCorpo = marks.headTopY - marks.feetY
    const wide = framedHeightM(plano(FIGURE, { shot: 'wide' }).distance, FOV)
    const full = framedHeightM(plano(FIGURE, { shot: 'fullShot' }).distance, FOV)

    // No `fullShot` o corpo quase preenche a tela; no plano geral sobra lugar.
    expect(alturaDoCorpo / full).toBeGreaterThan(0.8)
    expect(alturaDoCorpo / wide).toBeLessThan(0.65)
    expect(alturaDoCorpo / wide).toBeGreaterThan(0.4)
  })

  it('os marcos novos ficam na ordem anatômica', () => {
    expect(marks.kneeY).toBeLessThan(marks.thighY)
    expect(marks.thighY).toBeLessThan(marks.hipY)
    expect(marks.hipY).toBeLessThan(marks.waistY)
    expect(marks.waistY).toBeLessThan(marks.chestY)
    expect(marks.chestY).toBeLessThan(marks.shouldersY)
  })
})

/**
 * Lado relativo ao BONECO — a lacuna que existia: até aqui o azimute vinha
 * sempre de onde a câmera estava, e as vistas ortográficas são do mundo.
 */
describe('orientação relativa ao boneco', () => {
  /** Ângulo entre a frente do boneco e a direção de onde a câmera olha. */
  const desvio = (figure: Figure, view: ReturnType<typeof plano>) => {
    const heading = vec(figureLandmarks(figure).heading)
    const paraCamera = vec(view.position).sub(vec(view.target))
    paraCamera.y = 0
    paraCamera.normalize()
    return (Math.acos(THREE.MathUtils.clamp(heading.dot(paraCamera), -1, 1)) * 180) / Math.PI
  }

  it('a frente do boneco é o +Z local da raiz — o lado do nariz', () => {
    expect(vec(figureLandmarks(FIGURE).heading).z).toBeCloseTo(1, 6)
    const virado = figureLandmarks({ ...FIGURE, rotation: { x: 0, y: 90, z: 0 } })
    expect(vec(virado.heading).x).toBeCloseTo(1, 6)
  })

  it('cada vista põe a câmera no giro que promete, medido a partir da frente', () => {
    for (const orientation of ORIENTATION_KEYS) {
      const view = plano(FIGURE, { shot: 'medium', orientation })
      expect({ [orientation]: desvio(FIGURE, view) }).toEqual({
        [orientation]: expect.closeTo(ORIENTATION_YAW_DEG[orientation], 4),
      })
    }
  })

  it('acompanha o boneco quando ele gira — é relativo a ele, não ao mundo', () => {
    const virado = { ...FIGURE, rotation: { x: 0, y: 130, z: 0 } }
    const view = plano(virado, { shot: 'medium', orientation: 'front' })
    expect(desvio(virado, view)).toBeCloseTo(0, 4)
    // E a câmera saiu mesmo do lugar: não é a vista de frente do mundo.
    expect(vec(view.position).sub(vec(view.target)).x).toBeGreaterThan(0.5)
  })

  it('escolhe o lado onde a câmera já está — perfil de quem está à direita é o perfil direito', () => {
    const direita = plano(FIGURE, { shot: 'medium', orientation: 'profile', fromDirection: [1, 0, 0.2] })
    const esquerda = plano(FIGURE, { shot: 'medium', orientation: 'profile', fromDirection: [-1, 0, 0.2] })
    expect(vec(direita.position).sub(vec(direita.target)).x).toBeGreaterThan(0)
    expect(vec(esquerda.position).sub(vec(esquerda.target)).x).toBeLessThan(0)
    // Nos dois casos é perfil: 90° da frente.
    expect(desvio(FIGURE, direita)).toBeCloseTo(90, 4)
    expect(desvio(FIGURE, esquerda)).toBeCloseTo(90, 4)
  })

  it('sem orientação pedida, o lado continua sendo o de onde a câmera olha', () => {
    const view = plano(FIGURE, { shot: 'medium', fromDirection: [1, 0, 0] })
    expect(vec(view.position).sub(vec(view.target)).x).toBeGreaterThan(0)
  })
})

/**
 * Altura de câmera: instrução absoluta, ao contrário do ângulo, que é uma
 * inclinação e por isso depende da distância.
 */
describe('altura de câmera', () => {
  const marks = figureLandmarks(FIGURE)

  it('põe a câmera na altura pedida, em qualquer plano que a alcance', () => {
    const alturas: Record<string, number> = {
      ground: 0,
      knee: marks.kneeY,
      hip: marks.hipY,
      shoulder: marks.shouldersY,
    }
    for (const cameraHeight of CAMERA_HEIGHT_KEYS) {
      for (const shot of ['extremeWide', 'wide', 'fullShot', 'medium'] as const) {
        const view = plano(FIGURE, { shot, cameraHeight })
        expect({ [`${cameraHeight}-${shot}`]: view.position[1] }).toEqual({
          [`${cameraHeight}-${shot}`]: expect.closeTo(alturas[cameraHeight], 6),
        })
      }
    }
  })

  /**
   * Quando a altura não cabe na distância do plano, a câmera se afasta o
   * MÍNIMO para alcançá-la sem entrar no boneco. Só descer o quanto desse
   * punha a câmera dentro da pelve com uma grande angular — apareceu na
   * validação no navegador, que roda com os 26 mm padrão do app.
   */
  it('afasta o mínimo necessário para alcançar a altura sem entrar no boneco', () => {
    const larguraDeOmbros = marks.shoulderSpanM
    for (const fovDeg of [FOV, focalLengthToFov(26), focalLengthToFov(14)]) {
      for (const shot of ['medium', 'closeUp'] as const) {
        const view = plano(FIGURE, { shot, cameraHeight: 'ground', fovDeg })
        const afastamento = Math.hypot(
          view.position[0] - view.target[0],
          view.position[2] - view.target[2],
        )
        const rotulo = `${shot}-${Math.round(fovDeg)}`
        // Fora do corpo — pelo menos uma largura de ombros do eixo —, e na
        // altura pedida. O piso é um mínimo: onde o plano já é largo o
        // bastante, a câmera fica ainda mais longe.
        expect({ [rotulo]: afastamento >= larguraDeOmbros - 1e-6 }).toEqual({ [rotulo]: true })
        expect({ [`${rotulo}-y`]: view.position[1] }).toEqual({
          [`${rotulo}-y`]: expect.closeTo(0, 6),
        })
      }
    }
  })

  it('e não afrouxa o plano além do necessário', () => {
    const fovDeg = focalLengthToFov(26)
    const semAltura = plano(FIGURE, { shot: 'medium', fovDeg })
    const comAltura = plano(FIGURE, { shot: 'medium', cameraHeight: 'ground', fovDeg })
    expect(comAltura.distance).toBeGreaterThan(semAltura.distance)
    expect(comAltura.distance).toBeLessThan(semAltura.distance * 2)
  })

  /** É esta a diferença para o ângulo: 30° a 20 m não descem o mesmo que a 2 m. */
  it('a altura não muda com a distância, mas a do ângulo muda', () => {
    const perto = plano(FIGURE, { shot: 'medium', cameraHeight: 'knee' })
    const longe = plano(FIGURE, { shot: 'extremeWide', cameraHeight: 'knee' })
    expect(perto.position[1]).toBeCloseTo(longe.position[1], 6)

    const anguloPerto = plano(FIGURE, { shot: 'medium', angle: 'lowAngle' })
    const anguloLonge = plano(FIGURE, { shot: 'extremeWide', angle: 'lowAngle' })
    expect(Math.abs(anguloPerto.position[1] - anguloLonge.position[1])).toBeGreaterThan(0.3)
  })

  it('a altura manda no ângulo quando os dois são pedidos', () => {
    const view = plano(FIGURE, { shot: 'medium', angle: 'birdsEye', cameraHeight: 'ground' })
    expect(view.position[1]).toBeCloseTo(0, 6)
  })

  it('não muda o enquadramento — só de onde se olha', () => {
    const nivel = plano(FIGURE, { shot: 'medium' })
    const joelho = plano(FIGURE, { shot: 'medium', cameraHeight: 'knee' })
    expect(joelho.distance).toBeCloseTo(nivel.distance, 6)
    expect(joelho.target).toEqual(nivel.target)
  })
})

/** A vista de verme é o espelho da aérea, com o chão no caminho (#49). */
describe("Worm's-Eye View", () => {
  it('desce o máximo que o chão permite — mais que o contra-picado', () => {
    const verme = plano(FIGURE, { shot: 'closeUp', angle: 'wormsEye' })
    const contra = plano(FIGURE, { shot: 'closeUp', angle: 'lowAngle' })
    expect(verme.position[1]).toBeGreaterThanOrEqual(-NO_CHAO)
    expect(verme.position[1]).toBeLessThan(contra.position[1])
  })

  it('pede −90°: é a vista aérea de cabeça para baixo, e o chão faz o resto', () => {
    expect(ANGLE_ELEVATION_DEG.wormsEye).toBe(-ANGLE_ELEVATION_DEG.birdsEye)
  })

  it('num plano detalhe alto, chega mesmo a olhar reto para cima', () => {
    // A mão a 1 m do chão, enquadrada a 15 cm: −90° cabem inteiros.
    const view = plano(FIGURE, {
      shot: 'extremeCloseUp',
      selectedJoint: 'wrist.R',
      angle: 'wormsEye',
    })
    expect(view.position[1]).toBeGreaterThan(0)
    expect(view.position[1]).toBeLessThan(view.target[1])
    expect(vec(view.position).x).toBeCloseTo(vec(view.target).x, 6)
    expect(vec(view.position).z).toBeCloseTo(vec(view.target).z, 6)
  })
})

describe('composição fora do centro', () => {
  it('a regra dos terços sobe o sujeito no quadro e abre espaço embaixo', () => {
    const centrado = plano(FIGURE, { shot: 'medium' })
    const terços = plano(FIGURE, { shot: 'medium', thirds: true })
    // O alvo desce: é o que faz o sujeito subir na tela.
    expect(terços.target[1]).toBeLessThan(centrado.target[1])
    // E abre um terço a mais de tela, para nada do plano sair pela borda.
    expect(terços.distance).toBeCloseTo(centrado.distance * 1.5, 6)
  })

  it('o espaço à frente do olhar sai para o lado que o boneco olha', () => {
    // Boneco de perfil, olhando para +X, câmera na frente dele no eixo Z.
    const perfil = { ...FIGURE, rotation: { x: 0, y: 90, z: 0 } }
    const view = plano(perfil, { shot: 'medium', leadRoom: true })
    const centrado = plano(perfil, { shot: 'medium' })
    // O alvo se desloca no sentido do olhar — o sujeito vai para o lado oposto.
    expect(view.target[0]).toBeGreaterThan(centrado.target[0] + 0.1)
    expect(view.target[1]).toBeCloseTo(centrado.target[1], 6)
  })

  it('de frente para a câmera não há lado para abrir, e nada se desloca', () => {
    const view = plano(FIGURE, { shot: 'medium', leadRoom: true })
    const centrado = plano(FIGURE, { shot: 'medium' })
    expect(view.target[0]).toBeCloseTo(centrado.target[0], 6)
  })

  it('as duas compõem juntas sem brigar', () => {
    const perfil = { ...FIGURE, rotation: { x: 0, y: 90, z: 0 } }
    const view = plano(perfil, { shot: 'medium', thirds: true, leadRoom: true })
    const centrado = plano(perfil, { shot: 'medium' })
    expect(view.target[1]).toBeLessThan(centrado.target[1])
    expect(view.target[0]).toBeGreaterThan(centrado.target[0])
    expect(view.distance).toBeCloseTo(centrado.distance * 1.5, 6)
  })
})

describe('computePovView', () => {
  it('põe a câmera nos olhos do boneco, olhando para onde a cabeça aponta', () => {
    const marks = figureLandmarks(FIGURE)
    const view = computePovView(FIGURE)
    // Na altura dos olhos, e não dentro da cabeça: um passo à frente.
    expect(view.position[1]).toBeCloseTo(marks.eyesY, 2)
    expect(vec(view.position).z).toBeGreaterThan(vec(marks.eyes).z)

    const olhar = vec(view.target).sub(vec(view.position)).normalize()
    expect(olhar.dot(vec(marks.gaze))).toBeCloseTo(1, 6)
  })

  it('acompanha a cabeça, não o corpo — o pescoço pode estar torcido', () => {
    const olhandoDeLado = { ...FIGURE, pose: { head: { x: 0, y: 60, z: 0 } } }
    const reto = computePovView(FIGURE)
    const torcido = computePovView(olhandoDeLado)
    const direcao = (view: ReturnType<typeof computePovView>) =>
      vec(view.target).sub(vec(view.position)).normalize()
    expect(direcao(torcido).dot(direcao(reto))).toBeLessThan(0.9)
  })

  it('a câmera nasce fora da cabeça', () => {
    const marks = figureLandmarks(FIGURE)
    const view = computePovView(FIGURE)
    // Mais longe do centro da cabeça que o raio do ovo (~11 cm num 1,70 m).
    const centroDaCabeca = vec(marks.eyes)
    expect(vec(view.position).distanceTo(centroDaCabeca)).toBeGreaterThan(0.12)
  })
})

describe('twoShotPair', () => {
  const a: Figure = { ...FIGURE, id: 'a', position: [0, 0, 0] }
  const b: Figure = { ...FIGURE, id: 'b', position: [1, 0, 0] }
  const c: Figure = { ...FIGURE, id: 'c', position: [8, 0, 0] }

  it('junta o boneco selecionado ao mais próximo dele', () => {
    expect(twoShotPair([a, b, c], 'a')!.map((figure) => figure.id)).toEqual(['a', 'b'])
    expect(twoShotPair([a, b, c], 'c')!.map((figure) => figure.id)).toEqual(['c', 'b'])
  })

  it('não há par sem seleção nem com um boneco só', () => {
    expect(twoShotPair([a, b], null)).toBeNull()
    expect(twoShotPair([a], 'a')).toBeNull()
    expect(twoShotPair([a, b], 'sumido')).toBeNull()
  })

  /**
   * Caber no quadro não basta: olhado do eixo em que os dois estão alinhados,
   * o da frente tapa o de trás. Apareceu na validação no navegador.
   */
  it('escolhe o lado perpendicular ao par, para um não tapar o outro', () => {
    // Par alinhado em X; a câmera vinha justamente desse eixo.
    const direcao = vec(twoShotDirection([a, b], [1, 0, 0]))
    expect(Math.abs(direcao.x)).toBeLessThan(1e-6)
    expect(Math.abs(direcao.z)).toBeCloseTo(1, 6)
  })

  it('fica do lado em que a câmera já estava', () => {
    expect(vec(twoShotDirection([a, b], [0.2, 0, 1])).z).toBeGreaterThan(0)
    expect(vec(twoShotDirection([a, b], [0.2, 0, -1])).z).toBeLessThan(0)
  })

  it('bonecos no mesmo lugar não definem lado, e a direção fica como estava', () => {
    expect(twoShotDirection([a, { ...a, id: 'x' }], [0, 0, 1])).toEqual([0, 0, 1])
    expect(twoShotDirection([a], [0, 0, 1])).toEqual([0, 0, 1])
  })

  it('o par enquadrado deixa os dois no quadro e ignora o terceiro', () => {
    const par = twoShotPair([a, b, c], 'a')!
    const view = grupo(par, { shot: 'medium' })!
    const distanciaAoTerceiro = vec(view.target).distanceTo(
      vec(figureLandmarks(c).bodyCenter),
    )
    expect(distanciaAoTerceiro).toBeGreaterThan(6)
  })
})

/**
 * Vocabulário de prompt (DECISOES.md #47): os termos em inglês vêm das tabelas
 * de referência do usuário e NÃO passam por i18n — são o texto que se digita
 * num gerador de imagem, igual em qualquer idioma da interface.
 */
describe('termos em inglês', () => {
  it('traz um termo para cada plano e cada ângulo, exatamente como na tabela', () => {
    expect(SHOT_KEYS.map((key) => SHOT_TERMS[key])).toEqual([
      'Extreme Wide Shot',
      'Wide Shot',
      'Full Shot',
      'Cowboy Shot',
      'Medium Shot',
      'Medium Close-Up',
      'Close-Up',
      'Extreme Close-Up',
    ])
    expect(ANGLE_KEYS.map((key) => ANGLE_TERMS[key])).toEqual([
      'Eye-Level',
      'Low Angle',
      'High Angle',
      "Bird's-Eye View",
      "Worm's-Eye View",
    ])
    expect(CAMERA_HEIGHT_KEYS.map((key) => CAMERA_HEIGHT_TERMS[key])).toEqual([
      'Ground Level',
      'Knee Level',
      'Hip Level',
      'Shoulder Level',
    ])
    expect(ORIENTATION_KEYS.map((key) => ORIENTATION_TERMS[key])).toEqual([
      'Front View',
      'Three-Quarter Front',
      'Profile View',
      'Three-Quarter Back',
      'Back View',
    ])
    expect(OVER_THE_SHOULDER_TERM).toBe('Over-the-Shoulder')
    expect(DUTCH_ANGLE_TERM).toBe('Dutch Angle')
    expect(POV_TERM).toBe('POV Shot')
    expect(TWO_SHOT_TERM).toBe('Two Shot')
    expect(REVERSE_ANGLE_TERM).toBe('Reverse Angle')
    expect(RULE_OF_THIRDS_TERM).toBe('Rule of Thirds')
    expect(LEAD_ROOM_TERM).toBe('Lead Room')
  })
})
