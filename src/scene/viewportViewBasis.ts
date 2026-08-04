import * as THREE from 'three'
import type { MarkedView } from '../pose-import/markedPose'

/**
 * O registro da câmera viva do `<Canvas>` ativo (desktop OU módulo de poses —
 * um por vez, as cascas se revezam, #92), para a inferência da marcação sobre
 * a foto de referência ler a BASE DA VISTA no clique de "Inferir pose".
 *
 * É uma referência mutável de módulo, como o `jointObjects` do `Viewport`:
 * não é estado de React (a câmera muda por quadro na órbita, e ninguém quer
 * um re-render por quadro) — quem a escreve é o `ViewportCameraBridge`,
 * montado dentro de cada Canvas.
 */
export const activeViewportCamera: { current: THREE.Camera | null } = { current: null }

/** Lê a base de tela da câmera ativa; `null` sem Canvas montado. */
export function activeViewBasis(): MarkedView | null {
  const camera = activeViewportCamera.current
  if (!camera) return null
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
  return { right: [right.x, right.y, right.z], up: [up.x, up.y, up.z] }
}
