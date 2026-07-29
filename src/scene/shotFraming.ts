import * as THREE from 'three'
import { buildJointFrames } from '../figure/jointFrames'
import { getHeightScale, getJointParts } from '../figure/skeleton'
import type { Figure } from '../store/figuresStore'
import type { Vector3Tuple } from './cameraPresets'

/**
 * Enquadramento e ângulo de câmera no vocabulário de fotografia/cinema que o
 * usuário passou (plano geral … plano detalhe; nível dos olhos, contra-picado,
 * picado, vista aérea, holandês, por cima do ombro) — ver DECISOES.md #46.
 *
 * **Três controles independentes, que se compõem.** O TAMANHO DO PLANO decide
 * o que cabe na tela (alvo + distância); o ÂNGULO decide de que altura se
 * olha (só a elevação — o lado de onde a câmera já olhava é preservado, como
 * a tecla `F` já fazia); a LENTE (`lens.ts`) decide a compressão de
 * perspectiva. Trocar de lente reenquadra sem mudar o recorte: a câmera se
 * afasta o quanto for preciso para o mesmo trecho do corpo continuar
 * ocupando a tela — que é justamente o efeito que o item 11 do plano queria
 * tornar previsível.
 *
 * Tudo aqui é puro e medido a partir do esqueleto (`jointFrames.ts`), então
 * acompanha pose, altura e posição do boneco sem depender do `<Canvas>`. Quem
 * move a câmera de verdade continua sendo o `CameraRig.tsx`.
 */

export type ShotKey =
  | 'extremeWide'
  | 'wide'
  | 'fullShot'
  | 'cowboy'
  | 'medium'
  | 'mediumCloseUp'
  | 'closeUp'
  | 'extremeCloseUp'

/** Do mais aberto ao mais fechado — a escada clássica, sem os degraus que faltavam. */
export const SHOT_KEYS: readonly ShotKey[] = [
  'extremeWide',
  'wide',
  'fullShot',
  'cowboy',
  'medium',
  'mediumCloseUp',
  'closeUp',
  'extremeCloseUp',
]

/**
 * Termo em INGLÊS de cada tamanho de plano, como na tabela de referência do
 * usuário. Fora do i18n de propósito: é vocabulário de prompt (o texto que se
 * digita num gerador de imagem), idêntico em qualquer idioma da interface — a
 * tradução vira legenda no botão. Ver DECISOES.md #47.
 */
export const SHOT_TERMS: Record<ShotKey, string> = {
  extremeWide: 'Extreme Wide Shot',
  wide: 'Wide Shot',
  fullShot: 'Full Shot',
  cowboy: 'Cowboy Shot',
  medium: 'Medium Shot',
  mediumCloseUp: 'Medium Close-Up',
  closeUp: 'Close-Up',
  extremeCloseUp: 'Extreme Close-Up',
}

/**
 * Planos que fazem sentido SEM um boneco escolhido: enquadram o conjunto,
 * mirando no ponto médio de todos os bonecos da cena (pedido do usuário, ver
 * DECISOES.md #48). Primeiro plano e plano detalhe ficam de fora de propósito
 * — um close no "meio de todo mundo" é um close no ar entre as pessoas; os
 * demais têm corte definido por um marco que todo boneco tem.
 */
export const GROUP_SHOT_KEYS: readonly ShotKey[] = [
  'extremeWide',
  'wide',
  'fullShot',
  'cowboy',
  'medium',
  'mediumCloseUp',
]

export function isGroupShot(shot: ShotKey): boolean {
  return GROUP_SHOT_KEYS.includes(shot)
}

/**
 * Planos que CORTAM o corpo: o que fica abaixo do corte sai de propósito. Isso
 * muda o enquadramento de conjunto — a caixa que precisa caber é a coluna do
 * tronco de cada boneco, não o corpo inteiro (ver `computeGroupShotView`).
 */
const CROP_SHOTS: readonly ShotKey[] = ['cowboy', 'medium', 'mediumCloseUp']

function isCropShot(shot: ShotKey): boolean {
  return CROP_SHOTS.includes(shot)
}

/**
 * Se um plano pode ser aplicado agora. É a mesma regra que decide o botão
 * habilitado no painel e o comando enviado ao rig — um botão que aceita o
 * clique e não faz nada é pior que um desabilitado.
 */
export function canApplyShot(
  shot: ShotKey | null,
  figureCount: number,
  hasSelection: boolean,
): boolean {
  if (shot === null || figureCount === 0) return false
  return hasSelection || isGroupShot(shot)
}

export type AngleKey = 'eyeLevel' | 'lowAngle' | 'highAngle' | 'birdsEye' | 'wormsEye'

export const ANGLE_KEYS: readonly AngleKey[] = [
  'eyeLevel',
  'lowAngle',
  'highAngle',
  'birdsEye',
  'wormsEye',
]

/** Termo em inglês de cada ângulo, como na tabela de referência (ver `SHOT_TERMS`). */
export const ANGLE_TERMS: Record<AngleKey, string> = {
  eyeLevel: 'Eye-Level',
  lowAngle: 'Low Angle',
  highAngle: 'High Angle',
  birdsEye: "Bird's-Eye View",
  wormsEye: "Worm's-Eye View",
}

