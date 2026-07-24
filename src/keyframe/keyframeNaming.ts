/**
 * Nomenclatura sequencial de keyframes (ver PLANO.md > "Exportação de
 * imagem (keyframes)"): `nome-da-cena_kf001.png`, `kf002`… Lógica pura,
 * sem nenhuma dependência de DOM/File System Access — o resto do fluxo de
 * captura (`KeyframeCapture.tsx`) só chama essas funções.
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

export function formatKeyframeFilename(sceneName: string, sequence: number): string {
  const slug = slugifySceneName(sceneName)
  const padded = String(sequence).padStart(3, '0')
  return `${slug}_kf${padded}.png`
}
