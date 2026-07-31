/**
 * Fonte única do esqueleto do boneco: hierarquia de 32 juntas, offsets locais
 * (em metros, para a altura de referência) e limites articulares por eixo.
 * Usado pelo FK, pelo IK (fase 7) e pela validação ao carregar cenas.
 *
 * Convenção de eixos por junta: Euler XYZ; um eixo sem entrada em `limits`
 * não é um grau de liberdade daquela junta (fica travado em 0).
 *
 * Convenção de sinal do eixo X (flexão/extensão), confirmada numericamente
 * (construindo a árvore cinemática e medindo a posição resultante no mundo,
 * ver `DECISOES.md` #13 e #14): como a rotação em X sempre inclina o filho
 * da junta no mesmo sentido de giro, mas o filho fica "acima" nas juntas de
 * tronco (`spine`/`chest`/`upperChest`/`neck`) e "abaixo" nas de membro, o
 * sinal que representa "flexão para a frente (+Z)" acaba invertido entre os
 * dois grupos — não é inconsistência, é a mesma rotação vista de lados
 * opostos:
 * - Tronco (`spine`/`chest`/`upperChest`/`neck`/`head`): **X positivo =
 *   flexiona para a frente** (curvar para frente); negativo = estende para
 *   trás.
 * - Membros com filho "para baixo" (`hip`/`shoulder`/`elbow`/`knee`/`wrist`):
 *   **X negativo = flexiona para a frente** (ex.: erguer a coxa, levantar o
 *   braço, dobrar o cotovelo trazendo a mão para frente); positivo = estende
 *   para trás. Exceção: `knee`/`ball` — a flexão real dessas juntas é para
 *   TRÁS (joelho/planta do pé dobram ao contrário do cotovelo), então nelas
 *   positivo = flexão.
 * - `ankle`: X positivo = flexão plantar (aponta o pé para baixo, maior
 *   amplitude real); negativo = dorsiflexão (levanta a ponta do pé, menor
 *   amplitude).
 *
 * Convenção de sinal dos eixos Y (torção/giro) e Z (abdução/lateral) em
 * juntas pareadas L/R (`clavicle`, `shoulder`, `hip`, `wrist`, `ankle`):
 * como a junta R é só um espelhamento de posição (offset X negado), sem
 * espelhar a rotação em si, o **mesmo valor numérico produz o movimento
 * anatômico OPOSTO em L e R** nesses dois eixos (ex.: `shoulder.L.z`
 * positivo abre o braço para o lado — abdução —, mas `shoulder.R.z`
 * positivo puxa o braço para o outro lado do corpo — adução). Isso é
 * inerente a espelhar só a posição (convenção comum em rigs 3D, não um bug
 * de faixa: as faixas desses eixos já são simétricas nos dois lados) — uma
 * pose simétrica (ex.: "braços abertos") precisa usar **sinais opostos**
 * entre L e R nesses dois eixos. O eixo X não sofre disso (não depende da
 * coordenada X, só de Y/Z). Investigação completa em `DECISOES.md` #14.
 *
 * Consequência direta disso: refletir uma pose no plano sagital é
 * `(x, y, z) → (x, -y, -z)` na junta pareada — EXATO, não aproximado
 * (rotação é pseudovetor, e para Euler XYZ vale `M·Rx(a)Ry(b)Rz(c)·M =
 * Rx(a)Ry(-b)Rz(-c)` com `M = diag(-1,1,1)`; verificado numericamente com
 * erro 0,000 m em todas as juntas pareadas, ver `poseMirror.ts` e
 * DECISOES.md #30). Para essa regra valer, os LIMITES dos dois lados também
 * precisam ser espelho um do outro em Y/Z — hoje todos são (o `clavicle.z`
 * do lado R foi corrigido no #30 justamente por ser a única exceção).
 *
 * Convenção da MÃO (juntas de `wrist` para baixo, ver `DECISOES.md` #25): a
 * mão é modelada ALINHADA aos eixos locais do punho — dedos ao longo de -Y,
 * polegar ao longo de -X (L) / +X (R), palma voltada para -Z, dorso para
 * +Z, nos dois lados. É a torção neutra do antebraço (`elbow.y = ±90`,
 * aplicada por `posePresets.ts` a toda pose) que gira essa mão para a
 * orientação natural: palma na coxa em pé, palma exatamente para baixo com
 * o polegar para a frente na T-pose. Com esse alinhamento, os eixos de
 * dobra ficam anatômicos por construção: `fingers*.x` positivo curva os
 * dedos para a palma, `thumb2.y` dobra a ponta do polegar para a palma
 * (negativo no L, positivo no R), `wrist.x` é flexão pura e `wrist.z`
 * desvio radial/ulnar puro.
 *
 * Os LIMITES definidos aqui são os padrões e nunca mudam em runtime; um
 * workspace pode customizá-los (só min/max, nunca a lista de eixos) através de
 * um `joint-limits.json` — ver o bloco "Limites customizáveis" no fim do
 * arquivo e DECISOES.md #29.
 */

export type Axis = 'x' | 'y' | 'z'

export interface AxisLimit {
  min: number
  max: number
}

export type JointLimits = Partial<Record<Axis, AxisLimit>>

export interface JointDefinition {
  name: string
  parent: string | null
  /** Offset local em relação ao pai, em metros, na altura de referência (1,70 m). */
  position: readonly [number, number, number]
  /** Limites de rotação por eixo, em graus. Ausente = eixo travado (não é DOF da junta). */
  limits: JointLimits
}

export const REFERENCE_HEIGHT_M = 1.7
export const MIN_HEIGHT_M = 1.5
export const MAX_HEIGHT_M = 1.9

export const ROOT_JOINT_NAME = 'root'

const FREE_JOINTS = new Set<string>([ROOT_JOINT_NAME])

