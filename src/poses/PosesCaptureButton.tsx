import { useTranslation } from 'react-i18next'
import { DEFAULT_SCENE_CAMERA } from '../scene/cameraMove'
import { useFiguresStore } from '../store/figuresStore'
import { usePosesShellStore } from '../store/posesShellStore'

/**
 * Botão flutuante "capturar keyframe" (PLANO.md, item 44): grava a pose atual
 * como keyframe novo com CÂMERA PADRÃO e duração padrão. Sem câmera de cena
 * no módulo, `addAnimationKeyframe` é chamada direto com o default — o desvio
 * por `pendingCommand` do desktop existe só para ler a câmera VIVA, que aqui
 * não há. O keyframe PRECISA de uma câmera (`sanitizeAnimations` descarta
 * keyframe sem ela), por isso valores padrão, e não campo ausente.
 */
export function PosesCaptureButton() {
  const { t } = useTranslation()
  const figures = useFiguresStore((state) => state.figures)
  const addAnimationKeyframe = useFiguresStore((state) => state.addAnimationKeyframe)
  const setCurrentKeyframeId = usePosesShellStore((state) => state.setCurrentKeyframeId)

  const handleCapture = () => {
    const id = addAnimationKeyframe(null, {
      position: [...DEFAULT_SCENE_CAMERA.position],
      target: [...DEFAULT_SCENE_CAMERA.target],
      up: [...DEFAULT_SCENE_CAMERA.up],
      focalMm: DEFAULT_SCENE_CAMERA.focalMm,
    })
    if (id) setCurrentKeyframeId(id)
  }

  return (
    <button
      type="button"
      className="poses-capture"
      disabled={figures.length === 0}
      aria-label={t('poses.capture')}
      title={t('poses.capture')}
      onClick={handleCapture}
    >
      ●
    </button>
  )
}
