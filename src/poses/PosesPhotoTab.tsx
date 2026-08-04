import { useTranslation } from 'react-i18next'
import { ReferencePhotoControls } from '../layout/ReferencePhotoControls'

/**
 * Aba "Foto" do módulo de poses: a foto de referência e a marcação de pose
 * (item 7 + PLANO.md > "Pose por marcação manual"). Os controles são os
 * MESMOS do desktop (`ReferencePhotoControls`) — o overlay que desenha a foto
 * e recebe os toques mora na casca (`PosesShell`), sobre o viewport.
 */
export function PosesPhotoTab() {
  const { t } = useTranslation()

  return (
    <div className="poses-tab">
      <p className="poses-tab__hint">{t('poses.photo.tabHint')}</p>
      <ReferencePhotoControls />
    </div>
  )
}
