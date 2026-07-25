import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildJointFrames } from '../jointFrames'
import {
  getJointSide,
  getMirroredJointName,
  getSideJointNames,
  mirrorPoseSide,
  mirrorRotation,
  negateAngle,
  swapPoseSides,
} from '../poseMirror'
import { resolvePosePreset } from '../posePresets'
import { JOINTS, JOINT_NAMES, clampJointRotation, type JointRotation } from '../skeleton'
import type { Figure } from '../../store/figuresStore'

/** Pose de um lado com valores "quebrados" de propósito, em todos os eixos que existem. */
const RIGHT_SIDE_POSE: Record<string, Partial<JointRotation>> = {
  'clavicle.R': { y: 7, z: -11 },
  'shoulder.R': { x: -37, y: 23, z: -64 },
  'elbow.R': { x: -71, y: -113 },
  'wrist.R': { x: 19, z: -13 },
  'thumb1.R': { x: 17, z: -21 },
  'thumb2.R': { y: 43 },
  'fingersBase.R': { x: 31 },
  'fingersMid.R': { x: 52 },
  'fingersTip.R': { x: 24 },
  'hip.R': { x: -53, y: 17, z: -29 },
  'knee.R': { x: 61 },
  'ankle.R': { x: 13, z: -19 },
  'ball.R': { x: 22 },
}

function poseFrom(partial: Record<string, Partial<JointRotation>>): Record<string, JointRotation> {
  const pose: Record<string, JointRotation> = {}
  for (const name of JOINT_NAMES) {
    if (name === 'root') continue
    pose[name] = clampJointRotation(name, partial[name] ?? {})
  }
  return pose
}

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

function worldPositions(pose: Record<string, JointRotation>): Map<string, THREE.Vector3> {
  const { joints } = buildJointFrames(figureWithPose(pose))
  const out = new Map<string, THREE.Vector3>()
  for (const name of JOINT_NAMES) {
    const v = new THREE.Vector3()
    joints.get(name)!.getWorldPosition(v)
    out.set(name, v)
  }
  return out
}

describe('poseMirror — identificação de lado', () => {
  it('reconhece o lado pelo sufixo e ignora as juntas centrais', () => {
    expect(getJointSide('shoulder.L')).toBe('L')
    expect(getJointSide('ball.R')).toBe('R')
    expect(getJointSide('spine')).toBeNull()
    expect(getJointSide('root')).toBeNull()
  })

  it('aponta para a junta correspondente do outro lado', () => {
    expect(getMirroredJointName('fingersTip.L')).toBe('fingersTip.R')
    expect(getMirroredJointName('fingersTip.R')).toBe('fingersTip.L')
    expect(getMirroredJointName('head')).toBeNull()
  })

  it('lista os dois lados com o mesmo tamanho e cobre todas as juntas pareadas do esqueleto', () => {
    const left = getSideJointNames('L')
    const right = getSideJointNames('R')
    expect(left).toHaveLength(right.length)
    expect(left.length + right.length).toBe(JOINT_NAMES.filter((n) => n.includes('.')).length)
    expect(left.map((n) => getMirroredJointName(n))).toEqual(right)
  })
})

