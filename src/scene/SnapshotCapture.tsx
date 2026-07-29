import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { formatSnapshotFilename } from '../snapshot/snapshotNaming'
import { writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { useFiguresStore } from '../store/figuresStore'
import { useSnapshotCaptureStore } from '../store/snapshotCaptureStore'
import { hideSceneOverlays, renderAtResolution } from './sceneCapture'

/**
 * Componente sem visual (`return null`) dentro do `<Canvas>` que executa a
 * captura real de PNG sob demanda — ver PLANO.md > "Exportação de imagem
 * (instantâneos)". Renderiza um único frame na resolução escolhida (sem
 * `preserveDrawingBuffer` permanente: lê o buffer imediatamente após
 * `gl.render`, antes de restaurar o tamanho normal — ver `sceneCapture.ts`).
 *
 * **O que entra na imagem** e **como renderizar na resolução de saída** vivem
 * em `sceneCapture.ts`, compartilhados com a exportação de vídeo da fase 10:
 * é o que garante, por construção, que o MP4 mostre exatamente o mesmo que o
 * PNG — inclusive o destaque da junta selecionada, que até então escapava
 * daqui e saía na imagem (DECISOES.md #52).
 *
 * Assim como `CameraRig.tsx`, não tem teste automatizado (WebGL real +
 * File System Access API não existem em jsdom) — validado manualmente no
 * navegador, conforme já previsto em PLANO.md > "Modelo de desenvolvimento: TDD".
 * A lógica que dá para testar sem GPU está em `sceneCapture.ts`, e está.
 */
export function SnapshotCapture() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  // Rastreado só para disparar o efeito de novo quando a câmera ativa troca
  // (ver `CameraRig.tsx`) — a mutação de verdade usa `getThree().camera`
  // (acesso imperativo/não-reativo), porque o `eslint-plugin-react-hooks`
  // proíbe mutar diretamente um valor devolvido por um hook.
  const activeCamera = useThree((state) => state.camera)
  const getThree = useThree((state) => state.get)

  const pendingCapture = useSnapshotCaptureStore((state) => state.pendingCapture)
  const width = useSnapshotCaptureStore((state) => state.width)
  const height = useSnapshotCaptureStore((state) => state.height)
  const hideOverlaysOnCapture = useSnapshotCaptureStore((state) => state.hideOverlaysOnCapture)
  const directoryHandle = useSnapshotCaptureStore((state) => state.directoryHandle)
  const clearPendingCapture = useSnapshotCaptureStore((state) => state.clearPendingCapture)
  const setLastCapturedFilename = useSnapshotCaptureStore((state) => state.setLastCapturedFilename)

  const sceneName = useFiguresStore((state) => state.sceneName)
  const consumeSnapshotNumber = useFiguresStore((state) => state.consumeSnapshotNumber)

  useEffect(() => {
    if (!pendingCapture) return

    const camera = getThree().camera
    const restoreScene = hideOverlaysOnCapture ? hideSceneOverlays(scene) : () => {}

    const sequence = consumeSnapshotNumber()
    const filename = formatSnapshotFilename(sceneName, sequence)

    renderAtResolution(gl, scene, camera, width, height, () => {
      gl.domElement.toBlob((blob) => {
        if (blob)
          void writeFileToDirectoryOrDownload(directoryHandle, filename, blob).then(() =>
            setLastCapturedFilename(filename),
          )
      }, 'image/png')
    })

    // Overlays de volta na mesma tarefa síncrona — `toBlob` já capturou o
    // conteúdo no momento da chamada, então isso não gera flash visual.
    restoreScene()
    gl.render(scene, camera)

    clearPendingCapture()
  }, [
    pendingCapture,
    gl,
    scene,
    activeCamera,
    getThree,
    width,
    height,
    hideOverlaysOnCapture,
    directoryHandle,
    sceneName,
    consumeSnapshotNumber,
    clearPendingCapture,
    setLastCapturedFilename,
  ])

  return null
}
