import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildJointFrames } from '../../figure/jointFrames'
import { resolvePosePreset, NEUTRAL_ELBOW_TWIST } from '../../figure/posePresets'
import type { Figure } from '../../store/figuresStore'
import {
  POSE_MARK_SEQUENCE,
  inferPoseFromMarks,
  inferRootRotationFromMarks,
  poseMarkDepthKind,
  poseMarkSupportsDepth,
  type MarkedView,
  type PoseMark,
  type PoseMarkKey,
} from '../markedPose'

/**
 * A inferência por MARCAÇÃO MANUAL (PLANO.md > "Pose por marcação manual"):
 * toques na foto → pose, com o ROOT dado pelo usuário (alinhado à foto antes,
 * nunca inferido). Mesma estratégia de teste do retarget: uma pose conhecida
 * vira marcas sintéticas (posições de mundo projetadas no plano da vista) e a
 * inferência tem de recuperar os ângulos — nos DOFs que o plano da foto conta.
 */

const FRONT: MarkedView = { right: [1, 0, 0], up: [0, 1, 0] }
/** Vista lateral: câmera em +X olhando −X (o lado esquerdo da pessoa de frente para a câmera). */
const SIDE: MarkedView = { right: [0, 0, -1], up: [0, 1, 0] }

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

/** Ponto de referência de cada marca na FK do app (junta, ou offset local da cabeça). */
const MARK_SOURCES: Record<PoseMarkKey, { joint: string; local?: [number, number, number] }> = {
  head: { joint: 'head', local: [0, 0.03, 0] },
  nose: { joint: 'head', local: [0, 0.05, 0.12] },
  neck: { joint: 'neck' },
  chest: { joint: 'chest' },
  'shoulder.L': { joint: 'shoulder.L' },
  'shoulder.R': { joint: 'shoulder.R' },
  'elbow.L': { joint: 'elbow.L' },
  'elbow.R': { joint: 'elbow.R' },
  'wrist.L': { joint: 'wrist.L' },
  'wrist.R': { joint: 'wrist.R' },
  'hip.L': { joint: 'hip.L' },
  'hip.R': { joint: 'hip.R' },
  'knee.L': { joint: 'knee.L' },
  'knee.R': { joint: 'knee.R' },
  'ankle.L': { joint: 'ankle.L' },
  'ankle.R': { joint: 'ankle.R' },
  'foot.L': { joint: 'ball.L' },
  'foot.R': { joint: 'ball.R' },
}

/**
 * Marcas sintéticas: projeção das juntas no plano da vista, em coordenadas
 * normalizadas de foto (y para baixo, quadrada — aspect 1). A profundidade é
 * DESCARTADA na projeção, como numa foto de verdade.
 */
function marksFromFigure(
  figure: Figure,
  view: MarkedView,
  options: { skip?: PoseMarkKey[]; depth?: Partial<Record<PoseMarkKey, 'front' | 'back'>> } = {},
): Partial<Record<PoseMarkKey, PoseMark>> {
  const { joints } = buildJointFrames(figure)
  const right = new THREE.Vector3(...view.right)
  const up = new THREE.Vector3(...view.up)

  const marks: Partial<Record<PoseMarkKey, PoseMark>> = {}
  for (const { key } of POSE_MARK_SEQUENCE) {
    if (options.skip?.includes(key)) continue
    const source = MARK_SOURCES[key]
    const world = new THREE.Vector3(...(source.local ?? [0, 0, 0])).applyMatrix4(
      joints.get(source.joint)!.matrixWorld,
    )
    marks[key] = {
      x: 0.5 + world.dot(right) * 0.3,
      y: 0.5 - world.dot(up) * 0.3,
      ...(options.depth?.[key] ? { depth: options.depth[key] } : {}),
    }
  }
  return marks
}

function infer(figure: Figure, view: MarkedView, options?: Parameters<typeof marksFromFigure>[2]) {
  const result = inferPoseFromMarks(figure, marksFromFigure(figure, view, options), view, 1)
  expect(result).not.toBeNull()
  return result!
}

