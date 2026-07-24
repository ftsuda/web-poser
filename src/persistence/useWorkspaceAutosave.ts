import { useEffect, useRef } from 'react'
import { useFiguresStore } from '../store/figuresStore'
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
      timeoutRef.current = setTimeout(() => saveWorkspaceToLocalStorage(state), AUTOSAVE_DEBOUNCE_MS)
    })

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      unsubscribe()
    }
  }, [])
}
