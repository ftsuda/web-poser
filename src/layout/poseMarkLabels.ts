import type { PoseMarkKey } from '../pose-import/markedPose'

/**
 * Chaves de i18n dos pontos de marcação da foto de referência — fora do
 * `markedPose.ts` porque nomes de junta com ponto (`shoulder.L`) viram
 * aninhamento no i18next; aqui a chave é achatada (`shoulderL`). Mesmo padrão
 * do `posePresetLabels.ts`: uma fonte só, usada pelo overlay e pelos painéis
 * das duas cascas.
 */
export const POSE_MARK_LABEL_KEYS: Record<PoseMarkKey, string> = {
  head: 'poses.photo.marks.head',
  nose: 'poses.photo.marks.nose',
  neck: 'poses.photo.marks.neck',
  chest: 'poses.photo.marks.chest',
  'shoulder.L': 'poses.photo.marks.shoulderL',
  'shoulder.R': 'poses.photo.marks.shoulderR',
  'elbow.L': 'poses.photo.marks.elbowL',
  'elbow.R': 'poses.photo.marks.elbowR',
  'wrist.L': 'poses.photo.marks.wristL',
  'wrist.R': 'poses.photo.marks.wristR',
  'hip.L': 'poses.photo.marks.hipL',
  'hip.R': 'poses.photo.marks.hipR',
  'knee.L': 'poses.photo.marks.kneeL',
  'knee.R': 'poses.photo.marks.kneeR',
  'ankle.L': 'poses.photo.marks.ankleL',
  'ankle.R': 'poses.photo.marks.ankleR',
  'foot.L': 'poses.photo.marks.footL',
  'foot.R': 'poses.photo.marks.footR',
}