/** Termos que não são tamanho de plano, elevação nem altura simples. */
export const OVER_THE_SHOULDER_TERM = 'Over-the-Shoulder'
export const DUTCH_ANGLE_TERM = 'Dutch Angle'
export const POV_TERM = 'POV Shot'
export const TWO_SHOT_TERM = 'Two Shot'
export const REVERSE_ANGLE_TERM = 'Reverse Angle'

/**
 * Elevação da câmera em relação ao ponto enquadrado, em graus. Zero = na
 * altura do que se enquadra (a sensação neutra da tabela); negativo = a
 * câmera fica abaixo olhando para cima (o sujeito fica imponente); positivo =
 * acima olhando para baixo (o sujeito fica vulnerável); 90° = reto de cima.
 *
 * A vista de verme é o espelho da vista aérea, com uma diferença que não é
 * detalhe: o chão existe. Ela pede −90° e o limite do #49 a segura no piso —
 * é assim que "o mais baixo que dá" fica bem definido em vez de enterrado.
 */
export const ANGLE_ELEVATION_DEG: Record<AngleKey, number> = {
  eyeLevel: 0,
  lowAngle: -30,
  highAngle: 30,
  birdsEye: 90,
  wormsEye: -90,
}

/**
 * ALTURA da câmera, uma família diferente da elevação: aqui a câmera FICA
 * naquela altura do boneco e olha para o alvo, em vez de inclinar um ângulo
 * fixo. É a diferença entre "contra-picado de 30°" (que num plano geral mal
 * desce, porque 30° a 20 m já furariam o chão) e "na altura do joelho", que é
 * uma instrução absoluta e dá o mesmo resultado em qualquer distância.
 */
export type CameraHeightKey = 'ground' | 'knee' | 'hip' | 'shoulder'

export const CAMERA_HEIGHT_KEYS: readonly CameraHeightKey[] = ['ground', 'knee', 'hip', 'shoulder']

export const CAMERA_HEIGHT_TERMS: Record<CameraHeightKey, string> = {
  ground: 'Ground Level',
  knee: 'Knee Level',
  hip: 'Hip Level',
  shoulder: 'Shoulder Level',
}

/**
 * Lado de onde a câmera olha, RELATIVO ao boneco — não ao mundo. É o que
 * faltava: até aqui todo plano herdava o lado onde a câmera já estava, e os
 * presets ortográficos são do mundo e trocam a projeção. Com isto, "3/4 de
 * frente em plano médio" vira uma descrição reproduzível, que é o que um
 * turnaround precisa.
 *
 * Qual dos dois lados (esquerda ou direita) fica a cargo de onde a câmera já
 * está — mesmo princípio dos ângulos, que preservam o lado e mudam só a altura.
 */
export type OrientationKey = 'front' | 'threeQuarterFront' | 'profile' | 'threeQuarterBack' | 'back'

export const ORIENTATION_KEYS: readonly OrientationKey[] = [
  'front',
  'threeQuarterFront',
  'profile',
  'threeQuarterBack',
  'back',
]

export const ORIENTATION_TERMS: Record<OrientationKey, string> = {
  front: 'Front View',
  threeQuarterFront: 'Three-Quarter Front',
  profile: 'Profile View',
  threeQuarterBack: 'Three-Quarter Back',
  back: 'Back View',
}

/** Quanto cada vista se afasta da frente do boneco, em graus. */
export const ORIENTATION_YAW_DEG: Record<OrientationKey, number> = {
  front: 0,
  threeQuarterFront: 45,
  profile: 90,
  threeQuarterBack: 135,
  back: 180,
}

/** Termos de composição dentro do quadro. */
export const RULE_OF_THIRDS_TERM = 'Rule of Thirds'
export const LEAD_ROOM_TERM = 'Lead Room'

/**
 * Composição fora do centro. `thirds` sobe o sujeito para o terço de cima (a
 * regra clássica dos olhos no terço superior); `leadRoom` empurra o sujeito
 * para o lado oposto ao que ele olha, abrindo espaço à frente do olhar.
 */
export interface CompositionOptions {
  thirds?: boolean
  leadRoom?: boolean
}

/** Deslocamento da composição, em frações do quadro (um terço = 1/6 do centro). */
const COMPOSITION_SHIFT = 1 / 6

/**
 * Compor fora do centro custa tela: deslocar o quadro em 1/6 exige 1/3 a mais
 * de espaço para que nada do que o plano promete saia pela borda oposta.
 */
const COMPOSITION_SPAN_FACTOR = 1.5

/**
 * Limite da inclinação holandesa. Meia volta não é ângulo holandês, é câmera
 * de cabeça para baixo — e a órbita, que passa a girar em torno do eixo
 * inclinado, fica impraticável muito antes disso.
 */
export const MAX_ROLL_DEG = 45

/** Folga em volta do trecho enquadrado — o sujeito não encosta nas bordas. */
const SHOT_MARGIN = 1.15

/** No plano geral extremo o boneco ocupa esta fração da altura da tela. */
const EXTREME_WIDE_SUBJECT_FRACTION = 0.2

/**
 * No plano geral, esta. É o degrau que faltava entre "minúsculo na paisagem" e
 * "corpo justo": o boneco lido como pessoa, mas com o lugar em volta ainda
 * visível. O corpo justo passou a ser o `fullShot`.
 */
