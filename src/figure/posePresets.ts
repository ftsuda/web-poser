import { resolveHandPreset, type HandPresetKey } from './handPresets'
import { SIDES, negateAngle, type Side } from './poseMirror'
import {
  JOINT_NAMES,
  ROOT_JOINT_NAME,
  clampJointRotation,
  getJoint,
  type JointRotation,
} from './skeleton'

/**
 * Poses predefinidas como ponto de partida para posar um boneco — ver
 * PLANO.md > "Interação de pose", item 4. Cada preset é parcial (só lista os
 * eixos/juntas que se afastam da pose neutra); `resolvePosePreset` completa
 * com zero e grampeia pelos limites de `skeleton.ts`, gerando uma pose
 * completa pronta para substituir `figure.pose`. Convenção de sinal de
 * `hip.x`/`shoulder.x` (**negativo** flexiona para a frente, positivo estende
 * para trás) confirmada numericamente montando a cinemática direta e medindo
 * a posição resultante da junta no mundo — não por dedução (ver DECISOES.md
 * #13, que também documenta a correção dos limites de `skeleton.ts` para o
 * lado "frente" ter o alcance anatômico maior). `elbow.x` segue a convenção
 * oposta (**negativo** flexiona, já que o cotovelo dobra para a frente ao
 * contrário do quadril/ombro — ver o docblock de `skeleton.ts` e DECISOES.md
 * #14, que corrigiu o eixo de só permitir hiperestender para só permitir a
 * flexão real).
 *
 * `elbow.*.y` (pronação/supinação do antebraço) tem uma torção neutra
 * NÃO-ZERO aplicada por padrão a todo preset que não especifique o eixo —
 * ver `NEUTRAL_ELBOW_TWIST` abaixo e DECISOES.md #22/#23/#25. Desde o #25 a
 * mão é modelada ALINHADA aos eixos locais do punho (dedos -Y, polegar ∓X,
 * palma -Z — ver docblock de `skeleton.ts`), e a torção neutra passou de
 * ±45 para o **espelho simples ±90** (`elbow.L.y=90`, `elbow.R.y=-90` —
 * mesmo padrão "mesmo valor, sinal oposto" documentado no docblock de
 * `skeleton.ts` para os eixos Y/Z de juntas pareadas): é exatamente o giro
 * que leva a palma modelada em -Z local para a orientação natural (palma na
 * coxa em pé; palma para baixo com polegar para a frente na T-pose), EXATO
 * por construção — sem valor resolvido numericamente. `elbow.y=0` passa a
 * significar "palma para trás" (pronação máxima a partir do neutro).
 *
 * **Cuidado ao medir a normal da mão para os dois lados:** o produto
 * vetorial usado para verificar "a palma aponta para onde" é sensível à
 * ORDEM dos operandos, e a ordem que dá a normal "para fora da palma" NÃO é
 * a mesma para os dois lados — mão direita é a imagem espelhada da esquerda
 * (quiralidade), e um produto vetorial (pseudovetor) não respeita reflexão
 * como um vetor de posição comum. Comparar `cross(dedos, polegar)` de um
 * lado com `cross(dedos, polegar)` do OUTRO lado (mesma ordem) e esperar o
 * mesmo sinal é um erro de método — dá a impressão de um "conflito" que não
 * existe de verdade (foi exatamente esse erro que levou à correção
 * equivocada `elbow.R.y=135` do #22, revertida no #23 depois de o usuário
 * relatar o polegar visualmente para trás). O jeito certo de comparar os
 * dois lados é inverter a ordem dos operandos no lado R (ou, equivalente,
 * negar o resultado) antes de comparar com o alvo.
 *
 * COLOCAÇÃO NO CHÃO (DECISOES.md #30): um preset pode declarar também a
 * rotação do boneco e a altura do quadril acima do chão — sem isso "deitado"
 * e "fetal" não existiriam (e "sentado" flutuava no ar, o que ficou corrigido
 * junto). É a única parte do preset que sai da pose interna; X/Z (onde o
 * boneco está no chão) nunca são tocados. Ver `PosePresetPlacement`.
 */

export type PosePresetKey =
  | 'standing'
  | 'tpose'
  | 'sitting'
  | 'walking'
  | 'running'
  | 'lyingHandsBehindHead'
  | 'fetal'
  | 'fighting'
  | 'superman'
  | 'model'
  | 'punchGiving'
  | 'punchTaking'
  | 'kickGiving'
  | 'kickTaking'
  | 'chokeGiving'
  | 'chokeTaking'
  | 'apose'
  | 'pointForward'
  | 'pointUp'
  | 'pointDown'
  | 'pointFar'
  | 'pointAtOther'
  | 'presenting'
  | 'pointSelf'
  | 'thumbBack'
  | 'squat'
  | 'kneelingOneKnee'
  | 'kneelingBoth'
  | 'crossLegged'
  | 'allFours'
  | 'plank'
  | 'pronePropped'
  | 'sideLying'
  | 'touchToes'
  | 'armsCrossed'
  | 'handsOnHips'
  | 'waving'
  | 'celebrating'
  | 'handOnChin'
  | 'headDown'
  | 'startled'
  | 'kpopFingerHeart'
  | 'kpopBoxArms'
  | 'kpopPointDance'
  | 'kpopShoulderWave'
  | 'jumping'
  | 'throwing'
  | 'kickingBall'
  | 'carryingBox'
  | 'climbing'
  | 'stepUp'
  | 'balletPreparation'
  | 'balletPirouette'
  | 'handshake'
  | 'hug'
  | 'danceLead'
  | 'danceFollow'
  | 'carryingPiggyback'
  | 'carriedPiggyback'
  | 'carryingCradle'
  | 'carriedCradle'
  | 'pullingUp'
  | 'beingPulledUp'
  | 'pushGiving'
  | 'pushTaking'
  | 'kneeStrikeGiving'
  | 'kneeStrikeTaking'
  | 'clinch'
  | 'meditating'
  | 'businessman'
  | 'heroStance'
  | 'lyingSpreadSupine'
  | 'lyingSpreadProne'
  | 'sittingLegsForward'
  | 'sittingKneesBent'
  | 'rearChokeKneeling'
  | 'rearChokeSeated'
  | 'groundChokeGiving'
  | 'groundChokeTaking'
  | 'armLockPushGiving'
  | 'armLockPushTaking'
  | 'armLockPullGiving'
  | 'armLockPullTaking'

export type PosePresetGroupKey =
  | 'reference'
  | 'everyday'
  | 'ground'
  | 'pointing'
  | 'action'
  | 'expressive'
  | 'kpop'
  | 'pairs'
  | 'fight'

export interface PosePresetGroup {
  key: PosePresetGroupKey
  poses: readonly PosePresetKey[]
}

/**
 * Agrupamento das poses para o combo box do painel (pedido do usuário): com
 * mais de 30 poses, uma grade de botões deixou de caber e de ser navegável.
 * A ordem aqui é a ordem na tela, e `POSE_PRESET_KEYS` é DERIVADO desta
 * tabela — assim não há como uma pose existir e não aparecer em lugar nenhum
 * (há teste travando os dois sentidos).
 */
export const POSE_PRESET_GROUPS: readonly PosePresetGroup[] = [
  { key: 'reference', poses: ['standing', 'tpose', 'apose'] },
  { key: 'everyday', poses: ['sitting', 'walking', 'running', 'model'] },
  {
    key: 'ground',
    poses: [
      'squat',
      'kneelingOneKnee',
      'kneelingBoth',
      'crossLegged',
      'meditating',
      'fetal',
      'sittingLegsForward',
      'sittingKneesBent',
      'allFours',
      'plank',
      'pronePropped',
      'sideLying',
      'lyingHandsBehindHead',
      'lyingSpreadSupine',
      'lyingSpreadProne',
    ],
  },
  {
    key: 'pointing',
    poses: [
      'pointForward',
      'pointUp',
      'pointDown',
      'pointFar',
      'pointAtOther',
      'presenting',
      'pointSelf',
      'thumbBack',
    ],
  },
  {
    key: 'action',
    poses: [
      'superman',
      'touchToes',
      'jumping',
      'throwing',
      'kickingBall',
      'carryingBox',
      'climbing',
      'stepUp',
      'balletPreparation',
      'balletPirouette',
    ],
  },
  {
    key: 'expressive',
    poses: [
      'armsCrossed',
      'businessman',
      'handsOnHips',
      'heroStance',
      'waving',
      'celebrating',
      'handOnChin',
      'headDown',
      'startled',
    ],
  },
  {
    key: 'kpop',
    poses: ['kpopFingerHeart', 'kpopBoxArms', 'kpopPointDance', 'kpopShoulderWave'],
  },
  {
    key: 'pairs',
    poses: [
      'handshake',
      'hug',
      'danceLead',
      'danceFollow',
      'carryingPiggyback',
      'carriedPiggyback',
      'carryingCradle',
      'carriedCradle',
      'pullingUp',
      'beingPulledUp',
    ],
  },
  {
    key: 'fight',
    poses: [
      'fighting',
      'punchGiving',
      'punchTaking',
      'kickGiving',
      'kickTaking',
      'chokeGiving',
      'chokeTaking',
      'rearChokeKneeling',
      'rearChokeSeated',
      'groundChokeGiving',
      'groundChokeTaking',
      'pushGiving',
      'pushTaking',
      'kneeStrikeGiving',
      'kneeStrikeTaking',
      'armLockPushGiving',
      'armLockPushTaking',
      'armLockPullGiving',
      'armLockPullTaking',
      'clinch',
    ],
  },
]

export const POSE_PRESET_KEYS: readonly PosePresetKey[] = POSE_PRESET_GROUPS.flatMap(
  (group) => group.poses,
)

type PartialPose = Partial<Record<string, Partial<JointRotation>>>

/**
 * Como o boneco fica assentado no mundo. `hipHeightM` é a altura da junta do
 * quadril acima do chão na altura de referência (1,70 m) — o próprio esqueleto
 * põe o quadril em 0,90 m em pé, então esse é o valor "neutro". A conversão
 * para o `position.y` do boneco (e o escalonamento pela altura dele) fica em
 * `resolvePosePresetPlacement`.
 */
export interface PosePresetPlacement {
  rotation: JointRotation
  /** Deslocamento vertical a aplicar em `figure.position[1]`, em metros na altura de referência. */
  groundOffsetM: number
  /**
   * `true` quando o preset NÃO inclina o boneco (as poses em pé/sentadas): aí
   * o giro em Y — a direção que o boneco encara no chão — é escolha de
   * encenação do usuário e é preservada, em vez de zerada a cada preset.
   * Nas poses que inclinam (deitado/fetal/superman) a rotação é imposta
   * inteira: misturar a inclinação com um giro prévio deixaria o boneco
   * rolado sobre o próprio eixo, não deitado.
   */
  preservesHeading: boolean
}

interface PosePresetDefinition {
  pose: PartialPose
  /** Rotação do boneco (root), em graus — ausente = em pé. */
  rotation?: Partial<JointRotation>
  /** Altura do quadril acima do chão, em metros na altura de referência — ausente = em pé. */
  hipHeightM?: number
  /**
   * Pose de mão do preset; ausente = mãos abertas (neutras). Uma chave só vale
   * para as DUAS mãos; `{ L, R }` dá uma pose a cada lado — é o que permite
   * apontar com uma mão e deixar a outra descansando (DECISOES.md #45).
   */
  hands?: HandPresetKey | Partial<Record<Side, HandPresetKey>>
}

/** Pose de mão de um preset para um lado (ou `null` se ele não declara nada para esse lado). */
function presetHandFor(preset: PosePresetDefinition, side: Side): HandPresetKey | null {
  if (!preset.hands) return null
  return typeof preset.hands === 'string' ? preset.hands : (preset.hands[side] ?? null)
}

/** Altura da junta do quadril na pose em pé — o "neutro" de `hipHeightM`. */
/** Altura do quadril na pose em pé — o `hipHeightM` implícito de quem não declara colocação. */
export const STANDING_HIP_HEIGHT_M = getJoint(ROOT_JOINT_NAME).position[1]

/**
 * Expande uma especificação declarada UMA vez (na convenção do lado esquerdo)
 * para os dois lados, negando Y e Z no lado direito — a regra exata de
 * reflexão sagital de `poseMirror.ts`. Usado nas poses simétricas para que os
 * dois lados não possam sair de sincronia por erro de digitação de sinal; as
 * poses assimétricas (andando, luta, modelo) declaram cada lado à mão.
 */
function symmetric(spec: Record<string, Partial<JointRotation>>): PartialPose {
  const pose: PartialPose = {}

  for (const [base, rotation] of Object.entries(spec)) {
    pose[`${base}.L`] = rotation
    const mirroredAxes: Partial<JointRotation> = {}
    if (rotation.x !== undefined) mirroredAxes.x = rotation.x
    if (rotation.y !== undefined) mirroredAxes.y = negateAngle(rotation.y)
    if (rotation.z !== undefined) mirroredAxes.z = negateAngle(rotation.z)
    pose[`${base}.R`] = mirroredAxes
  }

  return pose
}

