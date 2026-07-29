import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { getHeightScale, getJoint } from '../skeleton'
import type { Figure } from '../../store/figuresStore'
import { buildJointFrames } from '../jointFrames'

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

describe('buildJointFrames', () => {
  it('inclui uma entrada por junta e aplica posição/escala no grupo externo', () => {
    const { outer, joints } = buildJointFrames(baseFigure)
    expect(outer.position.toArray()).toEqual([1, 0, -2])
    expect(outer.scale.x).toBeCloseTo(getHeightScale(1.7))
    expect(joints.size).toBe(38)
    expect(joints.has('shoulder.L')).toBe(true)
  })

  it('reproduz a posição local de uma junta a partir do skeleton.ts', () => {
    const { joints } = buildJointFrames(baseFigure)
    const shoulder = joints.get('shoulder.L')!
    expect(shoulder.position.toArray()).toEqual([...getJoint('shoulder.L').position])
  })

  it('aplica a pose da junta como rotação Euler em radianos', () => {
    const { joints } = buildJointFrames(baseFigure)
    const shoulder = joints.get('shoulder.L')!
    expect(shoulder.rotation.z).toBeCloseTo(THREE.MathUtils.degToRad(90))
  })

  it('já vem com a matriz de mundo atualizada, pronta para leitura de posição/orientação globais', () => {
    const { outer, joints } = buildJointFrames(baseFigure)
    const shoulder = joints.get('shoulder.L')!
    const worldPosition = new THREE.Vector3()
    shoulder.getWorldPosition(worldPosition)
    // Não deve ser a posição local (offset do skeleton) nem a origem — deve refletir toda a cadeia (root, escala, offset do próprio boneco).
    expect(worldPosition.equals(new THREE.Vector3(...getJoint('shoulder.L').position))).toBe(false)
    expect(outer.matrixWorld.elements.some((n) => n !== 0)).toBe(true)
  })
})
