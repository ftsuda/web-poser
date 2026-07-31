import type { JointRotation } from '../figure/skeleton'
import { normalizeHexColor } from '../scene/hexColor'

/**
 * Modelo de dados dos OBJETOS DE CENA — cubo, paralelepípedo, cilindro,
 * esfera, cone, plano e rampa —, o cenário simples em volta dos bonecos
 * (PLANO.md > lista de propostas, item 42).
 *
 * Três decisões de topo, tomadas com o usuário antes de escrever isto:
 *
 * 1. **Tamanho em METROS por eixo, nunca escala.** `size` é a medida real do
 *    objeto, na mesma unidade em que o boneco tem 1,70 m e a grade tem 1 m de
 *    passo. O gizmo de escala do viewport é só um jeito de arrastar esse
 *    número — o que fica gravado é sempre metro.
 *
 * 2. **Cenário estático.** O objeto NÃO entra no retrato dos keyframes
 *    (`AnimationKeyframe.figures`): ele é o cenário, e cenário não anda. Isso
 *    mantém a animação, a biblioteca de trechos e o remapeamento de elenco
 *    exatamente como estão, e é o que separa este item de um "objeto ator".
 *
 * 3. **Vértice livre** (escolha do usuário, contra a recomendação inicial de
 *    limitar a alças de face/canto): qualquer ponto de controle pode ser
 *    arrastado para onde se quiser, e o objeto deixa de ser a primitiva exata.
 *    O que o arquivo guarda continua sendo `forma + tamanho + desvios`, e não
 *    uma malha solta — ver `vertexOffsets`.
 */

export type PropShape = 'box' | 'cylinder' | 'sphere' | 'cone' | 'plane' | 'ramp'

/** Ordem em que as formas aparecem na UI. */
export const PROP_SHAPES: readonly PropShape[] = ['box', 'cylinder', 'sphere', 'cone', 'plane', 'ramp']

export type Vec3 = readonly [number, number, number]

/**
 * Deslocamento de cada ponto de controle movido à mão, em METROS ABSOLUTOS,
 * no espaço local do objeto — indexado pelo índice do ponto de controle
 * (`propGeometry.ts`), não pelo índice cru do vértice no buffer.
 *
 * **Esparso de propósito:** só o que foi movido entra, então um objeto intacto
 * não ocupa nada no `localStorage` nem no arquivo da cena.
 *
 * **Absoluto de propósito:** mudar o `size` depois move a primitiva de base e
 * mantém o desvio do mesmo tamanho. É o que casa com "tudo em metros" — um
 * canto puxado 10 cm continua puxado 10 cm quando a caixa cresce.
 */
export type VertexOffsets = Record<number, Vec3>

export interface SceneProp {
  id: string
  name: string
  shape: PropShape
  /** Cor livre `#rrggbb`, como a do boneco (DECISOES.md #39) — trocável a qualquer momento pelo painel. */
  color: string
  /** Conteúdo: desligado, o objeto some de TUDO, inclusive do PNG e do MP4. */
  visible: boolean
  /**
   * Some só da BANCADA (modo de edição), continuando a sair na captura — o
   * oposto exato dos `OVERLAY_NAMES`, que aparecem na tela e somem no arquivo.
   * Serve para tirar da frente um cenário que atrapalha enquanto se posa, sem
   * removê-lo da cena. Ver `sceneCapture.revealEditorHidden`.
   */
  hiddenInEditor: boolean
  /** Travado: continua visível, mas não pega clique no viewport nem aceita edição — evita selecionar o cenário por engano ao posar. */
  locked: boolean
  /** Posição do CENTRO do objeto, em metros (ver `propGeometry.propGroundOffset`). */
  position: Vec3
  /** Rotação livre, em graus — colocação, como a do root do boneco: não passa por limites articulares. */
  rotation: JointRotation
  /** Medida real por eixo, em metros. No `plane` o eixo Y é a profundidade do plano e Z é ignorado. */
  size: Vec3
  /** Vértices movidos à mão; objeto sem deformação nenhuma tem `{}`. */
  vertexOffsets: VertexOffsets
}

/**
 * Teto de objetos por cena. Não é limitação técnica de render (um cubo custa
 * uma fração de um boneco): é a cota do `localStorage`, que o autosave já pode
 * estourar (ver `autosave.saveWorkspaceToLocalStorage`), somada ao catálogo de
 * cenas — cada snapshot salvo carrega a própria lista de objetos.
 */
export const MAX_PROPS = 20

/** Um centímetro é o menor objeto que ainda dá para ver e agarrar no viewport. */
export const MIN_PROP_SIZE_M = 0.01
/** O tamanho do chão (`GROUND_SIZE`): um objeto maior que o mundo não é cenário, é engano. */
export const MAX_PROP_SIZE_M = 20