export const JOINTS: readonly JointDefinition[] = [
  // Tronco e cabeça — offsets verticais calibrados por proporções
  // antropométricas médias (Drillis & Contini, fração da altura total),
  // não pela "figura de desenho" idealizada de 8 cabeças usada no rascunho
  // original da fase 2 — ver DECISOES.md #15. `root` (quadril) já batia
  // com o valor real (0,53×1,70 ≈ 0,90 m).
  { name: 'root', parent: null, position: [0, 0.9, 0], limits: {} },
  {
    name: 'spine',
    parent: 'root',
    position: [0, 0.17, 0],
    limits: { x: { min: -30, max: 45 }, y: { min: -30, max: 30 }, z: { min: -25, max: 25 } },
  },
  {
    name: 'chest',
    parent: 'spine',
    // Encolhido de 0,32 para 0,24 m — o próprio bloco visual do chest ficou
    // mais alto (estende mais para baixo, ver `CHEST_SHAPE` em `Figure.tsx`)
    // para compensar (pedido do usuário, ver DECISOES.md #18).
    position: [0, 0.24, 0],
    limits: { x: { min: -20, max: 25 }, y: { min: -20, max: 20 }, z: { min: -15, max: 15 } },
  },
  // Junta entre chest e neck — base do pescoço/linha dos ombros, de onde as
  // clavículas partem (não mais diretamente do chest). Dá um ajuste fino de
  // inclinação frente/trás independente de dobrar o tórax inteiro (pedido
  // do usuário, ver DECISOES.md #16); divide o antigo offset chest→neck
  // (0,08 m) em dois saltos menores, mantendo o total.
  {
    name: 'upperChest',
    parent: 'chest',
    position: [0, 0.04, 0],
    limits: { x: { min: -15, max: 15 } },
  },
  {
    name: 'neck',
    parent: 'upperChest',
    position: [0, 0.04, 0],
    limits: { x: { min: -40, max: 50 }, y: { min: -60, max: 60 }, z: { min: -30, max: 30 } },
  },
  {
    name: 'head',
    parent: 'neck',
    position: [0, 0.16, 0],
    limits: { x: { min: -20, max: 20 }, y: { min: -30, max: 30 }, z: { min: -15, max: 15 } },
  },

  // Braço e mão esquerdos.
  //
  // Braço recalibrado pelas ALTURAS reais dos marcos (DECISOES.md #26), não
  // pelos comprimentos de segmento usados no #15: com a junta do ombro em
  // ~1,34 m (onde o tronco do #16/#18 a assentou), úmero 0,27 e antebraço
  // 0,245 colocam cotovelo/punho/ponta dos dedos exatamente nas alturas
  // antropométricas (0,630H/0,485H/0,377H). O offset X do ombro (0,095, com
  // a clavícula: junta a ±0,195 do centro) aproxima os centros articulares
  // aos ~0,39 m reais — a envergadura resultante fecha em ~1,05×altura.
  {
    name: 'clavicle.L',
    parent: 'upperChest',
    position: [0.1, 0.01, 0],
    limits: { y: { min: -15, max: 15 }, z: { min: 0, max: 20 } },
  },
  {
    name: 'shoulder.L',
    parent: 'clavicle.L',
    position: [0.095, -0.02, 0],
    limits: { x: { min: -180, max: 90 }, y: { min: -90, max: 90 }, z: { min: -20, max: 180 } },
  },
  {
    name: 'elbow.L',
    parent: 'shoulder.L',
    position: [0, -0.27, 0],
    // y (pronação/supinação): a faixa é centrada na torção NEUTRA de +90°
    // (ver `posePresets.ts` e DECISOES.md #25) — a mão é modelada alinhada
    // aos eixos locais do punho, e é a torção neutra de 90° que a deixa com
    // a palma voltada para a coxa em repouso. A partir do neutro: até 0 =
    // pronação (palma para trás), até 180 = supinação (palma para frente) —
    // ±90° de amplitude para cada lado, como um antebraço real a partir da
    // posição de "aperto de mão".
    limits: { x: { min: -150, max: 0 }, y: { min: 0, max: 180 } },
  },
  {
    name: 'wrist.L',
    parent: 'elbow.L',
    position: [0, -0.245, 0],
    limits: { x: { min: -60, max: 60 }, z: { min: -20, max: 30 } },
  },
  // Mão remodelada ALINHADA aos eixos locais do punho (DECISOES.md #25) —
  // substitui os offsets diagonais herdados da fase 2 (e o ajuste numérico
  // fino do #24 sobre eles). No espaço local do punho: dedos = -Y (distal),
  // polegar = -X (L) / +X (R), palma = -Z, dorso = +Z. É a torção neutra do
  // antebraço de ±90° (`posePresets.ts`) que gira essa mão para a posição
  // natural (palma na coxa em pé; palma para baixo e polegar para a frente
  // na T-pose) — EXATO por construção, sem resolver nada numericamente.
  // Alinhar a mão aos eixos também alinha os EIXOS DE DOBRA: fingers*.x
  // curva os dedos exatamente em direção à palma (-Z) e wrist.x/z viram
  // flexão/desvio puros — antes, com a mão 45° fora dos eixos, tudo dobrava
  // na diagonal. Proporções antropométricas (mesma fonte do corpo, #15):
  // mão ≈ 0,108×altura ≈ 18,4 cm do punho à ponta (palma 8,5 + falanges
  // 4,3/2,7 + ponta ~2,8 na malha).
  {
    // `z` (adução: aproximar o polegar dos dedos) vai a 80°, e não a 40° como
    // até o #44 — medido: com 40° a ponta do polegar parava a 2,61 cm da linha
    // do indicador, e no punho fechado caía 2,4 cm FORA da borda da mão, ou
    // seja fechava ao lado do punho em vez de sobre ele. O contato
    // polegar-indicador (pinça, segurar objeto) só existe a partir de ~75°.
    // Ver DECISOES.md #45.
    name: 'thumb1.L',
    parent: 'wrist.L',
    position: [-0.038, -0.026, 0],
    limits: { x: { min: -20, max: 50 }, z: { min: 0, max: 80 } },
  },
  {
    // Único DOF: dobra da ponta em direção à palma (-Z). Com o polegar ao
    // longo de -X, esse eixo de dobra é o Y — negativo = flexão no lado L
    // (espelhado no R, mesma convenção Y/Z de juntas pareadas do #14).
    name: 'thumb2.L',
    parent: 'thumb1.L',
    position: [-0.034, -0.01, 0],
    limits: { y: { min: -80, max: 0 } },
  },
  // Dedo INDICADOR, separado do bloco a partir do #45: mesma cadeia de 3
  // juntas (MCP/PIP/DIP) e os MESMOS comprimentos de falange do bloco — o
  // comprimento da mão (0,183 m) já vem calibrado ali, e encurtar só o
  // indicador exigiria uma razão antropométrica que não temos como medir
  // aqui. Ocupa o quarto RADIAL da fileira dos nós (o lado do polegar):
  // X = ∓0,030, com o bloco dos outros três deslocado para o outro lado.
  // Um só grau de liberdade (flexão em X), igual ao bloco.
  {
    name: 'indexBase.L',
    parent: 'wrist.L',
    position: [-0.03, -0.085, 0],
    limits: { x: { min: 0, max: 90 } },
  },
  {
    name: 'indexMid.L',
    parent: 'indexBase.L',
    position: [0, -0.043, 0],
    limits: { x: { min: 0, max: 110 } },
  },
  {
    name: 'indexTip.L',
    parent: 'indexMid.L',
    position: [0, -0.027, 0],
    limits: { x: { min: 0, max: 90 } },
  },
  // Cadeia de 3 juntas (MCP/PIP/DIP) representando as falanges dos 3 dedos
  // restantes (médio, anelar e mínimo) em bloco — continuam dobrando todos
  // juntos (mesma simplificação da fase 2), com 3 pontos de dobra (ver
  // DECISOES.md #16). Offsets puros em -Y: o dedo desce reto ao longo da
  // palma, e x positivo curva exatamente para a palma (-Z). O pivô fica na
  // linha do punho (X = 0) mesmo com o bloco desenhado fora do centro: a
  // flexão gira em torno de X, e o eixo é a própria fileira dos nós, então a
  // posição X do pivô não muda o movimento (o deslocamento visual está em
  // `BONE_STYLES`/`JOINT_PARTS`).
  {
    name: 'fingersBase.L',
    parent: 'wrist.L',
    position: [0, -0.085, 0],
    limits: { x: { min: 0, max: 90 } },
  },
  {
    name: 'fingersMid.L',
    parent: 'fingersBase.L',
    position: [0, -0.043, 0],
    limits: { x: { min: 0, max: 110 } },
  },
  {
    name: 'fingersTip.L',
    parent: 'fingersMid.L',
    position: [0, -0.027, 0],
    limits: { x: { min: 0, max: 90 } },
  },

  // Braço e mão direitos (espelhado em X; medidas do braço = lado L, ver
  // comentário de recalibração lá — DECISOES.md #26)
  {
    // z espelhado do L (DECISOES.md #30): era `{ min: 0, max: 20 }`, igual ao
    // lado esquerdo — mas como o mesmo sinal produz o movimento anatômico
    // OPOSTO em juntas pareadas nos eixos Y/Z (ver o docblock acima e o #14),
    // essa faixa só permitia BAIXAR o ombro direito, enquanto a esquerda só
    // levantava. Era o único par do esqueleto cujos limites não eram espelho
    // um do outro, e era o que quebrava o espelhamento de pose.
    name: 'clavicle.R',
    parent: 'upperChest',
    position: [-0.1, 0.01, 0],
    limits: { y: { min: -15, max: 15 }, z: { min: -20, max: 0 } },
  },
  {
    name: 'shoulder.R',
    parent: 'clavicle.R',
    position: [-0.095, -0.02, 0],
    limits: { x: { min: -180, max: 90 }, y: { min: -90, max: 90 }, z: { min: -180, max: 20 } },
  },
  {
    // y espelhado do L (mesma convenção do #14): neutro em -90, até 0 =
    // pronação, até -180 = supinação.
    name: 'elbow.R',
    parent: 'shoulder.R',
    position: [0, -0.27, 0],
    limits: { x: { min: -150, max: 0 }, y: { min: -180, max: 0 } },
  },
  {
    name: 'wrist.R',
    parent: 'elbow.R',
    position: [0, -0.245, 0],
    limits: { x: { min: -60, max: 60 }, z: { min: -30, max: 20 } },
  },
  // Mão direita: espelho de sinal em X dos offsets do lado L (a mão
  // alinhada aos eixos tornou o espelho ingênuo correto de novo — a palma
  // fica em -Z nos DOIS lados, então não há mais componente quiral fora do
  // plano a resolver à parte, como era no #24). Ver DECISOES.md #25.
  {
    name: 'thumb1.R',
    parent: 'wrist.R',
    position: [0.038, -0.026, 0],
    limits: { x: { min: -20, max: 50 }, z: { min: -80, max: 0 } },
  },
  {
    // Espelho do L: positivo = flexão da ponta para a palma no lado R.
    name: 'thumb2.R',
    parent: 'thumb1.R',
    position: [0.034, -0.01, 0],
    limits: { y: { min: 0, max: 80 } },
  },
  {
    name: 'indexBase.R',
    parent: 'wrist.R',
    position: [0.03, -0.085, 0],
    limits: { x: { min: 0, max: 90 } },
  },
  {
    name: 'indexMid.R',
    parent: 'indexBase.R',
    position: [0, -0.043, 0],
    limits: { x: { min: 0, max: 110 } },
  },
  {
    name: 'indexTip.R',
    parent: 'indexMid.R',
    position: [0, -0.027, 0],
    limits: { x: { min: 0, max: 90 } },
  },
  {
    name: 'fingersBase.R',
    parent: 'wrist.R',
    position: [0, -0.085, 0],
    limits: { x: { min: 0, max: 90 } },
  },
  {
    name: 'fingersMid.R',
    parent: 'fingersBase.R',
    position: [0, -0.043, 0],
    limits: { x: { min: 0, max: 110 } },
  },
  {
    name: 'fingersTip.R',
    parent: 'fingersMid.R',
    position: [0, -0.027, 0],
    limits: { x: { min: 0, max: 90 } },
  },

  // Perna e pé esquerdos.
  //
  // Perna re-ancorada nos marcos antropométricos (DECISOES.md #28): a junta
  // do quadril fica na MESMA altura do root (0,90 m = 0,530H — o offset
  // antigo descia 3 cm e "comia" o comprimento das pernas), e coxa/canela
  // de 0,415 m colocam o joelho exatamente em 0,485 m (0,285H) com o
  // tornozelo mantido em 0,07 m (sola do pé exatamente no chão).
  {
    name: 'hip.L',
    parent: 'root',
    position: [0.09, 0, 0],
    limits: { x: { min: -120, max: 30 }, y: { min: -40, max: 40 }, z: { min: -45, max: 45 } },
  },
  {
    name: 'knee.L',
    parent: 'hip.L',
    position: [0, -0.415, 0],
    limits: { x: { min: 0, max: 150 } },
  },
  {
    name: 'ankle.L',
    parent: 'knee.L',
    position: [0, -0.415, 0],
    limits: { x: { min: -20, max: 50 }, z: { min: -30, max: 30 } },
  },
  {
    name: 'ball.L',
    parent: 'ankle.L',
    position: [0, -0.06, 0.12],
    limits: { x: { min: -30, max: 60 } },
  },

  // Perna e pé direitos (espelhado em X; medidas = lado L, ver comentário de
  // re-ancoragem lá — DECISOES.md #28)
  {
    name: 'hip.R',
    parent: 'root',
    position: [-0.09, 0, 0],
    limits: { x: { min: -120, max: 30 }, y: { min: -40, max: 40 }, z: { min: -45, max: 45 } },
  },
  {
    name: 'knee.R',
    parent: 'hip.R',
    position: [0, -0.415, 0],
    limits: { x: { min: 0, max: 150 } },
  },
  {
    name: 'ankle.R',
    parent: 'knee.R',
    position: [0, -0.415, 0],
    limits: { x: { min: -20, max: 50 }, z: { min: -30, max: 30 } },
  },
  {
    name: 'ball.R',
    parent: 'ankle.R',
    position: [0, -0.06, 0.12],
    limits: { x: { min: -30, max: 60 } },
  },
]

