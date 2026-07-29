import * as THREE from 'three'
import { clampJointRotation, getJoint, type JointRotation } from './skeleton'
import { buildJointFrames } from './jointFrames'
import type { Figure } from '../store/figuresStore'

/**
 * IK analítico de 2 ossos ("two-bone IK") para as cadeias curtas do plano
 * (braço: ombro+cotovelo → pulso; perna: quadril+joelho → tornozelo) — ver
 * PLANO.md > "Stack técnica" e "Riscos e mitigações". O plano original
 * previa um CCD manual; na implementação, um CCD ingênuo por eixo travava
 * indefinidamente contra o limite do cotovelo/joelho mesmo para alvos
 * geometricamente alcançáveis (mínimo local contra a borda de um limite,
 * problema conhecido de CCD com limites duros — investigado e documentado
 * em `DECISOES.md` #12, com a troca para IK analítico confirmada pelo
 * usuário). Fórmula fechada (lei dos cossenos) em vez de iteração: imune ao
 * travamento, sempre termina em uma única passada, e ainda é "pequeno e
 * controlável" como o plano pedia.
 *
 * Limitação aceita (documentada, não é um requisito do plano): o ângulo de
 * "torção" livre de cada junta (ex.: `shoulder.y`/`hip.y`, que não afeta a
 * posição do efetuador) não é otimizado — vem como subproduto da construção
 * geométrica abaixo, então pode variar de um jeito não perfeitamente
 * previsível quando o alvo muda de posição. A FK continua disponível para
 * ajustar manualmente esse grau de liberdade se incomodar.
 */

export interface IKChainDefinition {
  /** [junta-base, junta-intermediária] — ex.: `['shoulder.L', 'elbow.L']`. */
  joints: readonly [string, string]
  /** Junta cuja posição no mundo é conduzida até o alvo. */
  endEffector: string
  /**
   * Direção de referência do giro do cotovelo/joelho (`swivelDeg` = 0), no
   * frame do PAI da junta-base (o tronco) — assim ela acompanha o boneco, e
   * "para trás" continua sendo para trás com ele deitado ou girado.
   * Anatomicamente: cotovelo aponta para trás, joelho para a frente.
   */
  swivelZero: readonly [number, number, number]
}

/** Cadeias de IK suportadas, indexadas pela própria junta-efetuador (pulso/tornozelo) — mesmo vocabulário já usado por `selectedJointName`. */
export const IK_CHAINS: Record<string, IKChainDefinition> = {
  'wrist.L': { joints: ['shoulder.L', 'elbow.L'], endEffector: 'wrist.L', swivelZero: [0, 0, -1] },
  'wrist.R': { joints: ['shoulder.R', 'elbow.R'], endEffector: 'wrist.R', swivelZero: [0, 0, -1] },
  'ankle.L': { joints: ['hip.L', 'knee.L'], endEffector: 'ankle.L', swivelZero: [0, 0, 1] },
  'ankle.R': { joints: ['hip.R', 'knee.R'], endEffector: 'ankle.R', swivelZero: [0, 0, 1] },
}

/** Mapa reverso: qualquer junta que faça parte de uma cadeia (base, intermediária ou efetuador) → a chave da cadeia (`IK_CHAINS`). Usado para saber se a junta selecionada pertence a um membro com IK disponível. */
const JOINT_TO_LIMB: Record<string, string> = {}
for (const [endEffector, chain] of Object.entries(IK_CHAINS)) {
  for (const joint of chain.joints) JOINT_TO_LIMB[joint] = endEffector
  JOINT_TO_LIMB[chain.endEffector] = endEffector
}

/** Se `jointName` pertence a um braço/perna com IK (ombro/cotovelo/pulso ou quadril/joelho/tornozelo), retorna a chave da cadeia (o nome da junta-efetuador); senão `null`. */
export function getLimbEndEffector(jointName: string): string | null {
  return JOINT_TO_LIMB[jointName] ?? null
}

const EPSILON = 1e-6

export interface IKSolveResult {
  /** Rotação local (graus) resultante para a junta-base e a junta intermediária, já grampeada por `skeleton.ts`. */
  rotations: Record<string, JointRotation>
  /** Distância entre a posição final do efetuador e o alvo pedido, em metros — > tolerância só quando o alvo estava fora de alcance. */
  remainingDistanceM: number
  /** `true` se o alvo estava dentro do alcance da cadeia (distância base→alvo entre |L1-L2| e L1+L2). */
  reached: boolean
}

function quaternionToClampedDegrees(jointName: string, quaternion: THREE.Quaternion): JointRotation {
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
  return clampJointRotation(jointName, {
    x: THREE.MathUtils.radToDeg(euler.x),
    y: THREE.MathUtils.radToDeg(euler.y),
    z: THREE.MathUtils.radToDeg(euler.z),
  })
}

