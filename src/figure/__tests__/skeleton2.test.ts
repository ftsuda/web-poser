import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  JOINTS as JOINTS_ORIGINAL,
  clampJointRotation as clampOriginal,
} from '../skeleton'
import {
  BONE_STYLES,
  JOINT_PARTS,
  JOINTS,
  JOINT_NAMES,
  REFERENCE_HEIGHT_M,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getBoneStyle,
  getJoint,
  getJointChain,
  getJointParts,
  type SegmentPart,
} from '../skeleton2'
import { buildJointFrames } from '../jointFrames'
import type { Figure } from '../../store/figuresStore'

/** Altura (Y) da junta no mundo, na pose de descanso (soma dos offsets da cadeia). */
function restWorldY(name: string): number {
  return getJointChain(name).reduce((sum, joint) => sum + getJoint(joint).position[1], 0)
}

describe('compatibilidade com skeleton.ts', () => {
  it('re-exporta exatamente os mesmos dados de juntas (mesma referência, sem cópia)', () => {
    expect(JOINTS).toBe(JOINTS_ORIGINAL)
  })

  it('re-exporta as funções da cinemática com o mesmo comportamento', () => {
    expect(clampJointRotation).toBe(clampOriginal)
    expect(getJoint('elbow.L').name).toBe('elbow.L')
  })
})

describe('cobertura da geometria', () => {
  it('toda junta do esqueleto tem peças visuais, sem chaves sobrando', () => {
    expect(Object.keys(JOINT_PARTS).sort()).toEqual([...JOINT_NAMES].sort())
    for (const name of JOINT_NAMES) {
      expect(getJointParts(name).length).toBeGreaterThan(0)
    }
  })

  it('toda junta não-raiz tem estilo de osso, sem chaves sobrando', () => {
    const nonRoot = JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)
    expect(Object.keys(BONE_STYLES).sort()).toEqual([...nonRoot].sort())
  })

  it('getJointParts/getBoneStyle rejeitam nomes inválidos e o osso da raiz', () => {
    expect(() => getJointParts('nope')).toThrow()
    expect(() => getBoneStyle('nope')).toThrow()
    expect(() => getBoneStyle(ROOT_JOINT_NAME)).toThrow()
  })
})

function assertValidPart(part: SegmentPart) {
  if (part.kind === 'lathe') {
    expect(part.profile.length).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < part.profile.length; i += 1) {
      expect(part.profile[i].radius).toBeGreaterThan(0)
      if (i > 0) expect(part.profile[i].y).toBeGreaterThan(part.profile[i - 1].y)
    }
    if (part.depthRatio !== undefined) expect(part.depthRatio).toBeGreaterThan(0)
  } else if (part.kind === 'ellipsoid') {
    for (const radius of part.radii) expect(radius).toBeGreaterThan(0)
  } else {
    for (const side of part.size) expect(side).toBeGreaterThan(0)
  }
}

describe('validade dos dados de geometria', () => {
  it('peças: perfis lathe com Y estritamente crescente e dimensões positivas', () => {
    for (const parts of Object.values(JOINT_PARTS)) {
      for (const part of parts) assertValidPart(part)
    }
  })

  it('ossos torneados: t crescente dentro de [0,1] e raios positivos', () => {
    for (const style of Object.values(BONE_STYLES)) {
      if (style.kind !== 'turned') continue
      expect(style.points.length).toBeGreaterThanOrEqual(2)
      for (let i = 0; i < style.points.length; i += 1) {
        const point = style.points[i]
        expect(point.t).toBeGreaterThanOrEqual(0)
        expect(point.t).toBeLessThanOrEqual(1)
        expect(point.radius).toBeGreaterThan(0)
        if (i > 0) expect(point.t).toBeGreaterThan(style.points[i - 1].t)
      }
    }
  })

  it('ossos em lâmina (mão): larguras e espessura positivas', () => {
    for (const style of Object.values(BONE_STYLES)) {
      if (style.kind !== 'blade') continue
      expect(style.widthStart).toBeGreaterThan(0)
      expect(style.widthEnd).toBeGreaterThan(0)
      expect(style.thickness).toBeGreaterThan(0)
    }
  })
})

