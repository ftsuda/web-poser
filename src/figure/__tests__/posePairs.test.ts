import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  POSE_PAIRINGS,
  getPosePairing,
  resolvePairedOffset,
  resolvePairedRotation,
} from '../posePairs'
import {
  POSE_PRESET_KEYS,
  resolvePosePreset,
  resolvePosePresetPlacement,
  type PosePresetKey,
} from '../posePresets'
import { buildJointFrames } from '../jointFrames'
import type { Figure } from '../../store/figuresStore'

/** Quem recebeu a pose, girado `headingDeg` no chão (encenação do usuário). */
function anchorFigure(key: PosePresetKey, headingDeg = 0): Figure {
  const placement = resolvePosePresetPlacement(key)
  return {
    id: 'a',
    name: 'A',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, placement.groundOffsetM, 0],
    rotation: placement.preservesHeading ? { ...placement.rotation, y: headingDeg } : placement.rotation,
    pose: resolvePosePreset(key),
  }
}

/**
 * O parceiro montado EXATAMENTE como o store monta (mesmas funções), para que
 * este arquivo teste a montagem de verdade e não uma reprodução dela.
 */
function partnerFigure(key: PosePresetKey, headingDeg = 0): Figure {
  const pairing = getPosePairing(key)!
  const placement = resolvePosePresetPlacement(pairing.counterpart)
  const heading = resolvePosePresetPlacement(key).preservesHeading ? headingDeg : 0
  const [dx, dz] = resolvePairedOffset(pairing.gapM, heading)
  return {
    id: 'b',
    name: 'B',
    color: '#4060e0',
    visible: true,
    height: 1.7,
    position: [dx, placement.groundOffsetM, dz],
    rotation: resolvePairedRotation(pairing.counterpart, heading, pairing.facing),
    pose: resolvePosePreset(pairing.counterpart),
  }
}

function at(figure: Figure, joint: string): THREE.Vector3 {
  const { joints } = buildJointFrames(figure)
  const position = new THREE.Vector3()
  joints.get(joint)!.getWorldPosition(position)
  return position
}

function localPoint(figure: Figure, joint: string, offset: THREE.Vector3): THREE.Vector3 {
  const { joints } = buildJointFrames(figure)
  return offset.clone().applyMatrix4(joints.get(joint)!.matrixWorld)
}

describe('POSE_PAIRINGS', () => {
  /**
   * A lista exata. Fica travada porque o pareamento é o que dispara a
   * aplicação automática no segundo boneco: uma pose entrar aqui por engano
   * desmontaria a pose do outro boneco sem o usuário ter pedido.
   */
  it('cobre as poses em dupla, e só elas', () => {
    expect(Object.keys(POSE_PAIRINGS).sort()).toEqual(
      [
        'armLockPullGiving',
        'armLockPullTaking',
        'armLockPushGiving',
        'armLockPushTaking',
        'beingPulledUp',
        'carriedCradle',
        'carriedPiggyback',
        'carryingCradle',
        'carryingPiggyback',
        'chokeGiving',
        'chokeTaking',
        'clinch',
        'danceFollow',
        'danceLead',
        'groundChokeGiving',
        'groundChokeTaking',
        'handshake',
        'hug',
        'kickGiving',
        'kickTaking',
        'kneeStrikeGiving',
        'kneeStrikeTaking',
        'punchGiving',
        'punchTaking',
        'pullingUp',
        'pushGiving',
        'pushTaking',
        'rearChokeKneeling',
        'rearChokeSeated',
      ].sort(),
    )
    // "Guarda de luta" mora no grupo de luta mas é pose SOLO: não tem contato
    // nenhum que fixe uma distância, então não entra.
    expect(getPosePairing('fighting')).toBeNull()
    expect(getPosePairing('standing')).toBeNull()
  })

  it('todas as chaves existem e apontam para poses existentes', () => {
    for (const [key, pairing] of Object.entries(POSE_PAIRINGS)) {
      expect(POSE_PRESET_KEYS).toContain(key as PosePresetKey)
      expect(POSE_PRESET_KEYS).toContain(pairing.counterpart)
    }
  })

  /**
   * Consistência mútua: a pose do parceiro tem de apontar de volta, com a
   * mesma distância. Sem isso, aplicar a pose A montaria um par diferente do
   * que aplicar a pose B — e o usuário veria o segundo boneco pular de lugar
   * ao trocar qual dos dois recebe a pose.
   */
  it('cada pareamento aponta de volta, com o sinal invertido quando os dois olham para o mesmo lado', () => {
    for (const [key, pairing] of Object.entries(POSE_PAIRINGS)) {
      const back = getPosePairing(pairing.counterpart)
      expect(back).not.toBeNull()
      expect(back!.counterpart).toBe(key)
      expect(back!.facing).toBe(pairing.facing)
      // De frente, a distância é simétrica (cada um está a D à frente do
      // outro); no mesmo sentido ela troca de sinal (quem está atrás vê o
      // outro à frente).
      expect(back!.gapM).toBeCloseTo(pairing.facing ? pairing.gapM : -pairing.gapM, 6)
    }
  })

  it('as poses que servem aos dois bonecos se pareiam consigo mesmas, de frente', () => {
    for (const key of ['handshake', 'hug', 'clinch'] as const) {
      const pairing = getPosePairing(key)!
      expect(pairing.counterpart).toBe(key)
      // Uma pose de mesmo sentido não pode se parear consigo (exigiria
      // distância igual à própria negação, ou seja, zero: os dois no mesmo
      // ponto).
      expect(pairing.facing).toBe(true)
      expect(pairing.gapM).toBeGreaterThan(0)
    }
  })
})

