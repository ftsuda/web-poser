import * as THREE from 'three'
import {
  DEFAULT_PROP_SIZE,
  vertexOffsetAt,
  type PropShape,
  type SceneProp,
  type Vec3,
  type VertexOffsets,
} from './sceneProp'

/**
 * A geometria dos objetos de cena: primitiva unitária → tamanho em metros →
 * vértices movidos à mão.
 *
 * **Nada de `scale` de nó.** A geometria é construída já no tamanho real, com
 * as posições do buffer em metros. É o que permite o vértice livre existir:
 * os desvios são metros ABSOLUTOS, e uma escala no nó os multiplicaria junto
 * com a primitiva — puxar um canto 10 cm passaria a valer 20 cm se a caixa
 * dobrasse de tamanho. Um caminho de código só para desenhar e para medir a malha
 * deformada de verdade, e não com uma primitiva mais uma escala que o Blender
 * teria de reinterpretar.
 *
 * **O que se arrasta é um PONTO DE CONTROLE, não um vértice do buffer.** O
 * `BoxGeometry` do three tem 24 vértices, não 8: cada face precisa dos seus,
 * para ter normal e UV próprios. Mover "um canto" mexendo num só desses
 * vértices rasgaria a malha em três pedaços. Aqui os vértices coincidentes são
 * SOLDADOS num ponto de controle, e mover o ponto move as três cópias juntas —
 * a caixa continua fechada, virando um hexaedro qualquer em vez de rasgar.
 *
 * **Os índices dos pontos de controle são contrato de arquivo.** Um desvio
 * gravado é `{ índice: [dx,dy,dz] }`, então mudar a subdivisão de uma forma
 * remapearia deformações já salvas para vértices errados. Por isso
 * `PROP_SEGMENTS` é constante, a soldagem é feita sobre a primitiva UNITÁRIA
 * (a ordem não depende do tamanho do objeto) e há um teste travando a
 * contagem de pontos de cada forma.
 */

/**
 * Subdivisão de cada forma. **Não mude estes números sem migrar os desvios de
 * vértice já gravados** — ver o cabeçalho acima.
 */
export const PROP_SEGMENTS = {
  /** Segmentos radiais de cilindro e cone. */
  radial: 16,
  /** Meridianos e paralelos da esfera. */
  sphereWidth: 16,
  sphereHeight: 8,
} as const

/** Um ponto de controle: onde ele fica na primitiva unitária e quais vértices do buffer ele arrasta junto. */
export interface ControlPoint {
  /** Posição na primitiva unitária (cabe numa caixa 1×1×1 centrada na origem). */
  unit: Vec3
  /** Índices no atributo `position` que compartilham esta posição. */
  vertices: number[]
}

/**
 * A rampa — um prisma triangular que sobe do fundo (−Z) até a face da frente
 * (+Z). Não existe primitiva pronta no three, e uma `ExtrudeGeometry` traria
 * biselamento e UVs que não interessam aqui: 8 triângulos escritos à mão são
 * menos código e dão exatamente 6 pontos de controle depois da soldagem.
 *
 * Não indexada de propósito: com um vértice por canto de face, o
 * `computeVertexNormals` devolve normais CHAPADAS, que é como uma rampa tem de
 * ler. A soldagem para os pontos de controle acontece depois, e é independente
 * disso.
 */