describe('simetria L/R', () => {
  const pairedBases = [
    ...new Set(
      JOINT_NAMES.filter((name) => name.endsWith('.L')).map((name) => name.slice(0, -2)),
    ),
  ]

  it('juntas pareadas têm as mesmas peças e o mesmo estilo de osso nos dois lados — exceto a ponta do polegar em thumb2.*, a única peça quiral da mão (ver abaixo)', () => {
    for (const base of pairedBases) {
      if (base === 'thumb2') continue
      expect(getJointParts(`${base}.R`)).toEqual(getJointParts(`${base}.L`))
      expect(getBoneStyle(`${base}.R`)).toEqual(getBoneStyle(`${base}.L`))
    }
    expect(getBoneStyle('thumb2.R')).toEqual(getBoneStyle('thumb2.L'))
  })

  it('nenhuma peça de junta pareada tem deslocamento lateral (X) — com a mão alinhada aos eixos (DECISOES.md #25), nem o pino do dorso precisa mais de espelho', () => {
    for (const base of pairedBases) {
      for (const part of getJointParts(`${base}.L`)) {
        expect(part.offset?.[0] ?? 0).toBe(0)
      }
    }
  })

  it('a ponta do polegar (thumb2.*) é espelhada só na ROTAÇÃO em Z (o polegar sai em -X no L e +X no R); as demais peças de thumb2 são idênticas', () => {
    const partsL = getJointParts('thumb2.L')
    const partsR = getJointParts('thumb2.R')
    expect(partsR).toHaveLength(partsL.length)
    for (let i = 0; i < partsL.length; i += 1) {
      const { rotation: rotL, ...restL } = partsL[i]
      const { rotation: rotR, ...restR } = partsR[i]
      expect(restR).toEqual(restL)
      expect(rotR?.[2] ?? 0).toBeCloseTo(-(rotL?.[2] ?? 0), 6)
    }
    // A peça da ponta de fato existe e é quiral (rotação Z não-nula).
    const tipL = partsL.find((part) => part.rotation)
    expect(tipL).toBeDefined()
    expect(Math.abs(tipL?.rotation?.[2] ?? 0)).toBeGreaterThan(0)
  })
})

describe('feições do rosto (mantidas do modelo original)', () => {
  const headParts = getJointParts('head')

  it('mantém exatamente dois olhos pretos', () => {
    expect(headParts.filter((part) => part.tint === 'eye')).toHaveLength(2)
  })

  it('mantém as duas orelhas espelhadas nas laterais da cabeça', () => {
    const ears = headParts.filter(
      (part) => part.tint !== 'eye' && Math.abs(part.offset?.[0] ?? 0) > 0.05,
    )
    expect(ears).toHaveLength(2)
    expect(ears[0].offset?.[0]).toBeCloseTo(-(ears[1].offset?.[0] ?? 0), 6)
  })

  it('mantém o nariz: peça central saliente à frente da superfície do ovo', () => {
    const centerPartsFront = headParts
      .filter((part) => part.kind === 'ellipsoid' && (part.offset?.[0] ?? 0) === 0)
      .map((part) => (part.offset?.[2] ?? 0) + (part.kind === 'ellipsoid' ? part.radii[2] : 0))
    expect(Math.max(...centerPartsFront)).toBeGreaterThan(0.09)
  })
})