/**
 * Base ortonormal do plano perpendicular ao eixo base→alvo: é nele que o
 * cotovelo/joelho passeia quando as duas pontas do membro estão paradas — o
 * único grau de liberdade que sobra (ver DECISOES.md #44). `zero` é a direção
 * de `swivelDeg = 0`; `quarter` completa a base, a 90°.
 *
 * A referência da cadeia é levada para o mundo pelo frame do PAI da
 * junta-base. Quando ela fica paralela ao eixo (braço apontado exatamente
 * para trás), a projeção degenera e caímos para o "para cima" do tronco e,
 * em último caso, para o "para o lado" — a mesma escada de fallback que o
 * solver já usa para o plano de dobra.
 */
function swivelBasis(
  axis: THREE.Vector3,
  parentWorldQuat: THREE.Quaternion,
  chain: IKChainDefinition,
): { zero: THREE.Vector3; quarter: THREE.Vector3 } {
  const candidates = [chain.swivelZero, [0, 1, 0] as const, [1, 0, 0] as const]

  for (const candidate of candidates) {
    const reference = new THREE.Vector3(...candidate).applyQuaternion(parentWorldQuat)
    const perpendicular = reference.clone().addScaledVector(axis, -reference.dot(axis))
    if (perpendicular.lengthSq() > EPSILON) {
      const zero = perpendicular.normalize()
      return { zero, quarter: new THREE.Vector3().crossVectors(axis, zero).normalize() }
    }
  }

  const zero = new THREE.Vector3(0, 0, 1)
  return { zero, quarter: new THREE.Vector3().crossVectors(axis, zero).normalize() }
}

/**
 * Giro atual do cotovelo/joelho, em graus, na mesma referência que
 * `solveIKChain` usa com `swivelDeg`. É medido da pose, não guardado em lugar
 * nenhum: o controle da UI lê daqui e escreve resolvendo, então os dois nunca
 * saem de sincronia (e um ângulo que os limites não permitem simplesmente não
 * aparece).
 */
export function getSwivelAngle(figure: Figure, chain: IKChainDefinition): number {
  const [baseJointName, midJointName] = chain.joints
  const { joints } = buildJointFrames(figure)
  const baseGroup = joints.get(baseJointName)
  const midGroup = joints.get(midJointName)
  const endGroup = joints.get(chain.endEffector)
  if (!baseGroup?.parent || !midGroup || !endGroup) return 0

  const basePos = new THREE.Vector3()
  const midPos = new THREE.Vector3()
  const endPos = new THREE.Vector3()
  baseGroup.getWorldPosition(basePos)
  midGroup.getWorldPosition(midPos)
  endGroup.getWorldPosition(endPos)

  const axis = endPos.clone().sub(basePos)
  if (axis.lengthSq() < EPSILON) return 0
  axis.normalize()

  const toMid = midPos.clone().sub(basePos)
  const radial = toMid.addScaledVector(axis, -toMid.dot(axis))
  if (radial.lengthSq() < EPSILON) return 0

  const parentWorldQuat = new THREE.Quaternion()
  baseGroup.parent.getWorldQuaternion(parentWorldQuat)
  const { zero, quarter } = swivelBasis(axis, parentWorldQuat, chain)

  return THREE.MathUtils.radToDeg(Math.atan2(radial.dot(quarter), radial.dot(zero)))
}

export interface IKSolveOptions {
  /**
   * Giro do cotovelo/joelho em torno do eixo base→alvo, em graus. Ausente =
   * mantém o plano de dobra atual (continuidade ao arrastar o alvo, que é o
   * comportamento desde o #12).
   */
  swivelDeg?: number
}

