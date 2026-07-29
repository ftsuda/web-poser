import { beforeEach, describe, expect, it } from 'vitest'
import { useFiguresStore } from '../figuresStore'
import { lowestJointY, neutralGroundClearanceM, seatOnGround } from '../../figure/poseGround'
import { REFERENCE_HEIGHT_M } from '../../figure/skeleton'
import { resolvePosePreset } from '../../figure/posePresets'

/**
 * Os dois auxílios de posar da entrega de 2026-07-28 (itens 33 e 3 do backlog):
 * assentar o boneco no chão e espelhar as edições ao vivo.
 */

function boneco() {
  const id = useFiguresStore.getState().addFigure()!
  useFiguresStore.getState().applyPosePreset(id, 'standing')
  return id
}

const figura = (id: string) => useFiguresStore.getState().figures.find((f) => f.id === id)!

describe('assentar no chão', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('levanta o boneco cuja pose afunda — a ponta do pé estendida', () => {
    const id = boneco()
    useFiguresStore.getState().setJointRotation(id, 'ankle.R', { x: 45 })
    expect(figura(id).position[1]).toBe(0)

    useFiguresStore.getState().seatFigureOnGround(id)

    const posto = figura(id)
    expect(posto.position[1]).toBeGreaterThan(0)
    expect(lowestJointY(posto.pose, posto.rotation) + posto.position[1]).toBeCloseTo(
      neutralGroundClearanceM(),
      9,
    )
  })

  /** É a diferença para a correção de chão da mistura (#43), que só levanta. */
  it('BAIXA o boneco que ficou flutuando', () => {
    const id = boneco()
    useFiguresStore.getState().setPosition(id, [0, 0.4, 0])

    useFiguresStore.getState().seatFigureOnGround(id)

    expect(figura(id).position[1]).toBeCloseTo(0, 9)
  })

  it('acompanha a escala do boneco: um de 1,50 m assenta proporcionalmente', () => {
    const id = boneco()
    useFiguresStore.getState().setHeight(id, 1.5)
    useFiguresStore.getState().setJointRotation(id, 'ankle.R', { x: 45 })

    useFiguresStore.getState().seatFigureOnGround(id)

    const posto = figura(id)
    expect(posto.position[1]).toBeCloseTo(seatOnGround(posto.pose, posto.rotation, 1.5), 12)
    // E é o mesmo valor da altura de referência, reescalado.
    expect(posto.position[1]).toBeCloseTo(
      seatOnGround(posto.pose, posto.rotation, REFERENCE_HEIGHT_M) * (1.5 / REFERENCE_HEIGHT_M),
      12,
    )
  })

  it('mexe só na altura: lugar no chão e pose ficam onde estavam', () => {
    const id = boneco()
    useFiguresStore.getState().setPosition(id, [2, 0.4, -3])
    const antes = figura(id)

    useFiguresStore.getState().seatFigureOnGround(id)

    const depois = figura(id)
    expect([depois.position[0], depois.position[2]]).toEqual([2, -3])
    expect(depois.pose).toBe(antes.pose)
  })

  it('é conteúdo: dá para desfazer', () => {
    const id = boneco()
    useFiguresStore.getState().setPosition(id, [0, 0.4, 0])
    useFiguresStore.getState().seatFigureOnGround(id)
    expect(figura(id).position[1]).toBeCloseTo(0, 9)

    useFiguresStore.temporal.getState().undo()
    expect(figura(id).position[1]).toBe(0.4)
  })

  it('boneco inexistente não faz nada', () => {
    const id = boneco()
    useFiguresStore.getState().seatFigureOnGround('figure-inexistente')
    expect(figura(id).position[1]).toBe(0)
  })
})