describe('resolvePairedOffset', () => {
  it('mede ao longo do eixo Z de quem recebeu a pose, girando com ele', () => {
    expect(resolvePairedOffset(0.5, 0)).toEqual([0, 0.5])
    expect(resolvePairedOffset(0.5, 90)).toEqual([0.5, 0])
    expect(resolvePairedOffset(0.5, 180)).toEqual([0, -0.5])
    // Sinal negativo = atrás (cavalinho, colo, gravata).
    expect(resolvePairedOffset(-0.5, 0)).toEqual([0, -0.5])
  })

  it('acompanha a escala de altura dos bonecos', () => {
    expect(resolvePairedOffset(0.5, 0, 2)).toEqual([0, 1])
  })
})

describe('resolvePairedRotation', () => {
  it('nas poses em pé é só o giro somado, com os 180° de quem encara', () => {
    expect(resolvePairedRotation('handshake', 0, true)).toEqual({ x: 0, y: 180, z: 0 })
    expect(resolvePairedRotation('handshake', 90, true)).toEqual({ x: 0, y: -90, z: 0 })
    expect(resolvePairedRotation('carriedPiggyback', 30, false)).toEqual({ x: 0, y: 30, z: 0 })
    // Sempre dentro de (-180, 180], sem -0 vazando para a cena salva.
    expect(resolvePairedRotation('handshake', 180, true)).toEqual({ x: 0, y: 0, z: 0 })
    expect(Object.is(resolvePairedRotation('handshake', 180, true).y, -0)).toBe(false)
  })

  /**
   * Nas poses deitadas os ângulos de Euler NÃO se somam: mexer em `y` ali rola
   * o corpo em torno do próprio eixo. A composição correta sai por matriz — e
   * é por isso que o encaixe do par sobrevive a girar quem recebeu a pose
   * (testado logo abaixo, em "o par sobrevive ao giro").
   */
  it('nas poses deitadas compõe a rotação em vez de somar graus em Y', () => {
    expect(resolvePairedRotation('groundChokeTaking', 0, false)).toEqual({ x: -90, y: 0, z: 0 })
    expect(resolvePairedRotation('groundChokeTaking', 90, false)).toEqual({ x: -90, y: 0, z: 90 })
    expect(resolvePairedRotation('carriedCradle', 90, false)).toEqual({ x: -90, y: 0, z: 0 })
  })
})

/**
 * O que faz a tabela valer: montado o par pelo pareamento, os dois corpos se
 * encontram no ponto que define a pose — mão com mão, punho no rosto,
 * antebraço na garganta. São as MESMAS distâncias travadas em
 * `posePresets.test.ts`, só que aqui atravessando a montagem automática.
 * Todos os limites vêm de medição, com folga de poucos milímetros.
 */
