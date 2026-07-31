import { describe, expect, it } from 'vitest'
import {
  BONE_STYLES,
  BONE_STYLES_STICK,
  DEFAULT_FIGURE_STYLE,
  FIGURE_STYLES,
  JOINT_PARTS,
  JOINT_PARTS_STICK,
  JOINT_NAMES,
  REFERENCE_HEIGHT_M,
  ROOT_JOINT_NAME,
  STICK_BONE_RADII,
  STICK_JOINT_RADII,
  getBoneStyle,
  getJoint,
  getJointChain,
  getJointParts,
} from '../skeleton'

/** Altura (Y) da junta no mundo, na pose de descanso — igual ao helper de `skeletonParts.test.ts`. */
function restWorldY(name: string): number {
  return getJointChain(name).reduce((sum, joint) => sum + getJoint(joint).position[1], 0)
}

const NON_ROOT = JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)

/** Juntas que NÃO são dimensionadas para o dedo (ver o bloco da variante em `skeleton.ts`). */
const HAND_JOINTS = JOINT_NAMES.filter((name) =>
  /^(thumb|index|fingers)/.test(name),
)

/** Juntas de tronco alto propositalmente pequenas por estarem a 4 cm das vizinhas. */
const CROWDED_JOINTS = ['upperChest', 'neck', 'clavicle.L', 'clavicle.R']

describe('variante palito: cobertura', () => {
  it('toda junta tem peças, sem chaves sobrando', () => {
    expect(Object.keys(JOINT_PARTS_STICK).sort()).toEqual([...JOINT_NAMES].sort())
    for (const name of JOINT_NAMES) {
      expect(getJointParts(name, 'stick').length).toBeGreaterThan(0)
    }
  })

  it('toda junta não-raiz tem osso, sem chaves sobrando', () => {
    expect(Object.keys(BONE_STYLES_STICK).sort()).toEqual([...NON_ROOT].sort())
  })

  it('toda junta tem medida EXPLÍCITA nas tabelas — nada cai no valor de emergência', () => {
    // O `FALLBACK_STICK_RADIUS` do `skeleton.ts` existe só para uma junta nova
    // não derrubar a aplicação em runtime; quem cobra a medida de verdade é este
    // teste. Falha aqui = entrou junta no esqueleto sem medida de palito.
    const bases = [...new Set(JOINT_NAMES.map((name) => name.replace(/\.(L|R)$/, '')))]

    expect(Object.keys(STICK_JOINT_RADII).sort()).toEqual([...bases].sort())
    expect(Object.keys(STICK_BONE_RADII).sort()).toEqual(
      bases.filter((base) => base !== ROOT_JOINT_NAME).sort(),
    )
    for (const radius of Object.values(STICK_JOINT_RADII)) expect(radius).toBeGreaterThan(0)
    for (const radius of Object.values(STICK_BONE_RADII)) expect(radius).toBeGreaterThan(0)
  })
})