describe('inferPoseFromMarks — ida-e-volta pela cinemática do app', () => {
  it('vista frontal, T-pose: recupera os ombros a ±90° em Z', () => {
    const figure = makeFigure({ pose: resolvePosePreset('tpose') })
    const { pose } = infer(figure, FRONT)

    expect(pose['shoulder.L'].z).toBeCloseTo(90, 0)
    expect(pose['shoulder.R'].z).toBeCloseTo(-90, 0)
    expect(Math.abs(pose['elbow.L'].x)).toBeLessThan(3)
  })

  it('vista lateral: recupera flexões sagitais — braço, quadril e joelho', () => {
    const figure = makeFigure({
      pose: {
        ...resolvePosePreset('standing'),
        'shoulder.L': { x: -60, y: 0, z: 0 },
        'elbow.L': { x: -60, y: NEUTRAL_ELBOW_TWIST['elbow.L']!, z: 0 },
        'hip.L': { x: -70, y: 0, z: 0 },
        'knee.L': { x: 90, y: 0, z: 0 },
      },
    })
    const { pose } = infer(figure, SIDE)

    expect(pose['elbow.L'].x).toBeCloseTo(-60, 0)
    expect(pose['hip.L'].x).toBeCloseTo(-70, 0)
    expect(pose['knee.L'].x).toBeCloseTo(90, 0)
  })

  it('o ROOT dado é respeitado: boneco de costas marcado de frente recupera a pose', () => {
    // De costas para a câmera, o que a foto conta é o plano frontal DA PESSOA:
    // abdução dos braços (Z), não flexão sagital (que fica perpendicular à foto).
    const figure = makeFigure({
      rotation: { x: 0, y: 180, z: 0 },
      pose: {
        ...resolvePosePreset('standing'),
        'shoulder.L': { x: 0, y: 0, z: 60 },
        'shoulder.R': { x: 0, y: 0, z: -60 },
      },
    })
    const { pose } = infer(figure, FRONT, { skip: ['nose'] })

    // A inferência devolve SÓ pose — root (posição/rotação) é intocado por contrato.
    expect(pose['shoulder.L'].z).toBeCloseTo(60, 0)
    expect(pose['shoulder.R'].z).toBeCloseTo(-60, 0)
    expect(Math.abs(pose['hip.L'].x)).toBeLessThan(3)
  })

  it('profundidade opt-in: marcar o cotovelo "à frente" recupera o braço saindo do plano', () => {
    const bent = makeFigure({
      pose: { ...resolvePosePreset('standing'), 'shoulder.L': { x: -50, y: 0, z: 0 } },
    })

    // Sem profundidade, a vista frontal ACHATA o braço (encurtado na foto).
    const flat = infer(bent, FRONT).pose
    expect(Math.abs(flat['shoulder.L'].x)).toBeLessThan(20)

    // Com o cotovelo marcado "à frente", o encurtamento vira profundidade.
    const lifted = infer(bent, FRONT, { depth: { 'elbow.L': 'front' } }).pose
    expect(lifted['shoulder.L'].x).toBeCloseTo(-50, 0)

    // "Atrás" dá o mesmo ângulo com o sinal oposto (braço para trás).
    const behind = infer(bent, FRONT, { depth: { 'elbow.L': 'back' } }).pose
    expect(behind['shoulder.L'].x).toBeCloseTo(50, 0)
  })

  it('profundidade em osso NÃO encurtado é impossível: fica no plano, com aviso', () => {
    const figure = makeFigure({ pose: resolvePosePreset('tpose') })
    const { pose, warnings } = infer(figure, FRONT, { depth: { 'elbow.L': 'front' } })

    expect(pose['shoulder.L'].z).toBeCloseTo(90, 0)
    expect(warnings).toContain('poses.photo.warnDepthImpossible')
  })

  it('pés pulados deixam os tornozelos neutros; os avisos são chaves de i18n', () => {
    const { pose, warnings } = infer(makeFigure(), FRONT, { skip: ['foot.L', 'foot.R', 'nose'] })

    expect(pose['ankle.L']).toEqual({ x: 0, y: 0, z: 0 })
    expect(warnings).toContain('poses.photo.warnFlat')
    expect(warnings).toContain('poses.photo.warnNeutral')
  })

  it('sem ombros ou quadris marcados, devolve null', () => {
    const figure = makeFigure()
    expect(inferPoseFromMarks(figure, {}, FRONT, 1)).toBeNull()

    const marks = marksFromFigure(figure, FRONT)
    delete marks['hip.L']
    expect(inferPoseFromMarks(figure, marks, FRONT, 1)).toBeNull()
  })

  it('a sequência de marcação agrupa por membro (direito antes do esquerdo), sem alternar lados', () => {
    // A ordem é decisão do usuário (#113): cabeça (com o nariz opcional junto),
    // base do pescoço (#113.1, âncora do prumo do tronco), base do tórax
    // (#119, a quebra do tronco), braço direito inteiro, braço esquerdo
    // inteiro, perna direita inteira (com a ponta do pé logo após o
    // tornozelo), perna esquerda inteira. O EIXO do tronco inteiro primeiro,
    // de cima para baixo; depois os membros.
    expect(POSE_MARK_SEQUENCE.map((step) => step.key)).toEqual([
      'head',
      'nose',
      'neck',
      'chest',
      'shoulder.R',
      'elbow.R',
      'wrist.R',
      'shoulder.L',
      'elbow.L',
      'wrist.L',
      'hip.R',
      'knee.R',
      'ankle.R',
      'foot.R',
      'hip.L',
      'knee.L',
      'ankle.L',
      'foot.L',
    ])
    expect(POSE_MARK_SEQUENCE.filter((step) => !step.optional)).toHaveLength(14)
    expect(
      POSE_MARK_SEQUENCE.filter((step) => step.optional).map((step) => step.key),
    ).toEqual(['nose', 'chest', 'foot.R', 'foot.L'])
  })

  it('a base do pescoço ancora o prumo do tronco: ombro marcado alto não rola a coluna', () => {
    // O caso real que motivou a marca (#113.1): na foto, o ombro se marca no
    // trapézio/deltoide — mais ALTO que a junta. Sem o pescoço, a linha dos
    // ombros é o eixo primário do tronco e o desnível ROLA a coluna inteira;
    // com ele, o prumo quadris→pescoço é o primário e a linha dos ombros só
    // dá a torção em torno dele.
    const figure = makeFigure()
    const shrug = marksFromFigure(figure, FRONT)
    shrug['shoulder.L'] = { x: shrug['shoulder.L']!.x, y: shrug['shoulder.L']!.y - 0.05 }

    const withNeck = inferPoseFromMarks(figure, shrug, FRONT, 1)!
    expect(Math.abs((withNeck.pose.spine?.z ?? 0) + (withNeck.pose.chest?.z ?? 0))).toBeLessThan(0.5)

    const noNeck = { ...shrug }
    delete noNeck.neck
    const withoutNeck = inferPoseFromMarks(figure, noNeck, FRONT, 1)!
    expect(Math.abs((withoutNeck.pose.spine?.z ?? 0) + (withoutNeck.pose.chest?.z ?? 0))).toBeGreaterThan(3)
  })

  it('profundidade também nos PARES: ombros e quadris; cabeça e pescoço não têm par nem osso', () => {
    // A ponta de um osso mede o encurtamento contra o pai; o par mede contra o
    // OUTRO LADO, cuja distância é rígida no esqueleto (#115).
    expect(poseMarkDepthKind('elbow.L')).toBe('bone')
    expect(poseMarkDepthKind('shoulder.R')).toBe('pair')
    expect(poseMarkDepthKind('hip.L')).toBe('pair')
    expect(poseMarkDepthKind('neck')).toBe('none')
    expect(poseMarkSupportsDepth('shoulder.L')).toBe(true)
    expect(poseMarkSupportsDepth('head')).toBe(false)

    // A base do tórax também não: é um ponto SOBRE o eixo do tronco, e o
    // encurtamento do trecho que a sustenta (0,24 m) some no ruído de toque —
    // ela diz a quebra do tronco no plano, nunca a profundidade dela (#119).
    expect(poseMarkDepthKind('chest')).toBe('none')
  })

  it('torção do tronco: o ombro marcado "à frente" tira a linha dos ombros do plano', () => {
    const twisted = makeFigure({
      pose: {
        ...resolvePosePreset('standing'),
        spine: { x: 0, y: 20, z: 0 },
        chest: { x: 0, y: 20, z: 0 },
      },
    })

    // De frente, a foto ACHATA a torção: a linha dos ombros só encurta.
    const flat = infer(twisted, FRONT).pose
    expect(Math.abs(flat.spine.y + flat.chest.y)).toBeLessThan(5)

    // Girando +Y, o ombro DIREITO é o que vem para a câmera — marcá-lo "à
    // frente" devolve os 40° de torção (20 na coluna + 20 no peito).
    const solved = infer(twisted, FRONT, { depth: { 'shoulder.R': 'front' } }).pose
    expect(solved.spine.y + solved.chest.y).toBeGreaterThan(35)
    expect(solved.spine.y + solved.chest.y).toBeLessThan(45)

    // Simétrica (decisão do usuário): o CENTRO dos ombros fica onde estava —
    // torção pura, sem inclinar nem rolar o tronco.
    expect(Math.abs(solved.spine.z + solved.chest.z)).toBeLessThan(2)
    expect(Math.abs(solved.spine.x + solved.chest.x)).toBeLessThan(2)

    // "Atrás" no mesmo ombro é a torção para o outro lado.
    const mirrored = infer(twisted, FRONT, { depth: { 'shoulder.R': 'back' } }).pose
    expect(mirrored.spine.y + mirrored.chest.y).toBeLessThan(-35)
  })

  it('marcar o outro lado do par "atrás" diz a MESMA torção que marcar este "à frente"', () => {
    const twisted = makeFigure({
      pose: { ...resolvePosePreset('standing'), spine: { x: 0, y: 20, z: 0 }, chest: { x: 0, y: 20, z: 0 } },
    })
    const byRight = infer(twisted, FRONT, { depth: { 'shoulder.R': 'front' } }).pose
    const byLeft = infer(twisted, FRONT, { depth: { 'shoulder.L': 'back' } }).pose
    const both = infer(twisted, FRONT, { depth: { 'shoulder.R': 'front', 'shoulder.L': 'back' } }).pose

    expect(byLeft.spine.y).toBeCloseTo(byRight.spine.y, 6)
    expect(both.spine.y).toBeCloseTo(byRight.spine.y, 6)
  })

  it('os dois lados do par com a MESMA profundidade não dizem torção: aviso, e o par fica no plano', () => {
    const twisted = makeFigure({
      pose: { ...resolvePosePreset('standing'), spine: { x: 0, y: 20, z: 0 }, chest: { x: 0, y: 20, z: 0 } },
    })
    const { pose, warnings } = infer(twisted, FRONT, {
      depth: { 'shoulder.R': 'front', 'shoulder.L': 'front' },
    })

    expect(warnings).toContain('poses.photo.warnDepthPairSame')
    expect(Math.abs(pose.spine.y + pose.chest.y)).toBeLessThan(5)
  })

  it('par NÃO encurtado na foto (de frente, sem torção) é impossível: fica no plano, com aviso', () => {
    const figure = makeFigure()
    const { pose, warnings } = infer(figure, FRONT, { depth: { 'shoulder.R': 'front' } })

    expect(Math.abs(pose.spine.y + pose.chest.y)).toBeLessThan(1)
    expect(warnings).toContain('poses.photo.warnDepthImpossible')
  })

  it('quadris com profundidade mexem nas pernas e deixam o tronco onde estava', () => {
    // Pelve girada: a linha dos quadris aparece ENCURTADA na foto, e o quadril
    // direito é o que vem para a câmera.
    const figure = makeFigure({ rotation: { x: 0, y: 30, z: 0 } })
    const flat = infer(figure, FRONT).pose
    const paired = infer(figure, FRONT, { depth: { 'hip.R': 'front' } })

    // O tronco não sente nada: o centro do par fica onde estava (simétrica) e a
    // torção do tronco continua saindo da linha dos OMBROS (#115).
    expect(paired.pose.spine.y).toBeCloseTo(flat.spine.y, 6)
    expect(paired.pose.chest.z).toBeCloseTo(flat.chest.z, 6)

    // A coxa, essa, sai do plano: o quadril à frente com o joelho marcado no
    // plano inclina o osso — a perna deixa de ser um risco achatado.
    expect(paired.pose['hip.R'].x).toBeGreaterThan(3)
    expect(Math.abs(flat['hip.R'].x)).toBeLessThan(1)
    expect(paired.warnings).not.toContain('poses.photo.warnFlat')
  })

  it('a base do tórax quebra o tronco em dois: a curva deixa de sair reta (#119)', () => {
    // Coluna para um lado, peito voltando para o outro — a silhueta em C que o
    // modelo de bastão rígido não sabe dizer. Sem a marca, o que se vê é só o
    // SALDO (+8°), repartido meio a meio: um tronco reto, inclinado de leve.
    const curved = makeFigure({
      pose: {
        ...resolvePosePreset('standing'),
        spine: { x: 0, y: 0, z: 20 },
        chest: { x: 0, y: 0, z: -12 },
      },
    })

    const straight = infer(curved, FRONT, { skip: ['chest'] }).pose
    expect(straight.spine.z).toBeCloseTo(straight.chest.z, 0)
    expect(Math.abs(straight.spine.z)).toBeLessThan(8)

    // Com a marca, cada trecho responde por si. A COLUNA sai exata: o que a
    // marca dá é a direção do composto root→spine→chest (0,17 m fixo + 0,24 m
    // girado pela coluna), e desfazer o trecho fixo devolve o osso.
    const broken = infer(curved, FRONT).pose
    expect(broken.spine.z).toBeCloseTo(20, 0)

    // O PEITO fecha a conta contra o frame do tronco, cujo prumo é
    // quadris→pescoço — um composto de três trechos que não é exatamente a
    // orientação do peito (viés que já existia na repartição meio a meio, uns
    // 3°). O que importa está aqui: ele vai para o LADO OPOSTO da coluna, e é
    // isso que faz um C em vez de uma reta.
    expect(broken.chest.z).toBeLessThan(-6)
    expect(broken.chest.z).toBeGreaterThan(-16)
  })

  it('base do tórax dentro do ruído de toque não quebra nada: a zona morta segura (#119)', () => {
    // Um deslize de 0,5% da foto no ponto vale ~4° no osso da coluna — abaixo
    // da zona morta. Sem ela, o erro viraria um S falso (coluna para um lado,
    // peito compensando para o outro), pior de olhar que a reta.
    const figure = makeFigure()
    const straight = infer(figure, FRONT, { skip: ['chest'] }).pose

    const nudged = marksFromFigure(figure, FRONT)
    nudged.chest = { x: nudged.chest!.x + 0.005, y: nudged.chest!.y }

    expect(inferPoseFromMarks(figure, nudged, FRONT, 1)!.pose.spine.z).toBeCloseTo(straight.spine.z, 6)
  })
})

