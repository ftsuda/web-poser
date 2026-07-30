import { JOINT_NAMES, clampJointRotation, type JointRotation } from '../figure/skeleton'
import { withLegacyIndexFinger } from '../figure/poseCompat'
import type { CameraViewState } from '../scene/cameraMove'
import { slugifySceneName } from '../snapshot/snapshotNaming'
import { DEFAULT_FIGURE_COLOR, normalizeFigureColor, type Figure } from '../store/figuresStore'
import { MAX_HEIGHT_M, MIN_HEIGHT_M, REFERENCE_HEIGHT_M } from '../figure/skeleton'

/**
 * Modelo de dados do mini animador (PLANO.md > "Mini animador", DECISOES.md
 * #52). Um keyframe é um retrato completo da cena: todos os bonecos (pose,
 * colocação, altura, cor, visibilidade) mais a câmera viva, e a duração da
 * transição que CHEGA até ele.
 *
 * **Por que a duração é a da chegada, e não a da saída.** É o que casa com o
 * jeito de montar: posa-se a cena, aponta-se a câmera, captura-se o keyframe e
 * diz-se em quanto tempo se chega até ali. Com a duração "até o próximo", todo
 * keyframe novo obrigaria a voltar e editar o anterior.
 *
 * A duração do PRIMEIRO keyframe não tem trecho para onde ir e é ignorada pela
 * linha do tempo — mas continua guardada, porque reordenar não pode perder o
 * valor de um keyframe que passou a ser o primeiro e depois volta a não ser.
 */

export interface AnimationKeyframe {
  id: string
  /** Duração, em ms, da transição que CHEGA a este keyframe. Ignorada no primeiro. */
  durationMs: number
  /** Bonecos inteiros — pose, colocação, altura, cor e visibilidade. */
  figures: Figure[]
  /** Câmera viva: posição, alvo, topo da tela e lente — o `CameraViewState` do movimento (#46). */
  camera: CameraViewState
  /**
   * Rótulo do GRUPO a que este keyframe pertence (item 38) — "Andando 1",
   * "Pulando"… Keyframes CONSECUTIVOS com o mesmo rótulo formam um grupo, que
   * o painel mostra sob um cabeçalho recolhível e a régua marca como faixa.
   *
   * O grupo é uma leitura da lista, não um objeto à parte: não há faixa a
   * manter consistente a cada inserir/mover/remover keyframe. Em troca, o mesmo
   * rótulo não pode aparecer em dois trechos separados (seriam dois blocos com
   * o mesmo título, justamente a confusão que o item existe para tirar) — quem
   * garante isso é `uniqueKeyframeLabel`.
   */
  label?: string
}

export interface Animation {
  id: string
  name: string
  keyframes: AnimationKeyframe[]
  /**
   * Redutor/acelerador de toda a linha do tempo: 0,5 toca na metade da
   * velocidade, 1,15 toca 15% mais rápido. Ver `clampAnimationSpeed`.
   */
  speed: number
}

/**
 * Id reservado da **animação de trabalho** — a "default" (PLANO.md > lista de
 * propostas, item 36). Capturar o primeiro keyframe sem animação nenhuma cria
 * esta aqui sozinha, para que ninguém precise batizar uma animação antes de
 * começar a montá-la.
 *
 * Ela é uma animação como qualquer outra: entra no undo, no autosave e no
 * `animations.json` desde o primeiro keyframe. O que o id reservado distingue é
 * o PAPEL — é a que está na bancada. As demais são a biblioteca: cópias
 * nomeadas, guardadas para reabrir depois, e reabrir **substitui** a de
 * trabalho (mesmo contrato dos snapshots de cena, DECISOES.md #11).
 *
 * Por não casar com `^animation-(\d+)$`, o id fica fora da contagem que gera os
 * ids da biblioteca — nenhuma animação salva pode colidir com ele.
 */
export const WORKING_ANIMATION_ID = 'working'

/** Nome inicial da animação de trabalho — vira o nome do MP4, e é editável no painel. */
export const WORKING_ANIMATION_NAME = 'Animation'

