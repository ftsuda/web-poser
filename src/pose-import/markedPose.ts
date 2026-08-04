import * as THREE from 'three'
import { getHeightScale, getJoint, getJointChain, type JointRotation } from '../figure/skeleton'
import { NEUTRAL_ELBOW_TWIST } from '../figure/posePresets'
import type { Figure } from '../store/figuresStore'
import {
  commit,
  commitQuaternion,
  directionInPreFrame,
  midpoint,
  quatFromDegrees,
  radToDegRotation,
  solveLimbFromPoints,
  solveNeckHead,
  solveTorso,
  type Solve,
} from './poseSolver'

/**
 * A inferência por MARCAÇÃO MANUAL (PLANO.md > "Pose por marcação manual"):
 * o usuário alinha o boneco à foto (posição e rotação do root, que ficam
 * TRAVADOS — decisão dele, melhor que inferir pelos quadris), toca os pontos
 * das juntas principais sobre a foto, e este módulo converte os toques em
 * pose — o solver junta a junta é o mesmo do retarget (`poseSolver.ts`).
 *
 * **O plano da foto:** um toque dá `(x, y)`; o ponto 3D nasce no plano da
 * vista ativa (`view.right`/`view.up`, em unidades de foto — o solver só usa
 * direções, então nenhuma conversão de escala é necessária). A profundidade é
 * OPT-IN por marcador (decisão do usuário): um ponto marcado "à frente" ou
 * "atrás" sai do plano pelo ENCURTAMENTO do osso na foto — o comprimento real
 * o esqueleto conhece; a foto mostra a projeção; a diferença é a profundidade,
 * e o estado do marcador dá o sinal. Ombros e quadris (#115) medem contra o
 * OUTRO LADO em vez de contra um osso pai: a distância entre os dois lados é
 * rígida, então a linha encurtada na foto é a torção do tronco.
 *
 * Os avisos são CHAVES de i18n (`poses.photo.warn*`): quem fala com o usuário
 * é a UI, na língua dela — o contrato oposto ao da CLI do retarget.
 */

/** Um toque na foto: coordenadas normalizadas DA FOTO (0–1, y para baixo). */
export interface PoseMark {
  x: number
  y: number
  /** Profundidade opt-in: ausente = no plano da vista. */
  depth?: 'front' | 'back'
}

export type PoseMarkKey =
  | 'head'
  | 'nose'
  | 'neck'
  | 'chest'
  | 'shoulder.L'
  | 'shoulder.R'
  | 'elbow.L'
  | 'elbow.R'
  | 'wrist.L'
  | 'wrist.R'
  | 'hip.L'
  | 'hip.R'
  | 'knee.L'
  | 'knee.R'
  | 'ankle.L'
  | 'ankle.R'
  | 'foot.L'
  | 'foot.R'

/**
 * A sequência guiada de marcação, AGRUPADA POR MEMBRO (decisão do usuário,
 * #113 — alternar lados confundia): o eixo do tronco inteiro primeiro, de cima
 * para baixo (cabeça, com o nariz opcional junto; base do pescoço; base do
 * tórax), depois braço direito inteiro, braço esquerdo inteiro, perna direita
 * inteira (a ponta do pé logo após o próprio tornozelo, não amontoada no fim)
 * e perna esquerda inteira. O L/R é o DA PESSOA na foto.
 *
 * A base do pescoço (#113.1) é a âncora do PRUMO do tronco — quadris→pescoço,
 * imune ao ombro marcado largo (na foto se marca o deltoide, não a junta). A
 * base do tórax (#119) é a QUEBRA do tronco: sem ela, coluna e peito repartem
 * meio a meio e todo tronco sai reto. A raiz continua sem marca — é o
 * alinhamento manual do usuário (#111), conferido à parte pela linha dos
 * quadris (`inferRootRotationFromMarks`).
 */
