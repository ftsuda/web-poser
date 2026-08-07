import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModalDialog } from './ModalDialog'

/**
 * Quem recebe a cópia vinda do keyframe vizinho (pedido do usuário,
 * 2026-08-06). "Pose ↑↓" e "Pos ↑↓" copiavam sempre o elenco inteiro; numa cena
 * de duas ou mais pessoas, acertar a deriva de UMA arrastava as outras junto.
 *
 * Só aparece com dois bonecos ou mais em cena (decisão do usuário): com um só
 * não há o que escolher, e o clique continua direto. A lista vem de
 * `sharedKeyframeFigures` — quem existe nos DOIS keyframes, os únicos que a
 * cópia consegue afetar.
 */
interface CopyFiguresDialogProps {
  /** Linha que identifica o keyframe de destino — o card sai de vista. */
  detail: string
  /** O que vai ser copiado, e de qual vizinho: a dica do próprio botão. */
  summary: string
  figures: readonly { id: string; name: string }[]
  /** Ids marcados ao abrir — a escolha anterior da sessão, ou todos. */
  initialIds: readonly string[]
  /**
   * Título e rótulo do botão, para a POSE MÉDIA reusar a mesma caixa
   * (2026-08-07): a pergunta é idêntica — "em quais bonecos?" —, e um segundo
   * componente de caixas seria a mesma tela escrita duas vezes. O padrão é o
   * texto da cópia entre vizinhos, que é de onde a caixa veio.
   */
  title?: string
  confirmLabel?: string
  onConfirm: (figureIds: string[]) => void
  onCancel: () => void
}

export function CopyFiguresDialog({
  detail,
  summary,
  figures,
  initialIds,
  title,
  confirmLabel,
  onConfirm,
  onCancel,
}: CopyFiguresDialogProps) {
  const { t } = useTranslation()

  const [checked, setChecked] = useState<string[]>(() =>
    figures.filter((figure) => initialIds.includes(figure.id)).map((figure) => figure.id),
  )

  return (
    <ModalDialog
      title={title ?? t('panels.animation.copyFiguresTitle')}
      className="copy-figures"
      onCancel={onCancel}
    >
      <p className="animation-import__summary">{detail}</p>
      <p className="animation-panel__hint">{summary}</p>

      {figures.length === 0 ? (
        <p className="animation-panel__hint animation-panel__hint--warning">
          {t('panels.animation.copyFiguresNone')}
        </p>
      ) : (
        <fieldset className="animation-panel__clip-figures">
          <legend>{t('panels.animation.copyFiguresLegend')}</legend>
          {figures.map((figure) => (
            <label key={figure.id} className="animation-panel__clip-figure">
              <input
                type="checkbox"
                checked={checked.includes(figure.id)}
                onChange={(event) =>
                  setChecked(
                    event.target.checked
                      ? [...checked, figure.id]
                      : checked.filter((id) => id !== figure.id),
                  )
                }
              />
              {figure.name}
            </label>
          ))}
          {checked.length === 0 && (
            <p className="animation-panel__hint">{t('panels.animation.clipNeedsFigure')}</p>
          )}
        </fieldset>
      )}

      <div className="animation-import__actions">
        <button
          type="button"
          className="animation-panel__confirm"
          disabled={checked.length === 0}
          onClick={() => onConfirm(checked)}
        >
          {confirmLabel ?? t('panels.animation.copyFiguresConfirm')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('panels.animation.updateCancel')}
        </button>
      </div>
    </ModalDialog>
  )
}