export const MIN_KEYFRAME_DURATION_MS = 1
/** Dez minutos por trecho — teto de sanidade, não limite de uso real. */
export const MAX_KEYFRAME_DURATION_MS = 600_000
export const DEFAULT_KEYFRAME_DURATION_MS = 1000

/** A animação de trabalho de uma lista, ou `null` enquanto ninguém capturou nada. */
export function findWorkingAnimation(animations: readonly Animation[]): Animation | null {
  return animations.find((animation) => animation.id === WORKING_ANIMATION_ID) ?? null
}

/** As animações da biblioteca — todas menos a de trabalho. */
export function savedAnimations(animations: readonly Animation[]): Animation[] {
  return animations.filter((animation) => animation.id !== WORKING_ANIMATION_ID)
}

/** Uma animação de trabalho vazia, no estado em que a primeira captura a encontra. */
export function createWorkingAnimation(): Animation {
  return {
    id: WORKING_ANIMATION_ID,
    name: WORKING_ANIMATION_NAME,
    speed: DEFAULT_ANIMATION_SPEED,
    keyframes: [],
  }
}

/** Grampeia a duração digitada; o que não for número cai no padrão, em vez de virar `NaN` na linha do tempo. */
export function clampKeyframeDuration(durationMs: unknown): number {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs)) return DEFAULT_KEYFRAME_DURATION_MS
  return Math.min(MAX_KEYFRAME_DURATION_MS, Math.max(MIN_KEYFRAME_DURATION_MS, Math.round(durationMs)))
}

/** Duração total, em ms — a soma das transições, ignorando a do primeiro keyframe. */
export function animationDurationMs(animation: Animation): number {
  return animation.keyframes.slice(1).reduce((total, keyframe) => total + keyframe.durationMs, 0)
}

// ---------------------------------------------------------------------------
// Velocidade (redutor/acelerador global)
// ---------------------------------------------------------------------------

export const MIN_ANIMATION_SPEED = 0.1
export const MAX_ANIMATION_SPEED = 5
export const DEFAULT_ANIMATION_SPEED = 1
/** Passo do campo, e a grade em que o valor é arredondado — duas casas decimais. */
export const ANIMATION_SPEED_STEP = 0.05

/**
 * Grampeia o multiplicador de velocidade digitado.
 *
 * **É multiplicador de velocidade, não de duração**: 0,5 é meia velocidade (o
 * vídeo fica o DOBRO de comprido) e 1,15 é 15% mais rápido (o vídeo fica
 * `1/1,15` ≈ 87% do comprimento). Por isso a duração de saída divide, e não
 * multiplica.
 *
 * O valor é arredondado à grade de 0,05 para que o que se lê no campo seja
 * exatamente o que entra na conta — digitar 1,13 e exportar como 1,13 daria um
 * número que o campo (de duas casas) não sabe mostrar de volta.
 */
export function clampAnimationSpeed(speed: unknown): number {
  if (typeof speed !== 'number' || Number.isNaN(speed)) return DEFAULT_ANIMATION_SPEED
  const stepped = Math.round(speed / ANIMATION_SPEED_STEP) * ANIMATION_SPEED_STEP
  const clamped = Math.min(MAX_ANIMATION_SPEED, Math.max(MIN_ANIMATION_SPEED, stepped))
  // Sem este arredondamento final, `23 × 0,05` sairia 1.1500000000000001 e o
  // campo mostraria um número que o usuário não digitou.
  return Math.round(clamped * 100) / 100
}

/**
 * Quanto o vídeo vai durar, em ms: a linha do tempo dividida pela velocidade.
 *
 * A linha do tempo em si **não muda** — os keyframes continuam nos mesmos
 * instantes, e as durações digitadas em cada card continuam valendo o que
 * dizem. A velocidade é a taxa com que se anda por ela, na reprodução e na
 * exportação.
 */
export function animationOutputDurationMs(animation: Animation): number {
  return animationDurationMs(animation) / clampAnimationSpeed(animation.speed)
}