const WIDE_SUBJECT_FRACTION = 0.55

/** Altura enquadrada no plano detalhe, em metros na altura de referência (escala com o boneco). */
const EXTREME_CLOSE_UP_SPAN_M = 0.12

export interface FigureLandmarks {
  /** Ponto mais baixo dos pés, em metros. */
  feetY: number
  kneeY: number
  /** Meio da coxa — onde o plano americano corta. */
  thighY: number
  hipY: number
  waistY: number
  /** Peito, onde o plano peito corta (a junta `chest` do esqueleto). */
  chestY: number
  shouldersY: number
  eyesY: number
  headTopY: number
  thigh: Vector3Tuple
  waist: Vector3Tuple
  chest: Vector3Tuple
  shoulders: Vector3Tuple
  /** Largura dos ombros, em metros — a espessura do tronco para enquadrar sem os braços. */
  shoulderSpanM: number
  eyes: Vector3Tuple
  headTop: Vector3Tuple
  /**
   * Para onde o boneco olha, na horizontal e normalizado. O eixo local +Z é a
   * frente do esqueleto (nariz e olhos ficam em z positivo, `skeleton.ts`), e
   * ele sai da raiz — o quadril, não a cabeça, é quem define para onde o corpo
   * aponta. Cai para +Z do mundo se a pose deixar a raiz olhando reto para
   * cima ou para baixo, quando não há frente horizontal a extrair.
   */
  heading: Vector3Tuple
  /** Para onde a CABEÇA olha, normalizado (com componente vertical) — o eixo do POV. */
  gaze: Vector3Tuple
  /** Centro do corpo inteiro — o alvo dos planos abertos. */
  bodyCenter: Vector3Tuple
  /** Cantos da caixa do corpo no mundo — é o que se junta para enquadrar vários bonecos. */
  bodyMin: Vector3Tuple
  bodyMax: Vector3Tuple
  /** Extensão vertical do corpo na pose atual, em metros. */
  bodyHeightM: number
}

const tuple = (v: THREE.Vector3): Vector3Tuple => [v.x, v.y, v.z]
const point = (t: Vector3Tuple) => new THREE.Vector3(...t)

/** Ponto mais alto das peças de uma junta, no espaço local dela (o ovo da cabeça vai a +0,15). */
function topOfJointParts(jointName: string): number {
  let top = 0
  for (const part of getJointParts(jointName)) {
    const offsetY = part.offset?.[1] ?? 0
    if (part.kind === 'lathe') top = Math.max(top, offsetY + Math.max(...part.profile.map((p) => p.y)))
    else if (part.kind === 'ellipsoid') top = Math.max(top, offsetY + part.radii[1])
    else top = Math.max(top, offsetY + part.size[1] / 2)
  }
  return top
}

/**
 * Marcos do boneco no MUNDO, medidos na pose atual. Os cortes clássicos de
 * enquadramento são todos definidos por eles: o plano médio corta na cintura,
 * o primeiro plano nos ombros, e o alto da cabeça é sempre a borda de cima.
 */
export function figureLandmarks(figure: Figure): FigureLandmarks {
  const { joints } = buildJointFrames(figure)
  const world = (name: string, local?: THREE.Vector3) =>
    (local ?? new THREE.Vector3()).clone().applyMatrix4(joints.get(name)!.matrixWorld)

  const headTop = world('head', new THREE.Vector3(0, topOfJointParts('head'), 0))
  // Altura dos olhos: as peças dos olhos ficam em y local 0,045 (`skeleton.ts`).
  const eyes = world('head', new THREE.Vector3(0, 0.045, 0))
  const shoulders = world('clavicle.L').add(world('clavicle.R')).multiplyScalar(0.5)
  const shoulderSpanM = world('shoulder.L').distanceTo(world('shoulder.R'))
  const waist = world('spine')
  const chest = world('chest')
  const hip = world('hip.L').add(world('hip.R')).multiplyScalar(0.5)
  const knee = world('knee.L').add(world('knee.R')).multiplyScalar(0.5)
  // O plano americano corta no meio da coxa: entre o quadril e o joelho.
  const thigh = hip.clone().add(knee).multiplyScalar(0.5)

  // Frente do corpo: o +Z local da raiz, achatado no plano do chão.
  const heading = new THREE.Vector3(0, 0, 1).transformDirection(joints.get('root')!.matrixWorld)
  heading.y = 0
  if (heading.lengthSq() < 1e-8) heading.set(0, 0, 1)
  heading.normalize()

  // Olhar da cabeça: mantém a componente vertical, senão um POV de quem olha
  // para o chão sairia reto para a frente.
  const gaze = new THREE.Vector3(0, 0, 1).transformDirection(joints.get('head')!.matrixWorld).normalize()

  // Extensão do corpo: caixa de TODAS as juntas (acompanha a pose — um boneco
  // deitado ocupa uma caixa bem diferente de um em pé), estendida até o alto
  // da cabeça, que é geometria além da última junta.
  const box = new THREE.Box3()
  for (const [, group] of joints) box.expandByPoint(group.getWorldPosition(new THREE.Vector3()))
  box.expandByPoint(headTop)

  const feetY = Math.min(world('ball.L').y, world('ball.R').y)
  const bodyCenter = box.getCenter(new THREE.Vector3())

  return {
    feetY,
    kneeY: knee.y,
    thighY: thigh.y,
    hipY: hip.y,
    waistY: waist.y,
    chestY: chest.y,
    shouldersY: shoulders.y,
    eyesY: eyes.y,
    headTopY: headTop.y,
    thigh: tuple(thigh),
    waist: tuple(waist),
    chest: tuple(chest),
    shoulders: tuple(shoulders),
    shoulderSpanM,
    eyes: tuple(eyes),
    headTop: tuple(headTop),
    heading: tuple(heading),
    gaze: tuple(gaze),
    bodyCenter: tuple(bodyCenter),
    bodyMin: tuple(box.min),
    bodyMax: tuple(box.max),
    bodyHeightM: box.max.y - box.min.y,
  }
}

