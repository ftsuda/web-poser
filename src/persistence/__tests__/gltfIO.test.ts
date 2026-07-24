import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { exportObjectsToGlb, importGlb } from '../gltfIO'

describe('gltfIO — round trip de extras no nível da cena', () => {
  it('exporta um Group simples para .glb e recupera o bloco de extras ao reimportar', async () => {
    const group = new THREE.Group()
    group.name = 'figure-1'
    const child = new THREE.Group()
    child.name = 'figure-1_root'
    child.position.set(1, 2, 3)
    group.add(child)

    const extras = { version: 1, name: 'Cena de teste', figures: [{ id: 'figure-1' }] }

    const glb = await exportObjectsToGlb([group], extras)
    expect(glb).toBeInstanceOf(ArrayBuffer)
    expect(glb.byteLength).toBeGreaterThan(0)

    const imported = await importGlb(glb)
    expect(imported.extras).toEqual(extras)

    const restoredChild = imported.scene.getObjectByName('figure-1_root')
    expect(restoredChild).toBeDefined()
    expect(restoredChild?.position.x).toBeCloseTo(1)
    expect(restoredChild?.position.y).toBeCloseTo(2)
    expect(restoredChild?.position.z).toBeCloseTo(3)
  })

  it('exporta uma malha real (BoxGeometry) sem lançar erro', async () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ff0000' }))
    mesh.name = 'bone'

    const glb = await exportObjectsToGlb([mesh], { version: 1 })
    const imported = await importGlb(glb)
    expect(imported.scene.getObjectByName('bone')).toBeDefined()
  })
})
