import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import * as THREE from 'three'
import { Figure } from '../Figure'
import { JOINT_NAMES, REFERENCE_HEIGHT_M, getHeightScale, getJointChain } from '../skeleton'
import type { Figure as FigureData } from '../../store/figuresStore'

function makeFigure(overrides: Partial<FigureData> = {}): FigureData {
  return {
    id: 'f1',
    name: 'Boneco 1',
    color: '#e04040',
    visible: true,
    height: REFERENCE_HEIGHT_M,
    position: [0, 0, 0],
    rotation: { x: 0, y: 0, z: 0 },
    pose: {},
    ...overrides,
  }
}

describe('Figure — primitive mannequin', () => {
  it('renders exactly one group per skeleton joint', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const jointGroups = JOINT_NAMES.map((name) => renderer.scene.findByProps({ name: `joint-${name}` }))
    expect(jointGroups).toHaveLength(JOINT_NAMES.length)
  })

  it('nests joints following the skeleton hierarchy', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)

    let node = renderer.scene.findByProps({ name: 'joint-shoulder.L' })
    const chainFromNode: string[] = []
    while (node) {
      const name = (node.props.name as string | undefined)?.replace(/^joint-/, '')
      if (name) chainFromNode.unshift(name)
      node = node.parent as typeof node
      if (!node || !(node.props?.name as string | undefined)?.startsWith('joint-')) break
    }

    expect(chainFromNode).toEqual(getJointChain('shoulder.L'))
  })

  it('scales the root group proportionally to figure height', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ height: 1.9 })} />,
    )
    const root = renderer.scene.findByProps({ name: 'figure-f1' })
    const expectedScale = getHeightScale(1.9)
    expect(root.instance.scale.x).toBeCloseTo(expectedScale, 5)
    expect(root.instance.scale.y).toBeCloseTo(expectedScale, 5)
    expect(root.instance.scale.z).toBeCloseTo(expectedScale, 5)
  })

  it('hides the figure when visible=false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ visible: false })} />,
    )
    const root = renderer.scene.findByProps({ name: 'figure-f1' })
    expect(root.instance.visible).toBe(false)
  })

  it('colors the body segments with the figure color', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ color: '#4060e0' })} />,
    )
    const mesh = renderer.scene.findByProps({ name: 'segment-chest' })
    const material = mesh.allChildren.find((child) => child.type === 'MeshStandardMaterial')

    expect(material).toBeDefined()
    expect((material?.instance as unknown as THREE.MeshStandardMaterial).color.getHexString()).toBe(
      '4060e0',
    )
  })

  it('applies pose rotation (degrees) to the matching joint group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ pose: { 'elbow.L': { x: 90, y: 0, z: 0 } } })} />,
    )
    const elbow = renderer.scene.findByProps({ name: 'joint-elbow.L' })
    expect(elbow.instance.rotation.x).toBeCloseTo(THREE.MathUtils.degToRad(90), 5)
  })

  it('applies the free root rotation from figure.rotation', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ rotation: { x: 0, y: 45, z: 0 } })} />,
    )
    const root = renderer.scene.findByProps({ name: 'joint-root' })
    expect(root.instance.rotation.y).toBeCloseTo(THREE.MathUtils.degToRad(45), 5)
  })

  it('renders the head as a non-uniform (ellipsoid) volume, bigger than a plain hinge joint', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)

    const elbow = renderer.scene.findByProps({ name: 'segment-elbow.L' })
    const elbowRadius = elbow.instance.scale.x

    const head = renderer.scene.findByProps({ name: 'segment-head' })
    const scale = head.instance.scale
    const isNonUniform = scale.x !== scale.y || scale.y !== scale.z || scale.x !== scale.z
    expect(isNonUniform).toBe(true)
    expect(Math.max(scale.x, scale.y, scale.z)).toBeGreaterThan(elbowRadius)
  })

  it('renders the pelvis and chest as lathed (turned-profile) volumes, wider than a plain hinge joint', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)

    const elbow = renderer.scene.findByProps({ name: 'segment-elbow.L' })
    const elbowGeometry = elbow.allChildren.find((child) => child.type === 'SphereGeometry')
      ?.instance as unknown as THREE.BufferGeometry
    elbowGeometry.computeBoundingSphere()
    const elbowRadius = (elbowGeometry.boundingSphere?.radius ?? 0) * elbow.instance.scale.x

    for (const name of ['root', 'chest']) {
      const mesh = renderer.scene.findByProps({ name: `segment-${name}` })
      const geometry = mesh.allChildren.find((child) => child.type === 'LatheGeometry')
        ?.instance as unknown as THREE.BufferGeometry
      expect(geometry).toBeDefined()

      geometry.computeBoundingSphere()
      const radius = geometry.boundingSphere?.radius ?? 0
      expect(radius).toBeGreaterThan(elbowRadius)
    }
  })

  it('renders limb bones (e.g. upper arm) as lathed (turned-profile), bulging volumes', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const shoulder = renderer.scene.findByProps({ name: 'joint-shoulder.L' })
    const bone = shoulder.children.find((child) =>
      child.allChildren.some((grandchild) => grandchild.type === 'LatheGeometry'),
    )
    expect(bone).toBeDefined()
  })

  it('centers bone geometry (lathe and paddle) on its own origin, so positioning it at the segment midpoint spans exactly from the joint to its child', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)

    const shoulder = renderer.scene.findByProps({ name: 'joint-shoulder.L' })
    const upperArmBone = shoulder.children.find((child) =>
      child.allChildren.some((grandchild) => grandchild.type === 'LatheGeometry'),
    )
    const wrist = renderer.scene.findByProps({ name: 'joint-wrist.L' })
    const handBone = wrist.children.find((child) =>
      child.allChildren.some((grandchild) => grandchild.type === 'BoxGeometry'),
    )

    for (const bone of [upperArmBone, handBone]) {
      const mesh = bone?.instance as unknown as THREE.Mesh
      const geometry = mesh.geometry
      geometry.computeBoundingBox()
      const box = geometry.boundingBox
      expect(box).not.toBeNull()
      expect(box!.min.y).toBeCloseTo(-box!.max.y, 5)
    }
  })

  it('renders hands and feet as flattened paddle shapes, not cylinders', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const wrist = renderer.scene.findByProps({ name: 'joint-wrist.L' })
    const handBone = wrist.children.find((child) =>
      child.allChildren.some((grandchild) => grandchild.type === 'BoxGeometry'),
    )
    expect(handBone).toBeDefined()

    const ankle = renderer.scene.findByProps({ name: 'joint-ankle.L' })
    const footBone = ankle.children.find((child) =>
      child.allChildren.some((grandchild) => grandchild.type === 'BoxGeometry'),
    )
    expect(footBone).toBeDefined()
  })

  it('offsets the head sphere forward (+Z) and down (-Y) from the neck/head joint pivot, instead of centering it on the pivot', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const head = renderer.scene.findByProps({ name: 'segment-head' })
    expect(head.instance.position.z).toBeGreaterThan(0)
    expect(head.instance.position.y).toBeLessThan(0)
  })

  it('renders small face-feature marks (nose/eyes/mouth/ears) on the head, not just a plain sphere', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const head = renderer.scene.findByProps({ name: 'joint-head' })
    const meshes = head.children.filter((child) => child.type === 'Mesh')
    // segment-head (a esfera) + nariz + 2 olhos + boca + 2 orelhas = 7
    expect(meshes.length).toBeGreaterThanOrEqual(7)
  })

  it('keeps the eyes always black, regardless of the figure color (nose/mouth/ears follow the body color)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure({ color: '#4060e0' })} />)
    const head = renderer.scene.findByProps({ name: 'joint-head' })
    const meshMaterialColors = head.children
      .filter((child) => child.type === 'Mesh')
      .map((mesh) => {
        const material = mesh.allChildren.find((child) => child.type === 'MeshStandardMaterial')
        return (material?.instance as unknown as THREE.MeshStandardMaterial).color.getHexString()
      })

    const blackMeshes = meshMaterialColors.filter((hex) => hex !== '4060e0')
    // As 2 esferas dos olhos são as únicas que não seguem a cor do boneco.
    expect(blackMeshes).toHaveLength(2)
    for (const hex of blackMeshes) {
      expect(hex).not.toBe('4060e0')
    }
  })

  it('closes the top of the chest lathe geometry (used to be open/hollow)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const chestMesh = renderer.scene.findByProps({ name: 'segment-chest' })
    const geometry = (chestMesh.instance as unknown as THREE.Mesh).geometry
    const position = geometry.attributes.position

    let maxY = -Infinity
    for (let i = 0; i < position.count; i += 1) {
      maxY = Math.max(maxY, position.getY(i))
    }

    let minRadiusAtTop = Infinity
    for (let i = 0; i < position.count; i += 1) {
      if (Math.abs(position.getY(i) - maxY) < 1e-4) {
        minRadiusAtTop = Math.min(minRadiusAtTop, Math.hypot(position.getX(i), position.getZ(i)))
      }
    }

    expect(minRadiusAtTop).toBeLessThan(0.001)
  })

  it('renders the finger group (fingersBase→fingersMid→fingersTip) as a chain of 3 paralelepípedo bones, not a single flat paddle', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    for (const parentJoint of ['wrist.L', 'fingersBase.L', 'fingersMid.L']) {
      const joint = renderer.scene.findByProps({ name: `joint-${parentJoint}` })
      const segmentBone = joint.children.find((child) =>
        child.allChildren.some((grandchild) => grandchild.type === 'BoxGeometry'),
      )
      expect(segmentBone).toBeDefined()
    }
  })

  it('renders the thumb bones as cylinders, not the organic tapered profile used elsewhere', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    for (const parentJoint of ['wrist.L', 'thumb1.L']) {
      const joint = renderer.scene.findByProps({ name: `joint-${parentJoint}` })
      const thumbBone = joint.children.find((child) =>
        child.allChildren.some((grandchild) => grandchild.type === 'CylinderGeometry'),
      )
      expect(thumbBone).toBeDefined()
    }
  })

  it('attaches a geometry block to the tip of fingersTip.*/thumb2.* so bending them has a visible effect', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    for (const jointName of ['fingersTip.L', 'fingersTip.R']) {
      const joint = renderer.scene.findByProps({ name: `joint-${jointName}` })
      const tipMesh = joint.children.find((child) =>
        child.allChildren.some((grandchild) => grandchild.type === 'BoxGeometry'),
      )
      expect(tipMesh).toBeDefined()
    }
    for (const jointName of ['thumb2.L', 'thumb2.R']) {
      const joint = renderer.scene.findByProps({ name: `joint-${jointName}` })
      const tipMesh = joint.children.find((child) =>
        child.allChildren.some((grandchild) => grandchild.type === 'CylinderGeometry'),
      )
      expect(tipMesh).toBeDefined()
    }
  })

  it('moves the whole finger chain in the world when fingersBase.L is posed (bug fixed: a single joint used to have no attached geometry at all)', async () => {
    const restRenderer = await ReactThreeTestRenderer.create(<Figure figure={makeFigure()} />)
    const restTipJoint = restRenderer.scene.findByProps({ name: 'joint-fingersTip.L' })
    const restPos = new THREE.Vector3()
    ;(restTipJoint.instance as unknown as THREE.Object3D).getWorldPosition(restPos)

    const posedRenderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ pose: { 'fingersBase.L': { x: 80, y: 0, z: 0 } } })} />,
    )
    const posedTipJoint = posedRenderer.scene.findByProps({ name: 'joint-fingersTip.L' })
    const posedPos = new THREE.Vector3()
    ;(posedTipJoint.instance as unknown as THREE.Object3D).getWorldPosition(posedPos)

    expect(posedPos.distanceTo(restPos)).toBeGreaterThan(0.01)
  })

  it('renders a flat, translucent ground-shadow ellipse per figure, colored like the figure', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ color: '#4060e0' })} />,
    )
    const shadow = renderer.scene.findByProps({ name: 'figure-shadow-f1' })
    expect(shadow.type).toBe('Mesh')

    // Deitada no chão, como o plano de chão da cena (rotação em X).
    expect(shadow.instance.rotation.x).toBeCloseTo(-Math.PI / 2, 5)

    const geometry = shadow.allChildren.find((child) => child.type === 'CircleGeometry')
    expect(geometry).toBeDefined()

    const material = shadow.allChildren.find((child) => child.type === 'MeshBasicMaterial')
    const mat = material?.instance as unknown as THREE.MeshBasicMaterial
    expect(mat.transparent).toBe(true)
    expect(mat.opacity).toBeLessThan(1)
    expect(mat.color.getHexString()).toBe('4060e0')
  })

  it('keeps the ground shadow pinned to the ground plane (Y≈0) even when the figure is lifted up, tracking only X/Z', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure({ position: [1.2, 1.5, -0.6] })} />,
    )

    const bodyGroup = renderer.scene.findByProps({ name: 'figure-f1' })
    expect(bodyGroup.instance.position.y).toBeCloseTo(1.5, 5)

    const shadow = renderer.scene.findByProps({ name: 'figure-shadow-f1' })
    const shadowAnchor = shadow.parent
    expect(shadowAnchor).not.toBeNull()
    expect(shadowAnchor!.instance.position.x).toBeCloseTo(1.2, 5)
    expect(shadowAnchor!.instance.position.z).toBeCloseTo(-0.6, 5)
    expect(shadowAnchor!.instance.position.y).toBeLessThan(0.05)
  })
})

