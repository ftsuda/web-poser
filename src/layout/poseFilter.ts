/**
 * Filtro da lista de poses (PLANO.md, item 35): busca por trecho do nome,
 * ignorando caixa e acento — "em pe" tem de achar "Em pé", porque é assim que
 * se digita rápido. Puro e minúsculo, mas num módulo próprio para o
 * comportamento ficar travado por teste fora do render do painel.
 */

/** Minúsculas e sem diacríticos — a forma canônica da comparação. */
function canonical(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** O nome passa no filtro? Filtro vazio (ou só espaços) aceita tudo. */
export function matchesPoseFilter(label: string, filter: string): boolean {
  const wanted = canonical(filter.trim())
  if (wanted === '') return true
  return canonical(label).includes(wanted)
}
