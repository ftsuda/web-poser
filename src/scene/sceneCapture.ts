import * as THREE from 'three'
import { OVERLAY_NAME_LIST } from './constants'
import { suspendViewOffset } from './frameMask'

/**
 * O que entra numa saída — imagem PNG (`SnapshotCapture.tsx`) ou vídeo MP4
 * (`AnimationPlayer.tsx`) — e como renderizar na resolução escolhida.
 * Compartilhado pelos dois de propósito: o pedido da fase 10 é que o vídeo
 * mostre **exatamente** o que sairia numa imagem exportada (DECISOES.md #52),
 * e a única forma de garantir isso é uma peça só.
 *
 * Tudo aqui é imperativo, sobre a árvore viva de `Object3D` — nada passa por
 * React. É o que permite esconder os apoios de tela e renderizar no mesmo
 * passo síncrono, sem esperar um commit: o buffer do canvas WebGL (sem
 * `preserveDrawingBuffer`) só é legível imediatamente após o `gl.render`.
 */

function isTransformControlsGizmo(object: THREE.Object3D): boolean {
  return (object as { isTransformControlsGizmo?: boolean }).isTransformControlsGizmo === true
}

/** Desfaz uma alteração temporária feita na cena para a captura. */
export type RestoreScene = () => void

/**
 * Esconde os apoios de tela: grade do chão, indicador de alinhamento, régua
 * vertical e qualquer gizmo de `TransformControls` (seleção e alvo de IK).
 * Devolve o restaurador — só o que ESTAVA visível volta a ficar, para não
 * acender um overlay que o usuário tinha desligado.
 */
export function hideOverlays(scene: THREE.Object3D): RestoreScene {
  const hidden: THREE.Object3D[] = []
  scene.traverse((object) => {
    const isOverlay = OVERLAY_NAME_LIST.includes(object.name) || isTransformControlsGizmo(object)
    if (isOverlay && object.visible) {
      hidden.push(object)
      object.visible = false
    }
  })

  return () => {
    for (const object of hidden) object.visible = true
  }
}

/**
 * Apaga o destaque emissivo da junta selecionada (o amarelo do `Figure.tsx`).
 *
 * Vem da fase 10: o destaque é **cor de material**, não objeto nomeado, então
 * o passe de overlays acima nunca o alcançou — e ele saía no PNG exportado. O
 * usuário decidiu corrigir a captura de imagem em vez de manter duas regras
 * (DECISOES.md #52): uma opção só, "ocultar grade/gizmos", esconde as três
 * coisas, nas duas saídas.
 *
 * Mexe só na INTENSIDADE, não na cor: é um número por material, restaurado
 * exatamente, e não depende de saber qual amarelo estava lá.
 */
export function muteJointHighlight(scene: THREE.Object3D): RestoreScene {
  const muted: Array<{ material: THREE.MeshStandardMaterial; intensity: number }> = []

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const standard = material as THREE.MeshStandardMaterial
      if (standard?.emissiveIntensity) {
        muted.push({ material: standard, intensity: standard.emissiveIntensity })
        standard.emissiveIntensity = 0
      }
    }
  })

  return () => {
    for (const { material, intensity } of muted) material.emissiveIntensity = intensity
  }
}

/** Esconde tudo o que é apoio de tela de uma vez; devolve um restaurador só. */
export function hideSceneOverlays(scene: THREE.Object3D): RestoreScene {
  const restoreOverlays = hideOverlays(scene)
  const restoreHighlight = muteJointHighlight(scene)
  return () => {
    restoreHighlight()
    restoreOverlays()
  }
}

export interface Renderer {
  getSize: (target: THREE.Vector2) => THREE.Vector2
  getPixelRatio: () => number
  setPixelRatio: (ratio: number) => void
  setSize: (width: number, height: number, updateStyle?: boolean) => void
  render: (scene: THREE.Object3D, camera: THREE.Camera) => void
}

/**
 * Ajusta a câmera à proporção pedida — a da SAÍDA, que quase nunca é a da
 * janela. Devolve o restaurador.
 *
 * Também suspende o deslocamento de vista enquanto dura a captura: é ele que a
 * máscara de enquadramento usa para afastar a câmera na tela (`frameMask.ts`),
 * e deixá-lo ligado faria a saída gravar as próprias barras da máscara. É o
 * que mantém verdadeira a promessa da máscara — o arquivo é o retângulo claro,
 * não a janela inteira que a máscara está encolhendo.
 */
export function applyOutputAspect(camera: THREE.Camera, width: number, height: number): RestoreScene {
  if (camera instanceof THREE.PerspectiveCamera) {
    const restoreView = suspendViewOffset(camera)
    const original = camera.aspect
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    return () => {
      camera.aspect = original
      restoreView()
      camera.updateProjectionMatrix()
    }
  }

  if (camera instanceof THREE.OrthographicCamera) {
    const restoreView = suspendViewOffset(camera)
    const original = { left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom }
    camera.left = width / -2
    camera.right = width / 2
    camera.top = height / 2
    camera.bottom = height / -2
    camera.updateProjectionMatrix()
    return () => {
      Object.assign(camera, original)
      restoreView()
      camera.updateProjectionMatrix()
    }
  }

  return () => {}
}

/**
 * Renderiza a cena na resolução de saída, chama `consume` com o quadro ainda
 * no buffer e restaura tamanho e proporção — tudo no mesmo passo síncrono.
 *
 * `consume` é onde o quadro vira PNG (`toBlob`) ou entra no codificador de
 * vídeo (`CanvasSource.add`). Nos dois casos a leitura tem de acontecer antes
 * de o compositor limpar o buffer, e é por isso que a restauração vem logo
 * depois, na mesma tarefa: `toBlob` e `new VideoFrame(canvas)` capturam o
 * conteúdo no momento da chamada, então o usuário nunca vê o canvas
 * redimensionado.
 */
export function renderAtResolution(
  gl: Renderer,
  scene: THREE.Object3D,
  camera: THREE.Camera,
  width: number,
  height: number,
  consume: () => void,
): void {
  const originalSize = gl.getSize(new THREE.Vector2())
  const originalPixelRatio = gl.getPixelRatio()
  const restoreAspect = applyOutputAspect(camera, width, height)

  gl.setPixelRatio(1)
  gl.setSize(width, height, false)
  gl.render(scene, camera)

  consume()

  gl.setPixelRatio(originalPixelRatio)
  gl.setSize(originalSize.x, originalSize.y, false)
  restoreAspect()
}