/** Nome do arquivo de vídeo de uma animação, com a mesma sanitização do instantâneo. */
export function formatAnimationFilename(animationName: string): string {
  return `${slugifySceneName(animationName)}.mp4`
}

/** Instante de cada keyframe na linha do tempo, começando em zero. */
export function keyframeStartTimesMs(animation: Animation): number[] {
  const times: number[] = []
  let elapsed = 0
  animation.keyframes.forEach((keyframe, index) => {
    if (index > 0) elapsed += keyframe.durationMs
    times.push(elapsed)
  })
  return times
}

/**
 * Onde a linha do tempo para depois de `deltaMs` de relógio (item 27).
 *
 * Sem laço, chegar ao fim PARA — repetir sozinho esconderia onde a animação
 * termina, e é por isso que a reprodução nasceu assim (DECISOES.md #52). Com
 * laço, o excedente volta para o começo em vez de ser jogado fora: um ciclo de
 * caminhada emenda no mesmo passo em que estava, sem engasgo a cada volta.
 *
 * O laço é só da reprodução na tela — o arquivo exportado continua com uma
 * passada só.
 */
export function advancePlayheadMs(
  currentMs: number,
  deltaMs: number,
  totalMs: number,
  repeat: boolean,
): { timeMs: number; ended: boolean } {
  // Sem linha do tempo não há o que percorrer, nem com laço.
  if (!(totalMs > 0)) return { timeMs: 0, ended: true }

  const raw = Math.max(0, currentMs) + Math.max(0, deltaMs)
  if (raw < totalMs) return { timeMs: raw, ended: false }
  if (!repeat) return { timeMs: totalMs, ended: true }
  // `raw % totalMs` mantém o passo constante mesmo se um quadro lento pular a
  // volta inteira.
  return { timeMs: raw % totalMs, ended: false }
}

// ---------------------------------------------------------------------------
// Grupos rotulados de keyframes (item 38)
// ---------------------------------------------------------------------------

/** Uma sequência de keyframes consecutivos com o mesmo rótulo. */
export interface KeyframeGroup {
  label: string
  /** Índices do primeiro e do último keyframe do grupo, inclusive. */
  startIndex: number
  endIndex: number
  /** Instante em que o grupo começa e termina na linha do tempo. */
  startMs: number
  endMs: number
}

/**
 * Os grupos de uma animação, na ordem da lista. Só entram os keyframes
 * ROTULADOS: o resto da linha do tempo continua sendo uma lista solta, e é isso
 * que permite rotular só o que interessa.
 *
 * O grupo termina no instante do keyframe seguinte ao último dele (ou no fim da
 * linha do tempo): a transição que sai do último keyframe do grupo ainda é
 * parte do movimento que o grupo nomeia.
 */
export function keyframeGroups(animation: Animation): KeyframeGroup[] {
  const starts = keyframeStartTimesMs(animation)
  const total = animationDurationMs(animation)
  const groups: KeyframeGroup[] = []

  animation.keyframes.forEach((keyframe, index) => {
    const label = keyframe.label?.trim()
    if (!label) return

    const last = groups[groups.length - 1]
    // Só emenda no grupo anterior se for o keyframe IMEDIATAMENTE seguinte:
    // dois trechos separados com o mesmo rótulo continuam sendo dois grupos.
    if (last && last.label === label && last.endIndex === index - 1) {
      last.endIndex = index
      last.endMs = index + 1 < starts.length ? starts[index + 1] : total
      return
    }

    groups.push({
      label,
      startIndex: index,
      endIndex: index,
      startMs: starts[index],
      endMs: index + 1 < starts.length ? starts[index + 1] : total,
    })
  })

  return groups
}

/**
 * O rótulo que o keyframe `index` pode de fato receber (item 38): o desejado,
 * ou ele com um sufixo numérico quando já existe em OUTRO trecho da linha do
 * tempo — dois trechos de caminhada viram "Andando 1" e "Andando 2".
 *
 * Repetir o mesmo nome não remonta um grupo partido: o que sairia são dois
 * blocos separados com o mesmo título. Estender o grupo vizinho, sim, é
 * legítimo — por isso o rótulo é aceito quando os keyframes que já o usam
 * ficam grudados neste.
 */