export const POSE_MARK_SEQUENCE: readonly { key: PoseMarkKey; optional: boolean }[] = [
  { key: 'head', optional: false },
  { key: 'nose', optional: true },
  { key: 'neck', optional: false },
  { key: 'chest', optional: true },
  { key: 'shoulder.R', optional: false },
  { key: 'elbow.R', optional: false },
  { key: 'wrist.R', optional: false },
  { key: 'shoulder.L', optional: false },
  { key: 'elbow.L', optional: false },
  { key: 'wrist.L', optional: false },
  { key: 'hip.R', optional: false },
  { key: 'knee.R', optional: false },
  { key: 'ankle.R', optional: false },
  { key: 'foot.R', optional: true },
  { key: 'hip.L', optional: false },
  { key: 'knee.L', optional: false },
  { key: 'ankle.L', optional: false },
  { key: 'foot.L', optional: true },
]

/** Base de tela da vista ativa, em mundo — `posesViews.viewScreenBasis` no módulo, câmera viva no desktop. */
export interface MarkedView {
  right: readonly [number, number, number]
  up: readonly [number, number, number]
}

export interface MarkedPoseResult {
  pose: Record<string, JointRotation>
  /** Chaves de i18n (`poses.photo.warn*`) — a UI traduz. */
  warnings: string[]
}

/** O osso que TERMINA em cada marca com profundidade possível: de onde vem o encurtamento. */
const DEPTH_CHAINS: ReadonlyArray<{ child: PoseMarkKey; parent: PoseMarkKey; bone: string }> = [
  { child: 'elbow.L', parent: 'shoulder.L', bone: 'elbow.L' },
  { child: 'elbow.R', parent: 'shoulder.R', bone: 'elbow.R' },
  { child: 'wrist.L', parent: 'elbow.L', bone: 'wrist.L' },
  { child: 'wrist.R', parent: 'elbow.R', bone: 'wrist.R' },
  { child: 'knee.L', parent: 'hip.L', bone: 'knee.L' },
  { child: 'knee.R', parent: 'hip.R', bone: 'knee.R' },
  { child: 'ankle.L', parent: 'knee.L', bone: 'ankle.L' },
  { child: 'ankle.R', parent: 'knee.R', bone: 'ankle.R' },
  { child: 'foot.L', parent: 'ankle.L', bone: 'ball.L' },
  { child: 'foot.R', parent: 'ankle.R', bone: 'ball.R' },
]

/**
 * Os PARES de lados opostos cuja distância é RÍGIDA no esqueleto (#115): a
 * linha dos ombros e a linha dos quadris. Aqui o encurtamento na foto não se
 * mede contra um osso pai, e sim contra o outro lado — é o que transforma uma
 * linha de ombros curta em TORÇÃO do tronco, em vez de ombros estreitos.
 */
const DEPTH_PAIRS: ReadonlyArray<{ a: PoseMarkKey; b: PoseMarkKey }> = [
  { a: 'shoulder.R', b: 'shoulder.L' },
  { a: 'hip.R', b: 'hip.L' },
]

/** Encurtamento mínimo (fração do osso) para a profundidade ser sinal, e não ruído de marcação. */
const DEPTH_MIN_RATIO = 0.05

/** De onde a marca tira profundidade: da ponta de um osso, do outro lado do par, ou de lugar nenhum. */
export type PoseMarkDepthKind = 'none' | 'bone' | 'pair'

export function poseMarkDepthKind(key: PoseMarkKey): PoseMarkDepthKind {
  if (DEPTH_CHAINS.some((chain) => chain.child === key)) return 'bone'
  if (DEPTH_PAIRS.some((pair) => pair.a === key || pair.b === key)) return 'pair'
  return 'none'
}

/** Se a marca aceita profundidade (ponta de osso de membro, ou lado de um par). */
export function poseMarkSupportsDepth(key: PoseMarkKey): boolean {
  return poseMarkDepthKind(key) !== 'none'
}

function boneLengthM(jointName: string, heightScale: number): number {
  const [x, y, z] = getJoint(jointName).position
  return Math.hypot(x, y, z) * heightScale
}

/** Posição da junta em REPOUSO (todas as rotações neutras), somando a cadeia até a raiz. */
function restPosition(jointName: string): THREE.Vector3 {
  const position = new THREE.Vector3()
  for (const name of getJointChain(jointName)) position.add(new THREE.Vector3(...getJoint(name).position))
  return position
}