export const JOINT_NAMES: readonly string[] = JOINTS.map((joint) => joint.name)

/**
 * Definições como estão NO CÓDIGO (limites padrão). `JOINTS` e este mapa nunca
 * mudam em runtime — a customização por workspace (ver bloco "Limites
 * customizáveis" no fim do arquivo) é uma camada por cima, exposta por
 * `getJoint`.
 */
const DEFAULT_JOINTS_BY_NAME = new Map(JOINTS.map((joint) => [joint.name, joint]))

/** Definições EFETIVAS (padrão + overrides do workspace) — trocado por `setJointLimitOverrides`. */
let jointsByName: ReadonlyMap<string, JointDefinition> = DEFAULT_JOINTS_BY_NAME

/**
 * Definição EFETIVA da junta: hierarquia/offset sempre vêm do código, mas
 * `limits` já reflete a customização do workspace, se houver. Todo consumidor
 * de limites (sliders, clamp, IK, validação ao carregar) passa por aqui, então
 * basta trocar os overrides para que a aplicação inteira obedeça.
 */
export function getJoint(name: string): JointDefinition {
  const joint = jointsByName.get(name)
  if (!joint) {
    throw new Error(`Junta desconhecida: "${name}"`)
  }
  return joint
}

/** Limites como estão no código, ignorando a customização do workspace. */
export function getDefaultJointLimits(name: string): JointLimits {
  const joint = DEFAULT_JOINTS_BY_NAME.get(name)
  if (!joint) {
    throw new Error(`Junta desconhecida: "${name}"`)
  }
  return joint.limits
}

export function getJointChildren(name: string): JointDefinition[] {
  return JOINTS.filter((joint) => joint.parent === name).map((joint) => getJoint(joint.name))
}

/**
 * A junta e tudo o que vem DEPOIS dela (o contrário de `getJointChain`), em
 * largura — cada junta sempre depois do próprio pai. É o que delimita as
 * operações parciais de pose: com o ombro direito selecionado, o subárvore vai
 * do ombro à ponta dos dedos e as pernas ficam de fora (ver `poseMirror.ts` e
 * DECISOES.md #34).
 */
export function getJointSubtree(name: string): string[] {
  getJoint(name) // valida o nome, como as demais funções deste módulo
  const subtree: string[] = []
  const pending = [name]

  while (pending.length > 0) {
    const current = pending.shift() as string
    subtree.push(current)
    pending.push(...getJointChildren(current).map((child) => child.name))
  }

  return subtree
}

export function getJointChain(name: string): string[] {
  const chain: string[] = []
  let current: JointDefinition | undefined = getJoint(name)
  while (current) {
    chain.unshift(current.name)
    current = current.parent ? getJoint(current.parent) : undefined
  }
  return chain
}

const AXIS_ORDER: readonly Axis[] = ['x', 'y', 'z']

/** Graus de liberdade de uma junta, na ordem x,y,z — usado pelos sliders e pelo eixo ativo dos atalhos de teclado. */
export function getJointAxes(name: string): Axis[] {
  const joint = getJoint(name)
  return AXIS_ORDER.filter((axis) => joint.limits[axis])
}

export interface JointRotation {
  x: number
  y: number
  z: number
}

function clampValue(value: number, limit: AxisLimit): number {
  return Math.min(limit.max, Math.max(limit.min, value))
}

export function clampJointRotation(
  jointName: string,
  rotation: Partial<JointRotation>,
): JointRotation {
  if (FREE_JOINTS.has(jointName)) {
    return { x: rotation.x ?? 0, y: rotation.y ?? 0, z: rotation.z ?? 0 }
  }

  const joint = getJoint(jointName)
  const axes: Axis[] = ['x', 'y', 'z']
  const result = { x: 0, y: 0, z: 0 } as JointRotation

  for (const axis of axes) {
    const limit = joint.limits[axis]
    if (!limit) {
      result[axis] = 0
      continue
    }
    result[axis] = clampValue(rotation[axis] ?? 0, limit)
  }

  return result
}

export function getHeightScale(heightM: number): number {
  return heightM / REFERENCE_HEIGHT_M
}

// ---------------------------------------------------------------------------
// Limites customizáveis por workspace (ver DECISOES.md #29)
// ---------------------------------------------------------------------------
//
// Os valores acima são os PADRÕES e nunca mudam. Um workspace pode trazer um
// `joint-limits.json` que aperta/afrouxa faixas; esses overrides ficam nesta
// camada e valem para a aplicação inteira (não por boneco nem por cena),
// porque são uma característica do modelo, não conteúdo de cena.
//
// Regras (decididas com o usuário):
// - Só min/max de eixos que JÁ existem no código. O JSON não cria nem remove
//   graus de liberdade: `getJointAxes` continua devolvendo exatamente os
//   mesmos eixos, então sliders, gizmo e atalhos não mudam de forma — só de
//   faixa. Um eixo desconhecido (ex.: `knee.z`) é ignorado silenciosamente.
// - `root` é ignorado: está em `FREE_JOINTS` e nunca passa por clamp.
// - Entrada inválida nunca derruba a aplicação nem "meio aplica": min > max,
//   valor não numérico ou junta inexistente caem fora e o padrão permanece.

/** Faixa máxima aceita para um limite customizado, em graus (uma volta completa para cada lado). */
const MAX_LIMIT_DEG = 360

/** Overrides de limites por junta — só os eixos efetivamente diferentes do padrão. */
export type JointLimitOverrides = Readonly<Record<string, JointLimits>>

let limitOverrides: JointLimitOverrides = {}

function buildJointsByName(overrides: JointLimitOverrides): ReadonlyMap<string, JointDefinition> {
  return new Map(
    JOINTS.map((joint) => {
      const override = overrides[joint.name]
      if (!override) return [joint.name, joint] as const
      return [joint.name, { ...joint, limits: { ...joint.limits, ...override } }] as const
    }),
  )
}

/**
 * Filtra qualquer JSON (nunca confiável — mesma regra de leitura do resto da
 * persistência) até sobrar só o que é aplicável: juntas conhecidas, eixos que
 * já são DOF no código, min/max numéricos com min ≤ max e dentro de ±360°.
 * Um lado ausente (`{ "max": 60 }`) herda o padrão do outro. Eixos idênticos
 * ao padrão são descartados, então o resultado descreve só a diferença real —
 * é isso que a UI usa para saber se há customização ativa.
 */
