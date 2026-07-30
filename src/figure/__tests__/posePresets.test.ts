import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { JOINT_NAMES, ROOT_JOINT_NAME, getJoint, getJointAxes, type JointRotation } from '../skeleton'
import { resolveHandPreset } from '../handPresets'
import {
  POSE_PRESET_GROUPS,
  POSE_PRESET_KEYS,
  getPosePresetHands,
  resolvePosePreset,
  resolvePosePresetPlacement,
  type PosePresetKey,
} from '../posePresets'
import { buildJointFrames } from '../jointFrames'
import type { Figure } from '../../store/figuresStore'

function figureWithPose(pose: Record<string, JointRotation>): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose,
  }
}

/**
 * Normal do plano da mão (produto vetorial `wrist`→`fingersBase` ×
 * `wrist`→`thumb1`) — a métrica confiável para "para onde a palma aponta",
 * usada em vez de checar só a posição do polegar (proxy que já aprovou por
 * engano um valor errado de `elbow.R.y`, ver DECISOES.md #22).
 *
 * A ordem dos operandos é invertida no lado R: mão direita é a imagem
 * espelhada da esquerda (quiralidade), e o produto vetorial (um
 * pseudovetor) não respeita reflexão como um vetor de posição comum — usar
 * a MESMA ordem nos dois lados e comparar os sinais dá um "conflito" que
 * não existe de verdade (foi exatamente esse erro de método que levou à
 * correção equivocada `elbow.R.y=135`, revertida depois que o usuário
 * relatou o polegar visualmente para trás — ver DECISOES.md #23).
 */
function palmNormal(figure: Figure, side: 'L' | 'R'): THREE.Vector3 {
  const { joints } = buildJointFrames(figure)
  const wrist = new THREE.Vector3()
  joints.get(`wrist.${side}`)!.getWorldPosition(wrist)
  const fingersBase = new THREE.Vector3()
  joints.get(`fingersBase.${side}`)!.getWorldPosition(fingersBase)
  const thumb1 = new THREE.Vector3()
  joints.get(`thumb1.${side}`)!.getWorldPosition(thumb1)
  const dirFingers = fingersBase.clone().sub(wrist).normalize()
  const dirThumb = thumb1.clone().sub(wrist).normalize()
  return side === 'L'
    ? new THREE.Vector3().crossVectors(dirFingers, dirThumb).normalize()
    : new THREE.Vector3().crossVectors(dirThumb, dirFingers).normalize()
}

describe('resolvePosePreset', () => {
  /** A lista de chaves é DERIVADA dos grupos — esta é a trava dos dois sentidos. */
  it('every pose belongs to exactly one group, and the keys are the groups flattened', () => {
    const fromGroups = POSE_PRESET_GROUPS.flatMap((group) => group.poses)
    expect(POSE_PRESET_KEYS).toEqual(fromGroups)
    expect(new Set(fromGroups).size).toBe(fromGroups.length)
    expect(POSE_PRESET_KEYS).toHaveLength(83)
  })

  it('groups the poses in the order shown in the panel', () => {
    expect(POSE_PRESET_GROUPS.map((group) => group.key)).toEqual([
      'reference',
      'everyday',
      'ground',
      'pointing',
      'action',
      'expressive',
      'kpop',
      'pairs',
      'fight',
    ])
    expect(POSE_PRESET_GROUPS[0].poses).toEqual(['standing', 'tpose', 'apose'])
    expect(POSE_PRESET_GROUPS[3].poses).toHaveLength(8)
  })

  it('standing is the neutral pose (every joint at 0, except the forearm neutral twist — a true sign-mirror between L/R)', () => {
    const pose = resolvePosePreset('standing')
    for (const jointName of JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)) {
      if (jointName === 'elbow.L') {
        // Torção neutra do antebraço, NÃO zero — ver DECISOES.md #22/#25:
        // a mão é modelada alinhada aos eixos locais do punho (palma em -Z)
        // e são estes 90° que a giram para a palma voltada à coxa;
        // elbow.y=0 significa palma para trás (pronação máxima).
        expect(pose[jointName]).toEqual({ x: 0, y: 90, z: 0 })
      } else if (jointName === 'elbow.R') {
        // Espelho de sinal simples (-90), ver DECISOES.md #23/#25.
        expect(pose[jointName]).toEqual({ x: 0, y: -90, z: 0 })
      } else {
        expect(pose[jointName]).toEqual({ x: 0, y: 0, z: 0 })
      }
    }
  })

  it('tpose and standing differ ONLY in shoulder.{L,R} — the hand/forearm never moves independently of the shoulder, on EITHER side (pedido do usuário, ver DECISOES.md #23)', () => {
    const standing = resolvePosePreset('standing')
    const tpose = resolvePosePreset('tpose')
    for (const jointName of JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)) {
      if (jointName === 'shoulder.L' || jointName === 'shoulder.R') continue
      expect(tpose[jointName]).toEqual(standing[jointName])
    }
  })

  it.each(POSE_PRESET_KEYS)('%s covers every posable joint and respects skeleton.ts limits on every axis', (key) => {
    const pose = resolvePosePreset(key)

    for (const jointName of JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)) {
      expect(pose[jointName]).toBeDefined()
      for (const axis of ['x', 'y', 'z'] as const) {
        const limit = getJoint(jointName).limits[axis]
        if (limit) {
          expect(pose[jointName][axis]).toBeGreaterThanOrEqual(limit.min)
          expect(pose[jointName][axis]).toBeLessThanOrEqual(limit.max)
        } else {
          // Eixo sem grau de liberdade: sempre travado em 0, mesmo que o preset tente algo diferente.
          expect(pose[jointName][axis]).toBe(0)
        }
      }
    }
  })

  it('tpose extends both arms horizontally with the palm EXACTLY parallel to the ground (plano da mão, não só o polegar) — ver DECISOES.md #24', () => {
    const pose = resolvePosePreset('tpose')
    expect(pose['shoulder.L'].z).toBeGreaterThan(0)
    expect(pose['shoulder.R'].z).toBeLessThan(0)

    const figure = figureWithPose(pose)
    for (const side of ['L', 'R'] as const) {
      const normal = palmNormal(figure, side)
      // Palma EXATAMENTE para baixo (não só "dominante em -Y") — offsets de
      // `thumb1`/`fingersBase` ajustados na modelagem para isso, ver
      // DECISOES.md #24.
      expect(normal.x).toBeCloseTo(0, 5)
      expect(normal.y).toBeCloseTo(-1, 5)
      expect(normal.z).toBeCloseTo(0, 5)
    }
  })

  it('tpose: both thumbs point forward (+Z), same quality on both sides', () => {
    const figure = figureWithPose(resolvePosePreset('tpose'))
    const { joints } = buildJointFrames(figure)

    for (const side of ['L', 'R'] as const) {
      const wrist = new THREE.Vector3()
      joints.get(`wrist.${side}`)!.getWorldPosition(wrist)
      const thumb1 = new THREE.Vector3()
      joints.get(`thumb1.${side}`)!.getWorldPosition(thumb1)
      expect(thumb1.z).toBeGreaterThan(wrist.z)
    }
  })

  it('standing: the resting forearm twist leaves the palm EXACTLY sideways (toward the thigh), not front/back — ver DECISOES.md #24', () => {
    const figure = figureWithPose(resolvePosePreset('standing'))
    for (const side of ['L', 'R'] as const) {
      const normal = palmNormal(figure, side)
      // Normal do plano da mão: EXATAMENTE lateral (X puro), não só
      // "dominante em X" — mesmo ajuste de modelagem do #24 que deixa a
      // T-pose com a palma exatamente para baixo também deixa a pose "em
      // pé" com a palma exatamente lateral (mesma rotação rígida).
      expect(Math.abs(normal.x)).toBeCloseTo(1, 5)
      expect(normal.y).toBeCloseTo(0, 5)
      expect(normal.z).toBeCloseTo(0, 5)
    }
  })

  it('sitting bends both hips forward (negative x, per skeleton.ts convention) and knees forward', () => {
    const pose = resolvePosePreset('sitting')
    expect(pose['hip.L'].x).toBeLessThan(0)
    expect(pose['hip.R'].x).toBeLessThan(0)
    expect(pose['knee.L'].x).toBeGreaterThan(0)
    expect(pose['knee.R'].x).toBeGreaterThan(0)
  })

  it('walking and running swing the arms opposite to the legs on each side (contralateral gait)', () => {
    for (const key of ['walking', 'running'] as const) {
      const pose = resolvePosePreset(key)
      // Perna esquerda para frente (hip.L > 0) deve vir com braço esquerdo para trás (shoulder.L < 0), e vice-versa do lado direito.
      expect(Math.sign(pose['hip.L'].x)).not.toBe(Math.sign(pose['shoulder.L'].x))
      expect(Math.sign(pose['hip.R'].x)).not.toBe(Math.sign(pose['shoulder.R'].x))
    }
  })

  it('running bends the knees more than walking, for a more dynamic pose', () => {
    const walking = resolvePosePreset('walking')
    const running = resolvePosePreset('running')
    expect(running['knee.L'].x).toBeGreaterThan(walking['knee.L'].x)
  })

  it('does not include the root joint (position/rotation are handled separately)', () => {
    const pose = resolvePosePreset('sitting')
    expect(pose[ROOT_JOINT_NAME]).toBeUndefined()
  })

  it('only sets values on axes that are actual degrees of freedom of each joint', () => {
    const pose = resolvePosePreset('sitting')
    for (const jointName of Object.keys(pose)) {
      const axes = getJointAxes(jointName)
      for (const axis of ['x', 'y', 'z'] as const) {
        if (!axes.includes(axis)) expect(pose[jointName][axis]).toBe(0)
      }
    }
  })
})

/**
 * Poses acrescentadas no DECISOES.md #30. Os ângulos delas não foram deduzidos
 * e sim resolvidos por busca numérica contra alvos geométricos (punho atrás da
 * cabeça, mãos em volta das canelas, punhos na altura do rosto, mão na
 * cintura); estes testes travam justamente esses alvos, para que um ajuste
 * futuro num offset do esqueleto não desmonte as poses em silêncio.
 */