export function uniqueKeyframeLabel(
  keyframes: readonly AnimationKeyframe[],
  index: number,
  desired: string,
): string {
  const wanted = desired.trim()
  if (wanted === '') return ''

  const contiguousWith = (label: string): boolean => {
    const used = keyframes
      .map((keyframe, position) => ({ position, label: keyframe.label?.trim() ?? '' }))
      .filter((entry) => entry.label === label && entry.position !== index)
      .map((entry) => entry.position)
    if (used.length === 0) return true

    const min = Math.min(...used)
    const max = Math.max(...used)
    // Os que já usam o rótulo têm de ser um bloco só, e este keyframe tem de
    // encostar nele (antes, depois ou dentro).
    const usedIsContiguous = max - min + 1 === used.length
    return usedIsContiguous && index >= min - 1 && index <= max + 1
  }

  if (contiguousWith(wanted)) return wanted

  // "Andando 2" repetido vira "Andando 3", e não "Andando 2 2".
  const base = wanted.replace(/\s+\d+$/, '')
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base} ${suffix}`
    if (contiguousWith(candidate)) return candidate
  }
  return wanted
}

/**
 * Um rótulo LIVRE na animação: o desejado, ou ele com sufixo numérico se já
 * existir em qualquer lugar. É o que os trechos prontos usam ao entrar na linha
 * do tempo (item 38) — acrescentar "Andando" duas vezes tem de dar "Andando 1"
 * e "Andando 2", dois grupos, e não um bloco de dez keyframes.
 *
 * Diferente de `uniqueKeyframeLabel`, que aceita o rótulo do grupo vizinho: lá
 * o usuário está ESTENDENDO um grupo à mão, aqui está acrescentando outro
 * trecho.
 */
export function freeKeyframeLabel(keyframes: readonly AnimationKeyframe[], desired: string): string {
  const wanted = desired.trim()
  if (wanted === '') return ''

  const used = new Set(
    keyframes.map((keyframe) => keyframe.label?.trim()).filter((label): label is string => !!label),
  )
  if (!used.has(wanted)) return wanted

  const base = wanted.replace(/\s+\d+$/, '')
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base} ${suffix}`
    if (!used.has(candidate)) return candidate
  }
  return wanted
}

/**
 * Instante do keyframe anterior (`-1`) ou seguinte (`1`) ao ponto em que a
 * linha do tempo está — o "pular keyframe" da régua (item 29). `null` quando
 * já não há para onde ir naquele sentido.
 *
 * A comparação é ESTRITA: parado em cima de um keyframe, "próximo" é o
 * seguinte, não ele mesmo.
 */
export function neighbourKeyframeTimeMs(
  startTimesMs: readonly number[],
  timeMs: number,
  direction: -1 | 1,
): number | null {
  const now = Math.round(timeMs)
  if (direction === -1) {
    const earlier = startTimesMs.filter((start) => start < now)
    return earlier.length > 0 ? Math.max(...earlier) : null
  }
  const later = startTimesMs.filter((start) => start > now)
  return later.length > 0 ? Math.min(...later) : null
}

/**
 * Índice do keyframe que está EXATAMENTE no instante dado, ou -1.
 *
 * É o que diz "o playhead parou em cima deste": serve para o painel marcar em
 * qual keyframe os botões ⏮/⏭ da barra pararam (pedido do usuário). Diferente
 * do `anchorKeyframeIndex` do papel-cebola, que devolve o keyframe de trás
 * quando se está NO MEIO de um trecho — aqui, no meio do trecho não há
 * keyframe nenhum sob o playhead, e a resposta certa é "nenhum".
 *
 * Compara arredondado em milissegundos porque é assim que os instantes chegam:
 * a régua manda inteiros e as setas de quadro caem na grade de 1/fps.
 */
