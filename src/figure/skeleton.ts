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
    name: 'thumb1.L',
    parent: 'wrist.L',
    position: [-0.038, -0.026, 0],
    limits: { x: { min: -20, max: 50 }, z: { min: 0, max: 40 } },
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
  // Cadeia de 3 juntas (MCP/PIP/DIP) representando as falanges dos 4 dedos
  // (exceto polegar) em bloco — continuam dobrando todos juntos (mesma
  // simplificação já decidida na fase 2), com 3 pontos de dobra (ver
  // DECISOES.md #16). Offsets puros em -Y: o dedo desce reto ao longo da
  // palma, e x positivo curva exatamente para a palma (-Z).
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
    limits: { x: { min: -20, max: 50 }, z: { min: -40, max: 0 } },
  },
  {
    // Espelho do L: positivo = flexão da ponta para a palma no lado R.
    name: 'thumb2.R',
    parent: 'thumb1.R',
    position: [0.034, -0.01, 0],
    limits: { y: { min: 0, max: 80 } },
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
