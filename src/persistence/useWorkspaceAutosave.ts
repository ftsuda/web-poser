import { useEffect, useRef } from 'react'
import { useFiguresStore } from '../store/figuresStore'
import { useUIStore } from '../store/uiStore'
import { saveWorkspaceToLocalStorage } from './autosave'

/** Espera um breve período sem mudanças antes de gravar, para não escrever em `localStorage` a cada tecla. */
const AUTOSAVE_DEBOUNCE_MS = 800

/**
 * Ativa o autosave contínuo do workspace em `localStorage` — chamado uma
 * única vez em `AppShell` (mesmo padrão de `useKeyboardShortcuts`). Fica
 * fora de `figuresStore.ts` para não disparar gravações em `localStorage`
 * durante os testes do próprio store (que não montam componentes React).
 */
export function useWorkspaceAutosave(): void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    const unsubscribe = useFiguresStore.subscribe((state) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      // Enquanto o debounce corre, o trabalho ainda NÃO está gravado — o
      // indicador da Toolbar (fase 9, item 2) mostra isso em vez de deixar
      // "salvo" na tela por até 800 ms de mentira.
      useUIStore.getState().markAutosavePending()
      timeoutRef.current = setTimeout(() => {
        const saved = saveWorkspaceToLocalStorage(state)
        if (saved) useUIStore.getState().markAutosaveSaved(Date.now())
        else useUIStore.getState().markAutosaveFailed()
      }, AUTOSAVE_DEBOUNCE_MS)
    })

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      unsubscribe()
    }
  }, [])
}
