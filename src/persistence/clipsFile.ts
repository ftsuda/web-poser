import { sanitizeSavedClips, type SavedClip } from '../animation/clipLibrary'

/**
 * Schema do `clips.json` gravado junto com o workspace: a biblioteca de trechos
 * do usuário (PLANO.md > lista de propostas, item 39). Mesmo padrão do
 * `poses.json` (DECISOES.md #42), do `animations.json` (#52) e do
 * `joint-limits.json` (#29): arquivo separado do manifesto, apontado por ele,
 * auto-explicativo e sanitizado na leitura.
 *
 * O trecho é do WORKSPACE, não de uma cena: é o que permite montar uma
 * sequência numa cena e reaplicá-la em qualquer outra. Por isso não entra no
 * arquivo da cena.
 */

export const CLIPS_FILENAME = 'clips.json'
export const CLIPS_VERSION = 1

/** Explicação embutida no próprio arquivo — JSON não aceita comentários. */
const README_LINES: readonly string[] = [
  'Trechos de animação salvos pelo usuário. Cada trecho é uma sequência de passos; cada passo guarda a pose, a colocação e o giro de cada PAPEL (0, 1, 2…), mais a duração da transição que chega até ele.',
  'O trecho NÃO guarda câmera: ao inseri-lo numa animação, a câmera atual é congelada em todos os keyframes — a mesma regra dos trechos de fábrica.',
  'Papéis, e não bonecos: ao inserir, cada papel é mapeado para um boneco da cena, e o trecho é reancorado na posição e no heading do boneco do papel 0.',
  '"roleHeights" é a altura (em metros) de cada papel na gravação — é ela que permite reescalar os deslocamentos ao aplicar o trecho em bonecos de outra altura.',
  '"label" é o rótulo do grupo do keyframe gravado; ao inserir, um rótulo já usado ganha sufixo numérico.',
  'Trechos com menos de dois passos são ignorados na leitura, assim como juntas desconhecidas; ângulos fora dos limites em vigor são ajustados para dentro deles.',
]

export interface ClipsFile {
  version: number
  leiame: readonly string[]
  clips: SavedClip[]
}

export function buildClipsFile(clips: readonly SavedClip[]): ClipsFile {
  return { version: CLIPS_VERSION, leiame: README_LINES, clips: [...clips] }
}

/**
 * Lê um `clips.json` (nunca confiável). Aceita tanto o arquivo completo quanto
 * a lista crua — quem edita à mão às vezes cola só o array, como no
 * `poses.json`.
 */
export function parseClipsFile(json: unknown): SavedClip[] {
  if (Array.isArray(json)) return sanitizeSavedClips(json)
  const source = (typeof json === 'object' && json !== null ? json : {}) as Record<string, unknown>
  return sanitizeSavedClips(source.clips)
}
