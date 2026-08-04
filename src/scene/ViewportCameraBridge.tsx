import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { activeViewportCamera } from './viewportViewBasis'

/**
 * A ponte entre o `<Canvas>` ativo e a UI de marcação da foto de referência:
 * registra a câmera viva em `viewportViewBasis.activeViewportCamera`. Montar
 * dentro do `<Canvas>` (desktop e módulo de poses). Não renderiza nada.
 */
export function ViewportCameraBridge() {
  const camera = useThree((state) => state.camera)
  useEffect(() => {
    activeViewportCamera.current = camera
    return () => {
      if (activeViewportCamera.current === camera) activeViewportCamera.current = null
    }
  }, [camera])
  return null
}