export interface ShotView {
  target: Vector3Tuple
  position: Vector3Tuple
  up: Vector3Tuple
  distance: number
}

/** Alvo e altura enquadrada de cada tamanho de plano. */
function shotFrame(
  figure: Figure,
  shot: ShotKey,
  selectedJoint: string | null,
  marks: FigureLandmarks,
): { target: THREE.Vector3; spanM: number } {
  const midpoint = (a: Vector3Tuple, b: Vector3Tuple) => point(a).add(point(b)).multiplyScalar(0.5)

  /** Corte clássico: da borda de baixo ao alto da cabeça, centrado no meio. */
  const cutAt = (low: Vector3Tuple) => ({
    target: midpoint(low, marks.headTop),
    spanM: point(marks.headTop).distanceTo(point(low)) * SHOT_MARGIN,
  })

  switch (shot) {
    case 'extremeWide':
      return {
        target: point(marks.bodyCenter),
        spanM: marks.bodyHeightM / EXTREME_WIDE_SUBJECT_FRACTION,
      }
    case 'wide':
      // O plano geral mostra o boneco NO ambiente: ele ocupa pouco mais da
      // metade da tela, e o resto é onde ele está. O corpo justo é o `fullShot`.
      return {
        target: point(marks.bodyCenter),
        spanM: marks.bodyHeightM / WIDE_SUBJECT_FRACTION,
      }
    case 'fullShot':
      return { target: point(marks.bodyCenter), spanM: marks.bodyHeightM * SHOT_MARGIN }
    case 'cowboy':
      return cutAt(marks.thigh)
    case 'medium':
      return cutAt(marks.waist)
    case 'mediumCloseUp':
      return cutAt(marks.chest)
    case 'closeUp':
      return cutAt(marks.shoulders)
    case 'extremeCloseUp': {
      // O "detalhe" da tabela é a junta selecionada — é o que este app tem de
      // específico para apontar. Sem junta escolhida, o detalhe é o rosto.
      const { joints } = buildJointFrames(figure)
      const group = selectedJoint ? joints.get(selectedJoint) : undefined
      const target = group ? group.getWorldPosition(new THREE.Vector3()) : point(marks.eyes)
      return { target, spanM: EXTREME_CLOSE_UP_SPAN_M * getHeightScale(figure.height) }
    }
  }
}

/** Distância que faz um trecho de `spanM` metros ocupar a altura da tela com o FOV dado. */
export function distanceForSpan(spanM: number, fovDeg: number): number {
  return spanM / 2 / Math.tan((fovDeg * Math.PI) / 360)
}

/**
 * Vetor "para cima" da câmera com a inclinação holandesa aplicada: o topo do
 * mundo girado em torno do próprio eixo de visão. Sempre perpendicular à
 * direção de visão — inclusive quando a câmera olha reto para baixo, caso em
 * que o topo do mundo não serve de referência.
 */
export function rollUpVector(direction: Vector3Tuple, rollDeg: number): Vector3Tuple {
  const axis = new THREE.Vector3(...direction).normalize()
  const worldUp = new THREE.Vector3(0, 1, 0)
  // Componente do topo do mundo perpendicular à visão. Colinear (olhando reto
  // para cima/baixo) cai para -Z, a mesma referência de "topo da tela" que o
  // preset ortográfico de topo já usa.
  const up = worldUp.clone().addScaledVector(axis, -worldUp.dot(axis))
  if (up.lengthSq() < 1e-8) up.set(0, 0, -1).addScaledVector(axis, -new THREE.Vector3(0, 0, -1).dot(axis))
  up.normalize()
  if (rollDeg !== 0) up.applyAxisAngle(axis, THREE.MathUtils.degToRad(rollDeg))
  return tuple(up)
}

/**
 * Tudo que decide uma vista, além do tamanho do plano. Virou objeto quando os
 * controles passaram de três: com altura, orientação e composição, uma lista
 * posicional de doze argumentos não se lê mais.
 */
export interface ShotRequest {
  shot: ShotKey
  fovDeg: number
  /**
   * Direção de onde a câmera olha hoje (do alvo para a câmera). Dela sai só o
   * AZIMUTE, e só quando não há `orientation` — é o que preserva o lado que o
   * usuário escolheu quando ele mexe apenas na altura.
   */
  fromDirection: Vector3Tuple
  angle?: AngleKey
  /** Altura fixa da câmera. Quando presente, manda na elevação e ignora o `angle`. */
  cameraHeight?: CameraHeightKey | null
  /** Lado relativo ao boneco. Quando presente, manda no azimute. */
  orientation?: OrientationKey | null
  selectedJoint?: string | null
  rollDeg?: number
  thirds?: boolean
  leadRoom?: boolean
  /** Proporção da tela (largura/altura) — só pesa onde há caixa a caber. */
  aspect?: number
}