export function sanitizeJointLimitOverrides(raw: unknown): JointLimitOverrides {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const result: Record<string, JointLimits> = {}

  for (const [jointName, axesRaw] of Object.entries(source)) {
    const defaults = DEFAULT_JOINTS_BY_NAME.get(jointName)
    if (!defaults || FREE_JOINTS.has(jointName)) continue
    if (typeof axesRaw !== 'object' || axesRaw === null) continue

    const axesSource = axesRaw as Record<string, unknown>
    const limits: JointLimits = {}

    for (const axis of AXIS_ORDER) {
      const fallback = defaults.limits[axis]
      if (!fallback) continue

      const entry = axesSource[axis]
      if (typeof entry !== 'object' || entry === null) continue

      const entrySource = entry as Record<string, unknown>
      const min = typeof entrySource.min === 'number' && Number.isFinite(entrySource.min)
        ? Math.max(-MAX_LIMIT_DEG, entrySource.min)
        : fallback.min
      const max = typeof entrySource.max === 'number' && Number.isFinite(entrySource.max)
        ? Math.min(MAX_LIMIT_DEG, entrySource.max)
        : fallback.max

      if (min > max) continue
      if (min === fallback.min && max === fallback.max) continue

      limits[axis] = { min, max }
    }

    if (Object.keys(limits).length > 0) result[jointName] = limits
  }

  return result
}

/**
 * Aplica os limites customizados de um workspace. Passa por
 * `sanitizeJointLimitOverrides` sempre, então nem a UI nem um JSON adulterado
 * conseguem instalar uma faixa impossível. Devolve o conjunto efetivamente
 * aplicado (só as diferenças em relação ao padrão) para o store espelhar.
 *
 * ATENÇÃO À ORDEM: quem carrega um workspace precisa aplicar os limites ANTES
 * de reconstruir as cenas, porque é na leitura das poses que o clamp acontece
 * (`sceneSerialization.figureFromExtras`) — ver DECISOES.md #29.
 */
export function setJointLimitOverrides(raw: unknown): JointLimitOverrides {
  limitOverrides = sanitizeJointLimitOverrides(raw)
  jointsByName = buildJointsByName(limitOverrides)
  return limitOverrides
}

/** Volta a usar exatamente os limites do código. */
export function resetJointLimitOverrides(): void {
  limitOverrides = {}
  jointsByName = DEFAULT_JOINTS_BY_NAME
}

/** Overrides em vigor (vazio = nenhuma customização; a aplicação está nos padrões do código). */
export function getJointLimitOverrides(): JointLimitOverrides {
  return limitOverrides
}

/**
 * ============================================================
 * CAMADA VISUAL — geometria do manequim de madeira
 * ============================================================
 *
 * Tudo daqui para baixo é APARÊNCIA, não cinemática: a descrição,
 * por junta, das peças que reproduzem o manequim articulado de madeira da
 * foto de referência (3 vistas — costas/lado/frente, revista Animax):
 * - cabeça em ovo liso (olhos, nariz e orelhas mantidos, adaptados ao novo
 *   layout — sem boca nem facete de queixo, só a parte ovalada);
 * - pescoço torneado tipo carretel;
 * - peito como bloco único entalhado (ombros largos e arredondados,
 *   afunilando até a cintura, achatado em profundidade);
 * - bola da cintura visível entre peito e pelve (a peça "ウエスト" da foto);
 * - pelve como bloco arredondado ("尻"), de onde as coxas emergem por baixo;
 * - membros como peças torneadas afuniladas com leve entasis (barriga
 *   muscular), unidas por bolas de junta expostas (ombro/cotovelo/punho/
 *   quadril/joelho/tornozelo);
 * - mãos com proporções humanas (DECISOES.md #25): palma e falanges em
 *   lâmina chata, unidas por "elipses de dobradiça" alongadas no eixo de
 *   dobra (esquema de referência `maos.jpg`), polegar torneado em 2
 *   segmentos com ponta arredondada — tudo alinhado aos eixos locais do
 *   punho (largura em X, distal -Y, palma -Z; ver o docblock no topo deste
 *   arquivo);
 * - pés em cunha com bloco de dedos separado (junta `ball.*` mantida).
 *
 * Viveu em `skeleton2.ts` até 2026-07-25, quando o renderizador antigo
 * (`Figure.tsx` original) foi removido e o par `skeleton2`/`Figure2` deixou
 * de fazer sentido como nome — a camada visual foi trazida para cá, e os
 * dois arquivos viraram um só (ver DECISOES.md #32).
 *
 * Como consumir (renderer):
 * - `lathe`: mapear `profile` para `THREE.Vector2(radius, y)` e usar
 *   `LatheGeometry`, com `scale=[1, 1, depthRatio]` no mesh (achatamento em
 *   Z; pontos de raio ~0,0005 são as "tampas" que fecham o sólido, mesmo
 *   truque de `trapezoidProfile` no renderizador);
 * - `ellipsoid`: esfera unitária com `scale=radii`;
 * - `box`: `BoxGeometry` com `size`;
 * - ossos `turned`: perfil radial ao longo do eixo do osso (t=0 na junta
 *   pai, t=1 na filha; comprimento real vem do offset do `skeleton.ts`),
 *   equivalente ao `limbProfile` de `Figure.tsx` com pontos explícitos;
 * - ossos `blade`: caixa chata afunilada (largura em X do segmento,
 *   espessura em Z) — palma e falanges em bloco;
 * - ossos `hidden`: não renderizar (o trecho fica coberto por um bloco,
 *   ex.: root→hip dentro da pelve, ankle→ball dentro da cunha do pé).
 * - `tint`: `'body'` (default) usa a cor do boneco; `'eye'` usa o preto
 *   fixo dos olhos (mesma regra de `EYE_COLOR` no renderizador); `'marker'`
 *   usa um tom de latão fixo (pino no dorso da mão, ver
 *   `HAND_BACK_MARKER`) — mesmo mecanismo dos olhos, cor independente
 *   da cor do boneco.
 *
 * Todas as medidas em metros, na altura de referência (1,70 m), no espaço
 * local da junta (mesma convenção do `skeleton.ts`: +Z = frente).
 */

export type Vec3 = readonly [number, number, number]

/** Ponto de um perfil torneado: raio em função da altura local Y (m). */
export interface ProfilePoint {
  y: number
  radius: number
}

interface PartBase {
  /** Deslocamento do centro da peça no espaço local da junta (m). */
  offset?: Vec3
  /** Rotação Euler XYZ da peça, em graus. */
  rotation?: Vec3
  /**
   * `'body'` (default) = cor do boneco; `'eye'` = preto fixo dos olhos;
   * `'marker'` = tom de latão fixo do pino que marca as costas da mão (ver
   * `HAND_BACK_MARKER`).
   */
  tint?: 'body' | 'eye' | 'marker'
}

/** Peça torneada: `profile` (y crescente) revolvido em torno do Y local. */
export interface LathePart extends PartBase {
  kind: 'lathe'
  profile: readonly ProfilePoint[]
  /** Achatamento em Z (1 = seção circular). */
  depthRatio?: number
}

export interface EllipsoidPart extends PartBase {
  kind: 'ellipsoid'
  radii: Vec3
}

export interface BoxPart extends PartBase {
  kind: 'box'
  size: Vec3
}

export type SegmentPart = LathePart | EllipsoidPart | BoxPart

/** Ponto do perfil de um osso torneado: raio em função de t (0 = junta pai, 1 = junta filha). */
export interface TurnedPoint {
  t: number
  radius: number
}

export type BoneStyle =
  /** Peça torneada afunilada — braços, pernas, pescoço, conectores do tronco. */
  | { kind: 'turned'; points: readonly TurnedPoint[]; depthRatio?: number }
  /**
   * Lâmina chata afunilada — palma e falanges da mão. `offsetX` desloca a
   * lâmina lateralmente NO ESPAÇO LOCAL DA JUNTA PAI (não no da lâmina), e é
   * o que permite desenhar o bloco de 3 dedos fora do centro sem tirar o pivô
   * da linha do punho (ver DECISOES.md #45).
   */
  | { kind: 'blade'; widthStart: number; widthEnd: number; thickness: number; offsetX?: number }
  /** Trecho coberto por um bloco — não renderizar. */
  | { kind: 'hidden' }

/** Raio usado nos pontos que fecham ("tampam") as extremidades de um lathe. */
const CAP = 0.0005

const sphere = (radius: number): SegmentPart => ({
  kind: 'ellipsoid',
  radii: [radius, radius, radius],
})

// ---------------------------------------------------------------------------
// Cabeça — ovo com facete facial
// ---------------------------------------------------------------------------

