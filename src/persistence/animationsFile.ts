import { sanitizeAnimations, type Animation } from '../animation/animation'

/**
 * Schema do `animations.json` gravado junto com o workspace: as animações do
 * usuário (PLANO.md > "Mini animador"). Segue exatamente o padrão do
 * `poses.json` (DECISOES.md #42) e do `joint-limits.json` (#29): arquivo
 * separado do manifesto, apontado por ele, auto-explicativo e sanitizado na
 * leitura.
 *
 * A animação é do WORKSPACE, não de uma cena — decisão do usuário
 * (DECISOES.md #52). Cada keyframe carrega um retrato completo da cena, então
 * uma animação é autossuficiente e vale a partir de qualquer cena; e o arquivo
 * de cena continua sendo só a cena, sem linha do tempo dentro dele.
 * Blender validada na fase 6.
 */

export const ANIMATIONS_FILENAME = 'animations.json'
export const ANIMATIONS_VERSION = 1

/** Explicação embutida no próprio arquivo — JSON não aceita comentários. */
const README_LINES: readonly string[] = [
  'Animações do usuário. Cada animação é uma lista de keyframes; cada keyframe é um retrato COMPLETO da cena: todos os bonecos (pose, colocação, altura, cor, visibilidade) mais a câmera.',
  '"durationMs" é a duração, em milissegundos, da transição que CHEGA àquele keyframe. A do primeiro keyframe é ignorada — não existe trecho antes dele.',
  '"speed" multiplica a VELOCIDADE de toda a linha do tempo, tanto na reprodução quanto no vídeo: 0.5 toca na metade da velocidade (vídeo com o dobro do comprimento) e 1.15 acelera 15%. Vai de 0.1 a 5, de 0.05 em 0.05; sem o campo, vale 1. Os keyframes não mudam de instante.',
  'A câmera guarda "position", "target" (para onde olha), "up" (topo da tela, que carrega a inclinação holandesa) e "focalMm" (a lente). Tudo em metros, exceto a lente.',
  'A interpolação entre dois keyframes é LINEAR no tempo: a velocidade é constante dentro de cada trecho e muda em cada keyframe.',
  'Membros podem atravessar o corpo, outro boneco ou o chão durante a transição — isso é resolvido com os keyframes certos, não automaticamente.',
  'Juntas fora dos limites em vigor são ajustadas para dentro deles ao carregar; keyframes sem bonecos ou sem câmera são ignorados.',
  'Exportado pelo painel de animação, o arquivo traz UMA animação — a de trabalho. Na importação, todos os keyframes do arquivo formam uma linha do tempo só, mesmo que venham de várias entradas.',
]

export interface AnimationsFile {
  version: number
  leiame: readonly string[]
  animations: Animation[]
}

export function buildAnimationsFile(animations: readonly Animation[]): AnimationsFile {
  return { version: ANIMATIONS_VERSION, leiame: README_LINES, animations: [...animations] }
}

/**
 * Lê um `animations.json` (nunca confiável). Aceita tanto o arquivo completo
 * quanto a lista crua — quem edita à mão às vezes cola só o array, como no
 * `poses.json`.
 */
export function parseAnimationsFile(json: unknown): Animation[] {
  if (Array.isArray(json)) return sanitizeAnimations(json)
  const source = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>
  return sanitizeAnimations(source.animations)
}

// ---------------------------------------------------------------------------
// Arquivo AVULSO de uma animação (fase 12) — exportar/importar pelo painel
// ---------------------------------------------------------------------------

/** O JSON de UMA animação, pronto para baixar — mesmo arquivo do workspace, com uma entrada só. */
export function serializeAnimationFile(animation: Animation): string {
  return JSON.stringify(buildAnimationsFile([animation]), null, 2)
}

/** O que a importação lê de um arquivo: uma linha do tempo, sem id (quem importa decide onde ela entra). */
export interface ImportedAnimation {
  name: string
  speed: number
  keyframes: Animation['keyframes']
}

/**
 * Lê um arquivo de animação para importar (decisão do usuário, fase 12):
 * **todos os keyframes do arquivo formam UMA animação**, na ordem em que
 * aparecem. Um `animations.json` inteiro de workspace, portanto, entra como uma
 * linha do tempo só — nome e velocidade vêm da primeira entrada.
 *
 * Devolve `null` quando não sobrou keyframe válido: é o caso do arquivo que não
 * é de animação, do vazio e do que só tinha keyframes quebrados (sem bonecos ou
 * sem câmera, descartados por `sanitizeAnimations`).
 */
export function parseImportedAnimation(json: unknown): ImportedAnimation | null {
  const animations = parseAnimationsFile(json)
  const keyframes = animations.flatMap((animation) => animation.keyframes)
  if (keyframes.length === 0) return null

  const first = animations[0]
  return { name: first.name, speed: first.speed, keyframes }
}