/** Distância rígida entre os dois lados de um par (ombros, quadris), em metros. */
function pairSpanM(a: string, b: string, heightScale: number): number {
  return restPosition(a).distanceTo(restPosition(b)) * heightScale
}

/** Discordância mínima (graus) entre a linha dos quadris e a raiz para valer um aviso. */
export const ROOT_HIP_MIN_DEG = 5

/** Os pontos das marcas em 3D, já com a profundidade aplicada — o terreno comum. */
interface MarkedPoints {
  points: Map<PoseMarkKey, THREE.Vector3>
  /** Normal do plano da foto, apontando para a câmera. */
  forward: THREE.Vector3
  warnings: string[]
  /** Alguma marca saiu do plano — senão a pose inteira é chapada. */
  anyDepth: boolean
  /** Lados de par (ombros/quadris) que REALMENTE saíram do plano. */
  liftedPairs: Set<PoseMarkKey>
}

/**
 * Marcas → pontos 3D no plano da vista, com os dois passes de profundidade
 * (pares primeiro, depois cadeia a cadeia). Extraído porque a conferência da
 * raiz (#119) precisa dos MESMOS pontos que a inferência de pose: a linha dos
 * quadris só diz o giro da pelve depois de a profundidade do par ser aplicada.
 */
function buildMarkedPoints(
  figure: Figure,
  marks: Partial<Record<PoseMarkKey, PoseMark>>,
  view: MarkedView,
  aspect: number,
): MarkedPoints {
  const right = new THREE.Vector3(...view.right).normalize()
  const upAxis = new THREE.Vector3(...view.up).normalize()
  const forward = right.clone().cross(upAxis)

  // Cada marca vira um ponto 3D no plano da vista, em "unidades de foto" —
  // o solver só usa direções, então a escala absoluta não importa.
  const points = new Map<PoseMarkKey, THREE.Vector3>()
  for (const [key, mark] of Object.entries(marks) as [PoseMarkKey, PoseMark][]) {
    points.set(
      key,
      right
        .clone()
        .multiplyScalar(mark.x * aspect)
        .add(upAxis.clone().multiplyScalar(-mark.y)),
    )
  }

  const warnings: string[] = []

  // Escala foto→metro (só para a PROFUNDIDADE): mediana das razões entre o
  // comprimento 2D marcado e o comprimento real de cada osso de membro.
  const heightScale = getHeightScale(figure.height)
  const ratios: number[] = []
  for (const { child, parent, bone } of DEPTH_CHAINS) {
    const childPoint = points.get(child)
    const parentPoint = points.get(parent)
    if (!childPoint || !parentPoint) continue
    ratios.push(childPoint.distanceTo(parentPoint) / boneLengthM(bone, heightScale))
  }
  ratios.sort((a, b) => a - b)
  const unitsPerMeter = ratios.length > 0 ? ratios[Math.floor(ratios.length / 2)] : 0

  let anyDepth = false
  const liftedPairs = new Set<PoseMarkKey>()

  // Profundidade dos PARES primeiro (#115): a linha dos ombros/quadris sai do
  // plano ANTES de os membros medirem o encurtamento contra ela. A separação
  // em profundidade se divide SIMETRICAMENTE entre os dois lados (decisão do
  // usuário): o centro do par fica onde está, então o prumo do tronco não se
  // mexe e o que sai da marcação é torção pura.
  for (const { a, b } of DEPTH_PAIRS) {
    const depthA = marks[a]?.depth
    const depthB = marks[b]?.depth
    if (!depthA && !depthB) continue
    const pointA = points.get(a)
    const pointB = points.get(b)
    if (!pointA || !pointB) continue

    // Os dois lados "à frente" (ou os dois "atrás") não dizem nada de relativo:
    // o que a foto mede é a diferença entre os lados.
    if (depthA && depthB && depthA === depthB) {
      warnings.push('poses.photo.warnDepthPairSame')
      continue
    }

    const spanUnits = pairSpanM(a, b, heightScale) * unitsPerMeter
    const delta = pointB.clone().sub(pointA)
    const deltaForward = delta.dot(forward)
    const perpSq = delta.lengthSq() - deltaForward * deltaForward
    const separationSq = spanUnits * spanUnits - perpSq

    // Linha do par inteira na foto (nenhum encurtamento): não há torção para
    // medir — sem escala de foto, idem. Fica no plano, avisando.
    if (unitsPerMeter === 0 || separationSq < (DEPTH_MIN_RATIO * spanUnits) ** 2) {
      warnings.push('poses.photo.warnDepthImpossible')
      continue
    }

    const half = Math.sqrt(separationSq) / 2
    // Quem está na frente: o lado marcado "front", ou o oposto do marcado "back".
    const frontIsA = depthA ? depthA === 'front' : depthB === 'back'
    const middle = (pointA.dot(forward) + pointB.dot(forward)) / 2
    pointA.add(forward.clone().multiplyScalar(middle + (frontIsA ? half : -half) - pointA.dot(forward)))
    pointB.add(forward.clone().multiplyScalar(middle + (frontIsA ? -half : half) - pointB.dot(forward)))
    anyDepth = true
    liftedPairs.add(a)
    liftedPairs.add(b)
  }

  // Profundidade opt-in, cadeia a cadeia (pai primeiro: o punho "à frente"
  // mede o encurtamento contra o cotovelo JÁ levantado do plano).
  for (const { child, parent, bone } of DEPTH_CHAINS) {
    const mark = marks[child]
    const childPoint = points.get(child)
    const parentPoint = points.get(parent)
    if (!mark?.depth || !childPoint || !parentPoint || unitsPerMeter === 0) continue

    const boneUnits = boneLengthM(bone, heightScale) * unitsPerMeter
    const delta = childPoint.clone().sub(parentPoint)
    const deltaForward = delta.dot(forward)
    const perpSq = delta.lengthSq() - deltaForward * deltaForward
    const liftSq = boneUnits * boneUnits - perpSq

    // Encurtamento dentro do ruído de marcação (ou osso "esticado" na foto):
    // profundidade não tem de onde sair — fica no plano, avisando.
    if (liftSq < (DEPTH_MIN_RATIO * boneUnits) ** 2) {
      warnings.push('poses.photo.warnDepthImpossible')
      continue
    }

    const lift = Math.sqrt(liftSq)
    const target = mark.depth === 'front' ? lift : -lift
    childPoint.add(forward.clone().multiplyScalar(target - deltaForward))
    anyDepth = true
  }

  return { points, forward, warnings, anyDepth, liftedPairs }
}