/**
 * Ovo da cabeça, revolvido em torno do Y local da junta `head` (base do
 * crânio, ~1,55 m no mundo): queixo em ~-0,065 (1,485 m) e coroa em +0,150,
 * fechando a altura total de 1,70 m. Mais largo perto do topo, como o ovo do
 * manequim real; `depthRatio` > 1 deixa a cabeça mais funda que larga.
 */
const HEAD_EGG_PROFILE: readonly ProfilePoint[] = [
  { y: -0.065, radius: CAP },
  { y: -0.058, radius: 0.026 },
  { y: -0.035, radius: 0.047 },
  { y: -0.005, radius: 0.063 },
  { y: 0.03, radius: 0.073 },
  { y: 0.065, radius: 0.077 },
  { y: 0.1, radius: 0.071 },
  { y: 0.13, radius: 0.052 },
  { y: 0.15, radius: CAP },
]

/**
 * Peças da cabeça: só o ovo liso + olhos/nariz/orelhas mantidos do modelo
 * original, assentados sobre a superfície do ovo (a superfície frontal na
 * altura dos olhos fica em z ≈ 0,101: raio do perfil × depthRatio 1,15 +
 * offset 0,015 do ovo — olhos/nariz precisam ultrapassar isso para não
 * ficarem enterrados). Olhos na linha ~62% da altura da cabeça; sem boca e
 * sem a facete plana de queixo (removida a pedido do usuário — a "cara" é o
 * próprio ovo).
 */
const HEAD_PARTS: readonly SegmentPart[] = [
  { kind: 'lathe', profile: HEAD_EGG_PROFILE, depthRatio: 1.15, offset: [0, 0, 0.015] },
  { kind: 'ellipsoid', radii: [0.011, 0.026, 0.013], offset: [0, 0.005, 0.095] }, // nariz
  { kind: 'ellipsoid', radii: [0.01, 0.013, 0.007], offset: [0.027, 0.045, 0.098], tint: 'eye' },
  { kind: 'ellipsoid', radii: [0.01, 0.013, 0.007], offset: [-0.027, 0.045, 0.098], tint: 'eye' },
  { kind: 'ellipsoid', radii: [0.01, 0.028, 0.018], offset: [0.07, 0.02, -0.005] }, // orelha E
  { kind: 'ellipsoid', radii: [0.01, 0.028, 0.018], offset: [-0.07, 0.02, -0.005] }, // orelha D
]

// ---------------------------------------------------------------------------
// Tronco — bloco do peito, bola da cintura e bloco da pelve
// ---------------------------------------------------------------------------

/**
 * Bloco do peito (junta `chest`, ~1,31 m): da base até a linha arredondada
 * dos ombros (+0,106 → ~1,416 m, cobrindo `upperChest` e a base do `neck`,
 * de onde o carretel do pescoço emerge). Ombros no raio máximo (0,148) e
 * `depthRatio` 0,70 achatando frente/costas, como o bloco entalhado da
 * foto. A base desce até -0,115 (~1,195 m ≈ 0,70×altura, a borda costal
 * real — pedido do usuário, ver DECISOES.md #26): caixa torácica maior e
 * abdômen mais curto, mantendo a linha dos ombros onde está. Meio-termo
 * consciente com o bug do #17 (base em -0,20 varria um arco largo na
 * flexão máxima e saía do conector): com -0,115 o arco na flexão de +25° é
 * ~5 cm, coberto pelo cone do abdômen (`BONE_STYLES.chest`, alargado junto
 * — ele não gira com a junta `chest`).
 */
const CHEST_PROFILE: readonly ProfilePoint[] = [
  { y: -0.115, radius: CAP },
  { y: -0.11, radius: 0.102 },
  { y: -0.05, radius: 0.112 },
  { y: -0.01, radius: 0.118 },
  { y: 0.045, radius: 0.138 },
  { y: 0.075, radius: 0.148 },
  { y: 0.092, radius: 0.128 },
  { y: 0.102, radius: 0.08 },
  { y: 0.106, radius: CAP },
]

/**
 * Bloco da pelve (junta `root`, 0,90 m): quadril no raio máximo e fundo
 * arredondado encurtado para -0,095 (~0,805 m — era -0,13; pedido do
 * usuário: peça do quadril mais baixa), deixando o topo das coxas aparecer
 * sob o bloco, como no manequim real (as bolas `hip.*` ficaram embutidas no
 * bloco desde a re-ancoragem das pernas do #28, que subiu as juntas do
 * quadril para a altura do próprio `root`).
 * O topo segue em +0,115 (~1,015 m), SOBREPONDO a base da bola da cintura
 * (`spine`) — o conector root→spine fica escondido (mesmo motivo do
 * `CHEST_PROFILE`), e o raio do topo (0,076) emenda na largura da bola.
 */
const PELVIS_PROFILE: readonly ProfilePoint[] = [
  { y: -0.095, radius: CAP },
  { y: -0.09, radius: 0.06 },
  { y: -0.065, radius: 0.092 },
  { y: -0.035, radius: 0.107 },
  { y: -0.005, radius: 0.112 },
  { y: 0.04, radius: 0.103 },
  { y: 0.075, radius: 0.09 },
  { y: 0.11, radius: 0.076 },
  { y: 0.115, radius: CAP },
]

// ---------------------------------------------------------------------------
// Mãos — palma e falanges em lâmina, articuladas por elipses de dobradiça
// ---------------------------------------------------------------------------
//
// Toda a mão é modelada ALINHADA aos eixos locais do punho (DECISOES.md
// #25): largura em X, distal em -Y, palma em -Z, dorso em +Z — igual nos
// dois lados (a quiralidade fica só no polegar, que sai em -X no L e +X no
// R via offsets do `skeleton.ts`). Como os ossos de dedo/palma descem em -Y
// puro, as lâminas (`blade`) renderizam com orientação determinística
// (largura em X, espessura em Z) — sem o rolamento arbitrário que entortava
// a palma na modelagem diagonal antiga. Proporções humanas (#25): punho →
// ponta ≈ 0,183 m para 1,70 m de altura.

/**
 * Elipse de dobradiça: elipsoide alongado no eixo X local — exatamente o
 * eixo de dobra (`limits.x`) das juntas de dedo — marcando a linha de
 * articulação, como as elipses vermelhas do esquema de referência
 * (`maos.jpg`). Levemente mais larga e mais grossa que as lâminas vizinhas
 * para ficar visível e cobrir o vão quando o dedo dobra.
 */
const knuckle = (halfWidth: number, radius: number, offsetX = 0): SegmentPart => ({
  kind: 'ellipsoid',
  radii: [halfWidth, radius, radius],
  ...(offsetX === 0 ? {} : { offset: [offsetX, 0, 0] as Vec3 }),
})

/**
 * Repartição da fileira dos nós desde o #45: o INDICADOR fica com o quarto
 * radial (2,0 cm dos 8,0 cm da palma, centrado em X = ∓0,030 — o lado do
 * polegar) e o BLOCO dos outros três com os 6,0 cm restantes, centrado a
 * 1,0 cm do lado oposto. O pivô das juntas do bloco continua em X = 0: a
 * flexão gira em torno do eixo X, que é a própria fileira, então deslocar só
 * o desenho é exato, não aproximado. O sinal é o do lado ULNAR (mindinho):
 * +X no lado L, -X no R.
 */
const FINGERS_BLOCK_OFFSET_X = 0.01
const BLOCK_SIGN: Record<string, number> = { L: 1, R: -1 }

/**
 * Falange distal do bloco de 3 dedos além da última junta (`fingersTip.*`):
 * lâmina arredondada que afunila até a ponta (lathe achatado em Z na
 * espessura das falanges). Raios reduzidos a 3/4 no #45 (o bloco perdeu o
 * indicador) com o achatamento recalculado para a espessura não mudar:
 * 2 × 0,031 × 0,27 = 2 × 0,023 × 0,364 = 0,0167 m.
 */
const fingersBlockTip = (side: string): SegmentPart => ({
  kind: 'lathe',
  profile: [
    { y: -0.028, radius: CAP },
    { y: -0.024, radius: 0.0126 },
    { y: -0.013, radius: 0.02 },
    { y: -0.002, radius: 0.023 },
    { y: 0.002, radius: CAP },
  ],
  depthRatio: 0.364,
  offset: [BLOCK_SIGN[side] * FINGERS_BLOCK_OFFSET_X, 0, 0],
})

/** Falange distal do indicador além de `indexTip.*` — a mesma peça em escala de um dedo só (seção quase redonda). */
const INDEX_TIP: SegmentPart = {
  kind: 'lathe',
  profile: [
    { y: -0.028, radius: CAP },
    { y: -0.0245, radius: 0.0043 },
    { y: -0.013, radius: 0.0068 },
    { y: -0.002, radius: 0.0078 },
    { y: 0.002, radius: CAP },
  ],
  depthRatio: 1,
}