describe('poses e colocação no chão (DECISOES.md #30)', () => {
  /** Boneco com a pose E a colocação do preset — como o store o monta. */
  function placedFigure(key: PosePresetKey): Figure {
    const placement = resolvePosePresetPlacement(key)
    return {
      ...figureWithPose(resolvePosePreset(key)),
      position: [0, placement.groundOffsetM, 0],
      rotation: placement.rotation,
    }
  }

  function worldPositions(figure: Figure): Map<string, THREE.Vector3> {
    const { joints } = buildJointFrames(figure)
    const out = new Map<string, THREE.Vector3>()
    for (const name of JOINT_NAMES) {
      const v = new THREE.Vector3()
      joints.get(name)!.getWorldPosition(v)
      out.set(name, v)
    }
    return out
  }

  /**
   * Pirueta de balé (pedido do usuário): as duas medidas que DEFINEM a pose,
   * e que a varredura numérica resolveu — o pé levantado encosta no joelho de
   * apoio e o joelho levantado aponta para FORA. Sem a segunda, o resultado é
   * um "coupé" de rua com o joelho à frente, não um passé.
   */
  it('balletPirouette: o pé levantado fica no joelho de apoio, com o joelho aberto de lado', () => {
    const mundo = worldPositions(placedFigure('balletPirouette'))

    const peLevantado = mundo.get('ankle.R')!
    const joelhoApoio = mundo.get('knee.L')!
    expect(peLevantado.distanceTo(joelhoApoio)).toBeLessThan(0.09)

    // Joelho aberto para o lado do próprio boneco (x negativo é a direita
    // dele) e à frente do quadril — a abertura do en dehors.
    const joelhoLevantado = mundo.get('knee.R')!
    expect(joelhoLevantado.x).toBeLessThan(-0.25)
    expect(joelhoLevantado.z).toBeGreaterThan(0.15)
  })

  it('balletPirouette: apoia numa perna só, esticada e na meia-ponta', () => {
    const pose = resolvePosePreset('balletPirouette')
    const mundo = worldPositions(placedFigure('balletPirouette'))

    expect(pose['knee.L'].x).toBe(0)
    // Meia-ponta: o calcanhar sobe e quem fica por baixo é a ponta do pé.
    expect(mundo.get('ball.L')!.y).toBeLessThan(mundo.get('ankle.L')!.y)
    // A perna levantada não toca o chão.
    expect(mundo.get('ball.R')!.y).toBeGreaterThan(0.3)
  })

  it('balletPirouette: braços em coroa, mãos próximas à frente do corpo', () => {
    const mundo = worldPositions(placedFigure('balletPirouette'))
    const punhoL = mundo.get('wrist.L')!
    const punhoR = mundo.get('wrist.R')!

    expect(punhoL.distanceTo(punhoR)).toBeLessThan(0.25)
    expect(punhoL.z).toBeGreaterThan(0.2)
    expect(punhoR.z).toBeGreaterThan(0.2)
  })

  it('balletPreparation: plié com os dois pés no chão e os braços abertos', () => {
    const pose = resolvePosePreset('balletPreparation')
    const mundo = worldPositions(placedFigure('balletPreparation'))

    // Os dois joelhos dobrados, e o quadril mais baixo que em pé.
    expect(pose['knee.L'].x).toBeGreaterThan(30)
    expect(pose['knee.R'].x).toBeGreaterThan(30)
    expect(mundo.get('root')!.y).toBeLessThan(0.87)

    // Simétrica: espelho exato entre os dois lados, sem o desvio que um sinal
    // errado de clavícula produz (o limite do lado direito grampeia em zero).
    expect(mundo.get('wrist.L')!.x).toBeCloseTo(-mundo.get('wrist.R')!.x, 6)
    expect(mundo.get('wrist.L')!.y).toBeCloseTo(mundo.get('wrist.R')!.y, 6)
    // Braços abertos de lado, e não caídos ao longo do corpo.
    expect(mundo.get('wrist.L')!.x).toBeGreaterThan(0.45)
  })

  it.each(POSE_PRESET_KEYS)('%s: nenhuma junta atravessa o chão', (key) => {
    for (const [name, position] of worldPositions(placedFigure(key))) {
      expect(`${name} y=${position.y.toFixed(3)}`).toBe(`${name} y=${Math.max(0, position.y).toFixed(3)}`)
    }
  })

  // Todas as poses de luta plantam os dois pés, menos a que chuta — essa tem
  // uma perna no ar por definição.
  const GROUNDED: readonly PosePresetKey[] = [
    'standing',
    'tpose',
    'sitting',
    'fetal',
    'fighting',
    'model',
    'punchGiving',
    'punchTaking',
    'kickTaking',
    'kneeStrikeTaking',
    'chokeGiving',
    'chokeTaking',
    // Expressivas e pares em pé (#37) — todas plantadas; as que tiram um pé
    // do chão de propósito (arremesso, empurrão, subir degrau, escalar,
    // chutar a bola, saltar) ficam de fora.
    'armsCrossed',
    'handsOnHips',
    'waving',
    'celebrating',
    'handOnChin',
    'headDown',
    'startled',
    // Dança pop (K-pop): as 4 usam a base em pé (ou a "Modelo", já na lista) —
    // nenhuma tira o pé do chão de propósito.
    'kpopFingerHeart',
    'kpopBoxArms',
    'kpopPointDance',
    'kpopShoulderWave',
    'carryingBox',
    'handshake',
    'hug',
    'danceLead',
    'danceFollow',
    'carryingPiggyback',
    'carryingCradle',
    'clinch',
    // 3ª entrega (#38): as duas poses de postura em pé.
    'businessman',
    'heroStance',
  ]

  it.each(GROUNDED)('%s: apoia os DOIS pés no chão', (key) => {
    const world = worldPositions(placedFigure(key))
    for (const side of ['L', 'R'] as const) {
      // A ponta do pé (`ball`) fica a 0,010 m do chão na pose neutra; até
      // 0,03 é encostada, acima disso o boneco está flutuando.
      expect(world.get(`ball.${side}`)!.y).toBeLessThan(0.03)
    }
  })

  it('sentado: o quadril desce para a altura de um assento, em vez de flutuar', () => {
    const placement = resolvePosePresetPlacement('sitting')
    expect(placement.groundOffsetM).toBeCloseTo(0.485 - 0.9, 5)
    expect(placement.preservesHeading).toBe(true)
  })

  it('deitado: de COSTAS no chão (a frente do peito aponta para cima) e a cabeça encostada', () => {
    const world = worldPositions(placedFigure('lyingHandsBehindHead'))
    const root = world.get('root')!
    const head = world.get('head')!
    // Corpo na horizontal: a cabeça fica na altura do quadril e longe dele em Z.
    expect(Math.abs(head.y - root.y)).toBeLessThan(0.1)
    expect(Math.abs(head.z - root.z)).toBeGreaterThan(0.5)
    // De costas: o umbigo/peito (frente do corpo) fica ACIMA da coluna.
    const { joints } = buildJointFrames(placedFigure('lyingHandsBehindHead'))
    const front = new THREE.Vector3(0, 0, 0.1).applyMatrix4(joints.get('chest')!.matrixWorld)
    expect(front.y).toBeGreaterThan(world.get('chest')!.y)
  })

  it('deitado: as mãos ficam atrás da cabeça e os cotovelos apoiados no chão', () => {
    const world = worldPositions(placedFigure('lyingHandsBehindHead'))
    const head = world.get('head')!
    for (const side of ['L', 'R'] as const) {
      const wrist = world.get(`wrist.${side}`)!
      // Perto da cabeça e ATRÁS dela (a cabeça aponta para -Z depois de deitar).
      expect(wrist.distanceTo(head)).toBeLessThan(0.35)
      expect(wrist.z).toBeGreaterThan(head.z)
      // Cotovelos abertos para os lados e assentados no chão.
      expect(Math.abs(world.get(`elbow.${side}`)!.x)).toBeGreaterThan(0.25)
      expect(world.get(`elbow.${side}`)!.y).toBeLessThan(0.05)
    }
  })

  it('fetal: pelve reclinada, joelhos altos e as duas mãos se encontrando na frente das canelas', () => {
    expect(resolvePosePresetPlacement('fetal').rotation.x).toBeLessThan(0)
    const world = worldPositions(placedFigure('fetal'))
    // Joelhos bem acima do quadril — é isso que a pelve reclinada compra.
    expect(world.get('knee.L')!.y - world.get('root')!.y).toBeGreaterThan(0.25)
    // Mãos juntas, à frente das canelas.
    expect(world.get('wrist.L')!.distanceTo(world.get('wrist.R')!)).toBeLessThan(0.2)
    for (const side of ['L', 'R'] as const) {
      expect(world.get(`wrist.${side}`)!.z).toBeGreaterThan(world.get(`knee.${side}`)!.z)
    }
    // Tronco curvado por cima dos joelhos.
    expect(world.get('head')!.y).toBeLessThan(0.85)
  })

  it('luta: punhos fechados na altura do rosto e à frente dele', () => {
    const world = worldPositions(placedFigure('fighting'))
    const head = world.get('head')!
    const pose = resolvePosePreset('fighting')
    for (const side of ['L', 'R'] as const) {
      const wrist = world.get(`wrist.${side}`)!
      expect(Math.abs(wrist.y - head.y)).toBeLessThan(0.2)
      expect(wrist.z).toBeGreaterThan(head.z)
      expect(pose[`fingersBase.${side}`].x).toBeGreaterThan(60)
    }
    // O punho da frente (esquerdo, pé esquerdo à frente) fica mais adiantado.
    expect(world.get('wrist.L')!.z).toBeGreaterThan(world.get('wrist.R')!.z)
  })

  it('superman: paira acima do chão, de bruços, com os braços à frente da cabeça', () => {
    const world = worldPositions(placedFigure('superman'))
    for (const position of world.values()) expect(position.y).toBeGreaterThan(0.5)
    const head = world.get('head')!
    expect(Math.abs(head.z - world.get('root')!.z)).toBeGreaterThan(0.4)
    for (const side of ['L', 'R'] as const) {
      expect(world.get(`wrist.${side}`)!.z).toBeGreaterThan(head.z)
    }
    // De bruços: a frente do peito aponta para baixo.
    const { joints } = buildJointFrames(placedFigure('superman'))
    const front = new THREE.Vector3(0, 0, 0.1).applyMatrix4(joints.get('chest')!.matrixWorld)
    expect(front.y).toBeLessThan(world.get('chest')!.y)
  })

  it('modelo: mão esquerda na cintura com o cotovelo aberto para o lado, peso na perna esquerda', () => {
    const world = worldPositions(placedFigure('model'))
    const wrist = world.get('wrist.L')!
    const hip = world.get('hip.L')!
    expect(wrist.distanceTo(hip)).toBeLessThan(0.16)
    expect(world.get('elbow.L')!.x).toBeGreaterThan(0.3)
    // Perna esquerda (de apoio) esticada, direita cruzada e dobrada.
    const pose = resolvePosePreset('model')
    expect(pose['knee.L'].x).toBeLessThan(pose['knee.R'].x)
  })

  /**
   * Poses de luta em PAR (pedido do usuário, ver DECISOES.md #35). O que
   * torna um par um par é geométrico: o golpe de um tem de chegar na altura
   * exata do alvo do outro. São esses encontros — punho × rosto, pé × barriga,
   * antebraço × pescoço — que estes testes travam, e não os ângulos em si.
   */
  describe('poses de luta em par (DECISOES.md #35)', () => {
    /** Ponto do ROSTO (nariz/olhos), em (0, 0,02, 0,095) no frame da cabeça — ver `HEAD_PARTS`. */
    function facePoint(key: PosePresetKey): THREE.Vector3 {
      const { joints } = buildJointFrames(placedFigure(key))
      return new THREE.Vector3(0, 0.02, 0.095).applyMatrix4(joints.get('head')!.matrixWorld)
    }

    it('soco: o punho do atacante chega exatamente na altura do rosto de quem leva', () => {
      const fist = worldPositions(placedFigure('punchGiving')).get('wrist.R')!
      const face = facePoint('punchTaking')
      expect(Math.abs(fist.y - face.y)).toBeLessThan(0.03)
      // O soco sai à frente do corpo (é o que dá a distância de encaixe do par).
      expect(fist.z).toBeGreaterThan(0.5)
    })

    it('soco: braço direito estendido e punho fechado em quem dá; cabeça jogada para trás em quem leva', () => {
      const giving = resolvePosePreset('punchGiving')
      expect(giving['elbow.R'].x).toBeGreaterThan(-25)
      expect(giving['fingersBase.R'].x).toBeGreaterThan(60)

      const world = worldPositions(placedFigure('punchTaking'))
      const face = facePoint('punchTaking')
      // Cabeça atrás do próprio pescoço — ela recuou em relação ao tronco.
      expect(world.get('head')!.z).toBeLessThan(world.get('neck')!.z)
      // Queixo para cima: o rosto sobe bem acima da junta da cabeça (no neutro
      // ele fica só 2 cm acima dela).
      expect(face.y - world.get('head')!.y).toBeGreaterThan(0.05)
      // Joelhos cedendo: o quadril desce em relação à pose em pé.
      expect(resolvePosePresetPlacement('punchTaking').groundOffsetM).toBeLessThan(-0.05)
    })

    it('chute: o pé do atacante chega na altura da barriga de quem leva', () => {
      const foot = worldPositions(placedFigure('kickGiving')).get('ankle.R')!
      const belly = worldPositions(placedFigure('kickTaking')).get('spine')!
      expect(Math.abs(foot.y - belly.y)).toBeLessThan(0.05)
      expect(foot.z).toBeGreaterThan(0.7)
    })

    it('chute: perna direita erguida à frente (a de apoio no chão) e corpo dobrado em quem leva', () => {
      const world = worldPositions(placedFigure('kickGiving'))
      expect(world.get('ankle.R')!.y).toBeGreaterThan(0.9)
      expect(world.get('ball.L')!.y).toBeLessThan(0.03)

      // Dobrado para a FRENTE em volta do ponto do impacto: ombros e cabeça
      // adiantados em relação ao quadril.
      const taking = worldPositions(placedFigure('kickTaking'))
      expect(taking.get('head')!.z).toBeGreaterThan(taking.get('root')!.z + 0.25)
      expect(taking.get('chest')!.z).toBeGreaterThan(taking.get('root')!.z + 0.1)
    })

    it('joelhada: o JOELHO do atacante chega na altura da barriga de quem leva', () => {
      const knee = worldPositions(placedFigure('kneeStrikeGiving')).get('knee.R')!
      const belly = worldPositions(placedFigure('kneeStrikeTaking')).get('spine')!
      expect(Math.abs(knee.y - belly.y)).toBeLessThan(0.01)
      expect(knee.z).toBeGreaterThan(0.3)
    })

    it('joelhada: perna direita erguida e perto da linha média em quem dá; corpo bem dobrado com a cabeça baixa em quem leva', () => {
      const giving = worldPositions(placedFigure('kneeStrikeGiving'))
      expect(giving.get('knee.R')!.y).toBeGreaterThan(0.9)
      expect(Math.abs(giving.get('knee.R')!.x)).toBeLessThan(0.1)
      expect(giving.get('ball.L')!.y).toBeLessThan(0.03)
      // Perna que golpeia claramente fora do chão (é ela que golpeia, não pisa).
      expect(giving.get('ball.R')!.y).toBeGreaterThan(0.5)

      const taking = worldPositions(placedFigure('kneeStrikeTaking'))
      expect(taking.get('head')!.z).toBeGreaterThan(taking.get('root')!.z + 0.25)
      // Mais dobrado que o chute (golpe de clinche, bem mais perto).
      expect(resolvePosePreset('kneeStrikeTaking').spine.x).toBeGreaterThan(resolvePosePreset('kickTaking').spine.x)
    })

    it('gravata: os punhos de quem aplica chegam na altura do pescoço de quem recebe, à frente do próprio corpo', () => {
      const giving = worldPositions(placedFigure('chokeGiving'))
      const neck = worldPositions(placedFigure('chokeTaking')).get('neck')!
      for (const side of ['L', 'R'] as const) {
        const wrist = giving.get(`wrist.${side}`)!
        expect(Math.abs(wrist.y - neck.y)).toBeLessThan(0.1)
        // À frente do próprio peito: é o que dá a volta no pescoço da vítima.
        expect(wrist.z).toBeGreaterThan(giving.get('chest')!.z + 0.2)
      }
      // Braços abraçando: um cotovelo de cada lado do corpo.
      expect(giving.get('elbow.L')!.x).toBeGreaterThan(0.1)
      expect(giving.get('elbow.R')!.x).toBeLessThan(-0.1)
    })

    it('gravata: quem recebe fica com as duas mãos no próprio pescoço e o queixo erguido', () => {
      const world = worldPositions(placedFigure('chokeTaking'))
      const neck = world.get('neck')!
      for (const side of ['L', 'R'] as const) {
        expect(world.get(`wrist.${side}`)!.distanceTo(neck)).toBeLessThan(0.3)
      }
      // Queixo erguido: o rosto aponta para cima e para trás.
      expect(facePoint('chokeTaking').y).toBeGreaterThan(world.get('head')!.y)
      expect(world.get('head')!.z).toBeLessThan(neck.z)
    })

    /**
     * Quem leva o golpe fica de FRENTE para quem dá, ou seja, girado 180°: um
     * ponto do alvo com `z` local cai em `D - z` no mundo. Igualando ao alcance
     * do golpe, a distância entre os quadris é `alcance + z do alvo` — e é ela
     * que diz se o par encaixa numa cena crível ou com os corpos atravessados.
     */
    it('os pares encaixam a uma distância plausível entre os quadris', () => {
      const fistZ = worldPositions(placedFigure('punchGiving')).get('wrist.R')!.z
      const punchGap = fistZ + facePoint('punchTaking').z
      expect(punchGap).toBeGreaterThan(0.5)
      expect(punchGap).toBeLessThan(1)

      const footZ = worldPositions(placedFigure('kickGiving')).get('ankle.R')!.z
      const kickGap = footZ + worldPositions(placedFigure('kickTaking')).get('spine')!.z
      expect(kickGap).toBeGreaterThan(0.6)
      expect(kickGap).toBeLessThan(1.4)

      // Joelhada: golpe de clinche, bem mais perto que soco/chute.
      const kneeZ = worldPositions(placedFigure('kneeStrikeGiving')).get('knee.R')!.z
      const kneeGap = kneeZ + worldPositions(placedFigure('kneeStrikeTaking')).get('spine')!.z
      expect(kneeGap).toBeGreaterThan(0.2)
      expect(kneeGap).toBeLessThan(0.6)
    })
  })

  /**
   * Poses de apontar e apoios no chão (DECISOES.md #36). O que cada teste
   * trava é o que define a pose: para onde a mão aponta e como a palma está
   * virada (nas de apontar), e quem encosta no chão (nos apoios).
   */
  describe('apontar com a mão aberta (DECISOES.md #36)', () => {
    /** Direção da palma: -Z local do punho (ver `skeleton.ts`, DECISOES.md #25). */
    function palmDirection(key: PosePresetKey, side: 'L' | 'R'): THREE.Vector3 {
      const { joints } = buildJointFrames(placedFigure(key))
      return new THREE.Vector3(0, 0, -1).transformDirection(joints.get(`wrist.${side}`)!.matrixWorld)
    }

    it('apontando à frente: indicador estendido, palma na vertical, na altura do ombro', () => {
      const world = worldPositions(placedFigure('pointForward'))
      // Quem marca o alcance do gesto agora é o INDICADOR: o bloco dos outros
      // três está fechado (DECISOES.md #45).
      const tip = world.get('indexTip.R')!
      expect(tip.z).toBeGreaterThan(0.6)
      expect(Math.abs(tip.y - world.get('shoulder.R')!.y)).toBeLessThan(0.1)
      // Palma na vertical = a normal dela não tem componente vertical.
      expect(Math.abs(palmDirection('pointForward', 'R').y)).toBeLessThan(0.2)
      // E o dedo continua reto, na linha do antebraço.
      expect(resolvePosePreset('pointForward')['indexBase.R'].x).toBe(0)
    })

    it('o punho continua a linha do antebraço — é o que separa apontar de alcançar', () => {
      for (const key of ['pointForward', 'pointUp', 'pointDown', 'pointFar', 'pointAtOther'] as const) {
        const pose = resolvePosePreset(key)
        expect({ [key]: pose['wrist.R'].x }).toEqual({ [key]: 0 })
        expect({ [key]: pose['wrist.R'].z }).toEqual({ [key]: 0 })
        // Cotovelo quase estendido.
        expect(pose['elbow.R'].x).toBeGreaterThan(-35)
      }
    })

    it('apontando para o alto: ponta dos dedos acima da cabeça', () => {
      const world = worldPositions(placedFigure('pointUp'))
      expect(world.get('fingersTip.R')!.y).toBeGreaterThan(world.get('head')!.y + 0.3)
    })

    it('indicando o chão: palma virada para baixo e mão abaixo do peito', () => {
      const world = worldPositions(placedFigure('pointDown'))
      expect(palmDirection('pointDown', 'R').y).toBeLessThan(-0.8)
      expect(world.get('fingersTip.R')!.y).toBeLessThan(world.get('chest')!.y)
    })

    it('apresentando: palma virada para CIMA (é o que muda o sentido do gesto)', () => {
      expect(palmDirection('presenting', 'R').y).toBeGreaterThan(0.8)
    })

    it('apontando para si: mão no próprio peito, palma virada para o corpo', () => {
      const world = worldPositions(placedFigure('pointSelf'))
      expect(world.get('wrist.R')!.distanceTo(world.get('chest')!)).toBeLessThan(0.2)
      expect(palmDirection('pointSelf', 'R').z).toBeLessThan(-0.8)
    })

    it('polegar para trás: o polegar aponta mesmo para trás — a única pose com dedo de verdade', () => {
      const world = worldPositions(placedFigure('thumbBack'))
      const thumb = world.get('thumb2.R')!.clone().sub(world.get('wrist.R')!).normalize()
      expect(thumb.z).toBeLessThan(-0.9)
      expect(getPosePresetHands('thumbBack', 'R')).toBe('thumbsUp')
    })

    it('apontando ao longe e para o outro: o gesto sai à frente do corpo, alto', () => {
      for (const key of ['pointFar', 'pointAtOther'] as const) {
        const world = worldPositions(placedFigure(key))
        const tip = world.get('indexTip.R')!
        expect({ [`${key}.z`]: tip.z > 0.6 }).toEqual({ [`${key}.z`]: true })
        expect({ [`${key}.y`]: tip.y > 1.4 }).toEqual({ [`${key}.y`]: true })
      }
    })
  })

  describe('apoios no chão (DECISOES.md #36)', () => {
    it('agachado: quadril bem abaixo do normal, com a ponta do pé sob o corpo', () => {
      const world = worldPositions(placedFigure('squat'))
      expect(world.get('root')!.y).toBeLessThan(0.45)
      for (const side of ['L', 'R'] as const) {
        expect(world.get(`ball.${side}`)!.y).toBeLessThan(0.03)
        // Pé sob o corpo (o erro da primeira versão era ficar 46 cm à frente).
        expect(Math.abs(world.get(`ball.${side}`)!.z)).toBeLessThan(0.15)
      }
    })

    it('ajoelhado: joelho no chão — um só numa pose, os dois na outra', () => {
      const um = worldPositions(placedFigure('kneelingOneKnee'))
      expect(um.get('knee.R')!.y).toBeLessThan(0.08)
      expect(um.get('knee.L')!.y).toBeGreaterThan(0.3)
      expect(um.get('ball.L')!.y).toBeLessThan(0.03)

      const dois = worldPositions(placedFigure('kneelingBoth'))
      for (const side of ['L', 'R'] as const) {
        expect(dois.get(`knee.${side}`)!.y).toBeLessThan(0.08)
        expect(dois.get(`ball.${side}`)!.y).toBeLessThan(0.03)
      }
    })

    it('de quatro e flexão: mãos E (joelhos | pontas dos pés) no chão, tronco erguido', () => {
      const quatro = worldPositions(placedFigure('allFours'))
      expect(quatro.get('wrist.L')!.y).toBeLessThan(0.08)
      expect(quatro.get('knee.L')!.y).toBeLessThan(0.09)
      expect(quatro.get('root')!.y).toBeGreaterThan(0.4)

      const flexao = worldPositions(placedFigure('plank'))
      expect(flexao.get('wrist.L')!.y).toBeLessThan(0.1)
      expect(flexao.get('ball.L')!.y).toBeLessThan(0.05)
      // Corpo inclinado: os ombros bem acima do quadril.
      expect(flexao.get('upperChest')!.y).toBeGreaterThan(flexao.get('root')!.y + 0.05)
    })

    it('de bruços nos cotovelos: antebraços no chão e peito erguido acima da pelve', () => {
      const world = worldPositions(placedFigure('pronePropped'))
      for (const side of ['L', 'R'] as const) {
        expect(world.get(`elbow.${side}`)!.y).toBeLessThan(0.08)
      }
      expect(world.get('chest')!.y).toBeGreaterThan(world.get('root')!.y + 0.05)
      expect(world.get('head')!.y).toBeGreaterThan(world.get('chest')!.y)
    })

    it('deitado de lado: corpo na horizontal, sobre o lado direito', () => {
      const world = worldPositions(placedFigure('sideLying'))
      const head = world.get('head')!
      const root = world.get('root')!
      // Deitado ao longo de X (o giro é em Z), com a cabeça na altura do quadril.
      expect(Math.abs(head.y - root.y)).toBeLessThan(0.1)
      expect(Math.abs(head.x - root.x)).toBeGreaterThan(0.5)
      // Lado direito por baixo: o ombro direito fica abaixo do esquerdo.
      expect(world.get('shoulder.R')!.y).toBeLessThan(world.get('shoulder.L')!.y)
    })

    it('pernas cruzadas: sentado baixo, joelhos abertos e tornozelos na linha média', () => {
      const world = worldPositions(placedFigure('crossLegged'))
      expect(world.get('root')!.y).toBeLessThan(0.3)
      for (const side of ['L', 'R'] as const) {
        expect(Math.abs(world.get(`knee.${side}`)!.x)).toBeGreaterThan(0.25)
        expect(Math.abs(world.get(`ankle.${side}`)!.x)).toBeLessThan(0.12)
      }
    })

    it('alongamento: tronco dobrado ao máximo, mãos abaixo do joelho', () => {
      const world = worldPositions(placedFigure('touchToes'))
      const pose = resolvePosePreset('touchToes')
      expect(pose.spine.x).toBe(45)
      expect(pose.chest.x).toBe(25)
      for (const side of ['L', 'R'] as const) {
        expect(world.get(`wrist.${side}`)!.y).toBeLessThan(world.get(`knee.${side}`)!.y)
      }
    })

    it('A-pose: braços a 45°, e é isso — o resto é a pose neutra', () => {
      const pose = resolvePosePreset('apose')
      expect(pose['shoulder.L'].z).toBe(45)
      expect(pose['shoulder.R'].z).toBe(-45)
      const standing = resolvePosePreset('standing')
      for (const [name, rotation] of Object.entries(pose)) {
        if (name === 'shoulder.L' || name === 'shoulder.R') continue
        expect({ [name]: rotation }).toEqual({ [name]: standing[name] })
      }
    })
  })

  it.each(POSE_PRESET_KEYS)('%s: só impõe a direção que o boneco encara quando de fato o inclina', (key) => {
    const placement = resolvePosePresetPlacement(key)
    const tilts = placement.rotation.x !== 0 || placement.rotation.z !== 0
    expect(placement.preservesHeading).toBe(!tilts)
  })

  it('cada pose de corpo usa a mão que o usuário escolheu para ela', () => {
    // Lado ESQUERDO: é o que todo preset declara igual para as duas mãos. As
    // cinco poses de apontar dão o indicador só à mão direita — o teste
    // seguinte cuida delas.
    const byPreset = Object.fromEntries(POSE_PRESET_KEYS.map((key) => [key, getPosePresetHands(key, 'L')]))
    expect(byPreset).toEqual({
      // "Em pé" e T-pose ficam com a mão aberta (pedido explícito do usuário):
      // são as poses de referência do esqueleto e a T-pose é como um boneco
      // nasce — qualquer curvatura de dedo ali viraria o novo "neutro".
      standing: null,
      tpose: null,
      sitting: 'relaxed',
      walking: 'relaxed',
      running: 'fist',
      lyingHandsBehindHead: 'relaxed',
      fetal: 'relaxed',
      fighting: 'fist',
      superman: 'fist',
      model: 'relaxed',
      // Luta (#35): fecha a mão quem golpeia ou agarra; quem leva o golpe fica
      // com a mão relaxada — é o corpo que reage, não o gesto.
      punchGiving: 'fist',
      punchTaking: 'relaxed',
      kickGiving: 'fist',
      kickTaking: 'fist',
      kneeStrikeGiving: 'fist',
      kneeStrikeTaking: 'fist',
      armLockPushGiving: 'fist',
      armLockPushTaking: 'relaxed',
      armLockPullGiving: 'fist',
      armLockPullTaking: 'relaxed',
      chokeGiving: 'fist',
      chokeTaking: 'relaxed',
      // Referência fica com a mão ABERTA; nas poses de apontar é a mão que
      // NÃO aponta que fica aberta, descansando (DECISOES.md #45).
      apose: null,
      pointForward: null,
      pointUp: null,
      pointDown: null,
      pointFar: null,
      pointAtOther: null,
      presenting: null,
      pointSelf: null,
      // Aponta com o polegar, nas duas mãos.
      thumbBack: 'thumbsUp',
      // Apoios no chão: mão relaxada em pé/sentado, aberta onde a palma
      // apoia no piso (de quatro, flexão, cotovelos).
      squat: 'relaxed',
      kneelingOneKnee: 'relaxed',
      kneelingBoth: 'relaxed',
      crossLegged: 'relaxed',
      allFours: null,
      plank: null,
      pronePropped: null,
      sideLying: 'relaxed',
      touchToes: 'relaxed',
      // Expressivas (#37): mão relaxada onde ela só pende, ABERTA onde a mão
      // é o gesto (acenar, assustar-se) e fechada em comemoração.
      armsCrossed: 'relaxed',
      handsOnHips: 'relaxed',
      waving: null,
      celebrating: 'fist',
      handOnChin: 'relaxed',
      headDown: 'relaxed',
      startled: null,
      // Dança pop: fechada no robô (mão firme), relaxada no quadril de quem
      // aponta; "Coração" declara só a mão direita (a esquerda fica aberta,
      // ver o teste dedicado abaixo).
      kpopFingerHeart: null,
      kpopBoxArms: 'fist',
      kpopPointDance: 'relaxed',
      kpopShoulderWave: 'relaxed',
      // Ação: fecha a mão quem agarra (escalar) ou impulsiona (saltar,
      // arremessar); aberta quem sustenta a caixa por baixo.
      jumping: 'fist',
      throwing: 'fist',
      kickingBall: 'relaxed',
      carryingBox: null,
      climbing: 'fist',
      stepUp: 'relaxed',
      balletPreparation: 'relaxed',
      balletPirouette: 'relaxed',
      // Pares: aberta em quem empurra (a palma é a superfície de contato) e
      // em quem carrega no colo (a palma sustenta o corpo do outro).
      handshake: 'relaxed',
      hug: 'relaxed',
      danceLead: 'relaxed',
      danceFollow: 'relaxed',
      carryingPiggyback: 'relaxed',
      carriedPiggyback: 'relaxed',
      carryingCradle: null,
      carriedCradle: 'relaxed',
      pullingUp: 'relaxed',
      beingPulledUp: 'relaxed',
      pushGiving: null,
      pushTaking: null,
      clinch: 'relaxed',
      // 3ª entrega (#38): aberta onde a palma é o apoio (as duas sentadas) ou
      // o gesto (meditação, palma para cima); fechada em quem estrangula.
      meditating: null,
      businessman: 'relaxed',
      heroStance: 'relaxed',
      lyingSpreadSupine: 'relaxed',
      lyingSpreadProne: 'relaxed',
      sittingLegsForward: null,
      sittingKneesBent: null,
      rearChokeKneeling: 'fist',
      rearChokeSeated: 'relaxed',
      // 4ª entrega (#40): fecha a mão quem estrangula, relaxada em quem tenta
      // arrancar o braço do próprio pescoço — a mesma regra dos outros golpes.
      groundChokeGiving: 'fist',
      groundChokeTaking: 'relaxed',
    })
  })

  /**
   * O que o dedo indicador separado (DECISOES.md #45) mudou: as poses de
   * apontar apontam com o DEDO, e só na mão do gesto — a outra continua
   * aberta. As duas poses de PALMA continuam de mão aberta nos dois lados.
   */
  it('as poses de apontar usam o indicador só na mão do gesto', () => {
    for (const key of ['pointForward', 'pointUp', 'pointDown', 'pointFar', 'pointAtOther'] as const) {
      expect({ [key]: getPosePresetHands(key, 'R') }).toEqual({ [key]: 'point' })
      expect({ [key]: getPosePresetHands(key, 'L') }).toEqual({ [key]: null })
    }
    for (const key of ['presenting', 'pointSelf'] as const) {
      expect({ [key]: getPosePresetHands(key, 'R') }).toEqual({ [key]: null })
    }
  })

  it('coração e apontar (dança pop): a mão do gesto certa em cada lado', () => {
    expect(getPosePresetHands('kpopFingerHeart', 'R')).toBe('pinch')
    expect(getPosePresetHands('kpopFingerHeart', 'L')).toBe(null)
    expect(getPosePresetHands('kpopPointDance', 'R')).toBe('point')
    expect(getPosePresetHands('kpopPointDance', 'L')).toBe('relaxed')
  })

  it.each(POSE_PRESET_KEYS)('%s: as juntas da mão são exatamente a pose de mão declarada', (key) => {
    const pose = resolvePosePreset(key)
    for (const side of ['L', 'R'] as const) {
      const expected = resolveHandPreset(getPosePresetHands(key, side) ?? 'open', side)
      for (const [jointName, rotation] of Object.entries(expected)) {
        expect({ [jointName]: pose[jointName] }).toEqual({ [jointName]: rotation })
      }
    }
  })

  const SYMMETRIC: readonly PosePresetKey[] = [
    'standing',
    'tpose',
    'sitting',
    'lyingHandsBehindHead',
    'fetal',
    'superman',
    // As duas poses de luta que são simétricas de fato (declaradas com o
    // helper `symmetric`): levar o chute na barriga e ser preso pela gravata.
    'kickTaking',
    'chokeTaking',
    'kneeStrikeTaking',
    // 2ª entrega (#37): declaradas inteiras com o helper `symmetric`.
    // "Carregado no colo" fica de fora apesar de a POSE ser simétrica — a
    // colocação gira o boneco 90° em Z, e aí o espelho sagital do MUNDO
    // deixa de valer.
    'handsOnHips',
    'celebrating',
    'headDown',
    'startled',
    'kpopBoxArms',
    'jumping',
    'carryingBox',
    'carryingPiggyback',
    'carriedPiggyback',
    // 3ª entrega (#38). "Deitado em X de bruços" fica de fora — a cabeça
    // virada é assimétrica de propósito, e é ela que salva o rosto do chão.
    'meditating',
    'heroStance',
    'lyingSpreadSupine',
    'sittingLegsForward',
    'sittingKneesBent',
    'rearChokeSeated',
  ]

  it.each(SYMMETRIC)('%s é simétrica: o lado direito é o espelho exato do esquerdo', (key) => {
    const figure = placedFigure(key)
    const world = worldPositions(figure)
    for (const name of JOINT_NAMES.filter((n) => n.endsWith('.L'))) {
      const left = world.get(name)!
      const right = world.get(`${name.slice(0, -1)}R`)!
      // Espelhado no plano sagital: mesma altura/profundidade, X trocado de sinal.
      expect(left.x + right.x).toBeCloseTo(0, 6)
      expect(left.y).toBeCloseTo(right.y, 6)
      expect(left.z).toBeCloseTo(right.z, 6)
    }
  })
})

