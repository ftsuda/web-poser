import { composePlacementRotation } from '../figure/posePairs'
import { getJointSide, mirrorRotation, swapPoseSides } from '../figure/poseMirror'
import { seatOnGround } from '../figure/poseGround'
import {
  STANDING_HIP_HEIGHT_M,
  resolvePosePreset,
  resolvePosePresetPlacement,
  type PosePresetKey,
} from '../figure/posePresets'
import { clampJointRotation, type JointRotation } from '../figure/skeleton'

/**
 * Trechos de animação predefinidos (PLANO.md > fase 10): sequências prontas de
 * keyframes — andar, pular, correr e cenas em dupla — que entram no FINAL da
 * linha do tempo atual, com durações já definidas (decidido com o usuário; ver
 * DECISOES.md #60).
 *
 * O mesmo princípio da biblioteca de poses vale aqui: cada passo é DECLARADO
 * como uma pose de fábrica mais desvios (`overrides`), e não como uma pose
 * completa digitada à mão — as poses-chave dos encontros (soco, chute,
 * mata-leão, cavalinho...) já foram resolvidas numericamente em
 * `posePresets.ts`/`posePairs.ts`, e reusá-las garante que o instante de
 * contato de cada golpe é EXATAMENTE o encaixe medido lá (mesmas distâncias de
 * `POSE_PAIRINGS`, travadas por teste).
 *
 * REFERENCIAL DO TRECHO: tudo é declarado com o boneco do papel A na origem,
 * olhando para +Z — a mesma convenção de `posePairs.ts`. Quem aplica o trecho
 * (`figuresStore.appendAnimationClip`) gira os deslocamentos e rotações pelo
 * heading atual do boneco A e soma a posição dele, então "andar para a frente"
 * é sempre a frente que o usuário deu ao boneco.
 *
 * ASSENTAMENTO: um passo pode pedir `seat: true` para calcular numericamente o
 * deslocamento vertical que encosta a pose no chão (`poseGround.ts`, #57) —
 * é o que os passos com pernas fora do preset usam, em vez de estimar alturas.
 * `liftM` acrescenta uma folga por cima (fases aéreas do salto e da corrida);
 * `hipHeightM` explícito vence tudo (poses no ar ou empilhadas no outro).
 *
 * A REFERÊNCIA INVERTIDA dos membros direito/esquerdo (DECISOES.md #14) é
 * tratada nos espelhos: `mirror: true` espelha a pose inteira pela regra
 * sagital exata de `poseMirror.ts` — juntas pareadas trocadas de lado com
 * `(x, -y, -z)`, juntas centrais com `(x, -y, -z)` no lugar — e é assim que a
 * passada oposta do andar/correr nasce da mesma tabela, sem redigitar sinais.
 */

export type AnimationClipKey =
  | 'walking'
  | 'running'
  | 'jumping'
  | 'kpopFingerHeart'
  | 'kpopBoxArms'
  | 'kpopPointDance'
  | 'kpopShoulderWave'
  | 'dance'
  | 'handshake'
  | 'shoulderSpin'
  | 'piggyback'
  | 'carryCradle'
  | 'clinch'
  | 'punch'
  | 'kick'
  | 'kneeStrike'
  | 'armLock'
  | 'rearChokeStanding'
  | 'rearChokeSeated'
  | 'rearChokeGround'

type PartialPose = Readonly<Record<string, Partial<JointRotation>>>

/** Um boneco em um passo do trecho, no referencial do trecho (A na origem olhando +Z). */
export interface ClipFigureSpec {
  /** Pose de fábrica que serve de base ao passo. */
  preset: PosePresetKey
  /** Posição [x, z] no chão, em metros na altura de referência. */
  at: readonly [number, number]
  /** Desvios por junta por cima da pose resolvida do preset (parciais, como nos presets). */
  overrides?: PartialPose
  /** Espelho sagital da pose resultante — a passada oposta do andar/correr. */
  mirror?: boolean
  /** Giro no chão (Y), em graus, composto com a rotação imposta pela pose. */
  turnDeg?: number
  /** Rotação imposta no lugar da do preset (eixos ausentes = 0) — as fases de tombar/rolar. */
  rotation?: Partial<JointRotation>
  /** Altura explícita do quadril (m, altura de referência). Vence `seat` e o preset. */
  hipHeightM?: number
  /** Assenta a pose no chão numericamente (`poseGround.ts`), em vez de usar a colocação do preset. */
  seat?: boolean
  /** Elevação extra acima do assentamento, em metros — fases aéreas. Só faz sentido com `seat`. */
  liftM?: number
}

export interface AnimationClipStep {
  /** Duração, em ms, da transição que CHEGA a este passo (mesma convenção dos keyframes). */
  durationMs: number
  a: ClipFigureSpec
  /** Presente em TODOS os passos dos trechos em dupla, em nenhum dos individuais. */
  b?: ClipFigureSpec
}

export interface AnimationClipDefinition {
  kind: 'solo' | 'duo'
  steps: readonly AnimationClipStep[]
}

/** Ordem de exibição no painel: individuais primeiro, depois as duplas. */
export const ANIMATION_CLIP_KEYS: readonly AnimationClipKey[] = [
  'walking',
  'running',
  'jumping',
  'kpopFingerHeart',
  'kpopBoxArms',
  'kpopPointDance',
  'kpopShoulderWave',
  'dance',
  'handshake',
  'shoulderSpin',
  'piggyback',
  'carryCradle',
  'clinch',
  'punch',
  'kick',
  'kneeStrike',
  'armLock',
  'rearChokeStanding',
  'rearChokeSeated',
  'rearChokeGround',
]

// ---------------------------------------------------------------------------
// Resolução de um passo
// ---------------------------------------------------------------------------

/** Um boneco de um passo, resolvido: pose completa grampeada e colocação já girada pelo heading. */
export interface ResolvedClipFigure {
  pose: Record<string, JointRotation>
  rotation: JointRotation
  /** Deslocamento vertical (m, altura de referência) — o mesmo contrato de `groundOffsetM` dos presets. */
  groundOffsetM: number
  /** Deslocamento no chão [dx, dz] já girado pelo heading, a somar na posição do boneco-âncora. */
  offset: readonly [number, number]
}

/** Arredonda a 1e-4 (mesma razão do `cleanNumber` de `posePairs.ts`: ruído de float não pode vazar para a cena salva). */
function round4(value: number): number {
  const rounded = Math.round(value * 1e4) / 1e4
  return rounded === 0 ? 0 : rounded
}