const fingersBaseKnuckle = (side: string): readonly SegmentPart[] => [
  knuckle(0.0305, 0.0145, BLOCK_SIGN[side] * FINGERS_BLOCK_OFFSET_X),
]
const fingersMidKnuckle = (side: string): readonly SegmentPart[] => [
  knuckle(0.0275, 0.0125, BLOCK_SIGN[side] * FINGERS_BLOCK_OFFSET_X),
]
const fingersTipKnuckle = (side: string): readonly SegmentPart[] => [
  knuckle(0.0245, 0.011, BLOCK_SIGN[side] * FINGERS_BLOCK_OFFSET_X),
  fingersBlockTip(side),
]

// Elipses de dobradiça do indicador: mesma ESPESSURA da fileira (os raios em
// Y/Z não mudam — a linha de nós é contínua com a do bloco), largura de um
// dedo só. As peças não levam deslocamento: quem já está em X = ∓0,030 é a
// própria junta.
const INDEX_BASE_KNUCKLE: readonly SegmentPart[] = [knuckle(0.0105, 0.0145)]
const INDEX_MID_KNUCKLE: readonly SegmentPart[] = [knuckle(0.0095, 0.0125)]
const INDEX_TIP_KNUCKLE: readonly SegmentPart[] = [knuckle(0.0085, 0.011), INDEX_TIP]

/**
 * Falange distal do polegar além de `thumb2.*`: lathe girado em Z para
 * continuar na direção do segmento `thumb1`→`thumb2` (≈74° do -Y local em
 * direção a ∓X — `atan2(0.034, 0.010)`, do offset de `thumb2` no
 * `skeleton.ts`). É a ÚNICA peça quiral da mão: a rotação espelha o sinal
 * entre L e R porque o polegar sai para lados opostos.
 */
const thumbTip = (rotationZ: number): SegmentPart => ({
  kind: 'lathe',
  profile: [
    { y: -0.03, radius: CAP },
    { y: -0.026, radius: 0.008 },
    { y: -0.014, radius: 0.0105 },
    { y: -0.002, radius: 0.0115 },
    { y: 0.002, radius: CAP },
  ],
  depthRatio: 0.9,
  rotation: [0, 0, rotationZ],
})

const THUMB1_PARTS: readonly SegmentPart[] = [sphere(0.014)]
const THUMB2_PARTS_L: readonly SegmentPart[] = [sphere(0.0125), thumbTip(-74)]
const THUMB2_PARTS_R: readonly SegmentPart[] = [sphere(0.0125), thumbTip(74)]

/**
 * Pino de latão no dorso da mão (`wrist.*`) — marca visualmente qual lado é
 * o dorso, já que a lâmina achatada fica difícil de distinguir de
 * frente/costas à distância (pedido do usuário, DECISOES.md #22). Com a mão
 * alinhada aos eixos (#25), o dorso é simplesmente +Z local nos DOIS lados
 * — um único offset serve para L e R (não há mais a assimetria quiral
 * resolvida numericamente do #23). Assenta na face dorsal da lâmina da
 * palma (meia-espessura 0,013), sobressaindo ~0,007.
 */
const HAND_BACK_MARKER: SegmentPart = {
  kind: 'ellipsoid',
  radii: [0.0065, 0.0065, 0.0045],
  offset: [0, -0.045, 0.0155],
  tint: 'marker',
}

// ---------------------------------------------------------------------------
// Pés — cunha do calcanhar/peito do pé + bloco dos dedos
// ---------------------------------------------------------------------------

/**
 * Peças do tornozelo (`ankle.*`, 0,07 m do chão): bola da junta + bloco
 * liso do calcanhar/meio do pé com sola plana no chão (fundo em y = -0,070
 * local). Sem a rampa inclinada do peito do pé que existiu numa versão
 * anterior — ela criava um ressalto triangular sobre o bloco (removida a
 * pedido do usuário: só o paralelepípedo liso).
 */
const ANKLE_PARTS: readonly SegmentPart[] = [
  sphere(0.028),
  { kind: 'box', size: [0.072, 0.05, 0.15], offset: [0, -0.045, 0.03] },
]

/**
 * Bloco dos dedos do pé (`ball.*`, 0,01 m do chão): paralelepípedo baixo com
 * a sola alinhada ao chão + ponta arredondada na frente.
 */
const BALL_PARTS: readonly SegmentPart[] = [
  { kind: 'box', size: [0.066, 0.03, 0.078], offset: [0, 0.005, 0.028] },
  { kind: 'ellipsoid', radii: [0.032, 0.015, 0.018], offset: [0, 0.005, 0.066] },
]

// ---------------------------------------------------------------------------
// Corpo de cada junta
// ---------------------------------------------------------------------------

/**
 * Peças renderizadas na origem de cada junta (espaço local da junta). As
 * bolas de junta expostas (ombro/cotovelo/punho/quadril/joelho/tornozelo)
 * são o traço característico do manequim articulado; os blocos de
 * tronco/cabeça/mãos/pés são as peças entalhadas. Juntas pareadas usam a
 * mesma lista nos dois lados — nenhuma peça daqui tem offset lateral (X),
 * então não há o que espelhar.
 */
export const JOINT_PARTS: Record<string, readonly SegmentPart[]> = {
  root: [{ kind: 'lathe', profile: PELVIS_PROFILE, depthRatio: 0.72 }],
  // Bola da cintura ("ウエスト"): alargada para emendar nos raios da base do
  // peito (0,078) e do topo da pelve (0,076), que agora se sobrepõem a ela.
  spine: [{ kind: 'ellipsoid', radii: [0.084, 0.062, 0.064] }],
  chest: [{ kind: 'lathe', profile: CHEST_PROFILE, depthRatio: 0.7 }],
  upperChest: [{ kind: 'ellipsoid', radii: [0.05, 0.018, 0.04] }], // embutida no topo do peito
  // Assento do carretel do pescoço: alargada no #27 (era r 0,03 — fina
  // demais, ver DECISOES.md) para casar com o pescoço engrossado; o topo
  // dela desponta do platô do bloco do peito e cobre o pivô quando o
  // pescoço flexiona.
  neck: [{ kind: 'ellipsoid', radii: [0.05, 0.042, 0.05] }],
  head: HEAD_PARTS,
  'clavicle.L': [sphere(0.022)],
  'clavicle.R': [sphere(0.022)],
  'shoulder.L': [sphere(0.052)],
  'shoulder.R': [sphere(0.052)],
  'elbow.L': [sphere(0.038)],
  'elbow.R': [sphere(0.038)],
  'wrist.L': [{ kind: 'ellipsoid', radii: [0.028, 0.026, 0.024] }, HAND_BACK_MARKER],
  'wrist.R': [{ kind: 'ellipsoid', radii: [0.028, 0.026, 0.024] }, HAND_BACK_MARKER],
  'thumb1.L': THUMB1_PARTS,
  'thumb1.R': THUMB1_PARTS,
  'thumb2.L': THUMB2_PARTS_L,
  'thumb2.R': THUMB2_PARTS_R,
  'indexBase.L': INDEX_BASE_KNUCKLE,
  'indexBase.R': INDEX_BASE_KNUCKLE,
  'indexMid.L': INDEX_MID_KNUCKLE,
  'indexMid.R': INDEX_MID_KNUCKLE,
  'indexTip.L': INDEX_TIP_KNUCKLE,
  'indexTip.R': INDEX_TIP_KNUCKLE,
  // Bloco de 3 dedos: as peças são espelhadas (o deslocamento lateral sai
  // para o lado do mindinho em cada mão), ao contrário das demais juntas
  // pareadas, que compartilham a mesma lista.
  'fingersBase.L': fingersBaseKnuckle('L'),
  'fingersBase.R': fingersBaseKnuckle('R'),
  'fingersMid.L': fingersMidKnuckle('L'),
  'fingersMid.R': fingersMidKnuckle('R'),
  'fingersTip.L': fingersTipKnuckle('L'),
  'fingersTip.R': fingersTipKnuckle('R'),
  'hip.L': [sphere(0.05)],
  'hip.R': [sphere(0.05)],
  'knee.L': [sphere(0.043)],
  'knee.R': [sphere(0.043)],
  'ankle.L': ANKLE_PARTS,
  'ankle.R': ANKLE_PARTS,
  'ball.L': BALL_PARTS,
  'ball.R': BALL_PARTS,
}

// ---------------------------------------------------------------------------
// Ossos (segmento junta pai → junta filha), por nome da junta FILHA
// ---------------------------------------------------------------------------

