/**
 * Carimbo de data/hora dos arquivos que o app exporta (pedido do usuário,
 * 2026-08-07): `minha-cena_2026-08-07-1432.json`.
 *
 * O motivo é o de sempre com nome de arquivo exportado: sem o carimbo, exportar
 * a mesma cena duas vezes dá dois arquivos de nome idêntico — o navegador
 * resolve com `(1)`, `(2)`, e a pasta de referências vira um monte de nome
 * repetido sem dizer qual é o mais recente. O instantâneo PNG já resolvia isso
 * com um contador por cena (`_snap003`), mas o contador só ordena; a data
 * também DIZ quando. Agora as duas coisas convivem: o contador continua sendo
 * quem garante que nada se sobrescreve dentro do mesmo minuto.
 *
 * **Hora local, não UTC.** O nome tem de bater com o relógio de quem exportou —
 * o app é offline e de uso pessoal, e não há nada para conciliar entre máquinas.
 *
 * **O carimbo é sempre o ÚLTIMO sufixo antes da extensão**, mesmo quando o nome
 * já traz outro (o `_depth` do mapa de profundidade, o `_snap003` do
 * instantâneo). É o que mantém a extensão no fim, onde o sistema operacional a
 * procura, e deixa os sufixos de conteúdo colados no nome a que pertencem.
 *
 * Isto NÃO vale para a pasta do workspace: `workspace.json`, `poses.json`,
 * `animations.json`, `clips.json` e `joint-limits.json` são nomes reservados
 * (DECISOES.md #85) que o app tem de reencontrar ao reabrir a pasta, e o
 * autosave grava por cima de propósito.
 */

const pad = (valor: number) => String(valor).padStart(2, '0')

/** `2026-08-07-1432` — data e hora locais, com resolução de minuto. */
export function formatExportTimestamp(now: Date = new Date()): string {
  const data = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return `${data}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

/**
 * Insere `_AAAA-MM-DD-HHmm` antes da extensão do nome recebido. Nome sem
 * extensão (ou que só tem ponto inicial, como `.cena`) recebe o carimbo no fim.
 */
export function withExportTimestamp(filename: string, now: Date = new Date()): string {
  const carimbo = `_${formatExportTimestamp(now)}`
  const ponto = filename.lastIndexOf('.')
  if (ponto <= 0) return `${filename}${carimbo}`
  return `${filename.slice(0, ponto)}${carimbo}${filename.slice(ponto)}`
}