/**
 * A rotação de raiz que põe a linha de quadris do boneco sobre a MARCADA.
 *
 * A raiz é o alinhamento manual do usuário (#111) e nenhuma inferência a toca
 * — mas ela é a âncora de tudo: alinhá-la 15° torta faz o tronco inteiro sair
 * 15° torto, e o erro reaparece como torção que a pessoa da foto não tem. Os
 * quadris já são marcados, e a distância entre eles é rígida: a linha deles é
 * a medida da pelve que a foto sabe dar. Isto aqui só CALCULA — quem aplica é
 * o botão do painel, ato explícito, com passo de undo próprio (#119).
 *
 * Com profundidade no par, a linha marcada está em 3D e a correção é o arco
 * MÍNIMO — o menor giro que a leva ao lugar, sem tocar na inclinação
 * frente/trás da pelve, que a linha não vê. Sem profundidade, a linha está no
 * plano da foto, e deitar a pelve nele seria inventar dado: a correção então
 * gira só em torno do eixo de VISÃO, casando as PROJEÇÕES — o que sobra é
 * exatamente a inclinação lateral da pelve, que a foto mostra de verdade.
 */
export interface RootFromHips {
  /** Rotação de raiz sugerida, em graus (XYZ) — pronta para `setRootRotation`. */
  rotation: JointRotation
  /** O quanto a raiz gira até lá; abaixo de `ROOT_HIP_MIN_DEG` não vale o clique. */
  deltaDeg: number
  /** `true` = arco mínimo (o par tem profundidade); `false` = só a projeção. */
  usedDepth: boolean
}

export function inferRootRotationFromMarks(
  figure: Figure,
  marks: Partial<Record<PoseMarkKey, PoseMark>>,
  view: MarkedView,
  aspect: number,
): RootFromHips | null {
  if (!marks['hip.L'] || !marks['hip.R']) return null
  return rootFromHips(figure, buildMarkedPoints(figure, marks, view, aspect))
}

