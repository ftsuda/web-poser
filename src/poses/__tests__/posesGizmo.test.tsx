import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { FreeViewGizmo } from '../PosesViewport'

/**
 * O gizmo de setas da vista Livre (#93) tem de ser ALVO DE DEDO: o pedido do
 * usuário (2026-08-03) dobrou setas e alvos de toque porque o tamanho original
 * era difícil de acertar no touch. Este teste trava os MÍNIMOS — encolher de
 * volta é regressão de usabilidade, não ajuste estético.
 *
 * (O arrasto em si continua fora do alcance de unit test, como sempre — aqui
 * se mede só a geometria que o dedo precisa acertar.)
 */

/** Tamanhos originais (antes do dobro) — os mínimos exigem PELO MENOS o dobro deles. */
const ORIGINAL = {
  shaftLength: 0.18,
  headRadius: 0.02,
  hitRadius: 0.045,
  hitLength: 0.3,
}

async function renderGizmo() {
  const renderer = await ReactThreeTestRenderer.create(
    <FreeViewGizmo anchor={[0, 1, 0]} onAxisPointerDown={() => () => {}} />,
  )
  const meshes: THREE.Mesh[] = []
  renderer.scene.instance.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh)
  })
  return meshes
}

describe('FreeViewGizmo — setas em tamanho de dedo', () => {
  it('são três setas: haste + ponta + alvo invisível por eixo', async () => {
    const meshes = await renderGizmo()
    expect(meshes).toHaveLength(9)
    expect(meshes.filter((mesh) => mesh.visible === false)).toHaveLength(3)
  })

  it('haste e ponta têm PELO MENOS o dobro do tamanho original', async () => {
    const meshes = await renderGizmo()

    const shafts = meshes.filter(
      (mesh) => mesh.visible && (mesh.geometry as THREE.CylinderGeometry).parameters?.height !== undefined,
    ) as THREE.Mesh<THREE.CylinderGeometry>[]
    const heads = meshes.filter(
      (mesh) => mesh.visible && mesh.geometry.type === 'ConeGeometry',
    ) as THREE.Mesh<THREE.ConeGeometry>[]

    expect(shafts.filter((mesh) => mesh.geometry.type === 'CylinderGeometry')).toHaveLength(3)
    expect(heads).toHaveLength(3)

    for (const shaft of shafts) {
      if (shaft.geometry.type !== 'CylinderGeometry') continue
      expect(shaft.geometry.parameters.height).toBeGreaterThanOrEqual(ORIGINAL.shaftLength * 2)
    }
    for (const head of heads) {
      expect(head.geometry.parameters.radius).toBeGreaterThanOrEqual(ORIGINAL.headRadius * 2)
    }
  })

  it('o ALVO DE TOQUE invisível cobre a seta inteira com pelo menos o dobro do raio', async () => {
    const meshes = await renderGizmo()
    const hits = meshes.filter((mesh) => !mesh.visible) as THREE.Mesh<THREE.CylinderGeometry>[]

    expect(hits).toHaveLength(3)
    for (const hit of hits) {
      expect(hit.geometry.parameters.radiusTop).toBeGreaterThanOrEqual(ORIGINAL.hitRadius * 2)
      expect(hit.geometry.parameters.height).toBeGreaterThanOrEqual(ORIGINAL.hitLength * 2)
    }
  })
})
