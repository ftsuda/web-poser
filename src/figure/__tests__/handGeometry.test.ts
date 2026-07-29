import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import type { Figure } from '../../store/figuresStore'
import { buildJointFrames } from '../jointFrames'
import { getBoneStyle, getJoint, getJointParts } from '../skeleton'
import { resolveHandPreset, type HandPresetKey } from '../handPresets'
import type { Side } from '../poseMirror'

/**
 * Geometria da MÃO conferida por medição, no espaço local do punho (DECISOES.md
 * #45): é onde a mão é modelada alinhada aos eixos (#25), então "dentro da
 * largura da mão" e "do lado da palma" são leituras diretas de X e Z.
 */

const BASE_FIGURE: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [0, 0, 0],
  rotation: { x: 0, y: 0, z: 0 },
  pose: {},
}

function figureWithHand(key: HandPresetKey, side: Side): Figure {
  return { ...BASE_FIGURE, pose: resolveHandPreset(key, side) }
}

/**
 * Ponta da falange distal modelada além da última junta de um dedo: o ponto
 * mais baixo do perfil do lathe da junta, já com a rotação da peça aplicada
 * (o polegar tem a sua girada em Z). Lido do próprio `skeleton.ts` para a
 * medição não repetir números que podem mudar lá.
 */
function latheTipLocal(jointName: string): THREE.Vector3 {
  const part = getJointParts(jointName).find((candidate) => candidate.kind === 'lathe')
  if (!part || part.kind !== 'lathe') throw new Error(`Junta sem lathe de ponta: ${jointName}`)
  const lowest = Math.min(...part.profile.map((point) => point.y))
  const tip = new THREE.Vector3(0, lowest, 0)
  if (part.rotation) {
    tip.applyEuler(
      new THREE.Euler(
        THREE.MathUtils.degToRad(part.rotation[0]),
        THREE.MathUtils.degToRad(part.rotation[1]),
        THREE.MathUtils.degToRad(part.rotation[2]),
      ),
    )
  }
  if (part.offset) tip.add(new THREE.Vector3(...part.offset))
  return tip
}

/** Leva um ponto do espaço local de uma junta para o espaço local do punho do mesmo lado. */
function inWristSpace(figure: Figure, jointName: string, local = new THREE.Vector3()): THREE.Vector3 {
  const side = jointName.slice(-1)
  const { joints } = buildJointFrames(figure)
  const toWrist = new THREE.Matrix4().copy(joints.get(`wrist.${side}`)!.matrixWorld).invert()
  return local.clone().applyMatrix4(joints.get(jointName)!.matrixWorld).applyMatrix4(toWrist)
}

/** Ponta do polegar no espaço local do punho, para a pose de mão indicada. */
function thumbTip(key: HandPresetKey, side: Side): THREE.Vector3 {
  return inWristSpace(figureWithHand(key, side), `thumb2.${side}`, latheTipLocal(`thumb2.${side}`))
}

/** Meia-largura da mão na fileira dos nós: metade da largura final da lâmina da palma. */
const HAND_HALF_WIDTH_M = 0.04

describe('polegar: adução ampliada (DECISOES.md #45)', () => {
  it('fecha até 80°, espelhado entre os lados', () => {
    expect(getJoint('thumb1.L').limits.z).toEqual({ min: 0, max: 80 })
    expect(getJoint('thumb1.R').limits.z).toEqual({ min: -80, max: 0 })
  })

  /**
   * O que a faixa antiga (40°) impedia: com ela a ponta do polegar parava em
   * X = -6,4 cm no punho fechado — 2,4 cm FORA da borda da mão (meia-largura
   * 4,0 cm). O polegar fechava AO LADO do punho, não sobre ele.
   */
  it('no punho fechado a ponta do polegar cai dentro da largura da mão, do lado da palma', () => {
    for (const side of ['L', 'R'] as const) {
      const tip = thumbTip('fist', side)
      expect(Math.abs(tip.x)).toBeLessThan(HAND_HALF_WIDTH_M)
      expect(tip.z).toBeLessThan(0) // -Z é a palma
    }
  })

  it('mantém o polegar aberto onde ele estava nas poses que não fecham a mão', () => {
    // Mão aberta é a pose neutra: o polegar sai reto na direção -X (lado L).
    const open = thumbTip('open', 'L')
    expect(open.z).toBeCloseTo(0, 3)
    expect(open.x).toBeLessThan(-0.09)
  })
})

/** X de uma junta da mão no espaço local do punho, na pose neutra. */
function neutralX(jointName: string): number {
  return inWristSpace(BASE_FIGURE, jointName).x
}

/** Faixa em X que a lâmina do osso pai→junta ocupa, no espaço local do punho. */
function bladeSpanX(childJointName: string): [number, number] {
  const style = getBoneStyle(childJointName)
  if (style.kind !== 'blade') throw new Error(`Osso não é lâmina: ${childJointName}`)
  const center = neutralX(getJoint(childJointName).parent!) + (style.offsetX ?? 0)
  const half = Math.max(style.widthStart, style.widthEnd) / 2
  return [center - half, center + half]
}

