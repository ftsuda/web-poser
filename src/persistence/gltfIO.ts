import * as THREE from 'three'
import { GLTFExporter, GLTFLoader } from 'three-stdlib'

/**
 * Camada fina sobre `GLTFExporter`/`GLTFLoader` (`three-stdlib`) — grava/lê
 * `extras["virtual-mockup"]` no nível da *cena* do glTF (não de um nó), a
 * única forma de sobreviver como custom property de cena ao reabrir no
 * Blender. Ver DECISOES.md #11 e PLANO.md > "Persistência (formato da cena)".
 *
 * Detalhes técnicos que motivam o formato de chamada abaixo (investigados
 * lendo o código-fonte de `three-stdlib`, não documentação):
 * - `extras` só é escrito em `scenes[0].extras` quando o objeto passado para
 *   `.parse()` é uma instância real de `THREE.Scene` (não um `Group`) — um
 *   `Group` é envolvido numa cena sintética sem `userData`, perdendo o bloco.
 * - `binary: true` faz `onDone` receber um `ArrayBuffer` pronto (`.glb`),
 *   em vez do objeto JSON do `.gltf`.
 * - Ao reabrir, o bloco volta em `gltf.scene.userData` (um `THREE.Group`, não
 *   uma `THREE.Scene` — o loader não recria o tipo `Scene`), não em
 *   `gltf.userData` (que só reflete `extras` no nível do documento glTF,
 *   nunca escrito pelo exportador).
 */

export function exportObjectsToGlb(
  objects: readonly THREE.Object3D[],
  extras: Record<string, unknown>,
): Promise<ArrayBuffer> {
  const exportScene = new THREE.Scene()
  exportScene.userData = extras
  for (const object of objects) {
    exportScene.add(object)
  }

  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      exportScene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result)
        } else {
          reject(new Error('Exportação glTF não retornou um ArrayBuffer binário (.glb).'))
        }
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
      { binary: true, onlyVisible: false },
    )
  })
}

export interface ImportedGlb {
  scene: THREE.Group
  extras: Record<string, unknown>
}

export function importGlb(data: ArrayBuffer): Promise<ImportedGlb> {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(
      data,
      '',
      (gltf) => {
        const extras =
          typeof gltf.scene.userData === 'object' && gltf.scene.userData !== null
            ? (gltf.scene.userData as Record<string, unknown>)
            : {}
        resolve({ scene: gltf.scene, extras })
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    )
  })
}
