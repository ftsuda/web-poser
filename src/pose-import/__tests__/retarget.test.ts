import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildJointFrames } from '../../figure/jointFrames'
import { resolvePosePreset, NEUTRAL_ELBOW_TWIST } from '../../figure/posePresets'
import { parseFigurePoseFile, serializeFigurePoseFile } from '../../persistence/figurePoseFile'
import type { Figure } from '../../store/figuresStore'
import { BLAZEPOSE, type PoseLandmark } from '../blazepose'
import { retargetPose } from '../retarget'

/**
 * O núcleo de retargeting (PLANO.md > "MCP de análise de pose", etapa 1 — "é
 * aqui que mora o risco"). A estratégia de teste é ida-e-volta pela cinemática
 * direta DO PRÓPRIO APP: uma pose conhecida vira landmarks sintéticos do
 * BlazePose (posições de mundo das juntas, convertidas para o espaço do
 * MediaPipe), e o retargeting tem de recuperar os ângulos que a geraram — nos
 * DOFs que landmarks conseguem contar. Uma fonte de verdade só: se o esqueleto
 * mudar, a fixture muda junto.
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

/**
 * Landmarks sintéticos: posições de mundo das juntas equivalentes aos 33
 * pontos do BlazePose, no espaço do MediaPipe (y para baixo, z para a câmera,
 * origem no centro dos quadris — a conversão de volta é a que o retarget faz).
 */
function landmarksFromFigure(figure: Figure): PoseLandmark[] {
  const { joints } = buildJointFrames(figure)
  const world = (name: string, local: [number, number, number] = [0, 0, 0]): THREE.Vector3 =>
    new THREE.Vector3(...local).applyMatrix4(joints.get(name)!.matrixWorld)

  const points = new Map<number, THREE.Vector3>()
  points.set(BLAZEPOSE.leftShoulder, world('shoulder.L'))
  points.set(BLAZEPOSE.rightShoulder, world('shoulder.R'))
  points.set(BLAZEPOSE.leftElbow, world('elbow.L'))
  points.set(BLAZEPOSE.rightElbow, world('elbow.R'))
  points.set(BLAZEPOSE.leftWrist, world('wrist.L'))
  points.set(BLAZEPOSE.rightWrist, world('wrist.R'))
  // Meio da mão: índice e mindinho caem os dois na base dos dedos.
  points.set(BLAZEPOSE.leftIndex, world('fingersBase.L'))
  points.set(BLAZEPOSE.leftPinky, world('fingersBase.L'))
  points.set(BLAZEPOSE.rightIndex, world('fingersBase.R'))
  points.set(BLAZEPOSE.rightPinky, world('fingersBase.R'))
  points.set(BLAZEPOSE.leftHip, world('hip.L'))
  points.set(BLAZEPOSE.rightHip, world('hip.R'))
  points.set(BLAZEPOSE.leftKnee, world('knee.L'))
  points.set(BLAZEPOSE.rightKnee, world('knee.R'))
  points.set(BLAZEPOSE.leftAnkle, world('ankle.L'))
  points.set(BLAZEPOSE.rightAnkle, world('ankle.R'))
  points.set(BLAZEPOSE.leftHeel, world('ankle.L'))
  points.set(BLAZEPOSE.rightHeel, world('ankle.R'))
  points.set(BLAZEPOSE.leftFootIndex, world('ball.L'))
  points.set(BLAZEPOSE.rightFootIndex, world('ball.R'))
  points.set(BLAZEPOSE.nose, world('head', [0, 0.05, 0.12]))
  points.set(BLAZEPOSE.leftEar, world('head', [0.07, 0.03, 0]))
  points.set(BLAZEPOSE.rightEar, world('head', [-0.07, 0.03, 0]))

  const hipCenter = world('hip.L').add(world('hip.R')).multiplyScalar(0.5)
  const landmarks: PoseLandmark[] = []
  for (let index = 0; index < 33; index += 1) {
    const point = points.get(index)
    if (!point) {
      // Pontos do rosto que o núcleo não usa: copiam o nariz.
      const nose = points.get(BLAZEPOSE.nose)!
      landmarks.push({ x: nose.x - hipCenter.x, y: -(nose.y - hipCenter.y), z: -(nose.z - hipCenter.z), visibility: 1 })
      continue
    }
    landmarks.push({
      x: point.x - hipCenter.x,
      y: -(point.y - hipCenter.y),
      z: -(point.z - hipCenter.z),
      visibility: 1,
    })
  }
  return landmarks
}

function retargetFigure(figure: Figure) {
  const result = retargetPose(landmarksFromFigure(figure))
  expect(result).not.toBeNull()
  return result!
}