/** O que sobra do pedido depois de resolvido contra os marcos do boneco. */
interface Vantage {
  azimuth: number
  angle: AngleKey
  heightY: number | null
  rollDeg: number
  aspect: number
  thirds: boolean
  leadRoom: boolean
  /** Para onde o sujeito olha — o `leadRoom` abre espaço desse lado. */
  heading: THREE.Vector3 | null
  /** Quanto a câmera precisa se afastar do eixo do corpo para ficar fora dele. */
  clearanceM: number
}

/** Azimute (giro em torno da vertical) da direção de onde a câmera olha. */
function azimuthOf(fromDirection: Vector3Tuple): number {
  const flat = new THREE.Vector2(fromDirection[0], fromDirection[2])
  return flat.lengthSq() < 1e-8 ? 0 : Math.atan2(flat.x, flat.y)
}

/** Diferença de ângulos trazida para (−π, π]. */
function wrapAngle(angle: number): number {
  const wrapped = (angle + Math.PI) % (2 * Math.PI)
  return (wrapped < 0 ? wrapped + 2 * Math.PI : wrapped) - Math.PI
}

/**
 * Azimute de uma vista relativa ao boneco. O giro sai da FRENTE dele, e o lado
 * (esquerda ou direita) do lugar onde a câmera já está — pedir "perfil" de quem
 * está à direita do boneco dá o perfil direito, não um lado sorteado.
 */
export function orientationAzimuth(
  heading: Vector3Tuple,
  orientation: OrientationKey,
  fromDirection: Vector3Tuple,
): number {
  const frontAzimuth = azimuthOf(heading)
  const side = wrapAngle(azimuthOf(fromDirection) - frontAzimuth) >= 0 ? 1 : -1
  return frontAzimuth + side * THREE.MathUtils.degToRad(ORIENTATION_YAW_DEG[orientation])
}

/** Altura de câmera pedida, em metros no mundo. */
function cameraHeightY(marks: readonly FigureLandmarks[], key: CameraHeightKey): number {
  if (key === 'ground') return GROUND_Y
  const alturas = marks.map((mark) =>
    key === 'knee' ? mark.kneeY : key === 'hip' ? mark.hipY : mark.shouldersY,
  )
  return alturas.reduce((soma, valor) => soma + valor, 0) / alturas.length
}

/** Junta o pedido com os marcos medidos: daqui para baixo é só geometria. */
function resolveVantage(request: ShotRequest, marks: readonly FigureLandmarks[]): Vantage {
  // Frente do conjunto: a soma das frentes. Bonecos virados um para o outro se
  // cancelam, e aí não há "frente do grupo" — fica o lado onde a câmera está.
  const heading = new THREE.Vector3()
  for (const mark of marks) heading.add(point(mark.heading))
  const hasHeading = heading.lengthSq() > 1e-6
  if (hasHeading) heading.normalize()

  return {
    azimuth:
      request.orientation && hasHeading
        ? orientationAzimuth(tuple(heading), request.orientation, request.fromDirection)
        : azimuthOf(request.fromDirection),
    angle: request.angle ?? 'eyeLevel',
    heightY: request.cameraHeight ? cameraHeightY(marks, request.cameraHeight) : null,
    rollDeg: request.rollDeg ?? 0,
    aspect: request.aspect ?? 1,
    thirds: request.thirds ?? false,
    leadRoom: request.leadRoom ?? false,
    heading: hasHeading ? heading : null,
    clearanceM: Math.max(...marks.map((mark) => mark.shoulderSpanM)),
  }
}

/**
 * Onde a câmera vai parar para um pedido de plano, sobre o boneco selecionado.
 */
export function computeShotView(figure: Figure, request: ShotRequest): ShotView {
  const marks = figureLandmarks(figure)
  const { target, spanM } = shotFrame(figure, request.shot, request.selectedJoint ?? null, marks)
  return viewFromTarget(target, spanM, resolveVantage(request, [marks]), request.fovDeg)
}

/**
 * Caixa que precisa caber na tela inteira, quando há uma. `vertical` fica falso
 * nos planos que cortam de propósito (o plano médio corta na cintura).
 */
interface FitBox {
  box: THREE.Box3
  aspect: number
  vertical: boolean
}

/** Folga em volta da caixa que tem de caber — cobre a geometria que passa das juntas (mãos, pés). */
const FIT_MARGIN = 1.05

/**
 * Menor distância que põe a caixa inteira dentro do tronco de visão, levando a
 * perspectiva em conta: um boneco mais PERTO da câmera ocupa mais tela que um
 * no plano do alvo, então medir a largura no plano do alvo deixa quem está na
 * frente para fora do quadro.
 *
 * Para um ponto `q` medido a partir do alvo, a profundidade cresce junto com a
 * distância (`q·visão + d`) enquanto o afastamento lateral (`q·direita`) não
 * depende dela — daí sai direto o `d` mínimo de cada canto, sem iterar.
 */