describe('inferRootRotationFromMarks — a raiz conferida pela linha dos quadris (#119)', () => {
  it('com profundidade no par, o giro da pelve sai por arco mínimo', () => {
    // A pessoa da foto está de 3/4; o boneco foi alinhado de frente, a olho.
    // Com o quadril direito marcado "à frente", a linha marcada sai do plano e
    // diz o giro inteiro — e é ele que o botão devolve.
    const turned = makeFigure({ rotation: { x: 0, y: 30, z: 0 } })
    const marks = marksFromFigure(turned, FRONT, { depth: { 'hip.R': 'front' } })

    const result = inferRootRotationFromMarks(makeFigure(), marks, FRONT, 1)!
    expect(result.usedDepth).toBe(true)
    expect(result.rotation.y).toBeCloseTo(30, 0)
    expect(result.deltaDeg).toBeCloseTo(30, 0)
  })

  it('sem profundidade, corrige SÓ o que a foto vê: a inclinação lateral da pelve', () => {
    // Pelve torta (um quadril mais alto): a foto mostra isso direto, e a
    // correção gira em torno do eixo de VISÃO até as projeções casarem.
    const tilted = makeFigure({ rotation: { x: 0, y: 0, z: 12 } })
    const result = inferRootRotationFromMarks(makeFigure(), marksFromFigure(tilted, FRONT), FRONT, 1)!

    expect(result.usedDepth).toBe(false)
    expect(result.rotation.z).toBeCloseTo(12, 0)
    expect(Math.abs(result.rotation.y)).toBeLessThan(1)
  })

  it('sem profundidade, o giro em Y é INVISÍVEL na foto — e a correção não o inventa', () => {
    // A linha dos quadris de uma pelve girada projeta-se na MESMA direção da
    // de uma pelve de frente, só mais curta. Deitar a pelve no plano da foto
    // seria inventar dado: aqui a correção fica quieta (decisão do usuário).
    const turned = makeFigure({ rotation: { x: 0, y: 30, z: 0 } })
    const result = inferRootRotationFromMarks(makeFigure(), marksFromFigure(turned, FRONT), FRONT, 1)!

    expect(result.deltaDeg).toBeLessThan(1)
  })

  it('sem os dois quadris marcados, não há linha: devolve null', () => {
    const figure = makeFigure()
    const marks = marksFromFigure(figure, FRONT)
    delete marks['hip.L']

    expect(inferRootRotationFromMarks(figure, marks, FRONT, 1)).toBeNull()
    expect(inferRootRotationFromMarks(figure, {}, FRONT, 1)).toBeNull()
  })

  it('a linha que discorda da raiz vira AVISO na inferência — a raiz em si fica intocada', () => {
    const tilted = makeFigure({ rotation: { x: 0, y: 0, z: 12 } })
    const marks = marksFromFigure(tilted, FRONT)

    // Boneco alinhado: nada a dizer.
    expect(inferPoseFromMarks(tilted, marks, FRONT, 1)!.warnings).not.toContain(
      'poses.photo.warnRootHips',
    )

    // Boneco desalinhado: o aviso aparece — mas a inferência continua devolvendo
    // SÓ pose, porque a colocação é do usuário (#111).
    const result = inferPoseFromMarks(makeFigure(), marks, FRONT, 1)!
    expect(result.warnings).toContain('poses.photo.warnRootHips')
    expect(result.pose.root).toBeUndefined()
  })
})