/**
 * Cinza neutro. Deliberadamente FORA da paleta dos bonecos (`COLOR_PALETTE`):
 * cenário não pode nascer parecendo personagem. A cor é livre a partir daí.
 */
export const DEFAULT_PROP_COLOR = '#9a9a9a'

/**
 * Tamanho inicial de cada forma, em metros — medidas de objeto de cena real
 * ao lado de um boneco de 1,70 m (caixa de meio metro, poste de 1,8 m, plano
 * de 2×2 m).
 */
export const DEFAULT_PROP_SIZE: Record<PropShape, Vec3> = {
  box: [0.5, 0.5, 0.5],
  cylinder: [0.4, 0.8, 0.4],
  sphere: [0.5, 0.5, 0.5],
  cone: [0.5, 0.8, 0.5],
  // O plano é uma folha em XY (parede/fundo): Z existe só para o campo ter
  // três eixos, e a geometria o ignora.
  plane: [2, 2, MIN_PROP_SIZE_M],
  ramp: [1, 0.5, 1],
}

export const normalizePropColor = normalizeHexColor

function clampAxis(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(MAX_PROP_SIZE_M, Math.max(MIN_PROP_SIZE_M, value))
}

/** Grampeia as três medidas; o que não for número cai no padrão da forma, em vez de virar `NaN` na geometria. */
export function clampPropSize(size: unknown, shape: PropShape = 'box'): Vec3 {
  const fallback = DEFAULT_PROP_SIZE[shape] ?? DEFAULT_PROP_SIZE.box
  const source = Array.isArray(size) ? size : []
  return [
    clampAxis(source[0], fallback[0]),
    clampAxis(source[1], fallback[1]),
    clampAxis(source[2], fallback[2]),
  ]
}

/**
 * Grampeia um desvio de vértice. A faixa é simétrica e do tamanho do mundo:
 * puxar um canto para longe é legítimo (é o ponto de "vértice livre"), mas um
 * valor absurdo vindo de arquivo editado à mão não pode explodir a caixa
 * delimitadora que enquadra a câmera.
 */
export function clampVertexOffset(value: unknown): Vec3 {
  const source = Array.isArray(value) ? value : []
  const axis = (index: number): number => {
    const raw = source[index]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0
    return Math.min(MAX_PROP_SIZE_M, Math.max(-MAX_PROP_SIZE_M, raw))
  }
  return [axis(0), axis(1), axis(2)]
}

const ZERO: Vec3 = [0, 0, 0]

function isZero(offset: Vec3): boolean {
  return offset[0] === 0 && offset[1] === 0 && offset[2] === 0
}

/**
 * Lê os desvios de vértice de uma fonte não confiável (autosave, arquivo de cena
 * editado à mão). `controlPointCount` é quantos pontos a forma tem: índice
 * fora da faixa é DESCARTADO, e não grampeado — um desvio que caiu em outro
 * vértice deformaria o objeto num lugar que ninguém pediu.
 *
 * Desvio zero também sai: a representação de "intacto" é a ausência da chave.
 */
export function sanitizeVertexOffsets(value: unknown, controlPointCount: number): VertexOffsets {
  if (typeof value !== 'object' || value === null) return {}

  const offsets: VertexOffsets = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0 || index >= controlPointCount) continue
    const offset = clampVertexOffset(raw)
    if (isZero(offset)) continue
    offsets[index] = offset
  }
  return offsets
}

/** O desvio de um ponto de controle, ou zero quando ele nunca foi movido. */
export function vertexOffsetAt(offsets: VertexOffsets, index: number): Vec3 {
  return offsets[index] ?? ZERO
}

/**
 * Grava um desvio, devolvendo um mapa NOVO (o store é imutável). Um desvio
 * zerado apaga a chave — é o que faz "voltar o vértice ao lugar" devolver o
 * objeto ao estado intacto, e não a um objeto com deformação nula gravada.
 */
export function withVertexOffset(offsets: VertexOffsets, index: number, offset: Vec3): VertexOffsets {
  const next = { ...offsets }
  if (isZero(offset)) delete next[index]
  else next[index] = offset
  return next
}

/** Quantos vértices foram movidos à mão — o que o painel mostra ao lado do botão de desfazer a deformação. */
export function vertexOffsetCount(offsets: VertexOffsets): number {
  return Object.keys(offsets).length
}

export function isPropShape(value: unknown): value is PropShape {
  return typeof value === 'string' && (PROP_SHAPES as readonly string[]).includes(value)
}
