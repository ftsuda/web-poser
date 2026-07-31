import type { ReactNode } from 'react'
import type { SectionKey } from '../persistence/uiPreferences'
import { useUIStore } from '../store/uiStore'

/**
 * Seção recolhível DENTRO de um painel (pedido do usuário, 2026-07-31). Os
 * três painéis grandes — animação, propriedades e câmera — empilham blocos que
 * se usam de vez em quando (trechos prontos, biblioteca, simetria, movimento
 * de câmera) na frente do que se usa o tempo todo. Recolhidos, eles somam uma
 * linha cada.
 *
 * **Não é o `CollapsiblePanel`.** Aquele é o envelope da COLUNA: recolhe o
 * painel inteiro, encolhe a coluna e libera espaço para o viewport. Este é um
 * bloco interno: o painel continua aberto, e o que recolhe é um assunto dele.
 *
 * O estado persiste em `localStorage` junto das preferências de painel
 * (`uiPreferences.ts`): abrir "Trechos prontos" toda sessão seria pior do que
 * o problema que a seção resolve.
 *
 * O triângulo fica `aria-hidden`: quem lê a tela já ouve o estado pelo
 * `aria-expanded`, e sem isso o nome acessível do botão viraria "▸ Trechos
 * prontos" — um rótulo que muda de texto ao ser clicado.
 */
interface CollapsibleSectionProps {
  sectionKey: SectionKey
  /** Título já traduzido — vira o rótulo do botão e o nome acessível do bloco. */
  title: string
  children: ReactNode
}

export function CollapsibleSection({ sectionKey, title, children }: CollapsibleSectionProps) {
  const collapsed = useUIStore((state) => state.collapsedSections[sectionKey])
  const toggleSection = useUIStore((state) => state.toggleSection)

  return (
    <section
      className={`panel-section${collapsed ? ' panel-section--collapsed' : ''}`}
      aria-label={title}
    >
      <button
        type="button"
        className="panel-section__toggle"
        aria-expanded={!collapsed}
        onClick={() => toggleSection(sectionKey)}
      >
        <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span> {title}
      </button>

      {!collapsed && <div className="panel-section__body">{children}</div>}
    </section>
  )
}