describe('variante palito: alvos de toque', () => {
  it('as juntas do corpo são esferas bem maiores que as do manequim', () => {
    const body = JOINT_NAMES.filter(
      (name) => !HAND_JOINTS.includes(name) && !CROWDED_JOINTS.includes(name) && name !== 'head',
    )

    for (const name of body) {
      const part = getJointParts(name, 'stick')[0]
      expect(part.kind).toBe('ellipsoid')
      if (part.kind !== 'ellipsoid') continue
      // 3 cm de raio = 6 cm de diâmetro na altura de referência: o suficiente
      // para o dedo em qualquer enquadramento que mostre o boneco inteiro.
      expect(Math.min(...part.radii)).toBeGreaterThanOrEqual(0.03)
    }
  })

  it('nenhuma junta fora da mão é um alvo minúsculo', () => {
    // Inclui o tronco alto: mesmo as juntas propositalmente pequenas continuam
    // acima do piso, porque elas TAMBÉM precisam ser tocáveis — só não podem
    // engolir a vizinha (ver o teste de vizinhança abaixo).
    for (const name of JOINT_NAMES.filter((joint) => !HAND_JOINTS.includes(joint))) {
      const part = getJointParts(name, 'stick')[0]
      expect(part.kind).toBe('ellipsoid')
      if (part.kind !== 'ellipsoid') continue
      expect(Math.min(...part.radii)).toBeGreaterThanOrEqual(0.028)
    }
  })

  it('as juntas que eram pequenas no manequim cresceram de verdade', () => {
    // O ombro não entra: a bola dele já era a maior do manequim (0,052) e
    // continua um alvo confortável — o ganho do palito está nas OUTRAS, que no
    // manequim iam de 0,022 (clavícula) a 0,043 (joelho), e nos blocos
    // entalhados que não tinham bola nenhuma para mirar.
    const minRadius = (name: string, style: 'wooden' | 'stick') => {
      const part = getJointParts(name, style)[0]
      return part.kind === 'ellipsoid' ? Math.min(...part.radii) : Number.POSITIVE_INFINITY
    }

    for (const name of ['clavicle.L', 'elbow.L', 'wrist.L', 'knee.L', 'ankle.L']) {
      expect(minRadius(name, 'stick')).toBeGreaterThan(minRadius(name, 'wooden'))
    }
  })

  it('os ossos são FINOS em relação às juntas — é a inversão que faz o alvo se destacar', () => {
    for (const name of NON_ROOT) {
      const bone = getBoneStyle(name, 'stick')
      expect(bone.kind).toBe('turned')
      if (bone.kind !== 'turned') continue
      const boneRadius = Math.max(...bone.points.map((point) => point.radius))
      const jointPart = getJointParts(name, 'stick')[0]
      if (jointPart.kind !== 'ellipsoid') continue
      expect(boneRadius).toBeLessThan(Math.min(...jointPart.radii))
    }
  })

  it('nenhuma esfera contém o CENTRO de uma junta vizinha', () => {
    // O invariante que mantém toda junta tocável mesmo nos trechos apertados do
    // esqueleto (chest→upperChest→neck a 4 cm um do outro, punho→polegar a 4,6
    // cm): se a esfera de uma junta engolisse o centro da vizinha, a vizinha
    // viraria uma calota protuberante — ainda visível, mas um alvo ruim para o
    // dedo, que é exatamente o que esta casca existe para resolver.
    //
    // Sobreposição PARCIAL é bem-vinda: é o que emenda as peças num corpo só.
    const radiusOf = (name: string) => {
      const part = getJointParts(name, 'stick')[0]
      return part.kind === 'ellipsoid' ? Math.max(...part.radii) : 0
    }

    for (const name of NON_ROOT) {
      const offset = getJoint(name).position
      const distance = Math.hypot(offset[0], offset[1], offset[2])
      const parent = getJoint(name).parent as string

      expect(radiusOf(parent), `${parent} engole o centro de ${name}`).toBeLessThan(distance)
      expect(radiusOf(name), `${name} engole o centro de ${parent}`).toBeLessThan(distance)
    }
  })

  it('a mão fica pequena de propósito — os dedos estão fora do arrasto', () => {
    for (const name of HAND_JOINTS) {
      const part = getJointParts(name, 'stick')[0]
      if (part.kind !== 'ellipsoid') continue
      expect(Math.max(...part.radii)).toBeLessThan(0.02)
    }
  })
})

