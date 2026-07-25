import { resolveHandPreset, type HandPresetKey } from './handPresets'
import { SIDES, negateAngle } from './poseMirror'
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

export const POSE_PRESET_KEYS: readonly PosePresetKey[] = [
  'standing',
  'tpose',
  'sitting',
  'walking',
  'running',
  'lyingHandsBehindHead',
  'fetal',
  'fighting',
  'superman',
  'model',
]

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
  /** Pose aplicada às DUAS mãos; ausente = mãos abertas (neutras). */
  hands?: HandPresetKey
}

/** Altura da junta do quadril na pose em pé — o "neutro" de `hipHeightM`. */
const STANDING_HIP_HEIGHT_M = getJoint(ROOT_JOINT_NAME).position[1]

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
      'shoulder.R': { x: -70, y: 70, z: -70 },
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
const NEUTRAL_ELBOW_TWIST: Partial<Record<string, number>> = { 'elbow.L': 90, 'elbow.R': -90 }

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
  if (preset.hands) {
    for (const side of SIDES) {
      for (const [jointName, rotation] of Object.entries(resolveHandPreset(preset.hands, side))) {
        if (preset.pose[jointName]) continue
        pose[jointName] = rotation
      }
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

/** Pose de mão que um preset de corpo aplica aos dois lados (ou `null`) — usado pelos testes de coerência. */
export function getPosePresetHands(key: PosePresetKey): HandPresetKey | null {
  return POSE_PRESETS[key].hands ?? null
}
