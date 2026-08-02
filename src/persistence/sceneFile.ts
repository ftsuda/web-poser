import type { CameraBookmark } from '../store/figuresStore'
import {
  SCENE_EXTRAS_VERSION,
  cameraBookmarkFromExtras,
  cameraBookmarkToExtras,
  sceneFromExtras,
  sceneToExtras,
  type SceneWorkingState,
} from './sceneSerialization'

/**
 * Arquivos JSON de cena e de bookmarks de câmera — o que o painel baixa e o
 * que a pasta do workspace guarda (`scene.json` por cena).
 *
 * **Havia aqui um terceiro, de boneco avulso, removido em DECISOES.md #87.**
 * Depois da unificação do formato do boneco (#86) ele tinha virado quase o mesmo
 * artefato do arquivo de pose (`figurePoseFile.ts`) — a diferença era a chave de
 * embrulho e o X/Z —, com uma segunda função de leitura, um segundo conjunto de
 * mensagens de erro e uma falha silenciosa própria. Boneco em arquivo é hoje um
 * caminho só.
 *
 * **Era `.glb` até DECISOES.md #85.** O `.glb` carregava este mesmo bloco de
 * dados em `extras["virtual-mockup"]` (o nome de batismo do app, hoje
 * WebPoser) mais uma geometria glTF (esfera por
 * junta, cilindro por osso) que servia só para abrir no Blender: a importação
 * nunca leu a malha de volta, só o `extras`. Medido, isso dava ~200× de peso
 * morto (245 KB contra 1,2 KB para um boneco). Trocado o envelope, o conteúdo
 * é exatamente o mesmo — `sceneSerialization.ts` não mudou uma linha, e é ele
 * que define o formato. A ponte para o Blender volta como módulo próprio de
 * rigging (PLANO.md > "Integração com o Blender (rigging)").
 *
 * As três famílias seguem o padrão dos outros arquivos da pasta
 * (`poses.json`, `animations.json`, `joint-limits.json`): `version`, `leiame`
 * embutido e sanitização total na leitura.
 */

export const SCENE_FILE_VERSION = SCENE_EXTRAS_VERSION

/** Explicação embutida no próprio arquivo — JSON não aceita comentários. */
const SCENE_README_LINES: readonly string[] = [
  'Uma cena inteira: bonecos, objetos, ambiente, bookmarks de câmera e a câmera de cena.',
  'As juntas de cada boneco ficam em "pose", em GRAUS, como {"x":0,"y":0,"z":0} por junta. "rotation" é a inclinação do boneco inteiro e "height" a altura dele em metros.',
  'É o MESMO objeto de boneco do animations.json e do arquivo de pose avulsa — um boneco daqui pode ser colado lá sem conversão.',
  'A forma antiga ("joints" com [x, y, z]) continua sendo aceita na leitura: uma cena gravada antes ainda abre.',
  'Cuidado com pares L/R: nos eixos y e z o MESMO número produz o movimento oposto nos dois lados (ver DECISOES.md #14).',
  'Objetos de cena guardam forma + tamanho + desvios de vértice ("vertices"), nunca uma malha — a geometria é reconstruída ao abrir, e o objeto continua editável como primitiva.',
  'A câmera de cena guarda "position", "target" (para onde olha), "up" (topo da tela, que carrega a inclinação holandesa) e "focalMm" (a lente).',
  'Os campos "next*Seq" e "snapshotCounter" são contadores de nomes automáticos: mexer neles só muda o número do próximo boneco/objeto/bookmark/instantâneo.',
  'Juntas desconhecidas são descartadas e as que estiverem fora dos limites em vigor são ajustadas para dentro deles.',
  'Limites articulares, poses, animações e trechos NÃO ficam aqui: são do workspace, cada um no seu arquivo (joint-limits.json, poses.json, animations.json, clips.json).',
]

const CAMERA_BOOKMARKS_README_LINES: readonly string[] = [
  'Bookmarks de câmera: vistas nomeadas, para reenquadrar a cena sem procurar o ângulo de novo.',
  '"position" é de onde a câmera olha e "target" para onde; ambos em metros. "up" é o topo da tela, e é ele que carrega a inclinação holandesa.',
  '"projection" é "perspective" ou "orthographic"; "fov" vale na perspectiva e "zoom" na ortográfica.',
  'Importar ACRESCENTA à lista existente, não substitui.',
]

/**
 * Motivo pelo qual um arquivo não pôde ser importado (fase 9, item 4):
 * - `unreadable`: o texto não é JSON válido (arquivo corrompido, truncado ou
 *   de outro formato).
 * - `missingAppData`: é JSON válido, mas sem o `version` que todo arquivo
 *   nosso grava — é o marcador mais barato de "este arquivo é nosso". Antes de
 *   existir, um JSON qualquer passava silenciosamente e substituía a cena de
 *   trabalho por uma cena vazia.
 */
export type SceneFileErrorReason = 'unreadable' | 'missingAppData'

export class SceneFileError extends Error {
  // Campo declarado à parte (e não como parâmetro do construtor): o
  // `erasableSyntaxOnly` do tsconfig proíbe parameter properties, por serem
  // sintaxe TS que não some na transpilação.
  readonly reason: SceneFileErrorReason

  constructor(reason: SceneFileErrorReason, options?: { cause?: unknown }) {
    super(`Arquivo não pôde ser importado: ${reason}`, options)
    this.name = 'SceneFileError'
    this.reason = reason
  }
}

/**
 * Lê o texto de um arquivo nosso, traduzindo as duas falhas possíveis para
 * `SceneFileError`.
 *
 * Recebe TEXTO, e não um objeto já parseado (diferente de `parsePosesFile` e
 * companhia): é o que permite separar "não é JSON" de "é JSON, mas não é
 * nosso" — as duas mensagens que o usuário vê.
 */
function readAppJson(text: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new SceneFileError('unreadable', { cause: error })
  }

  const source = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
  if (typeof source.version !== 'number') throw new SceneFileError('missingAppData')
  return source
}

// ---------------------------------------------------------------------------
// Cena
// ---------------------------------------------------------------------------

export function serializeSceneFile(scene: SceneWorkingState): string {
  // `version` sai do resto de propósito: a ordem das chaves no arquivo é a
  // ordem em que aparecem aqui, e quem abre no editor tem de ver primeiro o que
  // identifica o arquivo e a explicação — não o meio da cena.
  const { version, ...rest } = sceneToExtras(scene)
  return JSON.stringify({ version, leiame: SCENE_README_LINES, ...rest }, null, 2)
}

export function parseSceneFile(text: string): SceneWorkingState {
  return sceneFromExtras(readAppJson(text))
}

// ---------------------------------------------------------------------------
// Bookmarks de câmera
// ---------------------------------------------------------------------------

export function serializeCameraBookmarksFile(bookmarks: readonly CameraBookmark[]): string {
  return JSON.stringify(
    {
      version: SCENE_FILE_VERSION,
      leiame: CAMERA_BOOKMARKS_README_LINES,
      cameraBookmarks: bookmarks.map(cameraBookmarkToExtras),
    },
    null,
    2,
  )
}

export function parseCameraBookmarksFile(text: string): CameraBookmark[] {
  const source = readAppJson(text)
  // Como no boneco, um `scene.json` inteiro serve de fonte: os bookmarks dele
  // estão exatamente sob esta mesma chave.
  const bookmarks = Array.isArray(source.cameraBookmarks) ? source.cameraBookmarks : []
  return bookmarks.map((bookmarkExtras, index) => cameraBookmarkFromExtras(bookmarkExtras, index))
}
