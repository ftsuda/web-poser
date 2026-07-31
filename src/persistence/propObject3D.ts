import * as THREE from 'three'
import { buildPropGeometry } from '../props/propGeometry'
import type { SceneProp } from '../props/sceneProp'

/**
 * Constrói a malha de um objeto de cena para o `.glb`, sem depender de
 * React/`@react-three/fiber` — o irmão do `figureObject3D.ts`, e testável sem
 * WebGL pela mesma razão.
 *
 * Diferença que vale registrar: o boneco vai para o arquivo com geometria
 * **simplificada** (esfera + cilindro por osso), porque a reconstrução no app é
 * 100% baseada em `extras` e a malha do arquivo só serve de referência visual
 * no Blender. O objeto de cena vai com a geometria **real**: ela já é a mesma
 * que a tela mostra, deformação de vértice incluída, e não custa nada gerar.
 * Quem abre o `.glb` no Blender recebe o cubo que viu na tela.
 *
 * `hiddenInEditor` não é consultado aqui de propósito — é opção de BANCADA, e
 * o arquivo é saída, não bancada (ver `sceneCapture.revealEditorHidden`).
 */
export function buildPropObject3D(prop: SceneProp): THREE.Mesh {
  const mesh = new THREE.Mesh(
    buildPropGeometry(prop),
    new THREE.MeshStandardMaterial({
      color: prop.color,
      // O plano é uma folha sem espessura: sem isto ele desaparece quando visto
      // por trás, tanto na tela quanto no arquivo.
      side: prop.shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
    }),
  )

  mesh.name = `prop_${prop.id.replace(/\./g, '_')}`
  mesh.visible = prop.visible
  mesh.position.set(...prop.position)
  mesh.rotation.set(
    THREE.MathUtils.degToRad(prop.rotation.x),
    THREE.MathUtils.degToRad(prop.rotation.y),
    THREE.MathUtils.degToRad(prop.rotation.z),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
