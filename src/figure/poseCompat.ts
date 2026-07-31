/**
 * Compatibilidade de poses gravadas antes do dedo INDICADOR separado
 * (DECISOES.md #45).
 *
 * Até o #44 os quatro dedos eram um bloco só (`fingersBase/Mid/Tip`). Arquivos
 * daquela época — cenas, biblioteca de poses, autosave — não têm as
 * juntas `index*`, e a leitura simplesmente ignora junta ausente: o indicador
 * nasceria ESTICADO enquanto os outros três continuam fechados, ou seja um
 * punho salvo reabriria apontando.
 *
 * A migração copia o ângulo do bloco para o indicador, o que reproduz o gesto
 * antigo EXATAMENTE (lá, um número comandava os quatro dedos). A decisão é
 * tomada por MÃO: basta o arquivo trazer UMA junta `index*` daquele lado para
 * a mão inteira ser considerada nova e passar intacta — quem grava a pose
 * decide onde está o indicador dela, e um preenchimento parcial inventaria um
 * gesto que ninguém salvou.
 */

const LEGACY_PAIRS: readonly (readonly [block: string, index: string])[] = [
  ['fingersBase', 'indexBase'],
  ['fingersMid', 'indexMid'],
  ['fingersTip', 'indexTip'],
]

const SIDES = ['L', 'R'] as const

/**
 * Pose com o indicador preenchido a partir do bloco onde ele faltava. Devolve
 * a MESMA referência quando não há nada a migrar — o caso normal de todo
 * arquivo gravado a partir do #45.
 */
export function withLegacyIndexFinger<T>(pose: Record<string, T>): Record<string, T> {
  let migrated: Record<string, T> | null = null

  for (const side of SIDES) {
    if (LEGACY_PAIRS.some(([, index]) => `${index}.${side}` in pose)) continue
    for (const [block, index] of LEGACY_PAIRS) {
      const blockName = `${block}.${side}`
      if (!(blockName in pose)) continue
      migrated ??= { ...pose }
      migrated[`${index}.${side}`] = pose[blockName]
    }
  }

  return migrated ?? pose
}
