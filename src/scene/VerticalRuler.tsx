import { GRID_SPACING_M, OVERLAY_NAMES, RULER_HEIGHT_M, RULER_MINOR_STEP_M } from './constants'

/**
 * Régua no eixo Y (fase 9, item 11), com o mesmo espaçamento da grade do chão
 * nos traços maiores — dá noção de altura ao levantar um boneco do chão
 * (salto/voo) e serve de referência comum para comparar as alturas de vários
 * bonecos. É overlay: some da captura de keyframe junto com a grade e os
 * gizmos (ver `OVERLAY_NAMES`).
 *
 * Nasce ancorada no boneco selecionado — no mesmo ponto do chão em que fica o
 * gizmo de translação da raiz —, e não num canto fixo da grade como na versão
 * original (pedido do usuário; ver DECISOES.md #33). Sem seleção não há âncora
 * e a régua não é desenhada.
 */

const POST_RADIUS_M = 0.006
const MAJOR_TICK_LENGTH_M = 0.16
const MINOR_TICK_LENGTH_M = 0.07
const TICK_THICKNESS_M = 0.008

const POST_COLOR = '#e8e8e8'
const MAJOR_COLOR = '#ffd11a'
const MINOR_COLOR = '#bdbdbd'

/**
 * Ancorada no boneco, a régua atravessa o corpo — e ficaria enterrada nele
 * justamente na faixa mais interessante de leitura: o bloco do peito chega a
 * 0,148 m de raio (ver `skeleton.ts`), então até o traço maior (0,16 m) só
 * apareceria 12 mm para fora, e os traços finos (0,07 m) sumiriam por
 * completo. Desenhar sem teste de profundidade resolve sem mexer na geometria,
 * e é o mesmo tratamento que o gizmo de transformação já recebe.
 */
const RENDER_ORDER = 2

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

export interface VerticalRulerProps {
  /**
   * Posição do boneco selecionado (a mesma da raiz/gizmo de translação).
   * `null` = nada selecionado, e a régua não aparece.
   */
  position: readonly [number, number, number] | null
}

export function VerticalRuler({ position }: VerticalRulerProps) {
  if (!position) return null

  // O Y da âncora é descartado de propósito: a régua sempre nasce no chão,
  // senão ela subiria junto com um boneco erguido e a altura que se quer ler
  // (a distância até o chão) marcaria zero.
  const [x, , z] = position

  return (
    <group name={OVERLAY_NAMES.verticalRuler} position={[x, 0, z]}>
      <mesh name="vertical-ruler-post" position={[0, RULER_HEIGHT_M / 2, 0]} renderOrder={RENDER_ORDER}>
        <cylinderGeometry args={[POST_RADIUS_M, POST_RADIUS_M, RULER_HEIGHT_M, 8]} />
        <meshBasicMaterial color={POST_COLOR} depthTest={false} />
      </mesh>

      {TICKS.map((tick) => {
        const length = tick.major ? MAJOR_TICK_LENGTH_M : MINOR_TICK_LENGTH_M
        return (
          <mesh
            key={tick.y}
            name={tick.major ? 'vertical-ruler-tick-major' : 'vertical-ruler-tick-minor'}
            position={[length / 2, tick.y, 0]}
            renderOrder={RENDER_ORDER}
          >
            <boxGeometry args={[length, TICK_THICKNESS_M, TICK_THICKNESS_M]} />
            <meshBasicMaterial color={tick.major ? MAJOR_COLOR : MINOR_COLOR} depthTest={false} />
          </mesh>
        )
      })}
    </group>
  )
}
