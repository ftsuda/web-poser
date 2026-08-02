import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMirrorScope } from '../figure/poseMirror'
import { ROOT_JOINT_NAME } from '../figure/skeleton'
import { useFiguresStore } from '../store/figuresStore'

/**
 * Aba "Simetria": os mesmos gestos do painel de Propriedades do desktop
 * (`mirrorSide`, `swapSides`, `mirrorWholeFigure`, espelho ao vivo). Desde o
 * item 59 também com ESCOPO: boneco inteiro ou a partir da junta selecionada
 * — o mesmo `scopeJoint` do desktop (#34), sem rotina nova. O espelho
 * completo e o ao vivo ignoram o escopo, como lá.
 */
export function PosesSymmetryTab() {
  const { t } = useTranslation()
  const figures = useFiguresStore((state) => state.figures)
  const selectedFigureId = useFiguresStore((state) => state.selectedFigureId)
  const selectedJointName = useFiguresStore((state) => state.selectedJointName)
  const liveMirrorEnabled = useFiguresStore((state) => state.liveMirrorEnabled)
  const mirrorSide = useFiguresStore((state) => state.mirrorSide)
  const swapSides = useFiguresStore((state) => state.swapSides)
  const mirrorWholeFigure = useFiguresStore((state) => state.mirrorWholeFigure)
  const toggleLiveMirror = useFiguresStore((state) => state.toggleLiveMirror)

  const [scopeChoice, setScopeChoice] = useState<'whole' | 'joint'>('whole')

  const figure = figures.find((candidate) => candidate.id === selectedFigureId) ?? null
  if (!figure) {
    return <p className="poses-tab__empty">{t('poses.joint.noFigure')}</p>
  }

  // A opção "da junta selecionada" só vale com uma junta não-raiz que tenha
  // par no escopo (com a cabeça selecionada não há o que espelhar).
  const jointScopeValid =
    selectedJointName !== null &&
    selectedJointName !== ROOT_JOINT_NAME &&
    getMirrorScope(selectedJointName).length > 0
  const scopeJoint = scopeChoice === 'joint' && jointScopeValid ? selectedJointName : null

  return (
    <div className="poses-tab">
      <label className="poses-tab__field">
        {t('poses.symmetry.scope')}
        <select
          value={scopeChoice === 'joint' && jointScopeValid ? 'joint' : 'whole'}
          onChange={(event) => setScopeChoice(event.target.value === 'joint' ? 'joint' : 'whole')}
        >
          <option value="whole">{t('poses.symmetry.scopeWhole')}</option>
          <option value="joint" disabled={!jointScopeValid}>
            {jointScopeValid
              ? t('poses.symmetry.scopeJoint', { name: selectedJointName })
              : t('poses.symmetry.scopeJointUnavailable')}
          </option>
        </select>
      </label>

      <div className="panel-actions">
        <button type="button" onClick={() => mirrorSide(figure.id, 'L', scopeJoint)}>
          {t('poses.symmetry.mirrorLtoR')}
        </button>
        <button type="button" onClick={() => mirrorSide(figure.id, 'R', scopeJoint)}>
          {t('poses.symmetry.mirrorRtoL')}
        </button>
        <button type="button" onClick={() => swapSides(figure.id, scopeJoint)}>
          {t('poses.symmetry.swapSides')}
        </button>
        <button type="button" onClick={() => mirrorWholeFigure(figure.id)}>
          {t('poses.symmetry.mirrorWhole')}
        </button>
      </div>
      <label className="poses-tab__toggle">
        <input type="checkbox" checked={liveMirrorEnabled} onChange={() => toggleLiveMirror()} />
        <span>{t('poses.symmetry.liveMirror')}</span>
      </label>
    </div>
  )
}