describe('o par montado pelo pareamento encaixa', () => {
  it('aperto de mão: as duas mãos direitas se encontram no meio', () => {
    expect(at(anchorFigure('handshake'), 'wrist.R').distanceTo(at(partnerFigure('handshake'), 'wrist.R'))).toBeLessThan(0.06)
  })

  it('abraço: as mãos pousam nas costas do outro e as cabeças não se atravessam', () => {
    const a = anchorFigure('hug')
    const b = partnerFigure('hug')
    expect(at(a, 'wrist.R').distanceTo(at(b, 'chest'))).toBeLessThan(0.2)
    expect(at(a, 'wrist.L').distanceTo(at(b, 'spine'))).toBeLessThan(0.2)
    expect(at(a, 'head').distanceTo(at(b, 'head'))).toBeGreaterThan(0.17)
  })

  it('clinche: testas encostadas, sem atravessar (0,089 de meia-profundidade cada)', () => {
    const heads = at(anchorFigure('clinch'), 'head').distanceTo(at(partnerFigure('clinch'), 'head'))
    expect(heads).toBeGreaterThan(0.17)
    expect(heads).toBeLessThan(0.21)
  })

  it('dança: as mãos dadas se encontram, pelos dois lados do par', () => {
    expect(at(anchorFigure('danceLead'), 'wrist.L').distanceTo(at(partnerFigure('danceLead'), 'wrist.R'))).toBeLessThan(0.01)
    expect(at(anchorFigure('danceFollow'), 'wrist.R').distanceTo(at(partnerFigure('danceFollow'), 'wrist.L'))).toBeLessThan(0.01)
  })

  it('cavalinho: o passageiro monta 0,195 m acima, com a mão de quem carrega na coxa dele', () => {
    const carrier = anchorFigure('carryingPiggyback')
    const rider = partnerFigure('carryingPiggyback')
    expect(at(rider, 'root').y - at(carrier, 'root').y).toBeCloseTo(0.195, 2)
    expect(at(carrier, 'wrist.L').distanceTo(at(rider, 'knee.L'))).toBeLessThan(0.1)
    // E pelo outro lado do par: aplicar "carregado" traz quem carrega para a
    // frente, com as mãos do passageiro no peito dele.
    expect(at(anchorFigure('carriedPiggyback'), 'wrist.L').distanceTo(at(partnerFigure('carriedPiggyback'), 'chest'))).toBeLessThan(0.2)
  })

  it('colo: o corpo atravessado pousa exatamente sobre os antebraços', () => {
    expect(at(anchorFigure('carryingCradle'), 'wrist.L').distanceTo(at(partnerFigure('carryingCradle'), 'chest'))).toBeLessThan(0.08)
  })

  it('puxar para levantar: as duas mãos se encontram', () => {
    expect(at(anchorFigure('pullingUp'), 'wrist.R').distanceTo(at(partnerFigure('pullingUp'), 'wrist.R'))).toBeLessThan(0.03)
  })

  it('empurrão: as mãos caem na superfície do peito de quem leva', () => {
    expect(at(anchorFigure('pushGiving'), 'wrist.L').distanceTo(at(partnerFigure('pushGiving'), 'chest'))).toBeLessThan(0.22)
  })

  it('soco: o punho chega ao rosto de quem leva', () => {
    const face = localPoint(partnerFigure('punchGiving'), 'head', new THREE.Vector3(0, 0.02, 0.095))
    expect(at(anchorFigure('punchGiving'), 'wrist.R').distanceTo(face)).toBeLessThan(0.1)
  })

  it('chute: o pé chega à barriga de quem leva', () => {
    expect(at(anchorFigure('kickGiving'), 'ankle.R').distanceTo(at(partnerFigure('kickGiving'), 'spine'))).toBeLessThan(0.05)
  })

  it('joelhada: o joelho chega à barriga de quem leva', () => {
    // Altura exata (0,0 cm de erro); os 6,5 cm de folga são o desvio do
    // joelho em relação à linha média, já medido e aceito na resolução da
    // pose (`posePresets.ts`).
    expect(
      at(anchorFigure('kneeStrikeGiving'), 'knee.R').distanceTo(at(partnerFigure('kneeStrikeGiving'), 'spine')),
    ).toBeLessThan(0.07)
  })

  it('chave de braço: o joelho de quem aplica chega às costas de quem leva (empurrão e puxão)', () => {
    // Os 9 cm de folga são o offset lateral fixo do quadril (`knee.R` nunca
    // cai exatamente na linha média da coluna — mesma leitura do "chute" e da
    // "joelhada" acima). A ALTURA é o que foi varrido numericamente: 4,2 cm de
    // erro no empurrão, 0,1 cm no puxão (a mesma perna ativa de quem aplica
    // não muda entre os dois instantes; é o `hipHeightM` de quem leva que
    // muda) — medido em `posePresets.ts`.
    expect(
      at(anchorFigure('armLockPushGiving'), 'knee.R').distanceTo(at(partnerFigure('armLockPushGiving'), 'spine')),
    ).toBeLessThan(0.11)
    expect(
      at(anchorFigure('armLockPullGiving'), 'knee.R').distanceTo(at(partnerFigure('armLockPullGiving'), 'spine')),
    ).toBeLessThan(0.11)
  })

  it('chave de braço: o punho de quem aplica encontra o punho preso de quem leva (empurrão e puxão)', () => {
    expect(
      at(anchorFigure('armLockPushGiving'), 'wrist.L').distanceTo(at(partnerFigure('armLockPushGiving'), 'wrist.R')),
    ).toBeLessThan(0.02)
    // O puxão aprofunda a chave (punho mais alto, mais para trás) — a
    // varredura numérica converge com folga maior (8,9 cm) neste instante.
    expect(
      at(anchorFigure('armLockPullGiving'), 'wrist.L').distanceTo(at(partnerFigure('armLockPullGiving'), 'wrist.R')),
    ).toBeLessThan(0.1)
  })

  it('gravata: os dois punhos envolvem o pescoço de quem recebe, por trás', () => {
    const giving = anchorFigure('chokeGiving')
    const taking = partnerFigure('chokeGiving')
    for (const side of ['L', 'R'] as const) {
      expect(at(giving, `wrist.${side}`).distanceTo(at(taking, 'neck'))).toBeLessThan(0.12)
    }
    // Por TRÁS: quem recebe fica à frente, olhando para o mesmo lado.
    expect(taking.position[2]).toBeGreaterThan(giving.position[2])
    expect(taking.rotation.y).toBe(giving.rotation.y)
  })

  it('mata-leão ajoelhado: o antebraço cruza a garganta de quem senta', () => {
    expect(at(anchorFigure('rearChokeKneeling'), 'wrist.R').distanceTo(at(partnerFigure('rearChokeKneeling'), 'neck'))).toBeLessThan(0.13)
  })

  it('mata-leão deitado: punho na garganta e as duas cabeças lado a lado', () => {
    const giving = anchorFigure('groundChokeGiving')
    const taking = partnerFigure('groundChokeGiving')
    const throat = localPoint(taking, 'neck', new THREE.Vector3(0, 0.02, 0.085))
    expect(at(giving, 'wrist.R').distanceTo(throat)).toBeLessThan(0.06)
    expect(at(giving, 'head').distanceTo(at(taking, 'head'))).toBeGreaterThan(0.18)
    // Empilhados: quem recebe fica POR CIMA.
    expect(taking.position[1]).toBeGreaterThan(giving.position[1])
  })

  /**
   * O par é um corpo rígido: girar quem recebeu a pose gira a montagem
   * inteira. É a trava contra a armadilha de somar graus em Y — que passaria
   * despercebida a 0° e desmontaria o par em qualquer outro ângulo.
   */
  it('o par sobrevive ao giro de quem recebeu a pose', () => {
    for (const heading of [0, 37, 90, -120, 180]) {
      expect(
        at(anchorFigure('handshake', heading), 'wrist.R').distanceTo(at(partnerFigure('handshake', heading), 'wrist.R')),
      ).toBeLessThan(0.06)
      // Inclusive quando a pose do parceiro é deitada (o colo), onde a
      // composição da rotação tem de ser feita por matriz.
      expect(
        at(anchorFigure('carryingCradle', heading), 'wrist.L').distanceTo(
          at(partnerFigure('carryingCradle', heading), 'chest'),
        ),
      ).toBeLessThan(0.08)
    }
  })
})
