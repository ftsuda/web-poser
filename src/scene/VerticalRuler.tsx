import {
  GRID_SPACING_M,
  OVERLAY_NAMES,
  RULER_HEIGHT_M,
  RULER_MINOR_STEP_M,
  RULER_POSITION,
} from './constants'

/**
 * Régua no eixo Y (fase 9, item 11), com o mesmo espaçamento da grade do chão
 * nos traços maiores — dá noção de altura ao levantar um boneco do chão
 * (salto/voo) e serve de referência comum para comparar as alturas de vários
 * bonecos. É overlay: some da captura de keyframe junto com a grade e os
 * gizmos (ver `OVERLAY_NAMES`).
 */

const POST_RADIUS_M = 0.006
const MAJOR_TICK_LENGTH_M = 0.16
const MINOR_TICK_LENGTH_M = 0.07
const TICK_THICKNESS_M = 0.008

const POST_COLOR = '#e8e8e8'
const MAJOR_COLOR = '#ffd11a'
const MINOR_COLOR = '#bdbdbd'

interface Tick {
  y: number
  major: boolean
}

/** Marcas fixas: não dependem de nenhuma prop/estado, então saem prontas do módulo. */
const TICKS: readonly Tick[] = Array.from(
  { length: Math.round(RULER_HEIGHT_M / RULER_MINOR_STEP_M) },
  (_, index) => {
    const y = (index + 1) * RULER_MINOR_STEP_M
    // Marca "maior" exatamente nos múltiplos do espaçamento da grade do chão,
    // como o plano pede — as demais são subdivisões de leitura.
    const major = Math.abs(y / GRID_SPACING_M - Math.round(y / GRID_SPACING_M)) < 1e-6
    return { y, major }
  },
)

export function VerticalRuler() {
  return (
    <group name={OVERLAY_NAMES.verticalRuler} position={RULER_POSITION}>
      <mesh name="vertical-ruler-post" position={[0, RULER_HEIGHT_M / 2, 0]}>
        <cylinderGeometry args={[POST_RADIUS_M, POST_RADIUS_M, RULER_HEIGHT_M, 8]} />
        <meshBasicMaterial color={POST_COLOR} />
      </mesh>

      {TICKS.map((tick) => {
        const length = tick.major ? MAJOR_TICK_LENGTH_M : MINOR_TICK_LENGTH_M
        return (
          <mesh
            key={tick.y}
            name={tick.major ? 'vertical-ruler-tick-major' : 'vertical-ruler-tick-minor'}
            position={[length / 2, tick.y, 0]}
          >
            <boxGeometry args={[length, TICK_THICKNESS_M, TICK_THICKNESS_M]} />
            <meshBasicMaterial color={tick.major ? MAJOR_COLOR : MINOR_COLOR} />
          </mesh>
        )
      })}
    </group>
  )
}