function rootFromHips(figure: Figure, built: MarkedPoints): RootFromHips | null {
  const lHip = built.points.get('hip.L')
  const rHip = built.points.get('hip.R')
  if (!lHip || !rHip) return null

  const marked = lHip.clone().sub(rHip)
  if (marked.lengthSq() < 1e-12) return null
  marked.normalize()

  const rootQuat = quatFromDegrees(figure.rotation)
  // `hip.L` mora em +X local: o eixo transversal da pelve é o X da raiz.
  const current = new THREE.Vector3(1, 0, 0).applyQuaternion(rootQuat)

  const usedDepth = built.liftedPairs.has('hip.L')
  let correction: THREE.Quaternion
  if (usedDepth) {
    correction = new THREE.Quaternion().setFromUnitVectors(current, marked)
  } else {
    const forward = built.forward
    const flatCurrent = current.clone().sub(forward.clone().multiplyScalar(current.dot(forward)))
    const flatMarked = marked.clone().sub(forward.clone().multiplyScalar(marked.dot(forward)))
    // Pelve de perfil na foto: a projeção some e não há ângulo a medir.
    if (flatCurrent.lengthSq() < 1e-12 || flatMarked.lengthSq() < 1e-12) return null
    flatCurrent.normalize()
    flatMarked.normalize()
    const angle = Math.atan2(
      flatCurrent.clone().cross(flatMarked).dot(forward),
      flatCurrent.dot(flatMarked),
    )
    correction = new THREE.Quaternion().setFromAxisAngle(forward, angle)
  }

  const corrected = correction.clone().multiply(rootQuat)
  return {
    rotation: radToDegRotation(new THREE.Euler().setFromQuaternion(corrected, 'XYZ')),
    deltaDeg: THREE.MathUtils.radToDeg(
      2 * Math.acos(Math.min(1, Math.abs(correction.w))),
    ),
    usedDepth,
  }
}

/**
 * Converte as marcas de UMA foto em pose, com o root do boneco COMO ESTÁ
 * (alinhado à foto pelo usuário — posição, rotação e altura não mudam).
 * Devolve `null` sem o mínimo estrutural (ombros + quadris marcados).
 */