/**
 * Espelho sagital da pose INTEIRA: juntas pareadas trocam de lado com
 * `(x, -y, -z)` (`swapPoseSides`) e as centrais (tronco/pescoço/cabeça) negam
 * Y/Z no lugar — a mesma regra exata documentada em `poseMirror.ts`, aplicada
 * ao corpo todo para produzir a passada oposta.
 */
function mirrorWholePose(pose: Record<string, JointRotation>): Record<string, JointRotation> {
  const mirrored = swapPoseSides(pose)
  for (const jointName of Object.keys(mirrored)) {
    if (getJointSide(jointName)) continue
    mirrored[jointName] = clampJointRotation(jointName, mirrorRotation(mirrored[jointName]))
  }
  return mirrored
}

export function resolveClipFigure(spec: ClipFigureSpec, headingDeg: number): ResolvedClipFigure {
  let pose = resolvePosePreset(spec.preset)

  if (spec.overrides) {
    pose = { ...pose }
    for (const [jointName, partial] of Object.entries(spec.overrides)) {
      pose[jointName] = clampJointRotation(jointName, { ...pose[jointName], ...partial })
    }
  }

  if (spec.mirror) pose = mirrorWholePose(pose)

  const placement = resolvePosePresetPlacement(spec.preset)
  const baseRotation: JointRotation = spec.rotation
    ? { x: spec.rotation.x ?? 0, y: spec.rotation.y ?? 0, z: spec.rotation.z ?? 0 }
    : placement.rotation

  // O assentamento é calculado com a rotação SEM o giro de heading: girar em
  // torno de Y não muda altura nenhuma, e assim o mesmo passo assenta igual
  // para qualquer direção que o boneco encare.
  const groundOffsetM =
    spec.hipHeightM !== undefined
      ? round4(spec.hipHeightM - STANDING_HIP_HEIGHT_M)
      : spec.seat
        ? round4(seatOnGround(pose, baseRotation) + (spec.liftM ?? 0))
        : placement.groundOffsetM

  const rad = (headingDeg * Math.PI) / 180
  const [x, z] = spec.at

  return {
    pose,
    rotation: composePlacementRotation(baseRotation, headingDeg + (spec.turnDeg ?? 0)),
    groundOffsetM,
    // Rotação Y aplicada ao plano do chão: (x, z) → (x·cos + z·sin, -x·sin + z·cos).
    offset: [round4(x * Math.cos(rad) + z * Math.sin(rad)), round4(-x * Math.sin(rad) + z * Math.cos(rad))],
  }
}

// ---------------------------------------------------------------------------
// Blocos reutilizados pelos trechos
// ---------------------------------------------------------------------------

/**
 * Fase de PASSAGEM do andar (entre uma passada e a oposta): perna de apoio
 * quase vertical e a outra balançando à frente com o joelho dobrado, braços
 * cruzando perto do corpo. Declarada para a perna DIREITA em balanço (depois
 * da passada com a esquerda à frente); a outra metade do ciclo é o espelho.
 */
const WALK_PASSING: PartialPose = {
  'hip.L': { x: 5 },
  'knee.L': { x: 8 },
  'ankle.L': { x: 0 },
  'hip.R': { x: -30 },
  'knee.R': { x: 60 },
  'ankle.R': { x: 0 },
  'shoulder.L': { x: 5 },
  'elbow.L': { x: -12 },
  'shoulder.R': { x: -5 },
  'elbow.R': { x: -12 },
}

/** Fase AÉREA da corrida: perna direita avançando, esquerda recolhida atrás — os dois pés fora do chão. */
const RUN_FLIGHT: PartialPose = {
  'hip.L': { x: 15 },
  'knee.L': { x: 80 },
  'ankle.L': { x: 20 },
  'hip.R': { x: -35 },
  'knee.R': { x: 90 },
  'ankle.R': { x: 10 },
  'shoulder.L': { x: 10 },
  'elbow.L': { x: -70 },
  'shoulder.R': { x: -10 },
  'elbow.R': { x: -70 },
}

/** Agachamento de impulso do salto: meio-agachamento com os braços atrás, prontos para balançar. */
const JUMP_CROUCH: PartialPose = {
  'hip.L': { x: -60, z: 5 },
  'knee.L': { x: 80 },
  'ankle.L': { x: 25 },
  'hip.R': { x: -60, z: -5 },
  'knee.R': { x: 80 },
  'ankle.R': { x: 25 },
  spine: { x: 20 },
  chest: { x: 10 },
  'shoulder.L': { x: 35, z: 5 },
  'elbow.L': { x: -15 },
  'shoulder.R': { x: 35, z: -5 },
  'elbow.R': { x: -15 },
}

/** Impulso: corpo estendido na ponta dos pés, braços disparando para cima. */
const JUMP_TAKEOFF: PartialPose = {
  'ankle.L': { x: 45 },
  'ball.L': { x: -25 },
  'ankle.R': { x: 45 },
  'ball.R': { x: -25 },
  spine: { x: -8 },
  chest: { x: -5 },
  neck: { x: -10 },
  'shoulder.L': { x: -150, z: 15 },
  'elbow.L': { x: -5 },
  'shoulder.R': { x: -150, z: -15 },
  'elbow.R': { x: -5 },
}

/** Queda: pernas buscando o chão levemente dobradas, braços à frente para o equilíbrio. */
const JUMP_LAND: PartialPose = {
  'hip.L': { x: -25, z: 5 },
  'knee.L': { x: 25 },
  'ankle.L': { x: 15 },
  'hip.R': { x: -25, z: -5 },
  'knee.R': { x: 25 },
  'ankle.R': { x: 15 },
  spine: { x: 10 },
  'shoulder.L': { x: -70, z: 10 },
  'elbow.L': { x: -10 },
  'shoulder.R': { x: -70, z: -10 },
  'elbow.R': { x: -10 },
}

/** Amortecimento: o mesmo meio-agachamento do impulso, com os braços à frente. */
const JUMP_ABSORB: PartialPose = {
  'hip.L': { x: -60, z: 5 },
  'knee.L': { x: 80 },
  'ankle.L': { x: 25 },
  'hip.R': { x: -60, z: -5 },
  'knee.R': { x: 80 },
  'ankle.R': { x: 25 },
  spine: { x: 20 },
  chest: { x: 10 },
  'shoulder.L': { x: -50, z: 8 },
  'elbow.L': { x: -20 },
  'shoulder.R': { x: -50, z: -8 },
  'elbow.R': { x: -20 },
}

/**
 * Passada com a perna ESQUERDA à frente enquanto carrega nas costas (pernas
 * apenas — braços seguram). A perna de trás foi varrida numericamente até o
 * assentamento coincidir com o do preset (-0,036 contra -0,040 m): é o que
 * impede o carregador de afundar no chão — ou de subir e "descolar" de quem
 * está montado — no meio do passo.
 */