function buildUnitRamp(): THREE.BufferGeometry {
  const a: Vec3 = [-0.5, -0.5, -0.5]
  const b: Vec3 = [0.5, -0.5, -0.5]
  const c: Vec3 = [-0.5, -0.5, 0.5]
  const d: Vec3 = [0.5, -0.5, 0.5]
  const e: Vec3 = [-0.5, 0.5, 0.5]
  const f: Vec3 = [0.5, 0.5, 0.5]

  const triangles: Vec3[][] = [
    [a, d, c], [a, b, d], // base
    [c, d, f], [c, f, e], // face vertical da frente
    [a, f, b], [a, e, f], // o plano inclinado
    [a, c, e], // lateral esquerda
    [b, f, d], // lateral direita
  ]

  const positions = new Float32Array(triangles.length * 9)
  triangles.forEach((triangle, triangleIndex) => {
    triangle.forEach((vertex, vertexIndex) => {
      positions.set(vertex, triangleIndex * 9 + vertexIndex * 3)
    })
  })

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

/**
 * A primitiva de cada forma, unitária (dentro de uma caixa 1×1×1 centrada na
 * origem) — é o `size` que a leva ao tamanho real depois.
 */
function buildUnitGeometry(shape: PropShape): THREE.BufferGeometry {
  switch (shape) {
    case 'box':
      return new THREE.BoxGeometry(1, 1, 1)
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, PROP_SEGMENTS.radial)
    case 'sphere':
      return new THREE.SphereGeometry(0.5, PROP_SEGMENTS.sphereWidth, PROP_SEGMENTS.sphereHeight)
    case 'cone':
      return new THREE.ConeGeometry(0.5, 1, PROP_SEGMENTS.radial)
    case 'plane':
      // Folha em XY, como o `PlaneGeometry` nasce: uma parede/fundo. Quem a
      // quiser deitada no chão gira 90° em X, como qualquer outro objeto.
      return new THREE.PlaneGeometry(1, 1)
    case 'ramp':
      return buildUnitRamp()
  }
}

/**
 * Chave de posição para a soldagem. Quantizar em 1e-4 basta e sobra na
 * primitiva UNITÁRIA (o menor vão entre dois vértices distintos é ~2e-2, na
 * esfera), e é o que absorve o ruído de ponto flutuante dos senos e cossenos
 * que geram cilindro, cone e esfera — sem ele, os dois lados da costura de uma
 * esfera não soldariam e a malha abriria ao mover o vértice.
 *
 * O `|| 0` existe por causa do `-0`: `Math.round(-1e-9 * 1e4)` é `-0`, cuja
 * string é `"0"` em template literal mas `-0` em comparação — melhor não
 * depender disso.
 */
function positionKey(x: number, y: number, z: number): string {
  const q = (value: number): number => Math.round(value * 1e4) || 0
  return `${q(x)},${q(y)},${q(z)}`
}

function computeControlPoints(geometry: THREE.BufferGeometry): ControlPoint[] {
  const position = geometry.getAttribute('position')
  const byKey = new Map<string, ControlPoint>()
  const points: ControlPoint[] = []

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const key = positionKey(x, y, z)

    const existing = byKey.get(key)
    if (existing) {
      existing.vertices.push(index)
      continue
    }

    const point: ControlPoint = { unit: [x, y, z], vertices: [index] }
    byKey.set(key, point)
    points.push(point)
  }

  return points
}

/**
 * As primitivas unitárias e seus pontos de controle são CONSTANTES do
 * programa: valem para todos os objetos daquela forma e não dependem de
 * tamanho nem de deformação. Calculados uma vez, na primeira vez que a forma
 * aparece.
 */
const unitCache = new Map<PropShape, { geometry: THREE.BufferGeometry; controlPoints: ControlPoint[] }>()

function unitOf(shape: PropShape) {
  const cached = unitCache.get(shape)
  if (cached) return cached

  const geometry = buildUnitGeometry(shape)
  const entry = { geometry, controlPoints: computeControlPoints(geometry) }
  unitCache.set(shape, entry)
  return entry
}

/** Os pontos de controle de uma forma, na ordem em que os desvios os indexam. */
export function controlPointsOf(shape: PropShape): readonly ControlPoint[] {
  return unitOf(shape).controlPoints
}

/** Quantos vértices arrastáveis a forma tem — o limite de índice válido num `vertexOffsets`. */
export function controlPointCount(shape: PropShape): number {
  return unitOf(shape).controlPoints.length
}