/**
 * 2ª entrega do catálogo (DECISOES.md #37). Cada `it` abaixo trava a
 * RESTRIÇÃO GEOMÉTRICA que define a pose — a altura do contato, a direção da
 * palma, o encaixe entre os dois bonecos de um par. São esses números que a
 * busca numérica produziu; sem trava, um ajuste futuro num offset do esqueleto
 * desmancharia as poses sem que nenhum teste reclamasse.
 */
describe('2ª entrega do catálogo de poses (DECISOES.md #37)', () => {
  function placedFigure(key: PosePresetKey): Figure {
    const placement = resolvePosePresetPlacement(key)
    return {
      ...figureWithPose(resolvePosePreset(key)),
      position: [0, placement.groundOffsetM, 0],
      rotation: placement.rotation,
    }
  }

  function at(key: PosePresetKey, joint: string): THREE.Vector3 {
    const { joints } = buildJointFrames(placedFigure(key))
    const v = new THREE.Vector3()
    joints.get(joint)!.getWorldPosition(v)
    return v
  }

  /** Direção da palma (o -Z local do punho) no mundo. */
  function palmDir(key: PosePresetKey, side: 'L' | 'R'): THREE.Vector3 {
    const { joints } = buildJointFrames(placedFigure(key))
    const q = new THREE.Quaternion()
    joints.get(`wrist.${side}`)!.getWorldQuaternion(q)
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize()
  }

  /** Direção dos dedos (o -Y local do punho) no mundo. */
  function fingersDir(key: PosePresetKey, side: 'L' | 'R'): THREE.Vector3 {
    const { joints } = buildJointFrames(placedFigure(key))
    const q = new THREE.Quaternion()
    joints.get(`wrist.${side}`)!.getWorldQuaternion(q)
    return new THREE.Vector3(0, -1, 0).applyQuaternion(q).normalize()
  }

  /**
   * Onde um ponto de um boneco cai quando o PARCEIRO usa a mesma colocação,
   * girado 180° e a `D` metros em Z. Exato: a rotação do preset é aplicada na
   * junta `root` e o deslocamento vertical fica fora dela, então girar 180° em
   * torno de Y é só `(x, y, z) → (-x, y, -z)` mais a translação.
   */
  const facing = (p: THREE.Vector3, D: number) => new THREE.Vector3(-p.x, p.y, D - p.z)

  describe('expressivas', () => {
    it('acenando: antebraço para CIMA e palma exatamente para a frente', () => {
      const wrist = at('waving', 'wrist.R')
      const elbow = at('waving', 'elbow.R')
      // O que separa "acenar" de "braço levantado": o cotovelo fica abaixo.
      expect(elbow.y).toBeLessThan(wrist.y - 0.15)
      expect(wrist.y).toBeGreaterThan(at('waving', 'head').y - 0.02)
      expect(palmDir('waving', 'R').z).toBeGreaterThan(0.99)
    })

    it('mãos na cintura: punhos sobre o quadril e cotovelos bem abertos', () => {
      for (const side of ['L', 'R'] as const) {
        const wrist = at('handsOnHips', `wrist.${side}`)
        const hip = at('handsOnHips', `hip.${side}`)
        expect(wrist.distanceTo(hip)).toBeLessThan(0.15)
        // "Asa": o cotovelo sai bem para fora da linha do corpo.
        expect(Math.abs(at('handsOnHips', `elbow.${side}`).x)).toBeGreaterThan(0.29)
      }
    })

    it('braços cruzados: os antebraços cruzam a linha média, um à frente do outro', () => {
      const wristR = at('armsCrossed', 'wrist.R')
      const wristL = at('armsCrossed', 'wrist.L')
      const elbowR = at('armsCrossed', 'elbow.R')
      const elbowL = at('armsCrossed', 'elbow.L')
      // Cada antebraço vai de um lado ao outro da linha média.
      expect(elbowR.x).toBeLessThan(-0.15)
      expect(wristR.x).toBeGreaterThan(0)
      expect(elbowL.x).toBeGreaterThan(0.15)
      expect(wristL.x).toBeLessThan(0)
      // À frente do tronco, e separados entre si para não se atravessarem.
      expect(Math.min(wristR.z, wristL.z)).toBeGreaterThan(0.14)
      expect(Math.abs(wristR.z - wristL.z) + Math.abs(wristR.y - wristL.y)).toBeGreaterThan(0.1)
    })

    it('mão no queixo: antebraço direito VERTICAL, dedos no queixo e mão esquerda sob o cotovelo', () => {
      const wrist = at('handOnChin', 'wrist.R')
      const elbow = at('handOnChin', 'elbow.R')
      expect(Math.hypot(elbow.x - wrist.x, elbow.z - wrist.z)).toBeLessThan(0.02)
      // Queixo do modelo: a base do crânio fica em 1,55 e o queixo ~0,065 abaixo.
      expect(at('handOnChin', 'fingersBase.R').y).toBeCloseTo(1.44, 1)
      // A mão esquerda sustenta o cotovelo direito, logo abaixo dele.
      const support = at('handOnChin', 'wrist.L')
      expect(support.distanceTo(elbow)).toBeLessThan(0.12)
      expect(support.y).toBeLessThan(elbow.y)
    })

    it('cabeça baixa: a cabeça desce e avança em relação à pose em pé', () => {
      const head = at('headDown', 'head')
      expect(head.y).toBeLessThan(1.42)
      expect(head.z).toBeGreaterThan(0.24)
    })

    it('assustado: as duas palmas voltadas para a frente, à frente do rosto', () => {
      for (const side of ['L', 'R'] as const) {
        expect(palmDir('startled', side).z).toBeGreaterThan(0.99)
        const wrist = at('startled', `wrist.${side}`)
        expect(wrist.z).toBeGreaterThan(at('startled', 'head').z + 0.2)
        expect(wrist.y).toBeGreaterThan(1.4)
      }
    })
  })

  describe('ação', () => {
    it('saltando: a junta mais baixa fica bem acima do chão (é a única pose sem contato)', () => {
      const { joints } = buildJointFrames(placedFigure('jumping'))
      let lowest = Infinity
      for (const name of JOINT_NAMES) {
        const v = new THREE.Vector3()
        joints.get(name)!.getWorldPosition(v)
        lowest = Math.min(lowest, v.y)
      }
      expect(lowest).toBeGreaterThan(0.4)
    })

    it('chutando a bola: a planta do pé direito na altura de uma bola no chão e à frente', () => {
      const ball = at('kickingBall', 'ball.R')
      expect(ball.y).toBeCloseTo(0.157, 2)
      expect(ball.z).toBeGreaterThan(0.55)
      // Pé de apoio plantado.
      expect(at('kickingBall', 'ball.L').y).toBeLessThan(0.03)
    })

    it('carregando caixa: antebraços HORIZONTAIS e as duas palmas para cima', () => {
      for (const side of ['L', 'R'] as const) {
        const wrist = at('carryingBox', `wrist.${side}`)
        const elbow = at('carryingBox', `elbow.${side}`)
        expect(Math.abs(elbow.y - wrist.y)).toBeLessThan(0.02)
        expect(wrist.z).toBeGreaterThan(elbow.z + 0.2)
        expect(palmDir('carryingBox', side).y).toBeGreaterThan(0.99)
      }
    })

    it('subindo degrau: pé direito em cima do degrau, esquerdo atrás na ponta', () => {
      const right = at('stepUp', 'ankle.R')
      // Sola = tornozelo - 0,07: um degrau de ~0,22 m.
      expect(right.y - 0.07).toBeCloseTo(0.22, 2)
      expect(right.z).toBeGreaterThan(0.25)
      // Do lado direito do corpo, e não cruzado para o lado esquerdo.
      expect(right.x).toBeLessThan(0)
      // Pé de trás: calcanhar levantado, ponta no chão.
      expect(at('stepUp', 'ankle.L').y).toBeGreaterThan(0.09)
      expect(at('stepUp', 'ball.L').y).toBeLessThan(0.03)
    })

    it('escalando: mão direita no alto, joelho direito alto e pé esquerdo no chão', () => {
      expect(at('climbing', 'wrist.R').y).toBeGreaterThan(1.75)
      expect(at('climbing', 'ankle.R').y).toBeGreaterThan(0.45)
      expect(at('climbing', 'ball.L').y).toBeLessThan(0.03)
    })

    it('arremessando: mão direita armada ATRÁS do corpo e a esquerda apontada à frente', () => {
      expect(at('throwing', 'wrist.R').z).toBeLessThan(-0.15)
      expect(at('throwing', 'wrist.R').y).toBeGreaterThan(1.6)
      expect(at('throwing', 'wrist.L').z).toBeGreaterThan(0.35)
    })
  })

  describe('pares: o encaixe entre os dois bonecos', () => {
    /** Distâncias resolvidas numericamente — mudou aqui, mudou a dica no painel. */
    const D_HANDSHAKE = 0.755
    const D_HUG = 0.26
    const D_CLINCH = 0.4
    const D_DANCE = 0.36
    const D_PUSH = 0.467
    const D_PULL = 0.69
    const D_PIGGYBACK = 0.16

    it('aperto de mão: a MESMA pose nos dois, mãos se encontrando no meio do caminho', () => {
      const wrist = at('handshake', 'wrist.R')
      // A distância É o dobro do alcance da mão: o encontro é no meio.
      expect(2 * wrist.z).toBeCloseTo(D_HANDSHAKE, 2)
      const other = facing(wrist, D_HANDSHAKE)
      // Os dois punhos ficam a ~5 cm — o vão que as mãos ocupam ao se apertarem.
      expect(wrist.distanceTo(other)).toBeLessThan(0.06)
      expect(wrist.y).toBeCloseTo(1.05, 1)
      // Mão na vertical com o polegar para cima: palma para o próprio lado
      // esquerdo (+X), que é onde chega a palma do outro (-X); dedos à frente.
      expect(palmDir('handshake', 'R').x).toBeGreaterThan(0.99)
      expect(fingersDir('handshake', 'R').z).toBeGreaterThan(0.99)
    })

    it('abraço: a MESMA pose nos dois, mãos nas costas do outro e cabeças sem se atravessar', () => {
      const backZ = D_HUG + 0.09
      for (const side of ['L', 'R'] as const) {
        expect(at('hug', `wrist.${side}`).z).toBeCloseTo(backZ, 2)
      }
      // Um braço por cima do ombro, outro por baixo na cintura.
      expect(at('hug', 'wrist.R').y - at('hug', 'wrist.L').y).toBeGreaterThan(0.15)
      // A cabeça só GIRA no modelo, nunca se desloca: é isso que fixa D em
      // 0,26 e não menos. Elipsoide da cabeça: 0,077 em X, 0,089 em Z.
      const head = at('hug', 'head')
      const d = head.clone().sub(facing(head, D_HUG))
      expect((d.x / 0.154) ** 2 + (d.z / 0.178) ** 2).toBeGreaterThan(1)
    })

    it('clinche: a MESMA pose nos dois, mãos atrás da nuca e testas encostadas', () => {
      const head = at('clinch', 'head')
      const otherHead = facing(head, D_CLINCH)
      // Cabeças encostadas (0,089 de meia-profundidade cada), não atravessadas.
      expect(otherHead.z - head.z).toBeGreaterThan(0.17)
      expect(otherHead.z - head.z).toBeLessThan(0.21)
      for (const side of ['L', 'R'] as const) {
        const wrist = at('clinch', `wrist.${side}`)
        // A mão passa ALÉM da nuca do outro (o ovo do crânio termina 0,074 m
        // atrás da junta `head`, já descontado o offset de 0,015 do perfil).
        expect(wrist.z).toBeGreaterThan(otherHead.z + 0.074)
        // E o COTOVELO fica bem abaixo do punho e fechado para dentro — é isso
        // que faz a pose ler como clinche, e não como braços erguidos.
        const elbow = at('clinch', `elbow.${side}`)
        expect(elbow.y).toBeLessThan(wrist.y - 0.18)
        expect(Math.abs(elbow.x)).toBeLessThan(0.26)
      }
    })

    it('dança: as mãos dadas se encontram e a outra mão pousa nas costas/no ombro', () => {
      const leadHand = at('danceLead', 'wrist.L')
      const followHand = facing(at('danceFollow', 'wrist.R'), D_DANCE)
      expect(leadHand.distanceTo(followHand)).toBeLessThan(0.01)
      // Palmas voltadas uma para a outra.
      expect(palmDir('danceLead', 'L').x).toBeLessThan(-0.99)
      expect(palmDir('danceFollow', 'R').x).toBeGreaterThan(0.99)
      // Mão do condutor nas costas do par (superfície em D + 0,085).
      expect(at('danceLead', 'wrist.R').z).toBeGreaterThan(D_DANCE + 0.08)
      // Mão do par no ombro direito do condutor.
      const onShoulder = facing(at('danceFollow', 'wrist.L'), D_DANCE)
      expect(onShoulder.distanceTo(at('danceLead', 'shoulder.R'))).toBeLessThan(0.09)
    })

    it('empurrão: as mãos de quem empurra caem na superfície do peito de quem leva', () => {
      const hands = (at('pushGiving', 'wrist.L').z + at('pushGiving', 'wrist.R').z) / 2
      const chestSurface = D_PUSH - at('pushTaking', 'chest').z - 0.09
      expect(chestSurface).toBeCloseTo(hands, 2)
      // Palmas para a frente: são elas que empurram.
      for (const side of ['L', 'R'] as const) {
        expect(palmDir('pushGiving', side).z).toBeGreaterThan(0.95)
      }
      // Quem leva o empurrão tira um pé do chão.
      expect(at('pushTaking', 'ankle.R').y).toBeGreaterThan(0.12)
    })

    it('puxar para levantar: as duas mãos se encontram, com um boneco no chão', () => {
      const helper = at('pullingUp', 'wrist.R')
      const helped = facing(at('beingPulledUp', 'wrist.R'), D_PULL)
      expect(helper.distanceTo(helped)).toBeLessThan(0.03)
      // Quem é ajudado está mesmo NO CHÃO: o quadril bem abaixo do de pé.
      expect(resolvePosePresetPlacement('beingPulledUp').groundOffsetM).toBeCloseTo(0.415 - 0.9, 5)
      expect(at('beingPulledUp', 'knee.R').y).toBeLessThan(0.12)
    })

    it('cavalinho: quem é carregado fica montado, com as mãos no peito e as pernas em volta', () => {
      // Os dois olham para o mesmo lado: o mapeamento é só o deslocamento em Z.
      const behind = (p: THREE.Vector3) => p.clone().add(new THREE.Vector3(0, 0, -D_PIGGYBACK))
      const carrierHand = at('carryingPiggyback', 'wrist.L')
      const hip = behind(at('carriedPiggyback', 'hip.L'))
      const knee = behind(at('carriedPiggyback', 'knee.L'))
      // Montado: o quadril de quem é carregado fica 0,195 m acima do de quem
      // carrega — na altura da lombar dele, e não nos ombros (o quadril do
      // passageiro tem de ficar ABAIXO do ombro de quem carrega).
      expect(hip.y - at('carryingPiggyback', 'root').y).toBeCloseTo(0.195, 2)
      expect(hip.y).toBeLessThan(at('carryingPiggyback', 'shoulder.L').y)
      // Pernas em volta da cintura: o joelho passa para a FRENTE do outro.
      expect(knee.z).toBeGreaterThan(0.15)
      // A mão de quem carrega fica encostada no eixo da coxa (raio ~0,06 m).
      const d = knee.clone().sub(hip)
      const t = Math.max(0, Math.min(1, carrierHand.clone().sub(hip).dot(d) / d.lengthSq()))
      expect(hip.clone().add(d.multiplyScalar(t)).distanceTo(carrierHand)).toBeLessThan(0.09)
      // As mãos de quem é carregado pousam no peito de quem carrega.
      const riderHand = behind(at('carriedPiggyback', 'wrist.L'))
      expect(riderHand.z).toBeGreaterThan(at('carryingPiggyback', 'chest').z + 0.08)
    })

    it('colo: o corpo de quem é carregado fica ATRAVESSADO, na altura exata dos antebraços', () => {
      // Deitado de costas ao longo de X: a cabeça para um lado, o pé para o outro.
      const head = at('carriedCradle', 'head')
      const ankle = at('carriedCradle', 'ankle.L')
      expect(head.x).toBeGreaterThan(0.55)
      expect(ankle.x).toBeLessThan(-0.6)
      // De costas: a frente do peito aponta para CIMA.
      const { joints } = buildJointFrames(placedFigure('carriedCradle'))
      const front = new THREE.Vector3(0, 0, 0.1).applyMatrix4(joints.get('chest')!.matrixWorld)
      expect(front.y).toBeGreaterThan(at('carriedCradle', 'chest').y)
      // O encaixe é a ALTURA: o eixo do corpo cai entre as duas palmas.
      const left = at('carryingCradle', 'wrist.L')
      const right = at('carryingCradle', 'wrist.R')
      expect(at('carriedCradle', 'root').y).toBeGreaterThan(right.y - 0.02)
      expect(at('carriedCradle', 'root').y).toBeLessThan(left.y + 0.02)
      // Colocado 0,28 m à frente de quem carrega, o corpo pousa nas duas mãos.
      // Atenção ao efeito da rotação: com o corpo deitado ao longo de X, a
      // separação esquerda/direita dele passa a valer em Z — as duas pernas
      // ficam uma de cada lado da mão, não em cima dela.
      const D_CRADLE = 0.28
      const shift = (p: THREE.Vector3) => p.clone().add(new THREE.Vector3(0, 0, D_CRADLE))
      expect(shift(at('carriedCradle', 'chest')).distanceTo(left)).toBeLessThan(0.08)
      const kneeL = shift(at('carriedCradle', 'knee.L'))
      const kneeR = shift(at('carriedCradle', 'knee.R'))
      expect(right.z).toBeGreaterThan(Math.min(kneeL.z, kneeR.z))
      expect(right.z).toBeLessThan(Math.max(kneeL.z, kneeR.z))
      // A mão direita fica sob a COXA (entre o quadril e o joelho em X).
      expect(right.x).toBeLessThan(-0.15)
      expect(right.x).toBeGreaterThan(at('carriedCradle', 'knee.L').x)
      // As duas palmas para cima: são elas que sustentam o corpo.
      for (const side of ['L', 'R'] as const) {
        expect(palmDir('carryingCradle', side).y).toBeGreaterThan(0.99)
      }
    })
  })
})

