import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { JOINT_NAMES, ROOT_JOINT_NAME, getJoint, getJointAxes, type JointRotation } from '../skeleton'
import { resolveHandPreset } from '../handPresets'
import {
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
  it('lists the 5 presets of the plan plus the 5 added later (ver DECISOES.md #30)', () => {
    expect(POSE_PRESET_KEYS).toEqual([
      'standing',
      'tpose',
      'sitting',
      'walking',
      'running',
      'lyingHandsBehindHead',
      'fetal',
      'fighting',
      'superman',
      'model',
    ])
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

  it.each(POSE_PRESET_KEYS)('%s: nenhuma junta atravessa o chão', (key) => {
    for (const [name, position] of worldPositions(placedFigure(key))) {
      expect(`${name} y=${position.y.toFixed(3)}`).toBe(`${name} y=${Math.max(0, position.y).toFixed(3)}`)
    }
  })

  const GROUNDED: readonly PosePresetKey[] = ['standing', 'tpose', 'sitting', 'fetal', 'fighting', 'model']

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

  it.each(POSE_PRESET_KEYS)('%s: só impõe a direção que o boneco encara quando de fato o inclina', (key) => {
    const placement = resolvePosePresetPlacement(key)
    const tilts = placement.rotation.x !== 0 || placement.rotation.z !== 0
    expect(placement.preservesHeading).toBe(!tilts)
  })

  it('cada pose de corpo usa a mão que o usuário escolheu para ela', () => {
    const byPreset = Object.fromEntries(POSE_PRESET_KEYS.map((key) => [key, getPosePresetHands(key)]))
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
    })
  })

  it.each(POSE_PRESET_KEYS)('%s: as juntas da mão são exatamente a pose de mão declarada', (key) => {
    const hands = getPosePresetHands(key)
    const pose = resolvePosePreset(key)
    for (const side of ['L', 'R'] as const) {
      const expected = resolveHandPreset(hands ?? 'open', side)
      for (const [jointName, rotation] of Object.entries(expected)) {
        expect({ [jointName]: pose[jointName] }).toEqual({ [jointName]: rotation })
      }
    }
  })

  const SYMMETRIC: readonly PosePresetKey[] = ['standing', 'tpose', 'sitting', 'lyingHandsBehindHead', 'fetal', 'superman']

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
