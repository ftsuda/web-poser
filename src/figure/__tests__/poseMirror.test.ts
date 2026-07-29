import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildJointFrames } from '../jointFrames'
import {
  getJointSide,
  getMirrorScope,
  getMirroredJointName,
  getSideJointNames,
  CENTRAL_JOINT_NAMES,
  mirrorPoseFull,
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
  'indexBase.R': { x: 27 },
  'indexMid.R': { x: 48 },
  'indexTip.R': { x: 19 },
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

/**
 * Escopo parcial (pedido do usuário, ver DECISOES.md #34): com uma junta
 * selecionada, espelhar/inverter valem só dela para baixo — o exemplo dado foi
 * "com o ombro direito selecionado, as pernas ficam intactas".
 */
describe('getMirrorScope', () => {
  it('sem junta de escopo, cobre todas as juntas pareadas', () => {
    expect([...getMirrorScope()].sort()).toEqual(
      [...getSideJointNames('L'), ...getSideJointNames('R')].sort(),
    )
  })

  it('na raiz é o boneco inteiro — o comando de corpo todo virou um caso deste', () => {
    expect(getMirrorScope('root')).toEqual(getMirrorScope())
  })

  it('a partir de uma junta de um lado, pega ela e o que vem depois — nos DOIS lados', () => {
    const chain = [
      'shoulder',
      'elbow',
      'wrist',
      'thumb1',
      'thumb2',
      'indexBase',
      'indexMid',
      'indexTip',
      'fingersBase',
      'fingersMid',
      'fingersTip',
    ]
    expect([...getMirrorScope('shoulder.R')].sort()).toEqual(
      [...chain.map((n) => `${n}.R`), ...chain.map((n) => `${n}.L`)].sort(),
    )
  })

  it('o exemplo do usuário: com o ombro direito selecionado, pernas e clavícula ficam fora', () => {
    const scope = getMirrorScope('shoulder.R')
    expect(scope).not.toContain('hip.L')
    expect(scope).not.toContain('knee.R')
    expect(scope).not.toContain('clavicle.R')
  })

  it('a partir do tronco pega os dois braços, porque as pernas nascem na raiz', () => {
    const scope = getMirrorScope('spine')
    expect(scope).toContain('clavicle.L')
    expect(scope).toContain('fingersTip.R')
    expect(scope.filter((name) => name.startsWith('hip') || name.startsWith('knee'))).toEqual([])
  })

  it('é vazio onde não há junta pareada embaixo (pescoço e cabeça)', () => {
    expect(getMirrorScope('neck')).toEqual([])
    expect(getMirrorScope('head')).toEqual([])
  })
})

describe('espelho e inversão parciais', () => {
  it('mirrorPoseSide copia só o que está no escopo', () => {
    const pose = poseFrom({ ...RIGHT_SIDE_POSE, 'clavicle.L': { y: -3 } })
    const mirrored = mirrorPoseSide(pose, 'R', 'shoulder.R')

    expect(mirrored['shoulder.L']).toEqual(mirrorRotation(pose['shoulder.R']))
    expect(mirrored['fingersTip.L']).toEqual(mirrorRotation(pose['fingersTip.R']))
    // Fora do escopo: a perna e a clavícula (acima da junta selecionada) intactas.
    expect(mirrored['knee.L']).toEqual(pose['knee.L'])
    expect(mirrored['ankle.L']).toEqual(pose['ankle.L'])
    expect(mirrored['clavicle.L']).toEqual(pose['clavicle.L'])
  })

  /**
   * A mesma verificação numérica do espelho completo, agora restrita: com o
   * escopo na clavícula (o braço inteiro, pendurado numa junta central), cada
   * junta do braço cai na posição de mundo do par com X negado — enquanto a
   * perna, fora do escopo, continua assimétrica.
   */
  it('a cadeia espelhada cai na posição de mundo espelhada, com erro nulo', () => {
    const world = worldPositions(mirrorPoseSide(poseFrom(RIGHT_SIDE_POSE), 'R', 'clavicle.R'))

    for (const name of getMirrorScope('clavicle.R').filter((n) => getJointSide(n) === 'R')) {
      const right = world.get(name)!
      const left = world.get(getMirroredJointName(name)!)!
      expect(left.x + right.x).toBeCloseTo(0, 9)
      expect(left.y).toBeCloseTo(right.y, 9)
      expect(left.z).toBeCloseTo(right.z, 9)
    }

    const kneeR = world.get('knee.R')!
    const kneeL = world.get('knee.L')!
    const diff = Math.max(
      Math.abs(kneeL.x + kneeR.x),
      Math.abs(kneeL.y - kneeR.y),
      Math.abs(kneeL.z - kneeR.z),
    )
    expect(diff).toBeGreaterThan(0.05)
  })

  it('swapPoseSides no escopo troca só a cadeia selecionada', () => {
    const pose = poseFrom({ ...RIGHT_SIDE_POSE, 'shoulder.L': { x: -10, z: 15 }, 'knee.L': { x: 140 } })
    const swapped = swapPoseSides(pose, 'shoulder.L')

    expect(swapped['shoulder.R']).toEqual(mirrorRotation(pose['shoulder.L']))
    expect(swapped['shoulder.L']).toEqual(mirrorRotation(pose['shoulder.R']))
    expect(swapped['knee.L']).toEqual(pose['knee.L'])
    expect(swapped['knee.R']).toEqual(pose['knee.R'])
  })

  it('a troca parcial continua sendo involução', () => {
    const pose = poseFrom({ ...RIGHT_SIDE_POSE, 'shoulder.L': { x: -12, z: 33 } })
    expect(swapPoseSides(swapPoseSides(pose, 'shoulder.R'), 'shoulder.R')).toEqual(pose)
  })

  it('escopo sem junta pareada embaixo não muda nada', () => {
    const pose = poseFrom(RIGHT_SIDE_POSE)
    expect(mirrorPoseSide(pose, 'R', 'head')).toEqual(pose)
    expect(swapPoseSides(pose, 'neck')).toEqual(pose)
  })

  it('o escopo não depende do lado da junta selecionada — só de onde ela fica na cadeia', () => {
    expect(getMirrorScope('shoulder.L')).toEqual(getMirrorScope('shoulder.R'))
    const pose = poseFrom(RIGHT_SIDE_POSE)
    expect(mirrorPoseSide(pose, 'R', 'shoulder.L')).toEqual(mirrorPoseSide(pose, 'R', 'shoulder.R'))
  })
})

/**
 * Espelho COMPLETO (pedido do usuário): os membros trocam de lado E as juntas
 * sem par têm a rotação refletida. Sem o segundo passo, um tronco torcido e uma
 * cabeça virada ficavam para o mesmo lado enquanto os braços trocavam.
 */
describe('poseMirror — espelho completo do boneco', () => {
  /** Pose torta dos DOIS lados mais tronco/pescoço/cabeça fora do eixo. */
  const POSE_ASSIMETRICA: Record<string, Partial<JointRotation>> = {
    ...RIGHT_SIDE_POSE,
    'shoulder.L': { x: -12, y: -41, z: 33 },
    'elbow.L': { x: -22 },
    'hip.L': { x: 14, y: -9, z: 21 },
    spine: { x: 6, y: 18, z: -13 },
    chest: { y: -11, z: 9 },
    upperChest: { y: 8, z: -6 },
    neck: { x: -4, y: 21, z: -14 },
    head: { x: 9, y: -27, z: 11 },
  }

  it('reconhece exatamente as juntas sem par, e a raiz não é uma delas', () => {
    expect([...CENTRAL_JOINT_NAMES]).toEqual(['spine', 'chest', 'upperChest', 'neck', 'head'])
    expect(CENTRAL_JOINT_NAMES).not.toContain('root')
  })

  it('inverte Y e Z das juntas sem par, preservando X', () => {
    const pose = poseFrom(POSE_ASSIMETRICA)
    const mirrored = mirrorPoseFull(pose)

    for (const name of CENTRAL_JOINT_NAMES) {
      expect(mirrored[name]).toEqual(clampJointRotation(name, mirrorRotation(pose[name])))
    }
    expect(mirrored.head).toEqual({ x: 9, y: 27, z: -11 })
  })

  it('continua trocando os membros de lado, como o "inverter lados"', () => {
    const pose = poseFrom(POSE_ASSIMETRICA)

    expect(mirrorPoseFull(pose)).toMatchObject(
      Object.fromEntries(
        JOINT_NAMES.filter((name) => getJointSide(name) !== null).map((name) => [
          name,
          swapPoseSides(pose)[name],
        ]),
      ),
    )
  })

  /**
   * A trava principal: com a pose espelhada, a cinemática direta põe cada junta
   * na posição de mundo da junta correspondente com X negado — as pareadas na
   * do par, e as CENTRAIS na delas mesmas. É o que "exatamente espelhado"
   * significa, medido em vez de deduzido.
   */
  it('põe cada junta na posição de mundo espelhada, com erro nulo', () => {
    const antes = worldPositions(poseFrom(POSE_ASSIMETRICA))
    const depois = worldPositions(mirrorPoseFull(poseFrom(POSE_ASSIMETRICA)))

    for (const name of JOINT_NAMES) {
      const alvo = antes.get(getMirroredJointName(name) ?? name)!
      const obtido = depois.get(name)!
      expect(obtido.x + alvo.x).toBeCloseTo(0, 9)
      expect(obtido.y).toBeCloseTo(alvo.y, 9)
      expect(obtido.z).toBeCloseTo(alvo.z, 9)
    }
  })

  /** Sem refletir as centrais, o tronco e a cabeça delatam o espelho pela metade. */
  it('trocar só os lados NÃO espelha a cabeça nem o tronco', () => {
    const antes = worldPositions(poseFrom(POSE_ASSIMETRICA))
    const depois = worldPositions(swapPoseSides(poseFrom(POSE_ASSIMETRICA)))

    const pior = CENTRAL_JOINT_NAMES.reduce((max, name) => {
      const alvo = antes.get(name)!
      const obtido = depois.get(name)!
      return Math.max(max, Math.abs(obtido.x + alvo.x))
    }, 0)

    expect(pior).toBeGreaterThan(0.02)
  })

  it('aplicado duas vezes, devolve a pose original', () => {
    const pose = poseFrom(POSE_ASSIMETRICA)

    expect(mirrorPoseFull(mirrorPoseFull(pose))).toEqual(pose)
  })
})