describe('dedo indicador separado (DECISOES.md #45)', () => {
  it('é uma cadeia de 3 juntas pendurada no punho, espelhada, com as falanges e os limites do bloco', () => {
    for (const side of ['L', 'R'] as const) {
      const sign = side === 'L' ? -1 : 1
      expect(getJoint(`indexBase.${side}`).parent).toBe(`wrist.${side}`)
      expect(getJoint(`indexMid.${side}`).parent).toBe(`indexBase.${side}`)
      expect(getJoint(`indexTip.${side}`).parent).toBe(`indexMid.${side}`)

      // Quarto radial da fileira dos nós (do lado do polegar), na mesma altura
      // dela; as falanges são as do bloco, para o comprimento da mão continuar
      // sendo o do `skeleton.ts` sem inventar uma razão antropométrica nova.
      expect(getJoint(`indexBase.${side}`).position).toEqual([sign * 0.03, -0.085, 0])
      expect(getJoint(`indexMid.${side}`).position).toEqual(getJoint(`fingersMid.${side}`).position)
      expect(getJoint(`indexTip.${side}`).position).toEqual(getJoint(`fingersTip.${side}`).position)

      // Mesmo (único) grau de liberdade do bloco: flexão em X.
      for (const base of ['Base', 'Mid', 'Tip']) {
        expect(getJoint(`index${base}.${side}`).limits).toEqual(getJoint(`fingers${base}.${side}`).limits)
      }
    }
  })

  it('divide a fileira dos nós com o bloco sem invadi-lo nem passar da largura da mão', () => {
    for (const side of ['L', 'R'] as const) {
      const [indexMin, indexMax] = bladeSpanX(`indexMid.${side}`)
      const [blockMin, blockMax] = bladeSpanX(`fingersMid.${side}`)
      // O polegar sai em -X no lado L e +X no R, e o indicador o acompanha:
      // ele é a faixa mais negativa no L e a mais positiva no R.
      const [lower, upper] =
        side === 'L' ? [[indexMin, indexMax], [blockMin, blockMax]] : [[blockMin, blockMax], [indexMin, indexMax]]

      // Encostam sem se sobrepor, com uma fresta visível entre os dois.
      const gap = upper[0] - lower[1]
      expect(gap).toBeGreaterThan(0)
      expect(gap).toBeLessThan(0.003)

      // Tudo cabe na largura da palma na fileira dos nós (8,0 cm).
      expect(lower[0]).toBeGreaterThanOrEqual(-HAND_HALF_WIDTH_M)
      expect(upper[1]).toBeLessThanOrEqual(HAND_HALF_WIDTH_M)

      // O indicador fica com ~1/4 da fileira, o bloco com os outros 3/4.
      expect(indexMax - indexMin).toBeCloseTo((2 * HAND_HALF_WIDTH_M) / 4, 2)
      expect(blockMax - blockMin).toBeCloseTo((3 * (2 * HAND_HALF_WIDTH_M)) / 4, 2)
    }
  })

  /**
   * O gesto que o modelo não conseguia fazer: até o #44 as sete poses de
   * apontar usavam mão-faca porque os quatro dedos eram um bloco só.
   */
  it('"apontar" estende o indicador com os outros três fechados', () => {
    for (const side of ['L', 'R'] as const) {
      const pose = resolveHandPreset('point', side)
      expect(pose[`indexBase.${side}`]).toEqual({ x: 0, y: 0, z: 0 })
      expect(pose[`indexMid.${side}`]).toEqual({ x: 0, y: 0, z: 0 })
      expect(pose[`indexTip.${side}`]).toEqual({ x: 0, y: 0, z: 0 })
      expect(pose[`fingersBase.${side}`].x).toBeGreaterThan(80)
      expect(pose[`fingersMid.${side}`].x).toBeGreaterThan(80)
    }
  })

  /**
   * A pinça só passou a existir com a adução do polegar ampliada (passo 1):
   * com os 40° antigos a menor distância possível entre as pontas era 2,61 cm.
   */
  it('"pinça" encosta a ponta do polegar na ponta do indicador', () => {
    for (const side of ['L', 'R'] as const) {
      const figure = figureWithHand('pinch', side)
      const polegar = inWristSpace(figure, `thumb2.${side}`, latheTipLocal(`thumb2.${side}`))
      const indicador = inWristSpace(figure, `indexTip.${side}`, latheTipLocal(`indexTip.${side}`))
      expect(polegar.distanceTo(indicador)).toBeLessThan(0.005)
    }
  })

  it('as poses de mão que fecham a mão fecham o indicador junto com o bloco', () => {
    for (const key of ['relaxed', 'fist', 'thumbsUp'] as const) {
      const pose = resolveHandPreset(key, 'L')
      expect(pose['indexBase.L'].x).toBeGreaterThan(0)
      expect(pose['indexBase.L'].x).toBeCloseTo(pose['fingersBase.L'].x, 6)
      expect(pose['indexMid.L'].x).toBeCloseTo(pose['fingersMid.L'].x, 6)
      expect(pose['indexTip.L'].x).toBeCloseTo(pose['fingersTip.L'].x, 6)
    }
  })

  it('dobra para a palma no mesmo sentido do bloco, nos dois lados', () => {
    for (const side of ['L', 'R'] as const) {
      const curled: Figure = {
        ...BASE_FIGURE,
        pose: { [`indexBase.${side}`]: { x: 90, y: 0, z: 0 } },
      }
      // x positivo curva o dedo para a palma (-Z local do punho, ver #25).
      expect(inWristSpace(curled, `indexTip.${side}`).z).toBeLessThan(-0.03)
    }
  })
})
