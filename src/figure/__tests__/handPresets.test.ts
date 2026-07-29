import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  HAND_JOINT_BASE_NAMES,
  HAND_PRESET_KEYS,
  getHandJointNames,
  isHandJoint,
  resolveHandPreset,
} from '../handPresets'
import { buildJointFrames } from '../jointFrames'
import { mirrorRotation, SIDES } from '../poseMirror'
import { resolvePosePreset } from '../posePresets'
import { getJoint, getJointAxes, type JointRotation } from '../skeleton'
import type { Figure } from '../../store/figuresStore'

function figureWithHand(pose: Record<string, JointRotation>): Figure {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: { ...resolvePosePreset('tpose'), ...pose },
  }
}

/** Distância da ponta dos dedos até a palma, medindo o quanto a mão está fechada. */
function fingerTipToPalm(figure: Figure, side: 'L' | 'R'): number {
  const { joints } = buildJointFrames(figure)
  const wrist = new THREE.Vector3()
  joints.get(`wrist.${side}`)!.getWorldPosition(wrist)
  const tip = new THREE.Vector3()
  joints.get(`fingersTip.${side}`)!.getWorldPosition(tip)
  return wrist.distanceTo(tip)
}

describe('handPresets', () => {
  it('lista as poses pedidas, com apontar e pinça a partir do dedo indicador separado (#45)', () => {
    expect(HAND_PRESET_KEYS).toEqual(['open', 'relaxed', 'fist', 'thumbsUp', 'point', 'pinch'])
  })

  it('cobre exatamente as 8 juntas da mão, sem o punho', () => {
    expect(getHandJointNames('L')).toEqual([
      'thumb1.L',
      'thumb2.L',
      'indexBase.L',
      'indexMid.L',
      'indexTip.L',
      'fingersBase.L',
      'fingersMid.L',
      'fingersTip.L',
    ])
    expect(HAND_JOINT_BASE_NAMES).not.toContain('wrist')
    expect(isHandJoint('thumb2.R')).toBe(true)
    expect(isHandJoint('wrist.R')).toBe(false)
    expect(isHandJoint('elbow.L')).toBe(false)
  })

  it.each(HAND_PRESET_KEYS)('%s: só devolve as juntas da mão do lado pedido', (key) => {
    for (const side of SIDES) {
      expect(Object.keys(resolveHandPreset(key, side)).sort()).toEqual(getHandJointNames(side).sort())
    }
  })

  it.each(HAND_PRESET_KEYS)('%s: respeita os limites e os eixos travados de cada junta', (key) => {
    for (const side of SIDES) {
      for (const [jointName, rotation] of Object.entries(resolveHandPreset(key, side))) {
        const axes = getJointAxes(jointName)
        for (const axis of ['x', 'y', 'z'] as const) {
          const limit = getJoint(jointName).limits[axis]
          if (!axes.includes(axis)) {
            expect(rotation[axis]).toBe(0)
            continue
          }
          expect(rotation[axis]).toBeGreaterThanOrEqual(limit!.min)
          expect(rotation[axis]).toBeLessThanOrEqual(limit!.max)
        }
      }
    }
  })

  /**
   * A mão direita não tem tabela de números própria: sai por reflexão da
   * esquerda. Isto trava essa propriedade — se alguém acrescentar um valor só
   * de um lado, o teste quebra.
   */
  it.each(HAND_PRESET_KEYS)('%s: a mão direita é o espelho exato da esquerda', (key) => {
    const left = resolveHandPreset(key, 'L')
    const right = resolveHandPreset(key, 'R')
    for (const base of HAND_JOINT_BASE_NAMES) {
      expect({ [base]: right[`${base}.R`] }).toEqual({ [base]: mirrorRotation(left[`${base}.L`]) })
    }
  })

  it('aberta é a pose neutra do esqueleto (a mesma com que um boneco nasce)', () => {
    for (const side of SIDES) {
      for (const rotation of Object.values(resolveHandPreset('open', side))) {
        expect(rotation).toEqual({ x: 0, y: 0, z: 0 })
      }
    }
  })

  it('fecha progressivamente: aberta > relaxada > fechada, medido no espaço', () => {
    for (const side of SIDES) {
      const open = fingerTipToPalm(figureWithHand(resolveHandPreset('open', side)), side)
      const relaxed = fingerTipToPalm(figureWithHand(resolveHandPreset('relaxed', side)), side)
      const fist = fingerTipToPalm(figureWithHand(resolveHandPreset('fist', side)), side)
      expect(relaxed).toBeLessThan(open)
      expect(fist).toBeLessThan(relaxed)
    }
  })

  it('curva os dedos em direção à PALMA (-Z local), não ao dorso', () => {
    for (const side of SIDES) {
      const figure = figureWithHand(resolveHandPreset('fist', side))
      const { joints } = buildJointFrames(figure)
      // A ponta dos dedos, trazida ao espaço local do punho, tem de cair no
      // lado da palma (z negativo) — é a convenção de modelagem do #25.
      const tip = new THREE.Vector3()
      joints.get(`fingersTip.${side}`)!.getWorldPosition(tip)
      joints.get(`wrist.${side}`)!.worldToLocal(tip)
      expect(tip.z).toBeLessThan(0)
    }
  })

  it('thumbs-up: dedos fechados como no punho, mas polegar totalmente estendido', () => {
    for (const side of SIDES) {
      const fist = resolveHandPreset('fist', side)
      const thumbsUp = resolveHandPreset('thumbsUp', side)

      // Dedos igualmente enrolados (mesma ordem de grandeza do punho).
      expect(Math.abs(thumbsUp[`fingersBase.${side}`].x)).toBeGreaterThan(
        Math.abs(fist[`fingersBase.${side}`].x) - 15,
      )
      // Polegar reto e aberto, ao contrário do punho, onde ele dobra por cima.
      expect(thumbsUp[`thumb2.${side}`].y).toBe(0)
      expect(thumbsUp[`thumb1.${side}`].z).toBe(0)
      expect(Math.abs(fist[`thumb2.${side}`].y)).toBeGreaterThan(50)
    }
  })

  it('thumbs-up deixa o polegar mais longe da palma que o punho fechado', () => {
    for (const side of SIDES) {
      const distance = (key: 'fist' | 'thumbsUp') => {
        const { joints } = buildJointFrames(figureWithHand(resolveHandPreset(key, side)))
        const thumb = new THREE.Vector3()
        joints.get(`thumb2.${side}`)!.getWorldPosition(thumb)
        const fingers = new THREE.Vector3()
        joints.get(`fingersMid.${side}`)!.getWorldPosition(fingers)
        return thumb.distanceTo(fingers)
      }
      expect(distance('thumbsUp')).toBeGreaterThan(distance('fist'))
    }
  })

  it('aplicar uma pose de mão não interfere na outra mão nem no punho', () => {
    const applied = resolveHandPreset('fist', 'L')
    expect(Object.keys(applied).every((name) => name.endsWith('.L'))).toBe(true)
    expect(applied['wrist.L']).toBeUndefined()
  })
})
