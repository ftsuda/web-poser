import { beforeEach, describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { rootAxisLockToken } from '../../figure/jointLocks'
import { useFiguresStore } from '../../store/figuresStore'
import { SelectionGizmo } from '../SelectionGizmo'

beforeEach(() => {
  useFiguresStore.setState(useFiguresStore.getInitialState())
})

function makeTarget() {
  return new THREE.Group()
}

/**
 * `TransformControls` (drei) attaches its gizmo imperatively, so it doesn't
 * show up as a findable typed/named node in the rendered THREE scene graph.
 * `toTree()` reflects the React element tree instead, where the props
 * actually passed to `<TransformControls>` are reliably inspectable.
 */
function findControlsProps(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  const [node] = renderer.toTree() ?? []
  if (!node || !('mode' in (node.props ?? {}))) {
    throw new Error('TransformControls node not found in tree')
  }
  return node.props
}

describe('SelectionGizmo — gizmo mode and axis restriction', () => {
  it('uses translate mode showing all three axes (X/Y/Z) for the root joint, so the figure can be lifted off the ground', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionGizmo figureId="f1" jointName="root" target={makeTarget()} />,
    )

    const props = findControlsProps(renderer)
    expect(props.mode).toBe('translate')
    expect(props.showX).toBe(true)
    expect(props.showY).toBe(true)
    expect(props.showZ).toBe(true)
  })

  it('uses rotate mode restricted to the single DOF of a hinge joint (knee)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionGizmo figureId="f1" jointName="knee.L" target={makeTarget()} />,
    )

    const props = findControlsProps(renderer)
    expect(props.mode).toBe('rotate')
    expect(props.showX).toBe(true)
    expect(props.showY).toBe(false)
    expect(props.showZ).toBe(false)
  })

  it('uses rotate mode showing all three axes for a ball-joint (shoulder)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionGizmo figureId="f1" jointName="shoulder.L" target={makeTarget()} />,
    )

    const props = findControlsProps(renderer)
    expect(props.mode).toBe('rotate')
    expect(props.showX).toBe(true)
    expect(props.showY).toBe(true)
    expect(props.showZ).toBe(true)
  })

  it('rotates in local space, matching the Euler axes tracked by the pose model', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionGizmo figureId="f1" jointName="elbow.L" target={makeTarget()} />,
    )

    const props = findControlsProps(renderer)
    expect(props.space).toBe('local')
  })
})

describe('SelectionGizmo — gizmo de rotação da raiz (fase 9, item 13)', () => {
  it('mantém translação por padrão para o root', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionGizmo figureId="f1" jointName="root" target={makeTarget()} rootMode="translate" />,
    )
    expect(findControlsProps(renderer).mode).toBe('translate')
  })

  it('gira a raiz nos 3 eixos quando o modo é rotate', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionGizmo figureId="f1" jointName="root" target={makeTarget()} rootMode="rotate" />,
    )

    const props = findControlsProps(renderer)
    expect(props.mode).toBe('rotate')
    expect(props.showX).toBe(true)
    expect(props.showY).toBe(true)
    expect(props.showZ).toBe(true)
    // Espaço local: girar em torno do próprio pivô do quadril, e não de uma
    // origem externa — ponto confirmado com o usuário.
    expect(props.space).toBe('local')
  })

  it('esconde o anel do eixo travado da raiz (item 64) no modo rotate', async () => {
    useFiguresStore.getState().toggleJointLock('f1', rootAxisLockToken('y'))
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionGizmo figureId="f1" jointName="root" target={makeTarget()} rootMode="rotate" />,
    )

    const props = findControlsProps(renderer)
    expect(props.showX).toBe(true)
    expect(props.showY).toBe(false)
    expect(props.showZ).toBe(true)
  })

  it('a trava de eixo NÃO afeta o gizmo de translação da raiz — ela só trava rotação', async () => {
    useFiguresStore.getState().toggleJointLock('f1', rootAxisLockToken('y'))
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionGizmo figureId="f1" jointName="root" target={makeTarget()} rootMode="translate" />,
    )

    const props = findControlsProps(renderer)
    expect(props.showX).toBe(true)
    expect(props.showY).toBe(true)
    expect(props.showZ).toBe(true)
  })
})
