/**
 * Nomenclatura sequencial de instantâneos (ver PLANO.md > "Exportação de
 * imagem (instantâneos)"): `nome-da-cena_snap001.png`, `snap002`… Lógica pura,
 * sem nenhuma dependência de DOM/File System Access — o resto do fluxo de
 * captura (`SnapshotCapture.tsx`) só chama essas funções.
 *
 * O prefixo era `kf` (de *keyframe*) até a fase 10, quando a palavra passou a
 * designar os marcos da animação (DECISOES.md #52). O contador é por cena e
 * continua de onde parou, então uma cena que já gravou até `kf012` grava o
 * próximo como `snap013`: a sequência não reinicia e nada é sobrescrito.
 */

import { withExportTimestamp } from '../persistence/exportTimestamp'

/** Caracteres reservados em nomes de arquivo no Windows, mais barra normal. */
const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\s]+/g

const FALLBACK_SCENE_SLUG = 'scene'

export function slugifySceneName(name: string): string {
  const slug = name
    .trim()
    .replace(UNSAFE_FILENAME_CHARS, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || FALLBACK_SCENE_SLUG
}

/**
 * Sufixo do mapa de profundidade (fase 13). A profundidade é uma saída
 * ALTERNATIVA — quem quer as duas versões captura duas vezes, e cada captura
 * consome um número da sequência. Sem o sufixo, os dois arquivos seriam
 * indistinguíveis na pasta a não ser abrindo cada um.
 */
export const DEPTH_FILENAME_SUFFIX = '_depth'

export interface SnapshotNameOptions {
  depth?: boolean
  /** Instante do carimbo de hora; injetável para os testes não dependerem do relógio. */
  now?: Date
}

export function formatSnapshotFilename(
  sceneName: string,
  sequence: number,
  options: SnapshotNameOptions = {},
): string {
  const slug = slugifySceneName(sceneName)
  const padded = String(sequence).padStart(3, '0')
  const suffix = options.depth ? DEPTH_FILENAME_SUFFIX : ''
  // O carimbo de hora vem por último, antes da extensão (ver `exportTimestamp.ts`).
  // A sequência CONTINUA sendo quem garante que duas capturas do mesmo minuto
  // não se sobrescrevam — a data diz quando, o contador diz qual veio antes.
  return withExportTimestamp(`${slug}_snap${padded}${suffix}.png`, options.now)
}