export function keyframeIndexAtTimeMs(animation: Animation | null, timeMs: number): number {
  if (!animation) return -1
  const now = Math.round(timeMs)
  return keyframeStartTimesMs(animation).findIndex((start) => Math.round(start) === now)
}

/**
 * Um quadro para trás ou para frente, na grade de 1/fps (item 29).
 *
 * O passo é calculado pelo ÍNDICE do quadro, e não somando `1000/fps` ao
 * instante atual: a 60 fps o quadro dura 16,67 ms, e somar o arredondamento a
 * cada clique iria acumulando erro até as setas não caírem mais em cima de
 * quadro nenhum.
 */
export function stepFrameMs(timeMs: number, fps: number, direction: -1 | 1, totalMs: number): number {
  if (!(fps > 0)) return timeMs

  const exact = (timeMs * fps) / 1000
  const nearest = Math.round(exact)
  // "Em cima de um quadro" com folga para o erro de ponto flutuante — sem isso,
  // a 60 fps (quadro de 16,666… ms) o instante devolvido reentraria como
  // 1,9999… e a seta ficaria presa no mesmo quadro.
  const onGrid = Math.abs(exact - nearest) < 1e-6
  const frame = onGrid
    ? nearest + direction
    : direction === 1
      ? Math.floor(exact) + 1
      : Math.ceil(exact) - 1

  // O resultado NÃO é arredondado ao milissegundo: a 60 fps o quadro não cai em
  // número inteiro de ms, e arredondar aqui faria cada passo perder um pouco da
  // grade até as setas emperrarem.
  return Math.min(totalMs, Math.max(0, (frame * 1000) / fps))
}

/**
 * Onde e como um keyframe novo entra ao cortar a linha do tempo num instante
 * qualquer — o "inserir keyframe aqui" do painel.
 */
export interface KeyframeSplit {
  /** Posição do keyframe novo na lista. */
  index: number
  /** Instante do corte, já arredondado ao milissegundo. */
  timeMs: number
  /** Duração do trecho que CHEGA ao keyframe novo. */
  durationMs: number
  /** Nova duração do keyframe seguinte — o resto do trecho cortado. */
  nextDurationMs: number
}

/**
 * Plano de corte da linha do tempo em `timeMs`, ou `null` quando não há trecho
 * para cortar.
 *
 * **As duas metades somam o trecho original**, e é isso que faz o keyframe novo
 * não mudar nada: o total da animação e o instante de todos os outros keyframes
 * ficam onde estavam, e (como a interpolação é feita numa parametrização com
 * propriedade de semigrupo) o movimento continua o mesmo. Quem insere ganha um
 * ponto de ajuste, não uma animação diferente.
 *
 * O corte tem de cair **estritamente dentro** de um trecho. Em cima de um
 * keyframe não há o que dividir, e uma metade de duração zero seria grampeada
 * para 1 ms por `clampKeyframeDuration` — alongando a animação justamente na
 * operação que promete não mexer nela.
 */