function fitDistance(
  target: THREE.Vector3,
  direction: THREE.Vector3,
  up: THREE.Vector3,
  fovDeg: number,
  fit: FitBox,
): number {
  const view = direction.clone().negate()
  const right = view.clone().cross(up).normalize()
  const tanV = Math.tan((fovDeg * Math.PI) / 360)
  const tanH = tanV * fit.aspect

  const center = fit.box.getCenter(new THREE.Vector3())
  const half = fit.box.getSize(new THREE.Vector3()).multiplyScalar(FIT_MARGIN / 2)

  let distance = 0
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const q = new THREE.Vector3(
          center.x + sx * half.x,
          center.y + sy * half.y,
          center.z + sz * half.z,
        ).sub(target)
        const depth = q.dot(view)
        distance = Math.max(distance, Math.abs(q.dot(right)) / tanH - depth)
        if (fit.vertical) distance = Math.max(distance, Math.abs(q.dot(up)) / tanV - depth)
      }
    }
  }
  return distance
}

/** Altura do chão da cena. A câmera não desce abaixo dele (pedido do usuário, #49). */
const GROUND_Y = 0

/** Direção do alvo para a câmera, a partir do azimute e da elevação. */
function directionFor(azimuth: number, elevation: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ).normalize()
}

/**
 * Elevação possível sem enterrar a câmera. Quanto mais longe ela está, mais
 * fundo os mesmos 30° de contra-picado a levam — num primeiro plano os 30°
 * cabem inteiros, num plano geral a câmera pararia bem abaixo do piso, olhando
 * o boneco por baixo do chão. Aqui ela só desce até o chão: o contra-picado
 * continua sendo um contra-picado, com o ângulo que couber.
 */
function elevationAboveGround(elevation: number, targetY: number, distance: number): number {
  if (elevation >= 0 || distance <= 0) return elevation
  const lowest = (GROUND_Y - targetY) / distance
  // Alvo tão alto (ou câmera tão perto) que nem apontando para baixo ela chega ao chão.
  if (lowest <= -1) return elevation
  return Math.max(elevation, Math.asin(Math.min(1, lowest)))
}

/**
 * Elevação pedida antes do limite do chão. Uma ALTURA de câmera é uma instrução
 * absoluta — "fique na altura do joelho" — e a elevação que a realiza depende
 * da distância; um ÂNGULO é a própria elevação, e não depende de nada.
 */
function nominalElevation(vantage: Vantage, targetY: number, distance: number): number {
  if (vantage.heightY === null) return THREE.MathUtils.degToRad(ANGLE_ELEVATION_DEG[vantage.angle])
  if (distance <= 0) return 0
  // O `clamp` é o caso em que a altura pedida não CABE na distância do plano:
  // um primeiro plano do rosto fica a 70 cm dele, e o chão está a um metro e
  // meio abaixo — não há ângulo que ponha a câmera no piso sem afastá-la, e
  // afastar desmancharia o plano. Aí ela vai reto para baixo, o mais perto da
  // altura pedida que a geometria deixa. É o mesmo princípio do #49: limita-se
  // a vista, nunca o enquadramento.
  return Math.asin(THREE.MathUtils.clamp((vantage.heightY - targetY) / distance, -1, 1))
}

/**
 * Alvo deslocado pela composição. Mover o alvo move o sujeito para o lado
 * CONTRÁRIO no quadro: para o sujeito subir para o terço de cima, o alvo desce.
 *
 * O espaço à frente do olhar acompanha o quanto o boneco está de perfil — de
 * frente para a câmera não há lado para onde abrir espaço, e o deslocamento é
 * naturalmente zero, sem precisar de caso especial.
 */
function composedTarget(
  base: THREE.Vector3,
  direction: THREE.Vector3,
  up: THREE.Vector3,
  distance: number,
  fovDeg: number,
  vantage: Vantage,
): THREE.Vector3 {
  if (!vantage.thirds && !vantage.leadRoom) return base

  const frameHeight = 2 * distance * Math.tan((fovDeg * Math.PI) / 360)
  const target = base.clone()

  if (vantage.thirds) target.addScaledVector(up, -frameHeight * COMPOSITION_SHIFT)

  if (vantage.leadRoom && vantage.heading) {
    const right = direction.clone().negate().cross(up).normalize()
    const olhar = vantage.heading.dot(right)
    target.addScaledVector(right, frameHeight * vantage.aspect * COMPOSITION_SHIFT * olhar)
  }
  return target
}

