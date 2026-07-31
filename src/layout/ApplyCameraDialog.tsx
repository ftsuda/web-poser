import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { keyframeStartTimesMs, type AnimationKeyframe } from '../animation/animation'
import { ModalDialog } from './ModalDialog'

/**
 * "Aplicar a câmera atual aos keyframes" (pedido do usuário, 2026-07-31).
 *
 * O gesto que faltava era o de achar um enquadramento e querer ele na animação
 * inteira: sem isto, a única saída era regravar keyframe a keyframe — e
 * regravar troca a POSE junto, o que obriga a passar por "Ir para" antes de
 * cada um. Aqui só a câmera anda.
 *
 * **Com faixa, e não só "todas"** (escolha do usuário): a faixa nasce em 1..n,
 * então o gesto de um clique continua sendo "a animação toda", e quem quer
 * segurar o enquadramento só num trecho aperta os dois combos. Confirma em
 * modal porque um clique reescreve todas as câmeras montadas, e o Ctrl+Z é a
 * única saída — mesma régua da confirmação de "Regravar" (DECISOES.md #69).
 */

/** Segundos com uma casa, como no resto do painel de animação. */
function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

interface ApplyCameraDialogProps {
  keyframes: readonly AnimationKeyframe[]
  onConfirm: (fromIndex: number, toIndex: number) => void
  onCancel: () => void
}

export function ApplyCameraDialog({ keyframes, onConfirm, onCancel }: ApplyCameraDialogProps) {
  const { t } = useTranslation()

  // A faixa padrão é a animação inteira — é o pedido original ("aplicar a
  // todas"), e os combos estão ali para quem quiser menos.
  const [fromIndex, setFromIndex] = useState(0)
  const [toIndex, setToIndex] = useState(Math.max(0, keyframes.length - 1))

  const startTimes = keyframeStartTimesMs({ id: '', name: '', speed: 1, keyframes: [...keyframes] })
  const first = Math.min(fromIndex, toIndex)
  const last = Math.max(fromIndex, toIndex)

  const options = keyframes.map((keyframe, index) => (
    <option key={keyframe.id} value={index}>
      {`${index + 1} — ${formatSeconds(startTimes[index])}`}
    </option>
  ))

  return (
    <ModalDialog title={t('panels.animation.applyCameraTitle')} className="apply-camera" onCancel={onCancel}>
      <p className="animation-import__summary">{t('panels.animation.applyCameraSummary')}</p>

      <label htmlFor="animation-apply-camera-from" className="animation-panel__field">
        {t('panels.animation.applyCameraFrom')}
        <select
          id="animation-apply-camera-from"
          value={fromIndex}
          onChange={(event) => setFromIndex(Number(event.target.value))}
        >
          {options}
        </select>
      </label>

      <label htmlFor="animation-apply-camera-to" className="animation-panel__field">
        {t('panels.animation.applyCameraTo')}
        <select
          id="animation-apply-camera-to"
          value={toIndex}
          onChange={(event) => setToIndex(Number(event.target.value))}
        >
          {options}
        </select>
      </label>

      <p className="animation-panel__hint animation-panel__hint--warning">
        {t('panels.animation.applyCameraWarning', { count: last - first + 1 })}
      </p>

      <div className="animation-import__actions">
        <button
          type="button"
          className="animation-panel__confirm"
          onClick={() => onConfirm(first, last)}
        >
          {t('panels.animation.applyCameraConfirm')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('panels.animation.updateCancel')}
        </button>
      </div>
    </ModalDialog>
  )
}