const PIGGY_STRIDE_L: PartialPose = {
  'hip.L': { x: -48, z: 5 },
  'knee.L': { x: 45 },
  'ankle.L': { x: 5 },
  'hip.R': { x: -28, z: -5 },
  'knee.R': { x: 30 },
  'ankle.R': { x: 6 },
}

/** Espelho manual da passada acima (só pernas — os braços do carregador não podem trocar de lado). */
const PIGGY_STRIDE_R: PartialPose = {
  'hip.R': { x: -48, z: -5 },
  'knee.R': { x: 45 },
  'ankle.R': { x: 5 },
  'hip.L': { x: -28, z: 5 },
  'knee.L': { x: 30 },
  'ankle.L': { x: 6 },
}

/** Preparo do salto de quem vai montar no cavalinho: agachado com os braços à frente, prontos para agarrar os ombros. */
const MOUNT_CROUCH: PartialPose = {
  'hip.L': { x: -50, z: 5 },
  'knee.L': { x: 70 },
  'ankle.L': { x: 20 },
  'hip.R': { x: -50, z: -5 },
  'knee.R': { x: 70 },
  'ankle.R': { x: 20 },
  spine: { x: 15 },
  'shoulder.L': { x: -40 },
  'elbow.L': { x: -30 },
  'shoulder.R': { x: -40 },
  'elbow.R': { x: -30 },
}

/** Agachamento fundo de quem carrega nas costas, esperando o outro montar. */
const CARRIER_CROUCH: PartialPose = {
  spine: { x: 32 },
  'hip.L': { x: -45, z: 5 },
  'knee.L': { x: 55 },
  'hip.R': { x: -45, z: -5 },
  'knee.R': { x: 55 },
}

/** Passadas de quem carrega no colo (pernas apenas — os braços são a maca e não podem trocar de lado). */
const CRADLE_STRIDE_L: PartialPose = {
  'hip.L': { x: -35, z: 4 },
  'knee.L': { x: 35 },
  'ankle.L': { x: 5 },
  'hip.R': { x: 8, z: -4 },
  'knee.R': { x: 12 },
}

const CRADLE_STRIDE_R: PartialPose = {
  'hip.R': { x: -35, z: -4 },
  'knee.R': { x: 35 },
  'ankle.R': { x: 5 },
  'hip.L': { x: 8, z: 4 },
  'knee.L': { x: 12 },
}

/** Quem vai ser pego no colo cede: joelhos dobrando e braços buscando o pescoço de quem pega. */
const CRADLE_SIT: PartialPose = {
  'hip.L': { x: -35, z: 4 },
  'knee.L': { x: 45 },
  'hip.R': { x: -35, z: -4 },
  'knee.R': { x: 45 },
  spine: { x: -10 },
  'shoulder.L': { x: -40, z: 10 },
  'elbow.L': { x: -30 },
  'shoulder.R': { x: -40, z: -10 },
  'elbow.R': { x: -30 },
}

/** Agachamento de quem carrega no colo, recebendo o peso com os braços já em maca. */
const CRADLE_CATCH: PartialPose = {
  'hip.L': { x: -55, z: 4 },
  'knee.L': { x: 75 },
  'hip.R': { x: -55, z: -4 },
  'knee.R': { x: 75 },
  spine: { x: 0 },
}

/** Braço direito estendendo até o ombro do outro (preparo do empurrão que gira). */
const REACH_SHOULDER: PartialPose = {
  'shoulder.R': { x: -75, y: 10, z: -5 },
  'elbow.R': { x: -15 },
  'wrist.R': { x: -10 },
}

/** O empurrão: braço estendido, tronco entrando e passada firme. */
const PUSH_SHOULDER: PartialPose = {
  'shoulder.R': { x: -82, y: 5, z: -5 },
  'elbow.R': { x: -5 },
  spine: { x: 8, y: -8 },
  'hip.L': { x: -18, z: 5 },
  'knee.L': { x: 20 },
  'hip.R': { x: 10, z: -8 },
  'knee.R': { x: 8 },
  'ankle.R': { x: 20 },
}

/** Recolhendo o braço depois do empurrão. */
const RETRACT_ARM: PartialPose = {
  'shoulder.R': { x: -40 },
  'elbow.R': { x: -45 },
}

/** Braços abertos de quem é girado pelo empurrão, buscando equilíbrio. */
const SPIN_BALANCE: PartialPose = {
  'shoulder.L': { x: -15, z: 30 },
  'elbow.L': { x: -20 },
  'shoulder.R': { x: -15, z: -30 },
  'elbow.R': { x: -20 },
  spine: { y: 10 },
}

/** Punho direito armado atrás, pronto para o cruzado (por cima da guarda de luta). */
const PUNCH_WINDUP: PartialPose = {
  spine: { x: 8, y: -30 },
  chest: { x: 5, y: -15 },
  neck: { y: 25 },
  'shoulder.R': { x: -35, y: 75, z: -55 },
  'elbow.R': { x: -145 },
}

/** Recolhendo o soco depois do impacto. */
const PUNCH_RECOVER: PartialPose = {
  'shoulder.R': { x: -95, y: -10, z: -25 },
  'elbow.R': { x: -70 },
}

/** Chute recolhido (joelho alto), antes e depois de estender. */
const KICK_CHAMBER: PartialPose = {
  'hip.R': { x: -95, y: -13, z: 4 },
  'knee.R': { x: 115 },
  'ankle.R': { x: 25 },
  spine: { x: -8, y: 10 },
}

/** Aperto de mão bombeando para baixo (só o braço direito mexe a partir da pose base). */
const SHAKE_DOWN: PartialPose = {
  'shoulder.R': { x: -48, y: 25, z: 20 },
  'elbow.R': { x: -38, y: -95 },
}

/** Aperto de mão bombeando para cima. */
const SHAKE_UP: PartialPose = {
  'shoulder.R': { x: -60, y: 25, z: 20 },
  'elbow.R': { x: -50, y: -95 },
}

/** Quem recebe o mata-leão em pé escora: joelhos cedendo um pouco, tronco puxado para trás. */
const CHOKE_STAND_STRUGGLE_B: PartialPose = {
  'hip.L': { x: -22, z: 8 },
  'knee.L': { x: 35 },
  'hip.R': { x: -22, z: -8 },
  'knee.R': { x: 35 },
  spine: { x: -16 },
}

/** Quem aplica acompanha o recuo, afundando a base. */
const CHOKE_STAND_STRUGGLE_A: PartialPose = {
  'hip.L': { x: -16, z: 8 },
  'knee.L': { x: 18 },
  'hip.R': { x: 2, z: -12 },
  'knee.R': { x: 20 },
}

