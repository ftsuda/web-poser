/**
 * O contrato do BlazePose (MediaPipe Pose Landmarker): 33 landmarks por
 * pessoa, indexados por posição fixa. Este módulo é só o vocabulário — quem
 * converte landmark em rotação é o `retarget.ts`.
 *
 * Espaço dos WORLD landmarks do MediaPipe: metros, origem no centro dos
 * quadris, X para a direita DA IMAGEM (= esquerda de quem está de frente para
 * a câmera), Y para BAIXO, Z na direção da câmera (negativo = mais perto).
 * O app é y-para-cima com o boneco de frente para +Z — a conversão
 * `(x, −y, −z)` mora no retarget.
 */

export interface PoseLandmark {
  x: number
  y: number
  z: number
  /** 0–1; o MediaPipe marca baixa a visibilidade de um ponto ocluso ou fora do quadro. */
  visibility?: number
}

/** Índices oficiais dos 33 pontos — nomes na convenção do MediaPipe. */
export const BLAZEPOSE = {
  nose: 0,
  leftEyeInner: 1,
  leftEye: 2,
  leftEyeOuter: 3,
  rightEyeInner: 4,
  rightEye: 5,
  rightEyeOuter: 6,
  leftEar: 7,
  rightEar: 8,
  mouthLeft: 9,
  mouthRight: 10,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftPinky: 17,
  rightPinky: 18,
  leftIndex: 19,
  rightIndex: 20,
  leftThumb: 21,
  rightThumb: 22,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const

export const BLAZEPOSE_LANDMARK_COUNT = 33