describe('espelho ao vivo', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  it('nasce desligado — o modo é escolha explícita de quem posa', () => {
    expect(useFiguresStore.getState().liveMirrorEnabled).toBe(false)
  })

  /**
   * **A referência invertida dos lados.** As juntas pareadas do esqueleto são
   * espelhadas só em POSIÇÃO (offset X negado), sem espelhar a rotação — então
   * o MESMO valor numérico em Y/Z produz o movimento anatômico OPOSTO nos dois
   * lados (DECISOES.md #14). Copiar o valor cru para o outro lado erra até
   * 0,95 m de posição de junta; a reflexão sagital correta é `(x, −y, −z)`, e é
   * a mesma regra do "copiar direito → esquerdo" (#30).
   */
  it('escreve no par a reflexão sagital: X preservado, Y e Z NEGADOS', () => {
    const id = boneco()
    useFiguresStore.getState().toggleLiveMirror()

    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -40, y: 25, z: 30 })

    expect(figura(id).pose['shoulder.L']).toEqual({ x: -40, y: 25, z: 30 })
    expect(figura(id).pose['shoulder.R']).toEqual({ x: -40, y: -25, z: -30 })
  })

  it('vale nos dois sentidos: editar a direita escreve na esquerda', () => {
    const id = boneco()
    useFiguresStore.getState().toggleLiveMirror()

    useFiguresStore.getState().setJointRotation(id, 'knee.R', { x: 60 })

    expect(figura(id).pose['knee.L'].x).toBe(60)
  })

  /**
   * O slider manda um eixo por vez. Espelhar só o eixo recebido deixaria o
   * outro lado meio espelhado — o destino tem de receber a reflexão da rotação
   * INTEIRA que a junta de origem ficou tendo.
   */
  it('edição de um eixo só espelha a rotação inteira, não só o eixo mexido', () => {
    const id = boneco()
    useFiguresStore.getState().toggleLiveMirror()
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -40, y: 25, z: 30 })

    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { y: 10 })

    expect(figura(id).pose['shoulder.R']).toEqual({ x: -40, y: -10, z: -30 })
  })

  it('desligado, o outro lado não se mexe', () => {
    const id = boneco()
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -40, y: 25 })

    expect(figura(id).pose['shoulder.R']).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('junta central não tem par: tronco e cabeça seguem sozinhos', () => {
    const id = boneco()
    useFiguresStore.getState().toggleLiveMirror()
    const antes = figura(id).pose

    useFiguresStore.getState().setJointRotation(id, 'spine', { y: 20 })

    expect(figura(id).pose['spine'].y).toBe(20)
    for (const jointName of Object.keys(antes)) {
      if (jointName !== 'spine') expect(figura(id).pose[jointName]).toEqual(antes[jointName])
    }
  })

  /** Junta travada não muda por NADA automático (#42) — nem pelo espelho. */
  it('junta de destino travada fica intacta', () => {
    const id = boneco()
    useFiguresStore.getState().toggleLiveMirror()
    useFiguresStore.getState().toggleJointLock(id, 'shoulder.R')

    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -40, y: 25 })

    expect(figura(id).pose['shoulder.L']).toEqual({ x: -40, y: 25, z: 0 })
    expect(figura(id).pose['shoulder.R']).toEqual({ x: 0, y: 0, z: 0 })
  })

  /**
   * O polegar é a demonstração mais crua da referência invertida: o mesmo
   * movimento vai de 0 a +80 no lado esquerdo e de 0 a −80 no direito
   * (`skeleton.ts`). Copiar o valor cru não erraria "um pouco" — cairia fora da
   * faixa do destino e seria grampeado a zero, ou seja, o polegar direito
   * simplesmente não se mexeria.
   */
  it('alcança as juntas da mão, e é onde a referência invertida mais aparece', () => {
    const id = boneco()
    useFiguresStore.getState().toggleLiveMirror()

    useFiguresStore.getState().setJointRotation(id, 'thumb1.L', { z: 60 })

    expect(figura(id).pose['thumb1.L'].z).toBe(60)
    expect(figura(id).pose['thumb1.R'].z).toBe(-60)
  })

  it('o modo é de trabalho, não conteúdo: ligar e desligar não entra no undo', () => {
    const id = boneco()
    const passos = useFiguresStore.temporal.getState().pastStates.length

    useFiguresStore.getState().toggleLiveMirror()
    useFiguresStore.getState().toggleLiveMirror()

    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(passos)
    expect(figura(id).pose['shoulder.R']).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('zerar por grupo', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const NEUTRA = resolvePosePreset('standing')

  it('zera o grupo inteiro e não toca em mais nada', () => {
    const id = boneco()
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -50, z: 20 })
    useFiguresStore.getState().setJointRotation(id, 'shoulder.L', { x: -50, z: -20 })
    useFiguresStore.getState().setJointRotation(id, 'knee.R', { x: 40 })

    useFiguresStore.getState().resetJointGroup(id, 'armRight')

    const pose = figura(id).pose
    expect(pose['shoulder.R']).toEqual(NEUTRA['shoulder.R'])
    // O outro braço e a perna continuam onde estavam.
    expect(pose['shoulder.L'].x).toBe(-50)
    expect(pose['knee.R'].x).toBe(40)
  })

  /**
   * "Zerar" é voltar à pose NEUTRA, não a zeros literais — e a diferença é
   * visível: `elbow.*.y` tem torção neutra de ±90 (DECISOES.md #25), então
   * escrever zero deixaria o antebraço com a palma para trás. É a mesma regra
   * do reset por junta (fase 9, item 6), reusada.
   */
  it('volta à pose neutra, não a zeros literais — a torção do antebraço fica certa', () => {
    const id = boneco()
    useFiguresStore.getState().setJointRotation(id, 'elbow.R', { x: -90, y: 0 })

    useFiguresStore.getState().resetJointGroup(id, 'armRight')

    expect(figura(id).pose['elbow.R'].y).toBe(-90)
    expect(figura(id).pose['elbow.R']).toEqual(NEUTRA['elbow.R'])
  })

  it('a mão faz parte do braço: os dedos voltam junto', () => {
    const id = boneco()
    useFiguresStore.getState().applyHandPreset(id, 'R', 'fist')
    expect(figura(id).pose['fingersMid.R']).not.toEqual(NEUTRA['fingersMid.R'])

    useFiguresStore.getState().resetJointGroup(id, 'armRight')

    expect(figura(id).pose['fingersMid.R']).toEqual(NEUTRA['fingersMid.R'])
  })

  it('junta travada no meio do grupo sobrevive ao reset', () => {
    const id = boneco()
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -50 })
    useFiguresStore.getState().setJointRotation(id, 'elbow.R', { x: -70 })
    useFiguresStore.getState().toggleJointLock(id, 'elbow.R')

    useFiguresStore.getState().resetJointGroup(id, 'armRight')

    expect(figura(id).pose['shoulder.R']).toEqual(NEUTRA['shoulder.R'])
    expect(figura(id).pose['elbow.R'].x).toBe(-70)
  })

  it('é conteúdo: dá para desfazer', () => {
    const id = boneco()
    useFiguresStore.getState().setJointRotation(id, 'knee.L', { x: 55 })
    useFiguresStore.getState().resetJointGroup(id, 'legLeft')
    expect(figura(id).pose['knee.L']).toEqual(NEUTRA['knee.L'])

    useFiguresStore.temporal.getState().undo()
    expect(figura(id).pose['knee.L'].x).toBe(55)
  })

  it('com o grupo todo travado, nada acontece — nem um passo de undo', () => {
    const id = boneco()
    useFiguresStore.getState().setJointRotation(id, 'neck', { y: 30 })
    for (const jointName of ['neck', 'head']) useFiguresStore.getState().toggleJointLock(id, jointName)
    const passos = useFiguresStore.temporal.getState().pastStates.length

    useFiguresStore.getState().resetJointGroup(id, 'head')

    expect(figura(id).pose['neck'].y).toBe(30)
    expect(useFiguresStore.temporal.getState().pastStates.length).toBe(passos)
  })
})