/**
 * 3ª entrega do catálogo (DECISOES.md #38). Mesmo contrato dos blocos
 * anteriores: cada `it` trava a restrição geométrica que DEFINE a pose.
 */
describe('3ª entrega do catálogo de poses (DECISOES.md #38)', () => {
  function placedFigure(key: PosePresetKey): Figure {
    const placement = resolvePosePresetPlacement(key)
    return {
      ...figureWithPose(resolvePosePreset(key)),
      position: [0, placement.groundOffsetM, 0],
      rotation: placement.rotation,
    }
  }

  function at(key: PosePresetKey, joint: string): THREE.Vector3 {
    const { joints } = buildJointFrames(placedFigure(key))
    const v = new THREE.Vector3()
    joints.get(joint)!.getWorldPosition(v)
    return v
  }

  function palmDir(key: PosePresetKey, side: 'L' | 'R'): THREE.Vector3 {
    const { joints } = buildJointFrames(placedFigure(key))
    const q = new THREE.Quaternion()
    joints.get(`wrist.${side}`)!.getWorldQuaternion(q)
    return new THREE.Vector3(0, 0, -1).applyQuaternion(q).normalize()
  }

  /** Ponto do rosto (nariz/olhos): offset local (0, 0.02, 0.095) da junta `head`. */
  function facePoint(key: PosePresetKey): THREE.Vector3 {
    const { joints } = buildJointFrames(placedFigure(key))
    return new THREE.Vector3(0, 0.02, 0.095).applyMatrix4(joints.get('head')!.matrixWorld)
  }

  it('meditação: cada mão pousada no PRÓPRIO joelho, com a palma para cima', () => {
    for (const side of ['L', 'R'] as const) {
      const wrist = at('meditating', `wrist.${side}`)
      const knee = at('meditating', `knee.${side}`)
      // Sobre o joelho, não dentro dele nem longe.
      expect(wrist.distanceTo(knee)).toBeLessThan(0.11)
      expect(wrist.y).toBeGreaterThan(knee.y)
      expect(palmDir('meditating', side).y).toBeGreaterThan(0.99)
    }
    // Coluna ereta: a cabeça fica praticamente sobre o quadril.
    const head = at('meditating', 'head')
    expect(Math.abs(head.z - at('meditating', 'root').z)).toBeLessThan(0.06)
  })

  it('empresário: braços cruzados COM postura — peito à frente, ombros atrás e pés afastados', () => {
    // Ombro recuado pela clavícula (em pé neutro ele fica em z = 0).
    expect(at('businessman', 'shoulder.L').z).toBeLessThan(-0.02)
    // Peito estufado: com o tronco em extensão, a junta do peito fica À FRENTE
    // da linha dos ombros (`upperChest`), e não atrás dela como em pé neutro.
    expect(at('businessman', 'chest').z).toBeGreaterThan(at('businessman', 'upperChest').z)
    // Pés bem mais afastados que em pé (0,18 m).
    const stance = Math.abs(at('businessman', 'ankle.L').x - at('businessman', 'ankle.R').x)
    expect(stance).toBeGreaterThan(0.45)
    // E os antebraços continuam se cruzando à frente do tronco.
    expect(at('businessman', 'elbow.R').x).toBeLessThan(-0.2)
    expect(at('businessman', 'wrist.R').x).toBeGreaterThan(-0.05)
    expect(at('businessman', 'elbow.L').x).toBeGreaterThan(0.2)
    expect(at('businessman', 'wrist.L').x).toBeLessThan(0.05)
  })

  it('herói: mãos na cintura, pernas bem abertas e as duas solas chapadas', () => {
    for (const side of ['L', 'R'] as const) {
      expect(at('heroStance', `wrist.${side}`).distanceTo(at('heroStance', `hip.${side}`))).toBeLessThan(0.15)
      // `ankle.z` compensa a abertura do quadril: a ponta do pé fica no chão.
      expect(at('heroStance', `ball.${side}`).y).toBeLessThan(0.03)
    }
    const stance = Math.abs(at('heroStance', 'ankle.L').x - at('heroStance', 'ankle.R').x)
    expect(stance).toBeGreaterThan(0.6)
  })

  it('deitado em X: braços para o LADO de costas e para o ALTO de bruços, com o rosto acima do chão', () => {
    // Deitado, o corpo fica no plano do chão e `shoulder.z` gira o braço
    // DENTRO dele: comparar o punho com o próprio ombro é o que distingue
    // "para o lado" de "na direção da cabeça" (DECISOES.md #40). A altura não
    // serve de critério — ela não muda com esse eixo.
    for (const key of ['lyingSpreadSupine', 'lyingSpreadProne'] as const) {
      expect(Math.abs(at(key, 'ankle.L').x - at(key, 'ankle.R').x)).toBeGreaterThan(0.9)
      expect(facePoint(key).y).toBeGreaterThan(0.02)
      // Em nenhuma das duas o braço pode apontar para os PÉS, que era o
      // defeito relatado.
      const towardsHead = at(key, 'head').z > 0 ? 1 : -1
      expect((at(key, `wrist.L`).z - at(key, 'shoulder.L').z) * towardsHead).toBeGreaterThan(-0.01)
    }

    // De costas: punho na LINHA do ombro (para o lado), bem afastado.
    for (const side of ['L', 'R'] as const) {
      const wrist = at('lyingSpreadSupine', `wrist.${side}`)
      const shoulder = at('lyingSpreadSupine', `shoulder.${side}`)
      expect(Math.abs(wrist.z - shoulder.z)).toBeLessThan(0.02)
      expect(Math.abs(wrist.x - shoulder.x)).toBeGreaterThan(0.45)
    }
    expect(Math.abs(at('lyingSpreadSupine', 'wrist.L').x - at('lyingSpreadSupine', 'wrist.R').x)).toBeGreaterThan(1.3)

    // De bruços: punho bem adiantado na direção da CABEÇA (+Z aqui), e ainda
    // aberto o bastante para a pose continuar sendo um X, não uma flecha.
    for (const side of ['L', 'R'] as const) {
      const wrist = at('lyingSpreadProne', `wrist.${side}`)
      const shoulder = at('lyingSpreadProne', `shoulder.${side}`)
      expect(wrist.z - shoulder.z).toBeGreaterThan(0.35)
      expect(Math.abs(wrist.x - shoulder.x)).toBeGreaterThan(0.2)
    }

    // De costas o rosto aponta para CIMA; de bruços a cabeça está virada.
    expect(facePoint('lyingSpreadSupine').y).toBeGreaterThan(at('lyingSpreadSupine', 'head').y)
    expect(Math.abs(facePoint('lyingSpreadProne').x - at('lyingSpreadProne', 'head').x)).toBeGreaterThan(0.05)
  })

  it('mata-leão deitado: os dois de barriga para cima, um empilhado sobre o outro', () => {
    // Deslocamento de colocação que a dica da pose pede.
    const DZ = 0.1
    const over = (joint: string) => at('groundChokeTaking', joint).clone().add(new THREE.Vector3(0, 0, DZ))

    // Os DOIS de costas: a frente do peito aponta para cima nos dois.
    for (const key of ['groundChokeGiving', 'groundChokeTaking'] as const) {
      const { joints } = buildJointFrames(placedFigure(key))
      const front = new THREE.Vector3(0, 0, 0.1).applyMatrix4(joints.get('chest')!.matrixWorld)
      expect(front.y).toBeGreaterThan(at(key, 'chest').y)
    }

    // Empilhados: as costas de quem recebe encostam no peito de quem aplica
    // (meia-espessura de peito = 0,104 para cada um).
    const backOfTop = over('chest').y - 0.104
    const chestOfBottom = at('groundChokeGiving', 'chest').y + 0.104
    expect(backOfTop).toBeLessThan(chestOfBottom)
    expect(chestOfBottom - backOfTop).toBeLessThan(0.05)

    // Antebraço direito de quem aplica cruzando a garganta de quem recebe. A
    // garganta é medida no FRAME do pescoço (8,5 cm à frente dele), não somando
    // no eixo do mundo: com o tronco reclinado as duas coisas não coincidem.
    const { joints: topJoints } = buildJointFrames(placedFigure('groundChokeTaking'))
    const throat = new THREE.Vector3(0, 0.02, 0.085)
      .applyMatrix4(topJoints.get('neck')!.matrixWorld)
      .add(new THREE.Vector3(0, 0, DZ))
    const wrist = at('groundChokeGiving', 'wrist.R')
    expect(wrist.distanceTo(throat)).toBeLessThan(0.06)
    // E a mão esquerda fechando a chave sobre o próprio antebraço direito.
    const elbowR = at('groundChokeGiving', 'elbow.R')
    const seg = wrist.clone().sub(elbowR)
    const wristL = at('groundChokeGiving', 'wrist.L')
    const t = Math.max(0, Math.min(1, wristL.clone().sub(elbowR).dot(seg) / seg.lengthSq()))
    expect(elbowR.clone().add(seg.multiplyScalar(t)).distanceTo(wristL)).toBeLessThan(0.05)

    // Pernas de quem aplica ABRAÇANDO o tronco de quem recebe: joelhos para
    // fora das costelas dele e tornozelos cruzando acima da barriga.
    for (const side of ['L', 'R'] as const) {
      const knee = at('groundChokeGiving', `knee.${side}`)
      expect(Math.abs(knee.x)).toBeGreaterThan(0.2)
      expect(knee.y).toBeGreaterThan(over('chest').y)
      const ankle = at('groundChokeGiving', `ankle.${side}`)
      expect(Math.abs(ankle.x)).toBeLessThan(0.1)
      expect(ankle.y).toBeGreaterThan(over('spine').y + 0.05)
      // `hip.x` cravado no limite: subir a perna em volta do outro exige a
      // flexão máxima que o modelo dá.
      expect(resolvePosePreset('groundChokeGiving')[`hip.${side}`].x).toBe(-120)
    }

    // As duas cabeças ficam lado a lado sem se atravessar (0,077 de
    // meia-largura cada) — a inclinação lateral do pescoço é o que separa.
    expect(over('head').distanceTo(at('groundChokeGiving', 'head'))).toBeGreaterThan(0.18)
    // E a de quem aplica NÃO afunda no chão: deitado de costas, estender o
    // pescoço empurraria o crânio para baixo.
    expect(at('groundChokeGiving', 'head').y).toBeGreaterThan(0.05)
  })

  it('sentado de pernas esticadas: perna deitada na horizontal e mãos espalmadas atrás', () => {
    const hip = at('sittingLegsForward', 'hip.L')
    const knee = at('sittingLegsForward', 'knee.L')
    const ankle = at('sittingLegsForward', 'ankle.L')
    expect(Math.abs(knee.y - hip.y)).toBeLessThan(0.02)
    expect(Math.abs(ankle.y - hip.y)).toBeLessThan(0.02)
    expect(ankle.z).toBeGreaterThan(0.75)
    for (const side of ['L', 'R'] as const) {
      // Mão ATRÁS do quadril e espalmada: punho e ponta dos dedos os dois baixos.
      const wrist = at('sittingLegsForward', `wrist.${side}`)
      expect(wrist.z).toBeLessThan(-0.2)
      expect(wrist.y).toBeLessThan(0.16)
      expect(at('sittingLegsForward', `fingersTip.${side}`).y).toBeLessThan(0.07)
    }
  })

  it('sentado de joelhos dobrados: a pelve RECLINA para o joelho subir, e a sola fica chapada', () => {
    // Sem reclinar a pelve o quadril bate no limite de 120° e o joelho não
    // sobe — é a reclinação que faz a pose existir.
    expect(resolvePosePresetPlacement('sittingKneesBent').rotation.x).toBe(-25)
    expect(resolvePosePresetPlacement('sittingKneesBent').preservesHeading).toBe(false)
    expect(resolvePosePreset('sittingKneesBent')['hip.L'].x).toBe(-120)
    const knee = at('sittingKneesBent', 'knee.L')
    const ankle = at('sittingKneesBent', 'ankle.L')
    expect(knee.y).toBeGreaterThan(0.4)
    // Sola no chão = tornozelo em ~0,07 E ponta em ~0,01, as duas juntas.
    expect(ankle.y).toBeCloseTo(0.07, 1)
    expect(at('sittingKneesBent', 'ball.L').y).toBeLessThan(0.03)
    expect(ankle.z).toBeLessThan(0.45)
    for (const side of ['L', 'R'] as const) {
      expect(at('sittingKneesBent', `wrist.${side}`).z).toBeLessThan(-0.2)
    }
  })

  it('mata-leão: quem aplica ajoelha 0,45 m atrás, com o antebraço na garganta de quem senta', () => {
    const D = 0.45
    // Os dois olham para o mesmo lado: o mapeamento é só o deslocamento em Z.
    const back = (p: THREE.Vector3) => p.clone().add(new THREE.Vector3(0, 0, -D))
    const neck = at('rearChokeSeated', 'neck')
    const wrist = back(at('rearChokeKneeling', 'wrist.R'))
    // O antebraço cruza a garganta: o punho sai do outro lado do pescoço.
    expect(wrist.x).toBeGreaterThan(0.03)
    expect(Math.abs(wrist.y - neck.y)).toBeLessThan(0.12)
    expect(wrist.z).toBeGreaterThan(neck.z)
    // Chave: a mão esquerda fecha sobre o PRÓPRIO antebraço direito.
    const elbowR = at('rearChokeKneeling', 'elbow.R')
    const wristR = at('rearChokeKneeling', 'wrist.R')
    const wristL = at('rearChokeKneeling', 'wrist.L')
    const seg = wristR.clone().sub(elbowR)
    const t = Math.max(0, Math.min(1, wristL.clone().sub(elbowR).dot(seg) / seg.lengthSq()))
    expect(elbowR.clone().add(seg.multiplyScalar(t)).distanceTo(wristL)).toBeLessThan(0.05)
    // Quem recebe está SENTADO no chão, com as duas mãos no próprio pescoço.
    expect(at('rearChokeSeated', 'root').y).toBeLessThan(0.12)
    for (const side of ['L', 'R'] as const) {
      expect(at('rearChokeSeated', `wrist.${side}`).distanceTo(neck)).toBeLessThan(0.2)
    }
  })

  it('mata-leão: o peito de quem aplica ENCOSTA na nuca de quem recebe, sem atravessá-la', () => {
    const D = 0.45
    const chestFront = at('rearChokeKneeling', 'chest').z - D + 0.104
    // Nuca: o ovo do crânio termina 0,074 m atrás da junta `head`.
    const head = at('rearChokeSeated', 'head')
    const face = facePoint('rearChokeSeated')
    const skullBack = head.clone().addScaledVector(face.clone().sub(head).normalize(), -0.074)
    const folga = skullBack.z - chestFront
    expect(folga).toBeGreaterThan(-0.02)
    expect(folga).toBeLessThan(0.06)
    // E os joelhos de quem aplica ficam ATRÁS do quadril de quem senta.
    expect(at('rearChokeKneeling', 'knee.L').z - D).toBeLessThan(-0.081)
  })
})

