import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { SceneContent } from '../SceneContent'

describe('SceneContent — neutral environment', () => {
  it('renders a ground plane named "ground"', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneContent grid />)
    const ground = renderer.scene.findByProps({ name: 'ground' })
    expect(ground.type).toBe('Mesh')
  })

  it('renders hemisphere and directional lights, the directional light casting shadow', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneContent grid />)

    const hemisphereLights = renderer.scene.findAllByType('HemisphereLight')
    expect(hemisphereLights).toHaveLength(1)

    const directionalLights = renderer.scene.findAllByType('DirectionalLight')
    expect(directionalLights).toHaveLength(1)
    expect(directionalLights[0].instance.castShadow).toBe(true)
  })

  it('shows the grid helper when grid=true and hides it when grid=false', async () => {
    const withGrid = await ReactThreeTestRenderer.create(<SceneContent grid />)
    expect(withGrid.scene.findAllByType('GridHelper')).toHaveLength(1)

    const withoutGrid = await ReactThreeTestRenderer.create(<SceneContent grid={false} />)
    expect(withoutGrid.scene.findAllByType('GridHelper')).toHaveLength(0)
  })
})
