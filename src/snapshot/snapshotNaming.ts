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

export function formatSnapshotFilename(sceneName: string, sequence: number): string {
  const slug = slugifySceneName(sceneName)
  const padded = String(sequence).padStart(3, '0')
  return `${slug}_snap${padded}.png`
}
