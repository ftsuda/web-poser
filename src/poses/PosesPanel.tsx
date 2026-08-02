import { useTranslation } from 'react-i18next'
import { POSES_TAB_KEYS, usePosesShellStore } from '../store/posesShellStore'
import { PosesFiguresTab } from './PosesFiguresTab'
import { PosesFileTab } from './PosesFileTab'
import { PosesJointTab } from './PosesJointTab'
import { PosesKeyframesTab } from './PosesKeyframesTab'
import { PosesSymmetryTab } from './PosesSymmetryTab'

/**
 * O painel de controle do módulo de poses, em ABAS — a barra única não
 * caberia (PLANO.md, item 44). Fica embaixo em tela vertical e à direita em
 * tela horizontal (decisão do usuário) — quem decide é o CSS
 * (`poses.css`, media query de orientação), não este componente.
 */
export function PosesPanel() {
  const { t } = useTranslation()
  const activeTab = usePosesShellStore((state) => state.activeTab)
  const setActiveTab = usePosesShellStore((state) => state.setActiveTab)

  return (
    <div className="poses-panel">
      <div className="poses-panel__content">
        {activeTab === 'joint' && <PosesJointTab />}
        {activeTab === 'symmetry' && <PosesSymmetryTab />}
        {activeTab === 'figures' && <PosesFiguresTab />}
        {activeTab === 'keyframes' && <PosesKeyframesTab />}
        {activeTab === 'file' && <PosesFileTab />}
      </div>
      <nav className="poses-panel__tabs" aria-label={t('poses.title')}>
        {POSES_TAB_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className="poses-panel__tab"
            aria-pressed={activeTab === key}
            onClick={() => setActiveTab(key)}
          >
            {t(`poses.tabs.${key}`)}
          </button>
        ))}
      </nav>
    </div>
  )
}