/** Quem recebe cede de vez: joelhos bem dobrados, quase sentando no ar. */
const CHOKE_STAND_SAG_B: PartialPose = {
  'hip.L': { x: -45, z: 8 },
  'knee.L': { x: 75 },
  'hip.R': { x: -45, z: -8 },
  'knee.R': { x: 75 },
  spine: { x: -12 },
}

/** Quem aplica desce junto, mantendo a chave. */
const CHOKE_STAND_SAG_A: PartialPose = {
  'hip.L': { x: -35, z: 8 },
  'knee.L': { x: 50 },
  'hip.R': { x: -15, z: -12 },
  'knee.R': { x: 45 },
}

/** Braços e pescoço do mata-leão sofrido, aplicados sobre a pose ajoelhada (o fim do mata-leão em pé). */
const CHOKE_KNEEL_TAKING: PartialPose = {
  'shoulder.L': { x: -31, y: -20, z: -11 },
  'elbow.L': { x: -123 },
  'shoulder.R': { x: -31, y: 20, z: 11 },
  'elbow.R': { x: -123 },
  spine: { x: -12 },
  chest: { x: -8 },
  neck: { x: -25 },
  head: { x: -8 },
}

/**
 * Quem recebe o mata-leão sentado se debate: perna esquerda chutando PARA
 * CIMA — sentado com as pernas à frente (horizontal em `hip.x = -90`),
 * levantar a perna é flexionar MAIS (-105), não menos; -75 baixaria a perna
 * para dentro do chão (medido: o pé atravessava 34 cm).
 */
const CHOKE_SEATED_STRUGGLE_B: PartialPose = {
  'hip.L': { x: -105, z: 7 },
  'knee.L': { x: 35 },
  spine: { x: -26 },
}

/** Quem aplica sentado aperta mais a chave. */
const CHOKE_SEATED_STRUGGLE_A: PartialPose = {
  'elbow.R': { x: -78 },
  spine: { x: 16 },
}

/** No chão: as pernas fecham mais e a chave aperta. */
const CHOKE_GROUND_SQUEEZE_A: PartialPose = {
  'knee.L': { x: 135 },
  'knee.R': { x: 140 },
  'elbow.L': { x: -105 },
  'elbow.R': { x: -110 },
}

/** Quem recebe no chão faz ponte, tentando escapar. */
const CHOKE_GROUND_BRIDGE_B: PartialPose = {
  'hip.L': { x: -35, z: 14 },
  'knee.L': { x: 70 },
  'hip.R': { x: -35, z: -14 },
  'knee.R': { x: 70 },
  spine: { x: -14 },
}

/** A meio caminho do rolamento para o chão (quem recebe, tombando de costas). */
const CHOKE_ROLL_B: PartialPose = {
  spine: { x: -28 },
}

/** Cabeça tombada de lado — o atordoado de quem acaba de cair sentado. */
const DAZED_HEAD: PartialPose = {
  head: { z: -10 },
}

/** Pequena inclinação de cabeça no "coração" — o pulso do gesto, sem mudar o braço. */
const HEART_TILT: PartialPose = {
  head: { z: -8, y: 8 },
}

/** Braço ESQUERDO do robô recolhido ao neutro, por cima da pose "Robô" — o direito continua erguido. */
const ROBOT_ARM_DOWN_L: PartialPose = {
  'shoulder.L': { x: 0, z: 0 },
  'elbow.L': { x: 0 },
}

/** Espelho manual do recolhimento acima, para o braço DIREITO. */
const ROBOT_ARM_DOWN_R: PartialPose = {
  'shoulder.R': { x: 0, z: 0 },
  'elbow.R': { x: 0 },
}

// ---------------------------------------------------------------------------
// Os trechos
// ---------------------------------------------------------------------------

/** Ciclo de andar/correr: passada → passagem → passada oposta → ..., avançando `stepM` por keyframe. */
function gaitSteps(
  preset: PosePresetKey,
  passing: PartialPose,
  stepM: number,
  durationMs: number,
  lift: { passing?: number } = {},
): AnimationClipStep[] {
  const phases: Omit<ClipFigureSpec, 'at'>[] = [
    { preset, seat: true },
    { preset, overrides: passing, seat: true, liftM: lift.passing },
    { preset, mirror: true, seat: true },
    { preset, overrides: passing, mirror: true, seat: true, liftM: lift.passing },
  ]

  const steps: AnimationClipStep[] = []
  // 9 keyframes = 2 ciclos completos + a passada final igual à primeira (dá
  // para emendar o trecho em sequência e o ciclo continua).
  for (let index = 0; index < 9; index += 1) {
    steps.push({
      durationMs: index === 0 ? 500 : durationMs,
      a: { ...phases[index % 4], at: [0, round4(index * stepM)] },
    })
  }
  return steps
}

/** Par girando em bloco em torno do ponto médio (dança, disputa do clinche). */
function rotatedPair(
  centerZ: number,
  halfGapM: number,
  angleDeg: number,
  a: Omit<ClipFigureSpec, 'at' | 'turnDeg'>,
  b: Omit<ClipFigureSpec, 'at' | 'turnDeg'>,
): { a: ClipFigureSpec; b: ClipFigureSpec } {
  const rad = (angleDeg * Math.PI) / 180
  const dx = halfGapM * Math.sin(rad)
  const dz = halfGapM * Math.cos(rad)
  return {
    a: { ...a, at: [round4(-dx), round4(centerZ - dz)], turnDeg: angleDeg },
    b: { ...b, at: [round4(dx), round4(centerZ + dz)], turnDeg: angleDeg + 180 },
  }
}

/** Uma volta completa de dança de salão: 60° por keyframe, em posição fechada. */
function danceSteps(): AnimationClipStep[] {
  const steps: AnimationClipStep[] = []
  for (let index = 0; index <= 6; index += 1) {
    const pair = rotatedPair(0.18, 0.18, index * 60, { preset: 'danceLead' }, { preset: 'danceFollow' })
    steps.push({ durationMs: index === 0 ? 600 : 700, ...pair })
  }
  return steps
}

