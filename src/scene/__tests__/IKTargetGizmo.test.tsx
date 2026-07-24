import { beforeEach, describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type * as THREE from 'three'
import { useIKStore } from '../../store/ikStore'
import { IKTargetGizmo } from '../IKTargetGizmo'

function findControlsProps(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  const tree = renderer.toTree() ?? []
  const node = tree.find((candidate) => candidate.props && 'mode' in candidate.props)
  if (!node) throw new Error('TransformControls node not found in tree')
  return node.props
}

describe('IKTargetGizmo', () => {
  beforeEach(() => {
    useIKStore.setState(useIKStore.getInitialState())
  })

  it('renders nothing when the limb has no IK target yet', async () => {
    const renderer = await ReactThreeTestRenderer.create(<IKTargetGizmo figureId="f1" endEffector="wrist.L" />)
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0)
  })

  it('renders a translate-mode gizmo at the stored target position once IK is enabled', async () => {
    useIKStore.getState().enableLimb('f1', 'wrist.L', [0.3, 0.8, 0.1])
    const renderer = await ReactThreeTestRenderer.create(<IKTargetGizmo figureId="f1" endEffector="wrist.L" />)

    const props = findControlsProps(renderer)
    expect(props.mode).toBe('translate')

    const mesh = renderer.scene.findByProps({ name: 'ik-target-marker' })
    const worldPosition = mesh.instance.parent!.position
    expect([worldPosition.x, worldPosition.y, worldPosition.z]).toEqual([0.3, 0.8, 0.1])
  })

  it('colors the target marker green when reachable and red when not', async () => {
    useIKStore.getState().enableLimb('f1', 'wrist.L', [0, 0, 0])
    useIKStore.getState().setReached('f1', 'wrist.L', true)
    const reachedRenderer = await ReactThreeTestRenderer.create(
      <IKTargetGizmo figureId="f1" endEffector="wrist.L" />,
    )
    const reachedMesh = reachedRenderer.scene.findByProps({ name: 'ik-target-marker' })
    const reachedMaterial = (reachedMesh.instance as THREE.Mesh).material as THREE.MeshStandardMaterial
    expect(`#${reachedMaterial.color.getHexString()}`).toBe('#4ade80')

    useIKStore.getState().setReached('f1', 'wrist.L', false)
    const unreachableRenderer = await ReactThreeTestRenderer.create(
      <IKTargetGizmo figureId="f1" endEffector="wrist.L" />,
    )
    const unreachableMesh = unreachableRenderer.scene.findByProps({ name: 'ik-target-marker' })
    const unreachableMaterial = (unreachableMesh.instance as THREE.Mesh).material as THREE.MeshStandardMaterial
    expect(`#${unreachableMaterial.color.getHexString()}`).toBe('#ef4444')
  })
})