const POSE_PRESETS: Record<PosePresetKey, PosePresetDefinition> = {
  // Pose neutra do próprio skeleton.ts (braços relaxados ao lado do corpo) —
  // a torção do antebraço não é declarada aqui: vem do default
  // `NEUTRAL_ELBOW_TWIST` aplicado por `resolvePosePreset`.
  standing: { pose: {} },

  // T-pose: braços na horizontal — pose padrão ao criar um boneco (pedido
  // do usuário, ver DECISOES.md #19), porque separa bem os membros do corpo
  // e ajuda a alcançar juntas que ficam encobertas na pose "em pé". Só o
  // ombro é declarado — a torção do antebraço é a MESMA de `standing`
  // (default `NEUTRAL_ELBOW_TWIST`, espelho simples), pois abduzir o ombro
  // gira o braço inteiro como corpo rígido, sem alterar a torção relativa
  // da mão — vale para os dois lados (ver DECISOES.md #23).
  tpose: { pose: symmetric({ shoulder: { z: 90 } }) },

  // Sentado numa cadeira. `hipHeightM` (novidade do #30) enfim assenta a pose:
  // com a coxa na horizontal e a canela na vertical, o quadril fica a uma
  // canela + a altura do tornozelo do chão (0,415 + 0,07 = 0,485 m, altura de
  // assento realista) e a sola encosta no chão — antes o boneco sentava no ar.
  sitting: {
    pose: symmetric({ hip: { x: -90 }, knee: { x: 95 }, ankle: { x: -5 } }),
    hipHeightM: 0.485,
    hands: 'relaxed',
  },

  walking: {
    pose: {
      'hip.L': { x: -25 },
      'knee.L': { x: 20 },
      'ankle.R': { x: 5 },
      'hip.R': { x: 20 },
      'knee.R': { x: 10 },
      'shoulder.L': { x: 20 },
      'elbow.L': { x: -10 },
      'shoulder.R': { x: -20 },
      'elbow.R': { x: -15 },
    },
    hands: 'relaxed',
  },

  running: {
    pose: {
      'hip.L': { x: -50 },
      'knee.L': { x: 80 },
      'ankle.L': { x: -10 },
      'hip.R': { x: 25 },
      'knee.R': { x: 40 },
      'ankle.R': { x: 10 },
      'shoulder.L': { x: 40 },
      'elbow.L': { x: -60 },
      'shoulder.R': { x: -45 },
      'elbow.R': { x: -90 },
    },
    hands: 'fist',
  },

  // Deitado de costas com as mãos atrás da cabeça. `rotation.x = -90` deita o
  // boneco com a FRENTE para cima (Rx(-90) leva o +Z do corpo para o +Y do
  // mundo) e a cabeça para -Z; `hipHeightM` é a meia-espessura do bloco da
  // pelve, para as costas encostarem no chão.
  lyingHandsBehindHead: {
    pose: symmetric({
      // Ombro/cotovelo resolvidos por busca numérica, não por dedução: com
      // estes valores o punho cai a 2 cm do alvo "na altura da cabeça, um
      // pouco atrás dela" e o cotovelo fica aberto para o lado e para trás
      // (perto do chão, deitado) — ver DECISOES.md #30.
      shoulder: { x: -110, y: -45, z: 100 },
      elbow: { x: -135 },
      wrist: { x: 10 },
      hip: { x: 0, z: 6 },
      knee: { x: 8 },
      ankle: { x: 15 },
    }),
    rotation: { x: -90 },
    hipHeightM: 0.11,
    hands: 'relaxed',
  },

  // Sentado no chão abraçando os joelhos (posição fetal): quadris e joelhos
  // bem fechados, tronco curvado por cima deles e os braços dando a volta nas
  // canelas, com as mãos se encontrando na frente.
  fetal: {
    pose: {
      ...symmetric({
        hip: { x: -115, z: 12 },
        knee: { x: 130 },
        // +15 e não 0: a canela fica inclinada 15° para a frente (pelve -30,
        // quadril -115, joelho +130), e o pé herda essa inclinação — é a
        // flexão plantar de 15° que devolve a sola à horizontal.
        ankle: { x: 15 },
        // Braços resolvidos por busca numérica contra o alvo "em volta da
        // canela, logo abaixo do joelho": os punhos se encontram a 3 cm do
        // alvo, na frente das canelas (ver DECISOES.md #30).
        shoulder: { x: -60, y: -50, z: 10 },
        elbow: { x: -70 },
        wrist: { x: 15 },
      }),
      spine: { x: 30 },
      chest: { x: 20 },
      neck: { x: 30 },
      head: { x: 10 },
    },
    // A pelve inclinada para trás é o que torna a pose possível: com o quadril
    // flexionado 115° em relação a uma pelve reta, a coxa mal passa da
    // horizontal e o pé fura o chão (o joelho não dobra o suficiente para
    // compensar — 130° de flexão contra os ~175° que seriam necessários).
    // Reclinando a pelve 30°, a coxa sobe de fato, o joelho fica alto e a sola
    // encosta no chão — exatamente o que uma pessoa faz ao abraçar os joelhos.
    // O valor de `hipHeightM` foi resolvido numericamente: é o que põe o
    // tornozelo em 0,07 m (sola no chão) sem enterrar o bloco da pelve.
    rotation: { x: -30 },
    hipHeightM: 0.135,
    hands: 'relaxed',
  },

  // Guarda de boxe (pé esquerdo à frente): base larga e joelhos flexionados,
  // tronco girado de lado para oferecer menos alvo, punhos fechados na altura
  // do rosto. Assimétrica de propósito — cada lado é declarado à mão.
  fighting: {
    pose: {
      // Perna da frente flexionada; a de trás quase esticada, com o calcanhar
      // erguido e a ponta do pé no chão. `hipHeightM` e os ângulos da perna de
      // trás saíram de uma busca numérica que planta as DUAS pontas de pé no
      // chão ao mesmo tempo (com o quadril em 0,90 o pé de trás flutuava 7 cm).
      'hip.L': { x: -22, z: 10 },
      'knee.L': { x: 28 },
      'ankle.L': { x: 5 },
      'hip.R': { x: 15, z: -14 },
      'knee.R': { x: 15 },
      'ankle.R': { x: 45 },
      spine: { x: 10, y: -25 },
      chest: { x: 5, y: -12 },
      neck: { x: -5, y: 22 },
      head: { x: 8 },
      // Punhos na altura do rosto, resolvidos numericamente: o da frente a 2 cm
      // do alvo (à frente da face) e o de trás a 2 cm do queixo.
      'shoulder.L': { x: -80, y: -10, z: 45 },
      'elbow.L': { x: -140 },
      'wrist.L': { x: -15 },
      // Braço de trás re-resolvido em 2026-07-28 (pedido do usuário: cotovelo
      // direito mais baixo). A primeira solução punha o punho no queixo mas o
      // COTOVELO acima da linha do ombro (1,499 m) e 33 cm aberto — braço de
      // "asa", não guarda. Re-otimizado com as mesmas penalidades explícitas
      // do clinche (#37): cotovelo pelo menos 18 cm ABAIXO do punho e a no
      // máximo 26 cm da linha média. Resultado medido: cotovelo em 1,237 m
      // (26 cm mais baixo, junto às costelas, com `shoulder.R.z` na adução
      // máxima de +20) e o punho a 2 MM de onde estava — a guarda não muda,
      // só o cotovelo desce.
      'shoulder.R': { x: -94, y: 37, z: 20 },
      'elbow.R': { x: -135 },
      'wrist.R': { x: -15 },
    },
    hipHeightM: 0.88,
    hands: 'fist',
  },

  // Voo do Superman: `rotation.x = 90` deixa o boneco de bruços (Rx(90) leva o
  // +Z do corpo para o -Y do mundo) com a cabeça para +Z, "voando" para a
  // frente; `hipHeightM` acima da altura em pé para ele pairar. Braços
  // estendidos à frente, tronco arqueado e pontas dos pés esticadas.
  superman: {
    pose: {
      ...symmetric({
        shoulder: { x: -168, z: 8 },
        elbow: { x: -8 },
        hip: { x: 12, z: 7 },
        knee: { x: 6 },
        ankle: { x: 40 },
        ball: { x: -15 },
      }),
      spine: { x: -22 },
      chest: { x: -14 },
      neck: { x: -35 },
      head: { x: -15 },
    },
    rotation: { x: 90 },
    hipHeightM: 1.05,
    hands: 'fist',
  },

  // Pose de modelo de revista: contraposto clássico — peso na perna esquerda
  // (de apoio, esticada), perna direita cruzada à frente com o pé em ponta,
  // quadril projetado, mão esquerda na cintura e cabeça virada. Assimétrica de
  // propósito.
  model: {
    pose: {
      'hip.L': { x: -3, z: 4 },
      'knee.L': { x: 3 },
      'hip.R': { x: -14, z: -20 },
      'knee.R': { x: 24 },
      'ankle.R': { x: 30 },
      'ball.R': { x: -20 },
      spine: { x: -5, z: -10 },
      chest: { z: 6 },
      neck: { y: -25, z: 4 },
      head: { y: -10 },
      'clavicle.L': { z: 8 },
      // Mão na cintura ("asa"): resolvido numericamente contra o alvo "punho
      // logo acima do quadril esquerdo, cotovelo bem aberto para o lado" — o
      // punho fica a 2 cm do alvo e o cotovelo a 34 cm da linha média.
      'shoulder.L': { x: 50, y: -60, z: 40 },
      'elbow.L': { x: -90 },
      'wrist.L': { x: 10 },
      'shoulder.R': { x: -6, z: -14 },
      'elbow.R': { x: -18 },
    },
    hands: 'relaxed',
  },

  // ---------------------------------------------------------------------
  // Poses de luta em PAR (DECISOES.md #35). Cada golpe tem duas poses que se
  // encaixam: o alvo do atacante cai na altura exata da parte atingida de quem
  // recebe. Esses encontros — punho × rosto (1,50 m), pé × barriga (1,04 m),
  // antebraço × pescoço (1,37/1,39 m) — foram RESOLVIDOS numericamente contra
  // a cinemática direta, não estimados, e é o que os testes travam. Quem
  // recebe o golpe fica DE PÉ, no instante do impacto (escolha do usuário).
  // ---------------------------------------------------------------------

  // Cruzado de direita no instante do impacto: base de boxe com o pé esquerdo
  // à frente (a mesma de "Luta"), tronco girado no sentido do golpe
  // (`spine.y` POSITIVO leva o ombro DIREITO para a frente) e braço direito
  // estendido. Alvo resolvido: punho a (0; 1,50; 0,62) — na linha média, na
  // altura do rosto do adversário. A guarda esquerda ficou junto ao queixo
  // (2 mm do alvo).
  punchGiving: {
    pose: {
      'hip.L': { x: -22, z: 10 },
      'knee.L': { x: 28 },
      'ankle.L': { x: 5 },
      'hip.R': { x: 15, z: -14 },
      'knee.R': { x: 15 },
      'ankle.R': { x: 45 },
      spine: { x: 5, y: 28 },
      chest: { x: 3, y: 18 },
      neck: { y: -30 },
      head: { x: 5 },
      'shoulder.R': { x: -128, y: -18, z: -25 },
      'elbow.R': { x: -8 },
      'shoulder.L': { x: -135, y: -85, z: -4 },
      'elbow.L': { x: -109 },
    },
    hipHeightM: 0.88,
    hands: 'fist',
  },

  // Levando o soco: queixo jogado para cima e de lado pelo impacto (o recuo
  // vem do PESCOÇO, no limite de extensão), joelhos cedendo e braços abertos
  // pela força do golpe. A flexão das pernas — e daí a altura do quadril — foi
  // resolvida para o ROSTO (o ponto do nariz/olhos, não a junta da cabeça)
  // cair na altura do punho de `punchGiving`: 1,500 m nos dois.
  //
  // O tronco inclina para a FRENTE (`spine.x` positivo) mesmo levando o golpe,
  // e isso não é descuido: com o tronco em extensão o rosto recuava 21 cm
  // atrás do quadril, e os dois bonecos só encaixavam a 0,41 m um do outro —
  // corpos atravessados. Inclinado para a frente (é o boxeador que vinha
  // avançando quando o soco o parou), o rosto fica sobre o próprio quadril e o
  // par encaixa a **0,63 m**, uma troca de golpes plausível.
  punchTaking: {
    pose: {
      spine: { x: 15, y: -10, z: 6 },
      chest: { x: -5, y: -6 },
      neck: { x: -40, y: -10, z: 10 },
      head: { x: -20, y: -10 },
      'shoulder.L': { x: 25, z: 75 },
      'elbow.L': { x: -35 },
      'shoulder.R': { x: 15, z: -85 },
      'elbow.R': { x: -45 },
      'hip.L': { x: -40, z: 8 },
      'knee.L': { x: 36 },
      'ankle.L': { x: 5 },
      'hip.R': { x: -6, z: -10 },
      'knee.R': { x: 56 },
      'ankle.R': { x: 15 },
    },
    hipHeightM: 0.81,
    hands: 'relaxed',
  },

  // Chute frontal com a perna direita, no instante do impacto: perna de apoio
  // esticada e plantada, tronco reclinado para trás como contrapeso, braços
  // abertos para o equilíbrio. Alvo resolvido: tornozelo a (0; 1,05; 0,86) —
  // altura da barriga do adversário; ficou a 4,6 cm dali, no limite do alcance
  // do quadril (`hip.x` chega a -120).
  kickGiving: {
    pose: {
      'hip.L': { x: 5, z: 6 },
      'knee.L': { x: 8 },
      'ankle.L': { x: 0 },
      'hip.R': { x: -101, y: -13, z: 4 },
      'knee.R': { x: 4 },
      'ankle.R': { x: 40 },
      spine: { x: -18, y: 10 },
      chest: { x: -10 },
      neck: { x: 15 },
      'shoulder.L': { x: -30, z: 40 },
      'elbow.L': { x: -100 },
      'shoulder.R': { x: 40, z: -25 },
      'elbow.R': { x: -60 },
    },
    hands: 'fist',
  },

  // Levando o chute na barriga: corpo dobrado para a frente em volta do ponto
  // do impacto, cabeça baixa e mãos descendo para proteger. Simétrica de
  // propósito (o golpe vem de frente). A flexão das pernas e a altura do
  // quadril foram resolvidas para a junta `spine` — a barriga — cair na altura
  // do pé de `kickGiving`: 1,043 m nos dois, 0,1 mm de diferença.
  kickTaking: {
    pose: {
      ...symmetric({
        hip: { x: 4, z: 6 },
        knee: { x: 33 },
        ankle: { x: 5 },
        // Braços resolvidos contra o alvo "mãos na barriga" (7 cm dali): com o
        // tronco dobrado, um ombro mais aberto deixava as mãos estendidas para
        // a frente, parecendo mergulho em vez de proteção.
        shoulder: { x: -10, z: -10 },
        elbow: { x: -130 },
      }),
      spine: { x: 40 },
      chest: { x: 20 },
      neck: { x: 20 },
      head: { x: 10 },
    },
    hipHeightM: 0.873,
    hands: 'fist',
  },

  // Joelhada na barriga (pedido do usuário, com foto de referência de um jogo
  // de luta): o mesmo grip de duas mãos do clinche (`clinch`, reaproveitado —
  // não é um alvo novo) segurando a cabeça do outro, com o joelho direito
  // disparando para cima e para a frente. Perna de apoio (esquerda) quase reta
  // e plantada; a que golpeia fica NO AR (`ball.R` a 0,82 m do chão).
  //
  // Alvo resolvido: o JOELHO (não o pé — a joelhada golpeia com a própria
  // junta) na altura da barriga de `kneeStrikeTaking` — varredura com
  // penalidades de perto da linha média (≤8 cm) e bem projetado à frente
  // (≥15 cm). Fechou em 0,0 cm de erro de altura, 6,5 cm da linha média e
  // 36,5 cm à frente do quadril.
  kneeStrikeGiving: {
    pose: {
      'hip.L': { x: 5, z: 6 },
      'knee.L': { x: 8 },
      'ankle.L': { x: 0 },
      'hip.R': { x: -110, y: 4, z: 22 },
      'knee.R': { x: 57 },
      spine: { x: -8 },
      chest: { x: -4 },
      'shoulder.R': { x: -91, y: 6, z: 20 },
      'elbow.R': { x: -89, y: -130 },
      'wrist.R': { x: -19 },
      'shoulder.L': { x: -82, y: -9, z: -19 },
      'elbow.L': { x: -98, y: 131 },
      'wrist.L': { x: -33 },
    },
    hipHeightM: 0.9083,
    hands: 'fist',
  },

  // Levando a joelhada na barriga: corpo dobrado para a frente com a cabeça
  // puxada para baixo (o grip do atacante na nuca) e as mãos na barriga —
  // mesma reação de `kickTaking`, mais dobrada (a joelhada é golpe de
  // clinche, bem mais perto). A altura do quadril foi resolvida para a junta
  // `spine` cair EXATAMENTE na altura do joelho de `kneeStrikeGiving`: 1,030 m
  // nos dois.
  kneeStrikeTaking: {
    pose: {
      ...symmetric({
        hip: { x: 6, z: 6 },
        knee: { x: 35 },
        ankle: { x: 6 },
        shoulder: { x: -10, z: -10 },
        elbow: { x: -125 },
      }),
      spine: { x: 55 },
      chest: { x: 25 },
      neck: { x: 45 },
      head: { x: 15 },
    },
    hipHeightM: 0.8598,
    hands: 'fist',
  },

  // Gravata por trás: o atacante fica ATRÁS da vítima (os dois encarando o
  // mesmo lado) e passa os braços em volta do pescoço dela — antebraço direito
  // cruzando a garganta e mão esquerda fechando a chave sobre o próprio punho.
  // Alvos resolvidos: punho direito a (0,09; 1,37; 0,34) e esquerdo a
  // (-0,03; 1,31; 0,30), à frente do próprio peito por uma profundidade de
  // corpo. Pernas escoradas, uma à frente da outra, puxando para trás.
  chokeGiving: {
    pose: {
      'hip.L': { x: -12, z: 8 },
      'knee.L': { x: 8 },
      'ankle.L': { x: 24 },
      'hip.R': { x: 8, z: -12 },
      'knee.R': { x: 10 },
      'ankle.R': { x: 22 },
      spine: { x: -10 },
      chest: { x: -6 },
      neck: { x: -10 },
      head: { x: -5 },
      'shoulder.R': { x: -77, y: 57, z: 20 },
      'elbow.R': { x: -58 },
      'shoulder.L': { x: -58, y: -82, z: 4 },
      'elbow.L': { x: -71 },
    },
    hipHeightM: 0.916,
    hands: 'fist',
  },

  // ---------------------------------------------------------------------
  // A-pose (DECISOES.md #36). Braços a 45°, o bind pose padrão de quase todo
  // pipeline de jogo — útil porque este app exporta `.glb`. Como a T-pose, é
  // pose de referência: mão aberta e nenhum outro ângulo declarado.
  // ---------------------------------------------------------------------
  apose: { pose: symmetric({ shoulder: { z: 45 } }) },

  // ---------------------------------------------------------------------
  // Apontar (DECISOES.md #36, revisto no #45). Estas poses nasceram com a MÃO
  // ABERTA ("mão-faca") porque os quatro dedos eram um bloco só e apontar com
  // o indicador era impossível. Com o indicador separado (#45) elas apontam
  // com o dedo, e só a mão do gesto (`hands: { R: 'point' }`) — a outra
  // continua aberta, descansando. Em silhueta o dedo é fino; o que faz o
  // gesto ler como apontar continua sendo o braço: punho zerado (a mão
  // continua a linha do antebraço), cotovelo quase estendido, e a cabeça
  // acompanhando.
  //
  // `presenting` e `pointSelf` seguem de mão aberta de propósito: são gestos
  // de PALMA (oferecer, "quem, eu?"), não de dedo.
  //
  // `elbow.R.y` é o que decide o SENTIDO do gesto — medido, não deduzido:
  // com o braço à frente, a torção neutra (-90) deixa a palma na vertical
  // (mão-faca), `0` deixa a palma para baixo (indicar/comandar) e `-180` para
  // cima (apresentar/oferecer). Cada pose abaixo escolhe a sua.
  // ---------------------------------------------------------------------

  // Braço na horizontal, mão-faca, cabeça na direção do gesto. Alvo resolvido:
  // punho na altura do ombro e à frente do corpo; a ponta dos dedos chega a
  // 0,65 m do peito.
  pointForward: {
    pose: {
      'hip.L': { z: 3 },
      'hip.R': { z: -3 },
      'shoulder.L': { x: 0, z: 5 },
      'elbow.L': { x: -8 },
      'shoulder.R': { x: -90, y: 0, z: 14 },
      'elbow.R': { x: -4 },
    },
    hands: { R: 'point' },
  },

  // Braço acima da linha do ombro, tronco levemente arqueado e olhar junto.
  pointUp: {
    pose: {
      'hip.L': { z: 3 },
      'hip.R': { z: -3 },
      spine: { x: -8 },
      neck: { x: -25 },
      head: { x: -10 },
      'shoulder.L': { x: 0, z: 5 },
      'elbow.L': { x: -8 },
      'shoulder.R': { x: -143, y: -85, z: 15 },
      'elbow.R': { x: 0, y: -10 },
    },
    hipHeightM: 0.897,
    hands: { R: 'point' },
  },

  // Indicando um ponto no chão à frente: palma para baixo (resolvida junto com
  // a posição — `elbow.R.y ≈ 0`), tronco inclinado e cabeça olhando o ponto.
  pointDown: {
    pose: {
      'hip.L': { x: -10, z: 3 },
      'hip.R': { x: -10, z: -3 },
      'knee.L': { x: 10 },
      'knee.R': { x: 10 },
      spine: { x: 20 },
      chest: { x: 10 },
      neck: { x: 30 },
      head: { x: 10 },
      'shoulder.L': { x: 0, z: 5 },
      'elbow.L': { x: -8 },
      'shoulder.R': { x: -64, y: 12, z: 5 },
      'elbow.R': { x: -32, y: -3 },
    },
    hipHeightM: 0.89,
    hands: { R: 'point' },
  },

  // "Olha lá!": o corpo inteiro no gesto — tronco girado, braço estendido para
  // cima e para a frente cruzando a linha média, braço oposto em contrapeso e
  // o peso na perna da frente. As pernas foram resolvidas para plantar os dois
  // pés (a versão anterior deixava o pé de trás 6 cm no ar).
  pointFar: {
    pose: {
      spine: { x: -5, y: 25 },
      chest: { y: 15 },
      neck: { y: -22 },
      head: { x: -5 },
      'hip.L': { x: -13, z: 6 },
      'knee.L': { x: 15 },
      'ankle.L': { x: 5 },
      'hip.R': { x: 16, z: -8 },
      'ankle.R': { x: 5 },
      'shoulder.L': { x: 35, z: 25 },
      'elbow.L': { x: -25 },
      'shoulder.R': { x: -104, y: 3, z: -19 },
      'elbow.R': { x: -14 },
    },
    hipHeightM: 0.896,
    hands: { R: 'point' },
  },

  // Apontando para OUTRO boneco: mão na altura do rosto dele e palma para
  // baixo (o gesto de ordem/acusação). Encaixa com qualquer pose em pé a
  // ~0,70 m de distância entre os quadris — a ponta dos dedos chega a 0,71 m
  // do peito, na altura de 1,52 m.
  pointAtOther: {
    pose: {
      spine: { x: 5, y: 12 },
      chest: { y: 8 },
      neck: { y: -10 },
      'hip.L': { x: -13, z: 6 },
      'knee.L': { x: 15 },
      'ankle.L': { x: 5 },
      'hip.R': { x: 16, z: -8 },
      'ankle.R': { x: 5 },
      'shoulder.L': { x: 5, z: 8 },
      'elbow.L': { x: -20 },
      'shoulder.R': { x: -77, y: 82, z: -35 },
      'elbow.R': { x: 0, y: -80 },
    },
    hipHeightM: 0.896,
    hands: { R: 'point' },
  },

  // Apresentando ("por aqui"): mesmo braço estendido, porém com a PALMA PARA
  // CIMA (`elbow.R.y = -167`, resolvido junto com a posição — erro de 2 mm no
  // alvo), tronco levemente curvado e cabeça na direção da mão.
  presenting: {
    pose: {
      'hip.L': { z: 3 },
      'hip.R': { z: -3 },
      spine: { x: 8, y: -8 },
      chest: { x: 5 },
      neck: { x: 12, y: -10 },
      head: { x: 5 },
      'shoulder.L': { x: 0, z: 5 },
      'elbow.L': { x: -8 },
      'shoulder.R': { x: -54, y: -20, z: 2 },
      'elbow.R': { x: -46, y: -167 },
    },
    hipHeightM: 0.897,
  },

  // "Quem, eu?": mão espalmada no próprio peito, palma virada para o corpo
  // (alvo resolvido com 1 mm de erro; a palma aponta exatamente para -Z).
  pointSelf: {
    pose: {
      'hip.L': { z: 3 },
      'hip.R': { z: -3 },
      neck: { x: -8 },
      head: { x: -5 },
      'shoulder.L': { x: 0, z: 5 },
      'elbow.L': { x: -8 },
      'shoulder.R': { x: -38, y: 59, z: 8 },
      'elbow.R': { x: -128, y: -131 },
    },
  },

  // "Ele está ali atrás": apontar por cima do ombro sem virar o corpo. O
  // polegar aponta exatamente para trás (medido: direção (0,0,-1) com erro de
  // 3°). A mão esquerda também sai em joinha — aqui a pose de mão é declarada
  // com uma chave só, que vale para os dois lados.
  thumbBack: {
    pose: {
      'hip.L': { z: 3 },
      'hip.R': { z: -3 },
      spine: { y: -8 },
      neck: { y: -30 },
      head: { y: -15 },
      'shoulder.L': { x: 0, z: 5 },
      'elbow.L': { x: -8 },
      'shoulder.R': { x: -73, y: -29, z: -33 },
      'elbow.R': { x: -150, y: -147 },
    },
    hands: 'thumbsUp',
  },

  // ---------------------------------------------------------------------
  // Apoios no chão (DECISOES.md #36). A altura do quadril de cada uma sai de
  // uma restrição de contato resolvida numericamente — pé chapado, joelho no
  // chão, mão no chão. A exceção são as poses em que quem apoia é o BLOCO do
  // tronco (de bruços, de lado): aí a altura vem da meia-espessura da pelve
  // (0,081 m em Z) ou da meia-largura do peito (0,148 m em X), porque a
  // restrição de "encostar a junta mais baixa" enterraria o corpo.
  // ---------------------------------------------------------------------

  // Cócoras profundas: quadril a 0,35 m (contra 0,90 em pé) com o pé SOB o
  // corpo — a primeira versão tinha o pé chapado, mas 46 cm à frente do
  // quadril, e na tela lia como "sentado no ar" em vez de agachado.
  //
  // O CALCANHAR FICA ERGUIDO (o tornozelo para 13 cm do chão), e não por
  // descuido: a dorsiflexão do tornozelo do modelo vai só a 20°, e com o pé
  // debaixo do corpo isso não basta para assentar o calcanhar — é exatamente
  // o que acontece com uma pessoa de tornozelo rígido, que agacha na ponta dos
  // pés. Ou o pé fica chapado longe do corpo, ou fica sob o corpo com o
  // calcanhar erguido; não há terceira opção dentro dos limites.
  squat: {
    pose: {
      ...symmetric({
        hip: { x: -80, z: 16 },
        knee: { x: 150 },
        ankle: { x: 10 },
        shoulder: { x: -75, z: 8 },
        elbow: { x: -30 },
      }),
      spine: { x: 25 },
      chest: { x: 12 },
      neck: { x: -15 },
    },
    hipHeightM: 0.35,
    hands: 'relaxed',
  },

  // Ajoelhado num joelho só (o direito no chão, o peito do pé apoiado atrás) e
  // o pé esquerdo chapado à frente — a posição de "pedido de casamento".
  kneelingOneKnee: {
    pose: {
      spine: { x: 3 },
      'hip.R': { x: -9 },
      'knee.R': { x: 100 },
      'ankle.R': { x: 45 },
      'hip.L': { x: -92 },
      'knee.L': { x: 88 },
      'ankle.L': { x: 0 },
      'shoulder.L': { x: -10, z: 6 },
      'elbow.L': { x: -20 },
      'shoulder.R': { x: -5, z: -6 },
      'elbow.R': { x: -15 },
    },
    hipHeightM: 0.459,
    hands: 'relaxed',
  },

  // Ajoelhado nos dois joelhos, tronco ereto e peito dos pés no chão.
  kneelingBoth: {
    pose: {
      ...symmetric({
        hip: { x: -26 },
        knee: { x: 116 },
        ankle: { x: 45 },
        shoulder: { x: 0, z: 6 },
        elbow: { x: -10 },
      }),
      spine: { x: 5 },
    },
    hipHeightM: 0.423,
    hands: 'relaxed',
  },

  // Sentado no chão de pernas cruzadas. **Aproximação assumida:** o quadril do
  // modelo abduz no máximo 45°, então o cruzamento fica menos fechado que o
  // real e a pelve para ~6 cm mais alta do que uma pessoa sentada de fato
  // (0,215 m). Os joelhos ficam a 0,14 m do chão e abertos 0,28 m da linha
  // média, que é o mais próximo que os limites permitem.
  crossLegged: {
    pose: {
      ...symmetric({
        hip: { x: -120, y: 40, z: 37 },
        knee: { x: 150 },
        ankle: { x: -20 },
        shoulder: { x: -25, z: 12 },
        elbow: { x: -60 },
      }),
      spine: { x: 5 },
      chest: { x: 3 },
    },
    hipHeightM: 0.215,
    hands: 'relaxed',
  },

  // De quatro: tronco na horizontal (`rotation.x = 90`), coxas verticais e
  // mãos sob os ombros. O cotovelo fica dobrado 67° porque o BRAÇO É MAIS
  // LONGO QUE A COXA (0,515 contra 0,415): com o tronco na altura que põe o
  // joelho no chão, um braço reto atravessaria o piso. O punho vai ao limite
  // de extensão (-60°) para a mão assentar em vez de espetar o chão.
  allFours: {
    pose: {
      ...symmetric({
        hip: { x: -90 },
        knee: { x: 97 },
        ankle: { x: 15 },
        shoulder: { x: -58 },
        elbow: { x: -67 },
        wrist: { x: -60 },
      }),
      neck: { x: -30 },
      head: { x: -10 },
    },
    rotation: { x: 90 },
    // 0,495 e não 0,49: os 5 mm a mais são o que tira a ponta dos dedos de
    // dentro do chão (o punho já vai ao limite de extensão).
    hipHeightM: 0.495,
  },

  // Flexão de braço na descida: corpo reto e inclinado (`rotation.x = 80`),
  // pontas dos pés atrás, mãos no chão sob os ombros e cotovelos dobrados —
  // resolvido exigindo punho no chão e ponta do pé no chão ao mesmo tempo.
  plank: {
    pose: {
      ...symmetric({
        shoulder: { x: -86, z: 8 },
        elbow: { x: -70 },
        ankle: { x: -10 },
        wrist: { x: -40 },
      }),
      neck: { x: -20 },
    },
    rotation: { x: 80 },
    // Igual ao "de quatro": a folga extra é o que mantém a mão inteira, e não
    // só o punho, acima do piso.
    hipHeightM: 0.31,
  },

  // De bruços, peito erguido nos cotovelos (a "esfinge"): coluna em extensão,
  // antebraços no chão à frente e cabeça levantada. A altura do quadril é a
  // meia-espessura da pelve, como na pose deitada de costas.
  pronePropped: {
    pose: {
      ...symmetric({
        hip: { x: 0 },
        ankle: { x: 10 },
        shoulder: { x: -82, z: 31 },
        elbow: { x: -49 },
      }),
      spine: { x: -25 },
      chest: { x: -18 },
      neck: { x: -35 },
      head: { x: -10 },
    },
    rotation: { x: 90 },
    hipHeightM: 0.11,
  },

  // Deitado de lado (sobre o lado direito): `rotation.z = 90` põe o corpo de
  // lado com o rosto para a frente. O braço de baixo fica esticado em linha
  // com o corpo, acima da cabeça — qualquer flexão nele o enterraria no chão,
  // já que ele está do lado que apoia. Altura = meia-largura do peito.
  sideLying: {
    pose: {
      'hip.L': { x: -40, z: 5 },
      'knee.L': { x: 60 },
      'ankle.L': { x: 10 },
      'hip.R': { x: -22, z: -5 },
      'knee.R': { x: 38 },
      'ankle.R': { x: 10 },
      spine: { x: 6 },
      chest: { x: 4 },
      neck: { x: 8 },
      head: { x: 4 },
      'shoulder.R': { x: 0, z: -180 },
      'elbow.R': { x: 0 },
      'shoulder.L': { x: -45, z: 25 },
      'elbow.L': { x: -85 },
    },
    rotation: { z: 90 },
    // Meia-largura da cintura escapular (o ombro é o ponto mais largo do
    // corpo deitado: 0,195 m do eixo) mais a folga que mantém a mão do braço
    // de baixo — que fica justamente no lado apoiado — acima do piso.
    hipHeightM: 0.24,
    hands: 'relaxed',
  },

  // Alongamento à frente. **Limitação assumida e medida:** o boneco NÃO
  // alcança os próprios pés. O tronco dobra no máximo 70° (coluna 45 + peito
  // 25) e flexionar o quadril levanta a perna em vez de baixar o tronco —
  // com as mãos a 0,44 m do chão, elas chegam à altura da CANELA. Esta é a
  // dobra máxima possível, com o joelho cedendo para aproximar o alvo.
  touchToes: {
    pose: {
      ...symmetric({
        hip: { x: -73 },
        knee: { x: 101 },
        shoulder: { x: -70 },
        elbow: { x: -9 },
      }),
      spine: { x: 45 },
      chest: { x: 25 },
      neck: { x: -25 },
      head: { x: 10 },
    },
    hipHeightM: 0.605,
    hands: 'relaxed',
  },

  // Preso pela gravata: queixo erguido pelo braço que aperta, tronco arqueado
  // para trás e as duas mãos agarrando o antebraço do agressor, na frente do
  // próprio pescoço. Simétrica; o alvo do punho — (0,10; 1,40; 0,16), colado à
  // garganta — foi resolvido com erro de 0,4 mm.
  chokeTaking: {
    pose: {
      ...symmetric({
        hip: { x: -6, z: 8 },
        knee: { x: 12 },
        ankle: { x: 6 },
        shoulder: { x: -31, y: -20, z: -11 },
        elbow: { x: -123 },
      }),
      spine: { x: -12 },
      chest: { x: -8 },
      neck: { x: -25 },
      head: { x: -8 },
    },
    hipHeightM: 0.908,
    hands: 'relaxed',
  },

  // =====================================================================
  // 2ª ENTREGA DO CATÁLOGO (DECISOES.md #37): expressivas, ação e pares.
  // Todo ângulo abaixo saiu de busca numérica contra a cinemática direta —
  // alvo declarado em metros, custo medido na posição da junta no mundo.
  // =====================================================================

  // ---------------------------------------------------------------------
  // Expressivas — linguagem corporal, quase tudo do tronco para cima.
  // ---------------------------------------------------------------------

  // Braços cruzados na frente do peito. **Limitação medida:** as mãos param
  // perto da linha média (x ≈ ±0,05) em vez de agarrar o braço oposto, porque
  // a ADUÇÃO do ombro (levar o braço para o outro lado do corpo) vai só a 20°
  // no modelo — o resto do cruzamento tem de vir da rotação interna, que já
  // está no limite (`shoulder.R.y = 90`). Os antebraços se cruzam de fato à
  // frente do tronco (cotovelos a ±0,195, punhos passando da linha média),
  // que é o que a silhueta mostra; separados 8 cm em profundidade para um não
  // atravessar o outro.
  armsCrossed: {
    pose: {
      spine: { x: 3 },
      chest: { x: 3 },
      'shoulder.R': { x: -38, y: 90 },
      'elbow.R': { x: -93, y: -122 },
      'wrist.R': { x: -2 },
      'shoulder.L': { x: -26, y: -90, z: 20 },
      'elbow.L': { x: -75, y: 130 },
      'wrist.L': { x: 10 },
    },
    hands: 'relaxed',
  },

  // Mãos na cintura, cotovelos abertos para fora ("asas"). É a mesma solução
  // do braço esquerdo da pose "Modelo", agora resolvida de novo para os dois
  // lados: o punho cai a 1 mm do alvo (logo acima da crista do quadril) e o
  // cotovelo fica a 0,30 m da linha média.
  handsOnHips: {
    pose: {
      ...symmetric({ shoulder: { x: 45, y: -39, z: 30 }, elbow: { x: -87 } }),
      spine: { x: -3 },
    },
    hands: 'relaxed',
  },

  // Acenando com a mão direita, palma para a frente. Três coisas fazem o gesto
  // ler como aceno e não como "braço levantado": o cotovelo fica ABAIXO do
  // punho (antebraço subindo, resolvido com uma penalidade explícita — sem ela
  // a busca travava no braço reto), a palma aponta exatamente para +Z, e o
  // tronco/pescoço acompanham. Punho a 1 mm do alvo.
  waving: {
    pose: {
      spine: { y: 5 },
      neck: { y: -5 },
      'hip.L': { z: 3 },
      'hip.R': { z: -3 },
      'shoulder.L': { x: 0, z: 5 },
      'elbow.L': { x: -8 },
      'shoulder.R': { x: -78, y: 13, z: -87 },
      'elbow.R': { x: -98, y: -78 },
      'wrist.R': { x: -8 },
    },
  },

  // Comemorando: os dois braços erguidos em V, tronco arqueado e cabeça para
  // cima. O alvo do punho foi posto DENTRO do alcance (0,50 m do ombro): a
  // primeira tentativa pedia 0,71 m, mais que o braço inteiro (0,515), e o
  // solver só entregava o braço esticado batendo no limite.
  celebrating: {
    pose: {
      ...symmetric({ shoulder: { x: -147, z: 32 }, elbow: { x: -12 } }),
      spine: { x: -8 },
      chest: { x: -5 },
      neck: { x: -20 },
      head: { x: -8 },
    },
    hands: 'fist',
  },

  // Pensativo, mão no queixo: o antebraço direito fica VERTICAL (resolvido com
  // uma penalidade sobre o afastamento horizontal entre cotovelo e punho), com
  // a base dos dedos em 1,44 m — a altura do queixo. O braço esquerdo cruza o
  // corpo e a mão esquerda para 9 cm abaixo do cotovelo direito, sustentando-o:
  // o alvo do segundo braço é a posição MEDIDA do cotovelo já resolvido, não
  // um palpite.
  handOnChin: {
    pose: {
      spine: { x: 8 },
      chest: { x: 5 },
      neck: { x: 10 },
      head: { x: 5 },
      'shoulder.R': { x: -51, y: 28, z: 20 },
      'elbow.R': { x: -146 },
      'shoulder.L': { x: -22, y: -49, z: -20 },
      'elbow.L': { x: -71 },
    },
    hands: 'relaxed',
  },

  // Cabeça baixa, ombros caídos (abatimento). O afundamento dos ombros vem da
  // CLAVÍCULA, não do ombro: `clavicle.y` negativo no lado L leva a junta do
  // ombro 2,5 cm para a frente (medido — o eixo z da clavícula só levanta, não
  // baixa). A junta da cabeça desce de 1,55 para 1,39 m e avança 0,27 m.
  headDown: {
    pose: {
      ...symmetric({
        clavicle: { y: -12 },
        shoulder: { x: -12, z: -6 },
        elbow: { x: -18 },
        hip: { x: -6, z: 3 },
        knee: { x: 10 },
      }),
      spine: { x: 16 },
      chest: { x: 12 },
      upperChest: { x: 10 },
      neck: { x: 45 },
      head: { x: 12 },
    },
    hands: 'relaxed',
  },

  // Assustado: recuo para trás com as mãos abertas à frente do rosto, palmas
  // para fora (exatamente +Z, resolvido junto com a posição), ombros erguidos
  // pela clavícula e joelhos cedendo. A altura do quadril foi ajustada para
  // 0,885 depois que a versão anterior enterrava a ponta do pé 3 cm no chão —
  // pega pela penalidade de piso, não pelo olho.
  startled: {
    pose: {
      ...symmetric({
        hip: { x: -12, z: 5 },
        knee: { x: 22 },
        ankle: { x: -8 },
        clavicle: { z: 18 },
        shoulder: { x: -47, y: -59, z: 46 },
        elbow: { x: -35, y: 61 },
        wrist: { x: -59 },
      }),
      spine: { x: -12 },
      chest: { x: -8 },
      neck: { x: -30 },
      head: { x: -12 },
    },
    hipHeightM: 0.885,
  },

  // ---------------------------------------------------------------------
  // Dança pop (pedido do usuário: 3 poses e trechos de K-pop, revisto para 4
  // durante a conversa). As pernas em pé não mudam nada de chão; só o braço
  // (ou a clavícula) resolve cada gesto.
  // ---------------------------------------------------------------------

  // "Coração com os dedos": mão em 'pinch' (polegar e indicador encostados,
  // já existente no catálogo de mãos) erguida perto do rosto. Alvo resolvido:
  // punho a (0,12; 1,57; 0,13) — ao lado da bochecha, um pouco à frente —
  // com as MESMAS penalidades do #37/#61 (cotovelo abaixo do punho, perto da
  // linha média). Resultado: punho a 5,2 cm do alvo, cotovelo 5,4 cm abaixo
  // dele e a 16 cm da linha média — perto do corpo, não "de asa".
  kpopFingerHeart: {
    pose: {
      'shoulder.R': { x: -150, y: 68, z: 20 },
      'elbow.R': { x: -87 },
    },
    hands: { R: 'pinch' },
  },

  // Braços de robô/caixa: ombro na horizontal para o lado e cotovelo em
  // ângulo reto, antebraço na VERTICAL (o "cactus arms" da coreografia). Não
  // é um alvo de contato — é geometria resolvida contra dois pontos: o
  // cotovelo exatamente na altura do ombro (deslocado 0,27 m para o lado,
  // o comprimento do úmero) e o punho exatamente 0,245 m ACIMA do cotovelo
  // (comprimento do antebraço). Busca numérica fechou nos dois com custo
  // ZERO: `shoulder.R {x:-90, y:0, z:-90}` (abdução, não flexão — o eixo Z
  // do lado R abduz com sinal NEGATIVO, ver DECISOES.md #14), `elbow.R
  // {x:-90}`.
  kpopBoxArms: {
    pose: symmetric({ shoulder: { x: -90, z: 90 }, elbow: { x: -90 } }),
    hands: 'fist',
  },

  // "Apontar" com o quadril deslocado: reaproveita a base de apoio já
  // resolvida da pose "Modelo" (peso na perna esquerda, direita cruzada à
  // frente na ponta do pé) e o braço já resolvido de "Apontar para cima"
  // (`pointUp`), olhando na direção do gesto. Medido: punho a
  // (-0,106; 1,839; 0,127) — bem acima da cabeça — e a junta mais baixa a
  // 0,0127 m do chão (contra 0,0100 da pose neutra, 2,7 mm de folga extra —
  // a mesma "Modelo" já assenta assim, sem `hipHeightM` declarado).
  kpopPointDance: {
    pose: {
      'hip.L': { x: -3, z: 4 },
      'knee.L': { x: 3 },
      'hip.R': { x: -14, z: -20 },
      'knee.R': { x: 24 },
      'ankle.R': { x: 30 },
      'ball.R': { x: -20 },
      spine: { x: -5, z: -10 },
      chest: { z: 6 },
      neck: { x: -15, y: 15 },
      head: { x: -8, y: 10 },
      'clavicle.L': { z: 8 },
      'shoulder.L': { x: 50, y: -60, z: 40 },
      'elbow.L': { x: -90 },
      'wrist.L': { x: 10 },
      'shoulder.R': { x: -143, y: -85, z: 15 },
      'elbow.R': { x: 0, y: -10 },
    },
    hands: { L: 'relaxed', R: 'point' },
  },

  // Onda de ombro (isolamento): o levante vem da CLAVÍCULA direita, não do
  // braço — `clavicle.R.z` só sobe (nunca desce, ver o comentário de
  // `headDown`), então o máximo do catálogo (20°) mais uma inclinação de
  // tronco na mesma direção (`chest`/`spine.z` negativos) e a cabeça
  // compensando fecham a leitura de "ombro isolado". Medido: ombro direito
  // fica 12 cm mais alto que o esquerdo (1,396 contra 1,276 m), pernas
  // intocadas — chão idêntico ao neutro (0,0100 m).
  kpopShoulderWave: {
    pose: {
      'clavicle.R': { z: 20 },
      chest: { z: -10 },
      spine: { z: -8 },
      neck: { z: 8, y: 15 },
      head: { z: -6 },
      'shoulder.L': { x: 10, z: 8 },
      'shoulder.R': { x: -6, z: -14 },
    },
    hands: 'relaxed',
  },

  // ---------------------------------------------------------------------
  // Ação — poses com dinâmica, quase todas com uma restrição de contato
  // (pé plantado, pé no degrau, pé na bola) resolvida numericamente.
  // ---------------------------------------------------------------------

  // Salto: a única pose do catálogo SEM contato com o chão. `hipHeightM` de
  // 1,25 (0,35 acima do normal) põe a junta mais baixa a 0,56 m do piso — não
  // é "quase encostando", é claramente no ar. Pernas recolhidas e braços para
  // cima.
  jumping: {
    pose: {
      ...symmetric({
        hip: { x: -55, z: 8 },
        knee: { x: 95 },
        ankle: { x: 30 },
        shoulder: { x: -160, y: 10, z: 28 },
        elbow: { x: 0 },
      }),
      spine: { x: -6 },
      chest: { x: -4 },
      neck: { x: -12 },
    },
    hipHeightM: 1.25,
    hands: 'fist',
  },

  // Arremesso, no instante em que o braço está armado atrás: tronco girado
  // (`spine.y` negativo leva o ombro DIREITO para trás — o oposto do soco),
  // mão direita acima e atrás do ombro, mão esquerda apontada para o alvo, e
  // os dois pés plantados em passada (esquerdo à frente em z = +0,25, direito
  // atrás em z = -0,30), resolvidos junto com a altura do quadril.
  throwing: {
    pose: {
      spine: { x: -6, y: -25 },
      chest: { y: -15 },
      neck: { y: 30 },
      head: { y: 12 },
      'hip.L': { x: -21, y: -40 },
      'knee.L': { x: 9 },
      'hip.R': { x: 21, y: -40 },
      'knee.R': { x: 1 },
      'shoulder.R': { x: -139, y: -34 },
      'elbow.R': { x: -72 },
      'shoulder.L': { x: -88, y: 53 },
      'elbow.L': { x: -88 },
    },
    hipHeightM: 0.87,
    hands: 'fist',
  },

  // Chutando uma bola no chão: o alvo aqui é o `ball.R` (a junta da planta do
  // pé, não o tornozelo) na altura de uma bola apoiada no chão — resolvido em
  // (-0,08; 0,157; 0,593), 2 cm do alvo. A perna de apoio fica esticada e
  // plantada, o tronco reclina como contrapeso e os braços abrem para o
  // equilíbrio.
  kickingBall: {
    pose: {
      spine: { x: -14, y: 8 },
      chest: { x: -8 },
      neck: { x: 20 },
      head: { x: 8 },
      'hip.L': { x: 0, y: -37, z: -5 },
      'knee.L': { x: 1 },
      'hip.R': { x: -50, y: -1 },
      'knee.R': { x: 23 },
      'ankle.R': { x: 50, z: 4 },
      'shoulder.L': { x: 36, y: 61, z: 26 },
      'elbow.L': { x: -113 },
      'shoulder.R': { x: 2, y: -49, z: 3 },
      'elbow.R': { x: -105 },
    },
    hipHeightM: 0.895,
    hands: 'relaxed',
  },

  // Carregando uma caixa contra o corpo: os antebraços formam uma PRATELEIRA —
  // cotovelo e punho na mesma altura (1,087 contra 1,086 m, resolvido com uma
  // penalidade sobre a diferença) e as palmas exatamente para cima. Sem essa
  // penalidade o solver entregava o antebraço caindo para a frente, e a caixa
  // escorregaria. Tronco reclinado para trás como contrapeso.
  carryingBox: {
    pose: {
      ...symmetric({
        hip: { z: 4 },
        shoulder: { x: -12, y: 16, z: -8 },
        elbow: { x: -62, y: 165 },
      }),
      spine: { x: -10 },
      chest: { x: -6 },
      neck: { x: 10 },
    },
  },

  // Escalando: braço direito esticado no alto (punho a 1,80 m), braço esquerdo
  // dobrado numa agarra à altura do peito, joelho direito alto com o pé apoiado
  // em 0,52 m e a perna esquerda estendida com o pé no chão — as duas pernas
  // resolvidas juntas com a altura do quadril.
  climbing: {
    pose: {
      spine: { x: 4, y: -8 },
      chest: { x: 4 },
      neck: { x: -25 },
      head: { x: -8 },
      'hip.R': { x: -92, y: 11, z: 6 },
      'knee.R': { x: 117 },
      'hip.L': { x: -18 },
      'knee.L': { x: 18 },
      'shoulder.R': { x: -171, y: 38, z: 7 },
      'elbow.R': { x: 0 },
      'shoulder.L': { x: -76, y: 19, z: 9 },
      'elbow.L': { x: -107 },
    },
    hipHeightM: 0.88,
    hands: 'fist',
  },

  // Subindo um degrau: o pé direito pousa em cima (tornozelo a 0,290 m, ou
  // seja, sola em 0,22 m — a altura do degrau) e à frente, e o esquerdo fica
  // atrás empurrando na ponta (o calcanhar sai do chão, como quem sobe de
  // fato). O ombro/quadril direito precisaram de uma penalidade lateral: sem
  // ela o solver cruzava a perna direita para o lado esquerdo do corpo.
  stepUp: {
    pose: {
      spine: { x: 14 },
      chest: { x: 8 },
      neck: { x: -10 },
      'hip.R': { x: -67, y: -2, z: -5 },
      'knee.R': { x: 78 },
      'hip.L': { x: 26 },
      'shoulder.R': { x: -20, y: -10 },
      'elbow.R': { x: -87 },
      'shoulder.L': { x: 47, y: 12 },
      'elbow.L': { x: -64 },
    },
    hipHeightM: 0.86,
    hands: 'relaxed',
  },

  // Balé — as duas metades de uma pirueta (pedido do usuário). Os ângulos das
  // pernas e dos braços saíram de VARREDURA NUMÉRICA sobre a cinemática
  // direta, não de estimativa: ver `__tests__/posePresets.test.ts`, que trava
  // as duas medidas que definem a pose.
  //
  // Preparação: demi-plié com os pés virados para fora (en dehors) e os braços
  // na segunda posição. É o impulso de onde a pirueta sai — e é ela que dá ao
  // giro um começo e um fim, em vez de o boneco surgir já rodando.
  balletPreparation: {
    pose: {
      spine: { x: -4 },
      neck: { x: 4 },
      ...symmetric({
        hip: { x: -30, y: 30, z: 10 },
        knee: { x: 60 },
        ankle: { x: -28 },
        clavicle: { z: 10 },
        shoulder: { x: -8, y: -20, z: 68 },
        elbow: { x: -22 },
      }),
    },
    hipHeightM: 0.811,
    hands: 'relaxed',
  },

  // Pirueta (passé/retiré): gira sobre a perna ESQUERDA, esticada e na
  // meia-ponta, com a direita levantada — joelho aberto de lado (en dehors) e
  // o pé encostado no joelho de apoio. Braços em coroa à frente (primeira
  // posição). O leve giro de tronco e cabeça é o "spot" do bailarino.
  //
  // Assimétrica de propósito: é uma perna que apoia e outra que sobe, então
  // aqui as pernas são declaradas lado a lado, e só os braços passam pelo
  // `symmetric` (a clavícula é o caso onde errar o sinal do lado direito o
  // grampeia em zero e deixa os punhos tortos — foi o que aconteceu na
  // primeira medição).
  balletPirouette: {
    pose: {
      spine: { y: 4 },
      chest: { y: 3 },
      neck: { y: 4 },
      head: { y: 6 },
      ...symmetric({
        clavicle: { z: 6 },
        shoulder: { x: -13, y: -56, z: 30 },
        elbow: { x: -88 },
      }),
      'hip.L': { x: 0, y: 20, z: 0 },
      'knee.L': { x: 0 },
      'ankle.L': { x: 45 },
      'hip.R': { x: -72, y: -40, z: -45 },
      'knee.R': { x: 121 },
      'ankle.R': { x: 45 },
    },
    hipHeightM: 0.967,
    hands: 'relaxed',
  },

  // ---------------------------------------------------------------------
  // Poses em PAR (DECISOES.md #37). Mesmo método das poses de luta do #35: o
  // encontro é resolvido numericamente, e a DISTÂNCIA entre os dois bonecos
  // faz parte do resultado. Convenção do par "de frente": o segundo boneco
  // fica a D metros em Z, girado 180° — um ponto medido no primeiro cai, no
  // segundo, em (-x, y, D - z), exato (a rotação é aplicada NA junta root e o
  // deslocamento vertical fica fora dela). Nos pares que olham para o MESMO
  // lado (carregar nas costas) o mapeamento é só o deslocamento em Z.
  //
  // Três poses são usadas pelos DOIS bonecos (aperto de mão, abraço, clinche):
  // o encaixe delas foi verificado aplicando a própria pose espelhada.
  // ---------------------------------------------------------------------

  // Aperto de mão — a MESMA pose nos dois bonecos, de frente, a **0,755 m** um
  // do outro. A mão direita vai à linha média (x = -0,024) na altura de
  // 1,05 m, e a distância sai daí: o ponto de encontro é o meio do caminho, e
  // D = 2 × 0,377. Os dois punhos ficam a 4,8 cm um do outro — o vão que as
  // mãos ocupam ao se apertarem.
  //
  // A orientação da mão é o que faz a pose funcionar, e foi resolvida junto:
  // palma exatamente em +X (o lado que encontra a palma do outro, que chega
  // espelhada em -X) e dedos exatamente em +Z, isto é, a mão na vertical com o
  // polegar para cima.
  handshake: {
    pose: {
      spine: { x: 10, y: -6 },
      chest: { x: 6 },
      neck: { y: 8 },
      'hip.L': { x: -6, z: 4 },
      'knee.L': { x: 8 },
      'hip.R': { x: -6, z: -4 },
      'knee.R': { x: 8 },
      'shoulder.R': { x: -54, y: 25, z: 20 },
      'elbow.R': { x: -43, y: -95 },
      'wrist.R': { x: -24, z: 14 },
      'shoulder.L': { x: 8, y: 2, z: 1 },
      'elbow.L': { x: -47 },
    },
    hipHeightM: 0.895,
    hands: 'relaxed',
  },

  // Abraço — a MESMA pose nos dois bonecos, de frente, a **0,26 m** um do
  // outro. Braço direito por CIMA do ombro do outro e esquerdo por BAIXO, na
  // cintura: as duas mãos param em z = 0,351/0,353, e as costas do outro estão
  // em 0,350 — encostam.
  //
  // **Limitação medida, e é ela que fixa a distância:** os peitos NÃO se
  // encostam (ficam a 8 cm). A cabeça do modelo só gira, não se desloca, então
  // aproximar os troncos faz os dois crânios se atravessarem. Com o pescoço e
  // a cabeça inclinados no máximo (30°+15°, o que afasta cada rosto 7,3 cm da
  // linha média) e D = 0,26, a checagem de sobreposição dos dois elipsoides de
  // cabeça dá 1,24 (≥ 1 = livres); a 0,20 m dava 0,73, ou seja, atravessados.
  hug: {
    pose: {
      ...symmetric({ hip: { x: -4, z: 4 }, knee: { x: 6 } }),
      spine: { x: 5 },
      chest: { x: 4 },
      neck: { x: -5, y: 25, z: 30 },
      head: { y: 10, z: 15 },
      'shoulder.R': { x: -48, y: 13 },
      'elbow.R': { x: -100 },
      'shoulder.L': { x: -28, y: -13 },
      'elbow.L': { x: -73 },
    },
    hipHeightM: 0.895,
    hands: 'relaxed',
  },

  // Dança de salão, quem CONDUZ — par com "Dança (par)", de frente, a
  // **0,36 m**. Mão esquerda erguida ao lado (0,42; 1,45; 0,25) com a palma
  // exatamente em -X, para encontrar a palma do par que chega em +X; mão
  // direita nas costas dele, em z = 0,453 contra a superfície das costas em
  // 0,445.
  danceLead: {
    pose: {
      spine: { x: -4, y: -6 },
      chest: { y: -4 },
      neck: { y: 14 },
      head: { y: 6 },
      'hip.L': { x: -4, z: 4 },
      'knee.L': { x: 8 },
      'hip.R': { x: 6, z: -4 },
      'knee.R': { x: 4 },
      'shoulder.L': { x: -76, y: 27, z: 46 },
      'elbow.L': { x: -96, y: 128 },
      'wrist.L': { x: 21 },
      'shoulder.R': { x: -85, y: 32, z: 17 },
      'elbow.R': { x: 0 },
    },
    hipHeightM: 0.904,
    hands: 'relaxed',
  },

  // Dança de salão, quem é CONDUZIDO. Os alvos desta pose não foram escolhidos:
  // são as posições MEDIDAS em "Dança (condutor)", convertidas para este
  // referencial pela regra do par. As mãos dadas fecham com **3 mm** de erro
  // (0,422; 1,457; 0,247 contra 0,421; 1,454; 0,249) e a mão esquerda pousa no
  // ombro direito do condutor.
  danceFollow: {
    pose: {
      spine: { x: -6, y: 6 },
      chest: { y: 4 },
      neck: { y: -14 },
      head: { y: -6 },
      'hip.L': { x: 6, z: 4 },
      'knee.L': { x: 4 },
      'hip.R': { x: -4, z: -4 },
      'knee.R': { x: 8 },
      'shoulder.R': { x: -105, y: -42, z: -53 },
      'elbow.R': { x: -115, y: -142 },
      'wrist.R': { x: 26 },
      'shoulder.L': { x: -56, y: -19, z: 1 },
      'elbow.L': { x: -72 },
    },
    hipHeightM: 0.904,
    hands: 'relaxed',
  },

  // Carregando nas costas (cavalinho), quem CARREGA — par com "Carregado nas
  // costas", os dois olhando para o MESMO lado, com quem é carregado **0,16 m
  // atrás**. Tronco inclinado 22°, joelhos cedendo (quadril a 0,855) e os
  // braços para trás e para fora, mãos em (±0,26; 0,948; 0,158) — logo abaixo
  // da coxa de quem é carregado, a 7,3 cm do eixo dela (a coxa tem ~6 cm de
  // raio: as mãos ficam encostadas nela).
  carryingPiggyback: {
    pose: {
      ...symmetric({
        hip: { x: -30, z: 5 },
        knee: { x: 34 },
        ankle: { x: 6 },
        shoulder: { x: 3, y: 6, z: 10 },
        elbow: { x: -99 },
      }),
      spine: { x: 22 },
      chest: { x: 12 },
      neck: { x: -25 },
      head: { x: -8 },
    },
    hipHeightM: 0.855,
    hands: 'relaxed',
  },

  // Sendo carregado nas costas. `hipHeightM` de 1,05 é o que põe este boneco
  // montado no outro, e não no chão. Pernas dobradas em volta da cintura de
  // quem carrega (joelhos à frente dele, em z = +0,22 no mundo) e mãos por
  // cima dos ombros dele, pousadas no peito (z = 0,197, contra a superfície do
  // peito em ~0,19).
  carriedPiggyback: {
    pose: {
      ...symmetric({
        hip: { x: -83, y: -2, z: 23 },
        knee: { x: 89 },
        shoulder: { x: -27, y: -21, z: 10 },
        elbow: { x: -77 },
      }),
      spine: { x: 8 },
      chest: { x: 4 },
      neck: { x: -20 },
      head: { x: -6 },
    },
    hipHeightM: 1.05,
    hands: 'relaxed',
  },

  // Carregando no colo, quem CARREGA — par com "Carregado no colo". Os dois
  // antebraços viram uma maca: punhos em (0,364; 1,052; 0,260) e
  // (-0,303; 1,024; 0,305), com as duas palmas exatamente para cima
  // (resolvidas junto com a posição). Tronco reclinado 14° como contrapeso.
  carryingCradle: {
    pose: {
      ...symmetric({ hip: { x: 4, z: 4 }, knee: { x: 10 } }),
      spine: { x: -14 },
      chest: { x: -8 },
      neck: { x: 12 },
      'shoulder.L': { x: -8, y: 82, z: -16 },
      'elbow.L': { x: -50, y: 129 },
      'wrist.L': { x: 23 },
      'shoulder.R': { x: -18, y: -85, z: 9 },
      'elbow.R': { x: -28, y: -115 },
      'wrist.R': { x: 34 },
    },
    hipHeightM: 0.906,
  },

  // Sendo carregado no colo: deitado de costas e ATRAVESSADO, com o eixo do
  // corpo ao longo de X. A rotação `(-90, 0, -90)` não foi adivinhada — saiu
  // de montar a base ortonormal desejada (o +Y do corpo indo para o +X do
  // mundo, o +Z do corpo para o +Y) e extrair o Euler XYZ correspondente;
  // conferida medindo a cabeça em +0,61 e o tornozelo em -0,71.
  //
  // O encaixe com quem carrega é a altura: o eixo do corpo fica em **1,03 m**,
  // entre as duas palmas dele (1,052 e 1,024). Em X também bate — o peito cai
  // em +0,41 (sobre a mão esquerda, em +0,364) e o joelho em -0,32 (sobre a
  // direita, em -0,303).
  carriedCradle: {
    pose: {
      // Joelho POUCO erguido e canela pendendo: com o corpo deitado, flexionar
      // o quadril leva o joelho para cima (o +Z do corpo virou o +Y do mundo),
      // e os 40° da primeira versão deixavam as duas pernas apontando para o
      // alto, como um abdominal. Com 15° o joelho sobe 0,11 m acima do eixo do
      // corpo e o tornozelo desce 0,16 m — a perna pende, como de quem é
      // carregado (visto no navegador, não deduzido).
      ...symmetric({
        hip: { x: -15, z: 6 },
        knee: { x: 55 },
        ankle: { x: 15 },
        shoulder: { x: -30, z: 6 },
        elbow: { x: -105 },
      }),
      spine: { x: 10 },
      chest: { x: 6 },
      neck: { x: 20 },
      head: { x: 8 },
    },
    rotation: { x: -90, z: -90 },
    hipHeightM: 1.03,
    hands: 'relaxed',
  },

  // Puxando alguém para levantar — par com "Sendo ajudado a levantar", de
  // frente, a **0,69 m**. Peso jogado para trás (perna direita esticada atrás,
  // calcanhar erguido), braço direito estendido para baixo e à frente com a
  // mão em (-0,075; 1,046; 0,344), e o braço esquerdo aberto para trás como
  // contrapeso.
  pullingUp: {
    pose: {
      spine: { x: -10, y: -8 },
      chest: { x: -6 },
      neck: { x: 16 },
      head: { x: 6 },
      'hip.L': { x: -18, z: 6 },
      'knee.L': { x: 26 },
      'ankle.L': { x: 4 },
      'hip.R': { x: 20, z: -8 },
      'knee.R': { x: 12 },
      'ankle.R': { x: 38 },
      'shoulder.R': { x: -39, y: -1, z: 19 },
      'elbow.R': { x: 0 },
      'shoulder.L': { x: 88, y: 27, z: 1 },
      'elbow.L': { x: -88 },
    },
    hipHeightM: 0.889,
    hands: 'relaxed',
  },

  // Sendo ajudado a levantar: meio-ajoelhado no chão (quadril a 0,415 —
  // resolvido pela restrição de contato, não escolhido), tronco projetado para
  // a frente e braço direito esticado para cima. A mão encontra a de quem puxa
  // a **2 cm** de distância: (-0,057; 1,037; 0,344) contra
  // (-0,075; 1,046; 0,344).
  //
  // A ORDEM importou aqui: na primeira tentativa o braço foi resolvido antes
  // de assentar o quadril, e ao baixar o boneco para o chão a mão desceu junto
  // — 49 cm fora do alvo. A altura tem de ser fixada ANTES de resolver o
  // alcance.
  beingPulledUp: {
    pose: {
      spine: { x: 26, y: 8 },
      chest: { x: 16 },
      neck: { x: -30 },
      head: { x: -10 },
      'hip.R': { x: -14 },
      'knee.R': { x: 120 },
      'ankle.R': { x: 45 },
      'hip.L': { x: -95 },
      'knee.L': { x: 85 },
      'ankle.L': { x: 0 },
      'shoulder.R': { x: -164, y: 76 },
      'elbow.R': { x: -82 },
      'shoulder.L': { x: -60, y: 12, z: 7 },
      'elbow.L': { x: 0 },
    },
    hipHeightM: 0.415,
    hands: 'relaxed',
  },

  // Empurrando — par com "Sendo empurrado", de frente, a **0,467 m**. Os dois
  // braços estendidos à frente com as palmas para +Z (resolvidas junto com a
  // posição) e as mãos em z = 0,482; o corpo joga o peso na perna da frente,
  // com a de trás esticada e o calcanhar erguido.
  pushGiving: {
    pose: {
      spine: { x: 12 },
      chest: { x: 8 },
      neck: { x: -18 },
      'hip.L': { x: -26, z: 6 },
      'knee.L': { x: 30 },
      'ankle.L': { x: 4 },
      'hip.R': { x: 18, z: -8 },
      'knee.R': { x: 10 },
      'ankle.R': { x: 40 },
      'shoulder.L': { x: -67, y: -13, z: 4 },
      'elbow.L': { x: -65, y: 0 },
      'wrist.L': { x: -60 },
      'shoulder.R': { x: -66, y: 12, z: -3 },
      'elbow.R': { x: -66, y: 0 },
      'wrist.R': { x: -60 },
    },
    hipHeightM: 0.891,
  },

  // Sendo empurrado: tronco arqueado para trás, braços abertos e um pé saindo
  // do chão (tornozelo direito a 0,146, contra 0,07 apoiado). A distância do
  // par saiu da geometria, não de um palpite: a superfície do peito deste
  // boneco cai exatamente em z = 0,482, a mesma altura em que estão as mãos de
  // quem empurra.
  pushTaking: {
    pose: {
      ...symmetric({ shoulder: { x: -40, z: 70 }, elbow: { x: -30 } }),
      spine: { x: -26 },
      chest: { x: -16 },
      neck: { x: -30 },
      head: { x: -14 },
      'hip.L': { x: -34, z: 8 },
      'knee.L': { x: 40 },
      'ankle.L': { x: -14 },
      'hip.R': { x: 22, z: -10 },
      'knee.R': { x: 26 },
      'ankle.R': { x: 45 },
    },
    hipHeightM: 0.797,
  },

  // Clinche — a MESMA pose nos dois bonecos, de frente, a **0,40 m**. As duas
  // mãos passam por trás da cabeça do outro (punhos em z = 0,399/0,380, contra
  // a nuca dele em ~0,387) e as cabeças ficam a 0,196 m, ou seja, encostadas —
  // cada crânio tem 0,089 m de meia-profundidade.
  //
  // O que decide se a pose LÊ como clinche não é a posição da mão e sim a do
  // COTOVELO: na primeira versão os punhos batiam o alvo mas os cotovelos
  // ficavam altos e abertos, e no navegador os dois bonecos pareciam estar de
  // braços erguidos. Re-resolvido com duas penalidades explícitas — cotovelo
  // pelo menos 18 cm ABAIXO do punho e a no máximo 0,26 m da linha média —, o
  // cotovelo caiu para 1,22 m (contra o punho em 1,44) e para 0,10 m da linha
  // média: fechado, como quem puxa a cabeça do outro para baixo.
  clinch: {
    pose: {
      ...symmetric({ hip: { x: -14, z: 8 }, knee: { x: 20 }, ankle: { x: 6 } }),
      spine: { x: 14 },
      chest: { x: 10 },
      neck: { x: -20, y: 20 },
      head: { y: 10 },
      'shoulder.R': { x: -91, y: 6, z: 20 },
      'elbow.R': { x: -89, y: -130 },
      'wrist.R': { x: -19 },
      'shoulder.L': { x: -82, y: -9, z: -19 },
      'elbow.L': { x: -98, y: 131 },
      'wrist.L': { x: -33 },
    },
    hipHeightM: 0.895,
    hands: 'relaxed',
  },

  // =====================================================================
  // 3ª ENTREGA (DECISOES.md #38): meditação, as duas poses de postura
  // (empresário e herói), o "deitado em X" nas duas faces, as duas sentadas
  // escoradas nas mãos e o mata-leão com o adversário sentado.
  // =====================================================================

  // Meditação: as mesmas pernas cruzadas de "Pernas cruzadas" (com a mesma
  // limitação de abertura do quadril), mas com a coluna ereta e as mãos
  // POUSADAS nos joelhos, palma para cima. O alvo de cada mão não foi
  // escolhido: é a posição MEDIDA do joelho depois de montar as pernas, com
  // 6 cm a mais em Y para a mão ficar por cima e não dentro dele — o punho
  // chega a 2,6 cm dali e a palma aponta exatamente para +Y.
  meditating: {
    pose: {
      ...symmetric({
        hip: { x: -120, y: 40, z: 37 },
        knee: { x: 150 },
        ankle: { x: -20 },
        shoulder: { x: -23, y: 90, z: -20 },
        elbow: { x: -18, y: 106 },
        wrist: { x: 40 },
      }),
      spine: { x: -3 },
      chest: { x: -2 },
      neck: { x: -2 },
    },
    hipHeightM: 0.215,
  },

  // "Empresário de sucesso": braços cruzados, mas com POSTURA — é isso que a
  // separa de "Braços cruzados", que é o mesmo gesto em pé neutro. O peito
  // sobe (coluna e tórax em extensão) e os ombros vão para TRÁS pela
  // clavícula: `clavicle.y` positivo no lado L recua a junta do ombro 2,5 cm
  // (medido — o eixo z da clavícula só levanta, não recua). Pernas afastadas:
  // os tornozelos ficam a 0,53 m um do outro.
  //
  // Efeito colateral medido: ombro para trás ENCURTA o alcance cruzado, então
  // as mãos param ainda mais perto da linha média que em "Braços cruzados"
  // (x ≈ 0,01 contra 0,05). O cruzamento dos antebraços — cotovelos a ∓0,24 e
  // punhos passando o centro — continua sendo o que a silhueta mostra.
  businessman: {
    pose: {
      ...symmetric({ clavicle: { y: 8, z: 6 }, hip: { z: 12 } }),
      spine: { x: -6 },
      chest: { x: -8 },
      upperChest: { x: -6 },
      neck: { x: -6 },
      head: { x: -3 },
      'shoulder.R': { x: -42, y: 89, z: 10 },
      'elbow.R': { x: -94, y: -142 },
      'wrist.R': { x: 7 },
      'shoulder.L': { x: -35, y: -90 },
      'elbow.L': { x: -76, y: 143 },
      'wrist.L': { x: 21 },
    },
    hipHeightM: 0.875,
    hands: 'relaxed',
  },

  // Pose de herói: mãos na cintura, peito estufado e pernas bem abertas — os
  // tornozelos ficam a 0,69 m um do outro (contra 0,18 em pé). O `ankle.z`
  // compensa a abertura do quadril para a sola continuar chapada no chão, e a
  // altura do quadril desce para 0,854 pelo mesmo motivo: perna aberta
  // encurta o alcance vertical.
  heroStance: {
    pose: {
      ...symmetric({
        clavicle: { y: 12, z: 10 },
        hip: { z: 18 },
        ankle: { z: -14 },
        shoulder: { x: 70, y: -53, z: 43 },
        elbow: { x: -86 },
      }),
      spine: { x: -10 },
      chest: { x: -12 },
      upperChest: { x: -8 },
      neck: { x: -8 },
      head: { x: -4 },
    },
    hipHeightM: 0.854,
    hands: 'relaxed',
  },

  // Deitado em X, de COSTAS: braços para o LADO e pernas abertas, rosto para
  // cima. A altura é a mesma das outras poses deitadas (meia-espessura da
  // pelve). Totalmente simétrica — a cabeça não precisa virar, porque o rosto
  // fica voltado para o teto (medido em y = 0,200).
  //
  // Com o boneco deitado, o corpo inteiro fica no plano do chão: o +Y local
  // (subir a coluna) vira -Z de costas e +Z de bruços, e o +X local continua
  // +X. Ou seja, `shoulder.z` gira o braço DENTRO do chão, sem mudar de altura
  // (medido: o punho fica em y = 0,136 para qualquer valor), e a escala é
  // **0 = braço na direção dos pés, 90 = para o lado, 180 = na direção da
  // cabeça**. Os 52° originais deixavam os dois braços apontando para os PÉS,
  // que é o que o usuário reportou; 90 põe o punho exatamente na linha do
  // ombro (dz = 0,000) e a 0,71 m da linha média.
  lyingSpreadSupine: {
    pose: symmetric({
      shoulder: { z: 90 },
      elbow: { x: -6 },
      hip: { z: 28 },
      knee: { x: 4 },
      ankle: { x: 20 },
    }),
    rotation: { x: -90 },
    hipHeightM: 0.11,
    hands: 'relaxed',
  },

  // Deitado em X, de BRUÇOS: braços para o ALTO (acima da cabeça) e pernas
  // abertas. Pela escala descrita acima, 145° leva o punho 0,42 m na direção
  // da cabeça mantendo 0,30 m de abertura lateral — braço erguido e ainda
  // aberto, que é o que sustenta o "X". Em 180° os dois braços ficariam
  // colados ao eixo do corpo e a pose viraria uma flecha.
  //
  // A cabeça TEM de virar, e não é enfeite: com o corpo de barriga para baixo,
  // o ponto do rosto (nariz/olhos) cai 9,5 cm ABAIXO da junta da cabeça — de
  // cara reta ele atravessaria o piso. Virando o pescoço 55° e a cabeça mais
  // 25°, o rosto sobe para y = 0,125, acima do chão. É a única assimetria.
  lyingSpreadProne: {
    pose: {
      ...symmetric({
        shoulder: { z: 145 },
        elbow: { x: -6 },
        hip: { z: 28 },
        knee: { x: 4 },
        ankle: { x: -10 },
      }),
      neck: { x: -10, y: 55 },
      head: { y: 25 },
    },
    rotation: { x: 90 },
    hipHeightM: 0.11,
    hands: 'relaxed',
  },

  // Sentado no chão com as pernas esticadas à frente, escorado nas mãos atrás.
  // A altura do quadril (0,095) é a do CENTRO ARTICULAR do quadril de quem
  // senta — meia coxa acima do chão —, não a meia-espessura da pelve: quem
  // apoia aqui é o glúteo, e com esse valor a perna inteira fica deitada na
  // horizontal (joelho e tornozelo os dois em y = 0,095).
  //
  // As mãos foram resolvidas contra DUAS alturas ao mesmo tempo, punho em 0,09
  // e ponta dos dedos em 0,04: só a do punho deixava a mão espetada no chão em
  // vez de espalmada. Os pés apontam para cima sozinhos — é a orientação
  // natural do pé com a perna deitada, não um ângulo declarado.
  sittingLegsForward: {
    pose: {
      ...symmetric({
        hip: { x: -90, z: 7 },
        knee: { x: 0 },
        ankle: { x: 20 },
        shoulder: { x: 80, y: 10, z: 1 },
        elbow: { x: -68, y: 65 },
        wrist: { x: -40, z: 30 },
      }),
      spine: { x: -16 },
      chest: { x: -10 },
      neck: { x: 6 },
    },
    hipHeightM: 0.095,
  },

  // Sentado no chão com os joelhos dobrados, escorado nas mãos atrás.
  //
  // **A pelve é RECLINADA 25° (`rotation.x`), e é isso que torna a pose
  // possível.** O quadril flexiona no máximo 120° em relação à pelve; com a
  // pelve reta o joelho mal sobe e o pé para a 0,70 m à frente — uma sentada
  // preguiçosa, não "joelhos dobrados". Reclinando a pelve sobram 145°
  // efetivos: o joelho sobe para 0,46 m e o pé vem para 0,36 m à frente, com
  // a sola chapada (tornozelo em 0,066 e ponta em 0,005 — as duas alturas
  // exigidas juntas, que é o que "sola no chão" significa). A reclinação é
  // também, literalmente, o "tronco levemente para trás" da pose.
  //
  // Diferente da pose de pernas esticadas, esta IMPÕE a direção que o boneco
  // encara (toda pose que inclina o boneco impõe), e o `hip.x` fica cravado no
  // limite de -120.
  sittingKneesBent: {
    pose: {
      ...symmetric({
        hip: { x: -120, y: -9, z: 3 },
        knee: { x: 127 },
        ankle: { x: 19 },
        shoulder: { x: 68, y: -2, z: 10 },
        elbow: { x: -80, y: 78 },
        wrist: { x: -30, z: 1 },
      }),
      spine: { x: 4 },
      chest: { x: 2 },
      neck: { x: 14 },
      head: { x: 4 },
    },
    rotation: { x: -25 },
    hipHeightM: 0.118,
  },

  // Mata-leão, quem APLICA: ajoelhado atrás de um adversário SENTADO (escolha
  // do usuário), a **0,45 m** dele e olhando para o mesmo lado. Antebraço
  // direito cruzando a garganta e mão esquerda fechando a chave sobre o
  // próprio antebraço direito — a 7 mm do eixo dele, que é uma pegada de fato.
  //
  // A distância e a inclinação saíram juntas de uma varredura, porque as duas
  // brigam: inclinar mais alcança melhor a garganta, mas enfia o peito na
  // cabeça do adversário. Em 12°/8° de inclinação com D = 0,45, a frente do
  // peito para em z = -0,296 contra a nuca dele em -0,286 — encostado, que é
  // exatamente onde a cabeça de quem é estrangulado descansa. Com 30° de
  // inclinação a mesma distância dava 6 cm de interpenetração.
  rearChokeKneeling: {
    pose: {
      ...symmetric({ hip: { x: -26 }, knee: { x: 116 }, ankle: { x: 45 } }),
      spine: { x: 12 },
      chest: { x: 8 },
      neck: { x: 10 },
      head: { x: 6 },
      'shoulder.R': { x: -63, y: 49, z: 20 },
      'elbow.R': { x: -68 },
      'shoulder.L': { x: -46, y: -73 },
      'elbow.L': { x: -87 },
    },
    hipHeightM: 0.423,
    hands: 'fist',
  },

  // Mata-leão, quem RECEBE: sentado no chão de pernas esticadas (a mesma base
  // de "Sentado, pernas esticadas"), puxado para trás pelo golpe — coluna em
  // extensão, queixo erguido — e com as duas mãos agarrando o antebraço que
  // aperta, na frente do próprio pescoço.
  //
  // O alvo das mãos é a GARGANTA calculada no referencial do pescoço (junta do
  // pescoço + 8,5 cm na frente dele), e não somando 8,5 cm no Z do mundo: com
  // o tronco reclinado 36°, essas duas coisas diferem quase 4 cm.
  rearChokeSeated: {
    pose: {
      ...symmetric({
        hip: { x: -90, z: 7 },
        knee: { x: 0 },
        ankle: { x: 20 },
        shoulder: { x: -75, y: -39, z: -9 },
        elbow: { x: -145 },
      }),
      spine: { x: -22 },
      chest: { x: -14 },
      neck: { x: -30 },
      head: { x: -10 },
    },
    hipHeightM: 0.095,
    hands: 'relaxed',
  },

  // =====================================================================
  // Mata-leão DEITADO (DECISOES.md #40) — os dois de barriga para cima, quem
  // aplica embaixo com as pernas em volta do tronco de quem recebe.
  // =====================================================================

  // Quem APLICA: deitado de costas por baixo, pernas subindo em volta do
  // tronco do outro (joelhos ao lado das costelas dele, tornozelos cruzando
  // acima da barriga) e o antebraço direito na garganta, com a mão esquerda
  // fechando a chave sobre ele — a 1,9 cm do eixo do antebraço.
  //
  // `hip.x` fica cravado no limite de -120° nos dois lados: com o boneco de
  // costas, o +Z do corpo virou o +Y do mundo, então flexionar o quadril é
  // exatamente o movimento de SUBIR a perna para envolver o outro — e o
  // modelo não dá mais que isso.
  //
  // A cabeça é erguida (`neck.x` POSITIVO, 15°) e inclinada 28° para o lado.
  // Os dois valores são obrigatórios, por motivos diferentes: deitado de
  // costas, estender o pescoço (o negativo que a pose em pé usaria) empurra a
  // cabeça para BAIXO, contra o chão — a primeira tentativa enterrou o crânio
  // 9 mm; e a inclinação lateral é o que separa os dois rostos, já que a
  // cabeça do modelo só gira, nunca se desloca (mesmo recurso do abraço,
  // #37). Com quem recebe inclinado para o outro lado, os crânios ficam a
  // 0,207 m — acima dos 0,18 m que as duas meias-larguras somam.
  groundChokeGiving: {
    pose: {
      spine: { x: -6 },
      chest: { x: -4 },
      neck: { x: 15, z: 28 },
      head: { x: 6, z: 12 },
      'shoulder.R': { x: -83, y: 72, z: 20 },
      'elbow.R': { x: -95 },
      'shoulder.L': { x: -60, y: -82, z: 3 },
      'elbow.L': { x: -95 },
      'hip.L': { x: -120, y: 26, z: 23 },
      'knee.L': { x: 121 },
      'hip.R': { x: -120, y: -26, z: -23 },
      'knee.R': { x: 125 },
    },
    rotation: { x: -90 },
    hipHeightM: 0.11,
    hands: 'fist',
  },

  // Quem RECEBE: deitado de costas POR CIMA do outro. `hipHeightM` de 0,31 é
  // o que o empilha — 0,20 m acima de quem aplica, que é a soma das duas
  // meias-espessuras de peito (0,104 cada); os corpos ficam comprimidos 2,5 cm
  // um contra o outro, como num estrangulamento de verdade. No chão, o boneco
  // ainda precisa ser deslocado **0,10 m na direção dos próprios pés**, para
  // que a cabeça de quem aplica fique atrás da dele.
  //
  // As duas mãos agarram o antebraço que aperta (resolvidas contra a posição
  // MEDIDA dele, com 4 mm de erro) e o pescoço estende para trás.
  groundChokeTaking: {
    pose: {
      ...symmetric({ hip: { x: -18, z: 14 }, knee: { x: 42 }, ankle: { x: 10 } }),
      spine: { x: -10 },
      chest: { x: -6 },
      neck: { x: -20, z: -25 },
      head: { x: -6, z: -12 },
      'shoulder.L': { x: -123, y: -78, z: -20 },
      'elbow.L': { x: -125 },
      'shoulder.R': { x: -42, y: 60, z: -14 },
      'elbow.R': { x: -150 },
    },
    rotation: { x: -90 },
    hipHeightM: 0.31,
    hands: 'relaxed',
  },

  // =====================================================================
  // Chave de braço sentada (pedido do usuário, com descrição verbal do golpe,
  // não de referência visual): A agachado atrás de B, que está sentado no
  // chão com a perna direita esticada (o alvo do travamento). A prende o
  // braço DIREITO de B numa chave (o próprio braço direito de A por cima,
  // segurando o punho de B com a mão esquerda) e crava o joelho direito nas
  // costas dele. Duas poses (instante do EMPURRÃO e do PUXÃO final) porque o
  // golpe descrito é um vai-e-vem: empurra com o peso do corpo (B curva para
  // a frente) e depois puxa o braço rapidamente para trás (a coluna de B gira
  // para a esquerda e arqueia para trás, no limite da articulação).
  //
  // PERNAS de A (iguais nas duas poses — é o mesmo agarre parado, só o tronco
  // e o braço da chave se movem): esquerda dobrada por baixo (mesma base de
  // `rearChokeKneeling`), direita ativa. `hip.R`/`knee.R` foram varridos para
  // o joelho chegar à altura da coluna de B (0,1–4,2 cm de erro vertical
  // entre os dois instantes — a mesma perna parada não acerta os dois ao
  // milímetro, e é esperado: é o `hipHeightM` de B que muda entre os
  // instantes, não o joelho de A; a distância 3D total fica em ~9-10 cm por
  // causa do offset lateral fixo do quadril, mesma leitura do "chute" e da
  // "joelhada" acima). **Limitação assumida**: o encaixe perna-contra-perna do
  // travamento não foi resolvido numericamente (ficaria a mais de 0,5 m um
  // do outro com o joelho ativo nesta posição) — a perna que trava é a
  // mesma perna direita que sobe para golpear as costas, pressionando a base
  // da coxa presa de B, não o tornozelo. `hipHeightM` de A: 0,5212 (as duas
  // poses).
  //
  // BRAÇO que prende (`shoulder.R`/`elbow.R` de A, iguais nas duas poses):
  // posicionado por razão anatômica (gancho por cima do braço de B), não por
  // busca numérica — medido depois: fica a 11 cm do braço de B no empurrão,
  // a 38 cm no puxão (o braço de B sobe bastante durante o puxão e o gancho
  // de A fica frouxo; quem traciona de verdade é o punho, não este gancho).
  //
  // BRAÇO que segura o punho (`shoulder.L`/`elbow.L` de A): resolvido por
  // varredura numérica contra o punho DIREITO de B (com a chave já montada),
  // erro de 0,7 cm no empurrão e 8,9 cm no puxão.
  armLockPushGiving: {
    pose: {
      'hip.L': { x: -26 },
      'knee.L': { x: 116 },
      'ankle.L': { x: 45 },
      'hip.R': { x: -35 },
      'knee.R': { x: 116 },
      'ankle.R': { x: 20 },
      spine: { x: 45 },
      chest: { x: 25 },
      neck: { x: 15 },
      'shoulder.R': { x: -25, y: 40, z: -15 },
      'elbow.R': { x: -100 },
      'shoulder.L': { x: -61, y: -21, z: -20 },
      'elbow.L': { x: -35 },
    },
    hipHeightM: 0.5212,
    hands: 'fist',
  },

  armLockPullGiving: {
    pose: {
      'hip.L': { x: -26 },
      'knee.L': { x: 116 },
      'ankle.L': { x: 45 },
      'hip.R': { x: -35 },
      'knee.R': { x: 116 },
      'ankle.R': { x: 20 },
      spine: { x: 45 },
      chest: { x: 25 },
      neck: { x: 5 },
      head: { x: -10 },
      'shoulder.R': { x: -25, y: 40, z: -15 },
      'elbow.R': { x: -100 },
      'shoulder.L': { x: -54, y: -27, z: -20 },
      'elbow.L': { x: -25 },
    },
    hipHeightM: 0.5212,
    hands: 'fist',
  },

  // Quem RECEBE: sentado no chão com as duas pernas esticadas à frente (a
  // esquerda livre, a direita é o alvo do travamento de A) e a mão livre
  // (esquerda) na própria coxa — deliberadamente perto do corpo, não escorada
  // atrás no chão como em `sittingLegsForward`: com A a só 0,238 m atrás,
  // apoiar a mão para trás invadiria o espaço dele.
  //
  // Braço DIREITO na chave (`shoulder.R`/`elbow.R`, o alvo da varredura do
  // parceiro): no empurrão o punho fica encostado nas costas na altura da
  // coluna (3,7 cm de profundidade, 3,9 cm da linha média); no puxão sobe e
  // aprofunda (16,8 cm de profundidade, 18,5 cm da linha média, `shoulder.R.y`
  // no limite de 90° — literalmente "no limite da articulação").
  //
  // O tronco é o que diferencia as duas: empurrão curva para a frente
  // (`spine.x` positivo); puxão arqueia para trás E gira para a esquerda
  // (`spine.y` positivo — confirmado numericamente: gira o ombro DIREITO para
  // a frente, que é virar para a esquerda do próprio corpo).
  armLockPushTaking: {
    pose: {
      'hip.L': { x: -90, z: 7 },
      'knee.L': { x: 0 },
      'ankle.L': { x: 20 },
      'hip.R': { x: -90, z: -7 },
      'knee.R': { x: 0 },
      'ankle.R': { x: 20 },
      'shoulder.L': { x: 20, z: 8 },
      'elbow.L': { x: -100 },
      spine: { x: 30 },
      chest: { x: 15 },
      neck: { x: 20 },
      head: { x: 10 },
      'shoulder.R': { x: 70, y: 60 },
      'elbow.R': { x: -120 },
    },
    hipHeightM: 0.0536,
    hands: 'relaxed',
  },

  armLockPullTaking: {
    pose: {
      'hip.L': { x: -90, z: 7 },
      'knee.L': { x: 0 },
      'ankle.L': { x: 20 },
      'hip.R': { x: -90, z: -7 },
      'knee.R': { x: 0 },
      'ankle.R': { x: 20 },
      'shoulder.L': { x: 20, z: 8 },
      'elbow.L': { x: -100 },
      spine: { x: -28, y: 20 },
      chest: { x: -14, y: 10 },
      neck: { x: -15, y: -10 },
      head: { x: -5 },
      'shoulder.R': { x: 80, y: 90, z: 10 },
      'elbow.R': { x: -140 },
    },
    hipHeightM: 0.01,
    hands: 'relaxed',
  },
}

