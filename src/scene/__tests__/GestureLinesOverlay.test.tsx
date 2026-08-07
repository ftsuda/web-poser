import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import type * as THREE from 'three'
import { resolvePosePreset } from '../../figure/posePresets'
import type { Figure } from '../../store/figuresStore'
import { GestureLinesOverlay } from '../GestureLinesOverlay'
import { OVERLAY_NAMES, OVERLAY_NAME_LIST } from '../constants'

/**
 * As linhas de gesto na cena (PLANO.md item 9). A geometria em si é conferida
 * no `gestureLines.test.ts`, que é puro; aqui trava-se o que só existe montado:
 * as três malhas, o registro como overlay e o desenho POR CIMA do boneco.
 */
const FIGURE: Figure = {
  id: 'figure-1',
  name: 'Boneco 1',
  color: '#e04040',
  visible: true,
  height: 1.7,
  position: [0, 0, 0],
  rotation: { x: 0, y: 0, z: 0 },
  pose: resolvePosePreset('standing'),
}

describe('GestureLinesOverlay (item 9)', () => {
  it('desenha três tubos: a linha de ação e as duas transversais', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GestureLinesOverlay figure={FIGURE} />)
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(3)
  })

  it('é overlay: entra na lista que a captura esconde', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GestureLinesOverlay figure={FIGURE} />)

    expect(renderer.scene.findByProps({ name: OVERLAY_NAMES.gestureLines })).toBeDefined()
    expect(OVERLAY_NAME_LIST).toContain(OVERLAY_NAMES.gestureLines)
  })

  it('desenha POR CIMA do corpo — enterrada no volume a linha não serviria', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GestureLinesOverlay figure={FIGURE} />)
    for (const mesh of renderer.scene.findAllByType('Mesh')) {
      const material = (mesh.instance as unknown as { material: { depthTest: boolean } }).material
      expect(material.depthTest).toBe(false)
    }
  })

  it('sem boneco selecionado, não renderiza nada', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GestureLinesOverlay figure={null} />)
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0)
  })

  /**
   * Geometria é recurso de GPU e não some com o coletor de lixo. Os três tubos
   * são refeitos a cada pose nova — num arrasto de gizmo, dezenas por segundo —,
   * e sem descarte cada um deles ficava para trás. Mesma proteção do objeto de
   * cena (`SceneProps.tsx`), pelo mesmo motivo.
   */
  function geometriasDe(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
    return renderer.scene
      .findAllByType('Mesh')
      .map((mesh) => (mesh.instance as unknown as { geometry: THREE.BufferGeometry }).geometry)
  }

  function marcarDescarte(geometrias: THREE.BufferGeometry[]): () => number {
    let descartadas = 0
    for (const geometria of geometrias) geometria.addEventListener('dispose', () => (descartadas += 1))
    return () => descartadas
  }

  it('descarta as geometrias antigas quando a pose muda', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GestureLinesOverlay figure={FIGURE} />)
    const antigas = geometriasDe(renderer)
    const descartadas = marcarDescarte(antigas)
    expect(antigas).toHaveLength(3)

    await renderer.update(
      <GestureLinesOverlay figure={{ ...FIGURE, pose: resolvePosePreset('sitting') }} />,
    )

    expect(descartadas()).toBe(3)
    for (const nova of geometriasDe(renderer)) expect(antigas).not.toContain(nova)
  })

  it('descarta as geometrias ao sair de cena', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GestureLinesOverlay figure={FIGURE} />)
    const descartadas = marcarDescarte(geometriasDe(renderer))

    await renderer.unmount()

    expect(descartadas()).toBe(3)
  })
})
