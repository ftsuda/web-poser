import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useUIStore } from '../store/uiStore'

/**
 * A caixa modal dos painéis: `<dialog>` nativo, com título, Escape que cancela
 * e o aviso ao `uiStore` de que há um modal aberto (os atalhos globais ficam
 * calados enquanto ele está na tela).
 *
 * Nasceu ao mover a confirmação de "Regravar" para fora do card (pedido do
 * usuário, 2026-07-31): eram três diálogos com a mesma dança de `showModal`,
 * `close` e Escape — a de importar animação, a de regravar e a de carimbar a
 * câmera. O que muda de um para outro é só o conteúdo.
 *
 * **A modalidade é do navegador.** `showModal` dá foco preso e `::backdrop` de
 * verdade; o jsdom (DECISOES.md #29) não implementa nenhum dos dois, e lá o
 * `open` do JSX já basta para o diálogo existir na árvore. Um só caminho de
 * código, os dois ambientes atendidos — e é por isso que o Escape é tratado à
 * mão também: sem modalidade real, o `onCancel` do `<dialog>` não dispara.
 */
interface ModalDialogProps {
  /** Título da caixa — vira o `<h2>` e o rótulo acessível do diálogo. */
  title: string
  /** Classe própria da caixa, para o que é específico daquele diálogo. */
  className?: string
  onCancel: () => void
  children: ReactNode
}

export function ModalDialog({ title, className, onCancel, children }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const setModalOpen = useUIStore((state) => state.setModalOpen)

  useEffect(() => {
    setModalOpen(true)
    return () => setModalOpen(false)
  }, [setModalOpen])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || typeof dialog.showModal !== 'function') return
    if (dialog.open) dialog.close()
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  // `stopPropagation` impede que a mesma tecla escape para os atalhos globais.
  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    event.preventDefault()
    onCancel()
  }

  return (
    <dialog
      open
      ref={dialogRef}
      className={`modal-dialog${className ? ` ${className}` : ''}`}
      aria-label={title}
      onCancel={onCancel}
      onKeyDown={handleKeyDown}
    >
      <h2 className="modal-dialog__title">{title}</h2>
      {children}
    </dialog>
  )
}
