import { GROUND_SIZE, OVERLAY_NAMES } from './constants'
import { gridAlignmentOf, nearestGridLine } from './gridAlignment'

/** Cor do destaque — quente e saturada, para se separar dos cinzas da grade. */
const HIGHLIGHT_COLOR = '#ffd11a'
/** Largura da faixa destacada, em metros (a linha da grade em si é de 1 px). */
const HIGHLIGHT_WIDTH_M = 0.02
/** Um fio acima do chão/grade, para não brigar no z-buffer. */
const HIGHLIGHT_Y = 0.004

export interface GridAlignmentIndicatorProps {
  /** Posição sendo arrastada (root do boneco ou alvo de IK), em coordenadas de mundo. */
  position: readonly [number, number, number]
}

/**
 * Destaca a linha da grade sobre a qual a posição arrastada está (fase 9,
 * item 10) — uma faixa por eixo alinhado, atravessando o chão. Não altera a
 * posição: o plano pede indicador, não snapping.
 */
export function GridAlignmentIndicator({ position }: GridAlignmentIndicatorProps) {
  const alignment = gridAlignmentOf(position)
  if (!alignment.x && !alignment.z) return null

  return (
    <group name={OVERLAY_NAMES.gridAlignment}>
      {alignment.x && (
        <mesh
          name="grid-alignment-x"
          position={[nearestGridLine(position[0]), HIGHLIGHT_Y, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[HIGHLIGHT_WIDTH_M, GROUND_SIZE]} />
          <meshBasicMaterial color={HIGHLIGHT_COLOR} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}
      {alignment.z && (
        <mesh
          name="grid-alignment-z"
          position={[0, HIGHLIGHT_Y, nearestGridLine(position[2])]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[GROUND_SIZE, HIGHLIGHT_WIDTH_M]} />
          <meshBasicMaterial color={HIGHLIGHT_COLOR} transparent opacity={0.85} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
