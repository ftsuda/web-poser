import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { formatKeyframeFilename } from '../keyframe/keyframeNaming'
import { writeFileToDirectoryOrDownload } from '../persistence/fileIO'
import { useFiguresStore } from '../store/figuresStore'
import { useKeyframeCaptureStore } from '../store/keyframeCaptureStore'
import { OVERLAY_NAME_LIST } from './constants'

function isTransformControlsGizmo(object: THREE.Object3D): boolean {
  return (object as { isTransformControlsGizmo?: boolean }).isTransformControlsGizmo === true
}

/**
 * Componente sem visual (`return null`) dentro do `<Canvas>` que executa a
 * captura real de PNG sob demanda — ver PLANO.md > "Exportação de imagem
 * (keyframes)". Renderiza um único frame na resolução escolhida (sem
 * `preserveDrawingBuffer` permanente: lê o buffer imediatamente após
 * `gl.render`, antes de restaurar o tamanho normal — `toBlob` já captura o
 * conteúdo no momento da chamada, então a restauração síncrona logo em
 * seguida não é vista pelo usuário; ver DECISOES.md).
 *
 * Assim como `CameraRig.tsx`, não tem teste automatizado (WebGL real +
 * File System Access API não existem em jsdom) — validado manualmente no
 * navegador, conforme já previsto em PLANO.md > "Modelo de desenvolvimento: TDD".
 */
export function KeyframeCapture() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  // Rastreado só para disparar o efeito de novo quando a câmera ativa troca
  // (ver `CameraRig.tsx`) — a mutação de verdade usa `getThree().camera`
  // (acesso imperativo/não-reativo), porque o `eslint-plugin-react-hooks`
  // proíbe mutar diretamente um valor devolvido por um hook.
  const activeCamera = useThree((state) => state.camera)
  const getThree = useThree((state) => state.get)

  const pendingCapture = useKeyframeCaptureStore((state) => state.pendingCapture)
  const width = useKeyframeCaptureStore((state) => state.width)
  const height = useKeyframeCaptureStore((state) => state.height)
  const hideOverlaysOnCapture = useKeyframeCaptureStore((state) => state.hideOverlaysOnCapture)
  const directoryHandle = useKeyframeCaptureStore((state) => state.directoryHandle)
  const clearPendingCapture = useKeyframeCaptureStore((state) => state.clearPendingCapture)
  const setLastCapturedFilename = useKeyframeCaptureStore((state) => state.setLastCapturedFilename)

  const sceneName = useFiguresStore((state) => state.sceneName)
  const consumeKeyframeNumber = useFiguresStore((state) => state.consumeKeyframeNumber)

  useEffect(() => {
    if (!pendingCapture) return

    const camera = getThree().camera
    const originalSize = gl.getSize(new THREE.Vector2())
    const originalPixelRatio = gl.getPixelRatio()

    const hiddenObjects: THREE.Object3D[] = []
    if (hideOverlaysOnCapture) {
      scene.traverse((object) => {
        const isOverlay = OVERLAY_NAME_LIST.includes(object.name) || isTransformControlsGizmo(object)
        if (isOverlay && object.visible) {
          hiddenObjects.push(object)
          object.visible = false
        }
      })
    }

    let restoreCamera: (() => void) | null = null
    if (camera instanceof THREE.PerspectiveCamera) {
      const originalAspect = camera.aspect
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      restoreCamera = () => {
        camera.aspect = originalAspect
        camera.updateProjectionMatrix()
      }
    } else if (camera instanceof THREE.OrthographicCamera) {
      const original = { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom }
      camera.left = width / -2
      camera.right = width / 2
      camera.top = height / 2
      camera.bottom = height / -2
      camera.updateProjectionMatrix()
      restoreCamera = () => {
        Object.assign(camera, original)
        camera.updateProjectionMatrix()
      }
    }

    gl.setPixelRatio(1)
    gl.setSize(width, height, false)
    gl.render(scene, camera)

    const sequence = consumeKeyframeNumber()
    const filename = formatKeyframeFilename(sceneName, sequence)

    gl.domElement.toBlob((blob) => {
      if (blob)
        void writeFileToDirectoryOrDownload(directoryHandle, filename, blob).then(() =>
          setLastCapturedFilename(filename),
        )
    }, 'image/png')

    // Restaura tamanho/câmera/overlays de volta, na mesma tarefa síncrona —
    // ver comentário do componente sobre por que isso não gera flash visual.
    gl.setPixelRatio(originalPixelRatio)
    gl.setSize(originalSize.x, originalSize.y, false)
    restoreCamera?.()
    for (const object of hiddenObjects) object.visible = true
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
    consumeKeyframeNumber,
    clearPendingCapture,
    setLastCapturedFilename,
  ])

  return null
}
