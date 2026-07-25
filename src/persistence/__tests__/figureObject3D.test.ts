import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { getHeightScale, getJoint } from '../../figure/skeleton'
import type { Figure } from '../../store/figuresStore'
import { buildFigureObject3D } from '../figureObject3D'

const baseFigure: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [1, 0, -2],
  rotation: { x: 0, y: 45, z: 0 },
  pose: { 'shoulder.L': { x: 0, y: 0, z: 90 } },
}

describe('buildFigureObject3D — hierarquia headless para exportação glTF', () => {
  it('nomeia o grupo externo e o escala pela altura do boneco, sem usar caracteres removidos pelo glTF (. : / [ ])', () => {
    const group = buildFigureObject3D(baseFigure)
    expect(group.name).toBe('figure_figure-1')
    expect(group.position.toArray()).toEqual([1, 0, -2])
    expect(group.scale.x).toBeCloseTo(getHeightScale(1.7))
    for (const name of allNames(group)) {
      expect(name).not.toMatch(/[.:/[\]]/)
    }
  })

  it('reflete uma altura diferente na escala do grupo', () => {
    const tall = buildFigureObject3D({ ...baseFigure, height: 1.9 })
    expect(tall.scale.x).toBeCloseTo(getHeightScale(1.9))
  })

  it('reproduz a posição local de uma junta a partir do skeleton.ts', () => {
    const group = buildFigureObject3D(baseFigure)
    const shoulder = group.getObjectByName('figure-1_shoulder_L')
    expect(shoulder).toBeDefined()
    const expectedPosition = getJoint('shoulder.L').position
    expect(shoulder!.position.toArray()).toEqual([...expectedPosition])
  })

  it('aplica a pose (graus) da junta como rotação Euler em radianos', () => {
    const group = buildFigureObject3D(baseFigure)
    const shoulder = group.getObjectByName('figure-1_shoulder_L')!
    expect(shoulder.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(90))
    expect(shoulder.rotation.x).toBeCloseTo(0)
  })

  it('aplica a rotação livre do root (colocação), diferente da pose de junta comum', () => {
    const group = buildFigureObject3D(baseFigure)
    const root = group.children[0]
    expect(root.rotation.y).toBeCloseTo(THREE.MathUtils.degToRad(45))
  })

  it('inclui uma malha marcadora por junta e um "osso" por ligação pai-filho', () => {
    const group = buildFigureObject3D(baseFigure)
    let meshCount = 0
    group.traverse((object) => {
      if (object instanceof THREE.Mesh) meshCount += 1
    })
    // 32 juntas (marcador) + 31 ossos (uma ligação por junta não-root)
    expect(meshCount).toBe(32 + 31)
  })

  it('respeita a visibilidade do boneco', () => {
    const hidden = buildFigureObject3D({ ...baseFigure, visible: false })
    expect(hidden.visible).toBe(false)
  })
})

function allNames(root: THREE.Object3D): string[] {
  const names: string[] = []
  root.traverse((object) => {
    if (object.name) names.push(object.name)
  })
  return names
}