/** Posição, alvo e topo da tela para enquadrar `spanM` metros de altura em torno de `base`. */
function viewFromTarget(
  base: THREE.Vector3,
  spanM: number,
  vantage: Vantage,
  fovDeg: number,
  fit?: FitBox,
): ShotView {
  const composed = vantage.thirds || vantage.leadRoom
  const fromShot = distanceForSpan(spanM * (composed ? COMPOSITION_SPAN_FACTOR : 1), fovDeg)

  /**
   * Uma ALTURA de câmera só é alcançável se a câmera couber entre o alvo e
   * aquela altura — e ainda sobrar afastamento para ela não ficar DENTRO do
   * boneco. Com uma grande angular, o plano médio fica a menos de um metro do
   * corpo, e "descer o máximo possível" acabava enfiando a câmera na pelve.
   *
   * Aqui a distância tem um piso: o suficiente para a câmera chegar à altura
   * pedida passando a pelo menos uma largura de ombros do eixo do corpo. É a
   * única troca em que a altura vence o tamanho do plano, e vence pouco — o
   * plano só afrouxa o mínimo necessário. Diferente do limite do chão (#49),
   * onde não havia como entregar as duas coisas e o enquadramento venceu:
   * aqui há, e uma vista de dentro do boneco não serve para nada.
   */
  const fromHeight =
    vantage.heightY === null ? 0 : Math.hypot(base.y - vantage.heightY, vantage.clearanceM)
  const spanDistance = Math.max(fromShot, fromHeight)

  const upFor = (direction: THREE.Vector3) =>
    point(rollUpVector(tuple(direction.clone().negate()), vantage.rollDeg))
  /** Elevação já limitada pelo chão, para o alvo e a distância do momento. */
  const settle = (targetY: number, distance: number) =>
    elevationAboveGround(nominalElevation(vantage, targetY, distance), targetY, distance)

  let distance = spanDistance
  let target = base

  // Tudo aqui se puxa: a distância decide o quanto a câmera pode inclinar para
  // baixo sem furar o chão e onde a composição desloca o alvo, e alvo e
  // inclinação novos podem pedir outra distância. Repetir converge rápido
  // porque cada passada só SOBE a câmera; sem caixa a caber e sem composição, a
  // primeira passada já é exata.
  for (let passada = 0; passada < 5; passada += 1) {
    const direction = directionFor(vantage.azimuth, settle(target.y, distance))
    const up = upFor(direction)
    target = composedTarget(base, direction, up, distance, fovDeg, vantage)

    const proxima = fit
      ? Math.max(spanDistance, fitDistance(target, direction, up, fovDeg, fit))
      : spanDistance
    const estavel = Math.abs(proxima - distance) < 1e-9
    distance = proxima
    if (estavel) break
  }

  // Aperto final do limite do chão contra o alvo e a distância JÁ fechados — é
  // ele que garante a câmera no piso ou acima dele, sem depender da convergência.
  const direction = directionFor(vantage.azimuth, settle(target.y, distance))
  const position = target.clone().addScaledVector(direction, distance)
  return {
    target: tuple(target),
    position: tuple(position),
    up: tuple(upFor(direction)),
    distance,
  }
}

/**
 * Enquadramento do CONJUNTO, para quando não há boneco selecionado: o alvo é o
 * ponto médio de todos os bonecos da cena e a câmera recua o quanto for preciso
 * para caberem todos. Devolve `null` quando não há bonecos ou quando o plano
 * pedido não faz sentido para um conjunto (`GROUP_SHOT_KEYS`).
 *
 * **A largura entra na conta aqui, e não no enquadramento individual.** A
 * distância sai da ALTURA enquadrada, porque o `fov` do three.js é vertical — e
 * a altura de um grupo não diz nada sobre a largura dele: quatro bonecos lado a
 * lado têm a altura de um só. Por isso a caixa do conjunto também tem de caber
 * no quadro (`fitDistance`), e vence a maior das duas distâncias. No
 * enquadramento individual isso não se aplica: um primeiro plano teria de saber
 * a largura do ROSTO, não a do corpo inteiro, e a caixa disponível é a do corpo.
 */
export function computeGroupShotView(
  figures: readonly Figure[],
  request: ShotRequest,
): ShotView | null {
  const { shot } = request
  if (figures.length === 0 || !isGroupShot(shot)) return null

  const marks = figures.map(figureLandmarks)
  const box = new THREE.Box3()
  if (isCropShot(shot)) {
    // Os planos que cortam cortam os braços abertos pelo mesmo motivo que
    // cortam as pernas. O que não pode faltar é o TRONCO de cada um, então a
    // caixa é a coluna de cada boneco: do corte à cabeça, com a largura dos
    // ombros. Com a caixa do corpo inteiro, três bonecos de braços abertos
    // empurrariam a câmera para trás e o "plano médio" sairia igual ao geral.
    for (const mark of marks) {
      const half = mark.shoulderSpanM / 2
      const corte = shot === 'cowboy' ? mark.thigh : shot === 'medium' ? mark.waist : mark.chest
      for (const p of [corte, mark.headTop]) {
        box.expandByPoint(new THREE.Vector3(p[0] - half, p[1], p[2] - half))
        box.expandByPoint(new THREE.Vector3(p[0] + half, p[1], p[2] + half))
      }
    }
  } else {
    for (const mark of marks) {
      box.expandByPoint(point(mark.bodyMin))
      box.expandByPoint(point(mark.bodyMax))
    }
  }

  const target = box.getCenter(new THREE.Vector3())
  const heightM = box.max.y - box.min.y
  const multiplier =
    shot === 'extremeWide'
      ? 1 / EXTREME_WIDE_SUBJECT_FRACTION
      : shot === 'wide'
        ? 1 / WIDE_SUBJECT_FRACTION
        : SHOT_MARGIN

  return viewFromTarget(target, heightM * multiplier, resolveVantage(request, marks), request.fovDeg, {
    box,
    aspect: request.aspect ?? 1,
    // Os planos que cortam cortam de propósito na vertical; na horizontal, não
    // — os bonecos das pontas têm de aparecer.
    vertical: !isCropShot(shot),
  })
}