describe('copiar só um membro', () => {
  beforeEach(() => {
    useFiguresStore.setState(useFiguresStore.getInitialState())
    useFiguresStore.temporal.getState().clear()
  })

  const doisBonecos = () => {
    const origem = boneco()
    const destino = boneco()
    return { origem, destino }
  }

  it('leva só as juntas do grupo pedido', () => {
    const { origem, destino } = doisBonecos()
    useFiguresStore.getState().setJointRotation(origem, 'shoulder.R', { x: -60, z: 25 })
    useFiguresStore.getState().setJointRotation(origem, 'knee.R', { x: 70 })

    useFiguresStore.getState().copyFigurePose(origem, destino, 'armRight')

    expect(figura(destino).pose['shoulder.R']).toEqual(figura(origem).pose['shoulder.R'])
    // A perna do destino não foi tocada.
    expect(figura(destino).pose['knee.R'].x).toBe(0)
  })

  /**
   * Copiar um braço não pode reassentar quem recebe: o assentamento (inclinação
   * e altura do quadril) é da pose INTEIRA, e aplicá-lo por causa de um membro
   * tiraria o boneco do chão onde ele estava.
   */
  it('não mexe na colocação de quem recebe — nem inclinação, nem altura', () => {
    const { origem, destino } = doisBonecos()
    useFiguresStore.getState().applyPosePreset(origem, 'lyingHandsBehindHead')
    useFiguresStore.getState().setPosition(destino, [2, 0, -1])
    const antes = figura(destino)

    useFiguresStore.getState().copyFigurePose(origem, destino, 'armRight')

    const depois = figura(destino)
    expect(depois.position).toEqual(antes.position)
    expect(depois.rotation).toEqual(antes.rotation)
    expect(depois.pose['shoulder.R']).toEqual(figura(origem).pose['shoulder.R'])
  })

  it('sem grupo continua copiando a pose inteira, com assentamento', () => {
    const { origem, destino } = doisBonecos()
    useFiguresStore.getState().applyPosePreset(origem, 'lyingHandsBehindHead')

    useFiguresStore.getState().copyFigurePose(origem, destino)

    expect(figura(destino).rotation).toEqual(figura(origem).rotation)
    expect(figura(destino).position[1]).toBeCloseTo(figura(origem).position[1], 9)
  })

  it('junta travada no destino continua intocada', () => {
    const { origem, destino } = doisBonecos()
    useFiguresStore.getState().setJointRotation(origem, 'elbow.L', { x: -80 })
    useFiguresStore.getState().toggleJointLock(destino, 'elbow.L')

    useFiguresStore.getState().copyFigurePose(origem, destino, 'armLeft')

    expect(figura(destino).pose['elbow.L'].x).toBe(0)
  })

  it('copiar para si mesmo não faz nada', () => {
    const id = boneco()
    useFiguresStore.getState().setJointRotation(id, 'shoulder.R', { x: -60 })

    useFiguresStore.getState().copyFigurePose(id, id, 'armRight')

    expect(figura(id).pose['shoulder.R'].x).toBe(-60)
  })
})