const POSABLE_JOINT_NAMES: readonly string[] = JOINT_NAMES.filter((name) => name !== ROOT_JOINT_NAME)

/**
 * Torção neutra do antebraço (pronação/supinação), aplicada por padrão a
 * `elbow.L.y`/`elbow.R.y` em todo preset que não declare esse eixo
 * explicitamente — não é zero: a mão é modelada alinhada aos eixos locais
 * do punho (palma em -Z local, ver `skeleton.ts` e DECISOES.md #25), e são
 * estes ±90° que a giram para a orientação de descanso real (palma na coxa;
 * na T-pose, palma para baixo e polegar para a frente — exato por
 * construção, verificado pela trava de regressão do plano da mão em
 * `posePresets.test.ts`). Espelho de sinal simples (`elbow.L.y=90`,
 * `elbow.R.y=-90` — mesmo padrão "mesmo valor, sinal oposto" dos outros
 * eixos Y/Z pareados, ver DECISOES.md #23). Como a faixa de `elbow.y` é
 * centrada nesse neutro ([0,180] no L, [-180,0] no R), sobra ±90° de
 * pronação/supinação para cada lado.
 */
export const NEUTRAL_ELBOW_TWIST: Partial<Record<string, number>> = { 'elbow.L': 90, 'elbow.R': -90 }

