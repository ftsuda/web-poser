import * as THREE from 'three'
import { getJoint } from '../figure/skeleton'
import { NEUTRAL_ELBOW_TWIST } from '../figure/posePresets'
import { seatOnGround } from '../figure/poseGround'
import type { Figure } from '../store/figuresStore'
import { BLAZEPOSE, type PoseLandmark } from './blazepose'
import {
  commit,
  commitQuaternion,
  directionInPreFrame,
  midpoint,
  quatFromAxes,
  radToDegRotation,
  solveLimbFromPoints,
  solveNeckHead,
  solveTorso,
  type Solve,
} from './poseSolver'

/**
 * O retargeting AUTOMÁTICO (PLANO.md > "MCP de análise de pose", etapa 1):
 * world landmarks do BlazePose → boneco completo do app. O solver junta a
 * junta mora em `poseSolver.ts` (compartilhado com a marcação manual); aqui
 * fica o que é específico do MediaPipe — os 33 índices, a conversão de
 * espaço, a visibilidade e a montagem do boneco.
 *
 * **Espaço:** os world landmarks do MediaPipe são y-para-baixo e z-para-a-
 * câmera; o app é y-para-cima com o boneco de frente para +Z. A conversão é
 * `(x, −y, −z)` — o X fica: a esquerda de quem encara a câmera aparece em +X
 * na imagem, e `hip.L` do boneco também mora em +X quando ele encara +Z.
 *
 * O que os landmarks não contam fica NEUTRO e vira aviso: torção do
 * antebraço (`NEUTRAL_ELBOW_TWIST`), dedos (mão aberta), altura (1,70 m).
 */

export interface RetargetResult {
  /** Boneco completo no formato do app — pronto para `serializeFigurePoseFile`. */
  figure: Figure
  /** O que ficou aproximado ou neutro; a CLI imprime em vez de calar. */
  warnings: string[]
}

/** Abaixo disso o MediaPipe está chutando o ponto (ocluso/fora do quadro). */
const VISIBILITY_MIN = 0.5

function toApp(landmark: PoseLandmark): THREE.Vector3 {
  return new THREE.Vector3(landmark.x, -landmark.y, -landmark.z)
}

type Landmarks = readonly PoseLandmark[]

function landmarkVisible(landmarks: Landmarks, index: number): boolean {
  const landmark = landmarks[index]
  if (!landmark) return false
  return landmark.visibility === undefined || landmark.visibility >= VISIBILITY_MIN
}

function landmarkPoint(landmarks: Landmarks, index: number): THREE.Vector3 | null {
  return landmarkVisible(landmarks, index) ? toApp(landmarks[index]) : null
}

/** Um braço ou uma perna: a cadeia raiz-do-membro → dobradiça → extremidade. */
function solveLimb(
  solve: Solve,
  warnings: string[],
  landmarks: Landmarks,
  chain: {
    rootJoint: string
    hingeJoint: string
    rootLm: number
    hingeLm: number
    endLm: number
    hingeSign: 1 | -1
    /** Torção neutra a gravar na dobradiça (cotovelos); ausente = 0 (joelhos). */
    hingeTwistDeg?: number
    labelKey: string
  },
): boolean {
  const root = landmarkPoint(landmarks, chain.rootLm)
  const hinge = landmarkPoint(landmarks, chain.hingeLm)
  const end = landmarkPoint(landmarks, chain.endLm)
  if (!root || !hinge || !end) {
    commit(solve, chain.rootJoint, {})
    commit(solve, chain.hingeJoint, { y: chain.hingeTwistDeg ?? 0 })
    warnings.push(`${chain.labelKey}: landmarks ocultos — membro deixado neutro.`)
    return false
  }

  solveLimbFromPoints(solve, chain, root, hinge, end)
  return true
}

/** Punho: flexão (X) e desvio (Z) a partir do meio da mão (índice+mindinho); a torção mora no cotovelo. */
function solveWrist(solve: Solve, landmarks: Landmarks, jointName: string, wristLm: number, indexLm: number, pinkyLm: number): void {
  const wrist = landmarkPoint(landmarks, wristLm)
  const index = landmarkPoint(landmarks, indexLm)
  const pinky = landmarkPoint(landmarks, pinkyLm)
  if (!wrist || !index || !pinky) {
    commit(solve, jointName, {})
    return
  }

  const hand = midpoint(index, pinky).sub(wrist)
  if (hand.lengthSq() < 1e-8) {
    commit(solve, jointName, {})
    return
  }

  // R = Rx·Rz sobre (0,−1,0) dá (sin γ, −cos γ·cos θ, −cos γ·sin θ):
  // γ (desvio, Z) sai do X observado e θ (flexão, X) do plano Y–Z.
  const direction = directionInPreFrame(solve, jointName, hand)
  const gamma = Math.asin(THREE.MathUtils.clamp(direction.x, -1, 1))
  const theta = Math.atan2(-direction.z, -direction.y)
  commit(solve, jointName, {
    x: THREE.MathUtils.radToDeg(theta),
    z: THREE.MathUtils.radToDeg(gamma),
  })
}

/**
 * Converte os 33 world landmarks de UMA pessoa num boneco do app. Devolve
 * `null` quando o mínimo estrutural (quadris + ombros) não está visível.
 */