describe('variante palito: geometria', () => {
  it('nenhum osso é escondido — sem os blocos do manequim, esconder deixaria vãos', () => {
    for (const name of NON_ROOT) {
      expect(getBoneStyle(name, 'stick').kind).toBe('turned')
    }
    // O manequim, ao contrário, tem trechos cobertos por blocos.
    expect(getBoneStyle('hip.L').kind).toBe('hidden')
  })

  it('os cilindros têm raio constante e dimensões positivas', () => {
    for (const style of Object.values(BONE_STYLES_STICK)) {
      expect(style.kind).toBe('turned')
      if (style.kind !== 'turned') continue
      expect(style.points).toHaveLength(2)
      expect(style.points[0].t).toBe(0)
      expect(style.points[1].t).toBe(1)
      expect(style.points[0].radius).toBe(style.points[1].radius)
      expect(style.points[0].radius).toBeGreaterThan(0)
    }
  })

  it('juntas pareadas usam exatamente as mesmas peças e o mesmo osso nos dois lados', () => {
    const bases = [
      ...new Set(JOINT_NAMES.filter((name) => name.endsWith('.L')).map((name) => name.slice(0, -2))),
    ]
    for (const base of bases) {
      expect(getJointParts(`${base}.R`, 'stick')).toEqual(getJointParts(`${base}.L`, 'stick'))
      expect(getBoneStyle(`${base}.R`, 'stick')).toEqual(getBoneStyle(`${base}.L`, 'stick'))
    }
  })

  it('a cabeça fecha a altura de referência, como o ovo do manequim', () => {
    const sphere = getJointParts('head', 'stick')[0]
    expect(sphere.kind).toBe('ellipsoid')
    if (sphere.kind !== 'ellipsoid') return
    const top = restWorldY('head') + (sphere.offset?.[1] ?? 0) + sphere.radii[1]
    expect(Math.abs(top - REFERENCE_HEIGHT_M)).toBeLessThan(0.02)
  })

  it('a base da cabeça encosta na junta, para o cilindro do pescoço não deixar vão', () => {
    const sphere = getJointParts('head', 'stick')[0]
    if (sphere.kind !== 'ellipsoid') return
    const bottom = (sphere.offset?.[1] ?? 0) - sphere.radii[1]
    expect(Math.abs(bottom)).toBeLessThan(0.001)
  })

  it('a cabeça tem um marcador escuro à frente, que diz para onde o boneco olha', () => {
    const parts = getJointParts('head', 'stick')
    const marker = parts.find((part) => part.tint === 'eye')
    expect(marker).toBeDefined()
    if (!marker || marker.kind !== 'ellipsoid') return
    // À frente (+Z) e ultrapassando a superfície da esfera, senão fica enterrado.
    expect(marker.offset?.[2] ?? 0).toBeGreaterThan(0)
    const sphere = parts[0]
    if (sphere.kind !== 'ellipsoid') return
    expect((marker.offset?.[2] ?? 0) + marker.radii[2]).toBeGreaterThan(sphere.radii[2])
  })
})

describe('a casca não toca na cinemática nem no manequim', () => {
  it('o default de `getJointParts`/`getBoneStyle` continua sendo o manequim de madeira', () => {
    expect(DEFAULT_FIGURE_STYLE).toBe('wooden')
    expect(getJointParts('chest')).toBe(JOINT_PARTS.chest)
    expect(getBoneStyle('elbow.L')).toBe(BONE_STYLES['elbow.L'])
    expect(getJointParts('chest', 'wooden')).toBe(JOINT_PARTS.chest)
  })

  it('as duas cascas descrevem o MESMO esqueleto — mesmas juntas, mesmos nomes', () => {
    expect(Object.keys(JOINT_PARTS_STICK).sort()).toEqual(Object.keys(JOINT_PARTS).sort())
    expect(Object.keys(BONE_STYLES_STICK).sort()).toEqual(Object.keys(BONE_STYLES).sort())
    expect(FIGURE_STYLES).toEqual(['wooden', 'stick'])
  })

  it('valida o nome da junta e o osso da raiz igual à casca de madeira', () => {
    expect(() => getJointParts('nope', 'stick')).toThrow()
    expect(() => getBoneStyle('nope', 'stick')).toThrow()
    expect(() => getBoneStyle(ROOT_JOINT_NAME, 'stick')).toThrow()
  })
})