/** Monta a pose completa (todas as juntas, exceto o root) de um preset, grampeada pelos limites de cada junta. */
export function resolvePosePreset(key: PosePresetKey): Record<string, JointRotation> {
  const preset = POSE_PRESETS[key]
  const pose: Record<string, JointRotation> = {}

  for (const jointName of POSABLE_JOINT_NAMES) {
    const jointPreset = preset.pose[jointName] ?? {}
    const neutralTwist = NEUTRAL_ELBOW_TWIST[jointName]
    const withDefaults =
      neutralTwist !== undefined && jointPreset.y === undefined ? { ...jointPreset, y: neutralTwist } : jointPreset
    pose[jointName] = clampJointRotation(jointName, withDefaults)
  }

  // As juntas da mão vêm dos presets de mão (`handPresets.ts`), para que
  // "punho fechado" seja o MESMO gesto quer venha de uma pose de corpo, quer
  // do botão da mão — uma tabela de números só. Um preset de corpo pode
  // declarar uma junta da mão à mão; nesse caso ela vence (nenhum declara
  // hoje, mas a regra fica explícita em vez de depender da ordem).
  for (const side of SIDES) {
    const hand = presetHandFor(preset, side)
    if (!hand) continue
    for (const [jointName, rotation] of Object.entries(resolveHandPreset(hand, side))) {
      if (preset.pose[jointName]) continue
      pose[jointName] = rotation
    }
  }

  return pose
}

/**
 * Como o preset assenta o boneco no mundo: rotação do root e deslocamento
 * vertical a somar em `figure.position[1]` (negativo baixa). O deslocamento sai
 * da altura do quadril pedida pelo preset menos a altura em pé — o chamador
 * multiplica pela escala do boneco (`getHeightScale`), para que um boneco de
 * 1,50 m deite tão colado ao chão quanto um de 1,90 m.
 */
export function resolvePosePresetPlacement(key: PosePresetKey): PosePresetPlacement {
  const preset = POSE_PRESETS[key]
  const rotation = preset.rotation ?? {}

  return {
    rotation: { x: rotation.x ?? 0, y: rotation.y ?? 0, z: rotation.z ?? 0 },
    groundOffsetM: (preset.hipHeightM ?? STANDING_HIP_HEIGHT_M) - STANDING_HIP_HEIGHT_M,
    preservesHeading: preset.rotation === undefined,
  }
}

/** Pose de mão que um preset de corpo aplica ao lado indicado (ou `null`) — usado pelos testes de coerência. */
export function getPosePresetHands(key: PosePresetKey, side: Side): HandPresetKey | null {
  return presetHandFor(POSE_PRESETS[key], side)
}
