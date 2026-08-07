import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildJointFrames } from '../jointFrames'
import { resolvePosePreset } from '../posePresets'
import { getJoint } from '../skeleton'
import type { Figure } from '../../store/figuresStore'
import { solveLookAt } from '../lookAt'

/**
 * "Olhar para" (PLANO.md item 32): mirar cabeça e pescoço num ponto do mundo.
 * É o gesto mais repetido ao montar cena com dois bonecos, e até aqui só
 * existia como dois pares de sliders.
 *
 * O teste é de ida-e-volta, como o resto da inferência de pose: aplica a pose
 * devolvida, refaz a FK e confere para onde o rosto ficou apontando.
 */
function makeFigure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'figure-1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: 1.7,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: resolvePosePreset('standing'),
    ...overrides,
  }
}

/** Direção do olhar depois de aplicar a pose: +Z local da cabeça, em mundo. */
function gazeAfter(figure: Figure, pose: Record<string, { x: number; y: number; z: number }>) {
  const posed = { ...figure, pose: { ...figure.pose, ...pose } }
  const { joints } = buildJointFrames(posed)
  const head = joints.get('head')!
  return {
    direction: new THREE.Vector3(0, 0, 1).transformDirection(head.matrixWorld).normalize(),
    position: head.getWorldPosition(new THREE.Vector3()),
  }
}

function angleToTargetDeg(figure: Figure, pose: Record<string, { x: number; y: number; z: number }>, target: readonly [number, number, number]) {
  const { direction, position } = gazeAfter(figure, pose)
  const wanted = new THREE.Vector3(...target).sub(position).normalize()
  return THREE.MathUtils.radToDeg(direction.angleTo(wanted))
}

describe('solveLookAt', () => {
  it('mira num ponto à frente e acima: o rosto acaba apontando para ele', () => {
    const figure = makeFigure()
    const target: [number, number, number] = [0, 1.9, 3]
    const pose = solveLookAt(figure, target)!

    expect(angleToTargetDeg(figure, pose, target)).toBeLessThan(3)
  })

  it('mira de lado repartindo entre pescoço e cabeça — nenhum dos dois vai sozinho ao limite', () => {
    const figure = makeFigure()
    const target: [number, number, number] = [3, 1.5, 1]
    const pose = solveLookAt(figure, target)!

    expect(angleToTargetDeg(figure, pose, target)).toBeLessThan(3)

    // O alvo pede uns 72° de guinada — mais do que a cabeça sozinha alcança
    // (±30). A repartição pelas AMPLITUDES deixa as duas dentro da faixa; meio
    // a meio saturaria a cabeça e o olhar erraria por vários graus.
    expect(Math.abs(pose.neck.y)).toBeGreaterThan(Math.abs(pose.head.y))
    expect(Math.abs(pose.head.y)).toBeLessThan(30)
  })

  it('alvo atrás das costas satura nos LIMITES em vez de torcer o pescoço', () => {
    const figure = makeFigure()
    const pose = solveLookAt(figure, [0, 1.5, -5])!

    const limiteNeck = getJoint('neck').limits.y!
    const limiteHead = getJoint('head').limits.y!
    expect(pose.neck.y).toBeLessThanOrEqual(limiteNeck.max)
    expect(pose.neck.y).toBeGreaterThanOrEqual(limiteNeck.min)
    expect(pose.head.y).toBeLessThanOrEqual(limiteHead.max)
    expect(pose.head.y).toBeGreaterThanOrEqual(limiteHead.min)

    // Não chega lá — e é honesto: o boneco vira o quanto o pescoço permite.
    expect(angleToTargetDeg(figure, pose, [0, 1.5, -5])).toBeGreaterThan(30)
  })

  it('respeita a rotação da raiz: boneco de costas mira pelo mundo, não pelo seu eixo', () => {
    // O boneco girado 180° tem a cabeça olhando para −Z; o alvo em +Z está
    // atrás dele. Se o solver ignorasse a raiz, acharia que está de frente.
    const virado = makeFigure({ rotation: { x: 0, y: 180, z: 0 } })
    const pose = solveLookAt(virado, [0, 1.5, 4])!

    expect(angleToTargetDeg(virado, pose, [0, 1.5, 4])).toBeGreaterThan(30)
  })

  it('junta travada não se mexe — nem pelo "olhar para" (#42)', () => {
    const figure = makeFigure()
    const target: [number, number, number] = [3, 1.5, 1]

    const semTrava = solveLookAt(figure, target)!
    const comTrava = solveLookAt(figure, target, ['neck'])!

    expect(comTrava.neck).toBeUndefined()
    expect(comTrava.head).toBeDefined()
    // Só a cabeça responde, e ela sozinha não alcança: o olhar fica mais longe
    // do alvo do que com o pescoço livre — e é assim que tem de ser.
    expect(angleToTargetDeg(figure, comTrava, target)).toBeGreaterThan(
      angleToTargetDeg(figure, semTrava, target) + 10,
    )

    // As duas travadas: não há o que resolver.
    expect(solveLookAt(figure, target, ['neck', 'head'])).toBeNull()
  })

  it('alvo em cima da própria cabeça não tem direção: devolve null', () => {
    const figure = makeFigure()
    const { joints } = buildJointFrames(figure)
    const head = joints.get('head')!.getWorldPosition(new THREE.Vector3())

    expect(solveLookAt(figure, [head.x, head.y, head.z])).toBeNull()
  })
})
