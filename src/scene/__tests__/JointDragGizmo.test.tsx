import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { JointDragGizmo } from '../JointDragGizmo'

function findControlsProps(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  const tree = renderer.toTree() ?? []
  const node = tree.find((candidate) => candidate.props && 'mode' in candidate.props)
  if (!node) throw new Error('TransformControls node not found in tree')
  return node.props
}

function jointAt(x: number, y: number, z: number): THREE.Group {
  const joint = new THREE.Group()
  joint.position.set(x, y, z)
  joint.updateMatrixWorld(true)
  return joint
}

describe('JointDragGizmo', () => {
  it('renderiza um gizmo em modo translate preso a um proxy efêmero (nunca ao Group real da junta)', async () => {
    const jointObject = jointAt(0.2, 1.1, -0.3)
    const renderer = await ReactThreeTestRenderer.create(
      <JointDragGizmo figureId="f1" jointName="elbow.L" jointObject={jointObject} />,
    )

    const props = findControlsProps(renderer)
    expect(props.mode).toBe('translate')
    expect(renderer.scene.findByProps({ name: 'joint-drag-proxy' })).toBeDefined()
  })

  it('fora do arrasto, o proxy segue a posição da junta no mundo a cada quadro', async () => {
    const jointObject = jointAt(0.2, 1.1, -0.3)
    const renderer = await ReactThreeTestRenderer.create(
      <JointDragGizmo figureId="f1" jointName="elbow.L" jointObject={jointObject} />,
    )

    await renderer.advanceFrames(1, 16)

    const proxy = renderer.scene.findByProps({ name: 'joint-drag-proxy' })
    const position = (proxy.instance as THREE.Group).position
    expect(position.x).toBeCloseTo(0.2)
    expect(position.y).toBeCloseTo(1.1)
    expect(position.z).toBeCloseTo(-0.3)
  })
})