const UPPER_ARM: BoneStyle = {
  kind: 'turned',
  // Leve entasis no terço superior (deltoide/bíceps), afunilando ao cotovelo.
  points: [
    { t: 0, radius: 0.048 },
    { t: 0.3, radius: 0.052 },
    { t: 1, radius: 0.034 },
  ],
}

const FOREARM: BoneStyle = {
  kind: 'turned',
  points: [
    { t: 0, radius: 0.037 },
    { t: 0.25, radius: 0.042 },
    { t: 1, radius: 0.023 },
  ],
}

const THIGH: BoneStyle = {
  kind: 'turned',
  points: [
    { t: 0, radius: 0.06 },
    { t: 0.25, radius: 0.064 },
    { t: 0.7, radius: 0.048 },
    { t: 1, radius: 0.04 },
  ],
}

const CALF: BoneStyle = {
  kind: 'turned',
  // Barriga da panturrilha no terço superior, afinando até o tornozelo.
  points: [
    { t: 0, radius: 0.04 },
    { t: 0.22, radius: 0.052 },
    { t: 0.6, radius: 0.035 },
    { t: 1, radius: 0.025 },
  ],
}

const CLAVICLE_ROD: BoneStyle = {
  kind: 'turned',
  points: [
    { t: 0, radius: 0.02 },
    { t: 1, radius: 0.02 },
  ],
}

/** Pino curto entre a clavícula e a bola do ombro — a "cavilha" visível do manequim. */
const SHOULDER_PEG: BoneStyle = {
  kind: 'turned',
  points: [
    { t: 0, radius: 0.021 },
    { t: 1, radius: 0.025 },
  ],
}

/** Metacarpo do polegar (wrist→thumb1) — cilindro torneado, meio embutido na borda da palma. */
const THUMB_SEGMENT: BoneStyle = {
  kind: 'turned',
  points: [
    { t: 0, radius: 0.013 },
    { t: 1, radius: 0.0125 },
  ],
}

/** Falange proximal do polegar (thumb1→thumb2). */
const THUMB_SEGMENT_DISTAL: BoneStyle = {
  kind: 'turned',
  points: [
    { t: 0, radius: 0.0125 },
    { t: 1, radius: 0.0105 },
  ],
}

/**
 * Estilo do osso que liga cada junta à sua junta PAI, indexado pelo nome da
 * junta filha (mesma chave usada por `Bone`/`TORSO_CONNECTORS` em
 * `Figure.tsx`). O comprimento real de cada osso é o módulo do `position`
 * da junta filha no `skeleton.ts` — aqui só entra o perfil radial.
 */
export const BONE_STYLES: Record<string, BoneStyle> = {
  // root→spine: conector que em repouso fica TOTALMENTE escondido (a pelve
  // sobrepõe a bola da cintura); o raio largo, próximo da bola, evita que um
  // trecho fino apareça quando a coluna dobra.
  spine: {
    kind: 'turned',
    points: [
      { t: 0, radius: 0.062 },
      { t: 1, radius: 0.058 },
    ],
  },
  // spine→chest: o ABDÔMEN — tronco de cone (trapézio na silhueta, pedido
  // do usuário): embaixo com a mesma largura da bola da cintura (0,084) e
  // alargando até o topo (0,104, alargado no #26 para cobrir o arco que a
  // base estendida do bloco do peito varre na flexão máxima), contido
  // dentro do bloco tanto na largura quanto no achatamento em Z
  // (0,104×0,72 = 0,075 < 0,118×0,70 = 0,083 na altura do topo do cone).
  // Como pertence ao grupo da junta `spine`, não gira quando o `chest`
  // flexiona — o peito articula sobre o topo dele.
  chest: {
    kind: 'turned',
    points: [
      { t: 0, radius: 0.084 },
      { t: 1, radius: 0.104 },
    ],
    depthRatio: 0.72,
  },
  upperChest: {
    kind: 'turned',
    points: [
      { t: 0, radius: 0.034 },
      { t: 1, radius: 0.034 },
    ],
  },
  // upperChest→neck: trecho enterrado no topo do bloco do peito — engrossado
  // junto com o pescoço visível (#27) para nada fino aparecer quando o
  // `upperChest` inclina (±15°).
  neck: {
    kind: 'turned',
    points: [
      { t: 0, radius: 0.046 },
      { t: 1, radius: 0.048 },
    ],
  },
  // neck→head: o PESCOÇO VISÍVEL (do topo do bloco do peito, ~1,416 m, até o
  // queixo do ovo, ~1,485 m). Engrossado no #27 de r 0,025-0,03 para
  // 0,034-0,047: o diâmetro visível (~0,08-0,09 m) fica em ~0,55 da largura
  // da cabeça (0,154 m) — proporção de pescoço humano/manequim, em vez do
  // "palito" de ~0,39 anterior. Carretel: base larga assentada na bola do
  // `neck`, cintura no meio, topo afinando para entrar no queixo do ovo.
  head: {
    kind: 'turned',
    points: [
      { t: 0, radius: 0.047 },
      { t: 0.55, radius: 0.038 },
      { t: 1, radius: 0.034 },
    ],
  },

  'clavicle.L': CLAVICLE_ROD,
  'clavicle.R': CLAVICLE_ROD,
  'shoulder.L': SHOULDER_PEG,
  'shoulder.R': SHOULDER_PEG,
  'elbow.L': UPPER_ARM,
  'elbow.R': UPPER_ARM,
  'wrist.L': FOREARM,
  'wrist.R': FOREARM,

  'thumb1.L': THUMB_SEGMENT,
  'thumb1.R': THUMB_SEGMENT,
  'thumb2.L': THUMB_SEGMENT_DISTAL,
  'thumb2.R': THUMB_SEGMENT_DISTAL,
  // O metacarpo do indicador corre DENTRO da palma (a lâmina de
  // `fingersBase.*` cobre os quatro), então não há osso a desenhar do punho
  // até `indexBase.*`.
  'indexBase.L': { kind: 'hidden' },
  'indexBase.R': { kind: 'hidden' },
  'indexMid.L': { kind: 'blade', widthStart: 0.019, widthEnd: 0.0175, thickness: 0.019 },
  'indexMid.R': { kind: 'blade', widthStart: 0.019, widthEnd: 0.0175, thickness: 0.019 },
  'indexTip.L': { kind: 'blade', widthStart: 0.017, widthEnd: 0.0155, thickness: 0.017 },
  'indexTip.R': { kind: 'blade', widthStart: 0.017, widthEnd: 0.0155, thickness: 0.017 },
  // Palma alargando do punho (0,056) para a fileira dos nós (0,080) —
  // inteira, porque ela cobre os quatro metacarpos e continua centrada na
  // linha do punho. Já as falanges do BLOCO ficam com 3/4 da largura antiga e
  // deslocadas 1 cm para o lado do mindinho, deixando o quarto radial para o
  // indicador (`offsetX`, DECISOES.md #45).
  'fingersBase.L': { kind: 'blade', widthStart: 0.056, widthEnd: 0.08, thickness: 0.026 },
  'fingersBase.R': { kind: 'blade', widthStart: 0.056, widthEnd: 0.08, thickness: 0.026 },
  'fingersMid.L': { kind: 'blade', widthStart: 0.057, widthEnd: 0.052, thickness: 0.019, offsetX: 0.01 },
  'fingersMid.R': { kind: 'blade', widthStart: 0.057, widthEnd: 0.052, thickness: 0.019, offsetX: -0.01 },
  'fingersTip.L': { kind: 'blade', widthStart: 0.05, widthEnd: 0.046, thickness: 0.017, offsetX: 0.01 },
  'fingersTip.R': { kind: 'blade', widthStart: 0.05, widthEnd: 0.046, thickness: 0.017, offsetX: -0.01 },

  // root→hip fica dentro do bloco da pelve; a bola de `hip.*` cobre o pivô.
  'hip.L': { kind: 'hidden' },
  'hip.R': { kind: 'hidden' },
  'knee.L': THIGH,
  'knee.R': THIGH,
  'ankle.L': CALF,
  'ankle.R': CALF,
  // ankle→ball fica dentro da cunha do pé (peça de `ankle.*`).
  'ball.L': { kind: 'hidden' },
  'ball.R': { kind: 'hidden' },
}