export function retargetPose(
  worldLandmarks: readonly PoseLandmark[],
  options: { name?: string } = {},
): RetargetResult | null {
  const lHip = landmarkPoint(worldLandmarks, BLAZEPOSE.leftHip)
  const rHip = landmarkPoint(worldLandmarks, BLAZEPOSE.rightHip)
  const lShoulder = landmarkPoint(worldLandmarks, BLAZEPOSE.leftShoulder)
  const rShoulder = landmarkPoint(worldLandmarks, BLAZEPOSE.rightShoulder)
  if (!lHip || !rHip || !lShoulder || !rShoulder) return null

  const hipCenter = midpoint(lHip, rHip)
  const shoulderCenter = midpoint(lShoulder, rShoulder)
  const up = shoulderCenter.clone().sub(hipCenter)
  if (up.lengthSq() < 1e-8) return null

  const warnings: string[] = []
  const solve: Solve = { pose: {}, world: new Map() }

  // Raiz: linha dos quadris (hip.L mora em +X) + prumo do tronco.
  const rootQuat = quatFromAxes(lHip.clone().sub(rHip), up)
  const rotation = radToDegRotation(new THREE.Euler().setFromQuaternion(rootQuat, 'XYZ'))
  solve.world.set('root', rootQuat)

  solveTorso(solve, rootQuat, lShoulder.clone().sub(rShoulder), up)

  // Pescoço e cabeça: prumo das orelhas e direção do nariz.
  const nose = landmarkPoint(worldLandmarks, BLAZEPOSE.nose)
  const lEar = landmarkPoint(worldLandmarks, BLAZEPOSE.leftEar)
  const rEar = landmarkPoint(worldLandmarks, BLAZEPOSE.rightEar)
  if (nose && lEar && rEar) {
    const earMid = midpoint(lEar, rEar)
    solveNeckHead(solve, earMid.clone().sub(shoulderCenter), nose.clone().sub(earMid))
  } else {
    solveNeckHead(solve, null, null)
    warnings.push('cabeça: landmarks ocultos — pescoço e cabeça neutros.')
  }

  // Braços (a torção neutra do antebraço é a do app — DECISOES.md #25).
  solveLimb(solve, warnings, worldLandmarks, {
    rootJoint: 'shoulder.L',
    hingeJoint: 'elbow.L',
    rootLm: BLAZEPOSE.leftShoulder,
    hingeLm: BLAZEPOSE.leftElbow,
    endLm: BLAZEPOSE.leftWrist,
    hingeSign: -1,
    hingeTwistDeg: NEUTRAL_ELBOW_TWIST['elbow.L'],
    labelKey: 'braço esquerdo',
  })
  solveWrist(solve, worldLandmarks, 'wrist.L', BLAZEPOSE.leftWrist, BLAZEPOSE.leftIndex, BLAZEPOSE.leftPinky)
  solveLimb(solve, warnings, worldLandmarks, {
    rootJoint: 'shoulder.R',
    hingeJoint: 'elbow.R',
    rootLm: BLAZEPOSE.rightShoulder,
    hingeLm: BLAZEPOSE.rightElbow,
    endLm: BLAZEPOSE.rightWrist,
    hingeSign: -1,
    hingeTwistDeg: NEUTRAL_ELBOW_TWIST['elbow.R'],
    labelKey: 'braço direito',
  })
  solveWrist(solve, worldLandmarks, 'wrist.R', BLAZEPOSE.rightWrist, BLAZEPOSE.rightIndex, BLAZEPOSE.rightPinky)

  // Pernas + tornozelos.
  solveLimb(solve, warnings, worldLandmarks, {
    rootJoint: 'hip.L',
    hingeJoint: 'knee.L',
    rootLm: BLAZEPOSE.leftHip,
    hingeLm: BLAZEPOSE.leftKnee,
    endLm: BLAZEPOSE.leftAnkle,
    hingeSign: 1,
    labelKey: 'perna esquerda',
  })
  solveLimb(solve, warnings, worldLandmarks, {
    rootJoint: 'hip.R',
    hingeJoint: 'knee.R',
    rootLm: BLAZEPOSE.rightHip,
    hingeLm: BLAZEPOSE.rightKnee,
    endLm: BLAZEPOSE.rightAnkle,
    hingeSign: 1,
    labelKey: 'perna direita',
  })
  const ankles: Array<{ joint: string; ankleLm: number; footLm: number }> = [
    { joint: 'ankle.L', ankleLm: BLAZEPOSE.leftAnkle, footLm: BLAZEPOSE.leftFootIndex },
    { joint: 'ankle.R', ankleLm: BLAZEPOSE.rightAnkle, footLm: BLAZEPOSE.rightFootIndex },
  ]
  const ballRest = new THREE.Vector3(...getJoint('ball.L').position).normalize()
  for (const { joint, ankleLm, footLm } of ankles) {
    const ankle = landmarkPoint(worldLandmarks, ankleLm)
    const foot = landmarkPoint(worldLandmarks, footLm)
    if (!ankle || !foot) {
      commit(solve, joint, {})
      continue
    }
    const direction = directionInPreFrame(solve, joint, foot.clone().sub(ankle))
    commitQuaternion(solve, joint, new THREE.Quaternion().setFromUnitVectors(ballRest, direction))
  }

  // O que os landmarks nunca contam — o plano chama de "rascunho de pose".
  warnings.push(
    'altura padrão de 1,70 m — landmarks monoculares não dão a estatura com confiança.',
    'torção do antebraço, dedos e detalhe da coluna ficam neutros: refine no editor.',
  )

  const figure: Figure = {
    id: 'figure-1',
    name: options.name ?? 'Pose importada',
    color: '#e04040',
    visible: true,
    height: 1.7,
    rotation,
    pose: solve.pose,
    position: [0, seatOnGround(solve.pose, rotation), 0],
  }

  return { figure, warnings }
}