export function solveIKChain(
  figure: Figure,
  chain: IKChainDefinition,
  targetWorldPosition: readonly [number, number, number],
  options: IKSolveOptions = {},
): IKSolveResult {
  const [baseJointName, midJointName] = chain.joints
  const { outer, joints } = buildJointFrames(figure)
  const baseGroup = joints.get(baseJointName)
  const midGroup = joints.get(midJointName)
  const endGroup = joints.get(chain.endEffector)
  if (!baseGroup?.parent || !midGroup || !endGroup) {
    throw new Error(`Cadeia de IK inválida: "${baseJointName}" → "${midJointName}" → "${chain.endEffector}"`)
  }

  const basePos = new THREE.Vector3()
  const currentMidPos = new THREE.Vector3()
  const currentEndPos = new THREE.Vector3()
  baseGroup.getWorldPosition(basePos)
  midGroup.getWorldPosition(currentMidPos)
  endGroup.getWorldPosition(currentEndPos)

  // Eixo de dobra atual da junta intermediária (antes de qualquer ajuste) —
  // referência estável para o plano de dobra quando o braço/perna já está
  // esticado na direção do alvo (o vetor base→junta-intermediária fica
  // paralelo a base→alvo nesse caso, e derivar o plano a partir dele fica
  // mal-condicionado — ver DECISOES.md #12).
  const currentMidWorldQuat = new THREE.Quaternion()
  midGroup.getWorldQuaternion(currentMidWorldQuat)
  const currentHingeAxis = new THREE.Vector3(1, 0, 0).applyQuaternion(currentMidWorldQuat)

  const upperLength = basePos.distanceTo(currentMidPos)
  const lowerLength = currentMidPos.distanceTo(currentEndPos)

  const target = new THREE.Vector3(...targetWorldPosition)
  const toTarget = target.clone().sub(basePos)
  const rawDistance = toTarget.length()
  const minReach = Math.abs(upperLength - lowerLength) + EPSILON
  const maxReach = upperLength + lowerLength - EPSILON
  const distance = THREE.MathUtils.clamp(rawDistance, minReach, maxReach)
  const reached = rawDistance >= minReach - EPSILON && rawDistance <= maxReach + EPSILON

  const dirToTarget =
    rawDistance > EPSILON ? toTarget.clone().normalize() : currentMidPos.clone().sub(basePos).normalize()

  // Ângulo interno na junta intermediária (lei dos cossenos) → grau de flexão (0 = esticado, sempre ≥ 0 — a junta nunca hiperestende).
  const cosMid = THREE.MathUtils.clamp(
    (upperLength ** 2 + lowerLength ** 2 - distance ** 2) / (2 * upperLength * lowerLength),
    -1,
    1,
  )
  const flexionDeg = 180 - THREE.MathUtils.radToDeg(Math.acos(cosMid))

  // Ângulo entre a direção base→alvo e a direção base→junta-intermediária.
  const cosBase = THREE.MathUtils.clamp(
    (upperLength ** 2 + distance ** 2 - lowerLength ** 2) / (2 * upperLength * distance),
    -1,
    1,
  )
  const baseAngle = Math.acos(cosBase)

  const baseParentWorldQuat = new THREE.Quaternion()
  baseGroup.parent.getWorldQuaternion(baseParentWorldQuat)

  // Giro pedido pelo controle (DECISOES.md #44): com as duas pontas do membro
  // paradas, o cotovelo/joelho tem UM grau de liberdade — a volta em torno do
  // eixo base→alvo. É esse ângulo, que o solver sempre decidiu sozinho logo
  // abaixo, que passa a poder vir de fora.
  const { zero: swivelZeroDir, quarter: swivelQuarterDir } = swivelBasis(dirToTarget, baseParentWorldQuat, chain)
  const requestedSwivel = options.swivelDeg
  if (requestedSwivel !== undefined) {
    const rad = THREE.MathUtils.degToRad(requestedSwivel)
    const poleFromSwivel = swivelZeroDir
      .clone()
      .multiplyScalar(Math.cos(rad))
      .addScaledVector(swivelQuarterDir, Math.sin(rad))
    return solveWithPole(poleFromSwivel)
  }

  return solveWithPole(null)

  /**
   * Resolve a cadeia com um plano de dobra dado (giro pedido) ou herdado da
   * pose atual (`null`). Fechada sobre tudo o que já foi medido acima, para
   * que os dois caminhos compartilhem exatamente a mesma geometria.
   */
  function solveWithPole(requestedPole: THREE.Vector3 | null): IKSolveResult {
    if (!baseGroup?.parent || !midGroup || !endGroup) {
      throw new Error(`Cadeia de IK inválida: "${baseJointName}" → "${midJointName}" → "${chain.endEffector}"`)
    }

  // Eixo perpendicular ao plano de dobra: tenta manter a junta intermediária
  // do lado de onde já estava (continuidade visual ao arrastar o alvo), com
  // um eixo de referência fixo como fallback quando a pose atual já está
  // alinhada com o alvo (produto vetorial degenerado).
  const currentDir = currentMidPos.clone().sub(basePos).normalize()
  let poleDir =
    requestedPole ?? currentDir.clone().addScaledVector(dirToTarget, -currentDir.dot(dirToTarget))
  if (poleDir.lengthSq() < EPSILON) {
    // Braço/perna já esticado na direção do alvo — usa o eixo de dobra atual
    // como referência (continuidade), em vez de um vetor global arbitrário.
    poleDir = currentHingeAxis.clone().addScaledVector(dirToTarget, -currentHingeAxis.dot(dirToTarget))
  }
  if (poleDir.lengthSq() < EPSILON) {
    const fallback = new THREE.Vector3(0, 0, -1)
    poleDir = fallback.clone().addScaledVector(dirToTarget, -fallback.dot(dirToTarget))
    if (poleDir.lengthSq() < EPSILON) poleDir = new THREE.Vector3(1, 0, 0)
  }
  poleDir.normalize()

  const bendAxis = new THREE.Vector3().crossVectors(dirToTarget, poleDir)
  if (bendAxis.lengthSq() < EPSILON) bendAxis.set(0, 0, 1)
  bendAxis.normalize()

  const midDirection = dirToTarget.clone().applyAxisAngle(bendAxis, baseAngle)

  // Junta-base: precisa fixar 2 coisas ao mesmo tempo, não só "apontar para
  // `midDirection`" — apontar sozinho (rotação mínima, sem torção) deixa o
  // eixo de dobra da junta intermediária num ângulo arbitrário ao redor da
  // direção do braço, então a flexão calculada abaixo dobraria num plano
  // errado e erraria o alvo apesar da distância bater. Por isso construímos
  // a base ortonormal completa (direção do membro + eixo de dobra) e
  // extraímos a rotação de uma vez, em vez de girar só a direção.
  //
  // `flexesNegative`: `knee`/`ankle` flexionam em X positivo (faixa
  // `{min:0,max:...}`), mas `elbow` flexiona em X negativo (faixa
  // `{min:...,max:0}`, corrigido em `DECISOES.md` #14 — antes o cotovelo só
  // permitia hiperestender). O eixo X da base (`basisX`, via
  // `localHingeAxis`) e o sinal aplicado a `flexionDeg` abaixo precisam
  // inverter juntos para a junta intermediária dobrar no sentido certo —
  // Rot(eixo, ang) = Rot(-eixo, -ang), então negar os dois ao mesmo tempo
  // preserva a posição final alcançada, só muda qual sinal de X representa
  // essa mesma dobra física. Verificado numericamente pelos testes de
  // convergência do braço (que dependem do resultado bater com o alvo, não
  // só do limite ser respeitado), não assumido — mesma disciplina do #12.
  const midLimitsForSign = getJoint(midJointName).limits
  const flexesNegative = midLimitsForSign.x !== undefined && midLimitsForSign.x.max <= 0
  const hingeSign = flexesNegative ? 1 : -1
  const parentWorldQuatInverse = baseParentWorldQuat.clone().invert()
  // Offset local até a junta intermediária sempre aponta em -Y neste
  // esqueleto (braço/perna retos "para baixo" na pose de repouso, ver
  // `skeleton.ts`) — por isso o eixo Y local é a referência de "direção do
  // membro".
  const localDir = midDirection.clone().applyQuaternion(parentWorldQuatInverse).normalize()
  const localHingeAxis = bendAxis
    .clone()
    .applyQuaternion(parentWorldQuatInverse)
    .multiplyScalar(hingeSign)
    .normalize()
  const basisY = localDir.clone().negate()
  const basisZ = new THREE.Vector3().crossVectors(localHingeAxis, basisY).normalize()
  const basisX = new THREE.Vector3().crossVectors(basisY, basisZ).normalize()
  const baseLocalQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(basisX, basisY, basisZ),
  )
  const baseRotation = quaternionToClampedDegrees(baseJointName, baseLocalQuat)

  baseGroup.rotation.set(
    THREE.MathUtils.degToRad(baseRotation.x),
    THREE.MathUtils.degToRad(baseRotation.y),
    THREE.MathUtils.degToRad(baseRotation.z),
  )
  outer.updateMatrixWorld(true)

  // Junta intermediária: só o eixo de flexão (x) é determinado pela
  // distância ao alvo — os demais eixos (torção, sem efeito na posição do
  // efetuador) mantêm o valor atual da pose, para não resetar uma torção já
  // ajustada manualmente via FK. `flexionDeg` (lei dos cossenos) é sempre
  // ≥ 0; aplicado com o sinal correto da junta (`flexesNegative`, acima).
  const midLimits = midLimitsForSign
  const signedFlexionDeg = flexesNegative ? -flexionDeg : flexionDeg
  const midRotation: JointRotation = {
    x: midLimits.x ? THREE.MathUtils.clamp(signedFlexionDeg, midLimits.x.min, midLimits.x.max) : 0,
    y: figure.pose[midJointName]?.y ?? 0,
    z: figure.pose[midJointName]?.z ?? 0,
  }
  const clampedMidRotation = clampJointRotation(midJointName, midRotation)

  midGroup.rotation.set(
    THREE.MathUtils.degToRad(clampedMidRotation.x),
    THREE.MathUtils.degToRad(clampedMidRotation.y),
    THREE.MathUtils.degToRad(clampedMidRotation.z),
  )
  outer.updateMatrixWorld(true)

  const achievedEndPos = new THREE.Vector3()
  endGroup.getWorldPosition(achievedEndPos)

    return {
      rotations: { [baseJointName]: baseRotation, [midJointName]: clampedMidRotation },
      remainingDistanceM: achievedEndPos.distanceTo(target),
      reached,
    }
  }
}