export function planKeyframeSplit(animation: Animation, timeMs: unknown): KeyframeSplit | null {
  if (typeof timeMs !== 'number' || !Number.isFinite(timeMs)) return null
  if (animation.keyframes.length < 2) return null

  const cut = Math.round(timeMs)
  const starts = keyframeStartTimesMs(animation)

  for (let index = 0; index < animation.keyframes.length - 1; index += 1) {
    if (cut > starts[index] && cut < starts[index + 1]) {
      return {
        index: index + 1,
        timeMs: cut,
        durationMs: cut - starts[index],
        nextDurationMs: starts[index + 1] - cut,
      }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Leitura de dado não confiável (autosave, `animations.json`)
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function sanitizeVec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3 || value.some((n) => typeof n !== 'number' || Number.isNaN(n))) {
    return fallback
  }
  return [value[0] as number, value[1] as number, value[2] as number]
}

function sanitizeRotation(value: unknown): JointRotation {
  const source = asRecord(value)
  const axis = (name: 'x' | 'y' | 'z') => (typeof source[name] === 'number' ? (source[name] as number) : 0)
  return { x: axis('x'), y: axis('y'), z: axis('z') }
}

function sanitizeFigure(value: unknown, index: number): Figure {
  const source = asRecord(value)

  const pose: Record<string, JointRotation> = {}
  for (const [jointName, rotation] of Object.entries(asRecord(source.pose))) {
    if (!JOINT_NAMES.includes(jointName)) continue
    pose[jointName] = clampJointRotation(jointName, sanitizeRotation(rotation))
  }

  const height = typeof source.height === 'number' ? source.height : REFERENCE_HEIGHT_M

  return {
    id: typeof source.id === 'string' ? source.id : `figure-${index + 1}`,
    name: typeof source.name === 'string' ? source.name : `Figure ${index + 1}`,
    color: normalizeFigureColor(source.color) ?? DEFAULT_FIGURE_COLOR,
    visible: typeof source.visible === 'boolean' ? source.visible : true,
    height: Math.min(MAX_HEIGHT_M, Math.max(MIN_HEIGHT_M, height)),
    position: sanitizeVec3(source.position, [0, 0, 0]),
    rotation: sanitizeRotation(source.rotation),
    pose: withLegacyIndexFinger(pose),
  }
}

function sanitizeCamera(value: unknown): CameraViewState | null {
  const source = asRecord(value)
  if (!Array.isArray(source.position) || !Array.isArray(source.target)) return null
  return {
    position: sanitizeVec3(source.position, [0, 0, 0]),
    target: sanitizeVec3(source.target, [0, 0, 0]),
    up: sanitizeVec3(source.up, [0, 1, 0]),
    focalMm: typeof source.focalMm === 'number' && source.focalMm > 0 ? source.focalMm : 50,
  }
}

function sanitizeKeyframe(value: unknown, index: number): AnimationKeyframe | null {
  const source = asRecord(value)
  // Sem bonecos ou sem câmera não há retrato de cena — o keyframe é descartado
  // em vez de entrar meio montado e quebrar a interpolação lá na frente.
  if (!Array.isArray(source.figures)) return null
  const camera = sanitizeCamera(source.camera)
  if (!camera) return null

  // O rótulo do grupo é opcional e puramente informativo: o que não for texto
  // com conteúdo entra como keyframe sem grupo, em vez de invalidá-lo.
  const label = typeof source.label === 'string' ? source.label.trim() : ''

  return {
    id: typeof source.id === 'string' ? source.id : `keyframe-${index + 1}`,
    durationMs: clampKeyframeDuration(source.durationMs),
    figures: source.figures.map((figure, figureIndex) => sanitizeFigure(figure, figureIndex)),
    camera,
    ...(label === '' ? {} : { label }),
  }
}

/**
 * Lê uma lista de animações vinda de fora (autosave ou `animations.json`
 * editado à mão), sem nunca assumir que os campos existem ou têm o tipo certo
 * — mesma política do resto da persistência. As poses passam pelo grampeamento
 * de `skeleton.ts`, como em qualquer outro carregamento.
 */
export function sanitizeAnimations(value: unknown): Animation[] {
  if (!Array.isArray(value)) return []

  const animations: Animation[] = []
  value.forEach((candidate, index) => {
    const source = asRecord(candidate)
    if (!Array.isArray(source.keyframes)) return
    animations.push({
      id: typeof source.id === 'string' ? source.id : `animation-${index + 1}`,
      name: typeof source.name === 'string' && source.name.trim() !== '' ? source.name : `Animation ${index + 1}`,
      // Arquivo antigo (ou editado à mão sem o campo) toca na velocidade
      // normal — é o que o autor daquela animação viu quando a montou.
      speed: clampAnimationSpeed(source.speed),
      keyframes: source.keyframes
        .map((keyframe, keyframeIndex) => sanitizeKeyframe(keyframe, keyframeIndex))
        .filter((keyframe): keyframe is AnimationKeyframe => keyframe !== null),
    })
  })
  return animations
}