export function inferPoseFromMarks(
  figure: Figure,
  marks: Partial<Record<PoseMarkKey, PoseMark>>,
  view: MarkedView,
  /** Largura/altura natural da foto — corrige o X das coordenadas normalizadas. */
  aspect: number,
): MarkedPoseResult | null {
  if (!marks['shoulder.L'] || !marks['shoulder.R'] || !marks['hip.L'] || !marks['hip.R']) return null

  const built = buildMarkedPoints(figure, marks, view, aspect)
  const { points, warnings, anyDepth } = built

  const solve: Solve = { pose: {}, world: new Map() }
  const rootQuat = quatFromDegrees(figure.rotation)
  solve.world.set('root', rootQuat)

  const lShoulder = points.get('shoulder.L')!
  const rShoulder = points.get('shoulder.R')!
  const shoulderCenter = midpoint(lShoulder, rShoulder)
  const hipCenter = midpoint(points.get('hip.L')!, points.get('hip.R')!)
  // O prumo do tronco: quadris → base do pescoço quando marcada (#113.1 — o
  // centro dos ombros entorta quando o ombro é marcado no deltoide ou a foto
  // é em 3/4); sem a marca, o centro dos ombros continua sendo o fallback.
  const neckBase = points.get('neck') ?? shoulderCenter
  const up = neckBase.clone().sub(hipCenter)
  if (up.lengthSq() < 1e-12) return null

  // A linha dos ombros é o eixo PRIMÁRIO do frame do tronco (`quatFromAxes`).
  // Com a base do pescoço marcada, o primário passa a ser o PRUMO: o eixo dos
  // ombros é projetado no plano perpendicular a ele, e só diz a torção — um
  // ombro marcado alto (trapézio/deltoide) deixa de rolar o tronco inteiro.
  const shoulderAxis = lShoulder.clone().sub(rShoulder)
  if (points.has('neck')) {
    const upDir = up.clone().normalize()
    const projected = shoulderAxis.clone().sub(upDir.multiplyScalar(shoulderAxis.dot(upDir)))
    // Degenerado (ombros paralelos ao prumo): fica o eixo original.
    if (projected.lengthSq() > 1e-12) shoulderAxis.copy(projected)
  }

  // A base do tórax (#119) é onde o tronco QUEBRA: sem ela, coluna e peito
  // repartem meio a meio o frame dos ombros e todo tronco sai reto — o arco
  // das costas, o contraposto e o ombro caído viram a mesma inclinação.
  const chestMark = points.get('chest')
  const midUp = chestMark ? chestMark.clone().sub(hipCenter) : null
  solveTorso(solve, rootQuat, shoulderAxis, up, midUp && midUp.lengthSq() > 1e-12 ? midUp : null)

  const head = points.get('head')
  const nose = points.get('nose')
  solveNeckHead(
    solve,
    head ? head.clone().sub(neckBase) : null,
    head && nose ? nose.clone().sub(head) : null,
  )

  const limbs: ReadonlyArray<{
    rootJoint: string
    hingeJoint: string
    rootMark: PoseMarkKey
    hingeMark: PoseMarkKey
    endMark: PoseMarkKey
    hingeSign: 1 | -1
    hingeTwistDeg?: number
  }> = [
    { rootJoint: 'shoulder.L', hingeJoint: 'elbow.L', rootMark: 'shoulder.L', hingeMark: 'elbow.L', endMark: 'wrist.L', hingeSign: -1, hingeTwistDeg: NEUTRAL_ELBOW_TWIST['elbow.L'] },
    { rootJoint: 'shoulder.R', hingeJoint: 'elbow.R', rootMark: 'shoulder.R', hingeMark: 'elbow.R', endMark: 'wrist.R', hingeSign: -1, hingeTwistDeg: NEUTRAL_ELBOW_TWIST['elbow.R'] },
    { rootJoint: 'hip.L', hingeJoint: 'knee.L', rootMark: 'hip.L', hingeMark: 'knee.L', endMark: 'ankle.L', hingeSign: 1 },
    { rootJoint: 'hip.R', hingeJoint: 'knee.R', rootMark: 'hip.R', hingeMark: 'knee.R', endMark: 'ankle.R', hingeSign: 1 },
  ]
  for (const limb of limbs) {
    const root = points.get(limb.rootMark)
    const hinge = points.get(limb.hingeMark)
    const end = points.get(limb.endMark)
    if (!root || !hinge || !end) {
      commit(solve, limb.rootJoint, {})
      commit(solve, limb.hingeJoint, { y: limb.hingeTwistDeg ?? 0 })
      continue
    }
    solveLimbFromPoints(solve, limb, root, hinge, end)
  }

  // Punhos neutros (sem marcas de mão — dedos ignorados por pedido) e
  // tornozelos pela ponta do pé, quando marcada.
  commit(solve, 'wrist.L', {})
  commit(solve, 'wrist.R', {})
  const ballRest = new THREE.Vector3(...getJoint('ball.L').position).normalize()
  for (const side of ['L', 'R'] as const) {
    const ankle = points.get(`ankle.${side}`)
    const foot = points.get(`foot.${side}`)
    if (!ankle || !foot) {
      commit(solve, `ankle.${side}`, {})
      continue
    }
    const direction = directionInPreFrame(solve, `ankle.${side}`, foot.clone().sub(ankle))
    commitQuaternion(solve, `ankle.${side}`, new THREE.Quaternion().setFromUnitVectors(ballRest, direction))
  }

  // A raiz continua intocada (#111) — mas se a linha dos quadris marcada
  // discorda dela, o aviso diz que há um botão para acertar isso (#119).
  const rootCheck = rootFromHips(figure, built)
  if (rootCheck && rootCheck.deltaDeg >= ROOT_HIP_MIN_DEG) warnings.push('poses.photo.warnRootHips')

  if (!anyDepth) warnings.push('poses.photo.warnFlat')
  warnings.push('poses.photo.warnNeutral')

  return { pose: solve.pose, warnings }
}
