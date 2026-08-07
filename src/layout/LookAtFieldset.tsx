import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { applyLookAt, type LookAtTarget } from '../figure/lookAtActions'
import { useFiguresStore } from '../store/figuresStore'

/**
 * "Olhar para" (PLANO.md item 32, `DECISOES.md` #123): mira cabeça e pescoço na
 * câmera de cena ou em outro boneco.
 *
 * Aparece nos DOIS ramos do painel de Propriedades — com a raiz selecionada e
 * com uma junta selecionada —, como o "assentar no chão" e a seção de simetria.
 * O motivo é o mesmo: é ação do BONECO, e quem está posando um cotovelo não
 * deveria ter de voltar à raiz só para virar a cabeça.
 *
 * Fieldset simples, e não seção recolhível: o item o descreve como o gesto mais
 * repetido ao montar cena com dois bonecos, e uma seção que nasce recolhida
 * (#83) cobraria um clique a mais toda vez.
 */
interface LookAtFieldsetProps {
  figureId: string
}

const SCENE_CAMERA_VALUE = 'scene-camera'

export function LookAtFieldset({ figureId }: LookAtFieldsetProps) {
  const { t } = useTranslation()
  const figures = useFiguresStore((state) => state.figures)
  const [choice, setChoice] = useState(SCENE_CAMERA_VALUE)

  // Só outros bonecos VISÍVEIS: mirar num boneco escondido daria uma direção
  // que ninguém consegue conferir na tela.
  const others = figures.filter((figure) => figure.id !== figureId && figure.visible)

  const handleLook = () => {
    const target: LookAtTarget =
      choice === SCENE_CAMERA_VALUE ? { kind: 'sceneCamera' } : { kind: 'figure', figureId: choice }
    applyLookAt(figureId, target)
  }

  return (
    <fieldset className="properties-panel__look-at">
      <legend>{t('panels.properties.lookAt')}</legend>

      <label htmlFor="look-at-target" className="properties-panel__field">
        {t('panels.properties.lookAtTarget')}
        <select
          id="look-at-target"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value={SCENE_CAMERA_VALUE}>{t('panels.properties.lookAtCamera')}</option>
          {others.map((figure) => (
            <option key={figure.id} value={figure.id}>
              {figure.name}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="panel-action" onClick={handleLook}>
        {t('panels.properties.lookAtApply')}
      </button>

      <p className="properties-panel__hint">{t('panels.properties.lookAtHint')}</p>
    </fieldset>
  )
}
