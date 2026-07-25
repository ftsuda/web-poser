import { describe, expect, it } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import {
  GRID_SPACING_M,
  OVERLAY_NAMES,
  OVERLAY_NAME_LIST,
  RULER_HEIGHT_M,
  RULER_MINOR_STEP_M,
} from '../constants'
import { GridAlignmentIndicator } from '../GridAlignmentIndicator'
import { VerticalRuler } from '../VerticalRuler'

describe('VerticalRuler (fase 9, item 11)', () => {
  it('marca os metros da grade com traços maiores e subdivide entre eles', async () => {
    const renderer = await ReactThreeTestRenderer.create(<VerticalRuler />)

    const major = renderer.scene.findAllByProps({ name: 'vertical-ruler-tick-major' })
    const minor = renderer.scene.findAllByProps({ name: 'vertical-ruler-tick-minor' })

    // Um traço maior por linha da grade dentro da altura da régua...
    expect(major).toHaveLength(Math.floor(RULER_HEIGHT_M / GRID_SPACING_M))
    // ...e o restante das marcas finas completa o total de subdivisões.
    expect(major.length + minor.length).toBe(Math.round(RULER_HEIGHT_M / RULER_MINOR_STEP_M))
  })

  it('sobe do chão até a altura declarada', async () => {
    const renderer = await ReactThreeTestRenderer.create(<VerticalRuler />)

    const post = renderer.scene.findByProps({ name: 'vertical-ruler-post' })
    // A haste é centrada na metade da altura, logo cobre de 0 a RULER_HEIGHT_M.
    expect(post.instance.position.y).toBeCloseTo(RULER_HEIGHT_M / 2, 5)
  })

  it('é um overlay: some da captura quando "ocultar grade/gizmos" está ligado', async () => {
    const renderer = await ReactThreeTestRenderer.create(<VerticalRuler />)
    expect(renderer.scene.findByProps({ name: OVERLAY_NAMES.verticalRuler })).toBeDefined()
    expect(OVERLAY_NAME_LIST).toContain(OVERLAY_NAMES.verticalRuler)
  })
})

describe('GridAlignmentIndicator (fase 9, item 10)', () => {
  it('não desenha nada quando a posição não está sobre nenhuma linha', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GridAlignmentIndicator position={[GRID_SPACING_M / 2, 0, GRID_SPACING_M / 2]} />,
    )
    expect(renderer.scene.findAllByProps({ name: OVERLAY_NAMES.gridAlignment })).toHaveLength(0)
  })

  it('destaca só o eixo alinhado, na linha mais próxima', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GridAlignmentIndicator position={[2 * GRID_SPACING_M + 0.005, 0, GRID_SPACING_M / 2]} />,
    )

    const highlight = renderer.scene.findByProps({ name: 'grid-alignment-x' })
    // Fica na linha (múltiplo exato), não na posição solta do boneco — é
    // indicador, mas aponta a linha de verdade.
    expect(highlight.instance.position.x).toBeCloseTo(2 * GRID_SPACING_M, 6)
    expect(renderer.scene.findAllByProps({ name: 'grid-alignment-z' })).toHaveLength(0)
  })

  it('destaca os dois eixos num cruzamento da grade', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GridAlignmentIndicator position={[GRID_SPACING_M, 1.2, -GRID_SPACING_M]} />,
    )

    expect(renderer.scene.findAllByProps({ name: 'grid-alignment-x' })).toHaveLength(1)
    expect(renderer.scene.findAllByProps({ name: 'grid-alignment-z' })).toHaveLength(1)
  })
})