describe('Figure — joint selection', () => {
  it('calls onSelectJoint with the joint name when its body mesh is clicked', async () => {
    const clicks: string[] = []
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} onSelectJoint={(name) => clicks.push(name)} />,
    )

    const elbow = renderer.scene.findByProps({ name: 'segment-elbow.L' })
    await renderer.fireEvent(elbow, 'click')

    expect(clicks).toEqual(['elbow.L'])
  })

  it('highlights the selected joint body (emissive) and leaves others unlit', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} selectedJointName="elbow.L" />,
    )

    const elbowMaterial = renderer.scene
      .findByProps({ name: 'segment-elbow.L' })
      .allChildren.find((child) => child.type === 'MeshStandardMaterial')
      ?.instance as unknown as THREE.MeshStandardMaterial
    const wristMaterial = renderer.scene
      .findByProps({ name: 'segment-wrist.L' })
      .allChildren.find((child) => child.type === 'MeshStandardMaterial')
      ?.instance as unknown as THREE.MeshStandardMaterial

    expect(elbowMaterial.emissive.getHex()).toBeGreaterThan(0)
    expect(wristMaterial.emissive.getHex()).toBe(0)
  })

  it('highlights a torso block (root/chest) the same way when selected', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Figure figure={makeFigure()} selectedJointName="chest" />,
    )

    const chestMaterial = renderer.scene
      .findByProps({ name: 'segment-chest' })
      .allChildren.find((child) => child.type === 'MeshStandardMaterial')
      ?.instance as unknown as THREE.MeshStandardMaterial

    expect(chestMaterial.emissive.getHex()).toBeGreaterThan(0)
  })
})

describe('Figure — joint object ref registry', () => {
  it('reports the live joint group via onJointRef, keyed by joint name', async () => {
    const registered = new Map<string, unknown>()
    const renderer = await ReactThreeTestRenderer.create(
      <Figure
        figure={makeFigure()}
        onJointRef={(name, object) => {
          if (object) registered.set(name, object)
        }}
      />,
    )

    const elbowGroup = renderer.scene.findByProps({ name: 'joint-elbow.L' })
    expect(registered.get('elbow.L')).toBe(elbowGroup.instance)
  })

  it('reports the outer figure group (not the inner root-joint group) for "root", so it carries figure.position with no extra skeleton offset', async () => {
    const registered = new Map<string, unknown>()
    const renderer = await ReactThreeTestRenderer.create(
      <Figure
        figure={makeFigure()}
        onJointRef={(name, object) => {
          if (object) registered.set(name, object)
        }}
      />,
    )

    const figureGroup = renderer.scene.findByProps({ name: 'figure-f1' })
    const innerRootGroup = renderer.scene.findByProps({ name: 'joint-root' })

    expect(registered.get('root')).toBe(figureGroup.instance)
    expect(registered.get('root')).not.toBe(innerRootGroup.instance)
  })
})