export const ANIMATION_CLIPS: Record<AnimationClipKey, AnimationClipDefinition> = {
  // -----------------------------------------------------------------------
  // Individuais
  // -----------------------------------------------------------------------

  // Quatro passos à frente: 0,30 m a cada 250 ms (1,2 m/s, passo de 0,6 m —
  // ritmo de caminhada real). Primeiro e último keyframes têm a MESMA pose:
  // adicionar o trecho duas vezes emenda o ciclo sem solavanco.
  walking: { kind: 'solo', steps: gaitSteps('walking', WALK_PASSING, 0.3, 250) },

  // Quatro passadas de corrida: 0,55 m a cada 150 ms (~3,7 m/s), com a fase
  // aérea 8 cm acima do assentamento — na corrida os dois pés saem do chão.
  running: { kind: 'solo', steps: gaitSteps('running', RUN_FLIGHT, 0.55, 150, { passing: 0.08 }) },

  // Salto vertical no lugar: agacha, dispara, ápice (a pose "Saltando" do
  // catálogo, a 1,25 m de quadril), toca o chão, amortece e volta a ficar em
  // pé. As alturas das fases de contato saem do assentamento numérico.
  jumping: {
    kind: 'solo',
    steps: [
      { durationMs: 600, a: { preset: 'standing', at: [0, 0] } },
      { durationMs: 400, a: { preset: 'standing', overrides: JUMP_CROUCH, seat: true, at: [0, 0] } },
      { durationMs: 180, a: { preset: 'standing', overrides: JUMP_TAKEOFF, seat: true, at: [0, 0] } },
      { durationMs: 280, a: { preset: 'jumping', at: [0, 0] } },
      { durationMs: 280, a: { preset: 'standing', overrides: JUMP_LAND, seat: true, liftM: 0.03, at: [0, 0] } },
      { durationMs: 180, a: { preset: 'standing', overrides: JUMP_ABSORB, seat: true, at: [0, 0] } },
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
    ],
  },

  // -----------------------------------------------------------------------
  // Dança pop — 4 poses de K-pop (pedido do usuário) e um trecho curto para
  // cada uma: entra no gesto, dá um "pulso"/alternância nele e volta à pose
  // em pé. Nenhuma desloca o boneco no chão (`at: [0, 0]` sempre).
  // -----------------------------------------------------------------------

  // Coração com os dedos: ergue o gesto, inclina a cabeça duas vezes (o
  // "pulso" do gesto) e volta a ficar em pé.
  kpopFingerHeart: {
    kind: 'solo',
    steps: [
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
      { durationMs: 350, a: { preset: 'kpopFingerHeart', at: [0, 0] } },
      { durationMs: 250, a: { preset: 'kpopFingerHeart', overrides: HEART_TILT, at: [0, 0] } },
      { durationMs: 250, a: { preset: 'kpopFingerHeart', at: [0, 0] } },
      { durationMs: 250, a: { preset: 'kpopFingerHeart', overrides: HEART_TILT, at: [0, 0] } },
      { durationMs: 300, a: { preset: 'kpopFingerHeart', at: [0, 0] } },
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
    ],
  },

  // Braços de robô: ergue os dois braços em ângulo reto e alterna qual lado
  // recolhe ao neutro — o movimento de "pêndulo" clássico do robô — antes de
  // voltar a ficar em pé.
  kpopBoxArms: {
    kind: 'solo',
    steps: [
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
      { durationMs: 350, a: { preset: 'kpopBoxArms', at: [0, 0] } },
      { durationMs: 300, a: { preset: 'kpopBoxArms', overrides: ROBOT_ARM_DOWN_L, at: [0, 0] } },
      { durationMs: 300, a: { preset: 'kpopBoxArms', at: [0, 0] } },
      { durationMs: 300, a: { preset: 'kpopBoxArms', overrides: ROBOT_ARM_DOWN_R, at: [0, 0] } },
      { durationMs: 300, a: { preset: 'kpopBoxArms', at: [0, 0] } },
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
    ],
  },

  // Apontar com o quadril: a pose já é assimétrica (peso e braço trocam de
  // lado no espelho), então alternar os dois lados É o passo de dança.
  kpopPointDance: {
    kind: 'solo',
    steps: [
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
      { durationMs: 400, a: { preset: 'kpopPointDance', at: [0, 0] } },
      { durationMs: 500, a: { preset: 'kpopPointDance', mirror: true, at: [0, 0] } },
      { durationMs: 500, a: { preset: 'kpopPointDance', at: [0, 0] } },
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
    ],
  },

  // Onda de ombro: o espelho troca qual ombro isola, então alternar original
  // e espelhado é a própria "onda" viajando de um lado para o outro.
  kpopShoulderWave: {
    kind: 'solo',
    steps: [
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
      { durationMs: 350, a: { preset: 'kpopShoulderWave', at: [0, 0] } },
      { durationMs: 350, a: { preset: 'kpopShoulderWave', mirror: true, at: [0, 0] } },
      { durationMs: 350, a: { preset: 'kpopShoulderWave', at: [0, 0] } },
      { durationMs: 350, a: { preset: 'kpopShoulderWave', mirror: true, at: [0, 0] } },
      { durationMs: 500, a: { preset: 'standing', at: [0, 0] } },
    ],
  },

  // -----------------------------------------------------------------------
  // Duplas. As poses de contato e as distâncias vêm de `posePairs.ts` — o
  // instante do encaixe de cada cena é exatamente o par já resolvido lá.
  // -----------------------------------------------------------------------

  // Uma volta completa em posição fechada, girando 60° por keyframe em torno
  // do ponto médio (0,36 m entre os dois, a distância do par). O último
  // keyframe repete o primeiro: o trecho emenda consigo mesmo.
  dance: { kind: 'duo', steps: danceSteps() },

  // Aproximam-se (um passo cada), apertam as mãos a 0,755 m (o encaixe medido
  // do par), bombeiam duas vezes e se soltam com um passo atrás.
  handshake: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, 0] },
        b: { preset: 'standing', at: [0, 1.55], turnDeg: 180 },
      },
      {
        durationMs: 500,
        a: { preset: 'walking', seat: true, at: [0, 0.4] },
        b: { preset: 'walking', mirror: true, seat: true, at: [0, 1.15], turnDeg: 180 },
      },
      {
        durationMs: 400,
        a: { preset: 'handshake', at: [0, 0.4] },
        b: { preset: 'handshake', at: [0, 1.155], turnDeg: 180 },
      },
      {
        durationMs: 250,
        a: { preset: 'handshake', overrides: SHAKE_DOWN, at: [0, 0.4] },
        b: { preset: 'handshake', overrides: SHAKE_DOWN, at: [0, 1.155], turnDeg: 180 },
      },
      {
        durationMs: 250,
        a: { preset: 'handshake', overrides: SHAKE_UP, at: [0, 0.4] },
        b: { preset: 'handshake', overrides: SHAKE_UP, at: [0, 1.155], turnDeg: 180 },
      },
      {
        durationMs: 250,
        a: { preset: 'handshake', at: [0, 0.4] },
        b: { preset: 'handshake', at: [0, 1.155], turnDeg: 180 },
      },
      {
        durationMs: 500,
        a: { preset: 'standing', at: [0, 0.25] },
        b: { preset: 'standing', at: [0, 1.3], turnDeg: 180 },
      },
    ],
  },

  // O empurrão que gira (pedido do usuário): A alcança o ombro de B, empurra,
  // e B gira meia-volta terminando DE COSTAS para A — a deixa para emendar
  // qualquer golpe por trás (mata-leão, gravata). O giro anda 60° por
  // keyframe sempre no mesmo sentido; como a interpolação da rotação do
  // boneco é pelo menor arco, passos de menos de 180° nunca giram ao
  // contrário.
  shoulderSpin: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, 0] },
        b: { preset: 'standing', at: [0, 0.85], turnDeg: 180 },
      },
      {
        durationMs: 400,
        a: { preset: 'standing', overrides: REACH_SHOULDER, at: [0, 0.15] },
        b: { preset: 'standing', at: [0, 0.85], turnDeg: 180 },
      },
      {
        durationMs: 250,
        a: { preset: 'standing', overrides: PUSH_SHOULDER, seat: true, at: [0, 0.25] },
        b: { preset: 'standing', overrides: SPIN_BALANCE, at: [0, 0.85], turnDeg: 240 },
      },
      {
        durationMs: 250,
        a: { preset: 'standing', overrides: RETRACT_ARM, at: [0, 0.2] },
        b: { preset: 'standing', overrides: SPIN_BALANCE, at: [0, 0.85], turnDeg: 300 },
      },
      {
        durationMs: 350,
        a: { preset: 'standing', at: [0, 0.15] },
        b: { preset: 'standing', at: [0, 0.85], turnDeg: 360 },
      },
    ],
  },

  // Cavalinho: B se aproxima por trás, agacha, monta (o par medido: quem é
  // carregado fica 0,16 m atrás) e A carrega três passos à frente, alternando
  // as pernas — os braços dos dois não mudam, são eles que seguram.
  piggyback: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, 0] },
        b: { preset: 'standing', at: [0, -0.7] },
      },
      {
        durationMs: 500,
        a: { preset: 'carryingPiggyback', overrides: CARRIER_CROUCH, seat: true, at: [0, 0] },
        b: { preset: 'walking', seat: true, at: [0, -0.35] },
      },
      {
        durationMs: 300,
        a: { preset: 'carryingPiggyback', overrides: CARRIER_CROUCH, seat: true, at: [0, 0] },
        b: { preset: 'standing', overrides: MOUNT_CROUCH, seat: true, at: [0, -0.2] },
      },
      {
        durationMs: 400,
        a: { preset: 'carryingPiggyback', at: [0, 0] },
        b: { preset: 'carriedPiggyback', at: [0, -0.16] },
      },
      {
        durationMs: 600,
        a: { preset: 'carryingPiggyback', overrides: PIGGY_STRIDE_L, at: [0, 0.4] },
        b: { preset: 'carriedPiggyback', at: [0, 0.24] },
      },
      {
        durationMs: 600,
        a: { preset: 'carryingPiggyback', overrides: PIGGY_STRIDE_R, at: [0, 0.8] },
        b: { preset: 'carriedPiggyback', at: [0, 0.64] },
      },
      {
        durationMs: 600,
        a: { preset: 'carryingPiggyback', at: [0, 1.2] },
        b: { preset: 'carriedPiggyback', at: [0, 1.04] },
      },
    ],
  },

  // Pegando no colo: A se aproxima, ajoelha, B cede o peso, A o recebe
  // agachado e levanta com B atravessado nos braços (o par medido, 0,28 m à
  // frente), carregando dois passos.
  carryCradle: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, 0] },
        b: { preset: 'standing', at: [0, 0.7], turnDeg: 180 },
      },
      {
        durationMs: 400,
        a: { preset: 'walking', seat: true, at: [0, 0.2] },
        b: { preset: 'standing', at: [0, 0.7], turnDeg: 180 },
      },
      {
        durationMs: 500,
        a: { preset: 'kneelingOneKnee', at: [0, 0.2] },
        b: { preset: 'standing', overrides: CRADLE_SIT, seat: true, at: [0, 0.66], turnDeg: 180 },
      },
      {
        durationMs: 500,
        a: { preset: 'carryingCradle', overrides: CRADLE_CATCH, seat: true, at: [0, 0.2] },
        b: { preset: 'carriedCradle', hipHeightM: 0.65, at: [0, 0.48] },
      },
      {
        durationMs: 400,
        a: { preset: 'carryingCradle', at: [0, 0.2] },
        b: { preset: 'carriedCradle', at: [0, 0.48] },
      },
      {
        durationMs: 600,
        a: { preset: 'carryingCradle', overrides: CRADLE_STRIDE_L, at: [0, 0.6] },
        b: { preset: 'carriedCradle', at: [0, 0.88] },
      },
      {
        durationMs: 600,
        a: { preset: 'carryingCradle', overrides: CRADLE_STRIDE_R, at: [0, 1.0] },
        b: { preset: 'carriedCradle', at: [0, 1.28] },
      },
    ],
  },

  // Clinche: guardas de luta, entram, agarram a 0,40 m (o par) e disputam o
  // giro — o par roda 30° para um lado, 30° para o outro e volta ao centro.
  clinch: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'fighting', at: [0, 0] },
        b: { preset: 'fighting', at: [0, 0.9], turnDeg: 180 },
      },
      {
        durationMs: 350,
        a: { preset: 'fighting', at: [0, 0.15] },
        b: { preset: 'fighting', at: [0, 0.75], turnDeg: 180 },
      },
      {
        durationMs: 350,
        a: { preset: 'clinch', at: [0, 0.25] },
        b: { preset: 'clinch', at: [0, 0.65], turnDeg: 180 },
      },
      { durationMs: 450, ...rotatedPair(0.45, 0.2, 30, { preset: 'clinch' }, { preset: 'clinch' }) },
      { durationMs: 450, ...rotatedPair(0.45, 0.2, -30, { preset: 'clinch' }, { preset: 'clinch' }) },
      { durationMs: 450, ...rotatedPair(0.45, 0.2, 0, { preset: 'clinch' }, { preset: 'clinch' }) },
    ],
  },

  // Soco: guardas, A arma o cruzado, impacto no encaixe medido do par
  // (0,629 m — punho na altura do rosto de B), B é jogado para trás e os dois
  // voltam à guarda.
  punch: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'fighting', at: [0, 0] },
        b: { preset: 'fighting', at: [0, 0.85], turnDeg: 180 },
      },
      {
        durationMs: 350,
        a: { preset: 'fighting', overrides: PUNCH_WINDUP, at: [0, 0] },
        b: { preset: 'fighting', at: [0, 0.85], turnDeg: 180 },
      },
      {
        durationMs: 200,
        a: { preset: 'punchGiving', at: [0, 0.111] },
        b: { preset: 'punchTaking', at: [0, 0.74], turnDeg: 180 },
      },
      {
        durationMs: 250,
        a: { preset: 'punchGiving', overrides: PUNCH_RECOVER, at: [0, 0.08] },
        b: { preset: 'pushTaking', at: [0, 0.87], turnDeg: 180 },
      },
      {
        durationMs: 350,
        a: { preset: 'fighting', at: [0, 0] },
        b: { preset: 'pushTaking', at: [0, 0.95], turnDeg: 180 },
      },
      {
        durationMs: 400,
        a: { preset: 'fighting', at: [0, 0] },
        b: { preset: 'fighting', at: [0, 0.95], turnDeg: 180 },
      },
    ],
  },

  // Chute frontal: guardas, A recolhe o joelho, estende no encaixe medido
  // (0,815 m — pé na altura da barriga de B), recolhe, e B cambaleia.
  kick: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'fighting', at: [0, 0] },
        b: { preset: 'fighting', at: [0, 1.0], turnDeg: 180 },
      },
      {
        durationMs: 350,
        a: { preset: 'kickGiving', overrides: KICK_CHAMBER, at: [0, 0] },
        b: { preset: 'fighting', at: [0, 1.0], turnDeg: 180 },
      },
      {
        durationMs: 200,
        a: { preset: 'kickGiving', at: [0, 0.09] },
        b: { preset: 'kickTaking', at: [0, 0.905], turnDeg: 180 },
      },
      {
        durationMs: 250,
        a: { preset: 'kickGiving', overrides: KICK_CHAMBER, at: [0, 0.09] },
        b: { preset: 'kickTaking', at: [0, 0.98], turnDeg: 180 },
      },
      {
        durationMs: 350,
        a: { preset: 'fighting', at: [0, 0] },
        b: { preset: 'pushTaking', at: [0, 1.1], turnDeg: 180 },
      },
      {
        durationMs: 400,
        a: { preset: 'fighting', at: [0, 0] },
        b: { preset: 'fighting', at: [0, 1.1], turnDeg: 180 },
      },
    ],
  },

  // Joelhada na barriga com cambalhota (pedido do usuário, com foto de
  // referência de um jogo de luta): os dois começam EM REPOUSO (`standing`,
  // não em guarda), aproximam-se até o clinche (mesma pose e mesma distância
  // de `clinch`, gapM 0,4 — reaproveitada, não redigitada) e A crava o joelho
  // na barriga de B no encaixe medido do par (0,3653 m). Na sequência, B dá
  // uma cambalhota no ar EM TORNO do joelho de A e cai sentado, de costas
  // para A.
  //
  // A cambalhota é só ROTAÇÃO em torno do eixo lateral do corpo (a pose de B
  // continua a de `kneeStrikeTaking`, já dobrada), sempre no mesmo sentido.
  // A PARTIR do contato, `rotation` é declarado por EXTENSO como
  // `{x, y:0, z:180}` (em vez de só `turnDeg:180` sobre a colocação em pé) —
  // motivo medido, não estético: compor `rotation.x` com `turnDeg:180` faz
  // `composePlacementRotation` (matriz) devolver o giro espalhado entre Y e Z
  // de um jeito que MUDA de eixo a cada passo (ex.: {x:90,y:0,z:180} no
  // primeiro passo do ar, {x:0,y:180,z:0} no de contato) — e como o player
  // interpola cada eixo (x/y/z) SEPARADO pelo menor arco (`lerpAngle`,
  // poseBlend.ts), um Y saltando de 180 para 0 ENQUANTO X sai do 0 rasgaria
  // um giro espúrio no meio da decolagem. Com `z:180` fixo em todos os passos
  // do ar e só `x` variando (180→90→0→−90→−180, sempre −90° por passo), a
  // interpolação de Y e Z fica PARADA e só X gira — testado numericamente
  // (as duas formas dão a MESMA matriz de rotação em cada instante, só a
  // decomposição em Euler muda).
  //
  // B continua olhando para -Z do início ao fim (a mesma direção de quando
  // encarava A) — é isso que faz o resultado ler como "de costas para A":
  // B decola À FRENTE de A (z > 0,2, a posição de A) e aterrissa ATRÁS dele
  // (z < 0,2), tendo voado por cima. Alturas (`hipHeightM`) sobem e descem
  // pelo arco (pico 1,35 m) e a aterrissagem usa `sittingLegsForward`, com um
  // leve tombo de cabeça (atordoado).
  kneeStrike: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, 0] },
        b: { preset: 'standing', at: [0, 1.4], turnDeg: 180 },
      },
      {
        durationMs: 500,
        a: { preset: 'fighting', at: [0, 0.05] },
        b: { preset: 'fighting', at: [0, 1.05], turnDeg: 180 },
      },
      {
        durationMs: 400,
        a: { preset: 'clinch', at: [0, 0.2] },
        b: { preset: 'clinch', at: [0, 0.6], turnDeg: 180 },
      },
      {
        durationMs: 200,
        a: { preset: 'kneeStrikeGiving', at: [0, 0.2] },
        b: { preset: 'kneeStrikeTaking', rotation: { x: 180, z: 180 }, at: [0, 0.5653] },
      },
      {
        durationMs: 200,
        a: { preset: 'kneeStrikeGiving', at: [0, 0.2] },
        b: {
          preset: 'kneeStrikeTaking',
          rotation: { x: 90, z: 180 },
          hipHeightM: 1.15,
          at: [0, 0.35],
        },
      },
      {
        durationMs: 200,
        a: { preset: 'fighting', at: [0, 0.2] },
        b: {
          preset: 'kneeStrikeTaking',
          rotation: { x: 0, z: 180 },
          hipHeightM: 1.35,
          at: [0, 0.1],
        },
      },
      {
        durationMs: 200,
        a: { preset: 'fighting', at: [0, 0.2] },
        b: {
          preset: 'kneeStrikeTaking',
          rotation: { x: -90, z: 180 },
          hipHeightM: 0.95,
          at: [0, -0.15],
        },
      },
      {
        durationMs: 400,
        a: { preset: 'fighting', at: [0, 0.2] },
        b: {
          preset: 'sittingLegsForward',
          overrides: DAZED_HEAD,
          rotation: { x: 180, z: 180 },
          at: [0, -0.4],
        },
      },
    ],
  },

  // Chave de braço sentada (pedido do usuário, descrito por texto: A agachado
  // atrás de B sentado, uma perna travando a perna direita dele e o joelho
  // nas costas; prende o braço direito de B e segura o punho dele, empurra
  // com o peso do corpo e depois puxa rapidamente para trás). Os dois COMEÇAM
  // EM PÉ e A se aproxima por trás (mesmo padrão de `rearChokeSeated`): B
  // senta (`sittingLegsForward`) enquanto A se agacha (`kneelingBoth`), a
  // chave fecha no encaixe medido (0,238 m, `posePairs.ts`) com
  // `armLockPushGiving`/`armLockPushTaking` — o instante do empurrão — e o
  // trecho termina no `armLockPullGiving`/`armLockPullTaking` — o instante do
  // puxão final, no limite da articulação. B fica parado em `at: [0, 0.238]`
  // do início ao fim; quem se desloca é A, vindo de trás.
  armLock: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, -0.6] },
        b: { preset: 'standing', at: [0, 0.238] },
      },
      {
        durationMs: 500,
        a: { preset: 'walking', seat: true, at: [0, -0.2] },
        b: { preset: 'sittingLegsForward', at: [0, 0.238] },
      },
      {
        durationMs: 400,
        a: { preset: 'kneelingBoth', at: [0, 0] },
        b: { preset: 'sittingLegsForward', at: [0, 0.238] },
      },
      {
        durationMs: 350,
        a: { preset: 'armLockPushGiving', at: [0, 0] },
        b: { preset: 'armLockPushTaking', at: [0, 0.238] },
      },
      {
        durationMs: 450,
        a: { preset: 'armLockPullGiving', at: [0, 0] },
        b: { preset: 'armLockPullTaking', at: [0, 0.238] },
      },
    ],
  },

  // Mata-leão em pé. Os dois COMEÇAM EM PÉ, B já de costas para A (pedido do
  // usuário — o trecho "empurrão no ombro" serve de entrada quando B está de
  // frente): A se aproxima por trás, fecha a chave a 0,39 m (o par medido),
  // B escora, cede e termina de joelhos com A ajoelhado atrás.
  rearChokeStanding: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, -0.55] },
        b: { preset: 'standing', at: [0, 0.39] },
      },
      {
        durationMs: 500,
        a: { preset: 'walking', seat: true, at: [0, -0.12] },
        b: { preset: 'standing', at: [0, 0.39] },
      },
      {
        durationMs: 350,
        a: { preset: 'chokeGiving', at: [0, 0] },
        b: { preset: 'chokeTaking', at: [0, 0.39] },
      },
      {
        durationMs: 450,
        a: { preset: 'chokeGiving', overrides: CHOKE_STAND_STRUGGLE_A, seat: true, at: [0, -0.02] },
        b: { preset: 'chokeTaking', overrides: CHOKE_STAND_STRUGGLE_B, seat: true, at: [0, 0.39] },
      },
      {
        durationMs: 500,
        a: { preset: 'chokeGiving', overrides: CHOKE_STAND_SAG_A, seat: true, at: [0, -0.02] },
        b: { preset: 'chokeTaking', overrides: CHOKE_STAND_SAG_B, seat: true, at: [0, 0.39] },
      },
      {
        durationMs: 500,
        a: { preset: 'rearChokeKneeling', at: [0, -0.06] },
        b: { preset: 'kneelingBoth', overrides: CHOKE_KNEEL_TAKING, at: [0, 0.39] },
      },
    ],
  },

  // Mata-leão com o adversário sentado. Começam em pé (B de costas); B senta,
  // A ajoelha atrás e fecha a chave no encaixe medido do par (0,45 m).
  rearChokeSeated: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, -0.55] },
        b: { preset: 'standing', at: [0, 0.45] },
      },
      {
        durationMs: 500,
        a: { preset: 'walking', seat: true, at: [0, -0.2] },
        b: { preset: 'sittingLegsForward', at: [0, 0.45] },
      },
      {
        durationMs: 400,
        a: { preset: 'kneelingBoth', at: [0, 0] },
        b: { preset: 'sittingLegsForward', at: [0, 0.45] },
      },
      {
        durationMs: 350,
        a: { preset: 'rearChokeKneeling', at: [0, 0] },
        b: { preset: 'rearChokeSeated', at: [0, 0.45] },
      },
      {
        durationMs: 450,
        a: { preset: 'rearChokeKneeling', overrides: CHOKE_SEATED_STRUGGLE_A, at: [0, 0] },
        b: { preset: 'rearChokeSeated', overrides: CHOKE_SEATED_STRUGGLE_B, at: [0, 0.45] },
      },
      {
        durationMs: 450,
        a: { preset: 'rearChokeKneeling', at: [0, 0] },
        b: { preset: 'rearChokeSeated', at: [0, 0.45] },
      },
    ],
  },

  // Mata-leão no chão. Começam em pé (B de costas); B senta com A ajoelhado
  // atrás, a chave fecha sentada e A rola de costas levando B por cima —
  // terminando no par medido do chão (B 0,10 m à frente, empilhado 0,20 m
  // acima), com aperto de pernas e ponte de fuga.
  rearChokeGround: {
    kind: 'duo',
    steps: [
      {
        durationMs: 600,
        a: { preset: 'standing', at: [0, -0.55] },
        b: { preset: 'standing', at: [0, 0.45] },
      },
      {
        durationMs: 500,
        a: { preset: 'kneelingBoth', at: [0, 0] },
        b: { preset: 'sittingLegsForward', at: [0, 0.45] },
      },
      {
        durationMs: 400,
        a: { preset: 'rearChokeKneeling', at: [0, 0] },
        b: { preset: 'rearChokeSeated', at: [0, 0.45] },
      },
      {
        durationMs: 450,
        a: { preset: 'groundChokeGiving', rotation: { x: -60 }, hipHeightM: 0.25, at: [0, -0.15] },
        b: { preset: 'rearChokeSeated', overrides: CHOKE_ROLL_B, rotation: { x: -40 }, hipHeightM: 0.2, at: [0, 0.3] },
      },
      {
        durationMs: 450,
        a: { preset: 'groundChokeGiving', at: [0, -0.3] },
        b: { preset: 'groundChokeTaking', at: [0, -0.2] },
      },
      {
        durationMs: 450,
        a: { preset: 'groundChokeGiving', overrides: CHOKE_GROUND_SQUEEZE_A, at: [0, -0.3] },
        b: { preset: 'groundChokeTaking', overrides: CHOKE_GROUND_BRIDGE_B, hipHeightM: 0.34, at: [0, -0.2] },
      },
      {
        durationMs: 500,
        a: { preset: 'groundChokeGiving', at: [0, -0.3] },
        b: { preset: 'groundChokeTaking', at: [0, -0.2] },
      },
    ],
  },
}