/**
 * 4ª entrega do catálogo de poses: "Dança pop" (pedido do usuário — 4 poses
 * de K-pop e os trechos de animação associados, ver DECISOES.md). Cada `it`
 * trava a restrição geométrica resolvida numericamente no comentário do
 * preset em `posePresets.ts`.
 */
describe('4ª entrega do catálogo de poses — dança pop (K-pop)', () => {
  function placedFigure(key: PosePresetKey): Figure {
    const placement = resolvePosePresetPlacement(key)
    return {
      ...figureWithPose(resolvePosePreset(key)),
      position: [0, placement.groundOffsetM, 0],
      rotation: placement.rotation,
    }
  }

  function at(key: PosePresetKey, joint: string): THREE.Vector3 {
    const { joints } = buildJointFrames(placedFigure(key))
    const v = new THREE.Vector3()
    joints.get(joint)!.getWorldPosition(v)
    return v
  }

  it('coração: punho perto da cabeça/bochecha, cotovelo abaixo dele e perto do corpo', () => {
    const wrist = at('kpopFingerHeart', 'wrist.R')
    const elbow = at('kpopFingerHeart', 'elbow.R')
    const head = at('kpopFingerHeart', 'head')
    expect(wrist.distanceTo(head)).toBeLessThan(0.3)
    expect(elbow.y).toBeLessThan(wrist.y - 0.03)
    expect(Math.abs(elbow.x)).toBeLessThan(0.2)
  })

  it('robô: cotovelo na altura do ombro (abdução) e punho em cima dele (antebraço vertical)', () => {
    for (const side of ['L', 'R'] as const) {
      const shoulder = at('kpopBoxArms', `shoulder.${side}`)
      const elbow = at('kpopBoxArms', `elbow.${side}`)
      const wrist = at('kpopBoxArms', `wrist.${side}`)
      expect(Math.abs(elbow.y - shoulder.y)).toBeLessThan(0.01)
      expect(Math.abs(elbow.x)).toBeGreaterThan(Math.abs(shoulder.x) + 0.2)
      expect(wrist.y - elbow.y).toBeGreaterThan(0.2)
      expect(Math.abs(wrist.x - elbow.x)).toBeLessThan(0.01)
    }
  })

  it('apontar: quadril deslocado (base da pose "Modelo") e punho direito bem acima da cabeça', () => {
    const pose = resolvePosePreset('kpopPointDance')
    // Mesma assinatura da pose "Modelo": perna esquerda de apoio, direita cruzada.
    expect(pose['knee.L'].x).toBeLessThan(pose['knee.R'].x)
    const wristL = at('kpopPointDance', 'wrist.L')
    const hipL = at('kpopPointDance', 'hip.L')
    expect(wristL.distanceTo(hipL)).toBeLessThan(0.16)
    const wristR = at('kpopPointDance', 'wrist.R')
    const head = at('kpopPointDance', 'head')
    expect(wristR.y).toBeGreaterThan(head.y + 0.2)
  })

  it('onda de ombro: o ombro direito fica bem mais alto que o esquerdo, pernas intocadas', () => {
    const shoulderL = at('kpopShoulderWave', 'shoulder.L')
    const shoulderR = at('kpopShoulderWave', 'shoulder.R')
    expect(shoulderR.y - shoulderL.y).toBeGreaterThan(0.08)
    // As pernas continuam as da pose em pé — nenhum pé sai do lugar.
    const standing = resolvePosePreset('standing')
    const pose = resolvePosePreset('kpopShoulderWave')
    for (const joint of ['hip.L', 'hip.R', 'knee.L', 'knee.R', 'ankle.L', 'ankle.R'] as const) {
      expect(pose[joint]).toEqual(standing[joint])
    }
  })
})