/**
 * Vista de dois bonecos: o mesmo enquadramento de conjunto, restrito ao par.
 * É o "two shot" da linguagem de cinema — a conversa entre duas pessoas —, e
 * aqui ele é o par formado pelo boneco selecionado e o mais próximo dele.
 */
export function twoShotPair(figures: readonly Figure[], selectedId: string | null): Figure[] | null {
  const anchor = figures.find((figure) => figure.id === selectedId)
  if (!anchor || figures.length < 2) return null

  const anchorAt = point(figureLandmarks(anchor).bodyCenter)
  let nearest: Figure | null = null
  let nearestDistance = Infinity
  for (const candidate of figures) {
    if (candidate.id === anchor.id) continue
    const gap = anchorAt.distanceTo(point(figureLandmarks(candidate).bodyCenter))
    if (gap < nearestDistance) {
      nearestDistance = gap
      nearest = candidate
    }
  }
  return nearest ? [anchor, nearest] : null
}

/**
 * De que lado olhar um par para que os DOIS apareçam. Sem isto, um two shot
 * feito do eixo em que os bonecos estão alinhados põe um atrás do outro: cabem
 * no quadro (a conferência garante isso) e mesmo assim só se vê um.
 *
 * A direção sai perpendicular à linha que liga os dois, do lado em que a câmera
 * já está — o mesmo princípio dos ângulos, que preservam o lado escolhido.
 * Bonecos no mesmo lugar não definem linha nenhuma, e aí fica como estava.
 */
export function twoShotDirection(
  pair: readonly Figure[],
  fromDirection: Vector3Tuple,
): Vector3Tuple {
  if (pair.length < 2) return fromDirection
  const eixo = point(figureLandmarks(pair[1]).bodyCenter).sub(point(figureLandmarks(pair[0]).bodyCenter))
  eixo.y = 0
  if (eixo.lengthSq() < 1e-6) return fromDirection

  eixo.normalize()
  const lado = new THREE.Vector3(eixo.z, 0, -eixo.x)
  if (lado.dot(point(fromDirection)) < 0) lado.negate()
  return tuple(lado)
}

/** Fração da altura do boneco que a câmera de POV avança à frente dos olhos. */
const POV_FORWARD = 0.09

/**
 * Vista subjetiva: a câmera nos olhos do boneco, olhando para onde a CABEÇA
 * aponta — o pescoço pode estar torcido em relação ao corpo, e é o olhar que
 * define um POV.
 *
 * A câmera avança alguns centímetros à frente dos olhos em vez de nascer
 * exatamente neles. Ficar dentro da cabeça mostraria o avesso da geometria, e a
 * alternativa — esconder o boneco — mexeria no `visible`, que é conteúdo, entra
 * no undo e sobreviveria ao preset. Um passo à frente resolve sem efeito
 * colateral nenhum.
 */
export function computePovView(figure: Figure, rollDeg = 0): ShotView {
  const marks = figureLandmarks(figure)
  const gaze = point(marks.gaze).normalize()
  const position = point(marks.eyes).addScaledVector(gaze, POV_FORWARD * figure.height)
  // Um alvo à frente do olhar: distância arbitrária, porque o que importa numa
  // vista subjetiva é a direção — o alvo só existe para o controle de órbita.
  const distance = 2 * figure.height
  const target = position.clone().addScaledVector(gaze, distance)

  return {
    target: tuple(target),
    position: tuple(position),
    up: rollUpVector(tuple(gaze), rollDeg),
    distance,
  }
}

/** Deslocamento lateral da câmera atrás do ombro, em metros (fração da altura do boneco). */
const OVER_SHOULDER_SIDE = 0.22
/** Recuo atrás da cabeça de quem está em primeiro plano, em metros. */
const OVER_SHOULDER_BACK = 0.35

/**
 * Vista "por cima do ombro": a câmera fica atrás e ao lado da cabeça de um
 * boneco, olhando para a cabeça do outro. Diferente dos demais, este preset
 * resolve posição E distância sozinho — a distância é a que os dois bonecos
 * já têm entre si, e forçar um tamanho de plano por cima disso desmancharia o
 * enquadramento. Devolve `null` quando as duas cabeças estão no mesmo lugar
 * (não há direção de olhar a definir).
 */
export function computeOverTheShoulderView(near: Figure, far: Figure, rollDeg = 0): ShotView | null {
  const nearHead = new THREE.Vector3(...figureLandmarks(near).headTop)
  const farHead = new THREE.Vector3(...figureLandmarks(far).headTop)

  const look = farHead.clone().sub(nearHead)
  look.y = 0
  if (look.lengthSq() < 1e-6) return null
  look.normalize()

  const side = new THREE.Vector3(0, 1, 0).cross(look).normalize()
  const scale = near.height
  const position = nearHead
    .clone()
    .addScaledVector(look, -OVER_SHOULDER_BACK * scale)
    .addScaledVector(side, OVER_SHOULDER_SIDE * scale)

  const target = farHead
  const direction = target.clone().sub(position)
  return {
    target: tuple(target),
    position: tuple(position),
    up: rollUpVector(tuple(direction), rollDeg),
    distance: direction.length(),
  }
}
