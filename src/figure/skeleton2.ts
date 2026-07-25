/**
 * Variante "manequim de madeira" do esqueleto — compatível com `skeleton.ts`.
 *
 * A cinemática (hierarquia das 32 juntas, offsets locais e limites) é
 * RE-EXPORTADA do `skeleton.ts` sem nenhuma alteração: qualquer módulo que
 * importa de `./skeleton` pode importar de `./skeleton2` e obter exatamente
 * os mesmos dados e funções (`JOINTS`, `getJoint`, `clampJointRotation`,
 * etc.). Distâncias entre pontos de junção e hierarquia ficam, portanto,
 * idênticas por construção.
 *
 * O que este arquivo ADICIONA é a camada de geometria visual: a descrição,
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
 *   punho (largura em X, distal -Y, palma -Z; ver docblock de
 *   `skeleton.ts`);
 * - pés em cunha com bloco de dedos separado (junta `ball.*` mantida).
 *
 * Como consumir (renderer):
 * - `lathe`: mapear `profile` para `THREE.Vector2(radius, y)` e usar
 *   `LatheGeometry`, com `scale=[1, 1, depthRatio]` no mesh (achatamento em
 *   Z; pontos de raio ~0,0005 são as "tampas" que fecham o sólido, mesmo
 *   truque de `trapezoidProfile` em `Figure.tsx`);
 * - `ellipsoid`: esfera unitária com `scale=radii`;
 * - `box`: `BoxGeometry` com `size`;
 * - ossos `turned`: perfil radial ao longo do eixo do osso (t=0 na junta
 *   pai, t=1 na filha; comprimento real vem do offset do `skeleton.ts`),
 *   equivalente ao `limbProfile` de `Figure.tsx` porém com pontos explícitos;
 * - ossos `blade`: caixa chata afunilada (largura em X do segmento,
 *   espessura em Z) — palma e falanges em bloco;
 * - ossos `hidden`: não renderizar (o trecho fica coberto por um bloco,
 *   ex.: root→hip dentro da pelve, ankle→ball dentro da cunha do pé).
 * - `tint`: `'body'` (default) usa a cor do boneco; `'eye'` usa o preto
 *   fixo dos olhos (mesma regra de `EYE_COLOR` em `Figure.tsx`); `'marker'`
 *   usa um tom de latão fixo (pino no dorso da mão, ver
 *   `HAND_BACK_MARKER`) — mesmo mecanismo dos olhos, cor independente
 *   da cor do boneco.
 *
 * Todas as medidas em metros, na altura de referência (1,70 m), no espaço
 * local da junta (mesma convenção do `skeleton.ts`: +Z = frente).
 */

export * from './skeleton'

import { ROOT_JOINT_NAME, getJoint } from './skeleton'

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
  /** Lâmina chata afunilada — palma e falanges em bloco da mão. */
  | { kind: 'blade'; widthStart: number; widthEnd: number; thickness: number }
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
const knuckle = (halfWidth: number, radius: number): SegmentPart => ({
  kind: 'ellipsoid',
  radii: [halfWidth, radius, radius],
})

/**
 * Falange distal dos 4 dedos além da última junta (`fingersTip.*`): lâmina
 * arredondada que afunila até a ponta (lathe achatado em Z na espessura das
 * falanges).
 */
const FINGERS_TIP: SegmentPart = {
  kind: 'lathe',
  profile: [
    { y: -0.028, radius: CAP },
    { y: -0.024, radius: 0.017 },
    { y: -0.013, radius: 0.027 },
    { y: -0.002, radius: 0.031 },
    { y: 0.002, radius: CAP },
  ],
  depthRatio: 0.27,
}

const FINGERS_BASE_KNUCKLE: readonly SegmentPart[] = [knuckle(0.042, 0.0145)]
const FINGERS_MID_KNUCKLE: readonly SegmentPart[] = [knuckle(0.038, 0.0125)]
const FINGERS_TIP_KNUCKLE: readonly SegmentPart[] = [knuckle(0.034, 0.011), FINGERS_TIP]

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
  'fingersBase.L': FINGERS_BASE_KNUCKLE,
  'fingersBase.R': FINGERS_BASE_KNUCKLE,
  'fingersMid.L': FINGERS_MID_KNUCKLE,
  'fingersMid.R': FINGERS_MID_KNUCKLE,
  'fingersTip.L': FINGERS_TIP_KNUCKLE,
  'fingersTip.R': FINGERS_TIP_KNUCKLE,
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
  // Palma alargando do punho (0,056) para a fileira dos nós (0,080);
  // falanges em bloco afunilando dali até a ponta — larguras encaixadas nas
  // elipses de dobradiça das juntas (`knuckle`, um pouco mais largas).
  'fingersBase.L': { kind: 'blade', widthStart: 0.056, widthEnd: 0.08, thickness: 0.026 },
  'fingersBase.R': { kind: 'blade', widthStart: 0.056, widthEnd: 0.08, thickness: 0.026 },
  'fingersMid.L': { kind: 'blade', widthStart: 0.078, widthEnd: 0.072, thickness: 0.019 },
  'fingersMid.R': { kind: 'blade', widthStart: 0.078, widthEnd: 0.072, thickness: 0.019 },
  'fingersTip.L': { kind: 'blade', widthStart: 0.07, widthEnd: 0.064, thickness: 0.017 },
  'fingersTip.R': { kind: 'blade', widthStart: 0.07, widthEnd: 0.064, thickness: 0.017 },

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

/** Peças visuais de uma junta. Valida o nome contra o esqueleto (mesmo erro de `getJoint`). */
export function getJointParts(name: string): readonly SegmentPart[] {
  getJoint(name)
  const parts = JOINT_PARTS[name]
  if (!parts) {
    throw new Error(`Junta sem geometria definida: "${name}"`)
  }
  return parts
}

/** Estilo do osso pai→filha, pelo nome da junta filha (a root não tem osso até ela). */
export function getBoneStyle(childJointName: string): BoneStyle {
  getJoint(childJointName)
  if (childJointName === ROOT_JOINT_NAME) {
    throw new Error(`A junta raiz não tem osso até ela: "${childJointName}"`)
  }
  const style = BONE_STYLES[childJointName]
  if (!style) {
    throw new Error(`Osso sem estilo definido para a junta: "${childJointName}"`)
  }
  return style
}