// ---------------------------------------------------------------------------
// VARIANTE PALITO — casca alternativa para tela pequena e toque
// ---------------------------------------------------------------------------
//
// Segunda casca visual sobre EXATAMENTE o mesmo esqueleto: mesmas juntas,
// mesmos offsets, mesmos limites. Só as tabelas de aparência mudam, então
// nenhuma pose, arquivo ou solver sabe que ela existe (ver DECISOES.md #81).
//
// Por que ela existe: a versão de celular do editor (PLANO.md > "Edição em
// dispositivo touch") mostra o boneco em vistas pequenas, onde os blocos
// entalhados do manequim viram uma mancha ilegível, e a seleção é por DEDO —
// as bolas de junta do manequim (0,011 m nos nós dos dedos, 0,022 na clavícula)
// são alvos impossíveis num toque. Aqui cada junta é uma esfera deliberadamente
// GRANDE e cada osso um cilindro fino, invertendo a proporção: o que se toca
// fica gordo, o que só liga fica magro.
//
// Duas decisões de dimensionamento que não são óbvias:
//
// - **Nem toda junta engorda igual.** `upperChest`/`neck` estão a 0,04 m um do
//   outro e `clavicle` a 0,1 do `upperChest`: com o raio das juntas grandes
//   (0,045-0,05) elas viravam uma bola só, e um alvo de toque que engole o
//   vizinho não é alvo. Elas ficam pequenas de propósito. O `wrist` cai a 0,032
//   pelo mesmo motivo — `thumb1` sai a 0,046 dele.
// - **Os dedos NÃO são dimensionados para toque.** Eles estão fora do arrasto
//   de cadeia (`HAND_JOINTS` em `dragSolver.ts`), então engordá-los não daria
//   nenhum alvo novo e só transformaria a mão num bloco. Ficam no tamanho que
//   ainda lê como mão.
//
// Aqui nenhum osso é `hidden`: os três trechos escondidos no manequim
// (root→hip, ankle→ball, wrist→indexBase) só estavam cobertos pelos blocos da
// pelve, do pé e da palma, que não existem nesta casca — sem eles, esconder
// deixaria vãos no quadril, no pé e na mão.

export type FigureStyle = 'wooden' | 'stick'

/** As duas cascas, na ordem em que aparecem no seletor da Toolbar. */
export const FIGURE_STYLES: readonly FigureStyle[] = ['wooden', 'stick']

export const DEFAULT_FIGURE_STYLE: FigureStyle = 'wooden'

/** Nome da junta sem o sufixo de lado — as medidas do palito são iguais em L e R. */
function baseJointName(name: string): string {
  return name.replace(/\.(L|R)$/, '')
}

/**
 * Raio da esfera de cada junta no palito, por nome SEM lado (m, na altura de
 * referência). Ver o bloco acima para o porquê de as juntas do tronco alto e as
 * da mão fugirem do "grande para o dedo".
 *
 * Exportada para o teste de cobertura poder cobrar uma medida explícita de cada
 * junta do esqueleto — o `FALLBACK_STICK_RADIUS` existe para a aplicação não
 * quebrar, não para ser usado.
 */
export const STICK_JOINT_RADII: Record<string, number> = {
  root: 0.05,
  spine: 0.042,
  // 0,038 e não 0,045 como as outras juntas grandes: o `upperChest` está a só
  // 0,04 m acima, e com 0,045 a esfera do peito continha o CENTRO dele — a junta
  // virava uma calota protuberante em vez de um alvo. Invariante verificado em
  // `skeletonStick.test.ts` ("nenhuma esfera contém o centro da vizinha").
  chest: 0.038,
  upperChest: 0.028,
  neck: 0.028,
  // `head` não usa esta tabela (é a única com peça própria, `STICK_HEAD_PARTS`),
  // mas a entrada existe para a checagem de cobertura não abrir exceção.
  head: 0.075,
  clavicle: 0.028,
  shoulder: 0.05,
  elbow: 0.045,
  wrist: 0.032,
  thumb1: 0.014,
  thumb2: 0.012,
  indexBase: 0.012,
  indexMid: 0.011,
  indexTip: 0.01,
  fingersBase: 0.016,
  fingersMid: 0.014,
  fingersTip: 0.013,
  hip: 0.045,
  knee: 0.045,
  ankle: 0.04,
  ball: 0.03,
}

/** Raio do cilindro de cada osso no palito, pelo nome SEM lado da junta FILHA (m). Exportada pelo mesmo motivo da tabela de juntas. */
export const STICK_BONE_RADII: Record<string, number> = {
  spine: 0.024,
  chest: 0.026,
  upperChest: 0.02,
  neck: 0.018,
  head: 0.018,
  clavicle: 0.016,
  shoulder: 0.016,
  elbow: 0.02,
  wrist: 0.018,
  thumb1: 0.008,
  thumb2: 0.008,
  indexBase: 0.008,
  indexMid: 0.007,
  indexTip: 0.007,
  fingersBase: 0.012,
  fingersMid: 0.01,
  fingersTip: 0.01,
  hip: 0.022,
  knee: 0.024,
  ankle: 0.021,
  ball: 0.018,
}

/**
 * Usado se uma junta nova entrar no esqueleto sem medida de palito: a casca sai
 * feia, mas a aplicação não quebra em runtime por causa de uma tabela de
 * aparência. Quem cobra a medida explícita é o teste de cobertura
 * (`skeletonStick.test.ts`), no lugar certo para isso.
 */
const FALLBACK_STICK_RADIUS = 0.03

const STICK_HEAD_RADIUS = 0.075

/**
 * Cabeça do palito: esfera deslocada para CIMA em exatamente o próprio raio, de
 * modo que a base dela encoste na junta `head` (onde o cilindro do pescoço
 * termina) e o topo feche a altura de referência — o mesmo 1,70 m que a coroa do
 * ovo do manequim fecha, para o palito não ser um boneco mais baixo.
 *
 * O marcador escuro à frente é o que diz para onde o boneco olha. Numa esfera
 * lisa isso é invisível, e saber a direção do rosto é justamente o que orienta
 * quem está posando numa tela pequena. Reusa o `tint: 'eye'` (preto fixo,
 * independente da cor do boneco) em vez de inventar um tom novo.
 */
const STICK_HEAD_PARTS: readonly SegmentPart[] = [
  { kind: 'ellipsoid', radii: [STICK_HEAD_RADIUS, STICK_HEAD_RADIUS, STICK_HEAD_RADIUS], offset: [0, STICK_HEAD_RADIUS, 0] },
  {
    kind: 'ellipsoid',
    radii: [0.012, 0.012, 0.014],
    offset: [0, STICK_HEAD_RADIUS, 0.068],
    tint: 'eye',
  },
]

function stickJointRadius(name: string): number {
  return STICK_JOINT_RADII[baseJointName(name)] ?? FALLBACK_STICK_RADIUS
}

function stickBoneRadius(childJointName: string): number {
  return STICK_BONE_RADII[baseJointName(childJointName)] ?? FALLBACK_STICK_RADIUS
}

/** Cilindro de raio constante — todo osso do palito é este, só mudando a grossura. */
function stickBone(radius: number): BoneStyle {
  return {
    kind: 'turned',
    points: [
      { t: 0, radius },
      { t: 1, radius },
    ],
  }
}

/**
 * Geradas a partir de `JOINT_NAMES`, e não escritas à mão como as do manequim:
 * a casca é regular (uma esfera por junta, um cilindro por osso), então uma
 * tabela literal de 32+31 entradas só criaria a chance de esquecer uma.
 */
export const JOINT_PARTS_STICK: Record<string, readonly SegmentPart[]> = Object.fromEntries(
  JOINT_NAMES.map((name) => [
    name,
    name === 'head' ? STICK_HEAD_PARTS : [sphere(stickJointRadius(name))],
  ]),
)

export const BONE_STYLES_STICK: Record<string, BoneStyle> = Object.fromEntries(
  JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME).map((name) => [
    name,
    stickBone(stickBoneRadius(name)),
  ]),
)

/**
 * Peças visuais de uma junta, na casca pedida. Valida o nome contra o esqueleto
 * (mesmo erro de `getJoint`).
 *
 * O default é `'wooden'` de propósito: todo chamador que não conhece cascas
 * (enquadramento de câmera em `shotFraming.ts`, exportação, testes antigos)
 * continua vendo exatamente o manequim que via antes.
 */
export function getJointParts(
  name: string,
  style: FigureStyle = DEFAULT_FIGURE_STYLE,
): readonly SegmentPart[] {
  getJoint(name)
  const parts = (style === 'stick' ? JOINT_PARTS_STICK : JOINT_PARTS)[name]
  if (!parts) {
    throw new Error(`Junta sem geometria definida: "${name}"`)
  }
  return parts
}

/** Estilo do osso pai→filha, pelo nome da junta filha (a root não tem osso até ela). */
export function getBoneStyle(
  childJointName: string,
  style: FigureStyle = DEFAULT_FIGURE_STYLE,
): BoneStyle {
  getJoint(childJointName)
  if (childJointName === ROOT_JOINT_NAME) {
    throw new Error(`A junta raiz não tem osso até ela: "${childJointName}"`)
  }
  const boneStyle = (style === 'stick' ? BONE_STYLES_STICK : BONE_STYLES)[childJointName]
  if (!boneStyle) {
    throw new Error(`Osso sem estilo definido para a junta: "${childJointName}"`)
  }
  return boneStyle
}