describe('poseMirror — a regra do espelho', () => {
  it('preserva X e nega Y e Z, sem produzir -0', () => {
    expect(mirrorRotation({ x: 30, y: -20, z: 15 })).toEqual({ x: 30, y: 20, z: -15 })
    expect(mirrorRotation({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 })
    expect(Object.is(negateAngle(0), 0)).toBe(true)
  })

  /**
   * A trava principal do módulo, e o motivo de a regra ser `(x, -y, -z)` e não
   * uma cópia direta: montando a cinemática direta, cada junta do lado copiado
   * cai EXATAMENTE na posição de mundo do par com X negado. Verificação
   * numérica, não dedução — ver o docblock de `poseMirror.ts`.
   */
  it('coloca cada junta na posição de mundo espelhada, com erro nulo', () => {
    const world = worldPositions(mirrorPoseSide(poseFrom(RIGHT_SIDE_POSE), 'R'))

    for (const name of getSideJointNames('R')) {
      const right = world.get(name)!
      const left = world.get(getMirroredJointName(name)!)!
      expect(left.x + right.x).toBeCloseTo(0, 9)
      expect(left.y).toBeCloseTo(right.y, 9)
      expect(left.z).toBeCloseTo(right.z, 9)
    }
  })

  it('copiar sem negar Y e Z NÃO produz o espelho (é o erro que a regra evita)', () => {
    const pose = poseFrom(RIGHT_SIDE_POSE)
    for (const name of getSideJointNames('R')) {
      pose[getMirroredJointName(name)!] = clampJointRotation(getMirroredJointName(name)!, pose[name])
    }

    const world = worldPositions(pose)
    const worst = getSideJointNames('R').reduce((max, name) => {
      const right = world.get(name)!
      const left = world.get(getMirroredJointName(name)!)!
      return Math.max(max, Math.abs(left.x + right.x), Math.abs(left.y - right.y), Math.abs(left.z - right.z))
    }, 0)

    expect(worst).toBeGreaterThan(0.5)
  })

  it('os limites dos dois lados são espelho um do outro — sem isso o espelho perderia ângulo', () => {
    const byName = new Map(JOINTS.map((joint) => [joint.name, joint]))

    for (const name of getSideJointNames('L')) {
      const left = byName.get(name)!
      const right = byName.get(getMirroredJointName(name)!)!
      for (const axis of ['x', 'y', 'z'] as const) {
        const a = left.limits[axis]
        const b = right.limits[axis]
        expect(Boolean(a)).toBe(Boolean(b))
        if (!a || !b) continue
        // X igual nos dois lados; Y e Z invertidos e trocados (min ↔ -max).
        const expected =
          axis === 'x'
            ? { min: a.min, max: a.max }
            : { min: negateAngle(a.max), max: negateAngle(a.min) }
        expect({ [`${name}.${axis}`]: b }).toEqual({ [`${name}.${axis}`]: expected })
      }
    }
  })
})

describe('mirrorPoseSide', () => {
  it('copia o lado indicado para o outro e não toca em nada mais', () => {
    const pose = poseFrom({ ...RIGHT_SIDE_POSE, spine: { x: 12, y: 9, z: -7 } })
    const mirrored = mirrorPoseSide(pose, 'R')

    expect(mirrored['shoulder.L']).toEqual({ x: -37, y: -23, z: 64 })
    // Juntas centrais e o próprio lado de origem ficam intactos.
    expect(mirrored.spine).toEqual(pose.spine)
    expect(mirrored['shoulder.R']).toEqual(pose['shoulder.R'])
  })

  it('sobrescreve o que havia no lado de destino (é uma cópia, não uma fusão)', () => {
    const pose = poseFrom({ ...RIGHT_SIDE_POSE, 'knee.L': { x: 140 } })
    expect(mirrorPoseSide(pose, 'R')['knee.L'].x).toBe(61)
  })

  it('não modifica a pose recebida', () => {
    const pose = poseFrom(RIGHT_SIDE_POSE)
    const before = structuredClone(pose)
    mirrorPoseSide(pose, 'R')
    expect(pose).toEqual(before)
  })

  it('aplicar nos dois sentidos deixa a pose simétrica', () => {
    const once = mirrorPoseSide(poseFrom(RIGHT_SIDE_POSE), 'R')
    const world = worldPositions(once)
    for (const name of getSideJointNames('R')) {
      expect(world.get(getMirroredJointName(name)!)!.x + world.get(name)!.x).toBeCloseTo(0, 9)
    }
  })
})

describe('swapPoseSides', () => {
  it('troca os dois lados, cada um espelhado ao mudar de lado', () => {
    const pose = poseFrom({ ...RIGHT_SIDE_POSE, 'knee.L': { x: 140 } })
    const swapped = swapPoseSides(pose)

    expect(swapped['shoulder.L']).toEqual(mirrorRotation(pose['shoulder.R']))
    expect(swapped['shoulder.R']).toEqual(mirrorRotation(pose['shoulder.L']))
    expect(swapped['knee.R'].x).toBe(140)
    expect(swapped['knee.L'].x).toBe(61)
  })

  it('é uma involução: aplicar duas vezes devolve a pose original', () => {
    const pose = poseFrom({ ...RIGHT_SIDE_POSE, 'shoulder.L': { x: -12, z: 33 }, spine: { y: 20 } })
    expect(swapPoseSides(swapPoseSides(pose))).toEqual(pose)
  })

  it('não mexe nas juntas centrais — inverter os lados não vira o tronco', () => {
    const pose = poseFrom({ ...RIGHT_SIDE_POSE, spine: { y: 20, z: -10 }, neck: { y: 30 } })
    const swapped = swapPoseSides(pose)
    expect(swapped.spine).toEqual(pose.spine)
    expect(swapped.neck).toEqual(pose.neck)
  })

  it('numa pose simétrica (T-pose) não muda nada', () => {
    const pose = resolvePosePreset('tpose')
    expect(swapPoseSides(pose)).toEqual(pose)
  })

  it('inverte de fato uma pose assimétrica (andando troca a perna da frente)', () => {
    const pose = resolvePosePreset('walking')
    const swapped = swapPoseSides(pose)
    expect(swapped['hip.L'].x).toBe(pose['hip.R'].x)
    expect(swapped['hip.R'].x).toBe(pose['hip.L'].x)
  })
})