/**
 * O tamanho efetivo: o `plane` é uma folha, então o eixo Z não escala nada
 * (a `PlaneGeometry` não tem profundidade) — zerá-lo aqui mantém a conta de
 * posição dos pontos de controle igual à da geometria.
 */
function effectiveSize(shape: PropShape, size: Vec3): Vec3 {
  return shape === 'plane' ? [size[0], size[1], 0] : size
}

/** Onde um ponto de controle está, em metros, no espaço local do objeto (tamanho + desvio). */
export function controlPointPosition(
  shape: PropShape,
  size: Vec3,
  offsets: VertexOffsets,
  index: number,
): Vec3 {
  const point = unitOf(shape).controlPoints[index]
  if (!point) return [0, 0, 0]

  const scale = effectiveSize(shape, size)
  const offset = vertexOffsetAt(offsets, index)
  return [
    point.unit[0] * scale[0] + offset[0],
    point.unit[1] * scale[1] + offset[1],
    point.unit[2] * scale[2] + offset[2],
  ]
}

/** Todas as posições de alça de um objeto, na ordem dos índices. */
export function controlPointPositions(prop: SceneProp): Vec3[] {
  return unitOf(prop.shape).controlPoints.map((_, index) =>
    controlPointPosition(prop.shape, prop.size, prop.vertexOffsets, index),
  )
}

/**
 * A geometria pronta de um objeto: primitiva unitária levada ao tamanho em
 * metros, com cada ponto de controle movido pelo seu desvio (as três ou quatro
 * cópias de vértice juntas) e as normais recalculadas — sem isso, uma face
 * puxada continuaria sombreada como se estivesse no lugar antigo.
 */
export function buildPropGeometry(prop: SceneProp): THREE.BufferGeometry {
  const { geometry: unit, controlPoints } = unitOf(prop.shape)
  const geometry = unit.clone()
  const scale = effectiveSize(prop.shape, prop.size)
  geometry.scale(scale[0], scale[1], scale[2])

  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  for (const [key, offset] of Object.entries(prop.vertexOffsets)) {
    const point = controlPoints[Number(key)]
    if (!point) continue
    for (const vertex of point.vertices) {
      position.setXYZ(
        vertex,
        position.getX(vertex) + offset[0],
        position.getY(vertex) + offset[1],
        position.getZ(vertex) + offset[2],
      )
    }
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

const scratchEuler = new THREE.Euler()
const scratchVector = new THREE.Vector3()

/**
 * A altura (`position[1]`) que apoia o objeto no chão — o análogo do
 * `seatFigureOnGround` do boneco.
 *
 * Mede os pontos de controle JÁ GIRADOS, e não a caixa da primitiva: uma rampa
 * inclinada 30° e um cubo com um canto puxado para baixo tocam o chão em
 * lugares que só a geometria real conhece. Como todo vértice do buffer
 * pertence a algum ponto de controle, o mínimo entre eles é o mínimo da malha.
 */
export function propGroundOffset(prop: SceneProp): number {
  scratchEuler.set(
    THREE.MathUtils.degToRad(prop.rotation.x),
    THREE.MathUtils.degToRad(prop.rotation.y),
    THREE.MathUtils.degToRad(prop.rotation.z),
  )

  let lowest = Number.POSITIVE_INFINITY
  for (const local of controlPointPositions(prop)) {
    scratchVector.set(local[0], local[1], local[2]).applyEuler(scratchEuler)
    if (scratchVector.y < lowest) lowest = scratchVector.y
  }

  return Number.isFinite(lowest) ? -lowest : prop.position[1]
}

/** Tamanho padrão da forma — reexportado aqui para quem já está lidando com geometria. */
export function defaultSizeOf(shape: PropShape): Vec3 {
  return DEFAULT_PROP_SIZE[shape]
}
