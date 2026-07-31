import { useTranslation } from 'react-i18next'
import { ModalDialog } from './ModalDialog'

/**
 * Confirmação em caixa modal para as ações que um clique não desfaz — regravar
 * um keyframe (DECISOES.md #69) e limpar a animação de trabalho.
 *
 * **Por que fora do card.** A confirmação de "Regravar" nasceu EM LINHA, na
 * primeira fila de botões do keyframe: o aviso vermelho aparecia no meio de uma
 * lista de cards iguais, colado nos botões dos keyframes VIZINHOS, que
 * continuavam clicáveis — justamente o clique indevido de que ela deveria
 * proteger. Num modal, o aviso é a única coisa na tela e o clique seguinte só
 * pode ser confirmar ou cancelar.
 *
 * Como o que originou o clique sai de vista, `detail` repete em uma linha o que
 * será afetado (o número e o instante do keyframe, o nome da animação).
 */
interface ConfirmDialogProps {
  title: string
  /** Linha que identifica o alvo — o card/objeto que originou o clique não está mais à vista. */
  detail?: string
  /** O que a ação faz de irreversível, em uma frase. */
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** Classe própria da caixa (largura), quando o diálogo precisar de uma. */
  className?: string
}

export function ConfirmDialog({
  title,
  detail,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  className = 'confirm-dialog',
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  return (
    <ModalDialog title={title} className={className} onCancel={onCancel}>
      {detail && <p className="animation-import__summary">{detail}</p>}

      <p className="animation-panel__hint animation-panel__hint--warning">{message}</p>

      <div className="animation-import__actions">
        <button type="button" className="animation-panel__confirm" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel}>
          {t('panels.animation.updateCancel')}
        </button>
      </div>
    </ModalDialog>
  )
}