describe('retargetPose — ida-e-volta pela cinemática do app', () => {
  it('em pé neutro volta em pé neutro (tronco, braços e pernas perto de zero)', () => {
    const { figure } = retargetFigure(makeFigure())

    for (const joint of ['shoulder.L', 'shoulder.R', 'hip.L', 'hip.R', 'knee.L', 'knee.R', 'spine', 'chest']) {
      const rotation = figure.pose[joint] ?? { x: 0, y: 0, z: 0 }
      expect(Math.abs(rotation.x), `${joint}.x`).toBeLessThan(4)
      expect(Math.abs(rotation.z), `${joint}.z`).toBeLessThan(4)
    }
    expect(Math.abs(figure.pose['elbow.L']?.x ?? 0)).toBeLessThan(4)
    expect(Math.abs(figure.rotation.y)).toBeLessThan(4)
  })

  it('T-pose recupera os ombros a ±90° em Z', () => {
    const { figure } = retargetFigure(makeFigure({ pose: resolvePosePreset('tpose') }))

    expect(figure.pose['shoulder.L'].z).toBeCloseTo(90, 0)
    expect(figure.pose['shoulder.R'].z).toBeCloseTo(-90, 0)
  })

  it('braço dobrado recupera a flexão do cotovelo e o ombro que a orienta', () => {
    const pose = {
      ...resolvePosePreset('standing'),
      'shoulder.L': { x: 0, y: 0, z: 60 },
      'elbow.L': { x: -70, y: NEUTRAL_ELBOW_TWIST['elbow.L']!, z: 0 },
    }
    const { figure } = retargetFigure(makeFigure({ pose }))

    expect(figure.pose['elbow.L'].x).toBeCloseTo(-70, 0)
    // O ombro pode redistribuir entre eixos (a decomposição não é única), mas o
    // PONTO DO COTOVELO tem de bater: conferimos pela cinemática direta.
    const expected = buildJointFrames(makeFigure({ pose }))
      .joints.get('elbow.L')!
      .getWorldPosition(new THREE.Vector3())
    const actual = buildJointFrames(figure).joints.get('elbow.L')!.getWorldPosition(new THREE.Vector3())
    expect(actual.distanceTo(expected)).toBeLessThan(0.03)
  })

  it('agachamento recupera quadris e joelhos', () => {
    const pose = {
      ...resolvePosePreset('standing'),
      'hip.L': { x: -70, y: 0, z: 0 },
      'hip.R': { x: -70, y: 0, z: 0 },
      'knee.L': { x: 90, y: 0, z: 0 },
      'knee.R': { x: 90, y: 0, z: 0 },
    }
    const { figure } = retargetFigure(makeFigure({ pose }))

    for (const side of ['L', 'R'] as const) {
      expect(figure.pose[`hip.${side}`].x).toBeCloseTo(-70, 0)
      expect(figure.pose[`knee.${side}`].x).toBeCloseTo(90, 0)
    }
  })

  it('boneco girado de costas recupera a rotação da raiz', () => {
    const { figure } = retargetFigure(makeFigure({ rotation: { x: 0, y: 90, z: 0 } }))
    expect(figure.rotation.y).toBeCloseTo(90, 0)
  })

  it('o que os landmarks não contam fica NEUTRO: torção do cotovelo e dedos', () => {
    const { figure, warnings } = retargetFigure(makeFigure())

    expect(figure.pose['elbow.L'].y).toBe(NEUTRAL_ELBOW_TWIST['elbow.L'])
    expect(figure.pose['elbow.R'].y).toBe(NEUTRAL_ELBOW_TWIST['elbow.R'])
    // Dedos neutros (mão aberta): sem rotação gravada fora de zero.
    expect(figure.pose['fingersBase.L']?.x ?? 0).toBe(0)
    expect(figure.pose['thumb1.L']?.z ?? 0).toBe(0)
    // E o núcleo avisa o que aproximou (altura, torções) em vez de calar.
    expect(warnings.length).toBeGreaterThan(0)
  })

  it('a pose recuperada nasce assentada no chão e dentro dos limites', () => {
    const { figure } = retargetFigure(makeFigure())

    expect(figure.position[1]).toBeGreaterThanOrEqual(-1e-9)
    expect(figure.position[1]).toBeLessThan(1.2)
    expect(figure.height).toBeCloseTo(1.7, 6)
  })

  it('o resultado atravessa o arquivo de pose do app (leitor único)', () => {
    const { figure } = retargetFigure(makeFigure({ pose: resolvePosePreset('tpose') }))
    const imported = parseFigurePoseFile(JSON.parse(serializeFigurePoseFile(figure)))

    expect(imported).not.toBeNull()
    expect(imported!.pose['shoulder.L'].z).toBeCloseTo(figure.pose['shoulder.L'].z, 5)
  })

  it('sem landmarks utilizáveis, devolve null', () => {
    expect(retargetPose([])).toBeNull()
    const invisible = landmarksFromFigure(makeFigure()).map((point) => ({ ...point, visibility: 0 }))
    expect(retargetPose(invisible)).toBeNull()
  })
})