describe('ancoragem no mundo (pose de descanso, altura de referência)', () => {
  it('o topo do ovo da cabeça fecha a altura de referência (1,70 m)', () => {
    const egg = getJointParts('head').find((part) => part.kind === 'lathe')
    expect(egg).toBeDefined()
    if (egg?.kind !== 'lathe') return
    const top = restWorldY('head') + egg.profile[egg.profile.length - 1].y
    expect(top).toBeCloseTo(REFERENCE_HEIGHT_M, 1)
    expect(Math.abs(top - REFERENCE_HEIGHT_M)).toBeLessThan(0.02)
  })

  it('a sola da cunha do pé fica no chão (y ≈ 0)', () => {
    const wedge = getJointParts('ankle.L').find((part) => part.kind === 'box')
    expect(wedge).toBeDefined()
    if (wedge?.kind !== 'box') return
    const soleY = restWorldY('ankle.L') + (wedge.offset?.[1] ?? 0) - wedge.size[1] / 2
    expect(Math.abs(soleY)).toBeLessThan(0.005)
  })

  it('a sola do bloco dos dedos também fica no chão', () => {
    const toeBlock = getJointParts('ball.L').find((part) => part.kind === 'box')
    expect(toeBlock).toBeDefined()
    if (toeBlock?.kind !== 'box') return
    const soleY = restWorldY('ball.L') + (toeBlock.offset?.[1] ?? 0) - toeBlock.size[1] / 2
    expect(Math.abs(soleY)).toBeLessThan(0.005)
  })
})

describe('pino do dorso da mão (wrist.*, tint marker)', () => {
  it('fica do lado OPOSTO da palma e sobressai da face dorsal da lâmina, na pose de descanso sem torção', () => {
    const figure: Figure = {
      id: 'f1',
      name: 'Boneco 1',
      color: '#e04040',
      visible: true,
      height: 1.7,
      position: [0, 0, 0],
      rotation: { x: 0, y: 0, z: 0 },
      pose: {},
    }
    const { joints } = buildJointFrames(figure)
    for (const side of ['L', 'R'] as const) {
      const wrist = new THREE.Vector3()
      joints.get(`wrist.${side}`)!.getWorldPosition(wrist)
      const fingersBase = new THREE.Vector3()
      joints.get(`fingersBase.${side}`)!.getWorldPosition(fingersBase)
      const thumb1 = new THREE.Vector3()
      joints.get(`thumb1.${side}`)!.getWorldPosition(thumb1)
      const dirFingers = fingersBase.clone().sub(wrist).normalize()
      const dirThumb = thumb1.clone().sub(wrist).normalize()
      // Quiral: mão direita é a imagem espelhada da esquerda, então a ORDEM
      // dos operandos que dá "para fora da palma" se inverte no lado R (um
      // produto vetorial não respeita reflexão como um vetor de posição
      // comum) — ver DECISOES.md #23.
      const palmNormal =
        side === 'L'
          ? new THREE.Vector3().crossVectors(dirFingers, dirThumb).normalize()
          : new THREE.Vector3().crossVectors(dirThumb, dirFingers).normalize()

      // Com a mão alinhada aos eixos (DECISOES.md #25), a palma aponta
      // EXATAMENTE para -Z local em repouso, nos dois lados.
      expect(palmNormal.x).toBeCloseTo(0, 5)
      expect(palmNormal.y).toBeCloseTo(0, 5)
      expect(palmNormal.z).toBeCloseTo(-1, 5)

      const marker = getJointParts(`wrist.${side}`).find((part) => part.tint === 'marker')
      expect(marker?.offset).toBeDefined()
      if (!marker?.offset || marker.kind !== 'ellipsoid') continue
      // Dorso = +Z local: o pino fica do lado oposto da palma...
      expect(marker.offset[2]).toBeGreaterThan(0)
      // ...e o topo dele ultrapassa a face dorsal da lâmina da palma
      // (meia-espessura do osso `blade` wrist→fingersBase), para ser visível.
      const palmStyle = getBoneStyle(`fingersBase.${side}`)
      expect(palmStyle.kind).toBe('blade')
      if (palmStyle.kind !== 'blade') continue
      expect(marker.offset[2] + marker.radii[2]).toBeGreaterThan(palmStyle.thickness / 2)
    }
  })
})
