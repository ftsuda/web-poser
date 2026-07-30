import * as THREE from 'three'
import { CAMERA_DEFAULTS } from './constants'

/**
 * As câmeras de NAVEGAÇÃO do viewport (perspectiva e ortográfica), como
 * singletons de módulo — o mesmo padrão de `sceneCameraObject.ts`, e pelo
 * mesmo motivo: mais de uma camada precisa da MESMA instância sem se enxergar.
 *
 * Quem precisa delas:
 * - o `CameraRig`, que as move (presets, F, bookmarks ortográficos) e alterna
 *   qual é a câmera ativa do R3F;
 * - o `<OrbitControls>` do `Viewport`, que recebe a instância EXPLICITAMENTE
 *   pela prop `camera`. Isto é a correção de um bug da fase 11: sem a prop, o
 *   drei rebinda os controles na câmera PADRÃO do R3F — e entrar no modo
 *   visão-câmera trocava a padrão para a câmera de cena, fazendo o `update()`
 *   dos controles torcê-la para o alvo da órbita (a câmera "olhava para
 *   baixo"). Com a prop, os controles nunca largam a câmera da bancada.
 */

let perspective: THREE.PerspectiveCamera | null = null
let orthographic: THREE.OrthographicCamera | null = null

export function getViewportPerspectiveCamera(): THREE.PerspectiveCamera {
  if (!perspective) {
    perspective = new THREE.PerspectiveCamera(
      CAMERA_DEFAULTS.fov,
      1,
      CAMERA_DEFAULTS.near,
      CAMERA_DEFAULTS.far,
    )
    perspective.position.set(...CAMERA_DEFAULTS.position)
  }
  return perspective
}

export function getViewportOrthographicCamera(): THREE.OrthographicCamera {
  if (!orthographic) {
    orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA_DEFAULTS.near, CAMERA_DEFAULTS.far)
    orthographic.position.set(...CAMERA_DEFAULTS.position)
  }
  return orthographic
}
