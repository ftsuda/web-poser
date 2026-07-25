import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PanelKey } from '../persistence/uiPreferences'
import { useUIStore } from '../store/uiStore'

export interface CollapsiblePanelProps {
  panelKey: PanelKey
  /** Classe modificadora do painel (ex.: `panel--figures`), como antes da fase 9. */
  className: string
  /** Título já traduzido — vira o `aria-label` do `aside` e o `h2` do cabeçalho. */
  title: string
  children: ReactNode
}

/**
 * Envelope comum dos cinco painéis laterais, com o botão de recolher/expandir
 * da fase 9 (item 8). Recolhido, o painel some do fluxo de leitura (só o
 * cabeçalho continua no DOM) e a coluna encolhe para uma faixa fina, liberando
 * espaço para o viewport. O estado é persistido em `localStorage` pelo
 * `uiStore` (ver `uiPreferences.ts`).
 */
export function CollapsiblePanel({ panelKey, className, title, children }: CollapsiblePanelProps) {
  const { t } = useTranslation()
  const collapsed = useUIStore((state) => state.collapsedPanels[panelKey])
  const togglePanel = useUIStore((state) => state.togglePanel)

  const toggleLabel = collapsed ? t('panels.expand', { title }) : t('panels.collapse', { title })

  return (
    <aside
      className={`panel ${className}${collapsed ? ' panel--collapsed' : ''}`}
      aria-label={title}
    >
      <div className="panel__header">
        <h2>{title}</h2>
        <button
          type="button"
          className="panel__collapse-toggle"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          onClick={() => togglePanel(panelKey)}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && children}
    </aside>
  )
}
