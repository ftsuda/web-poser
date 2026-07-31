import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type * as THREE from 'three'
import { SceneContent } from '../SceneContent'
import { SHADOW_INTENSITY } from '../constants'

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

  it('projeta a sombra mais clara que o padrão do three', async () => {
    // A sombra a 1 (padrão) empastelava o chão depois dos objetos de cena
    // (item 42). O valor vive em `SHADOW_INTENSITY`, e o teste trava que ele
    // chega mesmo à luz — `shadow-intensity` é uma prop aninhada, e um erro de
    // digitação nela passaria despercebido.
    const renderer = await ReactThreeTestRenderer.create(<SceneContent grid />)
    // O test-renderer tipa `instance` como `Object3D`; a sombra é da luz.
    const light = renderer.scene.findAllByType('DirectionalLight')[0].instance as unknown as THREE.DirectionalLight

    expect(light.shadow.intensity).toBe(SHADOW_INTENSITY)
    expect(SHADOW_INTENSITY).toBeGreaterThan(0)
    expect(SHADOW_INTENSITY).toBeLessThan(1)
  })

  it('shows the grid helper when grid=true and hides it when grid=false', async () => {
    const withGrid = await ReactThreeTestRenderer.create(<SceneContent grid />)
    expect(withGrid.scene.findAllByType('GridHelper')).toHaveLength(1)

    const withoutGrid = await ReactThreeTestRenderer.create(<SceneContent grid={false} />)
    expect(withoutGrid.scene.findAllByType('GridHelper')).toHaveLength(0)
  })
})
