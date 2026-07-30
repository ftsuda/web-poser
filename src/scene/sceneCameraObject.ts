import * as THREE from 'three'
import type { CameraViewState } from './cameraMove'
import { CAMERA_DEFAULTS } from './constants'
import { focalLengthToFov, fovToFocalLength } from './lens'

/**
 * O objeto `THREE.PerspectiveCamera` VIVO da câmera de cena (fase 11) — um
 * singleton de módulo, fora da árvore React, pelo mesmo motivo que o
 * `CameraRig` mantém as câmeras do viewport em refs: ele precisa ser
 * compartilhado por camadas que não se enxergam (o rig o ativa no modo
 * visão-câmera, o gizmo o segue quadro a quadro, o animador o move
 * imperativamente durante a reprodução e a captura de PNG renderiza por ele).
 *
 * A FONTE DA VERDADE em repouso é `figuresStore.sceneCamera`; o `CameraRig`
 * sincroniza estado → objeto. O caminho imperativo (reprodução, quadro a
 * quadro) escreve direto aqui e devolve o resultado ao store ao parar — mesma
 * regra de desempenho do animador de sempre: nada de um `set` de store por
 * quadro.
 */

let sceneCamera: THREE.PerspectiveCamera | null = null

export function getSceneCameraObject(): THREE.PerspectiveCamera {
  if (!sceneCamera) {
    sceneCamera = new THREE.PerspectiveCamera(
      CAMERA_DEFAULTS.fov,
      1,
      CAMERA_DEFAULTS.near,
      CAMERA_DEFAULTS.far,
    )
  }
  return sceneCamera
}

/**
 * Põe uma câmera exatamente no estado dado — posição, alvo, topo da tela e
 * lente — num passo síncrono. Serve tanto para o singleton quanto para a
 * câmera descartável da exportação de vídeo.
 */
export function applyViewToCamera(camera: THREE.PerspectiveCamera, view: CameraViewState): void {
  camera.position.set(...view.position)
  camera.up.set(...view.up)
  camera.lookAt(view.target[0], view.target[1], view.target[2])
  camera.fov = focalLengthToFov(view.focalMm)
  camera.updateProjectionMatrix()
}

/** Lê o estado completo da câmera dada, no formato que o store e os keyframes guardam. */
export function readViewFromCamera(camera: THREE.PerspectiveCamera, target: THREE.Vector3): CameraViewState {
  return {
    position: [camera.position.x, camera.position.y, camera.position.z],
    target: [target.x, target.y, target.z],
    up: [camera.up.x, camera.up.y, camera.up.z],
    focalMm: fovToFocalLength(camera.fov),
  }
}
