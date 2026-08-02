import { useEffect } from 'react'
import { useWorkspaceAutosave } from '../persistence/useWorkspaceAutosave'
import { PosesCaptureButton } from './PosesCaptureButton'
import { PosesPanel } from './PosesPanel'
import { PosesTopBar } from './PosesTopBar'
import { PosesViewport } from './PosesViewport'
import './poses.css'

/**
 * A casca de TOQUE (item 44) — "Módulo de poses" no vocabulário do usuário:
 * uma segunda casca de UI sobre o mesmo núcleo, desenhada para o dedo e a
 * tela pequena. O objetivo é gerar poses e keyframes; câmera de cena,
 * durações, instantâneos e vídeo continuam sendo trabalho da aplicação
 * completa, e a ponte entre as duas é o JSON de animação (aba "Arquivo").
 *
 * O autosave grava na CHAVE PRÓPRIA do módulo (`resolveAutosaveKey`, decisão
 * do usuário: sessão separada da do desktop) — o hook é o mesmo do desktop, e
 * a chave sai da casca em vigor.
 */
export function PosesShell() {
  useWorkspaceAutosave()

  // Wake Lock: a tela não apaga enquanto se estuda a pose (melhor esforço —
  // a API não existe em todo navegador, e falhar é ficar como estava).
  // RE-PEDIDO ao voltar a ficar visível (item 46): o navegador solta o lock
  // quando a página perde a visibilidade, e um pedido único deixava a tela
  // apagando de novo depois de qualquer troca de aba.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    let disposed = false
    const request = async () => {
      try {
        const wakeLock = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
        const acquired = (await wakeLock?.request('screen')) ?? null
        if (disposed) void acquired?.release()
        else lock = acquired
      } catch {
        // Sem wake lock (navegador sem a API, aba em segundo plano) — segue o jogo.
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibility)
      void lock?.release()
    }
  }, [])

  return (
    <div className="poses-shell">
      <PosesTopBar />
      <main className="poses-shell__viewport">
        <PosesViewport />
        <PosesCaptureButton />
      </main>
      <PosesPanel />
    </div>
  )
}
